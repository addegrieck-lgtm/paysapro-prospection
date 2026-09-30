// Moteur auto-apprenant : identité et score de site, stratégies, apprentissage, orchestrateur, retours, historique.
// Données SYNTHÉTIQUES uniquement (entreprises et coordonnées fictives).
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { websiteMatchScore, bandOf, domainMatchesName } from '../src/domain/identity';
import { applyFeedback, chooseStrategy, emptyStat, estimate, LEARNING_CONFIG, segmentOf, type RunOutcome, applyRun, correctOf } from '../src/domain/learning';
import { STRATEGY_BY_ID, buildQuery, STRATEGIES } from '../src/domain/strategies';
import { domainCandidates, isCallContext, pageMentions } from '../src/domain/webContacts';
import { analyzeResult, FallbackSearchProvider, type WebSearchProvider } from '../src/providers/search/WebSearchProvider';
import { WebsiteProvider } from '../src/providers/company/WebsiteProvider';
import { RechercheEntreprisesProvider } from '../src/providers/company/RechercheEntreprisesProvider';
import { RateLimiter, type HttpResponse } from '../src/providers/http';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi } from '../src/data/repository';
import { EnrichmentEngine } from '../src/data/enrichmentEngine';
import { memoryCache } from '../src/data/cache';
import type { StrategyStat } from '../src/domain/types';

let n = 0;
async function setup() {
  const db = await openProspectingDB(`learning-${++n}-${Date.now()}`);
  return new ProspectsApi(db, { workspaceId: 'w1', user: 'Adrien', role: 'owner' });
}

const SEG = { sector: 'paysage', region: '28', size: '1-9' };
const exploit = () => 0.99; // jamais d'exploration
const explore = () => 0; // toujours l'exploration

function stat(strategyId: string, field: 'phone' | 'email' | 'website', o: Partial<StrategyStat>, seg = SEG): StrategyStat {
  return { ...emptyStat('w1', strategyId as never, field, seg, '2026-01-01T00:00:00Z'), ...o };
}

// Site fictif « Jardins Fictifs du Val », Rouen
const HOME = `<html><body><h1>Jardins Fictifs du Val</h1><p>Paysagiste — 12 rue des Lilas, 76000 Rouen</p>
<a href="/contact">Contact</a> <a href="/mentions-legales">Mentions légales</a> <a href="/devis">Devis gratuit</a>
<p>Appelez-nous : <a href="tel:+33235000001">02 35 00 00 01</a></p></body></html>`;
const CONTACT = `<html><body>Écrivez-nous : <a href="mailto:contact@jardins-fictifs-val.fr">contact@jardins-fictifs-val.fr</a></body></html>`;
const LEGAL = `<html><body>SARL Jardins Fictifs du Val — SIRET 900 000 001 00011 — Hébergeur : Hébergeur Fictif, Tél : 04 00 00 00 99</body></html>`;
const DEVIS = `<html><body>Demande de devis — Mobile du gérant : 06 12 00 00 01</body></html>`;
const HOMONYM = `<html><body><h1>Jardins Fictifs du Val</h1><p>Paysagiste à Lyon (69000) — Tél 04 72 00 00 00</p></body></html>`;

function proxyFetch(pages: Record<string, string>, fail: string[] = []) {
  return vi.fn(async (url: string): Promise<HttpResponse> => {
    const target = new URL(url).searchParams.get('url')!.replace(/\/$/, '');
    if (fail.some((f) => target.startsWith(f))) throw new TypeError('network down');
    const html = pages[target];
    return { ok: true, status: 200, json: async () => (html ? { ok: true, status: 200, url: target, html } : { ok: false, status: 404, url: target, html: '' }) };
  });
}

const SITE = { 'https://jardins-fictifs-val.fr': HOME, 'https://jardins-fictifs-val.fr/contact': CONTACT, 'https://jardins-fictifs-val.fr/mentions-legales': LEGAL, 'https://jardins-fictifs-val.fr/devis': DEVIS };

const officialFetch = vi.fn(async (): Promise<HttpResponse> => ({ ok: true, status: 200, json: async () => ({ results: [], total_results: 0, page: 1, per_page: 25, total_pages: 0 }) }));

function engine(api: ProspectsApi, pages: Record<string, string> = SITE, extra: { search?: WebSearchProvider; fail?: string[] } = {}) {
  const official = new RechercheEntreprisesProvider({ fetchImpl: officialFetch, cache: memoryCache(), limiter: new RateLimiter(0), wait: async () => undefined });
  const website = new WebsiteProvider('https://relais.test', { fetchImpl: proxyFetch(pages, extra.fail), limiter: new RateLimiter(0) });
  return new EnrichmentEngine(api, { official, directory: null, website, search: extra.search ?? null });
}

async function company(api: ProspectsApi, o: Record<string, unknown> = {}) {
  const s = await api.getSettings();
  await api.saveSettings({ ...s, providers: { ...s.providers, official: false, directory: false } });
  return api.createProspect({ name: 'Jardins Fictifs du Val', siren: '900000001', nafCode: '81.30Z', address: '12 rue des Lilas', postalCode: '76000', city: 'Rouen', region: '28', ...o });
}

// ─────────────────────────────────────────────────────────────

describe('CompanyIdentityEngine : score de correspondance d’un site', () => {
  it('bonne entreprise (SIRET / nom + commune + rue) ≠ homonyme d’une autre ville', () => {
    const c = { name: 'Jardins Fictifs du Val', siren: '900000001', siret: '90000000100011', city: 'Rouen', postalCode: '76000', address: '12 rue des Lilas', nafCode: '81.30Z' };
    const good = websiteMatchScore({ ...pageMentions(HOME + LEGAL, c), domainMatchesName: true, knownPhone: false, legalPage: true });
    expect(good.score).toBe(100);
    expect(bandOf(good.score)).toBe('very_strong');
    const homonym = websiteMatchScore({ ...pageMentions(HOMONYM, c), domainMatchesName: true, knownPhone: false, legalPage: false });
    expect(homonym.accepted).toBe(false); // nom + activité + domaine, mais autre ville : jamais retenu
    expect(homonym.score).toBeLessThan(70);
    // Un nom seul ne suffit jamais, même avec tous les signaux « faibles »
    expect(websiteMatchScore({ siren: false, siret: false, name: true, city: false, postalCode: false, street: false, activity: true, domainMatchesName: true, knownPhone: false, legalPage: true }).accepted).toBe(false);
    expect(domainMatchesName('https://www.jardins-fictifs-val.fr', ['Jardins Fictifs du Val'])).toBe(true);
    expect(domainMatchesName('https://evergreen.test', ['Jardins Fictifs du Val'])).toBe(false);
  });

  it('contexte d’appel ; domaines plausibles par stratégie (jamais présentés comme trouvés)', () => {
    expect(isCallContext({ text: 'Appelez-nous : 02 35 00 00 01', at: 14 })).toBe(true);
    expect(isCallContext({ text: 'Notre partenaire 02 35 00 00 01', at: 17 })).toBe(false);
    expect(domainCandidates('name', { name: 'Jardins Fictifs du Val' })).toEqual(['jardins-fictifs-val.fr', 'jardinsfictifsval.fr', 'jardins-fictifs-val.com', 'jardinsfictifsval.com']);
    expect(domainCandidates('name_city', { name: 'Martin', city: 'Bolbec' })).toEqual(['martin-bolbec.fr', 'martinbolbec.fr']);
    expect(domainCandidates('activity', { name: 'Martin Frères' })).toContain('martin-freres-paysage.fr');
    expect(buildQuery(STRATEGY_BY_ID.get('web_name_city_02')!, { name: 'Martin', city: 'Bolbec', address: null, postalCode: '76210' })).toBe('"Martin" "Bolbec" "02"');
    expect(buildQuery(STRATEGY_BY_ID.get('web_name_address')!, { name: 'Martin', city: 'Bolbec', address: null, postalCode: '76210' })).toBeNull();
  });
});

describe('StrategyLearningEngine', () => {
  const A = STRATEGY_BY_ID.get('domain_name')!;
  const B = STRATEGY_BY_ID.get('domain_trade')!;

  it('trouvé ≠ correct : 100 trouvés dont 40 faux → précision 60 %', () => {
    const s = stat('domain_name', 'phone', { attempts: 100, successes: 100, found: 100, verified: 100, falsePositive: 40, falsePositiveVerified: 40 });
    expect(correctOf(s)).toBe(60);
    const e = estimate([s], A, 'phone', SEG);
    expect(e.precision).toBeCloseTo((60 + A.prior.precision * LEARNING_CONFIG.priorWeight) / (100 + LEARNING_CONFIG.priorWeight), 5);
    expect(e.level).toBe('segment');
  });

  it('stratégie A (700 vérifiés / 1000) privilégiée sur B (300 / 1000), B reste testée par exploration', () => {
    const stats = [
      stat('domain_name', 'website', { attempts: 1000, successes: 700, found: 700, verified: 700 }),
      stat('domain_trade', 'website', { attempts: 1000, successes: 300, found: 300, verified: 300 }),
    ];
    expect(chooseStrategy([B, A], ['website'], stats, SEG, exploit)!.def.id).toBe('domain_name');
    // Exploration : la stratégie la moins essayée est testée
    const fresh = STRATEGY_BY_ID.get('domain_name_city')!;
    const c = chooseStrategy([A, B, fresh], ['website'], stats, SEG, explore)!;
    expect(c).toMatchObject({ explored: true });
    expect(c.def.id).toBe('domain_name_city');
  });

  it('segments : historique du segment précis, sinon du secteur, sinon a priori', () => {
    const other = { sector: 'paysage', region: '75', size: '10-49' };
    const stats = [stat('domain_name', 'website', { attempts: 50, successes: 40, found: 40, verified: 40 }, other)];
    expect(estimate(stats, A, 'website', SEG).level).toBe('secteur');
    expect(estimate([], A, 'website', SEG)).toMatchObject({ level: 'a priori', successRate: A.prior.success });
    expect(estimate(stats, A, 'website', { sector: 'automobile', region: '28', size: '0' }).level).toBe('global');
  });

  it('retours : confirmation, faux positif, changement d’avis sans double comptage', () => {
    let s = stat('site_known', 'phone', { found: 10, verified: 5 });
    s = applyFeedback(s, 'correct', 60);
    expect(s).toMatchObject({ confirmed: 1, confirmedLow: 1, falsePositive: 0 });
    s = applyFeedback(s, 'incorrect', 60, 'correct');
    expect(s).toMatchObject({ confirmed: 0, confirmedLow: 0, falsePositive: 1, falsePositiveVerified: 0 });
    s = applyFeedback(s, 'incorrect', 95);
    expect(s).toMatchObject({ falsePositive: 2, falsePositiveVerified: 1 });
    const m = new Map<string, StrategyStat>();
    const run: RunOutcome = { strategyId: 'site_known', targeted: ['phone', 'email'], produced: { phone: [95, 60] }, requests: 4, ms: 100 };
    applyRun(m, run, SEG, 'w1', 'now');
    expect([...m.values()].find((x) => x.field === 'phone')).toMatchObject({ attempts: 1, successes: 1, found: 2, verified: 1 });
    expect([...m.values()].find((x) => x.field === 'email')).toMatchObject({ attempts: 1, successes: 0, found: 0 });
  });

  it('segment d’une entreprise : secteur (NAF), région, taille', () => {
    expect(segmentOf({ nafCode: '81.30Z', region: '28', department: '76', headcount: null, headcountBand: '02' })).toEqual({ sector: 'paysage', region: '28', size: '1-9' });
    expect(segmentOf({ nafCode: '45.20A', region: null, department: '14', headcount: 60, headcountBand: null })).toEqual({ sector: 'automobile', region: 'dép. 14', size: '50+' });
  });
});

describe('EnrichmentOrchestrator', () => {
  it('entreprise sans site : découverte vérifiée, puis téléphone + e-mail ; hébergeur écarté', async () => {
    const api = await setup();
    const p = await company(api);
    const r = await engine(api).enrichCompany(p.id, { rng: exploit });
    expect(r.strategies![0]).toMatch(/^domain_/);
    const c = await api.contactsFor(p.id);
    expect(c.websites[0]).toMatchObject({ value: 'jardins-fictifs-val.fr', verified: true });
    expect(c.websites[0]!.matchScore).toBeGreaterThanOrEqual(95);
    const main = c.phones.find((x) => x.isPrimary)!;
    expect(main).toMatchObject({ value: '+33235000001', status: 'verified' });
    expect(main.evidence[0]).toMatchObject({ strategy: r.strategies![0], url: 'https://jardins-fictifs-val.fr' });
    expect(main.evidence[0]!.matched).toEqual(expect.arrayContaining(['siren', 'tel_link', 'call_context', 'address']));
    expect(c.phones.map((x) => x.value)).not.toContain('+33400000099'); // numéro de l'hébergeur
    expect(c.emails.map((x) => x.value)).toEqual(['contact@jardins-fictifs-val.fr']);
    // Traces et apprentissage
    const attempts = await api.attemptLogs(p.id);
    expect(attempts.length).toBe(r.strategies!.length);
    // Fixe (accueil) + mobile du gérant (page « devis ») ; pas le numéro de l'hébergeur
    expect(attempts.find((a) => a.strategyId === r.strategies![0])).toMatchObject({ phonesFound: 2, websitesFound: 1, error: null });
    const stats = await api.strategyStats();
    expect(stats.find((s) => s.strategyId === r.strategies![0] && s.field === 'website')).toMatchObject({ attempts: 1, successes: 1, sector: 'paysage', region: '28' });
  });

  it('enrichissement partiel : ne cherche que ce qui manque (site et téléphone connus → e-mail)', async () => {
    const api = await setup();
    const p = await company(api, { phone: '0235000001', website: 'https://jardins-fictifs-val.fr' });
    // Téléphone saisi à la main = 100 % : jamais recherché ; le site connu est lu pour l'e-mail
    const r = await engine(api).enrichCompany(p.id, { rng: exploit });
    expect(r.strategies).toEqual(['site_known']);
    expect(r.stoppedBy).toBe('complete');
    const attempt = (await api.attemptLogs(p.id))[0]!;
    expect(attempt.targeted).toEqual(['email']);
    expect((await api.getProspect(p.id))!.email).toBe('contact@jardins-fictifs-val.fr');
  });

  it('mode Maximum contact : exploration approfondie → mobile supplémentaire ; mode Rapide : budget réduit', async () => {
    const api = await setup();
    const p = await company(api, { website: 'https://jardins-fictifs-val.fr' });
    const r = await engine(api).enrichCompany(p.id, { mode: 'max', rng: exploit });
    expect(r.strategies).toEqual(expect.arrayContaining(['site_known', 'site_deep']));
    const phones = (await api.contactsFor(p.id)).phones.map((x) => x.value);
    expect(phones).toEqual(expect.arrayContaining(['+33235000001', '+33612000001']));
    const api2 = await setup();
    const q = await company(api2, { name: 'Entreprise Introuvable', siren: null });
    const fast = await engine(api2, {}).enrichCompany(q.id, { mode: 'fast', rng: exploit });
    expect(fast.strategies!.length).toBeLessThanOrEqual(3);
    expect((await api2.getProspect(q.id))!.phone).toBeNull(); // rien d'inventé
  });

  it('site « nom + département » (ex. clementpaysage76.fr) trouvé et vérifié par son contenu', async () => {
    expect(domainCandidates('name_dept', { name: 'Clement Paysage', department: '76' })).toEqual(['clementpaysage76.fr', 'clement-paysage-76.fr', 'clement-paysage76.fr', 'clementpaysage76.com']);
    expect(domainCandidates('name_dept', { name: 'BTP', department: '76' })).toEqual([]); // nom trop court
    expect(domainCandidates('name_dept', { name: 'Martin Jardins' })).toEqual([]); // département inconnu
    expect(domainCandidates('name_dept', { name: 'Martin Jardins', postalCode: '27100' })[0]).toBe('martinjardins27.fr');
    const home = `<html><h1>Clément Paysage</h1><p>Paysagiste à Dieppe (76200) — création et entretien d'espaces verts</p>
      <p>Appelez-nous : <a href="tel:0600000076">06 00 00 00 76</a> · <a href="mailto:contact@clementpaysage76.fr">contact@clementpaysage76.fr</a></p></html>`;
    const api = await setup();
    const p = await company(api, { name: 'CLEMENT PAYSAGE', siren: '890000000', address: '30 rue Fictive', postalCode: '76200', city: 'Dieppe', department: '76' });
    const r = await engine(api, { 'https://clementpaysage76.fr': home }).enrichCompany(p.id, { rng: exploit });
    expect(r.strategies).toContain('domain_name_dept');
    const c = await api.contactsFor(p.id);
    expect(c.websites[0]).toMatchObject({ value: 'clementpaysage76.fr', verified: true });
    expect(c.phones[0]).toMatchObject({ value: '+33600000076', status: 'verified' });
    expect(c.emails[0]!.value).toBe('contact@clementpaysage76.fr');
  });

  it('homonyme dans une autre ville : site refusé, aucune coordonnée attribuée', async () => {
    const api = await setup();
    const p = await company(api);
    await engine(api, { 'https://jardins-fictifs-val.fr': HOMONYM }).enrichCompany(p.id, { rng: exploit });
    const c = await api.contactsFor(p.id);
    expect(c.websites).toEqual([]);
    expect(c.phones).toEqual([]);
  });

  it('résilience : relais en panne → enrichissement partiel, jamais de plantage', async () => {
    const api = await setup();
    const p = await company(api, { website: 'https://jardins-fictifs-val.fr' });
    const r = await engine(api, SITE, { fail: ['https://'] }).enrichCompany(p.id, { rng: exploit });
    expect(r.outcome).toBe('partial');
    const attempts = await api.attemptLogs(p.id);
    expect(attempts.every((a) => a.error)).toBe(true);
    expect((await api.allEnrichmentLogs()).find((l) => l.provider === 'moteur')).toMatchObject({ status: 'partial' });
  });

  it('l’apprentissage change réellement l’ordre des recherches', async () => {
    const api = await setup();
    const p = await company(api, { tradeName: 'Val Vert Fictif' });
    // Historique : pour ce segment, le nom commercial marche très bien, la raison sociale jamais
    const db = (api as unknown as { db: import('../src/data/db').DB }).db;
    await db.put('enrichment_strategy_stats', stat('domain_trade', 'website', { attempts: 200, successes: 150, found: 150, verified: 150 }));
    await db.put('enrichment_strategy_stats', stat('domain_name', 'website', { attempts: 200, successes: 2, found: 2, verified: 1 }));
    const r = await engine(api, {}).enrichCompany(p.id, { rng: exploit });
    expect(r.strategies![0]).toBe('domain_trade');
  });

  it('recherche web (fournisseur autorisé facultatif) : trouve le site officiel, l’annuaire est ignoré', async () => {
    const results = [
      { title: 'Jardins Fictifs du Val - PagesJaunes', url: 'https://www.pagesjaunes.fr/pros/1', snippet: 'Jardins Fictifs du Val, Rouen. 02 35 00 00 01' },
      { title: 'Jardins Fictifs du Val — paysagiste à Rouen', url: 'https://www.jardins-fictifs-val.fr/', snippet: 'Aménagement de jardins à Rouen (76000)' },
    ];
    const search: WebSearchProvider = { id: 'fake', label: 'Recherche fictive', enabled: true, search: vi.fn(async () => results) };
    const analyzed = results.map((r) => analyzeResult(r, { name: 'Jardins Fictifs du Val', city: 'Rouen', postalCode: '76000' }));
    expect(analyzed[0]).toMatchObject({ isPotentialDirectory: true, isPotentialOfficialSite: false, phoneCandidates: ['+33235000001'] });
    expect(analyzed[1]).toMatchObject({ isPotentialOfficialSite: true, domain: 'jardins-fictifs-val.fr' });
    const api = await setup();
    const p = await company(api, { name: 'JFV SARL', tradeName: 'Jardins Fictifs du Val' });
    // Sans historique, on force l'usage des stratégies web en retirant les domaines devinés du choix
    const only = STRATEGIES.filter((s) => s.kind === 'web_search').map((s) => s.id);
    const e = engine(api, SITE, { search });
    const r = await e.enrichCompany(p.id, { rng: exploit, mode: 'normal' });
    expect(r.strategies!.some((s) => only.includes(s) || s.startsWith('domain_'))).toBe(true);
    expect((await api.contactsFor(p.id)).websites[0]?.value).toBe('jardins-fictifs-val.fr');
    // Repli : A en panne → B répond
    const failing: WebSearchProvider = { id: 'a', label: 'A', enabled: true, search: async () => Promise.reject(new Error('503')) };
    const fb = new FallbackSearchProvider([failing, search]);
    expect(await fb.search('x')).toHaveLength(2);
    expect(new FallbackSearchProvider([]).enabled).toBe(false);
  });
});

describe('Coller une fiche Google', () => {
  const PASTE = `Clément Paysage
4,9
(27)
Paysagiste
Adresse : 30 Rue Fictive, 76200 Dieppe
Horaires : Ouvert ⋅ Ferme à 18:00
Site Web : clementpaysage76.fr
Téléphone : 06 00 00 00 76
https://maps.app.goo.gl/AbCdEf123`;

  it('extraction (téléphone, site, note, avis, lien) et contrôle d’homonyme', async () => {
    const { parseGoogleCard, matchCard } = await import('../src/domain/googleCard');
    const c = parseGoogleCard(PASTE);
    expect(c).toMatchObject({ websites: ['clementpaysage76.fr'], emails: [], rating: 4.9, reviews: 27, googleUrl: 'https://maps.app.goo.gl/AbCdEf123' });
    expect(c.phones).toEqual([{ e164: '+33600000076', mobile: true }]);
    expect(parseGoogleCard('Jardins X · 4.6 ★★★★★ 1 204 avis · contact@jardins-x.fr · https://www.jardins-x.fr/ · https://facebook.com/jx')).toMatchObject({ rating: 4.6, reviews: 1204, emails: ['contact@jardins-x.fr'], websites: ['jardins-x.fr'], facebook: 'https://facebook.com/jx' });
    const who = { name: 'CLEMENT PAYSAGE', postalCode: '76200', city: 'Dieppe' };
    expect(matchCard(PASTE, who).verdict).toBe('match');
    // Homonyme de Faverolles (28) : jamais pris pour celui de Dieppe
    expect(matchCard('Paysage Clément\nZAC des Bouleaux, 28210 Faverolles\n02 00 00 00 28', who)).toMatchObject({ verdict: 'mismatch', otherPostalCodes: ['28210'] });
  });

  it('enregistrement comme saisie (100 %), puis le moteur lit le site pour trouver l’e-mail', async () => {
    const { parseGoogleCard } = await import('../src/domain/googleCard');
    const home = `<html><h1>Clément Paysage</h1><p>Paysagiste à Dieppe (76200)</p><p>Tél : <a href="tel:0600000076">06 00 00 00 76</a> · <a href="mailto:contact@clementpaysage76.fr">contact@clementpaysage76.fr</a></p></html>`;
    const api = await setup();
    const p = await company(api, { name: 'CLEMENT PAYSAGE', siren: '890000000', postalCode: '76200', city: 'Dieppe', department: '76' });
    const card = parseGoogleCard(PASTE);
    const after = await api.applyGoogleCard(p.id, { phones: card.phones.map((x) => x.e164), website: card.websites[0]!, emails: [], googleUrl: card.googleUrl, rating: card.rating, reviews: card.reviews, facebook: null, instagram: null });
    expect(after).toMatchObject({ phone: '0600000076', phoneConfidence: 100, googleRating: 4.9, googleReviews: 27, googleUrl: 'https://maps.app.goo.gl/AbCdEf123' });
    expect(after.fieldSources.googleRating?.provider).toBe('Fiche Google (collée par vous)');
    const r = await engine(api, { 'https://clementpaysage76.fr': home }).enrichCompany(p.id, { force: true, rng: exploit });
    expect(r.strategies).toEqual(['site_known']);
    const c = await api.contactsFor(p.id);
    expect(c.emails[0]).toMatchObject({ value: 'contact@clementpaysage76.fr', status: 'verified' });
    // Le téléphone collé est confirmé par le site (deux sources) et reste la saisie de l'utilisateur
    expect(c.phones[0]!.evidence.map((e) => e.provider).sort()).toEqual(['Fiche Google (collée par vous)', 'Site officiel']);
    expect(c.websites[0]).toMatchObject({ value: 'clementpaysage76.fr', manual: true });
  });
});

describe('Protection contre les doublons (site, e-mail)', () => {
  it('même SIRET = même entreprise ; même site / même e-mail = doublon potentiel ; plateforme partagée ignorée', async () => {
    const { DedupeIndex } = await import('../src/domain/dedupe');
    const base = { siret: null, siren: null, phone: null, city: null, address: null };
    const idx = new DedupeIndex([
      { id: 'a', ...base, siret: '90000000100011', name: 'Jardins A', website: 'https://www.jardins-a.fr/contact', email: 'contact@jardins-a.fr' },
      { id: 'b', ...base, name: 'Jardins B', website: 'https://www.facebook.com/jardinsb' },
    ]);
    expect(idx.find({ ...base, siret: '90000000100011', name: 'Autre nom' })).toMatchObject({ id: 'a', rule: 'siret', exact: true });
    expect(idx.find({ ...base, name: 'Paysages Martin', website: 'jardins-a.fr' })).toMatchObject({ id: 'a', rule: 'website', exact: false });
    expect(idx.find({ ...base, name: 'Paysages Martin', email: 'CONTACT@jardins-a.fr' })).toMatchObject({ id: 'a', rule: 'email', exact: false });
    expect(idx.find({ ...base, name: 'Paysages Martin', website: 'https://www.facebook.com/autre' })).toBeNull();
    // Deux SIREN différents : jamais rapprochés par le site
    expect(idx.find({ ...base, siren: '900000002', name: 'Paysages Martin', website: 'jardins-a.fr' })).toBeNull();
  });
});

describe('Retours, CRM et historique (bout en bout)', () => {
  it('entreprise → site → téléphone → e-mail → CRM → ✗ / ✓ → statistiques → correction manuelle → historique', async () => {
    const api = await setup();
    const p = await company(api);
    const r = await engine(api).enrichCompany(p.id, { rng: exploit });
    const strategy = r.strategies![0]!;
    let c = await api.contactsFor(p.id);
    const phone = c.phones.find((x) => x.isPrimary)!;
    // ✗ Incorrect → faux positif pour la stratégie, dans le segment de l'entreprise
    await api.contactFeedback('phone', phone.id, 'incorrect');
    let s = (await api.strategyStats()).find((x) => x.strategyId === strategy && x.field === 'phone')!;
    expect(s).toMatchObject({ falsePositive: 1, falsePositiveVerified: 1 });
    // Le numéro suivant (mobile du gérant, page « devis ») devient le principal ; l'ancien est conservé dans l'historique
    expect((await api.getProspect(p.id))!.phone).toBe('0612000001');
    expect((await api.contactHistory(p.id))[0]).toMatchObject({ field: 'phone', oldValue: '0235000001', newValue: '0612000001' });
    // ✓ Correct sur l'e-mail → confirmation (100 %)
    c = await api.contactsFor(p.id);
    await api.contactFeedback('email', c.emails[0]!.id, 'correct');
    expect((await api.contactsFor(p.id)).emails[0]).toMatchObject({ confidence: 100, feedback: 'correct', manual: true });
    s = (await api.strategyStats()).find((x) => x.strategyId === strategy && x.field === 'email')!;
    expect(s.confirmed).toBe(1);
    const fb = await api.feedbackList();
    expect(fb.map((f) => f.feedbackType).sort()).toEqual(['correct', 'incorrect']);
    expect(fb.find((f) => f.feedbackType === 'incorrect')).toMatchObject({ strategy, field: 'phone', origin: '✗ sur la fiche' });

    // Signal CRM : un site trouvé automatiquement, remplacé à la main → incorrect (règle explicite)
    await api.updateProspect(p.id, { website: 'https://autre-site-fictif.fr' });
    const site = (await api.contactsFor(p.id)).websites.find((x) => x.value === 'jardins-fictifs-val.fr')!;
    expect(site).toMatchObject({ status: 'rejected', feedback: 'incorrect' });
    expect((await api.contactHistory(p.id))[0]).toMatchObject({ field: 'website', reason: 'Correction manuelle', newValue: 'https://autre-site-fictif.fr' });
    // RGPD : suppression → retours, traces et historique supprimés ; statistiques agrégées conservées
    await api.deleteProspects([p.id]);
    expect(await api.feedbackList()).toEqual([]);
    expect(await api.attemptLogs()).toEqual([]);
    expect((await api.strategyStats()).length).toBeGreaterThan(0);
  });

  it('changement d’avis : ✗ puis ↺ Rétablir → faux positif annulé, coordonnée confirmée à 100 %', async () => {
    const api = await setup();
    const p = await company(api);
    const r = await engine(api).enrichCompany(p.id, { rng: exploit });
    const phone = (await api.contactsFor(p.id)).phones.find((x) => x.isPrimary)!;
    await api.contactFeedback('phone', phone.id, 'incorrect');
    await api.contactFeedback('phone', phone.id, 'correct');
    const s = (await api.strategyStats()).find((x) => x.strategyId === r.strategies![0] && x.field === 'phone')!;
    expect(s).toMatchObject({ falsePositive: 0, falsePositiveVerified: 0, confirmed: 1 });
    expect((await api.contactsFor(p.id)).phones.find((x) => x.id === phone.id)).toMatchObject({ confidence: 100, feedback: 'correct', status: 'verified' });
    expect((await api.feedbackList()).map((f) => f.feedbackType).sort()).toEqual(['correct', 'incorrect']);
  });

  it('réenrichissement : un numéro qui a disparu de sa page devient « ancien » (conservé, confiance −20)', async () => {
    const api = await setup();
    const p = await company(api, { website: 'https://jardins-fictifs-val.fr' });
    await engine(api).enrichCompany(p.id, { rng: exploit });
    const newHome = HOME.replace('<a href="tel:+33235000001">02 35 00 00 01</a>', '<a href="tel:+33235000077">02 35 00 00 77</a>');
    await engine(api, { ...SITE, 'https://jardins-fictifs-val.fr': newHome }).enrichCompany(p.id, { force: true, rng: exploit });
    const c = await api.contactsFor(p.id);
    const old = c.phones.find((x) => x.value === '+33235000001')!;
    const fresh = c.phones.find((x) => x.value === '+33235000077')!;
    expect(old.currency).toBe('historical');
    expect(old.confidence).toBeLessThan(fresh.confidence);
    expect(fresh.isPrimary).toBe(true);
    expect(old.lastCheckedAt).toBeTruthy();
    expect((await api.contactHistory(p.id))[0]).toMatchObject({ field: 'phone', oldValue: '0235000001', newValue: '0235000077' });
  });
});
