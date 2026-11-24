import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeApp, req } from './helpers';
import { migrate } from '../src/db/migrations';
import { POSTS_V14 } from '../src/db/posts-v14';
import { POSTS_V5 } from '../src/db/posts-v5';
import { wordCount } from '../src/domain/text';

describe('migration 14 : articles de fin d’année', () => {
  afterEach(() => vi.useRealTimers());

  it('slugs nouveaux, 800 mots ou plus, titres Google ≤ 60, descriptions ≤ 160, sans tableau', () => {
    const old = new Set(POSTS_V5.map((p) => p.slug));
    for (const p of POSTS_V14) {
      expect(old.has(p.slug), p.slug).toBe(false);
      expect(wordCount(p.body), p.slug).toBeGreaterThanOrEqual(800);
      expect((p.meta_title || p.title).length, p.slug).toBeLessThanOrEqual(60);
      expect(p.meta_description.length, p.slug).toBeLessThanOrEqual(160);
      expect(p.body, p.slug).not.toMatch(/^\|/m);
    }
  });

  it('invisibles avant leur date, publiés ensuite avec des liens internes valides', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-25T12:00:00.000Z'));
    let { app } = await makeApp();
    for (const p of POSTS_V14) expect((await req(app, `/blog/${p.slug}`)).status, p.slug).toBe(404);

    vi.setSystemTime(new Date('2026-12-11T12:00:00.000Z'));
    ({ app } = await makeApp());
    const sitemap = await (await req(app, '/sitemap.xml')).text();
    for (const p of POSTS_V14) {
      const html = await (await req(app, `/blog/${p.slug}`)).text();
      expect((html.match(/<h1[\s>]/g) ?? []).length, p.slug).toBe(1);
      expect(sitemap).toContain(`/blog/${p.slug}<`);
      for (const m of p.body.matchAll(/\]\((\/[^)]*)\)/g)) expect((await req(app, m[1]!)).status, m[1]).toBe(200);
    }
  });

  it('n’écrase pas un article modifié dans l’administration', async () => {
    const { db } = await makeApp();
    await db.run("UPDATE posts SET title = 'Titre modifié' WHERE slug = ?", [POSTS_V14[0]!.slug]);
    await db.run('DELETE FROM schema_migrations WHERE version = 14');
    expect(await migrate(db)).toEqual([14]);
    expect((await db.get<{ title: string }>('SELECT title FROM posts WHERE slug = ?', [POSTS_V14[0]!.slug]))!.title).toBe('Titre modifié');
  });
});
