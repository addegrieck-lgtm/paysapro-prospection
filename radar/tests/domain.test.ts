import { describe, expect, it } from 'vitest';
import { analyzeTrends, cagr, ebeOf, normalizedEbe, yearIndicators, type FinancialYear } from '../src/server/domain/financial';
import { classifyJudgment, extractAdministrator, rebuildProceedings } from '../src/server/domain/proceedings';
import { annuity, defaultScenarios, irr, runScenario } from '../src/server/domain/scenarios';
import { computeScores, type CompanySnapshot } from '../src/server/domain/scoring';
import { classifySector, normalizeNaf } from '../src/server/domain/sectors';
import { presentValue, valuate } from '../src/server/domain/valuation';
import { detectOpportunities, detectTextSignals, transmissionIndex } from '../src/server/domain/opportunities';
import { analyzeDistress } from '../src/server/domain/distress';

const y = (fiscalYear: number, o: Partial<FinancialYear>): FinancialYear => ({ fiscalYear, ...o });

describe('secteurs', () => {
  it('normalise les codes NAF', () => {
    expect(normalizeNaf('6201Z')).toBe('62.01Z');
    expect(normalizeNaf(' 81.30z ')).toBe('81.30Z');
    expect(normalizeNaf('abc')).toBeNull();
  });
  it('départage un code NAF partagé par le nom, avec la règle appliquée', () => {
    expect(classifySector('81.30Z', 'SARL Élagage du Caux')).toEqual({ sectorId: 'elagage', rule: 'Code NAF 81.30Z + mot-clé « élagage » dans le nom' });
    expect(classifySector('81.30Z', 'Dupont SARL').sectorId).toBe('paysagisme');
    expect(classifySector('43.21A', 'X').sectorId).toBe('electricite');
    expect(classifySector('01.11Z', 'Ferme').sectorId).toBeNull();
  });
});

describe('analyse financière', () => {
  it('ne calcule pas un indicateur sans ses données', () => {
    const inds = yearIndicators(y(2023, { revenue: 500000 }));
    const net = inds.find((i) => i.key === 'marge_nette')!;
    expect(net.value).toBeNull();
    expect(net.status).toBe('non_calculable');
    expect(net.missing).toContain('Résultat net');
  });
  it('calcule les marges et la croissance avec leurs formules', () => {
    const inds = yearIndicators(y(2023, { revenue: 1_100_000, netIncome: 55_000, operatingIncome: 80_000, depreciation: 20_000 }), y(2022, { revenue: 1_000_000 }));
    expect(inds.find((i) => i.key === 'croissance_ca')!.value).toBeCloseTo(0.1);
    expect(inds.find((i) => i.key === 'marge_nette')!.value).toBeCloseTo(0.05);
    const ebe = inds.find((i) => i.key === 'ebe')!;
    expect(ebe.value).toBe(100_000);
    expect(ebe.status).toBe('calculee');
  });
  it('privilégie l\'EBE publié', () => {
    expect(ebeOf(y(2023, { ebe: 42, operatingIncome: 1, depreciation: 1 }))).toMatchObject({ value: 42, status: 'officielle' });
  });
  it('signale le gearing non mesurable si capitaux propres négatifs', () => {
    const g = yearIndicators(y(2023, { totalDebt: 100, equity: -10 })).find((i) => i.key === 'gearing')!;
    expect(g.value).toBeNull();
    expect(g.note).toMatch(/négatifs/);
  });
  it('TCAM', () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(0.1);
    expect(cagr(0, 121, 2)).toBeNull();
  });
  it('détecte croissance régulière, pertes et redressement', () => {
    const t = analyzeTrends([y(2020, { revenue: 100, netIncome: -5 }), y(2021, { revenue: 110, netIncome: -2 }), y(2022, { revenue: 121, netIncome: 6 })]);
    const tags = t.findings.map((f) => f.tag);
    expect(tags).toContain('croissance_reguliere');
    expect(tags).toContain('pertes');
    expect(tags).toContain('redressement');
  });
  it("n'assimile pas un CA élevé à une bonne rentabilité", () => {
    const t = analyzeTrends([y(2022, { revenue: 50_000_000, netIncome: -100_000 }), y(2023, { revenue: 52_000_000, netIncome: -200_000 })]);
    expect(t.findings.map((f) => f.tag)).not.toContain('rentabilite_exceptionnelle');
    expect(t.findings.find((f) => f.tag === 'pertes')?.severity).toBe('critique');
  });
  it('un seul exercice : aucune tendance', () => {
    expect(analyzeTrends([y(2023, { revenue: 1 })]).findings).toEqual([]);
  });
  it('EBE normatif pondéré', () => {
    const n = normalizedEbe([y(2021, { ebe: 100 }), y(2022, { ebe: 200 }), y(2023, { ebe: 300 })]);
    expect(n.value).toBeCloseTo((100 + 400 + 900) / 6);
  });
});

describe('procédures collectives', () => {
  const j = (reference: string, date: string, nature: string, famille = '', complement = '') => ({ reference, date, nature, famille, complement, tribunal: 'TC Rouen' });
  it('classe les jugements', () => {
    expect(classifyJudgment({ nature: "Jugement d'ouverture d'une procédure de redressement judiciaire" })).toMatchObject({ kind: 'ouverture', procType: 'redressement' });
    expect(classifyJudgment({ nature: 'Jugement de conversion en liquidation judiciaire' }).kind).toBe('conversion_liquidation');
    expect(classifyJudgment({ nature: "Jugement de clôture pour insuffisance d'actif" })).toMatchObject({ kind: 'cloture', closureReason: "Clôture pour insuffisance d'actif" });
    expect(classifyJudgment({ nature: 'Jugement arrêtant le plan de cession' }).kind).toBe('plan_cession');
    expect(classifyJudgment({ nature: 'Jugement arrêtant le plan de redressement' }).kind).toBe('plan');
  });
  it('extrait le mandataire tel que publié', () => {
    expect(extractAdministrator('Jugement prononçant la liquidation judiciaire, désignant liquidateur SELARL Exemple Mandataires, 1 rue X 76000 Rouen.')).toBe('liquidateur SELARL Exemple Mandataires, 1 rue X 76000 Rouen');
    expect(extractAdministrator(null)).toBeNull();
  });
  it('rejoue les jugements dans l\'ordre chronologique : RJ ouvert → converti → LJ clôturée', () => {
    const procs = rebuildProceedings([
      j('3', '2024-09-01', "Jugement de clôture pour insuffisance d'actif"),
      j('1', '2024-01-10', "Jugement d'ouverture d'une procédure de redressement judiciaire"),
      j('2', '2024-04-02', 'Jugement de conversion en liquidation judiciaire'),
    ]);
    expect(procs).toHaveLength(2);
    expect(procs[0]).toMatchObject({ type: 'redressement', status: 'cloturee', closureReason: 'Convertie en liquidation judiciaire' });
    expect(procs[1]).toMatchObject({ type: 'liquidation', status: 'cloturee', openedAt: '2024-04-02', closedAt: '2024-09-01' });
  });
  it('distingue ouverte, en cours, plan arrêté', () => {
    expect(rebuildProceedings([j('1', '2025-01-01', "Jugement d'ouverture d'une procédure de sauvegarde")])[0]!.status).toBe('ouverte');
    expect(rebuildProceedings([j('1', '2025-01-01', "Jugement d'ouverture d'une procédure de sauvegarde"), j('2', '2025-03-01', "Avis de dépôt de l'état des créances")])[0]!.status).toBe('en_cours');
    expect(rebuildProceedings([j('1', '2025-01-01', "Jugement d'ouverture d'une procédure de redressement judiciaire"), j('2', '2025-06-01', 'Jugement arrêtant le plan de redressement')])[0]!.status).toBe('plan_arrete');
  });
  it('ne duplique pas une ouverture publiée deux fois', () => {
    const procs = rebuildProceedings([j('1', '2025-01-01', "Jugement d'ouverture d'une procédure de liquidation judiciaire"), j('1b', '2025-01-01', "Jugement d'ouverture d'une procédure de liquidation judiciaire")]);
    expect(procs).toHaveLength(1);
  });
});

describe('valorisation', () => {
  const hist = [y(2021, { revenue: 800_000, ebe: 100_000, netIncome: 50_000, equity: 200_000, totalDebt: 50_000, cash: 30_000, depreciation: 20_000 }), y(2022, { revenue: 850_000, ebe: 110_000, netIncome: 55_000, equity: 230_000, totalDebt: 40_000, cash: 40_000, depreciation: 20_000 }), y(2023, { revenue: 900_000, ebe: 120_000, netIncome: 60_000, equity: 260_000, totalDebt: 30_000, cash: 50_000, depreciation: 20_000 })];
  it('applique plusieurs méthodes avec hypothèses et limites', () => {
    const v = valuate(hist, { sectorId: 'nettoyage', headcount: 7 });
    expect(v.status).toBe('estimee');
    expect(v.low! <= v.central! && v.central! <= v.high!).toBe(true);
    const ebe = v.methods.find((m) => m.method === 'ebe')!;
    expect(ebe.applicable).toBe(true);
    expect(ebe.assumptions.join(' ')).toMatch(/hypothèse paramétrable/);
    expect(v.methods.find((m) => m.method === 'dcf')!.applicable).toBe(true);
    expect(v.netDebt).toBe(-20_000);
  });
  it('refuse de valoriser sans comptes', () => {
    expect(valuate([]).status).toBe('non_calculable');
  });
  it("n'applique pas le multiple d'EBE si l'EBE est négatif", () => {
    const v = valuate([y(2023, { revenue: 100_000, ebe: -5000 })]);
    expect(v.methods.find((m) => m.method === 'ebe')!.applicable).toBe(false);
    expect(v.status).toBe('non_calculable');
  });
  it('valeur actuelle', () => {
    expect(presentValue([110], 0.1)).toBeCloseTo(100);
  });
});

describe('scénarios de reprise', () => {
  it('annuité et TRI', () => {
    expect(annuity(100_000, 0, 10)).toBe(10_000);
    expect(annuity(100_000, 0.05, 10)).toBeCloseTo(12950.46, 1);
    expect(irr([-100, 110])).toBeCloseTo(0.1, 4);
    expect(irr([100, 100])).toBeNull();
  });
  it('produit trois scénarios ordonnés et distingue rendement entreprise / fonds propres', () => {
    const deal = { baseRevenue: 900_000, baseEbe: 120_000, baseDepreciation: 20_000, grossMarginRate: 0.6, price: 450_000, acquisitionFeesRate: 0.08, initialInvestment: 0, workingCapital: 90_000, cashBuffer: 50_000, debtShare: 0.7, interestRate: 0.045, loanYears: 7, taxRate: 0.25, exitEbeMultiple: 4 };
    const [p, c, o] = defaultScenarios().map((s) => runScenario(deal, s));
    expect(p!.at5.cumulativeEquityCash).toBeLessThan(c!.at5.cumulativeEquityCash);
    expect(c!.at5.cumulativeEquityCash).toBeLessThan(o!.at5.cumulativeEquityCash);
    expect(c!.years).toHaveLength(5);
    expect(c!.financing.totalNeed).toBeCloseTo(450_000 * 1.08 + 10_000 + 90_000 + 50_000);
    expect(c!.businessReturn).not.toBeNull();
    expect(c!.breakEvenRevenue).toBeGreaterThan(0);
  });
  it('alerte si la dette n\'est pas couverte', () => {
    const r = runScenario({ baseRevenue: 100_000, baseEbe: 5_000, price: 500_000, acquisitionFeesRate: 0.08, initialInvestment: 0, workingCapital: 0, cashBuffer: 0, debtShare: 0.9, interestRate: 0.05, loanYears: 5, taxRate: 0.25, exitEbeMultiple: 3 }, defaultScenarios()[1]!);
    expect(r.warnings.join(' ')).toMatch(/ne couvre pas/);
    expect(r.breakEvenRevenue).toBeNull();
  });
});

describe('scoring', () => {
  const base: CompanySnapshot = {
    sectorId: 'nettoyage', creationDate: '2005-03-01', headcountBand: '03', isIndividual: false, adminStatus: 'A', establishments: 1, openEstablishments: 1,
    financials: [], proceedings: [], askingPrice: null, valuationCentral: null, identityCheckedAt: '2026-10-01', hasGeo: true, hasWebsite: true, officialFieldShare: 1, signalsCount: 0, now: new Date('2026-11-01'),
  };
  it('données insuffisantes : pas de note économique artificielle', () => {
    const s = computeScores({ ...base, sectorId: null, creationDate: null, headcountBand: null, isIndividual: null });
    expect(s.economic).toBeNull();
    expect(s.dataStatus).toBe('insuffisant');
  });
  it('identité seule (aucun compte) : données insuffisantes', () => {
    expect(computeScores(base).economic).toBeNull();
  });
  it('un seul exercice : note partielle ramenée vers 50', () => {
    const s = computeScores({ ...base, financials: [y(2025, { revenue: 500_000, netIncome: 60_000 })] });
    expect(s.economic).not.toBeNull();
    expect(s.dataStatus).toBe('partiel');
    expect(Math.abs(s.economic! - 50)).toBeLessThan(25);
  });
  it('entreprise rentable et documentée mieux notée qu\'une entreprise en perte', () => {
    const fin = (ni: number) => [y(2022, { revenue: 800_000, netIncome: ni, ebe: ni * 2 }), y(2023, { revenue: 900_000, netIncome: ni, ebe: ni * 2 }), y(2025, { revenue: 1_000_000, netIncome: ni, ebe: ni * 2 })];
    const good = computeScores({ ...base, financials: fin(80_000), askingPrice: 400_000, valuationCentral: 500_000 });
    const bad = computeScores({ ...base, financials: fin(-80_000), askingPrice: 400_000, valuationCentral: 500_000 });
    expect(good.economic!).toBeGreaterThan(bad.economic!);
    expect(bad.risk).toBeGreaterThan(good.risk);
    expect(good.dataStatus).toBe('suffisant');
  });
  it('une liquidation en cours fait monter le risque juridique au maximum', () => {
    const s = computeScores({ ...base, proceedings: [{ type: 'liquidation', status: 'ouverte', closedAt: null }] });
    expect(s.riskComponents.find((c) => c.key === 'juridique')!.value).toBe(1);
  });
});

describe('radars', () => {
  const base = { sectorId: 'paysagisme', creationDate: '1995-01-01', headcountBand: '03', adminStatus: 'A', establishments: 1, openEstablishments: 1, hasWebsite: null, activeListings: [], proceedings: [], signals: [], lastNetIncome: 20_000, now: new Date('2026-11-01') };
  it('piste cachée présentée comme prospection', () => {
    const r = detectOpportunities(base);
    expect(r.types).toEqual(['cachee']);
    expect(r.reasons[0]!.rule).toMatch(/non officiellement à vendre/);
  });
  it('procédure prioritaire sur la piste cachée', () => {
    const r = detectOpportunities({ ...base, proceedings: [{ type: 'redressement', status: 'ouverte' }] });
    expect(r.primary).toBe('procedure');
    expect(r.types).not.toContain('cachee');
  });
  it('procédure clôturée ignorée', () => {
    expect(detectOpportunities({ ...base, creationDate: '2020-01-01', proceedings: [{ type: 'liquidation', status: 'cloturee' }] }).types).toEqual([]);
  });
  it('détecte des expressions explicites seulement', () => {
    expect(detectTextSignals('Suite à mon départ à la retraite, je recherche un repreneur pour mon entreprise.').map((s) => s.type)).toEqual(['recherche_repreneur', 'depart_retraite_annonce']);
    expect(detectTextSignals('Entreprise familiale fondée en 1970, trois générations.')).toEqual([]);
    expect(detectTextSignals('Fonds de commerce à céder, centre-ville')[0]!.type).toBe('affaire_a_ceder');
  });
  it('indice de transmission plafonné et sans signal = null', () => {
    expect(transmissionIndex([])).toBeNull();
    expect(transmissionIndex([{ type: 'a', strength: 3, evidence: '', source: 's' }, { type: 'b', strength: 3, evidence: '', source: 's' }])).toBe(100);
    expect(transmissionIndex([{ type: 'a', strength: 1, evidence: '', source: 's' }])).toBe(12);
  });
});

describe('entreprises en difficulté', () => {
  it('liquidation : pas de rachat de titres, contrats toujours à vérifier', () => {
    const a = analyzeDistress({ type: 'liquidation', status: 'ouverte' }, { isIndividual: false, headcount: 4 });
    expect(a.modes.find((m) => m.key === 'titres')!.applicability).toBe('peu_probable');
    expect(a.modes.find((m) => m.key === 'contrats')!.applicability).toBe('a_verifier');
    expect(a.checklist.length).toBeGreaterThan(8);
  });
});
