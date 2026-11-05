import type { Db } from './types';

/**
 * Schéma relationnel de Normandie Business Radar (SQLite / Cloudflare D1).
 *
 * Principes :
 * - Déduplication : une entreprise = un SIREN (companies.siren UNIQUE), un établissement = un SIRET (clé primaire),
 *   un enregistrement source = (source_id, external_id) UNIQUE.
 * - Provenance : chaque donnée importée garde sa source et sa date de collecte (source_records, company_field_sources,
 *   colonnes source_id / collected_at des tables de faits).
 * - Statut de la donnée : officielle | declarative | calculee | estimee | inconnue.
 * - Aucune donnée fictive n'est insérée par les migrations.
 */
const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyste' CHECK (role IN ('admin','analyste','lecteur')),
  disabled INTEGER NOT NULL DEFAULT 0,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,               -- SHA-256 du jeton (le jeton en clair n'est jamais stocké)
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip_hash TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- Référentiels -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS communes (
  code_insee TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  postal_codes TEXT,
  lat REAL,
  lon REAL,
  population INTEGER,
  source_id TEXT,
  collected_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_communes_dep ON communes(department);
CREATE INDEX IF NOT EXISTS idx_communes_name ON communes(name);

CREATE TABLE IF NOT EXISTS sectors (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES sectors(id),
  label TEXT NOT NULL,
  priority INTEGER,                 -- rang dans la liste des secteurs prioritaires (NULL = transversal)
  naf_codes TEXT NOT NULL DEFAULT '', -- codes NAF rév. 2 séparés par des virgules (ex. 62.01Z)
  keywords TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort INTEGER NOT NULL DEFAULT 0
);

-- Sources et synchronisation -------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}',
  last_sync_at TEXT,
  last_success_at TEXT,
  last_status TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS source_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL REFERENCES sources(id),
  external_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,         -- company | establishment | announcement | listing | commune | page
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  siren TEXT,
  url TEXT,
  published_at TEXT,
  payload_hash TEXT NOT NULL,
  payload TEXT,                      -- extrait JSON utile (borné) pour la traçabilité
  first_collected_at TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_source_records_company ON source_records(company_id);
CREATE INDEX IF NOT EXISTS idx_source_records_siren ON source_records(siren);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trigger TEXT NOT NULL,             -- cron | manuel | cli
  status TEXT NOT NULL DEFAULT 'running', -- running | success | partial | error
  started_at TEXT NOT NULL,
  finished_at TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS sync_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES sync_runs(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES sources(id),
  task TEXT NOT NULL,                -- identifiant de tâche du connecteur (ex. naf:62.01Z, bodacc:collective)
  status TEXT NOT NULL DEFAULT 'pending', -- pending | running | success | error | skipped
  cursor TEXT,                       -- état de reprise (JSON) : la tâche reprend où elle s'est arrêtée
  attempts INTEGER NOT NULL DEFAULT 0,
  fetched INTEGER NOT NULL DEFAULT 0,
  created INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  error_log TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_run ON sync_jobs(run_id);

-- Entreprises ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  siren TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  trade_name TEXT,
  acronym TEXT,
  legal_form_code TEXT,
  legal_form_label TEXT,
  naf_code TEXT,
  naf_label TEXT,
  sector_id TEXT REFERENCES sectors(id),
  creation_date TEXT,
  admin_status TEXT,                 -- A (active) | C (cessée) | NULL inconnu
  is_individual INTEGER,             -- entreprise individuelle (1/0/NULL)
  category TEXT,                     -- PME | ETI | GE (catégorie INSEE)
  headcount_band TEXT,               -- tranche INSEE (code)
  headcount_year TEXT,
  siege_siret TEXT,
  address TEXT,
  postal_code TEXT,
  commune_code TEXT,
  commune_name TEXT,
  department TEXT,
  lat REAL,
  lon REAL,
  geo_precision TEXT,                -- adresse | commune | NULL
  establishments_count INTEGER,
  open_establishments_count INTEGER,
  website TEXT,
  identity_checked_at TEXT,          -- dernière lecture de l'identité dans une source officielle
  first_seen_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_naf ON companies(naf_code);
CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector_id);
CREATE INDEX IF NOT EXISTS idx_companies_commune ON companies(commune_code);
CREATE INDEX IF NOT EXISTS idx_companies_dep ON companies(department);
CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(name);
CREATE INDEX IF NOT EXISTS idx_companies_geo ON companies(lat, lon);

CREATE TABLE IF NOT EXISTS establishments (
  siret TEXT PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  is_siege INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  address TEXT,
  postal_code TEXT,
  commune_code TEXT,
  commune_name TEXT,
  naf_code TEXT,
  admin_status TEXT,
  creation_date TEXT,
  headcount_band TEXT,
  lat REAL,
  lon REAL,
  source_id TEXT,
  collected_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_establishments_company ON establishments(company_id);

CREATE TABLE IF NOT EXISTS company_identifiers (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                -- siren | siret | rcs | tva | pappers | inpi
  value TEXT NOT NULL,
  source_id TEXT,
  collected_at TEXT,
  PRIMARY KEY (type, value)
);
CREATE INDEX IF NOT EXISTS idx_identifiers_company ON company_identifiers(company_id);

-- Provenance champ par champ : source, date, statut et confiance de chaque information affichée.
CREATE TABLE IF NOT EXISTS company_field_sources (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  value TEXT,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- officielle | declarative | calculee | estimee | inconnue
  confidence INTEGER NOT NULL,       -- 0..100
  collected_at TEXT NOT NULL,
  url TEXT,
  PRIMARY KEY (company_id, field)
);

-- Historique des changements de données (ancienne / nouvelle valeur).
CREATE TABLE IF NOT EXISTS company_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source_id TEXT,
  changed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_changes_company ON company_changes(company_id);

CREATE TABLE IF NOT EXISTS company_financials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fiscal_year INTEGER NOT NULL,
  closing_date TEXT,
  months INTEGER,
  revenue REAL,                      -- chiffre d'affaires
  gross_margin REAL,                 -- marge brute (marge commerciale + production - consommations) si fournie
  value_added REAL,
  ebe REAL,                          -- excédent brut d'exploitation (fourni par la source)
  ebitda REAL,
  operating_income REAL,             -- résultat d'exploitation
  net_income REAL,                   -- résultat net
  payroll REAL,                      -- salaires et charges sociales
  depreciation REAL,                 -- dotations aux amortissements et provisions
  equity REAL,                       -- capitaux propres
  total_debt REAL,                   -- dettes financières
  total_liabilities REAL,            -- total des dettes
  cash REAL,                         -- trésorerie
  fixed_assets REAL,                 -- immobilisations nettes
  inventory REAL,
  receivables REAL,
  payables REAL,
  total_assets REAL,
  headcount REAL,
  source_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'officielle',
  confidence INTEGER NOT NULL DEFAULT 80,
  url TEXT,
  collected_at TEXT NOT NULL,
  UNIQUE (company_id, fiscal_year, source_id)
);
CREATE INDEX IF NOT EXISTS idx_financials_company ON company_financials(company_id);

CREATE TABLE IF NOT EXISTS company_directors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                -- personne_physique | personne_morale
  name TEXT NOT NULL,
  first_names TEXT,
  role TEXT,
  director_siren TEXT,
  source_id TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  UNIQUE (company_id, kind, name, first_names, role)
);

CREATE TABLE IF NOT EXISTS legal_proceedings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                -- sauvegarde | redressement | liquidation | conciliation | retablissement | autre
  status TEXT NOT NULL,              -- ouverte | en_cours | plan_arrete | cession_arretee | cloturee
  opened_at TEXT,
  last_event_at TEXT,
  closed_at TEXT,
  closure_reason TEXT,
  tribunal TEXT,
  latest_nature TEXT,
  administrator TEXT,                -- mandataire / liquidateur tel que publié au BODACC (texte officiel)
  url TEXT,
  source_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proceedings_company ON legal_proceedings(company_id);
CREATE INDEX IF NOT EXISTS idx_proceedings_status ON legal_proceedings(status, type);

CREATE TABLE IF NOT EXISTS company_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  proceeding_id INTEGER REFERENCES legal_proceedings(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,          -- procedure | vente | creation | modification | radiation | depot_comptes | signal | autre
  event_date TEXT,
  title TEXT NOT NULL,
  details TEXT,
  tribunal TEXT,
  reference TEXT,
  url TEXT,
  source_id TEXT NOT NULL,
  source_record_id INTEGER REFERENCES source_records(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  UNIQUE (source_id, reference)
);
CREATE INDEX IF NOT EXISTS idx_events_company ON company_events(company_id, event_date);

CREATE TABLE IF NOT EXISTS sale_listings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  source_id TEXT NOT NULL,
  external_id TEXT NOT NULL,
  kind TEXT NOT NULL,                -- fonds_de_commerce | societe | titres | actifs | clientele | plan_cession | autre
  status TEXT NOT NULL DEFAULT 'active', -- active | retiree | realisee | inconnue
  is_offer INTEGER NOT NULL DEFAULT 1,   -- 1 = annonce d'entreprise à vendre ; 0 = cession déjà réalisée (avis BODACC)
  title TEXT NOT NULL,
  description TEXT,
  asking_price REAL,
  declared_revenue REAL,
  commune_name TEXT,
  department TEXT,
  sector_id TEXT,
  url TEXT,
  published_at TEXT,
  collected_at TEXT NOT NULL,
  UNIQUE (source_id, external_id)
);
CREATE INDEX IF NOT EXISTS idx_listings_company ON sale_listings(company_id);

CREATE TABLE IF NOT EXISTS transmission_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  strength INTEGER NOT NULL,         -- 1 faible, 2 moyen, 3 fort (preuve explicite)
  evidence TEXT NOT NULL,            -- extrait ou fait public vérifiable
  evidence_url TEXT,
  source_id TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  UNIQUE (company_id, signal_type, source_id)
);

CREATE TABLE IF NOT EXISTS business_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  description TEXT NOT NULL,
  value REAL,
  value_status TEXT NOT NULL DEFAULT 'inconnue',
  source_id TEXT NOT NULL,
  collected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS company_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                -- telephone | email | site | autre
  value TEXT NOT NULL,
  source_id TEXT NOT NULL,
  url TEXT,
  collected_at TEXT NOT NULL,
  UNIQUE (company_id, kind, value)
);

-- Résultats d'analyse ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS acquisition_opportunities (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  types TEXT NOT NULL,               -- JSON : a_vendre, procedure, transmission, cachee
  primary_type TEXT NOT NULL,
  reasons TEXT NOT NULL,             -- JSON : règles déclenchées (explicables)
  transmission_index INTEGER,        -- indice de transmission potentielle 0..100 (signaux publics uniquement)
  first_detected_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_opps_type ON acquisition_opportunities(primary_type);

CREATE TABLE IF NOT EXISTS scoring_results (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  economic_score INTEGER,            -- NULL = données insuffisantes
  risk_score INTEGER,
  reliability_score INTEGER NOT NULL,
  data_status TEXT NOT NULL,         -- suffisant | partiel | insuffisant
  detail TEXT NOT NULL,              -- JSON : composantes, justification
  weights_version TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scores_eco ON scoring_results(economic_score);

CREATE TABLE IF NOT EXISTS valuations (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  low REAL,
  central REAL,
  high REAL,
  detail TEXT NOT NULL,              -- JSON : méthodes, hypothèses, limites
  computed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS financial_scenarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES acquisition_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  params TEXT NOT NULL,
  results TEXT NOT NULL,
  created_by INTEGER,
  created_at TEXT NOT NULL
);

-- Utilisateur : recherches, alertes, acquisitions --------------------------------
CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  alert_enabled INTEGER NOT NULL DEFAULT 0,
  last_count INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info', -- info | positif | attention | critique
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  dedupe_key TEXT NOT NULL UNIQUE,
  run_id INTEGER,
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts(created_at);

CREATE TABLE IF NOT EXISTS acquisition_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'nouvelle',
  priority INTEGER NOT NULL DEFAULT 2,
  asking_price REAL,
  estimated_price REAL,
  offer_price REAL,
  next_action TEXT,
  next_action_at TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS acquisition_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES acquisition_projects(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'note', -- note | action | statut | rappel
  content TEXT NOT NULL,
  due_at TEXT,
  done_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_project ON acquisition_notes(project_id);

CREATE TABLE IF NOT EXISTS project_contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES acquisition_projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  organisation TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES acquisition_projects(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL
);

-- RGPD : demandes d'accès / suppression / opposition des personnes concernées.
CREATE TABLE IF NOT EXISTS data_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                -- suppression | acces | rectification | opposition
  subject TEXT NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'recue', -- recue | traitee | rejetee
  notes TEXT,
  created_at TEXT NOT NULL,
  processed_at TEXT
);

-- Dernières valeurs connues (dénormalisées pour les filtres et tris de la recherche avancée).
CREATE TABLE IF NOT EXISTS company_metrics (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  last_year INTEGER,
  revenue REAL,
  net_income REAL,
  ebe REAL,
  revenue_cagr REAL,
  years_count INTEGER NOT NULL DEFAULT 0,
  has_active_proceeding INTEGER NOT NULL DEFAULT 0,
  signals_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_metrics_revenue ON company_metrics(revenue);

-- File d'attente des entreprises à réanalyser (scores, valorisation, opportunités) après une mise à jour.
CREATE TABLE IF NOT EXISTS analysis_queue (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  queued_at TEXT NOT NULL
);

-- Personnes ou entreprises ayant demandé à ne plus être traitées (suppression + opposition).
CREATE TABLE IF NOT EXISTS suppression_list (
  siren TEXT PRIMARY KEY,
  reason TEXT,
  created_at TEXT NOT NULL
);
`,
  },
];

export async function migrate(db: Db): Promise<void> {
  await db.run('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
  const done = new Set((await db.all<{ version: number }>('SELECT version FROM schema_migrations')).map((r) => r.version));
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    const statements = splitSql(m.sql);
    await db.batch([
      ...statements.map((sql) => ({ sql })),
      { sql: 'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', params: [m.version, new Date().toISOString()] },
    ]);
  }
}

/** Découpe un script SQL en instructions (pas de « ; » dans les littéraux de ce schéma). */
export function splitSql(sql: string): string[] {
  return sql
    .split('\n')
    .map((l) => l.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
}
