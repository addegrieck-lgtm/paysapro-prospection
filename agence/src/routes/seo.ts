import { Hono, type MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app/context';
import { publishedLocalPages, publishedPortfolio, publishedPosts, publishedProducts, publishedServices } from '../repo/catalog';
import { formatEuros } from '../domain/money';
import { SERVICE_PAGES } from '../web/content';
import { LANDING_PAGES } from '../web/landing';
import { PACKS } from '../web/packs';
import { escapeHtml } from '../domain/text';
import { INDEXNOW_KEY } from '../domain/indexnow';

export const seoRoutes = new Hono<AppEnv>();

// Absentes du sitemap (et en « noindex, follow ») : /configurateur, outil sans texte qui reprend le catalogue /impression,
// et /etudes-de-cas, sous-ensemble de /realisations tant qu'il n'y a pas d'étude de cas réelle.
const STATIC_PATHS = ['/', '/tarifs', '/impression', '/devis', '/realisations', '/a-propos', '/contact', '/blog', '/espace-client', '/mentions-legales', '/confidentialite', '/cookies', '/cgv', '/plan-du-site'];

/** Toutes les URL publiques indexables (sitemap). */
export async function publicUrls(db: AppEnv['Variables']['deps']['db']): Promise<{ path: string; lastmod?: string }[]> {
  const [posts, products, items, local] = await Promise.all([publishedPosts(db), publishedProducts(db), publishedPortfolio(db), publishedLocalPages(db)]);
  return [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...(items.some((p) => p.is_case_study && !p.is_concept) ? [{ path: '/etudes-de-cas' }] : []),
    ...SERVICE_PAGES.map((p) => ({ path: p.path })),
    ...LANDING_PAGES.map((p) => ({ path: p.path })),
    { path: '/devis-vitrophanie-signaletique' },
    { path: '/packs' },
    ...PACKS.map((p) => ({ path: `/packs/${p.slug}` })),
    ...products.map((p) => ({ path: `/impression/${p.slug}`, lastmod: p.updated_at })),
    // Concepts de démonstration (entreprises fictives) : visibles sur le site, mais pas proposés à Google.
    ...items.filter((p) => !p.is_concept).map((p) => ({ path: `/realisations/${p.slug}` })),
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, lastmod: p.updated_at })),
    ...local.map((p) => ({ path: `/agence-web/${p.slug}`, lastmod: p.updated_at })),
  ];
}

seoRoutes.get('/sitemap.xml', async (c) => {
  const s = c.get('settings');
  const base = (s.siteUrl || new URL(c.req.url).origin).replace(/\/+$/, '');
  const urls = await publicUrls(c.get('deps').db);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${escapeHtml(base + u.path)}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
});

/** Résumé de l'agence pour les assistants IA (convention llms.txt), généré à partir des réglages et du catalogue publiés. */
seoRoutes.get('/llms.txt', async (c) => {
  const s = c.get('settings');
  const db = c.get('deps').db;
  const base = (s.siteUrl || new URL(c.req.url).origin).replace(/\/+$/, '');
  const [services, posts, local] = await Promise.all([publishedServices(db), publishedPosts(db), publishedLocalPages(db)]);
  const price = (v: (typeof services)[number]) => {
    if (v.price_mode === 'quote' || v.price_ht === null) return 'sur devis';
    const amount = `${formatEuros(v.price_ht, true)} HT${v.billing === 'monthly' ? ' par mois' : ''}`;
    return v.price_mode === 'from' ? `à partir de ${amount}` : amount;
  };
  const place = [[s.city, s.department && `(${s.department})`].filter(Boolean).join(' '), s.region].filter(Boolean).join(', ');
  const areas = [...s.serviceAreasPrimary, ...s.serviceAreasSecondary];
  const lines = [
    `# ${s.agencyName}`,
    '',
    `> ${s.agencyName} est une agence web et print${place ? ` basée à ${place}` : ''} : création et refonte de sites internet, référencement local, identité visuelle, supports imprimés et vitrophanie pour les artisans, commerçants, indépendants et TPE. Prix de départ affichés, devis gratuit, un interlocuteur unique.`,
    '',
    ...(areas.length ? [`Zone d'intervention : ${areas.join(', ')}${s.serviceArea ? `. ${s.serviceArea}` : ''}.`, ''] : []),
    '## Contact',
    '',
    ...[
      s.contactPhone && `- Téléphone : ${s.contactPhone}`,
      s.contactEmail && `- E-mail : ${s.contactEmail}`,
      (s.streetAddress || s.city) && `- Adresse : ${[s.streetAddress, [s.postalCode, s.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')}`,
      s.openingHours && `- Horaires : ${s.openingHours}`,
      `- Demande de devis : ${base}/devis`,
    ].filter(Boolean),
    '',
    '## Prestations et tarifs',
    '',
    ...services.map((v) => `- ${v.name} (${price(v)}) : ${v.summary}`),
    '',
    `Tous les prix sont hors taxes ; le détail figure sur [la page Tarifs](${base}/tarifs).`,
    '',
    '## Pages principales',
    '',
    ...SERVICE_PAGES.map((p) => `- [${p.name}](${base}${p.path}) : ${p.metaDescription}`),
    ...LANDING_PAGES.map((p) => `- [${p.name}](${base}${p.path}) : ${p.metaDescription}`),
    `- [Réalisations](${base}/realisations)`,
    `- [À propos](${base}/a-propos)`,
    `- [Contact](${base}/contact)`,
    ...(local.length ? ['', '## Pages locales', '', ...local.map((p) => `- [${p.title}](${base}/agence-web/${p.slug})`)] : []),
    ...(posts.length ? ['', '## Articles et conseils', '', ...posts.map((p) => `- [${p.title}](${base}/blog/${p.slug}) : ${p.excerpt}`)] : []),
    '',
  ];
  return c.body(lines.join('\n'), 200, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
});

/** Fichier de clé IndexNow : prouve aux moteurs que les envois viennent bien de ce site. */
seoRoutes.get(`/${INDEXNOW_KEY}.txt`, (c) => c.text(INDEXNOW_KEY));

seoRoutes.get('/robots.txt', (c) => {
  const s = c.get('settings');
  const base = (s.siteUrl || new URL(c.req.url).origin).replace(/\/+$/, '');
  return c.text(`User-agent: *
Disallow: /admin
Disallow: /client/
Disallow: /api/
Disallow: /devis/merci

Sitemap: ${base}/sitemap.xml
`);
});

/** Favicon : symbole des falaises (couleur d'accent paramétrable). */
seoRoutes.get('/favicon.svg', (c) => {
  const s = c.get('settings');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0E4A57"/><g transform="translate(4 8)"><path fill="#fff" d="M2 34V9Q16 7 28 11Q38 14 42 19Q44 23 43 34H37Q37 25 32 25Q27 25 27 34Z"/><path fill="#fff" d="M49 34L51.5 15L54.5 34Z"/><path d="M2 41c5-3.4 10-3.4 15 0s10 3.4 15 0 10-3.4 15 0 10 3.4 15 0" stroke="${escapeHtml(s.accentColor)}" stroke-width="3.6" fill="none" stroke-linecap="round"/></g></svg>`;
  return c.body(svg, 200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600' });
});

// Navigateurs et robots qui demandent /favicon.ico sans lire la page : vrai fichier ICO (scripts/favicons.mjs).
seoRoutes.get('/favicon.ico', (c) => c.redirect('/assets/img/favicon.ico', 301));

/** Redirections administrables (anciennes URL → nouvelles). */
export const redirects: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method === 'GET') {
    const path = new URL(c.req.url).pathname;
    if (!path.startsWith('/admin') && !path.startsWith('/assets') && !path.startsWith('/api')) {
      const r = await c.get('deps').db.get<{ to_path: string; code: number }>('SELECT to_path, code FROM redirects WHERE from_path = ?', [path]);
      if (r) return c.redirect(r.to_path, r.code === 302 ? 302 : 301);
      // Barre oblique finale : une seule URL canonique.
      if (path.length > 1 && path.endsWith('/')) return c.redirect(path.replace(/\/+$/, '') + new URL(c.req.url).search, 301);
    }
  }
  await next();
};
