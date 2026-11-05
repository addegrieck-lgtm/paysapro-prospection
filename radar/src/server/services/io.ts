/**
 * Imports manuels (CSV), exports (CSV / Excel) et sauvegarde / restauration.
 * Les données importées sont marquées « déclaratives » (sauf comptes explicitement déclarés officiels) et tracées
 * avec la source « import-manuel ».
 */
import { z } from 'zod';
import type { Db, SqlValue, Statement } from '../db/types';
import { classifySector, HEADCOUNT_BANDS, SECTOR_BY_ID } from '../domain/sectors';
import { PROC_STATUS_LABELS, PROC_TYPE_LABELS, type ProcStatus, type ProcType } from '../domain/proceedings';
import { OPPORTUNITY_LABELS, type OpportunityType } from '../domain/opportunities';
import { parseCsv } from '../lib/tabular';
import { financialStmt, isValidSiren, upsertCompany } from './companies';
import { raiseAlert } from './alerts';
import { searchCompanies, type SearchQuery } from './search';

export type ImportKind = 'entreprises' | 'comptes' | 'annonces' | 'signaux';

export interface ImportReport {
  kind: ImportKind;
  rows: number;
  imported: number;
  errors: { line: number; message: string }[];
}

const num = z.preprocess((v) => {
  if (v === '' || v === undefined || v === null) return undefined;
  const s = String(v).replace(/\s| |€/g, '').replace(',', '.');
  return Number(s);
}, z.number().finite().optional());
const siren = z.preprocess((v) => String(v ?? '').replace(/\s/g, ''), z.string().refine(isValidSiren, 'SIREN invalide (9 chiffres, clé de contrôle)'));
const optSiren = z.preprocess((v) => (v ? String(v).replace(/\s/g, '') : undefined), z.string().refine(isValidSiren, 'SIREN invalide').optional());
const url = z.preprocess((v) => (v ? String(v) : undefined), z.string().url().max(500).refine((u) => /^https?:/i.test(u), 'URL http(s) attendue').optional());

const schemas = {
  entreprises: z.object({ siren, site_internet: url, nom: z.string().max(200).optional() }),
  comptes: z.object({
    siren,
    annee: z.preprocess((v) => Number(v), z.number().int().min(1990).max(2100)),
    date_cloture: z.string().max(10).optional(),
    duree_mois: num,
    chiffre_affaires: num,
    marge_brute: num,
    valeur_ajoutee: num,
    ebe: num,
    resultat_exploitation: num,
    resultat_net: num,
    salaires_charges: num,
    dotations: num,
    capitaux_propres: num,
    dettes_financieres: num,
    total_dettes: num,
    tresorerie: num,
    immobilisations: num,
    stocks: num,
    creances_clients: num,
    dettes_fournisseurs: num,
    total_bilan: num,
    effectif: num,
    statut: z.enum(['officielle', 'declarative']).optional(),
    source_url: url,
  }),
  annonces: z.object({
    titre: z.string().min(3).max(300),
    type: z.enum(['fonds_de_commerce', 'societe', 'titres', 'actifs', 'clientele', 'autre']).optional(),
    prix: num,
    ca: num,
    commune: z.string().max(120).optional(),
    departement: z.string().max(3).optional(),
    siren: optSiren,
    url,
    date: z.string().max(10).optional(),
    description: z.string().max(5000).optional(),
    source: z.string().max(120).optional(),
    reference: z.string().max(200).optional(),
  }),
  signaux: z.object({ siren, type: z.string().min(3).max(60), description: z.string().min(5).max(1000), url, force: z.preprocess((v) => (v ? Number(v) : 2), z.number().int().min(1).max(3)) }),
};

export async function importCsv(db: Db, kind: ImportKind, text: string, userId: number | null): Promise<ImportReport> {
  const rows = parseCsv(text);
  if (rows.length > 20000) throw new Error('Fichier trop volumineux (20 000 lignes maximum par import).');
  const report: ImportReport = { kind, rows: rows.length, imported: 0, errors: [] };
  const at = new Date().toISOString();
  const prov = { sourceId: 'import-manuel', status: 'declarative' as const, confidence: 50, collectedAt: at };
  for (let i = 0; i < rows.length; i++) {
    const line = i + 2;
    const parsed = schemas[kind].safeParse(rows[i]);
    if (!parsed.success) {
      report.errors.push({ line, message: parsed.error.issues.map((e) => `${e.path.join('.')} : ${e.message}`).join(' ; ') });
      continue;
    }
    try {
      if (kind === 'entreprises') {
        const d = parsed.data as z.infer<typeof schemas.entreprises>;
        const r = await upsertCompany(db, { siren: d.siren, name: d.nom, website: d.site_internet }, prov);
        if (!r) throw new Error("SIREN sur la liste d'opposition");
      } else if (kind === 'comptes') {
        const d = parsed.data as z.infer<typeof schemas.comptes>;
        const c = await upsertCompany(db, { siren: d.siren }, prov);
        if (!c) throw new Error("SIREN sur la liste d'opposition");
        const status = d.statut ?? 'declarative';
        await db.batch([
          financialStmt(
            c.id,
            {
              fiscalYear: d.annee, closingDate: d.date_cloture ?? null, months: d.duree_mois, revenue: d.chiffre_affaires, grossMargin: d.marge_brute, valueAdded: d.valeur_ajoutee,
              ebe: d.ebe, operatingIncome: d.resultat_exploitation, netIncome: d.resultat_net, payroll: d.salaires_charges, depreciation: d.dotations, equity: d.capitaux_propres,
              totalDebt: d.dettes_financieres, totalLiabilities: d.total_dettes, cash: d.tresorerie, fixedAssets: d.immobilisations, inventory: d.stocks,
              receivables: d.creances_clients, payables: d.dettes_fournisseurs, totalAssets: d.total_bilan, headcount: d.effectif,
            },
            { sourceId: 'import-manuel', status, confidence: status === 'officielle' ? 70 : 45, collectedAt: at, url: d.source_url ?? null },
          ),
          { sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [c.id, at] },
        ]);
      } else if (kind === 'annonces') {
        const d = parsed.data as z.infer<typeof schemas.annonces>;
        let companyId: number | null = null;
        if (d.siren) companyId = (await upsertCompany(db, { siren: d.siren }, prov))?.id ?? null;
        const ext = d.reference || d.url || `${d.titre}|${d.commune ?? ''}|${d.date ?? ''}`;
        const r = await db.run(
          `INSERT INTO sale_listings (company_id, source_id, external_id, kind, status, is_offer, title, description, asking_price, declared_revenue, commune_name, department, sector_id, url, published_at, collected_at)
           VALUES (?, 'import-manuel', ?, ?, 'active', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(source_id, external_id) DO UPDATE SET title = excluded.title, description = excluded.description, asking_price = excluded.asking_price,
           declared_revenue = excluded.declared_revenue, company_id = COALESCE(excluded.company_id, sale_listings.company_id), collected_at = excluded.collected_at`,
          [companyId, ext.slice(0, 500), d.type ?? 'autre', d.source ? `${d.titre} (${d.source})` : d.titre, d.description ?? null, d.prix ?? null, d.ca ?? null, d.commune ?? null, d.departement ?? '76', classifySector(null, `${d.titre} ${d.description ?? ''}`).sectorId, d.url ?? null, d.date ?? null, at],
        );
        if (companyId) await db.run('INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', [companyId, at]);
        if (r.changes) await raiseAlert(db, { type: 'nouvelle_vente', severity: 'positif', companyId, title: `Annonce de cession importée : ${d.titre.slice(0, 120)}`, message: [d.commune, d.prix ? `prix demandé ${d.prix.toLocaleString('fr-FR')} €` : null, d.source].filter(Boolean).join(' — '), dedupeKey: `import:${ext.slice(0, 200)}` });
      } else {
        const d = parsed.data as z.infer<typeof schemas.signaux>;
        const c = await upsertCompany(db, { siren: d.siren }, prov);
        if (!c) throw new Error("SIREN sur la liste d'opposition");
        await db.batch([
          {
            sql: `INSERT INTO transmission_signals (company_id, signal_type, strength, evidence, evidence_url, source_id, detected_at) VALUES (?, ?, ?, ?, ?, 'import-manuel', ?)
                  ON CONFLICT(company_id, signal_type, source_id) DO UPDATE SET evidence = excluded.evidence, evidence_url = excluded.evidence_url, strength = excluded.strength`,
            params: [c.id, d.type, d.force, d.description, d.url ?? null, at],
          },
          { sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [c.id, at] },
        ]);
      }
      report.imported++;
    } catch (e) {
      report.errors.push({ line, message: (e as Error).message });
    }
  }
  await db.run("INSERT INTO audit_logs (user_id, action, entity_type, details) VALUES (?, 'import', ?, ?)", [userId, kind, JSON.stringify({ rows: report.rows, imported: report.imported, errors: report.errors.length })]);
  return report;
}

export const IMPORT_TEMPLATES: Record<ImportKind, string> = {
  entreprises: 'siren;nom;site_internet\n',
  comptes: 'siren;annee;date_cloture;duree_mois;chiffre_affaires;marge_brute;valeur_ajoutee;ebe;resultat_exploitation;resultat_net;salaires_charges;dotations;capitaux_propres;dettes_financieres;total_dettes;tresorerie;immobilisations;stocks;creances_clients;dettes_fournisseurs;total_bilan;effectif;statut;source_url\n',
  annonces: 'titre;type;prix;ca;commune;departement;siren;url;date;description;source;reference\n',
  signaux: 'siren;type;description;url;force\n',
};

/** Lignes d'export d'une recherche (toutes pages, plafonné). */
export async function exportRows(db: Db, f: SearchQuery, departments: string[]): Promise<{ headers: string[]; rows: unknown[][] }> {
  const all = await searchCompanies(db, { ...f, page: 1, pageSize: 500 }, departments);
  const rows = [...all.rows];
  for (let p = 2; rows.length < Math.min(all.total, 10000); p++) {
    const next = await searchCompanies(db, { ...f, page: p, pageSize: 500 }, departments);
    if (!next.rows.length) break;
    rows.push(...next.rows);
  }
  const procs = await db.all<{ company_id: number; type: ProcType; status: ProcStatus }>("SELECT company_id, type, status FROM legal_proceedings WHERE status != 'cloturee'");
  const procBy = new Map<number, string>();
  for (const p of procs) procBy.set(p.company_id, `${PROC_TYPE_LABELS[p.type]} (${PROC_STATUS_LABELS[p.status]})`);
  const headers = ['SIREN', 'Dénomination', 'Nom commercial', 'Commune', 'Code postal', 'Code NAF', 'Secteur', 'Forme juridique', 'Création', 'Effectif (tranche INSEE)', 'Site internet', 'Opportunité', 'Procédure en cours', 'Indice de transmission', 'Score économique', 'Score de risque', 'Fiabilité', 'Statut des données', 'Dernier exercice', "Chiffre d'affaires", 'Résultat net', 'EBE', 'Valeur centrale estimée (€)', 'Fiche annuaire officielle'];
  return {
    headers,
    rows: rows.map((r) => [
      r.siren, r.name, r.trade_name, r.commune_name, r.postal_code, r.naf_code, r.sector_id ? SECTOR_BY_ID.get(r.sector_id)?.label ?? r.sector_id : '', r.legal_form_label, r.creation_date,
      r.headcount_band ? HEADCOUNT_BANDS[r.headcount_band]?.label ?? r.headcount_band : '', r.website, r.primary_type ? OPPORTUNITY_LABELS[r.primary_type as OpportunityType] : '', procBy.get(r.id) ?? '',
      r.transmission_index, r.economic_score ?? 'données insuffisantes', r.risk_score, r.reliability_score, r.data_status, r.last_year, r.revenue, r.net_income, r.ebe,
      r.valuation_central, `https://annuaire-entreprises.data.gouv.fr/entreprise/${r.siren}`,
    ]),
  };
}

// --- Sauvegarde / restauration ------------------------------------------------
/** Tables sauvegardées, dans l'ordre de restauration (dépendances d'abord). Sessions et compteurs exclus. */
export const BACKUP_TABLES = [
  'settings', 'users', 'communes', 'sectors', 'sources', 'companies', 'establishments', 'company_identifiers', 'company_field_sources', 'company_changes',
  'company_financials', 'company_directors', 'legal_proceedings', 'source_records', 'company_events', 'sale_listings', 'transmission_signals', 'business_assets',
  'company_contacts', 'company_metrics', 'acquisition_opportunities', 'scoring_results', 'valuations', 'acquisition_projects', 'financial_scenarios',
  'saved_searches', 'alerts', 'acquisition_notes', 'project_contacts', 'documents', 'data_requests', 'suppression_list', 'sync_runs', 'sync_jobs', 'audit_logs',
] as const;

export async function createBackup(db: Db): Promise<{ format: string; version: number; created_at: string; tables: Record<string, Record<string, SqlValue>[]> }> {
  const tables: Record<string, Record<string, SqlValue>[]> = {};
  for (const t of BACKUP_TABLES) tables[t] = await db.all<Record<string, SqlValue>>(`SELECT * FROM ${t}`);
  return { format: 'normandie-business-radar', version: 1, created_at: new Date().toISOString(), tables };
}

export async function restoreBackup(db: Db, backup: unknown): Promise<Record<string, number>> {
  const b = backup as { format?: string; version?: number; tables?: Record<string, Record<string, SqlValue>[]> };
  if (b?.format !== 'normandie-business-radar' || b.version !== 1 || !b.tables) throw new Error('Fichier de sauvegarde non reconnu.');
  const counts: Record<string, number> = {};
  const stmts: Statement[] = [];
  for (const t of [...BACKUP_TABLES].reverse()) stmts.push({ sql: `DELETE FROM ${t}` });
  for (const t of BACKUP_TABLES) {
    const rows = b.tables[t] ?? [];
    const cols = (await db.all<{ name: string }>(`SELECT name FROM pragma_table_info('${t}')`)).map((c) => c.name);
    counts[t] = rows.length;
    for (const r of rows) {
      const keys = Object.keys(r).filter((k) => cols.includes(k));
      if (!keys.length) continue;
      stmts.push({ sql: `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`, params: keys.map((k) => r[k] ?? null) });
    }
  }
  stmts.push({ sql: 'DELETE FROM sessions' });
  // Une seule transaction : en cas d'erreur, rien n'est modifié.
  await db.batch(stmts);
  return counts;
}
