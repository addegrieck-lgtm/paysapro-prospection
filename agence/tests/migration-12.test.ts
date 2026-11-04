import { describe, expect, it } from 'vitest';
import { makeApp } from './helpers';
import { migrate } from '../src/db/migrations';
import { POSTS_V5 } from '../src/db/posts-v5';

describe('migration 12 : titres des pages villes et des articles programmés', () => {
  it('met à jour les pages restées d’origine, conserve celles modifiées dans l’administration', async () => {
    const { db } = await makeApp();
    // État d'avant la migration 12 (titres d'origine, section Fécamp absente), sauf Yvetot modifiée à la main.
    await db.run("UPDATE local_pages SET title = 'Agence web et communication à Bolbec' WHERE slug = 'bolbec'");
    await db.run("UPDATE local_pages SET title = 'Agence web et print à Fécamp' WHERE slug = 'fecamp'");
    const fecamp = (await db.get<{ body: string }>("SELECT body FROM local_pages WHERE slug = 'fecamp'"))!.body;
    const start = fecamp.indexOf('## Création de site internet à Fécamp');
    const end = fecamp.indexOf('## Restaurants, hôtels');
    await db.run('UPDATE local_pages SET body = ? WHERE slug = ?', [fecamp.slice(0, start) + fecamp.slice(end), 'fecamp']);
    await db.run("UPDATE local_pages SET title = 'Mon titre Yvetot' WHERE slug = 'yvetot'");
    await db.run("UPDATE posts SET meta_title = '' WHERE slug = 'communication-fetes-fin-annee-commercants'");
    await db.run("UPDATE posts SET meta_title = 'Titre saisi' WHERE slug = 'flyer-ou-depliant-que-choisir'");
    await db.run('DELETE FROM schema_migrations WHERE version = 12');

    expect(await migrate(db)).toEqual([12]);
    const rows = await db.all<{ slug: string; title: string; body: string }>('SELECT slug, title, body FROM local_pages');
    const by = (s: string) => rows.find((r) => r.slug === s)!;
    expect(by('bolbec').title).toBe('Agence web, création de site et référencement à Bolbec');
    expect(by('fecamp').title).toBe('Création de site internet et agence web à Fécamp');
    expect(by('fecamp').body.split('## Création de site internet à Fécamp').length).toBe(2);
    expect(by('fecamp').body.indexOf('## Création de site internet')).toBeLessThan(by('fecamp').body.indexOf('## Restaurants'));
    expect(by('yvetot').title).toBe('Mon titre Yvetot');
    const posts = await db.all<{ slug: string; meta_title: string }>('SELECT slug, meta_title FROM posts');
    expect(posts.find((p) => p.slug === 'communication-fetes-fin-annee-commercants')!.meta_title).toBe('Communication des fêtes pour commerçants');
    expect(posts.find((p) => p.slug === 'flyer-ou-depliant-que-choisir')!.meta_title).toBe('Titre saisi');

    // Rejouer la migration ne duplique pas la section.
    await db.run('DELETE FROM schema_migrations WHERE version = 12');
    await migrate(db);
    const again = (await db.get<{ body: string }>("SELECT body FROM local_pages WHERE slug = 'fecamp'"))!.body;
    expect(again.split('## Création de site internet à Fécamp').length).toBe(2);
  });

  it('chaque article programmé a un titre Google de 60 caractères au plus', () => {
    for (const p of POSTS_V5) expect((p.meta_title || p.title).length, p.slug).toBeLessThanOrEqual(60);
  });
});
