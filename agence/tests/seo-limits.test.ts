import { describe, expect, it } from 'vitest';
import { makeApp, req } from './helpers';
import { migrate } from '../src/db/migrations';

const dec = (s: string) => s.replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

describe('SEO : toutes les pages du sitemap', () => {
  it('titre ≤ 60 caractères, description 70–160, un seul h1, canonique absolue', async () => {
    const { app } = await makeApp();
    const sm = await (await req(app, '/sitemap.xml')).text();
    const urls = [...sm.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThan(50);
    const titles = new Set<string>();
    for (const u of urls) {
      const path = new URL(u).pathname;
      const html = await (await req(app, path)).text();
      const title = dec(html.match(/<title>([^<]+)<\/title>/)?.[1] ?? '');
      const desc = dec(html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? '');
      expect(title.length, `${path} : « ${title} »`).toBeLessThanOrEqual(60);
      expect(desc.length, `${path} : ${desc.length} car.`).toBeGreaterThanOrEqual(70);
      expect(desc.length, `${path} : ${desc.length} car.`).toBeLessThanOrEqual(160);
      expect((html.match(/<h1[\s>]/g) ?? []).length, path).toBe(1);
      expect(html, path).toContain(`<link rel="canonical" href="${u}"`);
      expect(titles.has(title), `titre dupliqué : ${title}`).toBe(false);
      titles.add(title);
    }
  });

  it('migration 7 : corrige les valeurs d’origine, conserve les saisies', async () => {
    const { db } = await makeApp();
    await db.run("UPDATE posts SET meta_title = '' WHERE slug IN ('visibilite-locale-par-ou-commencer', 'flyer-points-a-verifier-avant-impression')");
    await db.run("UPDATE posts SET meta_title = 'Mon titre' WHERE slug = 'site-vitrine-combien-de-pages'");
    await db.run("UPDATE local_pages SET meta_description = 'Création de site internet, logo, flyers, vitrophanie et signalétique à Lillebonne et Port-Jérôme-sur-Seine. Agence voisine, rendez-vous sur place, devis gratuit.' WHERE slug = 'lillebonne'");
    await db.run('DELETE FROM schema_migrations WHERE version = 7');
    expect(await migrate(db)).toEqual([7]);
    const t = await db.all<{ slug: string; meta_title: string }>('SELECT slug, meta_title FROM posts ORDER BY slug');
    expect(t.find((x) => x.slug === 'visibilite-locale-par-ou-commencer')!.meta_title).toBe('Visibilité locale : par où commencer ?');
    expect(t.find((x) => x.slug === 'site-vitrine-combien-de-pages')!.meta_title).toBe('Mon titre');
    expect((await db.get<{ m: string }>("SELECT meta_description AS m FROM local_pages WHERE slug = 'lillebonne'"))!.m.length).toBeLessThanOrEqual(160);
  });
});
