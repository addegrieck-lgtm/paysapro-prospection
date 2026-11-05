/**
 * Valorisation multi-méthodes. Les coefficients (multiples, taux d'actualisation…) sont des HYPOTHÈSES DE TRAVAIL
 * paramétrables dans l'administration : ils ne constituent pas des références de marché officielles.
 * Une méthode n'est appliquée que si ses données d'entrée existent ; chaque résultat liste ses hypothèses et limites.
 */
import { analyzeTrends, ebeOf, normalizedEbe, type FinancialYear } from './financial';

export type Range3 = [number, number, number];

export interface ValuationSettings {
  /** Multiples d'EBE (bas, central, haut) par taille de CA : < 1 M€, 1 à 10 M€, > 10 M€. */
  ebeMultiples: { micro: Range3; petite: Range3; moyenne: Range3 };
  /** Ajustements du multiple d'EBE (en points de multiple). */
  adjustments: { recurrence: number; croissance: number; fragilite: number; dependanceDirigeant: number };
  /** Multiples de CA (hypothèse) et secteurs où la méthode est jugée pertinente. */
  revenueMultiples: Range3;
  revenueMultipleSectors: string[];
  /** Fonds de commerce : multiple d'EBE appliqué aux activités commerciales et artisanales. */
  goodwillEbeMultiples: Range3;
  goodwillSectors: string[];
  /** Flux actualisés. */
  dcf: { discountRate: number; terminalGrowth: number; taxRate: number; horizon: number; maxGrowth: number };
  /** Pondération des méthodes dans la synthèse. */
  weights: { ebe: number; revenue: number; patrimonial: number; dcf: number; goodwill: number };
}

export const DEFAULT_VALUATION_SETTINGS: ValuationSettings = {
  ebeMultiples: { micro: [2.5, 3.5, 4.5], petite: [3.5, 4.5, 5.5], moyenne: [4.5, 5.5, 7] },
  adjustments: { recurrence: 0.5, croissance: 0.25, fragilite: -0.75, dependanceDirigeant: -0.5 },
  revenueMultiples: [0.3, 0.5, 0.8],
  revenueMultipleSectors: ['maintenance-informatique', 'nettoyage', 'espaces-verts', 'expertise-comptable', 'securite', 'agences-web', 'agences-marketing', 'seo', 'communication-digitale', 'creation-sites'],
  goodwillEbeMultiples: [2, 3, 4],
  goodwillSectors: ['commerce-proximite', 'imprimerie', 'garages', 'batiment-artisanat', 'electricite', 'plomberie-chauffage', 'piscinistes', 'signaletique'],
  dcf: { discountRate: 0.12, terminalGrowth: 0.015, taxRate: 0.25, horizon: 5, maxGrowth: 0.04 },
  weights: { ebe: 0.45, revenue: 0.1, patrimonial: 0.15, dcf: 0.2, goodwill: 0.1 },
};

/** Secteurs où une part importante du CA est réputée récurrente (contrats d'entretien, maintenance, abonnements). */
export const RECURRENT_SECTORS = ['maintenance-informatique', 'nettoyage', 'espaces-verts', 'expertise-comptable', 'securite', 'maintenance-industrielle'];

export interface MethodResult {
  method: 'ebe' | 'revenue' | 'patrimonial' | 'assets' | 'dcf' | 'goodwill';
  label: string;
  applicable: boolean;
  low: number | null;
  central: number | null;
  high: number | null;
  basis: string; // ce que la valeur représente (valeur d'entreprise, des titres, du fonds…)
  assumptions: string[];
  limits: string[];
  reason?: string; // si non applicable
}

export interface ValuationResult {
  low: number | null;
  central: number | null;
  high: number | null;
  methods: MethodResult[];
  assumptions: string[];
  limits: string[];
  netDebt: number | null;
  status: 'estimee' | 'non_calculable';
}

export interface ValuationContext {
  sectorId?: string | null;
  headcount?: number | null; // effectif (milieu de tranche) si connu
  activeProceeding?: boolean;
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const r = (v: number) => Math.round(v / 1000) * 1000;

export function sizeBucket(revenue: number): keyof ValuationSettings['ebeMultiples'] {
  return revenue < 1_000_000 ? 'micro' : revenue < 10_000_000 ? 'petite' : 'moyenne';
}

/** Valeur actuelle nette d'une série de flux (t = 1..n) et d'une valeur terminale en n. */
export function presentValue(flows: number[], rate: number, terminal = 0): number {
  let pv = 0;
  flows.forEach((f, i) => (pv += f / Math.pow(1 + rate, i + 1)));
  return pv + terminal / Math.pow(1 + rate, flows.length);
}

export function valuate(years: FinancialYear[], ctx: ValuationContext = {}, s: ValuationSettings = DEFAULT_VALUATION_SETTINGS): ValuationResult {
  const ys = [...years].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const last = ys[ys.length - 1];
  const methods: MethodResult[] = [];
  const globalAssumptions: string[] = [];
  const globalLimits: string[] = ['Estimation indicative fondée sur les seules données publiques disponibles : elle ne remplace ni un audit ni une évaluation professionnelle.'];
  if (!last) {
    return { low: null, central: null, high: null, methods: [], assumptions: [], limits: ['Aucun compte disponible : valorisation impossible.'], netDebt: null, status: 'non_calculable' };
  }
  const trends = analyzeTrends(ys);
  const fragile = trends.findings.some((f) => f.tag === 'fragilite' || (f.tag === 'pertes' && f.severity === 'critique'));
  const growing = trends.findings.some((f) => f.tag === 'croissance_reguliere');
  const netDebt = num(last.totalDebt) && num(last.cash) ? last.totalDebt - last.cash : null;

  // 1. Multiple d'EBE
  const nEbe = normalizedEbe(ys);
  if (nEbe.value !== null && nEbe.value > 0 && num(last.revenue)) {
    const bucket = sizeBucket(last.revenue);
    const base = s.ebeMultiples[bucket];
    let adj = 0;
    const assumptions = [`EBE normatif : ${nEbe.method} = ${Math.round(nEbe.value).toLocaleString('fr-FR')} €`, `Multiples de base (${bucket === 'micro' ? 'CA < 1 M€' : bucket === 'petite' ? 'CA 1 à 10 M€' : 'CA > 10 M€'}) : ${base.join(' / ')} — hypothèse paramétrable`];
    if (ctx.sectorId && RECURRENT_SECTORS.includes(ctx.sectorId)) {
      adj += s.adjustments.recurrence;
      assumptions.push(`+${s.adjustments.recurrence} : activité réputée à revenus récurrents (hypothèse sectorielle à confirmer par les contrats)`);
    }
    if (growing) {
      adj += s.adjustments.croissance;
      assumptions.push(`+${s.adjustments.croissance} : croissance régulière du CA`);
    }
    if (fragile) {
      adj += s.adjustments.fragilite;
      assumptions.push(`${s.adjustments.fragilite} : fragilité financière constatée`);
    }
    if (ctx.headcount !== null && ctx.headcount !== undefined && ctx.headcount <= 2) {
      adj += s.adjustments.dependanceDirigeant;
      assumptions.push(`${s.adjustments.dependanceDirigeant} : très petite structure, forte dépendance probable au dirigeant`);
    }
    const m = base.map((x) => Math.max(0.5, x + adj)) as Range3;
    const ev = m.map((x) => x * nEbe.value!) as Range3;
    const equity = netDebt !== null ? (ev.map((x) => x - netDebt) as Range3) : ev;
    methods.push({
      method: 'ebe',
      label: "Multiple d'EBE",
      applicable: true,
      low: r(equity[0]),
      central: r(equity[1]),
      high: r(equity[2]),
      basis: netDebt !== null ? 'Valeur des titres (valeur d\'entreprise − dette nette)' : "Valeur d'entreprise (dette nette inconnue : non déduite)",
      assumptions: [...assumptions, `Multiples retenus : ${m.map((x) => x.toFixed(2)).join(' / ')}`],
      limits: [
        nEbe.years.length < 3 ? 'Moins de 3 exercices : EBE normatif peu robuste.' : 'EBE non retraité (rémunération du dirigeant, loyers, éléments exceptionnels).',
        ...(ebeOf(last).status === 'calculee' ? ['EBE recalculé (résultat d\'exploitation + dotations) : approximation.'] : []),
      ],
    });
  } else {
    methods.push({ method: 'ebe', label: "Multiple d'EBE", applicable: false, low: null, central: null, high: null, basis: '', assumptions: [], limits: [], reason: nEbe.value !== null && nEbe.value <= 0 ? 'EBE négatif ou nul : méthode inapplicable' : 'EBE non disponible ni calculable' });
  }

  // 2. Multiple de CA (secteurs pertinents uniquement, et seulement si l'activité n'est pas déficitaire)
  const revenueRelevant = ctx.sectorId ? s.revenueMultipleSectors.includes(ctx.sectorId) : false;
  if (revenueRelevant && num(last.revenue) && last.revenue > 0 && (!num(last.netIncome) || last.netIncome >= 0)) {
    const v = s.revenueMultiples.map((x) => x * last.revenue!) as Range3;
    methods.push({
      method: 'revenue',
      label: "Multiple de chiffre d'affaires",
      applicable: true,
      low: r(v[0]),
      central: r(v[1]),
      high: r(v[2]),
      basis: "Valeur d'entreprise",
      assumptions: [`CA ${last.fiscalYear} : ${Math.round(last.revenue).toLocaleString('fr-FR')} €`, `Multiples ${s.revenueMultiples.join(' / ')} — hypothèse paramétrable pour les activités de services à clientèle récurrente`],
      limits: ["Ne tient pas compte de la rentabilité : à n'utiliser qu'en complément d'une méthode fondée sur les résultats."],
    });
  } else {
    methods.push({ method: 'revenue', label: "Multiple de chiffre d'affaires", applicable: false, low: null, central: null, high: null, basis: '', assumptions: [], limits: [], reason: !revenueRelevant ? 'Méthode non retenue pour ce secteur' : !num(last.revenue) ? 'CA indisponible' : 'Activité déficitaire : multiple de CA non pertinent' });
  }

  // 3. Approche patrimoniale (actif net comptable)
  if (num(last.equity)) {
    methods.push({
      method: 'patrimonial',
      label: 'Approche patrimoniale (actif net comptable)',
      applicable: true,
      low: r(Math.max(0, last.equity * 0.8)),
      central: r(Math.max(0, last.equity)),
      high: r(Math.max(0, last.equity * 1.1)),
      basis: 'Valeur des titres',
      assumptions: [`Capitaux propres ${last.fiscalYear} : ${Math.round(last.equity).toLocaleString('fr-FR')} €`, 'Fourchette −20 % / +10 % pour refléter décotes ou plus-values latentes non connues'],
      limits: ['Valeurs comptables non réévaluées (immobilier, matériel, fonds de commerce non inscrit).', ...(last.equity < 0 ? ['Capitaux propres négatifs : valeur patrimoniale nulle.'] : [])],
    });
  } else {
    methods.push({ method: 'patrimonial', label: 'Approche patrimoniale (actif net comptable)', applicable: false, low: null, central: null, high: null, basis: '', assumptions: [], limits: [], reason: 'Capitaux propres non publiés' });
  }

  // 4. Valeur des actifs (immobilisations + stocks)
  if (num(last.fixedAssets) || num(last.inventory)) {
    const v = (last.fixedAssets ?? 0) + (last.inventory ?? 0);
    methods.push({
      method: 'assets',
      label: 'Valeur des actifs (immobilisations nettes + stocks)',
      applicable: true,
      low: r(v * 0.5),
      central: r(v * 0.75),
      high: r(v),
      basis: 'Valeur de réalisation indicative des actifs (pertinent en cas de rachat d\'actifs)',
      assumptions: [`Immobilisations nettes : ${num(last.fixedAssets) ? Math.round(last.fixedAssets).toLocaleString('fr-FR') + ' €' : 'n.d.'}`, `Stocks : ${num(last.inventory) ? Math.round(last.inventory).toLocaleString('fr-FR') + ' €' : 'n.d.'}`, 'Décote de 25 % à 50 % sur la valeur nette comptable (hypothèse de revente)'],
      limits: ['Ne mesure pas la capacité bénéficiaire ; état réel des actifs inconnu.'],
    });
  }

  // 5. Flux de trésorerie actualisés : seulement si l'historique est suffisant et stable
  const ebes = ys.map((y) => ebeOf(y).value).filter(num);
  const stable = ebes.length >= 3 && ebes.every((e) => e > 0) && coefVar(ebes.slice(-3)) < 0.35;
  if (stable && nEbe.value && num(last.revenue)) {
    const g = Math.min(Math.max(trends.revenueCagr ?? 0, -0.02), s.dcf.maxGrowth);
    const dep = num(last.depreciation) ? last.depreciation : 0;
    const flows: number[] = [];
    let e = nEbe.value;
    for (let i = 0; i < s.dcf.horizon; i++) {
      e *= 1 + g;
      const ebit = e - dep;
      flows.push(e - Math.max(0, ebit) * s.dcf.taxRate - dep); // investissements de maintien ≈ dotations
    }
    const tv = (flows[flows.length - 1]! * (1 + s.dcf.terminalGrowth)) / (s.dcf.discountRate - s.dcf.terminalGrowth);
    const central = presentValue(flows, s.dcf.discountRate, tv);
    const low = presentValue(flows, s.dcf.discountRate + 0.03, (flows[flows.length - 1]! * (1 + s.dcf.terminalGrowth)) / (s.dcf.discountRate + 0.03 - s.dcf.terminalGrowth));
    const high = presentValue(flows, s.dcf.discountRate - 0.02, (flows[flows.length - 1]! * (1 + s.dcf.terminalGrowth)) / (s.dcf.discountRate - 0.02 - s.dcf.terminalGrowth));
    const adjust = (v: number) => (netDebt !== null ? v - netDebt : v);
    methods.push({
      method: 'dcf',
      label: 'Flux de trésorerie actualisés',
      applicable: true,
      low: r(adjust(low)),
      central: r(adjust(central)),
      high: r(adjust(high)),
      basis: netDebt !== null ? 'Valeur des titres' : "Valeur d'entreprise (dette nette inconnue)",
      assumptions: [
        `Croissance annuelle retenue : ${(g * 100).toFixed(1)} % (TCAM historique plafonné à ${(s.dcf.maxGrowth * 100).toFixed(0)} %)`,
        `Taux d'actualisation ${(s.dcf.discountRate * 100).toFixed(0)} % (fourchette ${((s.dcf.discountRate - 0.02) * 100).toFixed(0)}–${((s.dcf.discountRate + 0.03) * 100).toFixed(0)} %), croissance perpétuelle ${(s.dcf.terminalGrowth * 100).toFixed(1)} %`,
        `Impôt normatif ${(s.dcf.taxRate * 100).toFixed(0)} %, investissements de maintien égaux aux dotations, BFR constant`,
      ],
      limits: ['Très sensible au taux d\'actualisation et à la valeur terminale.', 'Projections mécaniques fondées sur l\'historique, sans plan d\'affaires.'],
    });
  } else {
    methods.push({ method: 'dcf', label: 'Flux de trésorerie actualisés', applicable: false, low: null, central: null, high: null, basis: '', assumptions: [], limits: [], reason: 'Historique insuffisant ou trop irrégulier (3 exercices d\'EBE positif et stable requis)' });
  }

  // 6. Fonds de commerce
  const goodwillRelevant = ctx.sectorId ? s.goodwillSectors.includes(ctx.sectorId) : false;
  if (goodwillRelevant && nEbe.value !== null && nEbe.value > 0) {
    const v = s.goodwillEbeMultiples.map((x) => x * nEbe.value!) as Range3;
    methods.push({
      method: 'goodwill',
      label: 'Valorisation du fonds de commerce',
      applicable: true,
      low: r(v[0]),
      central: r(v[1]),
      high: r(v[2]),
      basis: 'Valeur du fonds (clientèle, droit au bail, nom commercial, matériel) hors trésorerie et dettes',
      assumptions: [`Multiples d'EBE du fonds : ${s.goodwillEbeMultiples.join(' / ')} — hypothèse paramétrable`],
      limits: ['Les barèmes professionnels par activité (pourcentage du CA) ne sont pas intégrés : à compléter avec un expert ou la CCI.', 'Droit au bail, emplacement et état du matériel non évalués.'],
    });
  } else if (goodwillRelevant) {
    methods.push({ method: 'goodwill', label: 'Valorisation du fonds de commerce', applicable: false, low: null, central: null, high: null, basis: '', assumptions: [], limits: [], reason: 'EBE indisponible ou négatif' });
  }

  // Synthèse pondérée (méthodes de valeur des titres / d'entreprise uniquement ; actifs et fonds présentés séparément)
  const weighted = methods.filter((m) => m.applicable && (m.method === 'ebe' || m.method === 'revenue' || m.method === 'patrimonial' || m.method === 'dcf'));
  if (!weighted.length) {
    return { low: null, central: null, high: null, methods, assumptions: globalAssumptions, limits: [...globalLimits, 'Aucune méthode de valorisation des titres applicable avec les données disponibles.'], netDebt, status: 'non_calculable' };
  }
  const w = (m: MethodResult) => s.weights[m.method as keyof ValuationSettings['weights']] ?? 0;
  const tw = weighted.reduce((a, m) => a + w(m), 0) || 1;
  const agg = (k: 'low' | 'central' | 'high') => r(weighted.reduce((a, m) => a + (m[k] ?? 0) * w(m), 0) / tw);
  globalAssumptions.push(`Synthèse pondérée : ${weighted.map((m) => `${m.label} ${Math.round((w(m) / tw) * 100)} %`).join(', ')}`);
  if (ctx.activeProceeding) globalLimits.push("Procédure collective en cours : la reprise s'effectue généralement par cession d'actifs ou plan de cession, pas sur une valeur de titres.");
  if (ys.length < 3) globalLimits.push(`${ys.length} exercice(s) disponible(s) : fiabilité limitée.`);
  return { low: Math.max(0, agg('low')), central: Math.max(0, agg('central')), high: Math.max(0, agg('high')), methods, assumptions: globalAssumptions, limits: globalLimits, netDebt, status: 'estimee' };
}

function coefVar(xs: number[]): number {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  if (m === 0) return Infinity;
  const v = xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length;
  return Math.sqrt(v) / Math.abs(m);
}
