// Recette de bout en bout contre un serveur en fonctionnement (Node ou Cloudflare Workers).
//   BASE_URL=http://localhost:3000 SETUP_TOKEN=… node scripts/e2e.mjs
// Le serveur doit être vierge (aucun administrateur) et le jeton d'installation défini.
// Étapes : pages publiques, API d'estimation, demande de devis avec fichier, installation admin,
// devis → acceptation client, BAT → validation client, garde-fous de commande.
const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const SETUP = process.env.SETUP_TOKEN ?? '';
const origin = new URL(BASE).origin;
let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✔' : '✘'} ${label}`);
  if (!cond) failures++;
};

async function http(path, init = {}, cookie = '') {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return fetch(BASE + path, { ...init, headers, redirect: 'manual' });
}

// 1. Pages publiques
for (const p of ['/', '/tarifs', '/impression', '/impression/flyers', '/devis', '/realisations', '/blog', '/contact', '/cgv', '/sitemap.xml', '/robots.txt', '/assets/css/site.css', '/assets/js/site.js']) {
  const r = await http(p);
  ok(r.status === 200, `GET ${p} → ${r.status}`);
}
ok((await http('/inexistant')).status === 404, 'page 404');

// 2. Estimation
const est = await http('/api/print/estimate', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ product: 'flyers', config: { format: 'A5 (148 × 210 mm)', orientation: 'Portrait', paper: 'Couché brillant', weight: '135 g', printing: 'Recto-verso', delivery: 'Standard', quantity: 500 } }),
});
const estJson = await est.json();
ok(est.status === 200 && estJson.estimate.status === 'on_request', 'estimation : prix non vérifié → sur devis');
ok(!/supplier|cost|3299/i.test(JSON.stringify(estJson)), 'estimation : aucun coût fournisseur');

// 3. Demande de devis avec pièce jointe (le jeton du formulaire doit avoir plus de 3 s)
const page = await (await http('/devis?produit=flyers')).text();
const ft = page.match(/name="_ft" value="([^"]+)"/)?.[1];
ok(!!ft, 'jeton de formulaire présent');
await new Promise((r) => setTimeout(r, 3200));
const fd = new FormData();
const fields = {
  _ft: ft, type: 'impression', activity: 'Recette automatisée', description: 'Demande de test de bout en bout', product: 'flyers', want_design: '1',
  print_format: 'A5 (148 × 210 mm)', print_orientation: 'Portrait', print_paper: 'Couché brillant', print_weight: '135 g', print_printing: 'Recto-verso',
  print_delivery: 'Standard', print_quantity: '500', customer_type: 'pro', name: 'Client Recette', company: 'Recette SARL', email: 'recette@example.com', privacy: '1',
};
for (const [k, v] of Object.entries(fields)) fd.append(k, v);
fd.append('files', new Blob([new TextEncoder().encode('%PDF-1.4\n%recette')], { type: 'application/pdf' }), 'brief.pdf');
const sub = await http('/devis', { method: 'POST', body: fd });
ok(sub.status === 303 && sub.headers.get('location') === '/devis/merci', `demande de devis → ${sub.status}`);

// 4. Installation de l'administrateur puis connexion
if (SETUP) {
  const inst = await http('/admin/installation', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: SETUP, name: 'Recette', email: 'recette-admin@example.com', password: 'recette-motdepasse-2026', password2: 'recette-motdepasse-2026' }),
  });
  ok(inst.status === 303, `installation admin → ${inst.status}`);
}
const login = await http('/admin/connexion', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ email: 'recette-admin@example.com', password: 'recette-motdepasse-2026' }),
});
ok(login.status === 303, `connexion admin → ${login.status}`);
const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
const dash = await (await http('/admin', {}, cookie)).text();
const csrf = dash.match(/name="_csrf" value="([^"]+)"/)?.[1] ?? '';
ok(!!csrf, 'tableau de bord accessible');
const post = (path, data) => {
  const body = new URLSearchParams({ _csrf: csrf });
  for (const [k, v] of Object.entries(data)) for (const x of [].concat(v)) body.append(k, x);
  return http(path, { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } }, cookie);
};

// 5. La demande, sa pièce jointe et la commande existent
const requests = await (await http('/admin/demandes', {}, cookie)).text();
const reqId = requests.match(/href="\/admin\/demandes\/(\d+)"/)?.[1];
ok(!!reqId, 'demande listée dans l’administration');
const reqPage = await (await http(`/admin/demandes/${reqId}`, {}, cookie)).text();
const fileKey = reqPage.match(/href="\/admin\/fichiers\/([^"]+)"/)?.[1];
const file = await http(`/admin/fichiers/${fileKey}`, {}, cookie);
ok(file.status === 200 && (await file.text()).startsWith('%PDF'), 'pièce jointe stockée et téléchargeable');
const orderId = (await (await http('/admin/commandes', {}, cookie)).text()).match(/href="\/admin\/commandes\/(\d+)"/)?.[1];
ok(!!orderId, 'commande d’impression créée automatiquement');
const contactId = reqPage.match(/href="\/admin\/crm\/(\d+)"/)?.[1];

// 6. Devis → envoi → acceptation client
let r = await post('/admin/devis/nouveau', { contact_id: contactId, request_id: reqId, title: 'Flyers recette' });
const quoteId = r.headers.get('location')?.match(/devis\/(\d+)/)?.[1];
await post(`/admin/devis/${quoteId}`, {
  title: 'Flyers recette', intro: '', terms: '', deposit_percent: '30',
  line_id: ['', ''], line_kind: ['service', 'print'], line_description: ['Création flyer', 'Impression 500 flyers A5'],
  line_quantity: ['1', '1'], line_price: ['69', '59'], line_vat: ['20', '20'], line_cost: ['0', '32,99'],
});
r = await post(`/admin/devis/${quoteId}/envoyer`, { mode: 'email' });
ok(r.status === 303, `envoi du devis → ${r.status}`);
const qp = await (await http(`/admin/devis/${quoteId}`, {}, cookie)).text();
const qToken = qp.match(/\/client\/devis\/([A-Za-z0-9_-]{40,64})/)?.[1];
const clientQuote = await (await http(`/client/devis/${qToken}`)).text();
ok(clientQuote.includes('Accepter le devis') && !clientQuote.includes('32,99'), 'devis client affiché sans coût interne');
r = await http(`/client/devis/${qToken}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ decision: 'accepte', name: 'Client Recette', agree: '1' }) });
ok(r.status === 303, 'acceptation du devis par le client');

// 7. Garde-fou : pas de commande fournisseur sans BAT
r = await post(`/admin/commandes/${orderId}/statut`, { status: 'commande_a_passer' });
ok(r.status === 409, 'commande fournisseur refusée sans BAT accepté');

// 8. BAT : envoi, validation client
const bat = new FormData();
bat.append('_csrf', csrf);
bat.append('file', new Blob([new TextEncoder().encode('%PDF-1.4\n1 0 obj << /Type /Page /MediaBox [0 0 419.5 595.3] >> endobj')], { type: 'application/pdf' }), 'flyer-v1.pdf');
r = await http(`/admin/commandes/${orderId}/bat`, { method: 'POST', body: bat }, cookie);
ok(r.status === 303, 'BAT déposé');
const op = await (await http(`/admin/commandes/${orderId}`, {}, cookie)).text();
const proofId = op.match(/action="\/admin\/bat\/(\d+)\/checklist"/)?.[1];
ok((await post(`/admin/bat/${proofId}/envoyer`, {})).status === 422, 'BAT non envoyable sans checklist complète');
await post(`/admin/bat/${proofId}/checklist`, { check: ['dimensions', 'bleed', 'safety', 'resolution', 'color', 'fonts', 'spelling', 'contact', 'sides', 'supplier'] });
ok((await post(`/admin/bat/${proofId}/envoyer`, {})).status === 303, 'BAT envoyé');
const op2 = await (await http(`/admin/commandes/${orderId}`, {}, cookie)).text();
const pToken = op2.match(/\/client\/bat\/([A-Za-z0-9_-]{40,64})/)?.[1];
ok((await http(`/client/bat/${pToken}/fichier`)).status === 200, 'fichier du BAT visible par le client');
r = await http(`/client/bat/${pToken}`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ decision: 'accepte', name: 'Client Recette', agree: '1' }) });
ok(r.status === 303, 'BAT validé par le client');
ok((await post(`/admin/commandes/${orderId}/statut`, { status: 'commande_a_passer' })).status === 303, 'commande fournisseur à passer autorisée après BAT');
ok((await post(`/admin/commandes/${orderId}/statut`, { status: 'commande_passee' })).status === 409, '« commande passée » refusée sans référence fournisseur');

console.log(failures ? `\n${failures} échec(s).` : '\nRecette de bout en bout : tout est conforme.');
process.exit(failures ? 1 : 0);
