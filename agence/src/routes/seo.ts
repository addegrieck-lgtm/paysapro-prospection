import { Hono, type MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app/context';
import { publishedLocalPages, publishedPortfolio, publishedPosts, publishedProducts } from '../repo/catalog';
import { SERVICE_PAGES } from '../web/content';
import { LANDING_PAGES } from '../web/landing';
import { PACKS } from '../web/packs';
import { escapeHtml } from '../domain/text';

export const seoRoutes = new Hono<AppEnv>();

const STATIC_PATHS = ['/', '/tarifs', '/impression', '/configurateur', '/devis', '/realisations', '/etudes-de-cas', '/a-propos', '/contact', '/blog', '/espace-client', '/mentions-legales', '/confidentialite', '/cookies', '/cgv', '/plan-du-site'];

/** Toutes les URL publiques indexables (sitemap). */
export async function publicUrls(db: AppEnv['Variables']['deps']['db']): Promise<{ path: string; lastmod?: string }[]> {
  const [posts, products, items, local] = await Promise.all([publishedPosts(db), publishedProducts(db), publishedPortfolio(db), publishedLocalPages(db)]);
  return [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...SERVICE_PAGES.map((p) => ({ path: p.path })),
    ...LANDING_PAGES.map((p) => ({ path: p.path })),
    { path: '/devis-vitrophanie-signaletique' },
    { path: '/packs' },
    ...PACKS.map((p) => ({ path: `/packs/${p.slug}` })),
    ...products.map((p) => ({ path: `/impression/${p.slug}`, lastmod: p.updated_at })),
    ...items.map((p) => ({ path: `/realisations/${p.slug}` })),
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

seoRoutes.get('/favicon.ico', (c) => c.redirect('/favicon.svg', 301));

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
