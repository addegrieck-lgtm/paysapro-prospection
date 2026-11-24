import type { Db } from '../db/types';
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY } from '../domain/indexnow';
import { publicUrls } from '../routes/seo';

// IndexNow : prévient les moteurs dès qu'une page est publiée ou modifiée (envoi quotidien depuis le Worker).

/** Dates SQLite (« 2026-11-24 05:00:00 ») ou ISO, en millisecondes UTC. */
const ms = (d: string) => Date.parse(d.includes('T') ? d : `${d.replace(' ', 'T')}Z`);

/** Chemins publics publiés ou modifiés dans la fenêtre ]since, now] : pages datées du sitemap et articles programmés. */
export async function recentPaths(db: Db, since: Date, now = new Date()): Promise<string[]> {
  const from = since.getTime();
  const to = now.getTime();
  const inWindow = (d?: string | null) => !!d && ms(d) > from && ms(d) <= to;
  const urls = await publicUrls(db);
  const posts = await db.all<{ slug: string; published_at: string }>(
    "SELECT slug, published_at FROM posts WHERE status = 'published' AND published_at IS NOT NULL",
  );
  return [
    ...new Set([
      ...urls.filter((u) => inWindow(u.lastmod)).map((u) => u.path),
      ...posts.filter((p) => inWindow(p.published_at)).map((p) => `/blog/${p.slug}`),
    ]),
  ];
}

/** Envoie les adresses à IndexNow ; renvoie le code HTTP (200 ou 202 = accepté), ou null s'il n'y a rien à envoyer. */
export async function submitIndexNow(base: string, paths: string[], fetchFn: typeof fetch = fetch): Promise<number | null> {
  if (!paths.length) return null;
  const root = base.replace(/\/+$/, '');
  const res = await fetchFn(INDEXNOW_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: new URL(root).host,
      key: INDEXNOW_KEY,
      keyLocation: `${root}/${INDEXNOW_KEY}.txt`,
      urlList: paths.slice(0, 10000).map((p) => root + p),
    }),
  });
  return res.status;
}
