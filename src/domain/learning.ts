// StrategyLearningEngine : apprentissage par STATISTIQUES (sans réentraîner d'IA, sans service payant).
//
// Principe :
//   1. chaque stratégie exécutée enregistre, par champ et par segment (secteur × région × taille) :
//      essais, réussites, données trouvées, données « vérifiées », coût, durée ;
//   2. les retours de l'utilisateur (✓ correct / ✗ incorrect, corrections manuelles) ajoutent les faux positifs
//      et les confirmations : TROUVÉ ≠ CORRECT (100 numéros trouvés dont 40 faux → précision 60 %) ;
//   3. avant chaque recherche, le moteur estime pour chaque stratégie la probabilité de trouver et la précision,
//      au niveau de segment le plus précis qui a assez d'historique (sinon secteur, sinon global, sinon a priori) ;
//   4. il choisit la stratégie de plus forte valeur attendue (80 %) ou explore une stratégie peu testée (20 %) ;
//   5. il s'arrête quand les coordonnées recherchées sont assez sûres ou quand le budget du mode est épuisé.
// Les statistiques influencent donc réellement : choix, ordre, arrêt et budget (entreprise difficile).
import type { ContactField, EnrichmentMode, Prospect, Segment3, StrategyId, StrategyStat } from './types';
import { STRATEGY_BY_ID, type StrategyDef } from './strategies';

/** Réglages (centralisés, modifiables). */
export const LEARNING_CONFIG = {
  /** Part d'exploration par défaut (surchargée par Paramètres) */
  exploration: 0.2,
  /** Poids de l'a priori (en « essais fictifs ») : évite de conclure sur 2 essais */
  priorWeight: 4,
  /** Historique minimal pour utiliser un segment précis */
  minSamples: 10,
  /** Formule du score de stratégie (affiché dans « Performance de l'IA ») */
  weights: { precision: 1, successRate: 1, relevance: 0.5, cost: 0.03, falsePositiveRate: 1 },
  /** Valeur relative de chaque champ recherché */
  fieldValue: { phone: 1, email: 0.8, website: 0.6 } as Record<ContactField, number>,
  /** Arrêt : champ considéré comme trouvé à partir de cette confiance */
  stop: { phone: 90, email: 90, website: 70 } as Record<ContactField, number>,
};

export interface Budget {
  maxStrategies: number;
  maxRequests: number;
  maxMs: number;
}

/** Budgets par mode ; une entreprise « difficile » (rien trouvé à mi-budget) reçoit une rallonge de 50 %. */
export const MODE_BUDGETS: Record<EnrichmentMode, Budget> = {
  fast: { maxStrategies: 3, maxRequests: 10, maxMs: 25_000 },
  normal: { maxStrategies: 6, maxRequests: 24, maxMs: 60_000 },
  max: { maxStrategies: 14, maxRequests: 60, maxMs: 150_000 },
};

export const MODE_LABEL: Record<EnrichmentMode, string> = { fast: 'Rapide', normal: 'Normal', max: 'Maximum contact' };

// ─── Segments ───

export function sectorOf(naf: string | null | undefined): string {
  if (!naf) return 'autre';
  if (naf.startsWith('81.3')) return 'paysage';
  if (naf.startsWith('01.') || naf.startsWith('02.')) return 'agriculture';
  if (naf.startsWith('45.')) return 'automobile';
  if (naf.startsWith('41.') || naf.startsWith('42.') || naf.startsWith('43.')) return 'bâtiment';
  return `naf ${naf.slice(0, 2)}`;
}

export function sizeOf(p: Pick<Prospect, 'headcount' | 'headcountBand'>): string {
  const n = p.headcount ?? ({ NN: null, '00': 0, '01': 1, '02': 3, '03': 6, '11': 10, '12': 20, '21': 50 } as Record<string, number | null>)[p.headcountBand ?? 'NN'] ?? null;
  if (n === null || n === undefined) return 'inconnue';
  return n === 0 ? '0' : n < 10 ? '1-9' : n < 50 ? '10-49' : '50+';
}

export function segmentOf(p: Pick<Prospect, 'nafCode' | 'region' | 'department' | 'headcount' | 'headcountBand'>): Segment3 {
  return { sector: sectorOf(p.nafCode), region: p.region || (p.department ? `dép. ${p.department}` : 'inconnue'), size: sizeOf(p) };
}

export function statKey(strategyId: StrategyId, field: ContactField, s: Segment3): string {
  return `${strategyId}|${field}|${s.sector}|${s.region}|${s.size}`;
}

export function emptyStat(workspaceId: string, strategyId: StrategyId, field: ContactField, s: Segment3, now: string): StrategyStat {
  return {
    id: `${workspaceId}|${statKey(strategyId, field, s)}`,
    workspaceId,
    strategyId,
    field,
    ...s,
    attempts: 0,
    successes: 0,
    found: 0,
    verified: 0,
    confirmedLow: 0,
    confirmed: 0,
    falsePositive: 0,
    falsePositiveVerified: 0,
    sumConfidence: 0,
    sumCost: 0,
    sumMs: 0,
    lastUsedAt: now,
  };
}

// ─── Estimations ───

export interface Estimate {
  /** Probabilité de trouver au moins une donnée nouvelle */
  successRate: number;
  /** Part des données trouvées qui sont correctes */
  precision: number;
  falsePositiveRate: number;
  averageCost: number;
  attempts: number;
  /** Niveau d'historique utilisé */
  level: 'segment' | 'secteur + région' | 'secteur' | 'global' | 'a priori';
}

type Agg = Pick<StrategyStat, 'attempts' | 'successes' | 'found' | 'verified' | 'confirmedLow' | 'falsePositive' | 'falsePositiveVerified' | 'sumCost'>;

function sum(list: StrategyStat[]): Agg {
  const a: Agg = { attempts: 0, successes: 0, found: 0, verified: 0, confirmedLow: 0, falsePositive: 0, falsePositiveVerified: 0, sumCost: 0 };
  for (const s of list) for (const k of Object.keys(a) as (keyof Agg)[]) a[k] += s[k];
  return a;
}

/** Données correctes estimées : vérifiées (≥ 80) non contredites + confirmées par l'utilisateur. */
export function correctOf(a: Agg): number {
  return Math.max(0, a.verified - a.falsePositiveVerified + a.confirmedLow);
}

export function estimate(stats: StrategyStat[], def: StrategyDef, field: ContactField, seg: Segment3): Estimate {
  const mine = stats.filter((s) => s.strategyId === def.id && s.field === field);
  const levels: [Estimate['level'], StrategyStat[]][] = [
    ['segment', mine.filter((s) => s.sector === seg.sector && s.region === seg.region && s.size === seg.size)],
    ['secteur + région', mine.filter((s) => s.sector === seg.sector && s.region === seg.region)],
    ['secteur', mine.filter((s) => s.sector === seg.sector)],
    ['global', mine],
  ];
  for (const [level, list] of levels) {
    const a = sum(list);
    if (a.attempts < LEARNING_CONFIG.minSamples && level !== 'global') continue;
    if (a.attempts === 0) break;
    return { ...estimateFromAgg(a, def), level };
  }
  return { successRate: def.prior.success, precision: def.prior.precision, falsePositiveRate: 0, averageCost: def.cost, attempts: 0, level: 'a priori' };
}

/** strategyScore = précision + taux de réussite + pertinence − coût − taux de faux positifs (poids réglables). */
export function strategyScore(e: Estimate, relevance: number, cost: number): number {
  const w = LEARNING_CONFIG.weights;
  return w.precision * e.precision + w.successRate * e.successRate + w.relevance * relevance - w.cost * cost - w.falsePositiveRate * e.falsePositiveRate;
}

/**
 * Valeur attendue d'une stratégie pour les champs manquants : Σ P(trouver) × précision × valeur du champ,
 * moins le coût. Le site vaut davantage quand téléphone ou e-mail manquent (il donne accès à leurs pages).
 */
export function expectedValue(def: StrategyDef, missing: ContactField[], stats: StrategyStat[], seg: Segment3): { value: number; score: number; estimates: Partial<Record<ContactField, Estimate>> } {
  const targeted = def.fields.filter((f) => missing.includes(f));
  const estimates: Partial<Record<ContactField, Estimate>> = {};
  let value = 0;
  let best: Estimate | null = null;
  for (const f of targeted) {
    const e = estimate(stats, def, f, seg);
    estimates[f] = e;
    const fieldValue = f === 'website' && (missing.includes('phone') || missing.includes('email')) ? 0.9 : LEARNING_CONFIG.fieldValue[f];
    value += e.successRate * e.precision * fieldValue;
    if (!best || e.successRate * e.precision > best.successRate * best.precision) best = e;
  }
  const cost = best?.averageCost ?? def.cost;
  value -= LEARNING_CONFIG.weights.cost * cost;
  const relevance = missing.length ? targeted.length / missing.length : 0;
  return { value, score: best ? strategyScore(best, relevance, cost) : 0, estimates };
}

export interface Choice {
  def: StrategyDef;
  explored: boolean;
  expectedValue: number;
}

/**
 * Exploitation / exploration : avec la probabilité `exploration`, on teste la stratégie la MOINS essayée
 * (pour découvrir de meilleures pistes) ; sinon la meilleure valeur attendue.
 */
export function chooseStrategy(candidates: StrategyDef[], missing: ContactField[], stats: StrategyStat[], seg: Segment3, rng: () => number = Math.random, exploration = LEARNING_CONFIG.exploration): Choice | null {
  if (!candidates.length) return null;
  const scored = candidates.map((def) => {
    const ev = expectedValue(def, missing, stats, seg);
    const attempts = def.fields.filter((f) => missing.includes(f)).reduce((n, f) => n + (ev.estimates[f]?.attempts ?? 0), 0);
    return { def, ev: ev.value, attempts };
  });
  if (scored.length > 1 && rng() < exploration) {
    const least = Math.min(...scored.map((s) => s.attempts));
    const pool = scored.filter((s) => s.attempts === least);
    const pick = pool[Math.floor(rng() * pool.length)] ?? pool[0]!;
    return { def: pick.def, explored: true, expectedValue: pick.ev };
  }
  scored.sort((a, b) => b.ev - a.ev || a.def.cost - b.def.cost);
  return { def: scored[0]!.def, explored: false, expectedValue: scored[0]!.ev };
}

// ─── Mise à jour des statistiques ───

export interface RunOutcome {
  strategyId: StrategyId;
  targeted: ContactField[];
  /** Données nouvelles produites, par champ, avec leur confiance à la découverte */
  produced: Partial<Record<ContactField, number[]>>;
  requests: number;
  ms: number;
}

/** Applique le résultat d'une exécution aux lignes de statistiques (une par champ recherché). */
export function applyRun(stats: Map<string, StrategyStat>, o: RunOutcome, seg: Segment3, workspaceId: string, now: string): void {
  for (const field of o.targeted) {
    const id = `${workspaceId}|${statKey(o.strategyId, field, seg)}`;
    const s = stats.get(id) ?? emptyStat(workspaceId, o.strategyId, field, seg, now);
    const items = o.produced[field] ?? [];
    s.attempts += 1;
    s.successes += items.length ? 1 : 0;
    s.found += items.length;
    s.verified += items.filter((c) => c >= 80).length;
    s.sumConfidence += items.reduce((a, b) => a + b, 0);
    s.sumCost += o.requests / Math.max(1, o.targeted.length);
    s.sumMs += o.ms / Math.max(1, o.targeted.length);
    s.lastUsedAt = now;
    stats.set(id, s);
  }
}

/**
 * Retour utilisateur sur une donnée produite par une stratégie. `previous` : retour déjà donné (annulé d'abord,
 * pour qu'un changement d'avis ne compte jamais deux fois).
 */
export function applyFeedback(s: StrategyStat, feedback: 'correct' | 'incorrect', scoreAtDiscovery: number, previous: 'correct' | 'incorrect' | null = null): StrategyStat {
  const next = { ...s };
  const high = scoreAtDiscovery >= 80;
  const apply = (f: 'correct' | 'incorrect', sign: 1 | -1) => {
    if (f === 'correct') {
      next.confirmed += sign;
      if (!high) next.confirmedLow += sign;
    } else {
      next.falsePositive += sign;
      if (high) next.falsePositiveVerified += sign;
    }
  };
  if (previous) apply(previous, -1);
  apply(feedback, 1);
  for (const k of ['confirmed', 'confirmedLow', 'falsePositive', 'falsePositiveVerified'] as const) next[k] = Math.max(0, next[k]);
  return next;
}

/** Vue d'ensemble d'une stratégie (écran « Performance de l'IA »). */
export function summarizeStrategy(stats: StrategyStat[], id: StrategyId) {
  const def = STRATEGY_BY_ID.get(id);
  const mine = stats.filter((s) => s.strategyId === id);
  const a = sum(mine);
  // Une exécution cherche plusieurs champs (une ligne par champ) : essais et réussites = par exécution
  // (maximum des champs, segment par segment) ; les données trouvées s'additionnent.
  const bySeg = new Map<string, StrategyStat[]>();
  for (const s of mine) bySeg.set(`${s.sector}|${s.region}|${s.size}`, [...(bySeg.get(`${s.sector}|${s.region}|${s.size}`) ?? []), s]);
  a.attempts = 0;
  a.successes = 0;
  a.sumCost = 0;
  for (const list of bySeg.values()) {
    a.attempts += Math.max(...list.map((s) => s.attempts));
    a.successes += Math.max(...list.map((s) => s.successes));
    a.sumCost += list.reduce((n, s) => n + s.sumCost, 0);
  }
  const correct = correctOf(a);
  return {
    id,
    label: def?.label ?? id,
    source: def?.source ?? '—',
    attempts: a.attempts,
    successRate: a.attempts ? a.successes / a.attempts : null,
    found: a.found,
    verified: a.verified,
    falsePositive: a.falsePositive,
    precision: a.found ? correct / a.found : null,
    averageCost: a.attempts ? a.sumCost / a.attempts : null,
    score: def && a.attempts ? strategyScore(estimateFromAgg(a, def), 1, a.sumCost / a.attempts) : null,
  };
}

function estimateFromAgg(a: Agg, def: StrategyDef): Estimate {
  const k = LEARNING_CONFIG.priorWeight;
  return {
    successRate: (a.successes + def.prior.success * k) / (a.attempts + k),
    precision: (correctOf(a) + def.prior.precision * k) / (a.found + k),
    falsePositiveRate: a.falsePositive / (a.found + k),
    averageCost: a.attempts ? a.sumCost / a.attempts : def.cost,
    attempts: a.attempts,
    level: 'global',
  };
}
