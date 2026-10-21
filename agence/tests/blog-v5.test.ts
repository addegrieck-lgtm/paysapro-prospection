import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeApp, req } from './helpers';
import { migrate } from '../src/db/migrations';
import { POSTS_V5 } from '../src/db/posts-v5';
import { wordCount } from '../src/domain/text';

const AFTER_ALL = new Date('2027-02-01T12:00:00.000Z');

describe('migration 5 : articles de blog programmés', () => {
  afterEach(() => vi.useRealTimers());

  it('12 articles, une semaine d’écart, slugs uniques, 600 mots ou plus', () => {
    expect(POSTS_V5).toHaveLength(12);
    expect(new Set(POSTS_V5.map((p) => p.slug)).size).toBe(12);
    const dates = POSTS_V5.map((p) => Date.parse(p.published_at));
    dates.slice(1).forEach((d, i) => expect(d - dates[i]!).toBe(7 * 24 * 3600 * 1000));
    for (const p of POSTS_V5) {
      expect(wordCount(p.body), p.slug).toBeGreaterThanOrEqual(600);
      expect(p.meta_description.length, p.slug).toBeLessThanOrEqual(160);
      expect(p.body, p.slug).not.toMatch(/^\|/m); // pas de tableau : le Markdown du site ne les gère pas
    }
  });

  it('un article à venir reste invisible (page, liste, sitemap)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-26T12:00:00.000Z'));
    const { app } = await makeApp();
    const first = POSTS_V5[0]!;
    expect((await req(app, `/blog/${first.slug}`)).status).toBe(404);
    expect(await (await req(app, '/blog')).text()).not.toContain(first.slug);
    expect(await (await req(app, '/sitemap.xml')).text()).not.toContain(first.slug);
  });

  it('une fois la date passée : article publié, liens internes valides', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AFTER_ALL);
    const { app } = await makeApp();
    const links = new Set<string>();
    for (const p of POSTS_V5) {
      const r = await req(app, `/blog/${p.slug}`);
      expect(r.status, p.slug).toBe(200);
      const html = await r.text();
      expect((html.match(/<h1[\s>]/g) ?? []).length, p.slug).toBe(1);
      for (const m of p.body.matchAll(/\]\((\/[^)]*)\)/g)) links.add(m[1]!);
    }
    expect(links.size).toBeGreaterThan(20);
    for (const href of links) expect((await req(app, href)).status, href).toBe(200);
    expect(await (await req(app, '/sitemap.xml')).text()).toContain(POSTS_V5[11]!.slug);
  });

  it('base déjà en production : ajoute les articles sans écraser une modification', async () => {
    const { db } = await makeApp();
    await db.run('DELETE FROM schema_migrations WHERE version = 5');
    await db.run("UPDATE posts SET title = 'Titre modifié' WHERE slug = ?", [POSTS_V5[0]!.slug]);
    await db.run('DELETE FROM posts WHERE slug = ?', [POSTS_V5[1]!.slug]);
    expect(await migrate(db)).toEqual([5]);
    const rows = await db.all<{ slug: string; title: string }>('SELECT slug, title FROM posts');
    expect(rows.find((r) => r.slug === POSTS_V5[0]!.slug)?.title).toBe('Titre modifié');
    expect(rows.some((r) => r.slug === POSTS_V5[1]!.slug)).toBe(true);
    expect(rows.length).toBe(15);
  });
});
