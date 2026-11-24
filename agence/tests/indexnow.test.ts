import { describe, expect, it } from 'vitest';
import { makeApp, req } from './helpers';
import { INDEXNOW_KEY } from '../src/domain/indexnow';
import { recentPaths, submitIndexNow } from '../src/services/indexnow';

describe('llms.txt', () => {
  it('résume l’agence, ses tarifs et ses pages à partir des données publiées', async () => {
    const { app } = await makeApp();
    const res = await req(app, '/llms.txt');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const txt = await res.text();
    expect(txt).toMatch(/^# \S/);
    expect(txt).toContain('## Prestations et tarifs');
    expect(txt).toMatch(/Site Essentiel \(à partir de 690\s€ HT\)/);
    expect(txt).toContain('/creation-site-internet)');
    expect(txt).not.toMatch(/undefined|null/);
  });
});

describe('IndexNow', () => {
  it('sert le fichier de clé à la racine', async () => {
    const { app } = await makeApp();
    const res = await req(app, `/${INDEXNOW_KEY}.txt`);
    expect(res.status).toBe(200);
    expect((await res.text()).trim()).toBe(INDEXNOW_KEY);
  });

  it('retient les articles devenus visibles et les pages modifiées dans la fenêtre, pas les autres', async () => {
    const { db } = await makeApp();
    const now = new Date('2030-01-10T06:00:00.000Z');
    const since = new Date(now.getTime() - 25 * 3600 * 1000);
    const post = await db.get<{ slug: string }>("SELECT slug FROM posts WHERE status = 'published' ORDER BY slug LIMIT 1");
    const other = await db.get<{ slug: string }>("SELECT slug FROM posts WHERE status = 'published' ORDER BY slug DESC LIMIT 1");
    // Article programmé, rédigé longtemps avant, publié dans la fenêtre.
    await db.run("UPDATE posts SET published_at = '2030-01-10T05:00:00.000Z', updated_at = '2029-12-01 10:00:00' WHERE slug = ?", [post!.slug]);
    // Article encore à venir : ne doit pas partir.
    await db.run("UPDATE posts SET published_at = '2030-01-11T08:00:00.000Z' WHERE slug = ?", [other!.slug]);
    const product = await db.get<{ slug: string }>("SELECT slug FROM print_products WHERE status = 'published' ORDER BY slug LIMIT 1");
    if (product) await db.run("UPDATE print_products SET updated_at = '2030-01-09 20:00:00' WHERE slug = ?", [product.slug]);

    const paths = await recentPaths(db, since, now);
    expect(paths).toContain(`/blog/${post!.slug}`);
    expect(paths).not.toContain(`/blog/${other!.slug}`);
    if (product) expect(paths).toContain(`/impression/${product.slug}`);
    expect(paths).not.toContain('/');
  });

  it('envoie la clé, son emplacement et les adresses absolues', async () => {
    let sent: { url: string; body: Record<string, unknown> } | null = null;
    const fake = (async (url: string, init: RequestInit) => {
      sent = { url, body: JSON.parse(String(init.body)) };
      return new Response(null, { status: 202 });
    }) as unknown as typeof fetch;
    expect(await submitIndexNow('https://www.signeetseine.fr/', ['/blog/a', '/tarifs'], fake)).toBe(202);
    expect(sent!.url).toBe('https://api.indexnow.org/indexnow');
    expect(sent!.body).toEqual({
      host: 'www.signeetseine.fr',
      key: INDEXNOW_KEY,
      keyLocation: `https://www.signeetseine.fr/${INDEXNOW_KEY}.txt`,
      urlList: ['https://www.signeetseine.fr/blog/a', 'https://www.signeetseine.fr/tarifs'],
    });
    expect(await submitIndexNow('https://www.signeetseine.fr', [], fake)).toBeNull();
  });
});
