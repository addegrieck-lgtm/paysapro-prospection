/**
 * Moteur d'analyse financière.
 * Règles : un indicateur n'est calculé que si toutes ses données d'entrée existent ; chaque indicateur expose sa
 * formule et ses entrées ; un chiffre d'affaires élevé n'est jamais assimilé à une bonne rentabilité.
 */
export interface FinancialYear {
  fiscalYear: number;
  months?: number | null;
  revenue?: number | null;
  grossMargin?: number | null;
  valueAdded?: number | null;
  ebe?: number | null;
  ebitda?: number | null;
  operatingIncome?: number | null;
  netIncome?: number | null;
  payroll?: number | null;
  depreciation?: number | null;
  equity?: number | null;
  totalDebt?: number | null;
  totalLiabilities?: number | null;
  cash?: number | null;
  fixedAssets?: number | null;
  inventory?: number | null;
  receivables?: number | null;
  payables?: number | null;
  totalAssets?: number | null;
  headcount?: number | null;
  source?: string;
  status?: string;
}

export type Unit = '%' | '€' | 'x' | 'ans' | 'jours' | 'pers.';

export interface Indicator {
  key: string;
  label: string;
  value: number | null;
  unit: Unit;
  formula: string;
  inputs: Record<string, number | null | undefined>;
  status: 'officielle' | 'calculee' | 'non_calculable';
  note?: string;
  missing?: string[];
}

const num = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

function ind(
  key: string,
  label: string,
  unit: Unit,
  formula: string,
  inputs: Record<string, number | null | undefined>,
  compute: (v: Record<string, number>) => number | null,
  note?: string,
): Indicator {
  const missing = Object.entries(inputs).filter(([, v]) => !num(v)).map(([k]) => k);
  if (missing.length) return { key, label, unit, formula, inputs, value: null, status: 'non_calculable', missing, note };
  const value = compute(inputs as Record<string, number>);
  if (value === null || !Number.isFinite(value)) return { key, label, unit, formula, inputs, value: null, status: 'non_calculable', note: note ?? 'Division impossible (dénominateur nul ou négatif)' };
  return { key, label, unit, formula, inputs, value, status: 'calculee', note };
}

/** EBE : valeur publiée si disponible, sinon approximation résultat d'exploitation + dotations (statut « calculée »). */
export function ebeOf(y: FinancialYear): { value: number | null; status: 'officielle' | 'calculee' | 'non_calculable'; formula: string } {
  if (num(y.ebe)) return { value: y.ebe, status: 'officielle', formula: 'EBE publié' };
  if (num(y.ebitda)) return { value: y.ebitda, status: 'officielle', formula: 'EBITDA publié' };
  if (num(y.operatingIncome) && num(y.depreciation)) {
    return { value: y.operatingIncome + y.depreciation, status: 'calculee', formula: "Résultat d'exploitation + dotations aux amortissements et provisions (approximation : reprises sur provisions non déduites)" };
  }
  return { value: null, status: 'non_calculable', formula: "Nécessite l'EBE publié ou le résultat d'exploitation et les dotations" };
}

const pos = (a: number, b: number) => (b <= 0 ? null : a / b);

/** Indicateurs d'un exercice (et de son évolution par rapport à l'exercice précédent si fourni). */
export function yearIndicators(y: FinancialYear, prev?: FinancialYear): Indicator[] {
  const ebe = ebeOf(y);
  const comparable = !prev || ((y.months ?? 12) === 12 && (prev.months ?? 12) === 12);
  const out: Indicator[] = [];
  out.push(
    ind('croissance_ca', "Croissance annuelle du chiffre d'affaires", '%', '(CA N − CA N−1) / CA N−1', { 'CA N': y.revenue, 'CA N−1': prev?.revenue }, (v) => pos(v['CA N']! - v['CA N−1']!, v['CA N−1']!), comparable ? undefined : 'Exercices de durée différente : comparaison à interpréter avec prudence'),
    ind('marge_brute', 'Taux de marge brute', '%', 'Marge brute / CA', { 'Marge brute': y.grossMargin, CA: y.revenue }, (v) => pos(v['Marge brute']!, v.CA!)),
    { key: 'ebe', label: 'EBE / EBITDA', unit: '€', value: ebe.value, formula: ebe.formula, inputs: { EBE: y.ebe, "Résultat d'exploitation": y.operatingIncome, Dotations: y.depreciation }, status: ebe.status },
    ind('marge_ebe', "Marge d'EBE", '%', 'EBE / CA', { EBE: ebe.value, CA: y.revenue }, (v) => pos(v.EBE!, v.CA!)),
    ind('marge_operationnelle', 'Marge opérationnelle', '%', "Résultat d'exploitation / CA", { "Résultat d'exploitation": y.operatingIncome, CA: y.revenue }, (v) => pos(v["Résultat d'exploitation"]!, v.CA!)),
    ind('marge_nette', 'Marge nette', '%', 'Résultat net / CA', { 'Résultat net': y.netIncome, CA: y.revenue }, (v) => pos(v['Résultat net']!, v.CA!)),
    ind(
      'rentabilite_capitaux',
      'Rentabilité des capitaux investis (ROCE)',
      '%',
      "Résultat d'exploitation × (1 − 25 %) / (capitaux propres + dettes financières)",
      { "Résultat d'exploitation": y.operatingIncome, 'Capitaux propres': y.equity, 'Dettes financières': y.totalDebt },
      (v) => pos(v["Résultat d'exploitation"]! * 0.75, v['Capitaux propres']! + v['Dettes financières']!),
      "Impôt normatif de 25 % (taux normal de l'IS) : hypothèse",
    ),
    ind('rentabilite_fonds_propres', 'Rentabilité des capitaux propres (ROE)', '%', 'Résultat net / capitaux propres', { 'Résultat net': y.netIncome, 'Capitaux propres': y.equity }, (v) => pos(v['Résultat net']!, v['Capitaux propres']!)),
    ind('gearing', "Ratio d'endettement (gearing)", 'x', 'Dettes financières / capitaux propres', { 'Dettes financières': y.totalDebt, 'Capitaux propres': y.equity }, (v) => pos(v['Dettes financières']!, v['Capitaux propres']!), num(y.equity) && y.equity <= 0 ? 'Capitaux propres nuls ou négatifs : endettement non mesurable, situation fragile' : undefined),
    ind('dette_nette', 'Dette financière nette', '€', 'Dettes financières − trésorerie', { 'Dettes financières': y.totalDebt, Trésorerie: y.cash }, (v) => v['Dettes financières']! - v.Trésorerie!),
    ind('capacite_remboursement', 'Capacité de remboursement', 'ans', 'Dettes financières / EBE', { 'Dettes financières': y.totalDebt, EBE: ebe.value }, (v) => pos(v['Dettes financières']!, v.EBE!), 'Nombre d\'années d\'EBE nécessaires pour rembourser la dette (avant impôt et investissements)'),
    ind('autonomie_financiere', 'Autonomie financière', '%', 'Capitaux propres / total du bilan', { 'Capitaux propres': y.equity, 'Total bilan': y.totalAssets }, (v) => pos(v['Capitaux propres']!, v['Total bilan']!)),
    ind('dependance_financiere', 'Dépendance financière', '%', 'Total des dettes / total du bilan', { 'Total dettes': y.totalLiabilities, 'Total bilan': y.totalAssets }, (v) => pos(v['Total dettes']!, v['Total bilan']!)),
    ind('bfr', "Besoin en fonds de roulement d'exploitation", '€', 'Stocks + créances clients − dettes fournisseurs', { Stocks: y.inventory, 'Créances clients': y.receivables, 'Dettes fournisseurs': y.payables }, (v) => v.Stocks! + v['Créances clients']! - v['Dettes fournisseurs']!),
    ind('bfr_jours', 'BFR en jours de CA', 'jours', '(Stocks + créances − fournisseurs) / CA × 365', { Stocks: y.inventory, 'Créances clients': y.receivables, 'Dettes fournisseurs': y.payables, CA: y.revenue }, (v) => {
      const r = pos(v.Stocks! + v['Créances clients']! - v['Dettes fournisseurs']!, v.CA!);
      return r === null ? null : r * 365;
    }),
    ind('evolution_capitaux_propres', 'Évolution des capitaux propres', '€', 'Capitaux propres N − N−1', { 'CP N': y.equity, 'CP N−1': prev?.equity }, (v) => v['CP N']! - v['CP N−1']!),
    ind('evolution_effectif', "Évolution de l'effectif", 'pers.', 'Effectif N − N−1', { 'Effectif N': y.headcount, 'Effectif N−1': prev?.headcount }, (v) => v['Effectif N']! - v['Effectif N−1']!),
    ind('ca_par_salarie', "Chiffre d'affaires par salarié", '€', 'CA / effectif', { CA: y.revenue, Effectif: y.headcount }, (v) => pos(v.CA!, v.Effectif!)),
  );
  return out;
}

export type TrendTag =
  | 'croissance_reguliere'
  | 'stagnation'
  | 'degradation'
  | 'redressement'
  | 'rentabilite_exceptionnelle'
  | 'charges_inhabituelles'
  | 'fragilite'
  | 'element_non_recurrent'
  | 'pertes';

export interface TrendFinding {
  tag: TrendTag;
  label: string;
  explanation: string;
  severity: 'positif' | 'neutre' | 'attention' | 'critique';
}

export interface TrendAnalysis {
  years: number[];
  revenueCagr: number | null;
  findings: TrendFinding[];
  summary: string;
}

/** Taux de croissance annuel moyen (TCAM) entre le premier et le dernier exercice. */
export function cagr(first: number, last: number, periods: number): number | null {
  if (periods <= 0 || first <= 0 || last <= 0) return null;
  return Math.pow(last / first, 1 / periods) - 1;
}

/** Analyse des tendances sur les 3 à 5 derniers exercices disponibles. */
export function analyzeTrends(input: FinancialYear[]): TrendAnalysis {
  const ys = [...input].sort((a, b) => a.fiscalYear - b.fiscalYear).slice(-5);
  const years = ys.map((y) => y.fiscalYear);
  const findings: TrendFinding[] = [];
  const withRev = ys.filter((y) => num(y.revenue) && y.revenue! > 0);
  let revenueCagr: number | null = null;
  if (withRev.length >= 2) {
    const f = withRev[0]!;
    const l = withRev[withRev.length - 1]!;
    revenueCagr = cagr(f.revenue!, l.revenue!, l.fiscalYear - f.fiscalYear);
  }
  if (ys.length < 2) {
    return { years, revenueCagr, findings, summary: ys.length ? 'Un seul exercice disponible : aucune tendance ne peut être établie.' : 'Aucun exercice disponible.' };
  }

  // Évolution du CA, année par année
  const growths: number[] = [];
  for (let i = 1; i < withRev.length; i++) {
    const g = withRev[i]!.revenue! / withRev[i - 1]!.revenue! - 1;
    growths.push(g);
    if (Math.abs(g) > 0.4) {
      findings.push({
        tag: 'element_non_recurrent',
        label: `Variation atypique du CA en ${withRev[i]!.fiscalYear}`,
        explanation: `Le chiffre d'affaires varie de ${(g * 100).toFixed(0)} % : changement de périmètre, contrat exceptionnel ou exercice de durée différente à vérifier.`,
        severity: 'attention',
      });
    }
  }
  if (growths.length >= 2 && growths.every((g) => g > 0.02)) {
    findings.push({ tag: 'croissance_reguliere', label: 'Croissance régulière du CA', explanation: `Hausse du CA chaque année (TCAM ${pct(revenueCagr)}).`, severity: 'positif' });
  } else if (revenueCagr !== null && Math.abs(revenueCagr) <= 0.02) {
    findings.push({ tag: 'stagnation', label: "Chiffre d'affaires stable", explanation: `TCAM de ${pct(revenueCagr)} sur la période.`, severity: 'neutre' });
  } else if (revenueCagr !== null && revenueCagr < -0.02) {
    findings.push({ tag: 'degradation', label: "Baisse du chiffre d'affaires", explanation: `TCAM de ${pct(revenueCagr)} sur la période.`, severity: 'attention' });
  }

  // Rentabilité : évaluée sur la marge, jamais sur le niveau de CA
  const margins = ys
    .map((y) => ({ year: y.fiscalYear, m: num(y.netIncome) && num(y.revenue) && y.revenue! > 0 ? y.netIncome! / y.revenue! : null, net: y.netIncome }))
    .filter((x) => x.m !== null) as { year: number; m: number; net: number }[];
  const losses = ys.filter((y) => num(y.netIncome) && y.netIncome! < 0);
  if (losses.length) {
    findings.push({
      tag: 'pertes',
      label: `Pertes sur ${losses.length} exercice(s)`,
      explanation: `Résultat net négatif en ${losses.map((l) => l.fiscalYear).join(', ')}.`,
      severity: losses.length >= 2 ? 'critique' : 'attention',
    });
  }
  if (margins.length >= 2) {
    const first = margins[0]!;
    const last = margins[margins.length - 1]!;
    const hadLoss = margins.slice(0, -1).some((x) => x.m < 0);
    if (hadLoss && last.m > 0) {
      findings.push({ tag: 'redressement', label: 'Redressement de la rentabilité', explanation: `Retour au bénéfice en ${last.year} après des pertes.`, severity: 'positif' });
    } else if (last.m < first.m - 0.05 && margins.length >= 3 && margins.slice(-3).every((x, i, a) => i === 0 || x.m <= a[i - 1]!.m)) {
      findings.push({ tag: 'degradation', label: 'Dégradation de la marge nette', explanation: `Marge nette passée de ${pct(first.m)} à ${pct(last.m)}.`, severity: 'attention' });
    }
  }
  const lastY = ys[ys.length - 1]!;
  if (num(lastY.netIncome) && num(lastY.revenue) && lastY.revenue! > 0 && lastY.netIncome! / lastY.revenue! > 0.15) {
    findings.push({
      tag: 'rentabilite_exceptionnelle',
      label: 'Rentabilité très élevée',
      explanation: `Marge nette de ${pct(lastY.netIncome! / lastY.revenue!)} en ${lastY.fiscalYear} : vérifier la rémunération du dirigeant et l'absence d'éléments exceptionnels.`,
      severity: 'positif',
    });
  }
  // Écart résultat d'exploitation / résultat net : éléments exceptionnels ou financiers
  for (const y of ys) {
    if (num(y.operatingIncome) && num(y.netIncome) && num(y.revenue) && y.revenue! > 0) {
      const gap = y.netIncome! - y.operatingIncome! * 0.75;
      if (Math.abs(gap) / y.revenue! > 0.1) {
        findings.push({
          tag: 'charges_inhabituelles',
          label: `Écart important entre résultat d'exploitation et résultat net (${y.fiscalYear})`,
          explanation: gap < 0 ? 'Charges financières ou exceptionnelles significatives à expliquer.' : 'Produits financiers ou exceptionnels significatifs : bénéfice possiblement non récurrent.',
          severity: 'attention',
        });
      }
    }
  }
  if (num(lastY.equity) && lastY.equity! < 0) {
    findings.push({ tag: 'fragilite', label: 'Capitaux propres négatifs', explanation: `Capitaux propres de ${Math.round(lastY.equity!)} € au dernier exercice.`, severity: 'critique' });
  } else if (num(lastY.totalDebt) && num(lastY.equity) && lastY.equity! > 0 && lastY.totalDebt! / lastY.equity! > 2) {
    findings.push({ tag: 'fragilite', label: 'Endettement élevé', explanation: `Dettes financières égales à ${(lastY.totalDebt! / lastY.equity!).toFixed(1)} fois les capitaux propres.`, severity: 'attention' });
  }

  const summary = findings.length ? findings.map((f) => f.label).join(' · ') : 'Pas de tendance marquée détectée sur les données disponibles.';
  return { years, revenueCagr, findings, summary };
}

export function pct(v: number | null | undefined, digits = 1): string {
  return num(v) ? `${(v * 100).toFixed(digits).replace('.', ',')} %` : 'n.d.';
}

/** EBE « normatif » : moyenne pondérée des 3 derniers exercices (poids 1-2-3), seulement si tous sont disponibles. */
export function normalizedEbe(input: FinancialYear[]): { value: number | null; years: number[]; method: string } {
  const ys = [...input].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const vals = ys.map((y) => ({ year: y.fiscalYear, v: ebeOf(y).value })).filter((x) => x.v !== null) as { year: number; v: number }[];
  const last = vals.slice(-3);
  if (!last.length) return { value: null, years: [], method: 'EBE indisponible' };
  if (last.length === 1) return { value: last[0]!.v, years: [last[0]!.year], method: 'EBE du seul exercice disponible (fiabilité réduite)' };
  const weights = last.map((_, i) => i + 1);
  const total = weights.reduce((a, b) => a + b, 0);
  return { value: last.reduce((s, x, i) => s + x.v * weights[i]!, 0) / total, years: last.map((x) => x.year), method: `Moyenne pondérée (poids ${weights.join('-')}) des exercices ${last.map((x) => x.year).join(', ')}` };
}
