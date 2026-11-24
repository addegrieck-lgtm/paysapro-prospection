import { describe, expect, it } from 'vitest';
import { makeApp } from './helpers';
import { migrate } from '../src/db/migrations';
import { LOCAL_SECTIONS_V13, LOCAL_TITLES_V13 } from '../src/db/local-pages-v13';

const bodyOf = async (db: Awaited<ReturnType<typeof makeApp>>['db'], slug: string) =>
  (await db.get<{ body: string }>('SELECT body FROM local_pages WHERE slug = ?', [slug]))!.body;

describe('migration 13 : pages villes Bolbec, Le Havre, Lillebonne, Saint-Romain', () => {
  it('base neuve : titres, descriptions et sections présents une seule fois, avant leur ancre', async () => {
    const { db } = await makeApp();
    for (const t of LOCAL_TITLES_V13) {
      const row = (await db.get<{ title: string; meta_description: string }>('SELECT title, meta_description FROM local_pages WHERE slug = ?', [t.slug]))!;
      expect(row.title).toBe(t.title);
      expect(row.meta_description).toBe(t.meta);
    }
    for (const x of LOCAL_SECTIONS_V13) {
      const body = await bodyOf(db, x.slug);
      expect(body.split(x.heading).length, x.heading).toBe(2);
      expect(body.indexOf(x.heading)).toBeLessThan(body.indexOf(x.anchor));
    }
  });

  it('conserve un titre modifié dans l’administration et ne duplique rien si rejouée', async () => {
    const { db } = await makeApp();
    await db.run("UPDATE local_pages SET title = 'Agence web et print au Havre' WHERE slug = 'le-havre'");
    await db.run("UPDATE local_pages SET title = 'Mon titre Lillebonne' WHERE slug = 'lillebonne'");
    await db.run('DELETE FROM schema_migrations WHERE version = 13');
    expect(await migrate(db)).toEqual([13]);
    const title = async (slug: string) => (await db.get<{ title: string }>('SELECT title FROM local_pages WHERE slug = ?', [slug]))!.title;
    expect(await title('le-havre')).toBe('Création de site internet et agence web au Havre');
    expect(await title('lillebonne')).toBe('Mon titre Lillebonne');
    for (const x of LOCAL_SECTIONS_V13) expect((await bodyOf(db, x.slug)).split(x.heading).length, x.heading).toBe(2);
  });

  it('titres ≤ 60 caractères et descriptions ≤ 160', () => {
    for (const t of LOCAL_TITLES_V13) {
      expect(t.title.length, t.slug).toBeLessThanOrEqual(60);
      expect(t.meta.length, t.slug).toBeLessThanOrEqual(160);
    }
  });
});
