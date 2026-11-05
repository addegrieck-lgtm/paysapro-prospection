import type { Db } from '../db/types';
import { DEFAULT_RISK_WEIGHTS, DEFAULT_WEIGHTS, type RiskWeights, type ScoringWeights } from '../domain/scoring';
import { DEFAULT_VALUATION_SETTINGS, type ValuationSettings } from '../domain/valuation';
import { DEFAULT_DEAL } from '../domain/scenarios';

export interface AlertSettings {
  enabled: Record<string, boolean>;
  highScoreThreshold: number; // score économique déclenchant « nouvelle opportunité à score élevé »
  minReliability: number; // fiabilité minimale pour cette alerte
  financialChangeThreshold: number; // variation relative du CA / résultat déclenchant une alerte (0.2 = 20 %)
}

export interface RetentionSettings {
  auditLogsDays: number;
  syncJobsDays: number;
  alertsDays: number;
  sourcePayloadDays: number; // extraits bruts des sources (traçabilité)
  inactiveCompanyDays: number; // entreprises sans opportunité, ni projet, ni mise à jour depuis…
}

export interface SyncSettings {
  departments: string[];
  bodaccBackfillYears: { collective: number; vente: number; radiation: number };
  enrichPerTick: number;
  identityRefreshDays: number;
  maxPappersPerDay: number;
  websiteChecksPerTick: number;
}

export interface AppSettings {
  scoringWeights: ScoringWeights;
  riskWeights: RiskWeights;
  valuation: ValuationSettings;
  deal: typeof DEFAULT_DEAL;
  alerts: AlertSettings;
  retention: RetentionSettings;
  sync: SyncSettings;
  ai: { provider: 'local' | 'anthropic'; model: string; monthlyBudgetUsd: number; sendCompanyNames: boolean };
  map: { tileUrl: string; attribution: string };
}

export const ALERT_TYPES: Record<string, string> = {
  nouvelle_vente: 'Nouvelle entreprise à vendre',
  nouvelle_liquidation: 'Nouvelle liquidation',
  nouveau_redressement: 'Nouveau redressement',
  nouvelle_sauvegarde: 'Nouvelle sauvegarde',
  nouvelle_transmission: 'Nouvelle transmission (cession réalisée publiée)',
  nouveau_signal: 'Nouveau signal de reprise potentielle',
  degradation_financiere: 'Dégradation financière documentée',
  amelioration_financiere: 'Amélioration financière documentée',
  score_eleve: 'Nouvelle opportunité avec score élevé',
  changement_procedure: 'Changement important de procédure',
  recherche_enregistree: 'Nouveaux résultats d\'une recherche enregistrée',
  source_en_erreur: 'Source en erreur',
};

export const DEFAULT_SETTINGS: AppSettings = {
  scoringWeights: DEFAULT_WEIGHTS,
  riskWeights: DEFAULT_RISK_WEIGHTS,
  valuation: DEFAULT_VALUATION_SETTINGS,
  deal: DEFAULT_DEAL,
  alerts: { enabled: Object.fromEntries(Object.keys(ALERT_TYPES).map((k) => [k, true])), highScoreThreshold: 70, minReliability: 50, financialChangeThreshold: 0.2 },
  retention: { auditLogsDays: 730, syncJobsDays: 180, alertsDays: 365, sourcePayloadDays: 730, inactiveCompanyDays: 1095 },
  sync: { departments: ['76'], bodaccBackfillYears: { collective: 5, vente: 2, radiation: 1 }, enrichPerTick: 20, identityRefreshDays: 30, maxPappersPerDay: 0, websiteChecksPerTick: 5 },
  ai: { provider: 'local', model: 'claude-opus-5-5', monthlyBudgetUsd: 5, sendCompanyNames: true },
  map: { tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© contributeurs OpenStreetMap' },
};

type Key = keyof AppSettings;

function merge<T>(def: T, val: unknown): T {
  if (Array.isArray(def)) return (Array.isArray(val) ? val : def) as T;
  if (def && typeof def === 'object') {
    const out: Record<string, unknown> = { ...(def as Record<string, unknown>) };
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
        out[k] = k in out ? merge(out[k], v) : v;
      }
    }
    return out as T;
  }
  return (val === undefined || val === null || typeof val !== typeof def ? def : val) as T;
}

export async function getSettings(db: Db): Promise<AppSettings> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out = structuredClone(DEFAULT_SETTINGS) as AppSettings;
  for (const r of rows) {
    if (r.key in out) {
      try {
        (out as unknown as Record<string, unknown>)[r.key] = merge((DEFAULT_SETTINGS as unknown as Record<string, unknown>)[r.key], JSON.parse(r.value));
      } catch {
        /* valeur corrompue : défaut conservé */
      }
    }
  }
  return out;
}

export async function setSetting<K extends Key>(db: Db, key: K, value: AppSettings[K]): Promise<void> {
  if (!(key in DEFAULT_SETTINGS)) throw new Error(`Réglage inconnu : ${key}`);
  const merged = merge(DEFAULT_SETTINGS[key], value);
  await db.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [key, JSON.stringify(merged), new Date().toISOString()],
  );
}

export async function getKv(db: Db, key: string): Promise<string | null> {
  return (await db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [`kv:${key}`]))?.value ?? null;
}

export async function setKv(db: Db, key: string, value: string): Promise<void> {
  await db.run(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`, [`kv:${key}`, value, new Date().toISOString()]);
}
