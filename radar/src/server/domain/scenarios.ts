/**
 * Scénarios de reprise : projections sur 5 ans (lecture à 3 et 5 ans), financement, trésorerie, seuil de rentabilité,
 * délai de récupération et TRI. Distingue le rendement de l'entreprise (rentabilité économique de l'investissement
 * total) du rendement des fonds propres de l'acquéreur (TRI des apports, après service de la dette).
 * Aucun résultat ne constitue une promesse de rendement.
 */
export interface DealInputs {
  baseRevenue: number;
  baseEbe: number;
  baseDepreciation?: number;
  grossMarginRate?: number | null; // taux de marge sur coûts variables (si connu) pour le seuil de rentabilité
  price: number; // prix d'acquisition hypothétique (titres ou fonds)
  acquisitionFeesRate: number; // frais (droits d'enregistrement, conseils) en % du prix
  initialInvestment: number; // investissements de reprise
  workingCapital: number; // BFR à financer au démarrage
  cashBuffer: number; // trésorerie de sécurité
  debtShare: number; // part financée par emprunt (0..1) du besoin total
  interestRate: number;
  loanYears: number;
  taxRate: number;
  exitEbeMultiple: number; // pour la valeur résiduelle à 5 ans (TRI)
}

export interface ScenarioParams {
  name: 'prudent' | 'central' | 'optimiste';
  label: string;
  firstYearRevenueChange: number; // choc de reprise en année 1 (perte de clientèle…)
  revenueGrowth: number; // croissance annuelle ensuite
  marginDelta: number; // variation du taux d'EBE (points)
  extraCosts: number; // charges supplémentaires annuelles (encadrement, rémunération du repreneur…)
  extraInvestment: number;
  assumptions: string[];
}

export interface YearProjection {
  year: number;
  revenue: number;
  ebe: number;
  depreciation: number;
  operatingIncome: number;
  interest: number;
  tax: number;
  netIncome: number;
  freeCashFlow: number; // flux disponible pour l'entreprise (avant dette)
  debtService: number;
  equityCashFlow: number; // flux disponible pour l'acquéreur
  cumulativeEquityCash: number;
  remainingDebt: number;
  dscr: number | null; // couverture du service de la dette
}

export interface ScenarioResult {
  params: ScenarioParams;
  financing: { price: number; fees: number; investment: number; workingCapital: number; cashBuffer: number; totalNeed: number; debt: number; equity: number; annuity: number };
  years: YearProjection[];
  at3: { cumulativeEquityCash: number; netIncomeTotal: number };
  at5: { cumulativeEquityCash: number; netIncomeTotal: number };
  breakEvenRevenue: number | null;
  paybackYears: number | null;
  businessReturn: number | null; // résultat d'exploitation après impôt moyen / investissement total
  equityIrr: number | null;
  warnings: string[];
}

export function annuity(principal: number, rate: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  if (rate === 0) return principal / years;
  return (principal * rate) / (1 - Math.pow(1 + rate, -years));
}

/** TRI par dichotomie. null si les flux ne changent pas de signe ou si aucune racine n'est trouvée. */
export function irr(flows: number[]): number | null {
  if (!flows.some((f) => f < 0) || !flows.some((f) => f > 0)) return null;
  const npv = (r: number) => flows.reduce((a, f, i) => a + f / Math.pow(1 + r, i), 0);
  let lo = -0.99;
  let hi = 10;
  let flo = npv(lo);
  const fhi = npv(hi);
  if (flo * fhi > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    const fm = npv(mid);
    if (Math.abs(fm) < 1e-6) return mid;
    if (flo * fm < 0) hi = mid;
    else {
      lo = mid;
      flo = fm;
    }
  }
  return (lo + hi) / 2;
}

export function defaultScenarios(): ScenarioParams[] {
  return [
    {
      name: 'prudent',
      label: 'Scénario prudent',
      firstYearRevenueChange: -0.15,
      revenueGrowth: 0,
      marginDelta: -0.02,
      extraCosts: 15000,
      extraInvestment: 20000,
      assumptions: ["Perte de 15 % du CA l'année de la reprise (départ de clients liés au cédant)", 'Pas de croissance ensuite', "Taux d'EBE en baisse de 2 points", '15 000 €/an de charges supplémentaires', '20 000 € d\'investissements de remise à niveau'],
    },
    {
      name: 'central',
      label: 'Scénario central',
      firstYearRevenueChange: -0.05,
      revenueGrowth: 0.02,
      marginDelta: 0,
      extraCosts: 5000,
      extraInvestment: 10000,
      assumptions: ['Légère érosion de 5 % du CA en année 1', 'Croissance de 2 % par an ensuite', "Taux d'EBE maintenu", '5 000 €/an de charges supplémentaires', '10 000 € d\'investissements'],
    },
    {
      name: 'optimiste',
      label: 'Scénario optimiste',
      firstYearRevenueChange: 0,
      revenueGrowth: 0.06,
      marginDelta: 0.02,
      extraCosts: 0,
      extraInvestment: 15000,
      assumptions: ['CA maintenu en année 1', 'Développement commercial : +6 % par an', "Amélioration du taux d'EBE de 2 points (optimisation des coûts, nouveaux services)", '15 000 € investis dans le développement'],
    },
  ];
}

export function runScenario(d: DealInputs, p: ScenarioParams): ScenarioResult {
  const warnings: string[] = [];
  const fees = d.price * d.acquisitionFeesRate;
  const investment = d.initialInvestment + p.extraInvestment;
  const totalNeed = d.price + fees + investment + d.workingCapital + d.cashBuffer;
  const debt = totalNeed * Math.min(Math.max(d.debtShare, 0), 1);
  const equity = totalNeed - debt;
  const ann = annuity(debt, d.interestRate, d.loanYears);
  const baseMargin = d.baseRevenue > 0 ? d.baseEbe / d.baseRevenue : 0;
  const margin = baseMargin + p.marginDelta;
  const newDep = investment / 5;
  let revenue = d.baseRevenue;
  let remaining = debt;
  let cum = 0;
  const years: YearProjection[] = [];
  for (let y = 1; y <= 5; y++) {
    revenue = y === 1 ? d.baseRevenue * (1 + p.firstYearRevenueChange) : revenue * (1 + p.revenueGrowth);
    const ebe = revenue * margin - p.extraCosts;
    const dep = (d.baseDepreciation ?? 0) + newDep;
    const operatingIncome = ebe - dep;
    const interest = y <= d.loanYears ? remaining * d.interestRate : 0;
    const principal = y <= d.loanYears ? Math.min(remaining, ann - interest) : 0;
    const taxable = operatingIncome - interest;
    const tax = Math.max(0, taxable) * d.taxRate;
    const netIncome = taxable - tax;
    const maintenanceCapex = d.baseDepreciation ?? 0;
    const fcf = ebe - Math.max(0, operatingIncome) * d.taxRate - maintenanceCapex;
    const debtService = interest + principal;
    const equityCf = ebe - tax - maintenanceCapex - debtService;
    remaining = Math.max(0, remaining - principal);
    cum += equityCf;
    years.push({
      year: y,
      revenue,
      ebe,
      depreciation: dep,
      operatingIncome,
      interest,
      tax,
      netIncome,
      freeCashFlow: fcf,
      debtService,
      equityCashFlow: equityCf,
      cumulativeEquityCash: cum,
      remainingDebt: remaining,
      dscr: debtService > 0 ? (ebe - tax - maintenanceCapex) / debtService : null,
    });
  }
  const minDscr = Math.min(...years.map((y) => y.dscr ?? Infinity));
  if (minDscr < 1) warnings.push(`Le flux d'exploitation ne couvre pas le service de la dette certaines années (couverture minimale ${minDscr.toFixed(2)}) : apport ou durée d'emprunt à revoir.`);
  else if (minDscr < 1.25) warnings.push(`Couverture du service de la dette faible (${minDscr.toFixed(2)}) : les banques demandent souvent au moins 1,2 à 1,3.`);
  if (margin <= 0) warnings.push("Taux d'EBE nul ou négatif dans ce scénario.");

  // Seuil de rentabilité : seulement si le taux de marge sur coûts variables est connu
  let breakEvenRevenue: number | null = null;
  if (d.grossMarginRate && d.grossMarginRate > 0) {
    const fixed = d.baseRevenue * d.grossMarginRate - d.baseEbe + p.extraCosts + (d.baseDepreciation ?? 0) + newDep + (years[0]?.interest ?? 0);
    breakEvenRevenue = fixed / d.grossMarginRate;
  } else {
    warnings.push('Seuil de rentabilité non calculable : taux de marge sur coûts variables inconnu.');
  }

  // Délai de récupération des fonds propres (interpolation linéaire)
  let paybackYears: number | null = null;
  let prevCum = 0;
  for (const y of years) {
    if (prevCum < equity && y.cumulativeEquityCash >= equity) {
      paybackYears = y.year - 1 + (equity - prevCum) / (y.cumulativeEquityCash - prevCum);
      break;
    }
    prevCum = y.cumulativeEquityCash;
  }

  // Rendement de l'entreprise : résultat d'exploitation après impôt moyen / investissement total (hors trésorerie de sécurité)
  const avgNopat = years.reduce((a, y) => a + y.operatingIncome * (1 - d.taxRate), 0) / years.length;
  const invested = d.price + fees + investment + d.workingCapital;
  const businessReturn = invested > 0 ? avgNopat / invested : null;

  // TRI des fonds propres : apport en t0, flux annuels, valeur résiduelle en année 5 (multiple d'EBE − dette restante)
  const y5 = years[4]!;
  const exitValue = Math.max(0, y5.ebe * d.exitEbeMultiple - y5.remainingDebt + d.cashBuffer);
  const equityIrr = equity > 0 ? irr([-equity, ...years.map((y, i) => y.equityCashFlow + (i === 4 ? exitValue : 0))]) : null;
  if (equity <= 0) warnings.push('Aucun apport en fonds propres : TRI non significatif.');

  return {
    params: p,
    financing: { price: d.price, fees, investment, workingCapital: d.workingCapital, cashBuffer: d.cashBuffer, totalNeed, debt, equity, annuity: ann },
    years,
    at3: { cumulativeEquityCash: years[2]!.cumulativeEquityCash, netIncomeTotal: years.slice(0, 3).reduce((a, y) => a + y.netIncome, 0) },
    at5: { cumulativeEquityCash: y5.cumulativeEquityCash, netIncomeTotal: years.reduce((a, y) => a + y.netIncome, 0) },
    breakEvenRevenue,
    paybackYears,
    businessReturn,
    equityIrr,
    warnings,
  };
}

export const DEFAULT_DEAL = {
  acquisitionFeesRate: 0.08,
  debtShare: 0.7,
  interestRate: 0.045,
  loanYears: 7,
  taxRate: 0.25,
  cashBufferMonths: 2,
  workingCapitalRate: 0.1,
};
