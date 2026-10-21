import { describe, expect, it } from 'vitest';
import { adminSession, makeApp, req } from './helpers';
import { formToken } from '../src/app/security';

const SECRET = 'test-secret-test-secret-test-secret-123';

const ADMIN_PAGES = [
  '/admin', '/admin/crm', '/admin/crm/nouveau', '/admin/demandes', '/admin/devis', '/admin/devis/nouveau', '/admin/commandes', '/admin/commandes/nouvelle',
  '/admin/projets', '/admin/projets/nouveau', '/admin/factures', '/admin/factures/nouvelle', '/admin/abonnements', '/admin/prestations', '/admin/prestations/nouvelle',
  '/admin/impression/produits', '/admin/impression/produits/nouveau', '/admin/impression/tarifs', '/admin/impression/tarifs/nouveau', '/admin/marges',
  '/admin/contenus/realisations', '/admin/contenus/articles', '/admin/contenus/faq', '/admin/contenus/pages-locales', '/admin/contenus/redirections',
  '/admin/contenus/realisations/nouveau', '/admin/parametres', '/admin/emails', '/admin/compte', '/admin/prestations/1', '/admin/impression/produits/1',
  '/admin/impression/tarifs/1', '/admin/contenus/articles/1',
];

describe('autorisations d’administration', () => {
  it('toutes les pages exigent une session', async () => {
    const { app } = await makeApp();
    for (const p of ADMIN_PAGES) {
      const r = await req(app, p);
      expect(r.status, p).toBe(302);
      expect(r.headers.get('location')).toContain('/admin/connexion');
    }
    const post = await req(app, '/admin/parametres', { method: 'POST', body: new URLSearchParams({ agencyName: 'Pirate' }) });
    expect(post.status).toBe(401);
    expect((await req(app, '/admin/crm/export.csv')).status).toBe(302);
  });

  it('refuse un mauvais mot de passe et limite les tentatives', async () => {
    const { app, db } = await makeApp();
    await adminSession(app, db);
    const attempt = () =>
      req(app, '/admin/connexion', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'admin@example.com', password: 'faux-mot-de-passe-1' }) });
    expect((await attempt()).status).toBe(401);
    for (let i = 0; i < 4; i++) await attempt();
    expect((await attempt()).status).toBe(429);
  });

  it('pose un cookie de session HttpOnly et SameSite=Strict', async () => {
    const { app, db } = await makeApp();
    await adminSession(app, db);
    const r = await req(app, '/admin/connexion', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ email: 'admin@example.com', password: 'motdepasse-test-2026' }) });
    const cookie = r.headers.get('set-cookie')!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('rejette une écriture sans jeton CSRF', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const r = await s.post('/admin/parametres', { agencyName: 'Pirate' }, { csrf: false });
    expect(r.status).toBe(403);
  });

  it('toutes les pages s’affichent une fois connecté', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    for (const p of ADMIN_PAGES) {
      const r = await s.get(p);
      expect(r.status, p).toBe(200);
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.headers.get('x-robots-tag')).toContain('noindex');
    }
  });

  it('installation : jeton requis, une seule fois', async () => {
    const { app, db } = await makeApp();
    const bad = await req(app, '/admin/installation', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: 'faux', name: 'X', email: 'x@example.com', password: 'abcdefgh1234', password2: 'abcdefgh1234' }) });
    expect(bad.status).toBe(403);
    const ok = await req(app, '/admin/installation', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: 'setup-token-for-tests', name: 'Gérant', email: 'gerant@example.com', password: 'abcdefgh1234', password2: 'abcdefgh1234' }) });
    expect(ok.status).toBe(303);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM admin_users'))!.n).toBe(1);
    expect((await req(app, '/admin/installation')).status).toBe(404);
  });
});

describe('paramètres', () => {
  it('le nom de l’agence se change sans toucher au code', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const html = await (await s.get('/admin/parametres')).text();
    const fields = Object.fromEntries([...html.matchAll(/<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/g)].map((m) => [m[1]!, m[2]!.replace(/&amp;/g, '&').replace(/&#39;/g, "'")]));
    const selects = { vatMode: 'normal', analyticsProvider: 'none' };
    const r = await s.post('/admin/parametres', { ...fields, ...selects, agencyName: 'Maison Lumière', _csrf: s.csrf });
    expect(r.status).toBe(303);
    const home = await (await req(app, '/')).text();
    expect(home).toContain('Maison Lumière');
    expect(home).toContain('class="logo-name"');
    const fav = await (await req(app, '/favicon.svg')).text();
    expect(fav).toContain('<svg');
  });
});

describe('prix fournisseurs', () => {
  it('vérification puis validation du prix de vente avant publication ; alerte en cas de changement de coût', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const v = (await db.get<{ id: number }>("SELECT id FROM supplier_price_variants WHERE quantity = 250 AND product_id = (SELECT id FROM print_products WHERE slug = 'cartes-de-visite')"))!;
    // Validation impossible tant que non vérifié.
    expect((await s.post(`/admin/impression/tarifs/${v.id}/valider`)).status).toBe(422);
    const today = new Date().toISOString().slice(0, 10);
    expect((await s.post(`/admin/impression/tarifs/${v.id}/verifier`, { verified_at: today, source: 'Compte fournisseur, panier du jour' })).status).toBe(303);
    expect((await s.post(`/admin/impression/tarifs/${v.id}/valider`)).status).toBe(422); // prix de vente manquant
    const product = (await db.get<{ id: number }>("SELECT id FROM print_products WHERE slug = 'cartes-de-visite'"))!;
    const form = {
      product_id: String(product.id), format: 'Classique 85 × 55 mm', paper: 'Couché mat', weight: '350 g', finish: 'Sans finition', printing: 'Recto-verso', extra: 'Coins carrés', delivery: 'Standard',
      quantity: '250', supplier_price_ht: '18,29', supplier_shipping_ht: '0', sale_print_ht: '39,00', sale_shipping_ht: '6,90', source: 'Compte fournisseur, panier du jour',
    };
    expect((await s.post(`/admin/impression/tarifs/${v.id}`, form)).status).toBe(303);
    // Un coût modifié (frais de port renseignés) impose une nouvelle vérification.
    expect((await s.post(`/admin/impression/tarifs/${v.id}/valider`)).status).toBe(422);
    expect((await s.post(`/admin/impression/tarifs/${v.id}/verifier`, { verified_at: today, source: 'Compte fournisseur, panier du jour' })).status).toBe(303);
    expect((await s.post(`/admin/impression/tarifs/${v.id}/valider`)).status).toBe(303);
    const config = { format: 'Classique 85 × 55 mm', paper: 'Couché mat', weight: '350 g', finish: 'Sans finition', printing: 'Recto-verso', extra: 'Coins carrés', delivery: 'Standard', quantity: 250 };
    const est = async () => (await (await req(app, '/api/print/estimate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ product: 'cartes-de-visite', config }) })).json()).estimate;
    expect((await est()).totalHt).toBe(4590);
    // Le fournisseur augmente son prix : la variante repasse « à vérifier », le prix public n'est plus affiché ni modifié.
    expect((await s.post(`/admin/impression/tarifs/${v.id}`, { ...form, supplier_price_ht: '21,00' })).status).toBe(303);
    const after = await est();
    expect(after.status).toBe('on_request');
    const row = (await db.get<{ status: string; sale_print_ht: number }>('SELECT status, sale_print_ht FROM supplier_price_variants WHERE id = ?', [v.id]))!;
    expect(row.status).toBe('a_verifier');
    expect(row.sale_print_ht).toBe(3900);
    const dash = await (await s.get('/admin')).text();
    expect(dash).toContain('prix fournisseur à vérifier');
  });
});

async function submitPrintRequest(app: Awaited<ReturnType<typeof makeApp>>['app']) {
  const fd = new FormData();
  const fields: Record<string, string> = {
    _ft: await formToken(SECRET, Date.now() - 10_000), type: 'impression', activity: 'Fleuriste', description: 'Cartes de visite pour la boutique', product: 'cartes-de-visite',
    print_format: 'Classique 85 × 55 mm', print_paper: 'Couché mat', print_weight: '350 g', print_finish: 'Sans finition', print_printing: 'Recto-verso', print_extra: 'Coins carrés',
    print_delivery: 'Standard', print_quantity: '250', want_design: '1', customer_type: 'pro', name: 'Inès Fleur', company: 'Fleurs & Co', email: 'ines@example.com', privacy: '1',
  };
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  const r = await req(app, '/devis', { method: 'POST', body: fd });
  expect(r.status).toBe(303);
}

describe('parcours complet : demande → devis → BAT → commande → facture', () => {
  it('fonctionne de bout en bout en respectant chaque garde-fou', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    await submitPrintRequest(app);
    const request = (await db.get<{ id: number; contact_id: number }>('SELECT id, contact_id FROM quote_requests'))!;
    const order = (await db.get<{ id: number; status: string }>('SELECT id, status FROM print_orders'))!;

    // 1. Devis prérempli depuis la demande.
    let r = await s.post('/admin/devis/nouveau', { contact_id: String(request.contact_id), request_id: String(request.id), title: 'Cartes de visite' });
    expect(r.status).toBe(303);
    const quoteId = Number(r.headers.get('location')!.match(/\/admin\/devis\/(\d+)/)![1]);
    const lines = await db.all<{ kind: string; unit_price_ht: number; unit_cost_ht: number }>('SELECT kind, unit_price_ht, unit_cost_ht FROM quote_lines WHERE quote_id = ? ORDER BY position', [quoteId]);
    expect(lines.map((l) => l.kind)).toEqual(['service', 'print', 'shipping']);
    expect(lines[0]!.unit_price_ht).toBe(4900);
    expect(lines[1]!.unit_cost_ht).toBe(1829); // coût observé, interne uniquement

    // Envoi refusé tant qu'une ligne a un prix nul (impression non chiffrée).
    r = await s.post(`/admin/devis/${quoteId}/envoyer`, { mode: 'email' });
    expect(r.status).toBe(422);

    // 2. Saisie des prix puis envoi.
    r = await s.post(`/admin/devis/${quoteId}`, {
      title: 'Cartes de visite', intro: '', terms: '', deposit_percent: '30',
      line_id: ['', '', ''], line_kind: ['service', 'print', 'shipping'], line_description: ['Création carte de visite', 'Impression 250 cartes', 'Livraison'],
      line_quantity: ['1', '1', '1'], line_price: ['49', '39', '6,90'], line_vat: ['20', '20', '20'], line_cost: ['0', '18,29', '0'],
    });
    expect(r.status).toBe(303);
    r = await s.post(`/admin/devis/${quoteId}/envoyer`, { mode: 'email' });
    expect(r.status).toBe(303);
    const quote = (await db.get<{ number: string; status: string; token: string }>('SELECT number, status, token FROM quotes WHERE id = ?', [quoteId]))!;
    expect(quote.status).toBe('envoye');
    expect(quote.number).toMatch(/^D-\d{4}-0001$/);
    expect((await db.get<{ status: string }>('SELECT status FROM print_orders WHERE id = ?', [order.id]))!.status).toBe('devis_envoye');

    // Le client voit le devis sans aucun coût interne.
    const clientPage = await (await req(app, `/client/devis/${quote.token}`)).text();
    expect(clientPage).toContain(quote.number);
    expect(clientPage).not.toContain('18,29');
    expect(clientPage).toContain('noindex');

    // 3. Acceptation par le client.
    r = await req(app, `/client/devis/${quote.token}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ decision: 'accepte', name: 'Inès Fleur', agree: '1' }) });
    expect(r.status).toBe(303);
    expect((await db.get<{ status: string }>('SELECT status FROM quotes WHERE id = ?', [quoteId]))!.status).toBe('accepte');
    expect((await db.get<{ status: string }>('SELECT status FROM print_orders WHERE id = ?', [order.id]))!.status).toBe('devis_accepte');
    expect((await db.get<{ status: string }>('SELECT status FROM contacts WHERE id = ?', [request.contact_id]))!.status).toBe('gagne');

    // 4. Impossible de commander chez le fournisseur sans BAT accepté.
    r = await s.post(`/admin/commandes/${order.id}/statut`, { status: 'commande_a_passer' });
    expect(r.status).toBe(409);

    // 5. BAT : upload, envoi bloqué tant que la checklist est incomplète.
    const fd = new FormData();
    fd.append('file', new File([new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Page /MediaBox [0 0 252.3 167.2] >> endobj')], 'carte-v1.pdf', { type: 'application/pdf' }));
    r = await s.postMultipart(`/admin/commandes/${order.id}/bat`, fd);
    expect(r.status).toBe(303);
    const proof = (await db.get<{ id: number; token: string; pdf_info: string }>('SELECT id, token, pdf_info FROM proofs WHERE order_id = ?', [order.id]))!;
    expect(JSON.parse(proof.pdf_info).mediaBoxMm).toEqual([89, 59]);
    r = await s.post(`/admin/bat/${proof.id}/envoyer`);
    expect(r.status).toBe(422);
    r = await s.post(`/admin/bat/${proof.id}/checklist`, { check: ['dimensions', 'bleed', 'safety', 'resolution', 'color', 'fonts', 'spelling', 'contact', 'sides', 'supplier'] });
    expect(r.status).toBe(303);
    r = await s.post(`/admin/bat/${proof.id}/envoyer`);
    expect(r.status).toBe(303);
    expect((await db.get<{ status: string }>('SELECT status FROM print_orders WHERE id = ?', [order.id]))!.status).toBe('bat_envoye');

    // Fichier du BAT accessible par le client via son lien.
    const file = await req(app, `/client/bat/${proof.token}/fichier`);
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('application/pdf');

    // 6. Le client valide le BAT.
    r = await req(app, `/client/bat/${proof.token}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ decision: 'accepte', name: 'Inès Fleur', agree: '1' }) });
    expect(r.status).toBe(303);
    expect((await db.get<{ status: string; validated_proof_id: number }>('SELECT status, validated_proof_id FROM print_orders WHERE id = ?', [order.id]))).toMatchObject({ status: 'bat_accepte', validated_proof_id: proof.id });

    // 7. Commande fournisseur : « passée » exige la référence réelle.
    expect((await s.post(`/admin/commandes/${order.id}/statut`, { status: 'commande_a_passer' })).status).toBe(303);
    expect((await s.post(`/admin/commandes/${order.id}/statut`, { status: 'commande_passee' })).status).toBe(409);
    const today = new Date().toISOString().slice(0, 10);
    r = await s.post(`/admin/commandes/${order.id}`, { supplier: 'HelloPrint', supplier_order_ref: 'HP-2026-998877', supplier_ordered_at: today, supplier_cost_ht: '18,29', sale_total_ht: '94,90', tracking_url: '', estimated_delivery: '', quote_id: String(quoteId), bat_required: '1', notes: '' });
    expect(r.status).toBe(303);
    expect((await s.post(`/admin/commandes/${order.id}/statut`, { status: 'commande_passee' })).status).toBe(303);

    // 8. Facture : émission bloquée sans informations légales.
    r = await s.post(`/admin/factures/depuis-devis/${quoteId}`);
    expect(r.status).toBe(303);
    const invoiceId = Number(r.headers.get('location')!.match(/\/admin\/factures\/(\d+)/)![1]);
    expect((await s.post(`/admin/factures/${invoiceId}/emettre`)).status).toBe(422);
    await db.run(
      `UPDATE settings SET value = json_set(value, '$.legal.companyName', 'Agence Test EI', '$.legal.legalForm', 'Entrepreneur individuel', '$.legal.address', '1 rue de l’Exemple, 75000 Paris',
       '$.legal.siren', '123456789', '$.legal.vatNumber', 'FR00123456789', '$.legal.publicationDirector', 'Gérant Test', '$.legal.hostName', 'Hébergeur Test', '$.contactEmail', 'contact@example.com') WHERE key = 'site'`,
    );
    await new Promise((res) => setTimeout(res, 5100)); // cache des paramètres (5 s)
    expect((await s.post(`/admin/factures/${invoiceId}/emettre`)).status).toBe(303);
    const inv = (await db.get<{ number: string; status: string; total_ht: number; total_ttc: number; cost_ht: number; seller: string }>('SELECT * FROM invoices WHERE id = ?', [invoiceId]))!;
    expect(inv.number).toMatch(/^F-\d{4}-0001$/);
    expect(inv.status).toBe('emise');
    expect(inv.total_ht).toBe(9490);
    expect(inv.total_ttc).toBe(11388);
    expect(inv.cost_ht).toBe(1829);
    expect(JSON.parse(inv.seller).siren).toBe('123456789');

    // Facture émise : non modifiable, non supprimable, émission non rejouable (pas de numéro consommé).
    expect((await s.post(`/admin/factures/${invoiceId}`, { line_id: [''], line_description: ['Fraude'], line_quantity: ['1'], line_price: ['1'], line_vat: ['20'], line_cost: ['0'] })).status).toBe(404);
    await s.post(`/admin/factures/${invoiceId}/supprimer`);
    expect(await db.get('SELECT id FROM invoices WHERE id = ?', [invoiceId])).toBeTruthy();
    await s.post(`/admin/factures/${invoiceId}/emettre`);
    expect((await db.get<{ value: number }>("SELECT value FROM counters WHERE name LIKE 'F-%'"))!.value).toBe(1);

    // Une seconde facture reçoit le numéro suivant ; un avoir a sa propre série.
    r = await s.post(`/admin/factures/${invoiceId}/avoir`);
    const creditId = Number(r.headers.get('location')!.match(/\/admin\/factures\/(\d+)/)![1]);
    expect((await s.post(`/admin/factures/${creditId}/emettre`)).status).toBe(303);
    expect((await db.get<{ number: string }>('SELECT number FROM invoices WHERE id = ?', [creditId]))!.number).toMatch(/^A-\d{4}-0001$/);

    // Paiement.
    expect((await s.post(`/admin/factures/${invoiceId}/payee`, { paid_at: today, payment_method: 'Virement' })).status).toBe(303);

    // Tableau de bord : chiffres réels (facture − avoir = 0).
    const dash = await (await s.get('/admin')).text();
    expect(dash).toContain('CA facturé HT');
  }, 30000);
});

describe('CRM', () => {
  it('export CSV protégé et neutralisant les formules', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    await db.run("INSERT INTO contacts (name, company, email, created_at, updated_at) VALUES ('=CMD()', '+Société', 'a@example.com', '', '')");
    const r = await s.get('/admin/crm/export.csv');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toContain('attachment');
    const csv = await r.text();
    expect(csv).toContain("'=CMD()");
    expect(csv).toContain("'+Société");
  });

  it('création, statut et historique', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const r = await s.post('/admin/crm/nouveau', { name: 'Paul Artisan', company: 'Paul Menuiserie', email: 'paul@example.com', phone: '', address: '', postal_code: '', city: '', siren: '', customer_type: 'pro', source: 'telephone', need: 'Site', budget: '', status: 'a_contacter', next_action: 'Rappeler', next_action_at: '2026-10-21', notes: '' });
    expect(r.status).toBe(303);
    const id = Number(r.headers.get('location')!.match(/crm\/(\d+)/)![1]);
    await s.post(`/admin/crm/${id}`, { name: 'Paul Artisan', company: 'Paul Menuiserie', email: 'paul@example.com', phone: '', address: '', postal_code: '', city: '', siren: '', customer_type: 'pro', source: 'telephone', need: 'Site', budget: '', status: 'qualifie', next_action: '', next_action_at: '', notes: '' });
    await s.post(`/admin/crm/${id}/evenement`, { kind: 'appel', body: 'Appel : intéressé par le Site Business.' });
    const events = await db.all<{ body: string }>('SELECT body FROM contact_events WHERE contact_id = ? ORDER BY id', [id]);
    expect(events.map((e) => e.body)).toEqual(['Statut : À contacter → Qualifié', 'Appel : intéressé par le Site Business.']);
    expect((await s.post('/admin/crm/nouveau', { name: 'X', email: 'invalide', customer_type: 'pro', status: 'nouveau', siren: '' })).status).toBe(422);
  });

  it('téléchargement des pièces jointes réservé aux administrateurs', async () => {
    const { app, db, deps } = await makeApp();
    await deps.storage.put('cle_de_test_123456', new TextEncoder().encode('%PDF-1.4'), 'application/pdf');
    await db.run("INSERT INTO files (key, name, type, size, owner_kind, owner_id, created_at) VALUES ('cle_de_test_123456', 'brief.pdf', 'application/pdf', 8, 'request', 1, '')");
    expect((await req(app, '/admin/fichiers/cle_de_test_123456')).status).toBe(302);
    const s = await adminSession(app, db);
    const r = await s.get('/admin/fichiers/cle_de_test_123456');
    expect(r.status).toBe(200);
    expect(r.headers.get('content-disposition')).toContain('attachment');
  });
});

describe('contenus et SEO', () => {
  it('une page locale sans contenu suffisant ne peut pas être publiée', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const r = await s.post('/admin/contenus/pages-locales/nouveau', { city: 'Lyon', title: 'Agence web à Lyon', slug: '', intro: 'Intro', body: 'Trop court.', meta_description: '', status: 'published' });
    expect(r.status).toBe(422);
    const body = Array.from({ length: 320 }, (_, i) => `mot${i}`).join(' ');
    const ok = await s.post('/admin/contenus/pages-locales/nouveau', { city: 'Lyon', title: 'Agence web à Lyon', slug: '', intro: 'Intro', body, meta_description: 'Desc', status: 'published' });
    expect(ok.status).toBe(303);
    expect((await req(app, '/agence-web/agence-web-a-lyon')).status).toBe(200);
    expect(await (await req(app, '/sitemap.xml')).text()).toContain('/agence-web/agence-web-a-lyon');
  });

  it('une prestation désactivée disparaît du site', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const html = await (await s.get('/admin/prestations/1')).text();
    expect(html).toContain('Flyer personnalisé');
    await db.run("UPDATE services SET status = 'disabled' WHERE slug = 'flyer-personnalise'");
    expect(await (await req(app, '/tarifs')).text()).not.toContain('Flyer personnalisé');
  });

  it('un projet ne peut pas passer en ligne sans recette validée, et refuse les secrets', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    await db.run("INSERT INTO contacts (name, email, created_at, updated_at) VALUES ('Client Web', 'web@example.com', '', '')");
    let r = await s.post('/admin/projets/nouveau', { name: 'Site vitrine', contact_id: '1', due_date: '' });
    const id = Number(r.headers.get('location')!.match(/projets\/(\d+)/)![1]);
    const base = { name: 'Site vitrine', status: 'en_ligne', due_date: '', current_version: '1.0', domain: '', hosting: '', staging_url: 'https://preprod.example.com', production_url: '', brief: '', identity: '', texts: '', photos: '', sitemap: '', backups: '', maintenance_terms: '' };
    expect((await s.post(`/admin/projets/${id}`, base)).status).toBe(409);
    expect((await s.post(`/admin/projets/${id}`, { ...base, status: 'developpement', hosting: 'OVH, mot de passe: azerty' })).status).toBe(422);
    expect((await s.post(`/admin/projets/${id}/recette`)).status).toBe(422); // URL de préproduction non enregistrée
    expect((await s.post(`/admin/projets/${id}`, { ...base, status: 'developpement' })).status).toBe(303);
    r = await s.post(`/admin/projets/${id}/recette`);
    expect(r.status).toBe(303);
    const token = (await db.get<{ acceptance_token: string }>('SELECT acceptance_token FROM web_projects WHERE id = ?', [id]))!.acceptance_token;
    await req(app, `/client/projet/${token}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ decision: 'accepte', name: 'Client Web', agree: '1' }) });
    expect((await s.post(`/admin/projets/${id}`, base)).status).toBe(303);
  });
});
