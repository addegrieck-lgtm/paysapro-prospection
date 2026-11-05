/**
 * Recherche avancée multicritère. Tous les filtres sont validés (zod) puis traduits en SQL paramétré.
 * Utilisée par la liste des entreprises, les pages d'opportunités, la carte, les exports, RADAR AI et les
 * recherches enregistrées.
 */
import { z } from 'zod';
import type { Db, SqlValue } from '../db/types';
import { boundingBox, haversineKm } from '../lib/geo';
import { SECTORS } from '../domain/sectors';
import { raiseAlert } from './alerts';
import { getSettings } from './settings';

const csv = z.preprocess((v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v), z.array(z.string().max(64)).max(200));
const numOpt = z.preprocess((v) => (v === '' || v === null || v === undefined ? undefined : Number(v)), z.number().finite().optional());
const boolOpt = z.preprocess((v) => (v === 'true' || v === '1' || v === true ? true : v === 'false' || v === '0' || v === false ? false : undefined), z.boolean().optional());

export const SearchSchema = z.object({
  q: z.string().trim().max(120).optional(),
  communes: csv.optional(), // codes INSEE
  lat: numOpt,
  lon: numOpt,
  radiusKm: numOpt,
  sectors: csv.optional(),
  naf: csv.optional(), // codes ou préfixes (ex. 43.2)
  revenueMin: numOpt,
  revenueMax: numOpt,
  netIncomeMin: numOpt,
  netIncomeMax: numOpt,
  ebeMin: numOpt,
  headcountBands: csv.optional(),
  ageMin: numOpt,
  ageMax: numOpt,
  legalForms: csv.optional(),
  procedureTypes: csv.optional(), // sauvegarde, redressement, liquidation…
  procedureStatuses: csv.optional(), // ouverte, en_cours, plan_arrete, cession_arretee, cloturee
  activeProcedure: boolOpt,
  opportunityTypes: csv.optional(), // a_vendre, procedure, transmission, cachee
  hasSignals: boolOpt,
  transmissionIndexMin: numOpt,
  economicMin: numOpt,
  riskMax: numOpt,
  reliabilityMin: numOpt,
  dataStatus: csv.optional(),
  hasWebsite: boolOpt,
  hasAccounts: boolOpt,
  acquisitionType: z.enum(['titres', 'fonds', 'actifs']).optional(),
  includeCeased: boolOpt,
  geolocated: boolOpt,
  inProject: boolOpt,
  sort: z.enum(['score', 'risque', 'fiabilite', 'nom', 'ca', 'resultat', 'anciennete', 'recent', 'distance', 'transmission']).optional(),
  page: z.preprocess((v) => (v === undefined ? 1 : Number(v)), z.number().int().min(1).max(10000)).optional(),
  pageSize: z.preprocess((v) => (v === undefined ? 25 : Number(v)), z.number().int().min(1).max(500)).optional(),
});
export type SearchQuery = z.infer<typeof SearchSchema>;

export interface SearchRow {
  id: number;
  siren: string;
  name: string;
  trade_name: string | null;
  naf_code: string | null;
  sector_id: string | null;
  commune_name: string | null;
  postal_code: string | null;
  creation_date: string | null;
  headcount_band: string | null;
  legal_form_label: string | null;
  admin_status: string | null;
  lat: number | null;
  lon: number | null;
  geo_precision: string | null;
  website: string | null;
  economic_score: number | null;
  risk_score: number | null;
  reliability_score: number | null;
  data_status: string | null;
  primary_type: string | null;
  types: string | null;
  transmission_index: number | null;
  revenue: number | null;
  net_income: number | null;
  ebe: number | null;
  last_year: number | null;
  valuation_central: number | null;
  first_detected_at: string | null;
  project_status: string | null;
  distance_km?: number;
}

function sectorIds(ids: string[]): string[] {
  const out = new Set<string>();
  for (const id of ids) {
    out.add(id);
    for (const s of SECTORS) if (s.parent === id) out.add(s.id);
  }
  return [...out];
}

export function buildSearchSql(f: SearchQuery, departments: string[]) {
  const where: string[] = [];
  const p: SqlValue[] = [];
  const inList = (col: string, vals: string[]) => {
    where.push(`${col} IN (${vals.map(() => '?').join(',')})`);
    p.push(...vals);
  };
  // Périmètre géographique : siège ou établissement dans un département suivi
  where.push(`(c.department IN (${departments.map(() => '?').join(',')}) OR EXISTS (SELECT 1 FROM establishments e WHERE e.company_id = c.id AND substr(e.postal_code, 1, 2) IN (${departments.map(() => '?').join(',')})))`);
  p.push(...departments, ...departments);
  if (!f.includeCeased) where.push("(c.admin_status IS NULL OR c.admin_status != 'C' OR EXISTS (SELECT 1 FROM legal_proceedings lp WHERE lp.company_id = c.id AND lp.status != 'cloturee'))");
  if (f.q) {
    const digits = f.q.replace(/\s/g, '');
    if (/^\d{9,14}$/.test(digits)) {
      where.push('(c.siren = ? OR EXISTS (SELECT 1 FROM establishments e WHERE e.company_id = c.id AND e.siret = ?))');
      p.push(digits.slice(0, 9), digits);
    } else {
      where.push('(c.name LIKE ? OR c.trade_name LIKE ? OR c.acronym LIKE ? OR c.commune_name LIKE ?)');
      const like = `%${f.q.replace(/[%_]/g, '')}%`;
      p.push(like, like, like, like);
    }
  }
  if (f.communes?.length) {
    where.push(`(c.commune_code IN (${f.communes.map(() => '?').join(',')}) OR EXISTS (SELECT 1 FROM establishments e WHERE e.company_id = c.id AND e.commune_code IN (${f.communes.map(() => '?').join(',')})))`);
    p.push(...f.communes, ...f.communes);
  }
  if (f.lat !== undefined && f.lon !== undefined && f.radiusKm) {
    const b = boundingBox(f.lat, f.lon, f.radiusKm);
    where.push('c.lat BETWEEN ? AND ? AND c.lon BETWEEN ? AND ?');
    p.push(b.minLat, b.maxLat, b.minLon, b.maxLon);
  }
  if (f.sectors?.length) inList('c.sector_id', sectorIds(f.sectors));
  if (f.naf?.length) {
    where.push(`(${f.naf.map(() => 'c.naf_code LIKE ?').join(' OR ')})`);
    p.push(...f.naf.map((n) => `${n.replace(/[%_]/g, '')}%`));
  }
  const range = (col: string, min?: number, max?: number) => {
    if (min !== undefined) {
      where.push(`${col} >= ?`);
      p.push(min);
    }
    if (max !== undefined) {
      where.push(`${col} <= ?`);
      p.push(max);
    }
  };
  range('m.revenue', f.revenueMin, f.revenueMax);
  range('m.net_income', f.netIncomeMin, f.netIncomeMax);
  range('m.ebe', f.ebeMin);
  if (f.headcountBands?.length) inList('c.headcount_band', f.headcountBands);
  const now = new Date();
  if (f.ageMin !== undefined) {
    where.push('c.creation_date <= ?');
    p.push(new Date(now.getFullYear() - f.ageMin, now.getMonth(), now.getDate()).toISOString().slice(0, 10));
  }
  if (f.ageMax !== undefined) {
    where.push('c.creation_date >= ?');
    p.push(new Date(now.getFullYear() - f.ageMax, now.getMonth(), now.getDate()).toISOString().slice(0, 10));
  }
  if (f.legalForms?.length) inList('c.legal_form_code', f.legalForms);
  if (f.procedureTypes?.length || f.procedureStatuses?.length || f.activeProcedure !== undefined) {
    const sub: string[] = ['lp.company_id = c.id'];
    if (f.procedureTypes?.length) {
      sub.push(`lp.type IN (${f.procedureTypes.map(() => '?').join(',')})`);
      p.push(...f.procedureTypes);
    }
    if (f.procedureStatuses?.length) {
      sub.push(`lp.status IN (${f.procedureStatuses.map(() => '?').join(',')})`);
      p.push(...f.procedureStatuses);
    }
    if (f.activeProcedure === true) sub.push("lp.status != 'cloturee'");
    if (f.activeProcedure === false && !f.procedureTypes?.length && !f.procedureStatuses?.length) where.push("NOT EXISTS (SELECT 1 FROM legal_proceedings lp WHERE lp.company_id = c.id AND lp.status != 'cloturee')");
    else where.push(`EXISTS (SELECT 1 FROM legal_proceedings lp WHERE ${sub.join(' AND ')})`);
  }
  if (f.opportunityTypes?.length) {
    where.push(`(${f.opportunityTypes.map(() => 'o.types LIKE ?').join(' OR ')})`);
    p.push(...f.opportunityTypes.map((t) => `%"${t.replace(/[^a-z_]/g, '')}"%`));
  }
  if (f.hasSignals === true) where.push('EXISTS (SELECT 1 FROM transmission_signals t WHERE t.company_id = c.id)');
  if (f.hasSignals === false) where.push('NOT EXISTS (SELECT 1 FROM transmission_signals t WHERE t.company_id = c.id)');
  range('o.transmission_index', f.transmissionIndexMin);
  range('s.economic_score', f.economicMin);
  if (f.riskMax !== undefined) {
    where.push('s.risk_score <= ?');
    p.push(f.riskMax);
  }
  range('s.reliability_score', f.reliabilityMin);
  if (f.dataStatus?.length) inList('s.data_status', f.dataStatus);
  if (f.hasWebsite === true) where.push("c.website IS NOT NULL AND c.website != ''");
  if (f.hasWebsite === false) where.push("(c.website IS NULL OR c.website = '')");
  if (f.hasAccounts === true) where.push('m.years_count > 0');
  if (f.hasAccounts === false) where.push('(m.years_count IS NULL OR m.years_count = 0)');
  if (f.geolocated) where.push('c.lat IS NOT NULL AND c.lon IS NOT NULL');
  if (f.inProject === true) where.push('ap.id IS NOT NULL');
  if (f.acquisitionType === 'actifs') where.push("EXISTS (SELECT 1 FROM legal_proceedings lp WHERE lp.company_id = c.id AND lp.type = 'liquidation' AND lp.status != 'cloturee')");
  if (f.acquisitionType === 'fonds') where.push("(c.is_individual = 1 OR c.sector_id IN ('commerce-proximite','imprimerie','garages') OR EXISTS (SELECT 1 FROM legal_proceedings lp WHERE lp.company_id = c.id AND lp.status != 'cloturee'))");
  if (f.acquisitionType === 'titres') where.push("(c.is_individual = 0 OR c.is_individual IS NULL) AND NOT EXISTS (SELECT 1 FROM legal_proceedings lp WHERE lp.company_id = c.id AND lp.type = 'liquidation' AND lp.status != 'cloturee')");

  const from = `FROM companies c
    LEFT JOIN scoring_results s ON s.company_id = c.id
    LEFT JOIN company_metrics m ON m.company_id = c.id
    LEFT JOIN acquisition_opportunities o ON o.company_id = c.id
    LEFT JOIN valuations v ON v.company_id = c.id
    LEFT JOIN acquisition_projects ap ON ap.company_id = c.id`;
  const order: Record<NonNullable<SearchQuery['sort']>, string> = {
    score: 's.economic_score IS NULL, s.economic_score DESC, s.reliability_score DESC',
    risque: 's.risk_score IS NULL, s.risk_score ASC',
    fiabilite: 's.reliability_score DESC',
    nom: 'c.name COLLATE NOCASE ASC',
    ca: 'm.revenue IS NULL, m.revenue DESC',
    resultat: 'm.net_income IS NULL, m.net_income DESC',
    anciennete: 'c.creation_date IS NULL, c.creation_date ASC',
    recent: 'COALESCE(o.first_detected_at, c.first_seen_at) DESC',
    distance: 'c.id',
    transmission: 'o.transmission_index IS NULL, o.transmission_index DESC',
  };
  const select = `SELECT c.id, c.siren, c.name, c.trade_name, c.naf_code, c.sector_id, c.commune_name, c.postal_code, c.creation_date, c.headcount_band,
      c.legal_form_label, c.admin_status, c.lat, c.lon, c.geo_precision, c.website, s.economic_score, s.risk_score, s.reliability_score, s.data_status,
      o.primary_type, o.types, o.transmission_index, o.first_detected_at, m.revenue, m.net_income, m.ebe, m.last_year, v.central AS valuation_central, ap.status AS project_status`;
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params: p, from, order: `ORDER BY ${order[f.sort ?? 'score']}, c.id`, select };
}

export async function searchCompanies(db: Db, f: SearchQuery, departments: string[]): Promise<{ rows: SearchRow[]; total: number; page: number; pageSize: number }> {
  const q = buildSearchSql(f, departments);
  const page = f.page ?? 1;
  const pageSize = f.pageSize ?? 25;
  const radius = f.lat !== undefined && f.lon !== undefined && f.radiusKm ? { lat: f.lat, lon: f.lon, km: f.radiusKm } : null;
  if (radius) {
    // Rayon : filtrage exact après préfiltrage par rectangle englobant
    const all = await db.all<SearchRow>(`${q.select} ${q.from} ${q.where} ${q.order} LIMIT 20000`, q.params);
    const inside = all
      .map((r) => ({ ...r, distance_km: r.lat !== null && r.lon !== null ? haversineKm(radius.lat, radius.lon, r.lat, r.lon) : Infinity }))
      .filter((r) => r.distance_km <= radius.km);
    if (f.sort === 'distance') inside.sort((a, b) => a.distance_km - b.distance_km);
    return { rows: inside.slice((page - 1) * pageSize, page * pageSize), total: inside.length, page, pageSize };
  }
  const total = (await db.get<{ n: number }>(`SELECT COUNT(*) AS n ${q.from} ${q.where}`, q.params))?.n ?? 0;
  const rows = await db.all<SearchRow>(`${q.select} ${q.from} ${q.where} ${q.order} LIMIT ? OFFSET ?`, [...q.params, pageSize, (page - 1) * pageSize]);
  return { rows, total, page, pageSize };
}

/** Recherches enregistrées avec alerte : signale les nouveaux résultats à la fin de chaque veille. */
export async function checkSavedSearches(db: Db, runId: number | null): Promise<void> {
  const settings = await getSettings(db);
  const list = await db.all<{ id: number; name: string; query: string; last_count: number | null }>('SELECT id, name, query, last_count FROM saved_searches WHERE alert_enabled = 1');
  for (const s of list) {
    try {
      const f = SearchSchema.parse(JSON.parse(s.query));
      const { total } = await searchCompanies(db, { ...f, page: 1, pageSize: 1 }, settings.sync.departments);
      if (s.last_count !== null && total > s.last_count) {
        await raiseAlert(db, { type: 'recherche_enregistree', severity: 'info', title: `${total - s.last_count} nouveau(x) résultat(s) : « ${s.name} »`, message: `${total} entreprise(s) correspondent désormais à cette recherche.`, dedupeKey: `ss:${s.id}:${runId ?? Date.now()}`, runId }, settings);
      }
      await db.run('UPDATE saved_searches SET last_count = ? WHERE id = ?', [total, s.id]);
    } catch {
      /* recherche invalide : ignorée */
    }
  }
}
