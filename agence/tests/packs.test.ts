import { describe, expect, it } from 'vitest';
import { makeApp, req } from './helpers';
import { formToken } from '../src/app/security';
import { PACKS } from '../src/web/packs';

const SECRET = 'test-secret-test-secret-test-secret-123';
const oldToken = () => formToken(SECRET, Date.now() - 10_000);
const jsonLd = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    const v = JSON.parse(m[1]!);
    return Array.isArray(v) ? v : [v];
  });
const mainWords = (html: string) =>
  (html.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

/** Tous les textes d'un pack (récursif). */
function texts(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => texts(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => texts(x, out));
  return out;
}

describe('packs Bien démarrer', () => {
  it('hub et pages packs : 200, un h1, données structurées complètes', async () => {
    const { app } = await makeApp();
    const hub = await req(app, '/packs');
    expect(hub.status).toBe(200);
    const hubHtml = await hub.text();
    for (const p of PACKS) expect(hubHtml).toContain(`href="/packs/${p.slug}"`);
    for (const p of PACKS) {
      const r = await req(app, `/packs/${p.slug}`);
      expect(r.status, p.slug).toBe(200);
      const html = await r.text();
      expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
      const ld = jsonLd(html);
      const service = ld.find((x) => x['@type'] === 'Service');
      expect(service.areaServed.length).toBeGreaterThan(3);
      expect(service.hasOfferCatalog.itemListElement.length).toBeGreaterThan(3);
      expect(ld.find((x) => x['@type'] === 'BreadcrumbList').itemListElement).toHaveLength(3);
      expect(ld.find((x) => x['@type'] === 'FAQPage').mainEntity.length).toBeGreaterThanOrEqual(5);
      expect(mainWords(html), p.slug).toBeGreaterThanOrEqual(1000);
      // Les trois niveaux et les CTA.
      expect(html).toContain('Recommandé pour ce métier');
      expect(html).toContain(`href="/devis-vitrophanie-signaletique?metier=${p.slug}"`);
      expect(html).toContain(`href="/contact?pack=${p.slug}#formulaire"`);
      expect(html).toContain('Concept de démonstration');
      expect(html.toLowerCase()).not.toContain('helloprint');
    }
    expect((await req(app, '/packs/inconnu')).status).toBe(404);
  });

  it('contenu propre à chaque métier : aucun texte long recopié entre packs', () => {
    const seen = new Map<string, string>();
    for (const p of PACKS) {
      for (const t of new Set(texts(p).filter((x) => x.length > 50))) {
        expect(seen.get(t), `« ${t.slice(0, 60)}… » répété dans ${p.slug} et ${seen.get(t)}`).toBeUndefined();
        seen.set(t, p.slug);
      }
    }
  });

  it('FAQ de 5 à 8 questions, sans marque d’outil tiers', () => {
    for (const p of PACKS) {
      expect(p.faq.length, p.slug).toBeGreaterThanOrEqual(5);
      expect(p.faq.length, p.slug).toBeLessThanOrEqual(8);
      expect(texts(p).join(' ')).not.toMatch(/thefork|planity|uber ?eats|deliveroo|treatwell|zenchef/i);
    }
  });

  it('contact : le pack est pré-sélectionné et enregistré avec la demande', async () => {
    const { app, db } = await makeApp();
    const html = await (await req(app, '/contact?pack=paysagiste')).text();
    expect(html).toMatch(/<option value="paysagiste" selected/);
    expect(html).toContain('pack Bien démarrer m’intéresse');
    const body = new URLSearchParams({ _ft: await oldToken(), name: 'Léa Test', email: 'lea@example.com', message: 'Je crée mon entreprise de paysage en janvier.', pack: 'paysagiste', privacy: '1' });
    const r = await req(app, '/contact', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(r.status).toBe(303);
    const contact = await db.get<{ need: string }>("SELECT need FROM contacts WHERE email = 'lea@example.com'");
    expect(contact?.need).toContain('Pack Bien démarrer — Paysagiste');
  });

  it('devis vitrine : métier et besoins typiques pré-remplis', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/devis-vitrophanie-signaletique?metier=restaurant')).text();
    expect(html).toContain('value="Restaurant"');
    expect(html).toMatch(/value="beachflag" checked/);
    expect(html).toMatch(/value="depoli" checked/);
  });

  it('navigation, accueil, pied de page, sitemap et maillage croisé', async () => {
    const { app } = await makeApp();
    const home = await (await req(app, '/')).text();
    for (const p of PACKS) expect(home.split(`href="/packs/${p.slug}"`).length - 1, p.slug).toBeGreaterThanOrEqual(3); // menu, accueil, pied de page
    const sitemap = await (await req(app, '/sitemap.xml')).text();
    for (const p of PACKS) expect(sitemap).toContain(`/packs/${p.slug}</loc>`);
    // Prestation → pack et pack → prestation.
    expect(await (await req(app, '/creation-site-internet-paysagiste')).text()).toContain('href="/packs/paysagiste"');
    expect(await (await req(app, '/identite-visuelle-logo')).text()).toContain('href="/packs/coiffeur"');
    expect(await (await req(app, '/packs/paysagiste')).text()).toContain('href="/creation-site-internet-paysagiste"');
  });
});

describe('mise à jour du 21/10 : prix des packs, déplacements, fiche Google', () => {
  it('prix « à partir de » et quantités affichés, options sans prix, plus de [À COMPLÉTER] sur les packs', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/packs/restaurant')).text();
    expect(html).toContain('1 890 €');
    expect(html).toContain('500 exemplaires');
    expect(html).toContain('5 exemplaires');
    expect(html).toContain('certaines peuvent être offertes');
    expect(html).not.toContain('option-price');
    for (const p of PACKS) expect(await (await req(app, `/packs/${p.slug}`)).text(), p.slug).not.toContain('À COMPLÉTER');
    const offer = jsonLd(html).find((x) => x['@type'] === 'Service').hasOfferCatalog.itemListElement[0];
    expect(offer.priceSpecification.minPrice).toBe('1890.00');
  });

  it('fiche Google dans sameAs, le pied de page et la page contact', async () => {
    const { app } = await makeApp();
    const home = await (await req(app, '/')).text();
    const biz = jsonLd(home).find((x) => x['@type'] === 'ProfessionalService');
    expect(biz.sameAs).toContain('https://share.google/Kuoatbjm9GEr1Pvi2');
    expect(home).toContain('Notre fiche Google et vos avis');
    expect(await (await req(app, '/contact')).text()).toContain('laisser un avis');
  });

  it('migration 4 sur la base en ligne : déplacements et fiche Google, sans écraser une saisie', async () => {
    const { db } = await makeApp();
    const { migrate } = await import('../src/db/migrations');
    await db.run("UPDATE local_pages SET body = 'Conditions de déplacement à Bolbec : [À COMPLÉTER : confirmer l’absence de frais de déplacement pour Bolbec].' WHERE slug = 'bolbec'");
    await db.run("UPDATE settings SET value = json_set(value, '$.googleBusinessUrl', '') WHERE key = 'site'");
    await db.run("UPDATE local_pages SET body = 'Texte personnalisé' WHERE slug = 'lillebonne'");
    await db.run('DELETE FROM schema_migrations WHERE version = 4');
    expect(await migrate(db)).toEqual([4]);
    expect((await db.get<{ body: string }>("SELECT body FROM local_pages WHERE slug = 'bolbec'"))!.body).toContain('Bolbec est voisine');
    expect((await db.get<{ body: string }>("SELECT body FROM local_pages WHERE slug = 'lillebonne'"))!.body).toBe('Texte personnalisé');
    const s = await db.get<{ v: string }>("SELECT json_extract(value, '$.googleBusinessUrl') AS v FROM settings WHERE key = 'site'");
    expect(s!.v).toBe('https://share.google/Kuoatbjm9GEr1Pvi2');
  });
});
