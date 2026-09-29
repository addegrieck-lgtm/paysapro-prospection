import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { displayPhone, extractPhones, phoneType, samePhone, toE164 } from '../src/domain/phone';
import { computeConfidence, statusOf } from '../src/domain/contacts';
import { candidateDomains, classifyEmail, contactPageLinks, extractEmails, extractSocialLinks, isThirdPartyContact, pageMentions } from '../src/domain/webContacts';
import { matchPlace, parseOverpass, OpenStreetMapProvider, type OverpassElement } from '../src/providers/company/OpenStreetMapProvider';
import { WebsiteProvider } from '../src/providers/company/WebsiteProvider';
import { RechercheEntreprisesProvider, type ApiUniteLegale } from '../src/providers/company/RechercheEntreprisesProvider';
import { RateLimiter, type HttpResponse } from '../src/providers/http';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi } from '../src/data/repository';
import { EnrichmentEngine } from '../src/data/enrichmentEngine';
import { EnrichmentQueue } from '../src/data/enrichmentQueue';
import { ProspectingSearchEngine } from '../src/data/searchEngine';
import { memoryCache } from '../src/data/cache';
import { exportProspectsCsv } from '../src/data/export';
import { parseCsv } from '../src/domain/csv';
import { handle as proxyHandle } from '../worker/web-proxy.js';

const noWait = { limiter: new RateLimiter(0), wait: async () => undefined };
let n = 0;
async function setup(workspaceId = 'w1') {
  const db = await openProspectingDB(`phones-${++n}-${Date.now()}`);
  return { db, api: new ProspectsApi(db, { workspaceId, user: 'Adrien', role: 'owner' }) };
}

// ─── Données SYNTHÉTIQUES ───

const OSM: { elements: OverpassElement[] } = {
  elements: [
    { type: 'node', id: 1, lat: 49.44, lon: 1.09, tags: { craft: 'gardener', name: 'Jardins Fictifs du Val', phone: '+33 2 35 00 00 01', website: 'https://jardins-fictifs.test', 'ref:FR:SIRET': '90000000100011', 'addr:postcode': '76000', 'addr:city': 'Rouen' } },
    { type: 'node', id: 2, lat: 49.49, lon: 0.11, tags: { craft: 'gardener', name: 'Paysages Test Normandie', 'contact:phone': '02 35 00 00 02;06 00 00 00 02', 'addr:postcode': '76600', 'addr:city': 'Le Havre' } },
    { type: 'node', id: 3, lat: 43.3, lon: 5.4, tags: { craft: 'gardener', name: 'Vert Horizon', phone: '04 91 00 00 03', 'addr:city': 'Marseille' } },
    { type: 'way', id: 4, center: { lat: 49.44, lon: 1.1 }, tags: { craft: 'gardener', name: 'Sans téléphone', 'addr:city': 'Rouen' } },
  ],
};

const SITE_HOME = `<html><body><h1>Jardins Fictifs du Val</h1><p>Paysagiste à Rouen (76000)</p>
<a href="/contact">Nous contacter</a> <a href="/mentions-legales">Mentions légales</a>
<a href="https://www.facebook.com/jardinsfictifs">Facebook</a> <a href="https://www.facebook.com/sharer/sharer.php?u=x">Partager</a>
<a href="tel:+33235000001">02 35 00 00 01</a></body></html>`;
const SITE_CONTACT = `<html><body>Téléphone : 02.35.00.00.01 — Mobile : 06 12 00 00 01 — Fax : 02 35 00 00 09
<a href="mailto:contact@jardins-fictifs.test">Écrire</a> jean.dupont@jardins-fictifs.test votre@email.com</body></html>`;
const SITE_LEGAL = `<html><body>SARL Jardins Fictifs du Val — SIRET 900 000 001 00011 — RCS Rouen</body></html>`;

function proxyFetch(pages: Record<string, string>) {
  return vi.fn(async (url: string): Promise<HttpResponse> => {
    const target = new URL(url).searchParams.get('url')!;
    const html = pages[target.replace(/\/$/, '')];
    return { ok: true, status: 200, json: async () => (html ? { ok: true, status: 200, url: target, html } : { ok: false, status: 404, url: target, html: '' }) };
  });
}

function apiCompany(): ApiUniteLegale {
  const siege = {
    siret: '90000000100011',
    activite_principale: '81.30Z',
    adresse: '12 RUE DES LILAS 76000 ROUEN',
    code_postal: '76000',
    commune: '76540',
    libelle_commune: 'ROUEN',
    region: '28',
    date_creation: '2019-03-01',
    etat_administratif: 'A',
    est_siege: true,
    tranche_effectif_salarie: '02',
    latitude: '49.44',
    longitude: '1.09',
  };
  return {
    siren: '900000001',
    nom_complet: 'JARDINS FICTIFS DU VAL',
    nom_raison_sociale: 'JARDINS FICTIFS DU VAL',
    nature_juridique: '5499',
    date_creation: '2019-03-01',
    etat_administratif: 'A',
    statut_diffusion: 'O',
    tranche_effectif_salarie: '02',
    siege,
    matching_etablissements: [siege],
  };
}

const officialFetch = vi.fn(async (): Promise<HttpResponse> => ({ ok: true, status: 200, json: async () => ({ results: [apiCompany()], total_results: 1, page: 1, per_page: 25, total_pages: 1 }) }));

// ─────────────────────────────────────────────────────────────

describe('PhoneNormalizer', () => {
  it('reconnaît le même numéro sous toutes ses formes (format interne +33)', () => {
    for (const v of ['02 35 12 34 56', '+33 2 35 12 34 56', '0235123456', '+33 (0)2 35 12 34 56', '0033235123456', '02.35.12.34.56', '235123456']) expect(toE164(v)).toBe('+33235123456');
    expect(samePhone('02 35 12 34 56', '+33235123456')).toBe(true);
    expect(displayPhone('+33235123456')).toBe('02 35 12 34 56');
    expect(toE164('12 34')).toBeNull();
    expect(toE164('+32 2 123 45 67')).toBe('+3221234567');
  });

  it('type : fixe, mobile, inconnu', () => {
    expect(phoneType('+33235123456')).toBe('landline');
    expect(phoneType('+33612345678')).toBe('mobile');
    expect(phoneType('+33712345678')).toBe('mobile');
    expect(phoneType('+3221234567')).toBe('unknown');
  });

  it('extraction : liens tel:, texte, fax ; jamais un SIRET ou un nombre quelconque', () => {
    const found = extractPhones(`${SITE_HOME}${SITE_CONTACT}${SITE_LEGAL} Commande n°0123456789012 · 12345678`);
    expect(found.map((p) => [p.e164, p.type, p.fromTelLink])).toEqual([
      ['+33235000001', 'landline', true],
      ['+33612000001', 'mobile', false],
      ['+33235000009', 'fax', false],
    ]);
  });
});

describe('PhoneVerificationEngine (confiance transparente)', () => {
  const at = '2026-09-29';
  it('≈ 98 : même entreprise, même ville, même adresse, sur le site officiel', () => {
    const r = computeConfidence([{ kind: 'website', provider: 'Site officiel', url: 'x', at, matched: ['siret', 'name', 'city', 'address', 'website_verified', 'tel_link'] }]);
    expect(r.confidence).toBeGreaterThanOrEqual(95);
    expect(r.status).toBe('verified');
    expect(r.reasons).toEqual(expect.arrayContaining(['même SIRET (+25)', 'présent sur le site officiel vérifié (+15)']));
  });
  it('≈ 65 : nom similaire, même ville, source secondaire → à vérifier', () => {
    const r = computeConfidence([{ kind: 'directory', provider: 'OpenStreetMap', url: 'x', at, matched: ['name', 'city'] }]);
    expect(r.confidence).toBe(65);
    expect(r.status).toBe('to_verify');
  });
  it('sources concordantes (+10 chacune), numéro partagé (−30), saisie manuelle = 100', () => {
    const two = computeConfidence([
      { kind: 'directory', provider: 'OpenStreetMap', url: 'a', at, matched: ['name', 'city'] },
      { kind: 'import', provider: 'Import CSV', url: null, at, matched: [] },
    ]);
    expect(two.confidence).toBe(75);
    expect(two.sources).toBe(2);
    expect(computeConfidence([{ kind: 'directory', provider: 'OpenStreetMap', url: 'a', at, matched: ['name', 'city'] }], { shared: true }).confidence).toBe(35);
    expect(computeConfidence([], { manual: true }).confidence).toBe(100);
    expect(statusOf(80)).toBe('verified');
    expect(statusOf(49)).toBe('unverified');
  });
});

describe('Extraction depuis un site web', () => {
  it('e-mails (sans e-mail inventé), réseaux, pages contact, mentions de l’entreprise', () => {
    expect(extractEmails(SITE_CONTACT).map((e) => [e.email, e.kind, e.fromMailto])).toEqual([
      ['contact@jardins-fictifs.test', 'generic', true],
      ['jean.dupont@jardins-fictifs.test', 'nominative', false],
    ]);
    expect(classifyEmail('bonjour@x.fr')).toBe('generic');
    expect(extractSocialLinks(SITE_HOME)).toEqual({ facebook: 'https://www.facebook.com/jardinsfictifs', instagram: null, linkedin: null });
    expect(contactPageLinks(SITE_HOME, 'https://jardins-fictifs.test')).toEqual(['https://jardins-fictifs.test/contact', 'https://jardins-fictifs.test/mentions-legales']);
    expect(pageMentions(SITE_LEGAL, { siren: '900000001', siret: '90000000100011', name: 'Jardins Fictifs du Val', city: 'Rouen', postalCode: '76000' })).toMatchObject({ siren: true, siret: true, name: true, city: true });
    expect(candidateDomains('Jardins Fictifs du Val')).toEqual(['jardins-fictifs-val.fr', 'jardinsfictifsval.fr', 'jardins-fictifs-val.com', 'jardinsfictifsval.com']);
  });

  it('WebsiteProvider : analyse accueil + contact + mentions ; site vérifié par le SIRET', async () => {
    const w = new WebsiteProvider('https://relais.test', { fetchImpl: proxyFetch({ 'https://jardins-fictifs.test': SITE_HOME, 'https://jardins-fictifs.test/contact': SITE_CONTACT, 'https://jardins-fictifs.test/mentions-legales': SITE_LEGAL }), limiter: new RateLimiter(0) });
    const a = (await w.analyze('https://jardins-fictifs.test', { name: 'Jardins Fictifs du Val', tradeName: null, siren: '900000001', siret: '90000000100011', city: 'Rouen', postalCode: '76000' }))!;
    expect(a.verified).toBe(true);
    expect(a.pages).toHaveLength(3);
    expect(a.phones.map((p) => p.e164)).toEqual(['+33235000001', '+33612000001', '+33235000009']);
    expect(a.socials.facebook).toBe('https://www.facebook.com/jardinsfictifs');
  });

  it('recherche du site : un domaine plausible n’est retenu que si son contenu correspond à l’entreprise', async () => {
    const other = '<html>Jardins Fictifs du Val — une autre entreprise à Lyon</html>';
    const w = new WebsiteProvider('https://relais.test', { fetchImpl: proxyFetch({ 'https://jardins-fictifs-val.fr': other, 'https://jardinsfictifsval.fr': SITE_LEGAL }), limiter: new RateLimiter(0) });
    const found = await w.discover({ name: 'Jardins Fictifs du Val', tradeName: null, siren: '900000001', siret: null, city: 'Rouen', postalCode: '76000' });
    expect(found?.url).toBe('https://jardinsfictifsval.fr');
    const none = new WebsiteProvider('https://relais.test', { fetchImpl: proxyFetch({ 'https://jardins-fictifs-val.fr': other }), limiter: new RateLimiter(0) });
    expect(await none.discover({ name: 'Jardins Fictifs du Val', tradeName: null, siren: '900000001', siret: null, city: 'Rouen', postalCode: '76000' })).toBeNull();
    expect(new WebsiteProvider('').enabled).toBe(false);
  });

  it('groupe multi-agences : seuls le numéro et l’e-mail de l’agence de la commune sont retenus', async () => {
    const agency = (city: string, cp: string, tel: string, mail: string) =>
      `<div><h3>Agence ${city}</h3><p>Zone artisanale, ${cp} ${city}</p><a href="tel:${tel}">${tel}</a> <a href="mailto:${mail}">${mail}</a></div>`;
    const list = `<html><h1>Nos agences — Groupe Vert Fictif, SIREN 900 000 002</h1>${[
      agency('Lille', '59000', '0320000001', 'agence.lille@vertfictif.test'),
      agency('Lyon', '69000', '0478000001', 'agence.lyon@vertfictif.test'),
      agency('La Rochelle', '17000', '0546000001', 'agence.larochelle@vertfictif.test'),
      agency('Nice', '06000', '0492000001', 'agence.nice@vertfictif.test'),
      agency('Rennes', '35000', '0299000001', 'agence.rennes@vertfictif.test'),
    ].join('\n<hr>')}<p>Encodé : t\\u00e9l\\u00e9phone\\u00e9@vertfictif.test</p></html>`;
    const w = new WebsiteProvider('https://relais.test', { fetchImpl: proxyFetch({ 'https://vertfictif.test': list }), limiter: new RateLimiter(0) });
    const a = (await w.analyze('https://vertfictif.test', { name: 'Groupe Vert Fictif', tradeName: null, siren: '900000002', siret: null, city: 'La Rochelle', postalCode: '17000' }))!;
    expect(a.verified).toBe(true);
    expect(a.phones.map((p) => p.e164)).toEqual(['+33546000001']);
    expect(a.phones[0]!.listed).toBe(true);
    expect(a.emails.map((e) => e.email)).toEqual(['agence.larochelle@vertfictif.test']);
    expect(a.ignoredListed).toBe(8);
    // Mentions légales : numéros de l'hébergeur et du webmaster écartés ; e-mail d'un thème WordPress écarté
    const legal = `<html><h1>Mentions légales</h1><p>Jardins Test, SIREN 900 000 003, 12 rue des Fleurs 33000 Bordeaux – Téléphone : 05 56 00 00 01</p>
      <p>Webmaster : Agence Pixel – 13120 Gardanne – Téléphone : 04 82 00 00 02</p><p>Hébergeur : O2 SWITCH, 63000 Clermont-Ferrand – Téléphone : 04 44 00 00 03 – support@o2switch.test</p>
      <a href="mailto:office@evergreen.test">office@evergreen.test</a> <a href="mailto:contact@jardins-test.fr">contact@jardins-test.fr</a> jardinstest@gmail.com</html>`;
    const lw = new WebsiteProvider('https://relais.test', { fetchImpl: proxyFetch({ 'https://jardins-test.fr': legal }), limiter: new RateLimiter(0) });
    const l = (await lw.analyze('https://jardins-test.fr', { name: 'Jardins Test', tradeName: null, siren: '900000003', siret: null, city: 'Bordeaux', postalCode: '33000' }))!;
    expect(l.phones.map((p) => p.e164)).toEqual(['+33556000001']);
    expect(l.emails.map((e) => e.email).sort()).toEqual(['contact@jardins-test.fr', 'jardinstest@gmail.com']);
    expect(l.ignoredThirdParty).toBe(4);
    // C'est le dernier intitulé du bloc qui compte
    const ctx = (s: string) => ({ text: s, at: s.length });
    expect(isThirdPartyContact(ctx('Hébergeur : OVH, Roubaix. Éditeur : Jardins Test – Tél : '))).toBe(false);
    expect(isThirdPartyContact(ctx('Site réalisé par Agence Pixel – '))).toBe(true);
    expect(isThirdPartyContact(ctx('Hébergeur : OVH\nJardins Test – Tél : '))).toBe(false);
    // Aucun morceau d'adresse issu d'un texte encodé (« u00e9@… »)
    expect(extractEmails('<p>t\\u00e9l\\u00e9phone\\u00e9@vertfictif.test</p>').map((e) => e.email)).toEqual([]);
  });
});

describe('Relais web (Cloudflare Worker)', () => {
  const call = (url: string, fetchImpl: (u: string) => Promise<Response>, env = {}) =>
    proxyHandle(new Request(`https://relais.test/?url=${encodeURIComponent(url)}`, { headers: { Origin: 'https://addegrieck-lgtm.github.io' } }), env, fetchImpl as typeof fetch).then((r: Response) => r.json());

  it('refuse moteurs de recherche, annuaires, réseaux sociaux, adresses privées', async () => {
    const f = vi.fn();
    for (const u of ['https://www.google.com/search?q=x', 'https://www.pagesjaunes.fr/x', 'https://www.facebook.com/x', 'http://127.0.0.1/admin', 'http://192.168.1.1']) {
      expect((await call(u, f)).ok).toBe(false);
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('respecte robots.txt ; renvoie le HTML d’une page autorisée ; origines limitées', async () => {
    const f = vi.fn(async (u: string) =>
      u.endsWith('/robots.txt')
        ? new Response('User-agent: *\nDisallow: /prive', { status: 200 })
        : new Response('<html>Contact 02 35 00 00 01</html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    );
    expect(await call('https://site.test/prive/page', f)).toMatchObject({ ok: false, status: 403 });
    expect(await call('https://site.test/contact', f)).toMatchObject({ ok: true, html: '<html>Contact 02 35 00 00 01</html>' });
    expect((await call('https://site.test/contact', f, { ALLOWED_ORIGINS: 'https://autre.test' })).ok).toBe(false);
  });
});

describe('OpenStreetMap (annuaire public)', () => {
  const places = parseOverpass(OSM);
  const target = { name: 'Jardins Fictifs du Val', tradeName: null, siret: null, siren: null, postalCode: '76000', city: 'Rouen', address: null, latitude: null, longitude: null };

  it('lecture : téléphones multiples, SIRET, adresse ; lieux sans nom ignorés', () => {
    expect(places).toHaveLength(4);
    expect(places[1]!.phones).toEqual(['02 35 00 00 02', '06 00 00 00 02']);
    expect(places[0]).toMatchObject({ siret: '90000000100011', postcode: '76000', url: 'https://www.openstreetmap.org/node/1' });
  });

  it('rapprochement par SIRET (sûr), par nom + localisation (probable), jamais si ambigu ou SIRET différent', () => {
    expect(matchPlace(places, { ...target, siret: '90000000100011', name: 'Autre libellé' })).toMatchObject({ sure: true, matched: expect.arrayContaining(['siret', 'postalCode']) });
    expect(matchPlace(places, target)).toMatchObject({ sure: false, matched: expect.arrayContaining(['name', 'postalCode', 'city']) });
    expect(matchPlace(places, { ...target, city: 'Lille', postalCode: '59000' })).toBeNull();
    expect(matchPlace(places, { ...target, siret: '11111111100011' })).toBeNull();
    const twins = parseOverpass({ elements: [...OSM.elements, { type: 'node', id: 9, lat: 49.44, lon: 1.09, tags: { name: 'Jardins Fictifs du Val', phone: '0235999999', 'addr:city': 'Rouen' } }] });
    expect(matchPlace(twins, target)).toBeNull();
  });

  it('une seule requête pour toute la France, puis cache', async () => {
    const f = vi.fn(async (): Promise<HttpResponse> => ({ ok: true, status: 200, json: async () => OSM }));
    const cache = memoryCache();
    const osm = new OpenStreetMapProvider({ fetchImpl: f, cache, limiter: new RateLimiter(0) });
    await osm.match(target);
    await osm.match({ ...target, name: 'Vert Horizon', city: 'Marseille', postalCode: null });
    expect(f).toHaveBeenCalledTimes(1);
    await new OpenStreetMapProvider({ fetchImpl: f, cache, limiter: new RateLimiter(0) }).load();
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('Coordonnées multi-sources (company_phones)', () => {
  it('plusieurs numéros sans écrasement, principal, numéro partagé, saisie manuelle prioritaire', async () => {
    const { api } = await setup();
    const a = await api.createProspect({ name: 'A', phone: '0235000001' }, 'csv');
    const b = await api.createProspect({ name: 'B' });
    const { prospect: b2 } = await api.mergeContacts(b, { phones: [] });
    expect(b2.phone).toBeNull();
    // Même numéro trouvé chez B → « ⚠ Numéro partagé » chez les deux, confiance réduite
    const osmEvidence = { kind: 'directory' as const, provider: 'OpenStreetMap', url: 'https://osm/1', at: 'now', matched: ['name', 'city'] };
    const { newPhone } = await import('../src/domain/contactSync');
    const { prospect: b3, contacts } = await api.mergeContacts(b, { phones: [newPhone(b, '+33 2 35 00 00 01', osmEvidence, 'now')!] });
    expect(contacts.phones[0]).toMatchObject({ shared: true, confidence: 35, status: 'unverified' });
    expect(b3.phone).toBeNull(); // non vérifié : pas promu en principal
    const aContacts = await api.contactsFor(a.id);
    expect(aContacts.phones[0]!.shared).toBe(true);
    // Saisie manuelle : devient principale, jamais remplacée
    const edited = await api.updateProspect(a.id, { phone: '0612345678' });
    expect(edited.phone).toBe('0612345678');
    const list = (await api.contactsFor(a.id)).phones;
    expect(list.map((p) => [p.display, p.role, p.manual])).toEqual([
      ['06 12 34 56 78', 'primary', true],
      ['02 35 00 00 01', 'secondary', false],
    ]);
    // Écarter / valider
    const ph = list.find((p) => p.display === '02 35 00 00 01')!;
    await api.rejectContact('phone', ph.id);
    expect((await api.contactsFor(a.id)).phones.find((p) => p.id === ph.id)!.status).toBe('rejected');
    const added = await api.addManualContact(b.id, 'phone', '02 32 00 00 00');
    expect(added).toMatchObject({ phone: '0232000000', phoneConfidence: 100, phoneStatus: 'verified' });
    await expect(api.addManualContact(b.id, 'phone', '123')).rejects.toThrow(/invalide/);
  });

  it('export : téléphone principal, secondaires, confiance, source', async () => {
    const { api } = await setup();
    const a = await api.createProspect({ name: 'A', phone: '0235000001' });
    await api.addManualContact(a.id, 'phone', '0612000001');
    const csv = parseCsv(await exportProspectsCsv(api, [a.id]));
    const row = csv.rows[0]!;
    const col = (h: string) => row[csv.headers.indexOf(h)];
    expect(col('Téléphone principal')).toBe('02 35 00 00 01');
    expect(col('Téléphones secondaires')).toBe('06 12 00 00 01 (mobile, 100 %)');
    expect(col('Confiance téléphone')).toBe('100 %');
    expect(col('Source téléphone')).toContain('Saisie manuelle');
  });
});

describe('EnrichmentEngine (parcours complet)', () => {
  function engineFor(api: ProspectsApi, withSite = true) {
    const official = new RechercheEntreprisesProvider({ fetchImpl: officialFetch, cache: memoryCache(), ...noWait });
    const directory = new OpenStreetMapProvider({ fetchImpl: async () => ({ ok: true, status: 200, json: async () => OSM }), cache: memoryCache(), limiter: new RateLimiter(0) });
    const website = new WebsiteProvider(withSite ? 'https://relais.test' : '', {
      fetchImpl: proxyFetch({ 'https://jardins-fictifs.test': SITE_HOME, 'https://jardins-fictifs.test/contact': SITE_CONTACT, 'https://jardins-fictifs.test/mentions-legales': SITE_LEGAL }),
      limiter: new RateLimiter(0),
    });
    return new EnrichmentEngine(api, { official, directory, website });
  }

  it('administratif → annuaire → site officiel → vérification → score → CRM automatique', async () => {
    const { api } = await setup();
    const s = await api.getSettings();
    await api.saveSettings({ ...s, autoQualify: true });
    const p = await api.createProspect({ name: 'Jardins Fictifs du Val', siret: '90000000100011' });
    const r = await engineFor(api).enrichCompany(p.id);
    expect(r.steps).toEqual(expect.arrayContaining(['Administratif', 'Annuaire public (OpenStreetMap)', 'Site officiel', 'Normalisation et vérification des coordonnées', 'Score']));
    const after = (await api.getProspect(p.id))!;
    expect(after).toMatchObject({ phone: '0235000001', phoneStatus: 'verified', email: 'contact@jardins-fictifs.test', website: 'https://jardins-fictifs.test', websiteVerified: true, facebook: 'https://www.facebook.com/jardinsfictifs', status: 'to_contact' });
    expect(after.qualifiedAt).not.toBeNull();
    const c = await api.contactsFor(p.id);
    const main = c.phones.find((x) => x.isPrimary)!;
    expect(main.evidence.map((e) => e.provider).sort()).toEqual(['OpenStreetMap', 'Site officiel']);
    expect(main.confidence).toBeGreaterThanOrEqual(95);
    expect(c.phones.map((x) => x.role).sort()).toEqual(['fax', 'mobile', 'primary']);
    // e-mail nominatif hors lien mailto : non retenu (donnée personnelle)
    expect(c.emails.map((e) => e.value)).toEqual(['contact@jardins-fictifs.test']);
    expect(r.found).toMatchObject({ phones: 3, emails: 1, websites: 1 });
    expect(r.found.bySource['Site officiel']).toBeGreaterThan(0);
    const logs = await api.allEnrichmentLogs();
    expect(logs.find((l) => l.provider === 'moteur')).toMatchObject({ status: 'enriched', found: { phones: 3 } });
    // Cache : pas de nouvelle recherche de coordonnées ; « Maximiser » la force
    expect((await engineFor(api).enrichCompany(p.id)).steps).toContain('Coordonnées (récentes, conservées)');
    expect((await engineFor(api).enrichCompany(p.id, { maxPhones: true })).steps).toContain('Site officiel');
  });

  it('sans relais web ni correspondance : rien n’est inventé', async () => {
    const { api } = await setup();
    const p = await api.createProspect({ name: 'Entreprise Inconnue', postalCode: '33000' });
    const r = await engineFor(api, false).enrichCompany(p.id);
    const after = (await api.getProspect(p.id))!;
    expect(after.phone).toBeNull();
    expect(after.email).toBeNull();
    expect(after.website).toBeNull();
    expect(r.found.phones).toBe(0);
    expect(r.steps).not.toContain('Site officiel');
  });

  it('une saisie manuelle n’est jamais remplacée par un numéro trouvé', async () => {
    const { api } = await setup();
    const p = await api.createProspect({ name: 'Jardins Fictifs du Val', siret: '90000000100011', phone: '0699999999' });
    await engineFor(api).enrichCompany(p.id);
    const after = (await api.getProspect(p.id))!;
    expect(after.phone).toBe('0699999999');
    expect(after.fieldSources.phone?.type).toBe('manual');
    expect((await api.contactsFor(p.id)).phones.length).toBeGreaterThan(1);
  });

  it('file : erreur temporaire → next_retry_at, puis succès', async () => {
    const { api } = await setup();
    const p = await api.createProspect({ name: 'X', siret: '90000000100011' });
    let calls = 0;
    const flaky = vi.fn(async (): Promise<HttpResponse> => (++calls === 1 ? { ok: false, status: 503, json: async () => ({}) } : { ok: true, status: 200, json: async () => ({ results: [apiCompany()], total_results: 1, page: 1, per_page: 25, total_pages: 1 }) }));
    const engine = new EnrichmentEngine(api, { official: new RechercheEntreprisesProvider({ fetchImpl: flaky, retries: 0, ...noWait }) });
    const queue = new EnrichmentQueue(api, engine);
    queue.retryDelayMs = () => 50;
    await api.enqueueEnrichment([p.id]);
    // Tous les états enregistrés (indépendant de la vitesse de la machine)
    const saved: (string | null)[] = [];
    const save = api.saveJob.bind(api);
    api.saveJob = async (job) => {
      saved.push(job.nextRetryAt ?? null);
      return save(job);
    };
    await queue.start();
    expect(saved.some((d) => d !== null)).toBe(true);
    expect((await api.queueJobs())[0]).toMatchObject({ status: 'completed', attempts: 2, error: null });
  });
});

describe('ProspectingSearchEngine', () => {
  it('recherche → normalisation → déduplication → file d’enrichissement', async () => {
    const { api } = await setup();
    const sireneFetch = vi.fn(async (): Promise<HttpResponse> => ({ ok: true, status: 200, json: async () => ({ results: [apiCompany()], total_results: 1, page: 1, per_page: 25, total_pages: 1 }) }));
    const { SireneProvider } = await import('../src/providers/company/SireneProvider');
    const official = new RechercheEntreprisesProvider({ fetchImpl: officialFetch, ...noWait });
    const added: string[][] = [];
    const fakeQueue = { add: async (ids: string[]) => (added.push(ids), ids.length) } as unknown as EnrichmentQueue;
    const engine = new ProspectingSearchEngine(api, official, fakeQueue, new SireneProvider({ fetchImpl: sireneFetch, minDelayMs: 0, wait: async () => undefined }));
    const req = { activity: { mode: 'landscaper' as const, nafCodes: [] }, zone: { kind: 'department' as const, value: '76' }, activeOnly: true, relevantOnly: true, establishmentType: 'all' as const, headcountBuckets: ['1-5'], excludeIndividuals: false, enrichAfter: true, maxPhones: true };
    const r = await engine.run(req);
    expect(r.report).toMatchObject({ added: 1 });
    expect(added[0]).toHaveLength(1);
    const again = await engine.run(req);
    expect(again.report).toMatchObject({ added: 0, duplicates: 1 });
    // Tranche d'effectif non retenue → exclu
    const none = await engine.run({ ...req, headcountBuckets: ['50+'] });
    expect(none.report.total).toBe(0);
  });
});
