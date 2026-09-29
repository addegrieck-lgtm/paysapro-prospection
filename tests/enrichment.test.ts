import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { openDB } from 'idb';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi } from '../src/data/repository';
import { EnrichmentQueue } from '../src/data/enrichmentQueue';
import { EnrichmentEngine } from '../src/data/enrichmentEngine';
import { memoryCache } from '../src/data/cache';
import { RechercheEntreprisesProvider, nameSimilarity, type ApiEtablissement, type ApiUniteLegale } from '../src/providers/company/RechercheEntreprisesProvider';
import { RateLimiter, fetchJson, ProviderError, type HttpResponse } from '../src/providers/http';
import { csvProvider } from '../src/providers/company/CsvProvider';
import { toRow } from '../src/domain/prospect';

// ─── Fausse API (données SYNTHÉTIQUES, même forme que l'API réelle) ───

function etab(o: Partial<ApiEtablissement> & { siret: string }): ApiEtablissement {
  return {
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
    caractere_employeur: 'O',
    statut_diffusion_etablissement: 'O',
    ...o,
  };
}

function company(siren: string, name: string, over: Partial<ApiUniteLegale> = {}, e: Partial<ApiEtablissement> = {}): ApiUniteLegale {
  const siege = etab({ siret: `${siren}00011`, ...e });
  return {
    siren,
    nom_complet: name,
    nom_raison_sociale: name,
    nature_juridique: '5499',
    date_creation: '2019-03-01',
    etat_administratif: 'A',
    statut_diffusion: 'O',
    tranche_effectif_salarie: '02',
    categorie_entreprise: 'PME',
    nombre_etablissements_ouverts: 1,
    activite_principale: '81.30Z',
    siege,
    matching_etablissements: [siege],
    complements: { est_entrepreneur_individuel: false },
    ...over,
  };
}

const REGISTRY: ApiUniteLegale[] = [
  company('900000001', 'JARDINS FICTIFS DU VAL'),
  company('900000002', 'PAYSAGES TEST NORMANDIE', { date_creation: null }, { adresse: null, date_creation: null, code_postal: '76600', libelle_commune: 'LE HAVRE' }),
  company('900000003', 'VERT HORIZON', {}, { code_postal: '76100', libelle_commune: 'ROUEN' }),
  company('900000004', 'VERT HORIZON SERVICES', {}, { code_postal: '76100', libelle_commune: 'ROUEN' }),
  company('900000005', 'VERT HORIZON', {}, { code_postal: '76100', libelle_commune: 'ROUEN', adresse: '8 PLACE DU MARCHE 76100 ROUEN' }),
];

function fakeApi(registry = REGISTRY) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (url: string): Promise<HttpResponse> => {
    calls.push(url);
    const u = new URL(url);
    const q = (u.searchParams.get('q') ?? '').toLowerCase();
    const cp = u.searchParams.get('code_postal');
    let results = registry.filter((c) => {
      if (/^\d{14}$/.test(q)) return q.startsWith(c.siren);
      if (/^\d{9}$/.test(q)) return c.siren === q;
      return !q || c.nom_complet!.toLowerCase().includes(q);
    });
    if (cp) results = results.filter((c) => c.siege.code_postal === cp);
    return { ok: true, status: 200, json: async () => ({ results, total_results: results.length, page: 1, per_page: 25, total_pages: results.length ? 1 : 0 }) };
  });
  return { fetchImpl, calls };
}

const noWait = { limiter: new RateLimiter(0), wait: async () => undefined };

function provider(fetchImpl: ReturnType<typeof fakeApi>['fetchImpl'] | ((url: string) => Promise<HttpResponse>), cache = memoryCache()) {
  return new RechercheEntreprisesProvider({ fetchImpl, cache, baseUrl: 'https://api.test', ...noWait });
}

let n = 0;
async function setup(workspaceId = 'w1') {
  const db = await openProspectingDB(`enrich-${++n}-${Date.now()}`);
  return { db, api: new ProspectsApi(db, { workspaceId, user: 'Adrien', role: 'owner' }) };
}

// ─────────────────────────────────────────────────────────────

describe('Recherche d’entreprises', () => {
  it('par SIREN, SIRET, nom et code postal', async () => {
    const { fetchImpl, calls } = fakeApi();
    const p = provider(fetchImpl);
    expect((await p.getBySiren('900 000 001'))?.name).toBe('Jardins Fictifs du Val');
    const bySiret = await p.getBySiret('90000000100011');
    expect(bySiret?.establishment).toMatchObject({ siret: '90000000100011', isHeadOffice: true, city: 'Rouen', department: '76', headcountBand: '02', employer: true });
    const byName = await p.search({ q: 'vert horizon', postalCode: '76100', nafCodes: ['81.30Z'], activeOnly: true });
    expect(byName.companies.map((c) => c.siren)).toEqual(['900000003', '900000004', '900000005']);
    expect(calls.at(-1)).toContain('code_postal=76100');
    expect(calls.at(-1)).toContain('activite_principale=81.30Z');
    expect(calls.at(-1)).toContain('etat_administratif=A');
    expect(await p.getBySiren('123')).toBeNull();
  });

  it('similarité de noms robuste aux accents et formes juridiques', () => {
    expect(nameSimilarity('SARL Jardins du Val', 'jardins du val')).toBe(1);
    expect(nameSimilarity('Vert Horizon', 'Vert Horizon Services')).toBeCloseTo(2 / 3);
  });
});

describe('Enrichissement individuel', () => {
  it('entreprise complète : champs récupérés avec leur source, historique détaillé, données manuelles conservées', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    const created = await api.createProspect({ name: 'Mon libellé', siret: '90000000100011', phone: '0611111111', city: 'Ma ville' });
    const r = await api.enrichProspect(created.id, provider(fetchImpl));
    const p = (await api.getProspect(created.id))!;
    expect(r.application?.outcome).toBe('enriched');
    expect(p.enrichmentStatus).toBe('enriched');
    expect(p).toMatchObject({ siren: '900000001', nafCode: '81.30Z', address: '12 RUE DES LILAS', postalCode: '76000', active: true, headcountBand: '02', isHeadOffice: true, companyCategory: 'PME' });
    // Saisie manuelle jamais remplacée
    expect(p.name).toBe('Mon libellé');
    expect(p.city).toBe('Ma ville');
    expect(p.phone).toBe('0611111111');
    expect(p.fieldSources.address).toMatchObject({ type: 'official_api', provider: 'recherche-entreprises', confidence: 'high' });
    expect(p.fieldSources.city).toMatchObject({ type: 'manual' });
    expect(p.enrichedAt).not.toBeNull();
    const timeline = await api.timeline(created.id);
    const entry = timeline.find((a) => a.label === 'Enrichissement automatique')!;
    expect(entry.details).toEqual(expect.arrayContaining(['✓ SIREN récupéré', '✓ Adresse récupérée', '✓ Statut récupéré', '• Ville conservée (saisie manuelle)']));
    const logs = await api.enrichmentLogs(created.id);
    expect(logs[0]).toMatchObject({ provider: 'recherche-entreprises', status: 'enriched', error: null });
    expect(logs[0]!.fieldsUpdated).toEqual(expect.arrayContaining(['siren', 'address', 'nafCode']));
  });

  it('entreprise partiellement renseignée → « Partiellement enrichi »', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    const created = await api.createProspect({ name: 'X', siren: '900000002' });
    await api.enrichProspect(created.id, provider(fetchImpl));
    const p = (await api.getProspect(created.id))!;
    expect(p.enrichmentStatus).toBe('partial');
    expect(p.address).toBeNull(); // absent de la source : jamais inventé
  });

  it('entreprise introuvable → échec explicite, fiche conservée', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    const created = await api.createProspect({ name: 'Inconnue', siren: '111111111' });
    const r = await api.enrichProspect(created.id, provider(fetchImpl));
    expect(r.application?.outcome).toBe('not_found');
    const p = (await api.getProspect(created.id))!;
    expect(p).toMatchObject({ enrichmentStatus: 'failed', name: 'Inconnue' });
    expect(p.enrichmentError).toMatch(/Aucune entreprise/);
  });

  it('recherche par nom : correspondance unique acceptée (confiance moyenne), ambiguïté → choix de l’utilisateur', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    const prov = provider(fetchImpl);
    const unique = await api.createProspect({ name: 'Jardins Fictifs du Val', postalCode: '76000', city: 'Rouen' });
    await api.enrichProspect(unique.id, prov);
    const u = (await api.getProspect(unique.id))!;
    expect(u.siren).toBe('900000001');
    expect(u.fieldSources.siren?.confidence).toBe('medium');
    const amb = await api.createProspect({ name: 'Vert Horizon', postalCode: '76100' });
    const r = await api.enrichProspect(amb.id, prov);
    expect(r.outcome?.status).toBe('ambiguous');
    expect((await api.getProspect(amb.id))!.enrichmentStatus).toBe('failed');
    await api.chooseCompany(amb.id, '90000000300011', prov);
    expect((await api.getProspect(amb.id))!).toMatchObject({ siren: '900000003', enrichmentStatus: 'enriched' });
  });

  it('API indisponible (500) → message clair, sans erreur technique, relance possible', async () => {
    const { api } = await setup();
    const down = vi.fn(async (): Promise<HttpResponse> => ({ ok: false, status: 503, json: async () => ({}) }));
    const created = await api.createProspect({ name: 'X', siren: '900000001' });
    const r = await api.enrichProspect(created.id, new RechercheEntreprisesProvider({ fetchImpl: down, retries: 2, ...noWait }));
    expect(down).toHaveBeenCalledTimes(3);
    expect(r.error).toBe('Impossible de récupérer les données actuellement. Le prospect reste enregistré : vous pourrez relancer l’enrichissement plus tard.');
    expect((await api.getProspect(created.id))!.enrichmentStatus).toBe('failed');
    expect((await api.enrichmentLogs(created.id))[0]).toMatchObject({ status: 'failed', error: 'HTTP 503' });
  });

  it('API limitée (429) → attente puis nouvel essai réussi', async () => {
    const { fetchImpl } = fakeApi();
    let first = true;
    const limited = vi.fn(async (url: string): Promise<HttpResponse> => {
      if (first) {
        first = false;
        return { ok: false, status: 429, json: async () => ({}), headers: { get: () => '2' } };
      }
      return fetchImpl(url);
    });
    const waits: number[] = [];
    const data = await fetchJson<{ results: unknown[] }>('https://api.test/search?q=900000001', { fetchImpl: limited, limiter: new RateLimiter(0), wait: async (ms) => void waits.push(ms) });
    expect(data?.results).toHaveLength(1);
    expect(waits).toEqual([2000]); // Retry-After respecté
  });

  it('404 → introuvable ; timeout → nouvel essai ; nombre d’essais borné', async () => {
    expect(await fetchJson('https://x', { fetchImpl: async () => ({ ok: false, status: 404, json: async () => ({}) }), ...noWait })).toBeNull();
    let calls = 0;
    const hang = () => {
      calls++;
      return new Promise<HttpResponse>((_, reject) => setTimeout(() => reject(new Error('timeout')), 5));
    };
    await expect(fetchJson('https://x', { fetchImpl: hang, retries: 2, timeoutMs: 1, ...noWait })).rejects.toBeInstanceOf(ProviderError);
    expect(calls).toBe(3);
  });

  it('cache : pas de nouvelle requête si enrichi récemment ; « Forcer » l’ignore', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    const prov = provider(fetchImpl);
    const created = await api.createProspect({ name: 'X', siret: '90000000100011' });
    await api.enrichProspect(created.id, prov);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((await api.enrichProspect(created.id, prov)).skipped).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const forced = await api.enrichProspect(created.id, prov, { force: true });
    expect(forced.skipped).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('File d’enrichissement (EnrichmentQueue)', () => {
  it('succès, échec, relance des échecs, reprise', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    let broken = true;
    const flaky = vi.fn(async (url: string): Promise<HttpResponse> => (broken && url.includes('900000002') ? { ok: false, status: 500, json: async () => ({}) } : fetchImpl(url)));
    const prov = new RechercheEntreprisesProvider({ fetchImpl: flaky, retries: 0, cache: memoryCache(), ...noWait });
    const a = await api.createProspect({ name: 'A', siret: '90000000100011' });
    const b = await api.createProspect({ name: 'B', siren: '900000002' });
    const c = await api.createProspect({ name: 'C', siren: '111111111' });
    const demo = (await api.importLines([{ line: 1, errors: [], input: { name: '[DÉMO] D', demo: true } }], { source: 'demo', label: 'démo', mode: 'create' })).added;
    expect(demo).toBe(1);
    const queue = new EnrichmentQueue(api, new EnrichmentEngine(api, { official: prov }));
    queue.retryDelayMs = () => 0; // erreurs temporaires : nouveaux essais immédiats dans le test
    const progress: number[] = [];
    queue.subscribe((p) => progress.push(p.processed));
    const added = await queue.add((await api.allRows()).map((r) => r.id));
    expect(added).toBe(3); // les données de démonstration ne sont jamais enrichies
    expect((await api.getProspect(a.id))!.enrichmentStatus).not.toBe('none');
    await queue.start();
    const done = await queue.refresh();
    expect(done).toMatchObject({ total: 3, enriched: 1, failed: 2, pending: 0 });
    expect(progress.at(-1)).toBe(3);
    expect((await api.getProspect(a.id))!.enrichmentStatus).toBe('enriched');
    expect((await api.getProspect(b.id))!.enrichmentStatus).toBe('failed');
    expect((await api.getProspect(c.id))!.enrichmentError).toMatch(/Aucune entreprise/);
    // L'API revient : on relance les échecs
    broken = false;
    expect(await queue.retryFailed()).toBe(2);
    await queue.start();
    const after = await queue.refresh();
    expect(after.pending).toBe(0);
    expect((await api.getProspect(b.id))!.enrichmentStatus).toBe('partial');
    expect((await api.getProspect(c.id))!.enrichmentStatus).toBe('failed'); // introuvable : échec définitif
  });

  it('la file est enregistrée : une tâche interrompue reprend', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    const a = await api.createProspect({ name: 'A', siret: '90000000100011' });
    await api.enqueueEnrichment([a.id]);
    const [job] = await api.queueJobs();
    await api.saveJob({ ...job!, status: 'processing' }); // onglet fermé en plein traitement
    const queue = new EnrichmentQueue(api, new EnrichmentEngine(api, { official: provider(fetchImpl) }));
    await queue.start();
    expect((await api.queueJobs())[0]).toMatchObject({ status: 'completed', outcome: 'enriched' });
  });

  it('limiteur de débit : les appels sont espacés', async () => {
    const limiter = new RateLimiter(20); // 1 appel / 50 ms
    const t = Date.now();
    await Promise.all([limiter.wait(), limiter.wait(), limiter.wait()]);
    expect(Date.now() - t).toBeGreaterThanOrEqual(95);
  });
});

describe('Import et doublons', () => {
  it('CSV incorrect : fichier sans colonne nom, colonnes manquantes', async () => {
    const { api } = await setup();
    const bad = csvProvider.parse('siret;ville\n12345678900011;Rouen\n;Caen');
    expect(bad.mapping).toEqual(['siret', 'city']);
    const r = await api.importLines(csvProvider.toLines(bad, bad.mapping), { source: 'csv', label: 'mauvais.csv', mode: 'create' });
    expect(r).toMatchObject({ added: 0, invalid: 2 });
    expect(r.errors[0]!.message).toMatch(/Nom de l’entreprise manquant/);
    const partial = csvProvider.parse('Nom;Téléphone\nJardin A;0611111111');
    const ok = await api.importLines(csvProvider.toLines(partial, partial.mapping), { source: 'csv', label: 'contacts.csv', mode: 'create' });
    expect(ok.added).toBe(1);
    const p = (await api.listProspects({ filter: {} })).items[0]!;
    expect((await api.getProspect(p.id))!.fieldSources.phone).toMatchObject({ type: 'csv', provider: 'contacts.csv' });
  });

  it('doublon incertain (même téléphone) : fiche créée + doublon potentiel ; fusion conserve tout', async () => {
    const { api } = await setup();
    const a = await api.createProspect({ name: 'Jardins Alpha', siret: '90000000100011', phone: '0611111111' });
    await api.addNote(a.id, 'Note A');
    const csv = csvProvider.parse('Nom;Téléphone;Email\nAlpha Paysage;06 11 11 11 11;alpha@x.fr');
    const r = await api.importLines(csvProvider.toLines(csv, csv.mapping), { source: 'csv', label: 'f.csv', mode: 'create' });
    expect(r).toMatchObject({ added: 1, candidates: 1 });
    const [dup] = await api.listDuplicates('open');
    expect(dup).toMatchObject({ rule: 'phone', status: 'open' });
    const merged = await api.mergeDuplicate(dup!.id, a.id);
    expect(merged).toMatchObject({ name: 'Jardins Alpha', email: 'alpha@x.fr', siret: '90000000100011' });
    expect((await api.listProspects({ filter: {} })).total).toBe(1);
    expect((await api.notesFor(a.id)).map((x) => x.text)).toEqual(['Note A']);
    expect((await api.timeline(a.id)).some((x) => x.type === 'merged')).toBe(true);
    expect(await api.listDuplicates('open')).toHaveLength(0);
  });

  it('ignorer / conserver les deux ; analyse de la base ; l’enrichissement révèle un doublon', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    await api.createProspect({ name: 'A', phone: '0622222222', city: 'Rouen' });
    await api.createProspect({ name: 'B', phone: '0622222222', city: 'Caen' });
    expect(await api.scanDuplicates()).toBe(1);
    expect(await api.scanDuplicates()).toBe(0); // pas de doublon de doublon
    const [d] = await api.listDuplicates('open');
    await api.resolveDuplicate(d!.id, 'kept_both');
    expect(await api.listDuplicates('open')).toHaveLength(0);
    // Deux fiches qui, une fois enrichies, ont le même SIRET
    const x = await api.createProspect({ name: 'Mon client', siret: '90000000100011' });
    const y = await api.createProspect({ name: 'Jardins Fictifs du Val', postalCode: '76000', city: 'Rouen' });
    await api.enrichProspect(y.id, provider(fetchImpl));
    const open = await api.listDuplicates('open');
    expect(open.some((c) => [c.prospectIdA, c.prospectIdB].sort().join() === [x.id, y.id].sort().join())).toBe(true);
    await api.resolveDuplicate(open[0]!.id, 'ignored');
  });

  it('réimporter un fichier SIRENE existant n’écrase pas les saisies manuelles', async () => {
    const { api } = await setup();
    await api.importLines([{ line: 1, errors: [], input: { name: 'Officiel', siret: '90000000100011', address: '1 rue A' } }], { source: 'sirene', label: 's', mode: 'create' });
    const row = (await api.listProspects({ filter: {} })).items[0]!;
    await api.updateProspect(row.id, { address: 'Adresse corrigée à la main' });
    await api.importLines([{ line: 1, errors: [], input: { name: 'Officiel', siret: '90000000100011', address: '2 rue B' } }], { source: 'sirene', label: 's', mode: 'create' });
    expect((await api.getProspect(row.id))!.address).toBe('Adresse corrigée à la main');
  });
});

describe('Sécurité et RGPD', () => {
  it('isolation : file, journaux et doublons d’un workspace invisibles depuis un autre', async () => {
    const { db, api } = await setup('w1');
    const other = new ProspectsApi(db, { workspaceId: 'w2', user: 'B', role: 'owner' });
    const { fetchImpl } = fakeApi();
    const a = await api.createProspect({ name: 'A', siret: '90000000100011', phone: '0611111111' });
    await api.createProspect({ name: 'B', phone: '0611111111' });
    await api.scanDuplicates();
    await api.enqueueEnrichment([a.id]);
    await api.enrichProspect(a.id, provider(fetchImpl), { force: true });
    expect(await other.queueJobs()).toHaveLength(0);
    expect(await other.enrichmentLogs(a.id)).toHaveLength(0);
    expect(await other.listDuplicates('all')).toHaveLength(0);
    expect(await other.enqueueEnrichment([a.id])).toBe(0);
    await expect(other.enrichProspect(a.id, provider(fetchImpl))).rejects.toThrow(/introuvable/);
  });

  it('un rôle « Lecture seule » ne peut pas enrichir', async () => {
    const { db } = await setup();
    const viewer = new ProspectsApi(db, { workspaceId: 'w1', user: 'V', role: 'viewer' });
    await expect(viewer.enqueueEnrichment(['x'])).rejects.toThrow(/non autorisée/);
    await expect(viewer.anonymizeProspect('x')).rejects.toThrow(/non autorisée/);
  });

  it('suppression : journaux, file et doublons effacés ; anonymisation : exclusion + liste de suppression', async () => {
    const { api } = await setup();
    const { fetchImpl } = fakeApi();
    const a = await api.createProspect({ name: 'A', siret: '90000000100011', email: 'a@a.fr' });
    await api.enrichProspect(a.id, provider(fetchImpl));
    await api.enqueueEnrichment([a.id], true);
    await api.deleteProspects([a.id]);
    expect(await api.enrichmentLogs(a.id)).toHaveLength(0);
    expect(await api.queueJobs()).toHaveLength(0);
    const b = await api.createProspect({ name: 'Jean Martin', individual: true, email: 'jean@martin.fr', phone: '0633333333' });
    await api.addNote(b.id, 'Appelé le 12');
    const anon = await api.anonymizeProspect(b.id);
    expect(anon).toMatchObject({ name: 'Entreprise anonymisée', email: null, phone: null, doNotContact: true, anonymized: true });
    expect(await api.notesFor(b.id)).toHaveLength(0);
    expect((await api.listSuppression()).map((s) => s.kind).sort()).toEqual(['email', 'phone']);
    const preview = await api.previewCampaign({ includeDoNotContact: true });
    expect(preview.included.some((p) => p.id === b.id)).toBe(false);
  });
});

describe('Migration de la base (v1 → v2, sans perte)', () => {
  it('les fiches existantes reçoivent statut d’enrichissement et provenance', async () => {
    const name = `migration-${Date.now()}`;
    // Base au format de la version 1 (schéma et fiche d'origine)
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        const prospects = db.createObjectStore('prospects', { keyPath: 'id' });
        prospects.createIndex('workspaceId', 'workspaceId');
        prospects.createIndex('siren', 'siren');
        prospects.createIndex('siret', 'siret');
        db.createObjectStore('prospect_rows', { keyPath: 'id' }).createIndex('workspaceId', 'workspaceId');
        for (const s of ['prospect_notes', 'prospect_activities', 'prospect_tasks']) {
          const st = db.createObjectStore(s, { keyPath: 'id' });
          st.createIndex('prospectId', 'prospectId');
          st.createIndex('workspaceId', 'workspaceId');
        }
        for (const s of ['prospect_segments', 'prospect_campaigns', 'message_templates', 'prospect_imports', 'suppression_list']) db.createObjectStore(s, { keyPath: 'id' }).createIndex('workspaceId', 'workspaceId');
        db.createObjectStore('settings', { keyPath: 'workspaceId' });
        db.createObjectStore('data_cache', { keyPath: 'key' });
      },
    });
    const old = {
      id: 'p1', workspaceId: 'w1', createdAt: '2026-09-28T10:00:00Z', updatedAt: '2026-09-28T10:00:00Z', createdBy: 'x', name: 'Ancienne fiche', tradeName: null,
      siren: '900000001', siret: '90000000100011', nafCode: '81.30Z', activity: null, legalForm: null, individual: false, active: true, creationDate: '2019-03-01',
      headcountBand: null, headcount: null, address: '1 rue A', postalCode: '76000', city: 'Rouen', department: '76', region: '28', contactFirstName: null, contactLastName: null,
      phone: '0611111111', email: null, website: null, googleUrl: null, googleRating: null, googleReviews: null, googleCategory: null, googleCheckedAt: null, facebook: null,
      instagram: null, linkedin: null, tiktok: null, services: [], interventionArea: null, status: 'new', owner: null, lastContactAt: null, nextFollowUpAt: null, milestones: {},
      doNotContact: false, doNotContactReason: null, score: 30, source: 'sirene', sourceUrl: null, dateCollected: '2026-09-28T10:00:00Z', lastVerifiedAt: '2026-09-28T10:00:00Z', demo: false,
    };
    await v1.put('prospects', old);
    await v1.put('prospect_rows', { id: 'p1', workspaceId: 'w1', name: 'Ancienne fiche' });
    v1.close();
    const db = await openProspectingDB(name);
    const api = new ProspectsApi(db, { workspaceId: 'w1', user: 'u', role: 'owner' });
    const p = (await api.getProspect('p1'))!;
    expect(p).toMatchObject({ name: 'Ancienne fiche', phone: '0611111111', enrichmentStatus: 'enriched', anonymized: false });
    expect(p.fieldSources.siren).toMatchObject({ type: 'official_api' });
    const rows = await api.allRows();
    expect(rows[0]).toMatchObject({ enrichmentStatus: 'enriched', active: true, address: '1 rue A' });
    expect(toRow(p).enrichmentStatus).toBe('enriched');
    expect(db.objectStoreNames.contains('enrichment_logs')).toBe(true);
  });
});
