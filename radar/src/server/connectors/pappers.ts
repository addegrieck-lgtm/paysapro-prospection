/**
 * Pappers — API commerciale (crédits gratuits limités, puis payante). FACULTATIVE : l'outil fonctionne sans elle.
 * Utilisée avec un plafond quotidien (réglage « maxPappersPerDay », 0 par défaut) et uniquement sur les entreprises
 * suivies, pour obtenir des agrégats financiers détaillés (EBE, résultat d'exploitation, capitaux propres…).
 */
import type { FinancialYear } from '../domain/financial';
import { financialStmt, recordSource } from '../services/companies';
import { getKv, setKv } from '../services/settings';
import { emptyChunk, type ChunkResult, type Connector } from './types';

export const PAPPERS_BASE = 'https://api.pappers.fr/v2';

export interface PappersFinance {
  annee?: number;
  date_de_cloture_exercice?: string;
  duree_exercice?: number;
  chiffre_affaires?: number | null;
  resultat?: number | null;
  effectif?: number | null;
  marge_brute?: number | null;
  excedent_brut_exploitation?: number | null;
  resultat_exploitation?: number | null;
  capitaux_propres?: number | null;
  dettes_financieres?: number | null;
  tresorerie?: number | null;
  valeur_ajoutee?: number | null;
  total_actif?: number | null;
  total_bilan?: number | null;
}

const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function mapPappersFinance(f: PappersFinance): FinancialYear & { closingDate?: string | null } {
  const fy = f.annee ?? (f.date_de_cloture_exercice ? Number(f.date_de_cloture_exercice.slice(-4)) || Number(f.date_de_cloture_exercice.slice(0, 4)) : NaN);
  return {
    fiscalYear: fy,
    closingDate: f.date_de_cloture_exercice ?? null,
    months: n(f.duree_exercice),
    revenue: n(f.chiffre_affaires),
    netIncome: n(f.resultat),
    headcount: n(f.effectif),
    grossMargin: n(f.marge_brute),
    ebe: n(f.excedent_brut_exploitation),
    operatingIncome: n(f.resultat_exploitation),
    equity: n(f.capitaux_propres),
    totalDebt: n(f.dettes_financieres),
    cash: n(f.tresorerie),
    valueAdded: n(f.valeur_ajoutee),
    totalAssets: n(f.total_bilan ?? f.total_actif),
  };
}

export const pappers: Connector = {
  id: 'pappers',
  label: 'Pappers (facultatif, payant)',
  description: 'Agrégats financiers détaillés des comptes publiés, pour les entreprises suivies uniquement, avec plafond quotidien.',
  official: false,
  requiredSecrets: ['PAPPERS_API_TOKEN'],
  defaultEnabled: false,
  provides: ['EBE, résultat d\'exploitation, marge brute, capitaux propres, dettes financières, trésorerie (comptes publiés)'],
  license: "Conditions générales de l'API Pappers (usage selon abonnement ; données issues des registres officiels)",
  termsUrl: 'https://www.pappers.fr/cgu',
  docsUrl: 'https://www.pappers.fr/api/documentation',
  quotas: 'Selon abonnement (crédits) ; plafond quotidien configurable dans l\'administration',
  keyProcedure: "Créer un compte sur https://www.pappers.fr/api, récupérer le jeton d'API et le définir comme secret PAPPERS_API_TOKEN. Fixer ensuite le plafond quotidien (Administration → Paramètres → Synchronisation).",
  limitations: ['Service payant au-delà des crédits gratuits.', 'Données intermédiées (non officielles en tant que telles) : confiance légèrement inférieure aux registres.'],
  async planTasks(ctx) {
    const max = ctx.settings.sync.maxPappersPerDay;
    return Array.from({ length: Math.ceil(Math.max(0, max) / 10) }, (_, i) => `finances:${i + 1}`);
  },
  async runChunk(ctx): Promise<ChunkResult> {
    const day = ctx.now().toISOString().slice(0, 10);
    const usedKey = `pappers:${day}`;
    const used = Number((await getKv(ctx.db, usedKey)) ?? 0);
    const left = ctx.settings.sync.maxPappersPerDay - used;
    if (left <= 0) return { ...emptyChunk(), errors: ['Plafond quotidien Pappers atteint'] };
    const rows = await ctx.db.all<{ id: number; siren: string }>(
      `SELECT c.id, c.siren FROM companies c
       LEFT JOIN scoring_results s ON s.company_id = c.id
       WHERE (EXISTS (SELECT 1 FROM acquisition_projects p WHERE p.company_id = c.id) OR EXISTS (SELECT 1 FROM acquisition_opportunities o WHERE o.company_id = c.id))
         AND NOT EXISTS (SELECT 1 FROM source_records r WHERE r.source_id = 'pappers' AND r.external_id = c.siren AND r.collected_at > ?)
       ORDER BY EXISTS (SELECT 1 FROM acquisition_projects p WHERE p.company_id = c.id) DESC, s.economic_score DESC LIMIT ?`,
      [new Date(ctx.now().getTime() - 180 * 86400_000).toISOString(), Math.min(left, 10)],
    );
    const http = ctx.http({ minIntervalMs: 300 });
    const out: ChunkResult = { ...emptyChunk(null, true) };
    const at = ctx.now().toISOString();
    let count = used;
    for (const r of rows) {
      try {
        const data = await http.json<{ finances?: PappersFinance[] }>(`${PAPPERS_BASE}/entreprise?api_token=${encodeURIComponent(ctx.secrets.PAPPERS_API_TOKEN ?? '')}&siren=${r.siren}`);
        count++;
        out.fetched++;
        const url = `https://www.pappers.fr/entreprise/${r.siren}`;
        const years = (data.finances ?? []).map(mapPappersFinance).filter((y) => Number.isInteger(y.fiscalYear));
        if (years.length) {
          await ctx.db.batch([
            ...years.map((y) => financialStmt(r.id, y, { sourceId: 'pappers', status: 'officielle', confidence: 75, collectedAt: at, url })),
            { sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [r.id, at] },
          ]);
          out.updated++;
        }
        await recordSource(ctx.db, { sourceId: 'pappers', externalId: r.siren, entityType: 'company', companyId: r.id, siren: r.siren, url, payload: { finances: data.finances ?? [] } });
      } catch (e) {
        count++; // une requête facturée même en cas d'erreur applicative
        out.errors.push(`SIREN ${r.siren} : ${(e as Error).message}`);
      }
    }
    await setKv(ctx.db, usedKey, String(count));
    return out; // un lot de 10 entreprises au plus par tâche
  },
};
