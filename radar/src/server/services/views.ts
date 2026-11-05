import type { Db } from '../db/types';
import { yearIndicators, analyzeTrends } from '../domain/financial';
import { analyzeDistress } from '../domain/distress';
import { headcountMid } from '../domain/scoring';
import type { ProcStatus, ProcType } from '../domain/proceedings';
import { sourceMeta } from '../connectors/registry';
import { loadFinancials } from './analysis';
import { getSettings } from './settings';

const parse = <T>(s: string | null | undefined, d: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : d;
  } catch {
    return d;
  }
};

/** Fiche entreprise complète : chaque champ est accompagné de sa provenance (source, date, statut, confiance). */
export async function companyDetail(db: Db, id: number) {
  const c = await db.get<Record<string, unknown>>('SELECT * FROM companies WHERE id = ?', [id]);
  if (!c) return null;
  const [fields, establishments, directors, events, procs, listings, signals, contacts, assets, score, valuation, opp, project, changes, records] = await Promise.all([
    db.all<{ field: string; value: string; source_id: string; status: string; confidence: number; collected_at: string; url: string | null }>('SELECT field, value, source_id, status, confidence, collected_at, url FROM company_field_sources WHERE company_id = ?', [id]),
    db.all('SELECT * FROM establishments WHERE company_id = ? ORDER BY is_siege DESC, admin_status, siret', [id]),
    db.all('SELECT kind, name, first_names, role, director_siren, source_id, collected_at FROM company_directors WHERE company_id = ? ORDER BY kind, name', [id]),
    db.all('SELECT id, event_type, event_date, title, details, tribunal, reference, url, source_id FROM company_events WHERE company_id = ? ORDER BY event_date DESC, id DESC LIMIT 200', [id]),
    db.all<{ type: ProcType; status: ProcStatus } & Record<string, unknown>>('SELECT * FROM legal_proceedings WHERE company_id = ? ORDER BY opened_at DESC', [id]),
    db.all('SELECT * FROM sale_listings WHERE company_id = ? ORDER BY published_at DESC', [id]),
    db.all('SELECT * FROM transmission_signals WHERE company_id = ? ORDER BY strength DESC', [id]),
    db.all('SELECT * FROM company_contacts WHERE company_id = ?', [id]),
    db.all('SELECT * FROM business_assets WHERE company_id = ?', [id]),
    db.get<Record<string, unknown>>('SELECT * FROM scoring_results WHERE company_id = ?', [id]),
    db.get<Record<string, unknown>>('SELECT * FROM valuations WHERE company_id = ?', [id]),
    db.get<Record<string, unknown>>('SELECT * FROM acquisition_opportunities WHERE company_id = ?', [id]),
    db.get<Record<string, unknown>>('SELECT * FROM acquisition_projects WHERE company_id = ?', [id]),
    db.all('SELECT field, old_value, new_value, source_id, changed_at FROM company_changes WHERE company_id = ? ORDER BY changed_at DESC LIMIT 100', [id]),
    db.all('SELECT source_id, external_id, url, published_at, first_collected_at, collected_at FROM source_records WHERE company_id = ? ORDER BY collected_at DESC LIMIT 100', [id]),
  ]);
  const fin = await loadFinancials(db, id);
  const indicators = fin.map((y, i) => ({ year: y.fiscalYear, indicators: yearIndicators(y, i > 0 ? fin[i - 1] : undefined) }));
  const active = procs.find((p) => p.status !== 'cloturee');
  const provenance = Object.fromEntries(fields.map((f) => [f.field, { ...f, source_label: sourceMeta(f.source_id)?.label ?? f.source_id }]));
  return {
    company: c,
    provenance,
    establishments,
    directors,
    events: events.map((e: Record<string, unknown>) => ({ ...e, details: parse(e.details as string, null), source_label: sourceMeta(e.source_id as string)?.label })),
    proceedings: procs,
    listings,
    signals,
    contacts,
    assets,
    financials: fin,
    indicators,
    trends: analyzeTrends(fin),
    score: score ? { ...score, detail: parse(score.detail as string, null) } : null,
    valuation: valuation ? { ...valuation, detail: parse(valuation.detail as string, null) } : null,
    opportunity: opp ? { ...opp, types: parse(opp.types as string, []), reasons: parse(opp.reasons as string, []) } : null,
    distress: active || procs.length ? analyzeDistress(active ? { type: active.type, status: active.status } : null, { isIndividual: c.is_individual === 1, headcount: headcountMid(c.headcount_band as string | null) }) : null,
    project,
    changes,
    records: records.map((r: Record<string, unknown>) => ({ ...r, source_label: sourceMeta(r.source_id as string)?.label ?? r.source_id })),
    officialLinks: {
      annuaire: `https://annuaire-entreprises.data.gouv.fr/entreprise/${c.siren}`,
      bodacc: `https://www.bodacc.fr/pages/annonces-commerciales/?q.registre=registre:${c.siren}`,
      inpi: `https://data.inpi.fr/entreprises/${c.siren}`,
    },
  };
}

export async function dashboard(db: Db) {
  const settings = await getSettings(db);
  const deps = settings.sync.departments;
  const scope = `(c.department IN (${deps.map(() => '?').join(',')}) OR EXISTS (SELECT 1 FROM establishments e WHERE e.company_id = c.id AND substr(e.postal_code,1,2) IN (${deps.map(() => '?').join(',')})))`;
  const p = [...deps, ...deps];
  const one = async (sql: string, params: (string | number)[] = p) => (await db.get<{ n: number }>(sql, params))?.n ?? 0;
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [total, forSale, procedures, transmission, hidden, newOpps, withFin, alertsUnread] = await Promise.all([
    one(`SELECT COUNT(*) AS n FROM companies c WHERE ${scope}`),
    one(`SELECT COUNT(*) AS n FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id WHERE o.types LIKE '%"a_vendre"%' AND ${scope}`),
    one(`SELECT COUNT(DISTINCT lp.company_id) AS n FROM legal_proceedings lp JOIN companies c ON c.id = lp.company_id WHERE lp.status != 'cloturee' AND ${scope}`),
    one(`SELECT COUNT(*) AS n FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id WHERE o.types LIKE '%"transmission"%' AND ${scope}`),
    one(`SELECT COUNT(*) AS n FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id WHERE o.types LIKE '%"cachee"%' AND ${scope}`),
    one(`SELECT COUNT(*) AS n FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id WHERE o.first_detected_at >= ? AND ${scope}`, [since, ...p]),
    one(`SELECT COUNT(*) AS n FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id JOIN company_metrics m ON m.company_id = c.id WHERE m.years_count > 0 AND ${scope}`),
    one('SELECT COUNT(*) AS n FROM alerts WHERE read_at IS NULL', []),
  ]);
  const procByType = await db.all(`SELECT lp.type, lp.status, COUNT(*) AS n FROM legal_proceedings lp JOIN companies c ON c.id = lp.company_id WHERE ${scope} GROUP BY lp.type, lp.status`, p);
  const bySector = await db.all(
    `SELECT COALESCE(c.sector_id, 'autre') AS sector_id, COUNT(*) AS n, SUM(CASE WHEN o.company_id IS NOT NULL THEN 1 ELSE 0 END) AS opps FROM companies c LEFT JOIN acquisition_opportunities o ON o.company_id = c.id WHERE ${scope} GROUP BY COALESCE(c.sector_id, 'autre') ORDER BY n DESC`,
    p,
  );
  const byCommune = await db.all(
    `SELECT COALESCE(c.commune_name, 'Inconnue') AS commune, COUNT(*) AS n, SUM(CASE WHEN o.company_id IS NOT NULL THEN 1 ELSE 0 END) AS opps FROM companies c LEFT JOIN acquisition_opportunities o ON o.company_id = c.id WHERE ${scope} GROUP BY COALESCE(c.commune_name, 'Inconnue') ORDER BY opps DESC, n DESC LIMIT 15`,
    p,
  );
  const discoveries = await db.all(
    `SELECT substr(o.first_detected_at, 1, 10) AS day, o.primary_type, COUNT(*) AS n FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id
     WHERE o.first_detected_at >= ? AND ${scope} GROUP BY day, o.primary_type ORDER BY day`,
    [new Date(Date.now() - 90 * 86400_000).toISOString(), ...p],
  );
  const top = await db.all(
    `SELECT c.id, c.siren, c.name, c.commune_name, c.sector_id, o.primary_type, o.types, s.economic_score, s.risk_score, s.reliability_score, s.data_status, m.revenue, m.net_income, m.last_year, v.central AS valuation_central
     FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id JOIN scoring_results s ON s.company_id = c.id
     LEFT JOIN company_metrics m ON m.company_id = c.id LEFT JOIN valuations v ON v.company_id = c.id
     WHERE s.economic_score IS NOT NULL AND ${scope} ORDER BY s.economic_score DESC, s.reliability_score DESC LIMIT 15`,
    p,
  );
  const sources = await db.all('SELECT id, label, enabled, last_sync_at, last_success_at, last_status, last_error FROM sources ORDER BY id');
  const lastRun = await db.get<Record<string, unknown>>('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 1');
  return {
    counts: { total, forSale, procedures, transmission, hidden, newOpps, withFin, alertsUnread },
    procByType,
    bySector,
    byCommune,
    discoveries,
    top,
    sources: sources.filter((s: Record<string, unknown>) => sourceMeta(s.id as string) && !['saisie', 'calcul'].includes(s.id as string)),
    lastRun: lastRun ? { ...lastRun, summary: parse(lastRun.summary as string, null) } : null,
  };
}

/** Points de la carte : coordonnées et attributs minimaux (léger pour plusieurs milliers de marqueurs). */
export async function mapPoints(db: Db, ids: number[] | null, departments: string[]) {
  const scope = `(c.department IN (${departments.map(() => '?').join(',')}) OR EXISTS (SELECT 1 FROM establishments e WHERE e.company_id = c.id AND substr(e.postal_code,1,2) IN (${departments.map(() => '?').join(',')})))`;
  const rows = await db.all<{ id: number; lat: number; lon: number; name: string; sector_id: string | null; primary_type: string | null; economic_score: number | null; risk_score: number | null; geo_precision: string | null; commune_name: string | null }>(
    `SELECT c.id, c.lat, c.lon, c.name, c.sector_id, c.geo_precision, c.commune_name, o.primary_type, s.economic_score, s.risk_score FROM companies c
     LEFT JOIN acquisition_opportunities o ON o.company_id = c.id LEFT JOIN scoring_results s ON s.company_id = c.id
     WHERE c.lat IS NOT NULL AND c.lon IS NOT NULL AND ${scope} LIMIT 50000`,
    [...departments, ...departments],
  );
  const set = ids ? new Set(ids) : null;
  // Format compact : [id, lat, lon, nom, secteur, type, score, risque, précision, commune]
  return rows.filter((r) => !set || set.has(r.id)).map((r) => [r.id, Math.round(r.lat * 1e5) / 1e5, Math.round(r.lon * 1e5) / 1e5, r.name, r.sector_id, r.primary_type, r.economic_score, r.risk_score, r.geo_precision === 'commune' ? 1 : 0, r.commune_name]);
}
