import { describe, expect, it } from 'vitest';
import { makeApp, req } from './helpers';
import { migrate } from '../src/db/migrations';
import { LOCAL_PAGES_V11 } from '../src/db/local-pages-v11';
import { LOCAL_PAGES_V3 } from '../src/db/content-v3';
import { DEFAULT_SETTINGS } from '../src/domain/settings';
import { wordCount } from '../src/domain/text';

/** Part des suites de 5 mots de `a` que l'on retrouve dans `b` (détecte le copier-coller entre pages villes). */
function overlap(a: string, b: string): number {
  const grams = (t: string) => {
    const w = t.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    return new Set(w.slice(4).map((_, i) => w.slice(i, i + 5).join(' ')));
  };
  const ga = grams(a);
  const gb = grams(b);
  return [...ga].filter((g) => gb.has(g)).length / ga.size;
}

describe('migration 11 : pages Fécamp, Yvetot, Saint-Romain-de-Colbosc', () => {
  it('villes de la zone principale, contenus propres à chaque ville', () => {
    const all = [...LOCAL_PAGES_V3, ...LOCAL_PAGES_V11];
    for (const p of LOCAL_PAGES_V11) {
      expect(DEFAULT_SETTINGS.serviceAreasPrimary, p.city).toContain(p.city);
      expect(wordCount(p.body), p.slug).toBeGreaterThanOrEqual(450);
      expect(p.meta_description.length, p.slug).toBeLessThanOrEqual(160);
      for (const other of all.filter((o) => o.slug !== p.slug)) {
        expect(overlap(p.body, other.body), `${p.slug} ↔ ${other.slug}`).toBeLessThan(0.15);
      }
    }
  });

  it('publiées, reliées depuis la zone d’intervention, dans le sitemap, liens internes valides', async () => {
    const { app } = await makeApp();
    const zone = await (await req(app, '/zone-intervention')).text();
    const sitemap = await (await req(app, '/sitemap.xml')).text();
    const links = new Set<string>();
    for (const p of LOCAL_PAGES_V11) {
      const r = await req(app, `/agence-web/${p.slug}`);
      expect(r.status, p.slug).toBe(200);
      const html = await r.text();
      expect((html.match(/<h1[\s>]/g) ?? []).length, p.slug).toBe(1);
      expect(html).toContain(`<title>${p.title}`);
      expect(zone, p.slug).toContain(`href="/agence-web/${p.slug}"`);
      expect(sitemap, p.slug).toContain(`/agence-web/${p.slug}</loc>`);
      for (const m of p.body.matchAll(/\]\((\/[^)#]*)/g)) links.add(m[1]!);
    }
    for (const href of links) expect((await req(app, href)).status, href).toBe(200);
  });

  it('base déjà en production : ajoute les pages sans écraser une modification', async () => {
    const { db } = await makeApp();
    await db.run('DELETE FROM schema_migrations WHERE version = 11');
    await db.run("UPDATE local_pages SET title = 'Titre modifié' WHERE slug = 'fecamp'");
    await db.run("DELETE FROM local_pages WHERE slug = 'yvetot'");
    expect(await migrate(db)).toEqual([11]);
    const rows = await db.all<{ slug: string; title: string }>('SELECT slug, title FROM local_pages');
    expect(rows.find((r) => r.slug === 'fecamp')?.title).toBe('Titre modifié');
    expect(rows.some((r) => r.slug === 'yvetot')).toBe(true);
  });
});
