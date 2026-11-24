// Enrichissement : diagnostic du site, fiches Google, recherche web (relais), pages sociales, instantané OSM local.
// Données SYNTHÉTIQUES uniquement (entreprises et coordonnées fictives).
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { assessSite, copyrightYear } from '../src/domain/siteQuality';
import { matchGooglePlace, GooglePlacesProvider, type GooglePlace } from '../src/providers/company/GooglePlacesProvider';
import { RelaySearchProvider } from '../src/providers/search/RelaySearchProvider';
import { WebsiteProvider } from '../src/providers/company/WebsiteProvider';
import { RechercheEntreprisesProvider } from '../src/providers/company/RechercheEntreprisesProvider';
import { localBusinessQuery } from '../src/providers/company/OpenStreetMapProvider';
import { localBusinessQuery as scriptQuery } from '../scripts/osm-local-query.mjs';
import { RateLimiter, type HttpResponse } from '../src/providers/http';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi } from '../src/data/repository';
import { EnrichmentEngine } from '../src/data/enrichmentEngine';
import { memoryCache } from '../src/data/cache';
import { computeScore } from '../src/domain/scoring';
import { matchesFilter } from '../src/domain/filters';
import { toRow } from '../src/domain/prospect';
import { AGENCE_WORKSPACE } from '../src/domain/offers';
import type { WebSearchProvider } from '../src/providers/search/WebSearchProvider';
import { handle } from '../worker/web-proxy.js';

const NOW = new Date('2026-10-24T10:00:00Z');

describe('Diagnostic du site (site à moderniser ?)', () => {
  it('site récent : HTTPS, adapté au téléphone, copyright à jour', () => {
    const q = assessSite('<html><head><meta name="viewport" content="width=device-width"></head><body>© 2025 Le Comptoir</body></html>', 'https://lecomptoir.fr/', NOW);
    expect(q).toMatchObject({ https: true, mobile: true, copyrightYear: 2025, weak: false, reasons: [] });
  });

  it('site ancien : constats en clair', () => {
    const q = assessSite('<html><body><font face="Arial">Bienvenue</font> Copyright &copy; 2011-2016 Elec 76</body></html>', 'http://elec76.fr/', NOW);
    expect(q.weak).toBe(true);
    expect(q.reasons).toEqual(['pas de HTTPS', 'pas adapté au téléphone', 'copyright 2016', 'technologie dépassée']);
  });

  it('site gratuit sans nom de domaine propre, constructeur relevé', () => {
    const q = assessSite('<html><head><meta name="viewport" content="x"><script src="https://static.wixstatic.com/x.js"></script></head></html>', 'https://monresto.wixsite.com/accueil', NOW);
    expect(q.builder).toBe('Wix');
    expect(q.freeHost).toBe(true);
    expect(q.reasons).toEqual(['site gratuit sans nom de domaine propre']);
  });

  it('année de copyright : la plus récente, jamais dans le futur', () => {
    expect(copyrightYear('Copyright 2012 - 2019', NOW)).toBe(2019);
    expect(copyrightYear('© 2031 test', NOW)).toBeNull();
    expect(copyrightYear('aucune mention', NOW)).toBeNull();
  });
});

const place = (o: Partial<GooglePlace>): GooglePlace => ({ id: 'p1', name: 'Le Comptoir du Port', address: '3 quai Bérigny, 76400 Fécamp, France', phone: '02 35 00 00 07', website: null, rating: 4.6, reviews: 6, mapsUrl: 'https://maps.google.com/?cid=1', status: 'OPERATIONAL', category: 'Restaurant', lat: null, lon: null, ...o });
const target = { name: 'LE COMPTOIR DU PORT', tradeName: null, city: 'Fécamp', postalCode: '76400' };

describe('Fiches Google : rapprochement prudent', () => {
  it('nom proche + même code postal / commune → retenue', () => {
    expect(matchGooglePlace([place({})], target)?.matched).toEqual(['name', 'postalCode', 'city']);
  });
  it('homonyme d’une autre ville → aucune fiche ; deux fiches équivalentes → ambigu', () => {
    expect(matchGooglePlace([place({ address: '1 rue X, 69000 Lyon' })], target)).toBeNull();
    expect(matchGooglePlace([place({ id: 'a' }), place({ id: 'b' })], target)).toBeUndefined();
  });
});

// ─── Relais : /search et /places ───

const ORIGIN = 'https://addegrieck-lgtm.github.io';
const relayGet = (path: string, env: Record<string, unknown>, fetchImpl: typeof fetch) => handle(new Request(`https://relais.test${path}`, { headers: { Origin: ORIGIN } }), { ALLOWED_ORIGINS: ORIGIN, ...env }, fetchImpl);

describe('Relais : services facultatifs', () => {
  it('sans clé : « not_configured », sans appel extérieur', async () => {
    const f = vi.fn();
    for (const path of ['/search?q=a', '/places?q=a']) {
      const r = await (await relayGet(path, {}, f as unknown as typeof fetch)).json();
      expect(r).toMatchObject({ ok: false, code: 'not_configured' });
    }
    expect(f).not.toHaveBeenCalled();
    const forbidden = await handle(new Request('https://relais.test/search?q=a', { headers: { Origin: 'https://pirate.test' } }), { ALLOWED_ORIGINS: ORIGIN, BRAVE_SEARCH_KEY: 'k' }, f as unknown as typeof fetch);
    expect(forbidden.status).toBe(403);
  });

  it('/search : API Brave Search avec la clé du relais, balises retirées', async () => {
    const f = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toContain('api.search.brave.com');
      expect(url).toContain('q=Elec%2076%20Bolbec');
      expect((init.headers as Record<string, string>)['X-Subscription-Token']).toBe('cle-brave');
      return new Response(JSON.stringify({ web: { results: [{ title: '<strong>Elec 76</strong>', url: 'https://elec76.fr/', description: 'Électricien à <strong>Bolbec</strong>' }] } }), { status: 200 });
    });
    const r = await (await relayGet('/search?q=Elec%2076%20Bolbec', { BRAVE_SEARCH_KEY: 'cle-brave' }, f as unknown as typeof fetch)).json();
    expect(r).toEqual({ ok: true, results: [{ title: 'Elec 76', url: 'https://elec76.fr/', snippet: 'Électricien à Bolbec' }] });
    const quota = await (await relayGet('/search?q=x', { BRAVE_SEARCH_KEY: 'k' }, (async () => new Response('', { status: 429 })) as unknown as typeof fetch)).json();
    expect(quota).toMatchObject({ ok: false, code: 'quota' });
  });

  it('/places : API Google Places (Text Search), champs limités', async () => {
    const f = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://places.googleapis.com/v1/places:searchText');
      const h = init.headers as Record<string, string>;
      expect(h['X-Goog-Api-Key']).toBe('cle-google');
      expect(h['X-Goog-FieldMask']).toContain('places.userRatingCount');
      expect(JSON.parse(String(init.body))).toMatchObject({ textQuery: 'Le Comptoir 76400 Fécamp', regionCode: 'FR' });
      return new Response(JSON.stringify({ places: [{ id: 'abc', displayName: { text: 'Le Comptoir' }, formattedAddress: '76400 Fécamp', rating: 4.5, userRatingCount: 12, googleMapsUri: 'https://maps.google.com/?cid=9' }] }), { status: 200 });
    });
    const r = await (await relayGet(`/places?q=${encodeURIComponent('Le Comptoir 76400 Fécamp')}`, { GOOGLE_PLACES_KEY: 'cle-google' }, f as unknown as typeof fetch)).json();
    expect(r.places[0]).toMatchObject({ id: 'abc', name: 'Le Comptoir', rating: 4.5, reviews: 12, phone: null, website: null });
  });
});

describe('Application : services du relais', () => {
  it('clé absente côté relais → service désactivé pour la session', async () => {
    const f = vi.fn(async (): Promise<HttpResponse> => ({ ok: true, status: 200, json: async () => ({ ok: false, code: 'not_configured', error: 'Recherche web non configurée sur le relais' }) }));
    const s = new RelaySearchProvider('https://relais.test', { fetchImpl: f });
    expect(s.enabled).toBe(true);
    await expect(s.search('x')).rejects.toThrow();
    expect(s.enabled).toBe(false);
    expect(s.service.configured).toBe(false);
    expect(new RelaySearchProvider('').enabled).toBe(false);
  });
});

// ─── Moteur : fiche Google + site + pages sociales ───

const HOME = `<html><body><h1>Le Comptoir du Port</h1><p>Restaurant — 3 quai Bérigny, 76400 Fécamp</p>
<a href="/contact">Contact</a><p>Réservations : <a href="tel:+33235000007">02 35 00 00 07</a></p><p>© 2017 Le Comptoir du Port</p></body></html>`;
const CONTACT = `<html><body>Écrivez-nous : <a href="mailto:contact@comptoir-fictif.fr">contact@comptoir-fictif.fr</a></body></html>`;

function relayFetch(places: GooglePlace[], pages: Record<string, string>) {
  return vi.fn(async (url: string): Promise<HttpResponse> => {
    const u = new URL(url);
    if (u.pathname === '/places') return { ok: true, status: 200, json: async () => ({ ok: true, places }) };
    const t = u.searchParams.get('url')!.replace(/\/$/, '');
    const html = pages[t];
    return { ok: true, status: 200, json: async () => (html ? { ok: true, status: 200, url: t, html } : { ok: false, status: 404, url: t, html: '' }) };
  });
}

let n = 0;
async function agencyApi() {
  const db = await openProspectingDB(`plus-${++n}-${Date.now()}`);
  const api = new ProspectsApi(db, { workspaceId: AGENCE_WORKSPACE, user: 'Adrien', role: 'owner' });
  const s = await api.getSettings();
  await api.saveSettings({ ...s, providers: { ...s.providers, official: false, directory: false } });
  return api;
}

function engineFor(api: ProspectsApi, fetchImpl: ReturnType<typeof relayFetch>, search: WebSearchProvider | null = null) {
  const official = new RechercheEntreprisesProvider({ fetchImpl: vi.fn(), cache: memoryCache(), limiter: new RateLimiter(0), wait: async () => undefined });
  const website = new WebsiteProvider('https://relais.test', { fetchImpl, limiter: new RateLimiter(0) });
  const places = new GooglePlacesProvider('https://relais.test', { fetchImpl });
  return new EnrichmentEngine(api, { official, directory: null, website, search, places });
}

const comptoir = { name: 'Le Comptoir du Port', nafCode: '56.10A', address: '3 quai Bérigny', postalCode: '76400', city: 'Fécamp', department: '76', active: true };

describe('Moteur : fiche Google, diagnostic du site, réseaux sociaux', () => {
  it('fiche Google → note, avis, lien ; son site est lu, vérifié et diagnostiqué', async () => {
    const api = await agencyApi();
    const p = await api.createProspect(comptoir);
    const f = relayFetch([place({ website: 'https://comptoir-fictif.fr/' })], { 'https://comptoir-fictif.fr': HOME, 'https://comptoir-fictif.fr/contact': CONTACT });
    const r = await engineFor(api, f).enrichCompany(p.id, { rng: () => 0.99 });
    const after = (await api.getProspect(p.id))!;
    expect(after).toMatchObject({ googlePlaceId: 'p1', googleReviews: 6, googleRating: 4.6, googleUrl: 'https://maps.google.com/?cid=1', googleCategory: 'Restaurant' });
    expect(after.googleCheckedAt).toBeTruthy();
    expect(after.website).toContain('comptoir-fictif.fr');
    expect(after.email).toBe('contact@comptoir-fictif.fr');
    expect(after.websiteQuality?.reasons).toEqual(['pas adapté au téléphone', 'copyright 2017']);
    expect(r.details.some((d) => d.startsWith('✓ Fiche Google : Le Comptoir du Port — 6 avis'))).toBe(true);
    const score = computeScore(after);
    expect(score.reasons.some((x) => x.label === 'Site à moderniser (pas adapté au téléphone, copyright 2017)')).toBe(true);
    expect(score.reasons.some((x) => x.label === "Peu d'avis Google (6)")).toBe(true);
    expect(matchesFilter(toRow(after), { weakSite: 'yes' })).toBe(true);
  });

  it('aucune fiche Google correspondante → constat daté « pas de fiche Google »', async () => {
    const api = await agencyApi();
    const p = await api.createProspect(comptoir);
    const r = await engineFor(api, relayFetch([place({ address: '1 rue X, 69000 Lyon' })], {})).enrichCompany(p.id, { mode: 'fast', rng: () => 0.99 });
    const after = (await api.getProspect(p.id))!;
    expect(after.googleCheckedAt).toBeTruthy();
    expect(after.googlePlaceId ?? null).toBeNull();
    expect(r.details).toContain('ℹ Aucune fiche Google trouvée pour cette entreprise');
    expect(computeScore(after).reasons.some((x) => x.label === 'Pas de fiche Google')).toBe(true);
  });

  it('recherche web : page Facebook au nom de l’entreprise retenue (lien seulement)', async () => {
    const api = await agencyApi();
    const p = await api.createProspect(comptoir);
    const search: WebSearchProvider = {
      id: 'test',
      label: 'test',
      enabled: true,
      search: async () => [
        { title: 'Le Comptoir du Port - Fécamp | Facebook', url: 'https://www.facebook.com/lecomptoirduport/', snippet: 'Restaurant à Fécamp' },
        { title: 'Autre restaurant | Instagram', url: 'https://www.instagram.com/autre/', snippet: '' },
      ],
    };
    await engineFor(api, relayFetch([], {}), search).enrichCompany(p.id, { mode: 'max', rng: () => 0.99 });
    const after = (await api.getProspect(p.id))!;
    expect(after.facebook).toBe('https://www.facebook.com/lecomptoirduport');
    expect(after.instagram).toBeNull();
  });
});

describe('Instantané OpenStreetMap local', () => {
  it('le script de mise en ligne et l’application utilisent la même requête', () => {
    expect(scriptQuery(['76'])).toBe(localBusinessQuery(['76']));
    expect(scriptQuery(['76', '27'])).toBe(localBusinessQuery(['76', '27']));
  });
});
