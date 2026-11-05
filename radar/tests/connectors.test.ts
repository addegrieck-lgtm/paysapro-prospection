import { describe, expect, it } from 'vitest';
import { bodaccRecord, fakeFetch, json, reCompany, S1, S2, S3, testDb } from './helpers';
import { createHttp } from '../src/server/lib/http';
import { rechercheEntreprises, RE_BASE } from '../src/server/connectors/recherche-entreprises';
import { bodacc, BODACC_URL, buildWhere, ingestBodacc } from '../src/server/connectors/bodacc';
import { ingestSirene, sireneAddress } from '../src/server/connectors/insee-sirene';
import { parseFeed, relevantToDepartments } from '../src/server/connectors/rss';
import { robotsAllows, safePublicUrl, fetchPublicPage } from '../src/server/connectors/website';
import { mapPappersFinance } from '../src/server/connectors/pappers';
import { lambert93ToWgs84, haversineKm } from '../src/server/lib/geo';
import { getSettings } from '../src/server/services/settings';
import { isValidSiren, sirenFromText, upsertCompany } from '../src/server/services/companies';
import type { ConnectorContext } from '../src/server/connectors/types';
import type { FetchLike } from '../src/server/lib/http';
import type { Db } from '../src/server/db/types';

async function ctxFor(db: Db, fetch: FetchLike, config: Record<string, unknown> = {}): Promise<ConnectorContext> {
  const settings = await getSettings(db);
  return { db, fetch, http: (o) => createHttp({ fetch, sleep: async () => {}, ...o }), secrets: {}, settings, departments: ['76'], config, now: () => new Date('2026-11-05T08:00:00Z') };
}

describe('identifiants', () => {
  it('valide le SIREN (clé de Luhn) et l\'extrait d\'un texte', () => {
    expect(isValidSiren(S1)).toBe(true);
    expect(isValidSiren('999000012')).toBe(false);
    expect(sirenFromText(`RCS Rouen ${S1.slice(0, 3)} ${S1.slice(3, 6)} ${S1.slice(6)}`)).toBe(S1);
  });
});

describe("connecteur API Recherche d'entreprises", () => {
  it('importe identité, établissements, dirigeants et finances, sans date de naissance', async () => {
    const db = await testDb();
    const f = fakeFetch([[`${RE_BASE}/search`, (u) => json({ results: u.searchParams.get('page') === '1' ? [reCompany(S1), reCompany(S2, { activite_principale: '43.21A', nom_raison_sociale: 'ELEC FICTIVE' })] : [], total_results: 2, page: Number(u.searchParams.get('page')), per_page: 25, total_pages: 1 })]]);
    const r = await rechercheEntreprises.runChunk(await ctxFor(db, f), 'naf:81.30Z:76', null);
    expect(r.done).toBe(true);
    expect(r.created).toBe(2);
    expect(f.calls[0]).toContain('activite_principale=81.30Z');
    expect(f.calls[0]).toContain('departement=76');
    const c = await db.get<Record<string, unknown>>('SELECT * FROM companies WHERE siren = ?', [S1]);
    expect(c).toMatchObject({ name: `ENTREPRISE FICTIVE ${S1}`, sector_id: 'paysagisme', commune_code: '76540', geo_precision: 'adresse', legal_form_label: 'SARL', trade_name: 'JARDINS FICTIFS' });
    expect((await db.get<{ sector_id: string }>('SELECT sector_id FROM companies WHERE siren = ?', [S2]))!.sector_id).toBe('electricite');
    expect((await db.all('SELECT siret FROM establishments WHERE company_id = ?', [c!.id as number])).length).toBe(2);
    const dirs = await db.all<Record<string, unknown>>('SELECT * FROM company_directors WHERE company_id = ?', [c!.id as number]);
    expect(dirs).toHaveLength(2);
    expect(JSON.stringify(dirs)).not.toContain('1960');
    const payload = (await db.get<{ payload: string }>("SELECT payload FROM source_records WHERE source_id = 'recherche-entreprises' AND external_id = ?", [S1]))!.payload;
    expect(payload).not.toContain('1960');
    const fin = await db.all<{ fiscal_year: number; revenue: number; status: string }>('SELECT fiscal_year, revenue, status FROM company_financials WHERE company_id = ? ORDER BY fiscal_year', [c!.id as number]);
    expect(fin).toEqual([{ fiscal_year: 2022, revenue: 800000, status: 'officielle' }, { fiscal_year: 2023, revenue: 900000, status: 'officielle' }]);
    const src = await db.get<Record<string, unknown>>("SELECT * FROM company_field_sources WHERE company_id = ? AND field = 'naf_code'", [c!.id as number]);
    expect(src).toMatchObject({ source_id: 'recherche-entreprises', status: 'officielle', value: '81.30Z' });
  });

  it('dédoublonne et historise les changements lors d\'une nouvelle collecte', async () => {
    const db = await testDb();
    let headcount = '03';
    const f = fakeFetch([[`${RE_BASE}/search`, () => json({ results: [reCompany(S1, { tranche_effectif_salarie: headcount })], total_results: 1, page: 1, per_page: 25, total_pages: 1 })]]);
    const ctx = await ctxFor(db, f);
    await rechercheEntreprises.runChunk(ctx, 'naf:81.30Z:76', null);
    headcount = '11';
    const r2 = await rechercheEntreprises.runChunk(ctx, 'naf:81.30Z:76', null);
    expect(r2.created).toBe(0);
    expect(r2.updated).toBe(1);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM companies'))!.n).toBe(1);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM establishments'))!.n).toBe(2);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM company_financials'))!.n).toBe(2);
    const ch = await db.all('SELECT field, old_value, new_value FROM company_changes');
    expect(ch).toEqual([{ field: 'headcount_band', old_value: '03', new_value: '11' }]);
  });

  it("une valeur absente n'efface jamais une valeur connue ; une source moins fiable ne remplace pas une plus fiable", async () => {
    const db = await testDb();
    const at = new Date().toISOString();
    await upsertCompany(db, { siren: S1, name: 'NOM OFFICIEL', website: 'https://exemple.test' }, { sourceId: 'insee-sirene', status: 'officielle', confidence: 90, collectedAt: at });
    await upsertCompany(db, { siren: S1, name: 'NOM APPROXIMATIF', website: null }, { sourceId: 'rss', status: 'declarative', confidence: 40, collectedAt: at });
    expect(await db.get('SELECT name, website FROM companies')).toEqual({ name: 'NOM OFFICIEL', website: 'https://exemple.test' });
  });

  it("la liste d'opposition empêche toute réimportation", async () => {
    const db = await testDb();
    await db.run("INSERT INTO suppression_list (siren, reason, created_at) VALUES (?, 'test', '2026-01-01')", [S1]);
    expect(await upsertCompany(db, { siren: S1, name: 'X' }, { sourceId: 'bodacc', status: 'officielle', confidence: 70, collectedAt: '2026-01-01' })).toBeNull();
  });

  it('enrichit les entreprises connues par le BODACC', async () => {
    const db = await testDb();
    await upsertCompany(db, { siren: S1, name: 'NOM BODACC' }, { sourceId: 'bodacc', status: 'officielle', confidence: 70, collectedAt: '2026-01-01T00:00:00Z' });
    const f = fakeFetch([[`${RE_BASE}/search`, (u) => json({ results: u.searchParams.get('q') === S1 ? [reCompany(S1)] : [], total_results: 1, page: 1, per_page: 1, total_pages: 1 })]]);
    const r = await rechercheEntreprises.runChunk(await ctxFor(db, f), 'enrich', null);
    expect(r.updated).toBe(1);
    const c = await db.get<Record<string, unknown>>('SELECT name, identity_checked_at, naf_code FROM companies');
    expect(c!.naf_code).toBe('81.30Z');
    expect(c!.identity_checked_at).toBeTruthy();
  });
});

describe('connecteur BODACC', () => {
  it('construit la requête par département, famille et date', () => {
    expect(buildWhere('collective', ['76', '27'], '2024-01-01')).toBe(`(numerodepartement="76" OR numerodepartement="27") AND familleavis="collective" AND dateparution>=date'2024-01-01'`);
  });

  it('reconstitue redressement → liquidation et crée les alertes', async () => {
    const db = await testDb();
    const recs = [
      bodaccRecord({ id: 'A1', dateparution: '2024-01-15', jugement: JSON.stringify({ type: 'initial', famille: "Jugement d'ouverture", nature: "Jugement d'ouverture d'une procédure de redressement judiciaire", date: '2024-01-10', complementJugement: 'Jugement désignant mandataire judiciaire SELARL FICTIVE MANDATAIRES, 1 quai Fictif 76000 Rouen.' }) }),
      bodaccRecord({ id: 'A2', dateparution: '2024-05-02', jugement: { famille: 'Jugement de conversion', nature: 'Jugement de conversion en liquidation judiciaire', date: '2024-04-28' } }),
    ];
    const f = fakeFetch([[BODACC_URL, (u) => json({ total_count: 2, results: Number(u.searchParams.get('offset')) === 0 ? recs : [] })]]);
    const r = await bodacc.runChunk(await ctxFor(db, f), 'collective', null);
    expect(r.done).toBe(true);
    expect(r.configPatch).toEqual({ lastDate_collective: '2024-05-02' });
    expect(decodeURIComponent(f.calls[0]!)).toContain('familleavis="collective"');
    const procs = await db.all<Record<string, unknown>>('SELECT type, status, opened_at, closed_at, administrator, tribunal FROM legal_proceedings ORDER BY id');
    expect(procs).toEqual([
      { type: 'redressement', status: 'cloturee', opened_at: '2024-01-10', closed_at: '2024-04-28', administrator: 'mandataire judiciaire SELARL FICTIVE MANDATAIRES, 1 quai Fictif 76000 Rouen', tribunal: 'TRIBUNAL DE COMMERCE DE ROUEN' },
      // Le jugement de conversion ne désigne personne : aucun liquidateur n'est supposé
      { type: 'liquidation', status: 'ouverte', opened_at: '2024-04-28', closed_at: null, administrator: null, tribunal: 'TRIBUNAL DE COMMERCE DE ROUEN' },
    ]);
    const alerts = await db.all<{ type: string }>('SELECT type FROM alerts ORDER BY id');
    expect(alerts.map((a) => a.type).sort()).toEqual(['changement_procedure', 'nouveau_redressement', 'nouvelle_liquidation']);
    // Réimport : aucune duplication
    await bodacc.runChunk(await ctxFor(db, f), 'collective', null);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM company_events'))!.n).toBe(2);
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM alerts'))!.n).toBe(3);
    // L'entreprise inconnue a été créée et attend la vérification de son identité
    expect(await db.get('SELECT siren, identity_checked_at FROM companies')).toEqual({ siren: S1, identity_checked_at: null });
  });

  it("un avis d'annulation neutralise le jugement visé", async () => {
    const db = await testDb();
    await ingestBodacc(db, bodaccRecord({ id: 'B1', parution: '20240100', numeroannonce: 7, jugement: { nature: "Jugement d'ouverture d'une procédure de liquidation judiciaire", date: '2024-02-01' } }) as never, '2026-01-01', null);
    expect((await db.all('SELECT * FROM legal_proceedings')).length).toBe(1);
    await ingestBodacc(db, bodaccRecord({ id: 'B2', typeavis_lib: "Avis d'annulation", parutionavisprecedent: { numeroParution: '20240100', numeroAnnonce: 7 }, jugement: { nature: "Jugement d'ouverture d'une procédure de liquidation judiciaire" } }) as never, '2026-01-01', null);
    expect((await db.all('SELECT * FROM legal_proceedings')).length).toBe(0);
  });

  it('une cession publiée est une cession RÉALISÉE (jamais une annonce de vente) et un signal pour le cédant', async () => {
    const db = await testDb();
    await ingestBodacc(
      db,
      bodaccRecord({
        id: 'V1',
        familleavis: 'vente',
        familleavis_lib: 'Ventes et cessions',
        registre: [S2],
        commercant: 'ACQUEREUR FICTIF',
        acte: JSON.stringify({ vente: { descriptif: 'Fonds de commerce de jardinerie' } }),
        listeprecedentproprietaire: JSON.stringify({ personne: { typePersonne: 'pm', denomination: 'CEDANT FICTIF', numeroImmatriculation: { numeroIdentification: `${S3.slice(0, 3)} ${S3.slice(3, 6)} ${S3.slice(6)}` } } }),
      }) as never,
      '2026-01-01',
      null,
    );
    const l = await db.get<Record<string, unknown>>('SELECT is_offer, status, kind, title FROM sale_listings');
    expect(l).toMatchObject({ is_offer: 0, status: 'realisee', kind: 'fonds_de_commerce' });
    const sig = await db.get<Record<string, unknown>>('SELECT s.signal_type, s.strength, c.siren FROM transmission_signals s JOIN companies c ON c.id = s.company_id');
    expect(sig).toEqual({ signal_type: 'cession_fonds_realisee', strength: 2, siren: S3 });
  });

  it('pagine au-delà de 100 enregistrements et conserve le curseur', async () => {
    const db = await testDb();
    const page = (offset: number) => Array.from({ length: offset < 200 ? 100 : 5 }, (_, i) => bodaccRecord({ id: `R${offset + i}`, familleavis: 'radiation', registre: 'sans numéro' }));
    const f = fakeFetch([[BODACC_URL, (u) => json({ total_count: 205, results: page(Number(u.searchParams.get('offset'))) })]]);
    const ctx = await ctxFor(db, f);
    const r = await bodacc.runChunk(ctx, 'radiation', null);
    expect(r.done).toBe(true);
    expect(r.fetched).toBe(205);
    expect(r.errors[0]).toMatch(/sans SIREN/);
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM source_records WHERE source_id = 'bodacc'"))!.n).toBe(205);
  });
});

describe('connecteur INSEE Sirene', () => {
  it('importe un établissement, convertit les coordonnées et ignore les non-diffusibles', async () => {
    const db = await testDb();
    const e = {
      siren: S1, siret: `${S1}00011`, etablissementSiege: true, dateCreationEtablissement: '2001-01-01', trancheEffectifsEtablissement: '02',
      uniteLegale: { denominationUniteLegale: 'FICTIVE SAS', categorieJuridiqueUniteLegale: '5710', activitePrincipaleUniteLegale: '62.01Z', etatAdministratifUniteLegale: 'A', trancheEffectifsUniteLegale: '02', dateCreationUniteLegale: '2001-01-01' },
      adresseEtablissement: { numeroVoieEtablissement: '3', typeVoieEtablissement: 'RUE', libelleVoieEtablissement: 'FICTIVE', codePostalEtablissement: '76000', libelleCommuneEtablissement: 'ROUEN', codeCommuneEtablissement: '76540', coordonneeLambertAbscisseEtablissement: '562000', coordonneeLambertOrdonneeEtablissement: '6928000' },
      periodesEtablissement: [{ dateFin: null, etatAdministratifEtablissement: 'A', activitePrincipaleEtablissement: '62.01Z' }],
    };
    expect(await ingestSirene(db, e, '2026-01-01T00:00:00Z')).toMatchObject({ created: true });
    const c = await db.get<{ lat: number; lon: number; legal_form_label: string; address: string }>('SELECT lat, lon, legal_form_label, address FROM companies');
    expect(c!.legal_form_label).toBe('SAS');
    expect(c!.lat).toBeGreaterThan(49.3);
    expect(c!.lat).toBeLessThan(49.6);
    expect(c!.lon).toBeGreaterThan(0.9);
    expect(c!.lon).toBeLessThan(1.3);
    expect(sireneAddress(e.adresseEtablissement)).toBe('3 rue FICTIVE, 76000 ROUEN');
    expect(await ingestSirene(db, { ...e, siren: S2, siret: `${S2}00011`, statutDiffusionEtablissement: 'P' }, '2026-01-01')).toBeNull();
  });
});

describe('géographie', () => {
  it('convertit le Lambert 93 (point de contrôle : Paris, Notre-Dame)', () => {
    const p = lambert93ToWgs84(652469, 6861423);
    expect(p.lat).toBeCloseTo(48.853, 2);
    expect(p.lon).toBeCloseTo(2.349, 2);
  });
  it('distance Rouen – Le Havre ≈ 75 km', () => {
    expect(haversineKm(49.443, 1.099, 49.494, 0.107)).toBeGreaterThan(70);
    expect(haversineKm(49.443, 1.099, 49.494, 0.107)).toBeLessThan(80);
  });
});

describe('sites web et flux', () => {
  it('refuse les adresses non publiques', () => {
    expect(safePublicUrl('http://localhost:8080')).toBeNull();
    expect(safePublicUrl('http://192.168.1.1')).toBeNull();
    expect(safePublicUrl('exemple.fr')!.href).toBe('https://exemple.fr/');
  });
  it('respecte robots.txt', () => {
    const r = 'User-agent: *\nDisallow: /prive\nAllow: /prive/public\n\nUser-agent: NormandieBusinessRadar\nDisallow: /';
    expect(robotsAllows('User-agent: *\nDisallow: /prive\nAllow: /prive/public', '/prive/x')).toBe(false);
    expect(robotsAllows('User-agent: *\nDisallow: /prive\nAllow: /prive/public', '/prive/public/a')).toBe(true);
    expect(robotsAllows(r, '/')).toBe(false);
    expect(robotsAllows('', '/')).toBe(true);
  });
  it('ne lit pas une page interdite par robots.txt', async () => {
    const f = fakeFetch([
      ['https://exemple.test/robots.txt', () => new Response('User-agent: *\nDisallow: /', { status: 200 })],
      ['https://exemple.test/', () => new Response('<p>Je recherche un repreneur</p>', { headers: { 'content-type': 'text/html' } })],
    ]);
    const r = await fetchPublicPage(f, 'https://exemple.test/');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/robots/);
    expect(f.calls).toHaveLength(1);
  });
  it('lit un flux RSS et filtre par département', () => {
    const xml = `<rss><channel><item><title>Fonds de commerce à céder - Fécamp (76)</title><link>https://ex.test/1</link><description><![CDATA[<p>Boulangerie 76400</p>]]></description><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate><guid>g1</guid></item></channel></rss>`;
    const items = parseFeed(xml);
    expect(items[0]).toMatchObject({ id: 'g1', title: 'Fonds de commerce à céder - Fécamp (76)', published: '2026-11-02', description: 'Boulangerie 76400' });
    expect(relevantToDepartments(items[0]!.title + items[0]!.description, ['76'], [])).toBe(true);
    expect(relevantToDepartments('Affaire à céder à Lyon 69003', ['76'], ['Rouen'])).toBe(false);
  });
});

describe('Pappers', () => {
  it('convertit les agrégats financiers', () => {
    expect(mapPappersFinance({ annee: 2023, chiffre_affaires: 100, resultat: 5, excedent_brut_exploitation: 12, capitaux_propres: 50 })).toMatchObject({ fiscalYear: 2023, revenue: 100, netIncome: 5, ebe: 12, equity: 50 });
  });
});
