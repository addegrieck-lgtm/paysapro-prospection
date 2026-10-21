import { Hono, type MiddlewareHandler } from 'hono';
import type { AppEnv } from '../app/context';
import { publishedLocalPages, publishedPortfolio, publishedPosts, publishedProducts } from '../repo/catalog';
import { SERVICE_PAGES } from '../web/content';
import { escapeHtml } from '../domain/text';
import { initials } from '../domain/settings';

export const seoRoutes = new Hono<AppEnv>();

const STATIC_PATHS = ['/', '/tarifs', '/impression', '/configurateur', '/devis', '/realisations', '/etudes-de-cas', '/a-propos', '/contact', '/blog', '/espace-client', '/mentions-legales', '/confidentialite', '/cookies', '/cgv', '/plan-du-site'];

/** Toutes les URL publiques indexables (sitemap). */
export async function publicUrls(db: AppEnv['Variables']['deps']['db']): Promise<{ path: string; lastmod?: string }[]> {
  const [posts, products, items, local] = await Promise.all([publishedPosts(db), publishedProducts(db), publishedPortfolio(db), publishedLocalPages(db)]);
  return [
    ...STATIC_PATHS.map((path) => ({ path })),
    ...SERVICE_PAGES.map((p) => ({ path: p.path })),
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

/** Favicon généré à partir du nom de l'agence (logo provisoire). */
seoRoutes.get('/favicon.svg', (c) => {
  const s = c.get('settings');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect x="1" y="1" width="38" height="38" rx="11" fill="#16161A"/><path d="M10 31c3.3-2.4 6.7-2.4 10 0s6.7 2.4 10 0" fill="none" stroke="${s.accentColor}" stroke-width="2.4" stroke-linecap="round"/><text x="20" y="24" text-anchor="middle" font-family="Georgia, serif" font-size="14" font-weight="600" fill="#fff">${escapeHtml(initials(s.agencyName))}</text></svg>`;
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
