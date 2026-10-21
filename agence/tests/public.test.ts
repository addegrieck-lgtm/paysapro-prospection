import { describe, expect, it } from 'vitest';
import { makeApp, req, ORIGIN } from './helpers';
import { formToken } from '../src/app/security';
import { SERVICE_PAGES } from '../src/web/content';

const SECRET = 'test-secret-test-secret-test-secret-123';
const oldToken = () => formToken(SECRET, Date.now() - 10_000);

const PUBLIC_PATHS = [
  '/', '/tarifs', '/impression', '/configurateur', '/devis', '/realisations', '/etudes-de-cas', '/a-propos', '/contact', '/blog',
  '/mentions-legales', '/confidentialite', '/cookies', '/cgv', '/espace-client', '/plan-du-site', '/impression/flyers', '/impression/cartes-de-visite',
  '/impression/autocollants', '/realisations/atelier-chene-et-fil', '/realisations/les-pages-lentes', '/blog/flyer-points-a-verifier-avant-impression',
  ...SERVICE_PAGES.map((p) => p.path),
];

describe('pages publiques', () => {
  it('répondent toutes en 200 avec un titre, une description et une canonique uniques', async () => {
    const { app } = await makeApp();
    const titles = new Set<string>();
    const descs = new Set<string>();
    for (const p of PUBLIC_PATHS) {
      const r = await req(app, p);
      expect(r.status, p).toBe(200);
      const html = await r.text();
      const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
      const desc = html.match(/<meta name="description" content="([^"]+)"/)?.[1];
      expect(title, p).toBeTruthy();
      expect(desc, p).toBeTruthy();
      expect(titles.has(title!), `titre dupliqué : ${title}`).toBe(false);
      titles.add(title!);
      descs.add(desc!);
      expect(html).toContain('<link rel="canonical"');
      expect((html.match(/<h1[\s>]/g) ?? []).length, `un seul h1 : ${p}`).toBe(1);
      expect(html).toContain('lang="fr"');
    }
    expect(descs.size).toBe(PUBLIC_PATHS.length);
  });

  it('renvoie une 404 utile', async () => {
    const { app } = await makeApp();
    const r = await req(app, '/page-inexistante');
    expect(r.status).toBe(404);
    const html = await r.text();
    expect(html).toContain('noindex');
    expect(html).toContain('href="/devis"');
  });

  it('pose les en-têtes de sécurité', async () => {
    const { app } = await makeApp();
    const r = await req(app, '/');
    const csp = r.headers.get('content-security-policy')!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("frame-ancestors 'self'");
    expect(r.headers.get('x-content-type-options')).toBe('nosniff');
    expect(r.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
    const html = await r.text();
    // Aucun script exécutable en ligne (uniquement des données JSON-LD / JSON).
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/g)].map((m) => m[1]);
    for (const attrs of inline) expect(attrs).toMatch(/type="application\/(ld\+)?json"/);
  });

  it('sitemap, robots et données structurées', async () => {
    const { app } = await makeApp();
    const sm = await (await req(app, '/sitemap.xml')).text();
    expect(sm).toContain('<urlset');
    expect(sm).toContain('/creation-site-internet</loc>');
    expect(sm).toContain('/impression/flyers</loc>');
    expect(sm).not.toContain('/admin');
    const robots = await (await req(app, '/robots.txt')).text();
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Sitemap:');
    const home = await (await req(app, '/')).text();
    expect(home).toContain('"@type":"ProfessionalService"');
    expect(home).not.toContain('aggregateRating');
    expect(home).not.toContain('"streetAddress"'); // rue non renseignée : seule la commune est publiée
    const svc = await (await req(app, '/creation-site-internet')).text();
    expect(svc).toContain('"@type":"BreadcrumbList"');
  });

  it('signale les réalisations fictives comme concepts', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/realisations')).text();
    expect(html).toContain('Concept de démonstration');
    expect(html).toContain('fictives');
  });

  it('redirige les anciennes adresses configurées', async () => {
    const { app, db } = await makeApp();
    await db.run("INSERT INTO redirects (from_path, to_path, code, created_at, updated_at) VALUES ('/ancien-site', '/creation-site-internet', 301, '', '')");
    const r = await req(app, '/ancien-site');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('/creation-site-internet');
    const t = await req(app, '/tarifs/');
    expect(t.status).toBe(301);
  });
});

describe('impression : confidentialité des coûts', () => {
  async function withVerifiedVariant() {
    const ctx = await makeApp();
    const now = new Date().toISOString();
    await ctx.db.run(
      `UPDATE supplier_price_variants SET status = 'verifie', verified_at = ?, supplier_price_ht = 1777, supplier_shipping_ht = 333, sale_print_ht = 4900, sale_shipping_ht = 690,
       sale_validated_at = ?, cost_at_validation = 2110 WHERE quantity = 250 AND product_id = (SELECT id FROM print_products WHERE slug = 'cartes-de-visite')`,
      [now, now],
    );
    return ctx;
  }
  const config = { format: 'Classique 85 × 55 mm', paper: 'Couché mat', weight: '350 g', finish: 'Sans finition', printing: 'Recto-verso', extra: 'Coins carrés', delivery: 'Standard', quantity: 250 };

  it('l’API ne renvoie que des prix de vente', async () => {
    const { app } = await withVerifiedVariant();
    const r = await req(app, '/api/print/estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: 'cartes-de-visite', config, wantDesign: true }) });
    expect(r.status).toBe(200);
    const body = await r.text();
    const data = JSON.parse(body);
    expect(data.estimate.status).toBe('priced');
    expect(data.estimate.printHt).toBe(4900);
    expect(data.estimate.shippingHt).toBe(690);
    expect(data.estimate.design.priceHt).toBe(4900);
    expect(data.estimate.totalHt).toBe(4900 + 690 + 4900);
    expect(body).not.toContain('1777');
    expect(body).not.toContain('2110');
    expect(body).not.toMatch(/supplier|cost/i);
  });

  it('la page produit (HTML) ne contient aucun coût fournisseur', async () => {
    const { app } = await withVerifiedVariant();
    const qs = new URLSearchParams(Object.entries(config).map(([k, v]) => [k, String(v)])).toString();
    const html = await (await req(app, `/impression/cartes-de-visite?${qs}`)).text();
    expect(html).toContain('49,00');
    expect(html).not.toContain('17,77');
    expect(html).not.toContain('1777');
    expect(html).not.toMatch(/helloprint/i);
  });

  it('un prix observé mais non vérifié n’est jamais affiché', async () => {
    const { app } = await makeApp(); // variante importée au statut « à vérifier »
    const r = await req(app, '/api/print/estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: 'cartes-de-visite', config }) });
    const data = await r.json();
    expect(data.estimate.status).toBe('on_request');
    expect(data.estimate.totalHt).toBeNull();
    expect(JSON.stringify(data)).not.toContain('1829');
  });

  it('refuse une configuration inventée', async () => {
    const { app } = await makeApp();
    const r = await req(app, '/api/print/estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: 'cartes-de-visite', config: { ...config, weight: '999 g' } }) });
    expect(r.status).toBe(422);
  });

  it('refuse les requêtes d’une autre origine', async () => {
    const { app } = await makeApp();
    const r = await req(app, '/api/print/estimate', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://malveillant.example' }, body: '{}' });
    expect(r.status).toBe(403);
  });
});

function quoteForm(over: Record<string, string> = {}) {
  const fd = new FormData();
  const base: Record<string, string> = {
    type: 'impression', activity: 'Boulangerie', description: 'Flyers pour notre ouverture', product: 'flyers', want_design: '1',
    print_format: 'A5 (148 × 210 mm)', print_orientation: 'Portrait', print_paper: 'Couché brillant', print_weight: '135 g', print_printing: 'Recto-verso',
    print_delivery: 'Standard', print_quantity: '500', customer_type: 'pro', name: 'Camille Test', company: 'Boulangerie Test', email: 'camille@example.com',
    phone: '06 12 34 56 78', privacy: '1', ...over,
  };
  for (const [k, v] of Object.entries(base)) fd.append(k, v);
  return fd;
}

describe('formulaires', () => {
  it('demande de devis complète : contact CRM, commande, pièce jointe, e-mails', async () => {
    const { app, db } = await makeApp();
    await db.run("UPDATE settings SET value = json_set(value, '$.notifyEmail', 'agence@example.com') WHERE key = 'site'");
    const fd = quoteForm({ _ft: await oldToken() });
    fd.append('files', new File([new TextEncoder().encode('%PDF-1.4\n%test')], 'logo.pdf', { type: 'application/pdf' }));
    const r = await req(app, '/devis', { method: 'POST', body: fd });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/devis/merci');
    const contact = await db.get<{ id: number; status: string; source: string }>("SELECT * FROM contacts WHERE email = 'camille@example.com'");
    expect(contact?.status).toBe('nouveau');
    expect(contact?.source).toBe('site_devis');
    const request = await db.get<{ files: string; print_config: string; estimate: string }>('SELECT * FROM quote_requests WHERE contact_id = ?', [contact!.id]);
    expect(JSON.parse(request!.files)).toHaveLength(1);
    expect(JSON.parse(request!.print_config).quantity).toBe(500);
    const order = await db.get<{ status: string; number: string }>('SELECT * FROM print_orders WHERE contact_id = ?', [contact!.id]);
    // Le prix observé n'est pas vérifié : la commande attend la vérification du prix fournisseur.
    expect(order?.status).toBe('prix_a_verifier');
    expect(order?.number).toMatch(/^CMD-\d{4}-0001$/);
    const mails = await db.all<{ to_addr: string; kind: string }>('SELECT to_addr, kind FROM email_log ORDER BY id');
    expect(mails).toEqual([
      { to_addr: 'camille@example.com', kind: 'confirmation' },
      { to_addr: 'agence@example.com', kind: 'notification' },
    ]);
  });

  it('refuse un fichier dont le contenu n’est pas autorisé', async () => {
    const { app, db } = await makeApp();
    const fd = quoteForm({ _ft: await oldToken() });
    fd.append('files', new File([new TextEncoder().encode('MZ\x90\x00 programme')], 'photo.jpg', { type: 'image/jpeg' }));
    const r = await req(app, '/devis', { method: 'POST', body: fd });
    expect(r.status).toBe(422);
    expect(await r.text()).toContain('format non accepté');
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_requests'))!.n).toBe(0);
  });

  it('valide côté serveur et réaffiche les saisies', async () => {
    const { app } = await makeApp();
    const r = await req(app, '/devis', { method: 'POST', body: quoteForm({ _ft: await oldToken(), email: 'pas-un-email', privacy: '' }) });
    expect(r.status).toBe(422);
    const html = await r.text();
    expect(html).toContain('Adresse e-mail invalide');
    expect(html).toContain('Boulangerie Test');
  });

  it('ignore silencieusement les robots (pot de miel, envoi trop rapide)', async () => {
    const { app, db } = await makeApp();
    const r1 = await req(app, '/devis', { method: 'POST', body: quoteForm({ _ft: await oldToken(), website_url: 'http://spam' }) });
    expect(r1.status).toBe(303);
    const r2 = await req(app, '/devis', { method: 'POST', body: quoteForm({ _ft: await formToken(SECRET) }) });
    expect(r2.status).toBe(303);
    const r3 = await req(app, '/devis', { method: 'POST', body: quoteForm({ _ft: 'falsifie.0000' }) });
    expect(r3.status).toBe(303);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_requests'))!.n).toBe(0);
  });

  it('limite le débit des envois', async () => {
    const { app } = await makeApp();
    const send = async () => {
      const body = new URLSearchParams({ _ft: await oldToken(), name: 'Test Débit', email: 'debit@example.com', message: 'Bonjour, une question.', privacy: '1' });
      return req(app, '/contact', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    };
    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(303);
    expect((await send()).status).toBe(429);
  });

  it('formulaire de contact : crée le contact et l’historique', async () => {
    const { app, db } = await makeApp();
    const body = new URLSearchParams({ _ft: await oldToken(), name: 'Léa Contact', email: 'lea@example.com', message: 'Je voudrais refaire mon site.', privacy: '1' });
    const r = await req(app, '/contact', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    expect(r.status).toBe(303);
    const c = await db.get<{ id: number; source: string; consent_marketing: number }>("SELECT * FROM contacts WHERE email = 'lea@example.com'");
    expect(c?.source).toBe('site_contact');
    expect(c?.consent_marketing).toBe(0);
    const ev = await db.get<{ body: string }>('SELECT body FROM contact_events WHERE contact_id = ?', [c!.id]);
    expect(ev?.body).toContain('refaire mon site');
  });

  it('échappe le HTML saisi par les visiteurs', async () => {
    const { app } = await makeApp();
    const r = await req(app, '/devis', { method: 'POST', body: quoteForm({ _ft: await oldToken(), company: '<script>alert(1)</script>', email: 'x' }) });
    const html = await r.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

export { ORIGIN };

describe('SEO technique et local (phase 2)', () => {
  const jsonLd = (html: string) =>
    [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
      const v = JSON.parse(m[1]!);
      return Array.isArray(v) ? v : [v];
    });

  it('canonique et og:url absolues, image de partage présente', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/creation-site-internet')).text();
    expect(html).toContain(`<link rel="canonical" href="${ORIGIN}/creation-site-internet"`);
    expect(html).toContain(`<meta property="og:url" content="${ORIGIN}/creation-site-internet"`);
    expect(html).toContain(`${ORIGIN}/assets/img/og-default.png`);
  });

  it('accueil : ProfessionalService avec localité, géolocalisation, zone desservie et horaires', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/')).text();
    const biz = jsonLd(html).find((x) => x['@type'] === 'ProfessionalService');
    expect(biz).toBeTruthy();
    expect(biz.name).toBe('Signe & Seine');
    expect(biz.address.addressLocality).toBe('Gruchet-le-Valasse');
    expect(biz.address.postalCode).toBe('76210');
    expect(biz.address.streetAddress).toBeUndefined();
    expect(biz.geo.latitude).toBeCloseTo(49.5473);
    expect(biz.telephone).toBe('+33647414224');
    expect(biz.areaServed.map((a: { name: string }) => a.name)).toEqual(expect.arrayContaining(['Bolbec', 'Lillebonne', 'Le Havre', 'France']));
    expect(biz.openingHoursSpecification[0].opens).toBe('08:30');
    expect(biz).not.toHaveProperty('aggregateRating');
    expect(html).toContain('href="tel:+33647414224"');
  });

  it('pages de prestation : Service relié à l’entreprise, fil d’Ariane absolu', async () => {
    const { app } = await makeApp();
    const items = jsonLd(await (await req(app, '/referencement-seo')).text());
    const service = items.find((x) => x['@type'] === 'Service');
    expect(service.provider['@id']).toBe(`${ORIGIN}/#entreprise`);
    const crumbs = items.find((x) => x['@type'] === 'BreadcrumbList');
    for (const el of crumbs.itemListElement) expect(el.item).toMatch(/^http:\/\/localhost\//);
  });

  it('fiches produit d’impression : FAQPage et un seul bouton de configuration', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/impression/flyers')).text();
    expect(jsonLd(html).some((x) => x['@type'] === 'FAQPage')).toBe(true);
  });

  it('page contact : localité, carte chargée au clic uniquement', async () => {
    const { app } = await makeApp();
    const html = await (await req(app, '/contact')).text();
    expect(html).toContain('Gruchet-le-Valasse (76210)');
    expect(html).toContain('data-map-load');
    expect(html).not.toMatch(/<iframe/);
  });

  it('les anciennes URL d’études de cas redirigent en 301 vers la réalisation', async () => {
    const { app } = await makeApp();
    const r = await req(app, '/etudes-de-cas/les-pages-lentes');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('/realisations/les-pages-lentes');
    const sitemap = await (await req(app, '/sitemap.xml')).text();
    expect(sitemap).not.toContain('/etudes-de-cas/les-pages-lentes');
    expect(sitemap).toContain('/realisations/les-pages-lentes');
  });

  it('redirige HTTP vers HTTPS en production', async () => {
    const { app } = await makeApp({
      config: { appSecret: SECRET, production: true, setupToken: 'x', forceHttps: true },
    });
    const r = await app.request('http://exemple.fr/tarifs?x=1');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://exemple.fr/tarifs?x=1');
  });

  it('redirige le domaine sans www vers le domaine principal et l’utilise comme adresse du site', async () => {
    const { app } = await makeApp({
      config: { appSecret: SECRET, production: true, setupToken: 'x', forceHttps: true, canonicalHost: 'www.exemple.fr' },
    });
    const r = await app.request('https://exemple.fr/tarifs?x=1');
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('https://www.exemple.fr/tarifs?x=1');
    const page = await app.request('https://agence-web.compte.workers.dev/tarifs');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('<link rel="canonical" href="https://www.exemple.fr/tarifs"');
  });
});
