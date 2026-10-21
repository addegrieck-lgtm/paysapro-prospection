import { Hono } from 'hono';
import type { AppEnv, Deps } from './app/context';
import { loadSession, sameOrigin, securityHeaders } from './app/security';
import { getSettings } from './repo/settings';
import { publicRoutes } from './routes/public';
import { seoRoutes, redirects } from './routes/seo';
import { adminRoutes } from './routes/admin';
import { clientRoutes } from './routes/client';
import { NotFoundPage } from './web/public/pages';
import { migrate } from './db/migrations';
import { trackPageView } from './services/analytics';
import { seedIfEmpty } from './db/seed';

/** Prépare la base (migrations + données initiales). À appeler au démarrage. */
export async function prepareDatabase(deps: Pick<Deps, 'db'>): Promise<void> {
  await migrate(deps.db);
  await seedIfEmpty(deps.db);
}

export function createApp(deps: Deps) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    const url = new URL(c.req.url);
    // HTTPS obligatoire en production (Cloudflare) : redirection permanente des requêtes HTTP.
    if (deps.config.forceHttps && url.protocol === 'http:') {
      url.protocol = 'https:';
      return c.redirect(url.toString(), 301);
    }
    // Domaine sans « www » → domaine principal (une seule adresse indexée).
    const host = deps.config.canonicalHost;
    if (host && host !== url.hostname && url.hostname === host.replace(/^www\./, '')) {
      url.hostname = host;
      url.protocol = 'https:';
      return c.redirect(url.toString(), 301);
    }
    c.set('deps', deps);
    const settings = await getSettings(deps.db);
    // Pages publiques : sans adresse de site configurée, les URL absolues (canonical, sitemap, données structurées,
    // Open Graph) utilisent le domaine principal, à défaut l'origine de la requête. L'administration conserve la valeur
    // réellement enregistrée.
    const publicPage = !url.pathname.startsWith('/admin');
    const fallback = host ? `https://${host}` : url.origin;
    c.set('settings', publicPage && !settings.siteUrl ? { ...settings, siteUrl: fallback } : settings);
    await next();
  });
  app.use('*', securityHeaders);
  app.use('*', sameOrigin);
  app.use('*', redirects);
  app.use('*', trackPageView);
  app.use('/admin/*', loadSession);
  app.use('/admin', loadSession);

  app.route('/', seoRoutes);
  app.route('/', publicRoutes);
  app.route('/admin', adminRoutes);
  app.route('/client', clientRoutes);

  app.get('/healthz', (c) => c.json({ ok: true }));

  app.notFound((c) => c.html(<NotFoundPage s={c.get('settings')} path={new URL(c.req.url).pathname} />, 404));

  app.onError((err, c) => {
    // Journalisation minimale : aucune donnée de formulaire ni secret n'est écrit dans les journaux.
    console.error(`[erreur] ${c.req.method} ${new URL(c.req.url).pathname} — ${err instanceof Error ? err.message : String(err)}`);
    const settings = c.get('settings');
    if (!settings) return c.text('Erreur interne.', 500);
    return c.html(
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Erreur — {settings.agencyName}</title>
          <link rel="stylesheet" href="/assets/css/site.css" />
        </head>
        <body>
          <main class="container narrow section">
            <h1>Une erreur est survenue</h1>
            <p>Nous n’avons pas pu traiter votre demande. Réessayez dans quelques instants ou contactez-nous{settings.contactEmail ? ` à ${settings.contactEmail}` : ''}.</p>
            <p>
              <a href="/" class="btn btn-primary">Retour à l’accueil</a>
            </p>
          </main>
        </body>
      </html>,
      500,
    );
  });

  return app;
}
