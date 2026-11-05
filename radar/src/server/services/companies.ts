/**
 * Écriture des entreprises et de leurs faits, avec :
 *  - déduplication par SIREN (entreprise), SIRET (établissement), (source, identifiant) pour les enregistrements ;
 *  - provenance champ par champ (source, date, statut, confiance) ;
 *  - historique des changements (ancienne / nouvelle valeur) ;
 *  - règle « l'absence n'est pas une information » : une valeur vide ne remplace jamais une valeur connue ;
 *  - priorité des sources : une valeur n'est remplacée que par une source au moins aussi fiable, ou si l'ancienne
 *    valeur a plus de 180 jours ;
 *  - respect de la liste d'opposition (RGPD) : un SIREN qui y figure n'est jamais réimporté.
 */
import type { Db, SqlValue, Statement } from '../db/types';
import { sha256Hex } from '../lib/crypto';
import { classifySector, normalizeNaf } from '../domain/sectors';
import type { FinancialYear } from '../domain/financial';

export type DataStatus = 'officielle' | 'declarative' | 'calculee' | 'estimee' | 'inconnue';

export interface Provenance {
  sourceId: string;
  status: DataStatus;
  confidence: number;
  collectedAt: string;
  url?: string | null;
  identityCheck?: boolean; // la source fait foi pour l'identité (SIRENE, RNE)
}

export const COMPANY_FIELDS = [
  'name', 'trade_name', 'acronym', 'legal_form_code', 'legal_form_label', 'naf_code', 'naf_label', 'creation_date', 'admin_status',
  'is_individual', 'category', 'headcount_band', 'headcount_year', 'siege_siret', 'address', 'postal_code', 'commune_code', 'commune_name',
  'department', 'lat', 'lon', 'geo_precision', 'establishments_count', 'open_establishments_count', 'website',
] as const;
export type CompanyField = (typeof COMPANY_FIELDS)[number];
export type CompanyPatch = { siren: string } & Partial<Record<CompanyField, SqlValue | undefined>>;

export function isValidSiren(s: string | null | undefined): s is string {
  if (!s || !/^\d{9}$/.test(s)) return false;
  // Clé de Luhn (exception : La Poste, 356000000, dont les SIRET ne respectent pas Luhn — le SIREN, lui, oui)
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(s[8 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function sirenFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/g) ?? [];
  for (const m of matches) {
    const s = m.replace(/\s/g, '');
    if (isValidSiren(s)) return s;
  }
  return null;
}

export function departmentFromPostalCode(cp: string | null | undefined): string | null {
  if (!cp || !/^\d{5}$/.test(cp)) return null;
  if (cp.startsWith('97')) return cp.slice(0, 3);
  if (cp.startsWith('20')) return Number(cp) < 20200 ? '2A' : '2B';
  return cp.slice(0, 2);
}

const nowIso = () => new Date().toISOString();
const same = (a: unknown, b: unknown) => (a === null || a === undefined ? null : String(a)) === (b === null || b === undefined ? null : String(b));

export async function isSuppressed(db: Db, siren: string): Promise<boolean> {
  return !!(await db.get('SELECT 1 FROM suppression_list WHERE siren = ?', [siren]));
}

export interface UpsertResult {
  id: number;
  created: boolean;
  changed: CompanyField[];
}

/** Crée ou met à jour une entreprise. Retourne null si le SIREN est invalide ou sur la liste d'opposition. */
export async function upsertCompany(db: Db, patch: CompanyPatch, prov: Provenance): Promise<UpsertResult | null> {
  if (!isValidSiren(patch.siren)) return null;
  if (await isSuppressed(db, patch.siren)) return null;
  const p: CompanyPatch = { ...patch };
  if (p.naf_code !== undefined) p.naf_code = normalizeNaf(p.naf_code as string) ?? (p.naf_code as string | null);
  if (!p.department && p.postal_code) p.department = departmentFromPostalCode(p.postal_code as string);
  const now = prov.collectedAt || nowIso();
  const existing = await db.get<Record<string, SqlValue>>('SELECT * FROM companies WHERE siren = ?', [p.siren]);
  const stmts: Statement[] = [];

  if (!existing) {
    const fields = COMPANY_FIELDS.filter((f) => p[f] !== undefined && p[f] !== null);
    const name = (p.name as string | null) || `Entreprise ${p.siren}`;
    const naf = (p.naf_code as string | null) ?? null;
    const sector = classifySector(naf, name).sectorId;
    const cols = ['siren', 'name', 'sector_id', 'first_seen_at', 'updated_at', ...(prov.identityCheck ? ['identity_checked_at'] : []), ...fields.filter((f) => f !== 'name')];
    const vals: SqlValue[] = [p.siren, name, sector, now, now, ...(prov.identityCheck ? [now] : []), ...fields.filter((f) => f !== 'name').map((f) => p[f] as SqlValue)];
    const r = await db.get<{ id: number }>(`INSERT INTO companies (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')}) RETURNING id`, vals);
    const id = r!.id;
    for (const f of fields) stmts.push(fieldSource(id, f, p[f] as SqlValue, prov));
    stmts.push({ sql: 'INSERT OR IGNORE INTO company_identifiers (company_id, type, value, source_id, collected_at) VALUES (?, ?, ?, ?, ?)', params: [id, 'siren', p.siren, prov.sourceId, now] });
    stmts.push(queueStmt(id));
    await db.batch(stmts);
    return { id, created: true, changed: fields };
  }

  const id = existing.id as number;
  const sources = new Map(
    (await db.all<{ field: string; confidence: number; collected_at: string }>('SELECT field, confidence, collected_at FROM company_field_sources WHERE company_id = ?', [id])).map((r) => [r.field, r]),
  );
  const changed: CompanyField[] = [];
  const sets: string[] = [];
  const vals: SqlValue[] = [];
  for (const f of COMPANY_FIELDS) {
    const v = p[f];
    if (v === undefined || v === null || v === '') continue; // l'absence n'efface rien
    const old = existing[f];
    const src = sources.get(f);
    const stale = src ? Date.now() - new Date(src.collected_at).getTime() > 180 * 86400_000 : true;
    const allowed = !src || old === null || prov.confidence >= src.confidence || stale;
    if (!allowed) continue;
    if (!same(old, v)) {
      sets.push(`${f} = ?`);
      vals.push(v);
      changed.push(f);
      // Les noms provisoires (« Entreprise 123456789 ») et les coordonnées ne sont pas historisés.
      if (old !== null && old !== undefined && !(f === 'name' && String(old).startsWith('Entreprise ')) && f !== 'lat' && f !== 'lon') {
        stmts.push({ sql: 'INSERT INTO company_changes (company_id, field, old_value, new_value, source_id, changed_at) VALUES (?, ?, ?, ?, ?, ?)', params: [id, f, String(old), String(v), prov.sourceId, now] });
      }
    }
    stmts.push(fieldSource(id, f, v, prov));
  }
  if (changed.includes('naf_code') || changed.includes('name') || existing.sector_id === null) {
    const sector = classifySector((p.naf_code as string) ?? (existing.naf_code as string), (p.name as string) ?? (existing.name as string)).sectorId;
    if (sector !== existing.sector_id) {
      sets.push('sector_id = ?');
      vals.push(sector);
    }
  }
  if (prov.identityCheck) {
    sets.push('identity_checked_at = ?');
    vals.push(now);
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    vals.push(now);
    stmts.unshift({ sql: `UPDATE companies SET ${sets.join(', ')} WHERE id = ?`, params: [...vals, id] });
  }
  if (changed.length) stmts.push(queueStmt(id));
  if (stmts.length) await db.batch(stmts);
  return { id, created: false, changed };
}

function fieldSource(id: number, field: string, value: SqlValue, prov: Provenance): Statement {
  return {
    sql: `INSERT INTO company_field_sources (company_id, field, value, source_id, status, confidence, collected_at, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(company_id, field) DO UPDATE SET value = excluded.value, source_id = excluded.source_id, status = excluded.status,
          confidence = excluded.confidence, collected_at = excluded.collected_at, url = excluded.url`,
    params: [id, field, value === null ? null : String(value), prov.sourceId, prov.status, prov.confidence, prov.collectedAt, prov.url ?? null],
  };
}

export function queueStmt(companyId: number): Statement {
  return { sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [companyId, nowIso()] };
}

export async function queueAnalysis(db: Db, companyId: number): Promise<void> {
  await db.run(queueStmt(companyId).sql, queueStmt(companyId).params);
}

export interface EstablishmentPatch {
  siret: string;
  is_siege?: number;
  name?: string | null;
  address?: string | null;
  postal_code?: string | null;
  commune_code?: string | null;
  commune_name?: string | null;
  naf_code?: string | null;
  admin_status?: string | null;
  creation_date?: string | null;
  headcount_band?: string | null;
  lat?: number | null;
  lon?: number | null;
}

export function establishmentStmt(companyId: number, e: EstablishmentPatch, sourceId: string, at: string): Statement {
  return {
    sql: `INSERT INTO establishments (siret, company_id, is_siege, name, address, postal_code, commune_code, commune_name, naf_code, admin_status, creation_date, headcount_band, lat, lon, source_id, collected_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(siret) DO UPDATE SET company_id = excluded.company_id, is_siege = excluded.is_siege,
            name = COALESCE(excluded.name, establishments.name), address = COALESCE(excluded.address, establishments.address),
            postal_code = COALESCE(excluded.postal_code, establishments.postal_code), commune_code = COALESCE(excluded.commune_code, establishments.commune_code),
            commune_name = COALESCE(excluded.commune_name, establishments.commune_name), naf_code = COALESCE(excluded.naf_code, establishments.naf_code),
            admin_status = COALESCE(excluded.admin_status, establishments.admin_status), creation_date = COALESCE(excluded.creation_date, establishments.creation_date),
            headcount_band = COALESCE(excluded.headcount_band, establishments.headcount_band), lat = COALESCE(excluded.lat, establishments.lat),
            lon = COALESCE(excluded.lon, establishments.lon), source_id = excluded.source_id, collected_at = excluded.collected_at`,
    params: [e.siret, companyId, e.is_siege ?? 0, e.name ?? null, e.address ?? null, e.postal_code ?? null, e.commune_code ?? null, e.commune_name ?? null, normalizeNaf(e.naf_code) ?? null, e.admin_status ?? null, e.creation_date ?? null, e.headcount_band ?? null, e.lat ?? null, e.lon ?? null, sourceId, at],
  };
}

const FIN_COLS: [keyof FinancialYear, string][] = [
  ['months', 'months'], ['revenue', 'revenue'], ['grossMargin', 'gross_margin'], ['valueAdded', 'value_added'], ['ebe', 'ebe'], ['ebitda', 'ebitda'],
  ['operatingIncome', 'operating_income'], ['netIncome', 'net_income'], ['payroll', 'payroll'], ['depreciation', 'depreciation'], ['equity', 'equity'],
  ['totalDebt', 'total_debt'], ['totalLiabilities', 'total_liabilities'], ['cash', 'cash'], ['fixedAssets', 'fixed_assets'], ['inventory', 'inventory'],
  ['receivables', 'receivables'], ['payables', 'payables'], ['totalAssets', 'total_assets'], ['headcount', 'headcount'],
];

/** Enregistre un exercice ; retourne les valeurs précédentes de la même source (détection des changements). */
export function financialStmt(companyId: number, y: FinancialYear & { closingDate?: string | null }, prov: Provenance): Statement {
  const cols = FIN_COLS.map(([, c]) => c);
  const values = FIN_COLS.map(([k]) => {
    const v = y[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  });
  return {
    sql: `INSERT INTO company_financials (company_id, fiscal_year, closing_date, ${cols.join(', ')}, source_id, status, confidence, url, collected_at)
          VALUES (?, ?, ?, ${cols.map(() => '?').join(', ')}, ?, ?, ?, ?, ?)
          ON CONFLICT(company_id, fiscal_year, source_id) DO UPDATE SET closing_date = COALESCE(excluded.closing_date, company_financials.closing_date),
          ${cols.map((c) => `${c} = COALESCE(excluded.${c}, company_financials.${c})`).join(', ')},
          status = excluded.status, confidence = excluded.confidence, url = excluded.url, collected_at = excluded.collected_at`,
    params: [companyId, y.fiscalYear, y.closingDate ?? null, ...values, prov.sourceId, prov.status, prov.confidence, prov.url ?? null, prov.collectedAt],
  };
}

export interface DirectorInput {
  kind: 'personne_physique' | 'personne_morale';
  name: string;
  firstNames?: string | null;
  role?: string | null;
  directorSiren?: string | null;
}

/** Remplace les dirigeants publiés par une source (la liste de la source fait foi à la date de collecte). */
export function directorsStmts(companyId: number, list: DirectorInput[], sourceId: string, at: string): Statement[] {
  return [
    { sql: 'DELETE FROM company_directors WHERE company_id = ? AND source_id = ?', params: [companyId, sourceId] },
    ...list.map((d) => ({
      sql: `INSERT OR IGNORE INTO company_directors (company_id, kind, name, first_names, role, director_siren, source_id, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [companyId, d.kind, d.name, d.firstNames ?? '', d.role ?? '', d.directorSiren ?? null, sourceId, at] as SqlValue[],
    })),
  ];
}

/**
 * Enregistre la trace d'un enregistrement source (provenance, empreinte).
 * Retourne l'identifiant, et si l'enregistrement est nouveau ou modifié depuis la dernière collecte.
 */
export async function recordSource(
  db: Db,
  r: { sourceId: string; externalId: string; entityType: string; companyId?: number | null; siren?: string | null; url?: string | null; publishedAt?: string | null; payload: unknown },
): Promise<{ id: number; isNew: boolean; changed: boolean }> {
  const text = JSON.stringify(r.payload);
  const hash = await sha256Hex(text);
  const now = nowIso();
  const prev = await db.get<{ id: number; payload_hash: string }>('SELECT id, payload_hash FROM source_records WHERE source_id = ? AND external_id = ?', [r.sourceId, r.externalId]);
  if (prev) {
    await db.run('UPDATE source_records SET collected_at = ?, payload_hash = ?, payload = ?, company_id = COALESCE(?, company_id), siren = COALESCE(?, siren), url = COALESCE(?, url) WHERE id = ?', [now, hash, text.slice(0, 20000), r.companyId ?? null, r.siren ?? null, r.url ?? null, prev.id]);
    return { id: prev.id, isNew: false, changed: prev.payload_hash !== hash };
  }
  const row = await db.get<{ id: number }>(
    `INSERT INTO source_records (source_id, external_id, entity_type, company_id, siren, url, published_at, payload_hash, payload, first_collected_at, collected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [r.sourceId, r.externalId, r.entityType, r.companyId ?? null, r.siren ?? null, r.url ?? null, r.publishedAt ?? null, hash, text.slice(0, 20000), now, now],
  );
  return { id: row!.id, isNew: true, changed: true };
}

export function eventStmt(e: {
  companyId: number;
  type: string;
  date: string | null;
  title: string;
  details?: unknown;
  tribunal?: string | null;
  reference: string;
  url?: string | null;
  sourceId: string;
  sourceRecordId?: number | null;
}): Statement {
  return {
    sql: `INSERT INTO company_events (company_id, event_type, event_date, title, details, tribunal, reference, url, source_id, source_record_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_id, reference) DO UPDATE SET company_id = excluded.company_id, event_type = excluded.event_type, event_date = excluded.event_date,
          title = excluded.title, details = excluded.details, tribunal = excluded.tribunal, url = excluded.url, source_record_id = excluded.source_record_id`,
    params: [e.companyId, e.type, e.date, e.title, e.details === undefined ? null : JSON.stringify(e.details), e.tribunal ?? null, e.reference, e.url ?? null, e.sourceId, e.sourceRecordId ?? null, nowIso()],
  };
}
