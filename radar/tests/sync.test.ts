import { describe, expect, it } from 'vitest';
import { bodaccRecord, fakeFetch, json, reCompany, S1, S2, testDb } from './helpers';
import { RE_BASE } from '../src/server/connectors/recherche-entreprises';
import { BODACC_URL } from '../src/server/connectors/bodacc';
import { GEO_BASE } from '../src/server/connectors/geo-communes';
import { activeRun, cancelRun, startRun, tick } from '../src/server/services/sync';
import { analyzeCompany } from '../src/server/services/analysis';
import { getSettings, setSetting } from '../src/server/services/settings';
import { searchCompanies, SearchSchema } from '../src/server/services/search';
import type { Db } from '../src/server/db/types';
import type { FetchLike } from '../src/server/lib/http';

/** Limite la veille à quelques codes NAF pour des tests rapides. */
async function restrictSectors(db: Db) {
  await db.run("UPDATE sectors SET enabled = 0 WHERE id NOT IN ('paysagisme')");
}

const env = (db: Db, fetch: FetchLike, secrets = {}) => ({ db, fetch, secrets, now: () => new Date('2026-11-05T08:00:00Z'), sleep: async () => {} });

describe('orchestrateur de veille', () => {
  it("une source en panne ne bloque pas les autres et la veille est déclarée partielle", async () => {
    const db = await testDb();
    await restrictSectors(db);
    await db.run("UPDATE sources SET enabled = 1 WHERE id = 'insee-sirene'"); // clé absente → non interrogée
    const f = fakeFetch([
      [`${RE_BASE}/search`, (u) => (u.searchParams.get('activite_principale') ? json({ results: [reCompany(S1)], total_results: 1, page: 1, per_page: 25, total_pages: 1 }) : json({ results: [], total_results: 0, page: 1, per_page: 1, total_pages: 0 }))],
      [BODACC_URL, () => new Response('erreur serveur', { status: 503 })],
      [GEO_BASE, () => json([{ nom: 'Rouen', code: '76540', codesPostaux: ['76000', '76100'], population: 110000, centre: { type: 'Point', coordinates: [1.09, 49.44] } }])],
    ]);
    const { runId } = await startRun(env(db, f), 'test');
    const skipped = await db.get<{ error_log: string }>("SELECT error_log FROM sync_jobs WHERE source_id = 'insee-sirene'");
    expect(skipped!.error_log).toMatch(/INSEE_API_KEY/);
    for (let i = 0; i < 10; i++) {
      const r = await tick(env(db, f), { maxMs: 5000, maxRequests: 100 });
      if (r.finished) break;
    }
    const run = await db.get<{ status: string; summary: string }>('SELECT status, summary FROM sync_runs WHERE id = ?', [runId]);
    expect(run!.status).toBe('partial');
    const summary = JSON.parse(run!.summary);
    expect(summary['recherche-entreprises'].status).toBe('success');
    expect(summary['geo-communes'].status).toBe('success');
    expect(summary.bodacc.status).toBe('error');
    expect(summary['insee-sirene'].status).toBe('skipped');
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM companies'))!.n).toBe(1);
    // Une seule alerte par source en panne, et disjoncteur : 3 échecs au total, pas 3 par tâche
    expect((await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM alerts WHERE type = 'source_en_erreur'"))!.n).toBe(1);
    const bodaccJobs = await db.all<{ attempts: number; status: string; error_log: string }>("SELECT attempts, status, error_log FROM sync_jobs WHERE source_id = 'bodacc'");
    expect(bodaccJobs.every((j) => j.status === 'error')).toBe(true);
    expect(bodaccJobs.reduce((a, j) => a + j.attempts, 0)).toBe(3);
    expect(bodaccJobs.some((j) => /injoignable/.test(j.error_log))).toBe(true);
    const src = await db.get<{ last_status: string; last_error: string }>("SELECT last_status, last_error FROM sources WHERE id = 'bodacc'");
    expect(src!.last_status).toBe('error');
    // L'analyse a été faite à la fin
    expect((await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM scoring_results'))!.n).toBe(1);
    expect(await activeRun(db)).toBeUndefined();
  });

  it('reprend une tâche interrompue à partir de son curseur', async () => {
    const db = await testDb();
    await restrictSectors(db);
    await db.run("UPDATE sources SET enabled = 0 WHERE id != 'recherche-entreprises'");
    const pagesSeen: number[] = [];
    const f = fakeFetch([
      [
        `${RE_BASE}/search`,
        (u) => {
          if (!u.searchParams.get('activite_principale')) return json({ results: [], total_results: 0, page: 1, per_page: 1, total_pages: 0 });
          const page = Number(u.searchParams.get('page'));
          pagesSeen.push(page);
          return json({ results: page <= 6 ? [reCompany(page % 2 ? S1 : S2)] : [], total_results: 150, page, per_page: 25, total_pages: 6 });
        },
      ],
    ]);
    await startRun(env(db, f), 'test');
    const t1 = await tick(env(db, f), { maxRequests: 2 });
    expect(t1.stoppedBy).toBe('requetes');
    expect(t1.finished).toBe(false);
    const job = await db.get<{ cursor: string; status: string }>("SELECT cursor, status FROM sync_jobs WHERE task LIKE 'naf:%'");
    expect(job!.status).toBe('running');
    let r = await tick(env(db, f), { maxRequests: 100 });
    for (let i = 0; i < 5 && !r.finished; i++) r = await tick(env(db, f), { maxRequests: 100 });
    expect(r.finished).toBe(true);
    // Les pages déjà traitées ne sont pas redemandées hormis celle interrompue
    expect(pagesSeen.filter((p) => p === 1).length).toBe(1);
    expect(Math.max(...pagesSeen)).toBe(6);
  });

  it('une seule veille à la fois ; interruption possible', async () => {
    const db = await testDb();
    const f = fakeFetch([]);
    const a = await startRun(env(db, f), 'test');
    const b = await startRun(env(db, f), 'test');
    expect(b).toEqual({ runId: a.runId, alreadyRunning: true });
    expect(await cancelRun(db)).toBe(true);
    expect(await activeRun(db)).toBeUndefined();
  });
});

describe('analyse et recherche', () => {
  async function seeded() {
    const db = await testDb();
    const f = fakeFetch([
      [`${RE_BASE}/search`, () => json({ results: [reCompany(S1, { date_creation: '1990-01-01' }), reCompany(S2, { activite_principale: '43.21A', nom_raison_sociale: 'ELEC FICTIVE', finances: {}, tranche_effectif_salarie: 'NN', siege: { ...reCompany(S2).siege, latitude: '49.49', longitude: '0.11', code_postal: '76600', commune: '76351', libelle_commune: 'LE HAVRE' } })], total_results: 2, page: 1, per_page: 25, total_pages: 1 })],
      [BODACC_URL, (u) => json({ total_count: 1, results: Number(u.searchParams.get('offset')) === 0 && u.searchParams.get('where')!.includes('collective') ? [bodaccRecord({ registre: [S2], jugement: { nature: "Jugement d'ouverture d'une procédure de redressement judiciaire", date: '2026-10-01' } })] : [] })],
      [GEO_BASE, () => json([])],
    ]);
    await restrictSectors(db);
    await db.run("UPDATE sectors SET enabled = 1 WHERE id = 'electricite'");
    await startRun(env(db, f), 'test');
    for (let i = 0; i < 10; i++) if ((await tick(env(db, f), { maxRequests: 200 })).finished) break;
    return db;
  }

  it('calcule scores, valorisation et opportunités explicables', async () => {
    const db = await seeded();
    const settings = await getSettings(db);
    const id = (await db.get<{ id: number }>('SELECT id FROM companies WHERE siren = ?', [S1]))!.id;
    const r = await analyzeCompany(db, id, settings);
    expect(r!.scores.economic).not.toBeNull();
    expect(r!.valuation.methods.length).toBeGreaterThan(0);
    expect(r!.opportunities.types).toContain('cachee');
    const opp = await db.get<{ primary_type: string; reasons: string }>('SELECT primary_type, reasons FROM acquisition_opportunities WHERE company_id = ?', [id]);
    expect(opp!.primary_type).toBe('cachee');
    expect(JSON.parse(opp!.reasons).find((r: { engine: string }) => r.engine === 'cachee').rule).toMatch(/non officiellement à vendre/);
    const elec = await db.get<Record<string, unknown>>('SELECT o.primary_type, s.economic_score, s.data_status FROM companies c JOIN acquisition_opportunities o ON o.company_id = c.id JOIN scoring_results s ON s.company_id = c.id WHERE c.siren = ?', [S2]);
    expect(elec).toEqual({ primary_type: 'procedure', economic_score: null, data_status: 'insuffisant' });
  });

  it('filtre par opportunité, procédure, secteur, rayon et données financières', async () => {
    const db = await seeded();
    const s = (q: Record<string, unknown>) => searchCompanies(db, SearchSchema.parse(q), ['76']);
    expect((await s({})).total).toBe(2);
    expect((await s({ opportunityTypes: 'procedure' })).rows.map((r) => r.siren)).toEqual([S2]);
    expect((await s({ procedureTypes: 'redressement', activeProcedure: 'true' })).total).toBe(1);
    expect((await s({ activeProcedure: 'false' })).rows.map((r) => r.siren)).toEqual([S1]);
    expect((await s({ sectors: 'paysage' })).rows.map((r) => r.siren)).toEqual([S1]);
    expect((await s({ naf: '43.2' })).rows.map((r) => r.siren)).toEqual([S2]);
    expect((await s({ hasAccounts: 'true' })).rows.map((r) => r.siren)).toEqual([S1]);
    expect((await s({ revenueMin: 850000 })).rows.map((r) => r.siren)).toEqual([S1]);
    const near = await s({ lat: 49.49, lon: 0.11, radiusKm: 10, sort: 'distance' });
    expect(near.rows.map((r) => r.siren)).toEqual([S2]);
    expect(near.rows[0]!.distance_km).toBeLessThan(1);
    expect((await s({ q: S1 })).total).toBe(1);
    expect((await s({ q: 'elec' })).rows[0]!.siren).toBe(S2);
    // Redressement : rachat de titres encore envisageable ; seule une liquidation l'exclut
    expect((await s({ acquisitionType: 'titres' })).total).toBe(2);
    expect((await s({ acquisitionType: 'actifs' })).total).toBe(0);
  });

  it('les pondérations sont configurables et tracées', async () => {
    const db = await seeded();
    const settings = await getSettings(db);
    await setSetting(db, 'scoringWeights', { ...settings.scoringWeights, rentabilite: 50 });
    const s2 = await getSettings(db);
    expect(s2.scoringWeights.rentabilite).toBe(50);
    const id = (await db.get<{ id: number }>('SELECT id FROM companies WHERE siren = ?', [S1]))!.id;
    await analyzeCompany(db, id, s2);
    expect((await db.get<{ weights_version: string }>('SELECT weights_version FROM scoring_results WHERE company_id = ?', [id]))!.weights_version).toContain('e50-');
  });
});
