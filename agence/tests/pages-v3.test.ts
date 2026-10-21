import { describe, expect, it } from 'vitest';
import { makeApp, req } from './helpers';
import { formToken } from '../src/app/security';
import { LANDING_PAGES } from '../src/web/landing';
import { migrate } from '../src/db/migrations';

const SECRET = 'test-secret-test-secret-test-secret-123';
const oldToken = () => formToken(SECRET, Date.now() - 10_000);
const SEO_PAGES = ['/creation-site-internet-artisan', '/creation-site-internet-paysagiste', '/referencement-local-artisan', '/vitrophanie-vitrine-commerce', '/flyers-depliants', '/cartes-de-visite'];

/** Nombre de mots du contenu principal (hors en-tête et pied de page). */
function mainWords(html: string): number {
  const main = html.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? '';
  return main
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const v = JSON.parse(m[1]!);
    return Array.isArray(v) ? v : [v];
  });

describe('phases 3 à 5 : nouvelles pages', () => {
  it('pages thématiques : 200, un seul h1, Service + FAQPage, sans nom de fournisseur', async () => {
    const { app } = await makeApp();
    for (const def of LANDING_PAGES) {
      const r = await req(app, def.path);
      expect(r.status, def.path).toBe(200);
      const html = await r.text();
      expect((html.match(/<h1[\s>]/g) ?? []).length, def.path).toBe(1);
      const ld = jsonLd(html);
      expect(ld.some((x) => x['@type'] === 'Service'), def.path).toBe(true);
      expect(ld.some((x) => x['@type'] === 'FAQPage'), def.path).toBe(true);
      expect(html.toLowerCase()).not.toContain('helloprint');
    }
  });

  it('pages SEO : 900 mots ou plus de contenu principal', async () => {
    const { app } = await makeApp();
    for (const path of SEO_PAGES) {
      const n = mainWords(await (await req(app, path)).text());
      expect(n, `${path} : ${n} mots`).toBeGreaterThanOrEqual(900);
    }
  });

  it('pages villes publiées, distinctes, reliées depuis la zone d’intervention', async () => {
    const { app } = await makeApp();
    const bodies: string[] = [];
    for (const slug of ['le-havre', 'bolbec', 'lillebonne']) {
      const r = await req(app, `/agence-web/${slug}`);
      expect(r.status, slug).toBe(200);
      const html = await r.text();
      expect(mainWords(html), slug).toBeGreaterThanOrEqual(400);
      bodies.push(html);
    }
    expect(bodies[0]).toContain('UNESCO');
    expect(bodies[2]).toContain('Juliobona');
    const zone = await (await req(app, '/zone-intervention')).text();
    for (const slug of ['le-havre', 'bolbec', 'lillebonne']) expect(zone).toContain(`href="/agence-web/${slug}"`);
    const sitemap = await (await req(app, '/sitemap.xml')).text();
    for (const p of ['/vitrophanie-signaletique', '/zone-intervention', '/agence-web/bolbec', '/realisations/fournil-du-caux']) expect(sitemap).toContain(`${p}</loc>`);
  });

  it('tarifs : offre signalétique et pack ouverture sur devis', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/tarifs')).text();
    expect(html).toContain('Vitrophanie &amp; signalétique');
    expect(html).toContain('Pack ouverture de commerce');
  });

  it('devis signalétique : photos jointes, demande enregistrée', async () => {
    const { app, db } = await makeApp();
    const fd = new FormData();
    for (const [k, v] of Object.entries({
      _ft: await oldToken(), activity: 'Boulangerie', city: 'Bolbec', dimensions: '2,40 × 1,80 m', design: 'logo', pose: 'partenaire',
      description: 'Habillage complet de la vitrine pour l’ouverture.', name: 'Camille Test', email: 'vitrine@example.com', privacy: '1',
    })) fd.append(k, v);
    fd.append('needs', 'vitrophanie');
    fd.append('needs', 'horaires');
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    fd.append('files', new File([png], 'vitrine.png', { type: 'image/png' }));
    const r = await req(app, '/devis-vitrophanie-signaletique', { method: 'POST', body: fd });
    expect(r.status).toBe(303);
    const row = await db.get<{ kind: string; files: string; answers: string }>('SELECT kind, files, answers FROM quote_requests');
    expect(row?.kind).toBe('signaletique');
    expect(JSON.parse(row!.files)).toHaveLength(1);
    expect(JSON.parse(row!.answers).description).toContain('Lieu de pose : Bolbec');
  });

  it('devis signalétique : refuse une demande sans besoin coché', async () => {
    const { app, db } = await makeApp();
    const fd = new FormData();
    for (const [k, v] of Object.entries({ _ft: await oldToken(), activity: 'Garage', city: 'Lillebonne', description: 'Marquage de deux utilitaires.', name: 'Test', email: 't@example.com', privacy: '1' })) fd.append(k, v);
    const r = await req(app, '/devis-vitrophanie-signaletique', { method: 'POST', body: fd });
    expect(r.status).toBe(422);
    expect(await r.text()).toContain('Cochez au moins un besoin');
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_requests'))!.n).toBe(0);
  });

  it('réalisations : fiche projet, avant / après, prestations liées, aucun témoignage pour un concept', async () => {
    const { app, db } = await makeApp();
    const html = await (await req(app, '/realisations/fournil-du-caux')).text();
    expect(html).toContain('data-ba');
    expect(html).toContain('Boulangerie (ouverture de commerce)');
    expect(html).toContain('href="/vitrophanie-vitrine-commerce"');
    expect(html).toContain('Concept de démonstration');
    // Un concept n'affiche jamais de témoignage, même saisi directement en base.
    await db.run("UPDATE portfolio_items SET testimonial = 'Super !', testimonial_authorized = 1 WHERE slug = 'fournil-du-caux'");
    expect(await (await req(app, '/realisations/fournil-du-caux')).text()).not.toContain('Super !');
    // Un client réel avec autorisation écrite : témoignage affiché.
    await db.run("UPDATE portfolio_items SET is_concept = 0, testimonial = 'Travail soigné.', testimonial_author = 'A. B.', testimonial_authorized = 1 WHERE slug = 'les-pages-lentes'");
    const real = await (await req(app, '/realisations/les-pages-lentes')).text();
    expect(real).toContain('Travail soigné.');
    expect(real).toContain('Client réel');
    await db.run("UPDATE portfolio_items SET testimonial_authorized = 0 WHERE slug = 'les-pages-lentes'");
    expect(await (await req(app, '/realisations/les-pages-lentes')).text()).not.toContain('Travail soigné.');
  });

  it('migration 3 sur une base déjà en production (v2 et données existantes)', async () => {
    const { app, db } = await makeApp();
    // Retour à l'état « v2 » : colonnes, lignes et version de la migration 3 retirées.
    for (const col of ['client_type', 'need', 'services', 'objectives', 'before_label', 'after_label', 'testimonial', 'testimonial_author', 'testimonial_authorized']) {
      await db.run(`ALTER TABLE portfolio_items DROP COLUMN ${col}`);
    }
    await db.run("DELETE FROM portfolio_items WHERE slug IN ('fournil-du-caux', 'jardins-de-la-valmont')");
    await db.run("DELETE FROM services WHERE slug IN ('vitrophanie-signaletique', 'pack-ouverture-commerce')");
    await db.run('DELETE FROM local_pages');
    await db.run('DELETE FROM schema_migrations WHERE version = 3');
    expect(await migrate(db)).toEqual([3]);
    const item = await db.get<{ client_type: string }>("SELECT client_type FROM portfolio_items WHERE slug = 'atelier-chene-et-fil'");
    expect(item?.client_type).toBe('Artisan menuisier-ébéniste');
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM local_pages WHERE status = 'published'"))!.n).toBe(3);
    expect((await req(app, '/realisations/jardins-de-la-valmont')).status).toBe(200);
    expect(await migrate(db)).toEqual([]);
  });

  it('administration : refuse un témoignage sur un concept ou sans autorisation', async () => {
    const { app, db } = await makeApp();
    const { adminSession } = await import('./helpers');
    const s = await adminSession(app, db);
    const { id } = (await db.get<{ id: number }>("SELECT id FROM portfolio_items WHERE slug = 'studio-meche'"))!;
    const form = await (await s.get(`/admin/contenus/realisations/${id}`)).text();
    expect(form).toContain('name="testimonial_authorized"');
    const base = { title: 'Studio Mèche', slug: 'studio-meche', category: 'Impression', status: 'published', visual: 'print-salon', sort_order: '30' };
    const concept = await s.post(`/admin/contenus/realisations/${id}`, { ...base, is_concept: '1', testimonial: 'Génial !', testimonial_authorized: '1' });
    expect(concept.status).toBe(422);
    const noAuth = await s.post(`/admin/contenus/realisations/${id}`, { ...base, testimonial: 'Génial !' });
    expect(noAuth.status).toBe(422);
    const ok = await s.post(`/admin/contenus/realisations/${id}`, { ...base, testimonial: 'Génial !', testimonial_author: 'C. D.', testimonial_authorized: '1' });
    expect(ok.status).toBe(303);
  });
});
