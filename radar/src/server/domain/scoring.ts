/**
 * Trois notes distinctes et explicables :
 *  - Score économique /100 : attractivité (rentabilité, récurrence, prix, croissance, solidité, facilité de reprise).
 *  - Score de risque /100 : plus il est élevé, plus la reprise est risquée.
 *  - Score de fiabilité /100 : qualité, fraîcheur, provenance et complétude des données.
 *
 * Garde-fou : une composante sans données n'est pas notée. Le score économique est ramené vers 50 (neutre)
 * proportionnellement à la part des pondérations réellement évaluées, et n'est pas calculé du tout (statut
 * « données insuffisantes ») si moins de 40 % des pondérations sont évaluables. Une entreprise mal documentée ne peut
 * donc pas obtenir artificiellement une excellente note.
 */
import { analyzeTrends, ebeOf, type FinancialYear } from './financial';
import { HEADCOUNT_BANDS } from './sectors';
import { RECURRENT_SECTORS } from './valuation';
import type { ProcStatus, ProcType } from './proceedings';

export interface ScoringWeights {
  rentabilite: number;
  recurrence: number;
  prix: number;
  croissance: number;
  solidite: number;
  facilite: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = { rentabilite: 25, recurrence: 20, prix: 20, croissance: 15, solidite: 10, facilite: 10 };

export interface RiskWeights {
  financier: number;
  juridique: number;
  social: number;
  operationnel: number;
  dirigeant: number;
  clients: number;
  investissement: number;
  incertitude: number;
}

export const DEFAULT_RISK_WEIGHTS: RiskWeights = { financier: 20, juridique: 20, social: 10, operationnel: 10, dirigeant: 15, clients: 5, investissement: 10, incertitude: 10 };

export interface CompanySnapshot {
  sectorId: string | null;
  creationDate: string | null;
  headcountBand: string | null;
  isIndividual: boolean | null;
  adminStatus: string | null;
  establishments: number | null;
  openEstablishments: number | null;
  financials: FinancialYear[];
  proceedings: { type: ProcType; status: ProcStatus; closedAt: string | null }[];
  askingPrice: number | null;
  valuationCentral: number | null;
  identityCheckedAt: string | null;
  hasGeo: boolean;
  hasWebsite: boolean | null;
  officialFieldShare: number | null; // part des champs provenant de sources officielles (0..1)
  signalsCount: number;
  now?: Date;
}

export interface Component {
  key: string;
  label: string;
  weight: number;
  value: number | null; // 0..1 ; null = non évaluée
  points: number | null;
  explanation: string;
  basis: 'donnee' | 'hypothese' | 'inconnu';
}

export interface ScoreResult {
  economic: number | null;
  economicCoverage: number;
  risk: number;
  reliability: number;
  dataStatus: 'suffisant' | 'partiel' | 'insuffisant';
  economicComponents: Component[];
  riskComponents: Component[];
  reliabilityComponents: Component[];
  summary: string;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (v: number, a: number, b: number) => clamp01((v - a) / (b - a));
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function ageYears(creationDate: string | null, now = new Date()): number | null {
  if (!creationDate) return null;
  const d = new Date(creationDate);
  if (Number.isNaN(d.getTime())) return null;
  return (now.getTime() - d.getTime()) / (365.25 * 86400_000);
}

export function headcountMid(band: string | null): number | null {
  if (!band) return null;
  const b = HEADCOUNT_BANDS[band];
  if (!b) return null;
  return b.max === null ? b.min : (b.min + b.max) / 2;
}

function activeProc(s: CompanySnapshot) {
  return s.proceedings.filter((p) => p.status !== 'cloturee');
}

export function computeScores(s: CompanySnapshot, w: ScoringWeights = DEFAULT_WEIGHTS, rw: RiskWeights = DEFAULT_RISK_WEIGHTS): ScoreResult {
  const now = s.now ?? new Date();
  const fin = [...s.financials].sort((a, b) => a.fiscalYear - b.fiscalYear);
  const last = fin[fin.length - 1];
  const trends = analyzeTrends(fin);
  const age = ageYears(s.creationDate, now);
  const hc = headcountMid(s.headcountBand);
  const active = activeProc(s);
  const eco: Component[] = [];

  // Rentabilité (marge d'EBE de préférence, sinon marge nette)
  {
    const ebe = last ? ebeOf(last).value : null;
    if (last && num(last.revenue) && last.revenue > 0 && ebe !== null) {
      const m = ebe / last.revenue;
      eco.push({ key: 'rentabilite', label: 'Rentabilité', weight: w.rentabilite, value: lerp(m, 0, 0.2), points: null, explanation: `Marge d'EBE ${(m * 100).toFixed(1)} % (${last.fiscalYear})`, basis: 'donnee' });
    } else if (last && num(last.revenue) && last.revenue > 0 && num(last.netIncome)) {
      const m = last.netIncome / last.revenue;
      eco.push({ key: 'rentabilite', label: 'Rentabilité', weight: w.rentabilite, value: lerp(m, 0, 0.12), points: null, explanation: `Marge nette ${(m * 100).toFixed(1)} % (${last.fiscalYear})`, basis: 'donnee' });
    } else {
      eco.push({ key: 'rentabilite', label: 'Rentabilité', weight: w.rentabilite, value: null, points: null, explanation: 'Aucun résultat publié', basis: 'inconnu' });
    }
  }
  // Récurrence (hypothèse sectorielle tant que les contrats ne sont pas documentés)
  if (s.sectorId) {
    const v = RECURRENT_SECTORS.includes(s.sectorId) ? 0.8 : ['commerce-proximite', 'agences-web', 'seo', 'creation-sites', 'transport-logistique'].includes(s.sectorId) ? 0.55 : 0.4;
    eco.push({ key: 'recurrence', label: 'Récurrence clientèle', weight: w.recurrence, value: v, points: null, explanation: `Hypothèse sectorielle (${v >= 0.8 ? 'contrats d\'entretien ou de maintenance fréquents' : v >= 0.55 ? 'clientèle partiellement récurrente' : 'activité surtout ponctuelle'}) — à confirmer par le portefeuille de contrats`, basis: 'hypothese' });
  } else {
    eco.push({ key: 'recurrence', label: 'Récurrence clientèle', weight: w.recurrence, value: null, points: null, explanation: 'Secteur non déterminé', basis: 'inconnu' });
  }
  // Prix et valorisation
  if (num(s.askingPrice) && num(s.valuationCentral) && s.valuationCentral > 0) {
    const ratio = s.askingPrice / s.valuationCentral;
    eco.push({ key: 'prix', label: 'Prix et valorisation', weight: w.prix, value: 1 - lerp(ratio, 0.8, 1.6), points: null, explanation: `Prix demandé = ${(ratio * 100).toFixed(0)} % de la valeur centrale estimée`, basis: 'donnee' });
  } else {
    eco.push({ key: 'prix', label: 'Prix et valorisation', weight: w.prix, value: null, points: null, explanation: num(s.valuationCentral) ? 'Prix demandé inconnu (à renseigner dans l\'Acquisition Manager)' : 'Valorisation non calculable', basis: 'inconnu' });
  }
  // Croissance
  if (trends.revenueCagr !== null) {
    eco.push({ key: 'croissance', label: 'Potentiel de croissance', weight: w.croissance, value: lerp(trends.revenueCagr, -0.1, 0.12), points: null, explanation: `TCAM du CA ${(trends.revenueCagr * 100).toFixed(1)} % (${trends.years[0]}–${trends.years[trends.years.length - 1]})`, basis: 'donnee' });
  } else {
    eco.push({ key: 'croissance', label: 'Potentiel de croissance', weight: w.croissance, value: null, points: null, explanation: 'Moins de deux exercices de CA', basis: 'inconnu' });
  }
  // Solidité de l'activité
  if (age !== null) {
    let v = lerp(age, 1, 15);
    const parts = [`${Math.floor(age)} an(s) d'existence`];
    if (last && num(last.equity) && last.equity < 0) {
      v *= 0.4;
      parts.push('capitaux propres négatifs');
    }
    if (active.some((p) => p.type === 'liquidation')) {
      v *= 0.2;
      parts.push('liquidation en cours');
    } else if (active.length) {
      v *= 0.5;
      parts.push('procédure collective en cours');
    }
    eco.push({ key: 'solidite', label: "Solidité de l'activité", weight: w.solidite, value: clamp01(v), points: null, explanation: parts.join(', '), basis: 'donnee' });
  } else {
    eco.push({ key: 'solidite', label: "Solidité de l'activité", weight: w.solidite, value: null, points: null, explanation: 'Date de création inconnue', basis: 'inconnu' });
  }
  // Facilité de reprise
  if (hc !== null || s.isIndividual !== null) {
    let v = hc === null ? 0.5 : hc === 0 ? 0.35 : hc <= 9 ? 0.8 : hc <= 49 ? 0.65 : 0.45;
    const parts = [hc === null ? 'effectif inconnu' : hc === 0 ? 'sans salarié (forte dépendance au dirigeant)' : `${s.headcountBand ? HEADCOUNT_BANDS[s.headcountBand]?.label : ''}`];
    if (s.isIndividual) {
      v -= 0.15;
      parts.push('entreprise individuelle : reprise du fonds uniquement');
    }
    if ((s.openEstablishments ?? 1) > 2) {
      v -= 0.1;
      parts.push(`${s.openEstablishments} établissements`);
    }
    eco.push({ key: 'facilite', label: 'Facilité de reprise', weight: w.facilite, value: clamp01(v), points: null, explanation: parts.join(', '), basis: 'donnee' });
  } else {
    eco.push({ key: 'facilite', label: 'Facilité de reprise', weight: w.facilite, value: null, points: null, explanation: 'Effectif et forme juridique inconnus', basis: 'inconnu' });
  }

  const totalW = eco.reduce((a, c) => a + c.weight, 0) || 1;
  // La récurrence fondée sur une simple hypothèse sectorielle ne compte qu'à moitié dans la couverture.
  const coveredW = eco.reduce((a, c) => a + (c.value === null ? 0 : c.basis === 'hypothese' ? c.weight * 0.5 : c.weight), 0);
  const coverage = coveredW / totalW;
  for (const c of eco) c.points = c.value === null ? null : Math.round(c.value * c.weight * 10) / 10;
  let economic: number | null = null;
  if (coverage >= 0.4) {
    const evalW = eco.reduce((a, c) => a + (c.value === null ? 0 : c.weight), 0);
    const raw = (eco.reduce((a, c) => a + (c.value ?? 0) * c.weight, 0) / evalW) * 100;
    economic = Math.round(50 + (raw - 50) * coverage);
  }

  // Risque -------------------------------------------------------------------
  const risk: Component[] = [];
  const unknown = (key: string, label: string, weight: number, why: string): Component => ({ key, label, weight, value: 0.5, points: null, explanation: `${why} → risque moyen retenu par prudence`, basis: 'inconnu' });
  if (last && (num(last.netIncome) || num(last.equity))) {
    let v = 0.2;
    const parts: string[] = [];
    const losses = fin.filter((y) => num(y.netIncome) && y.netIncome < 0).length;
    if (losses) {
      v += Math.min(0.5, losses * 0.2);
      parts.push(`${losses} exercice(s) en perte`);
    }
    if (num(last.equity) && last.equity < 0) {
      v += 0.3;
      parts.push('capitaux propres négatifs');
    }
    if (num(last.totalDebt) && num(last.equity) && last.equity > 0 && last.totalDebt / last.equity > 2) {
      v += 0.2;
      parts.push('endettement élevé');
    }
    risk.push({ key: 'financier', label: 'Risque financier', weight: rw.financier, value: clamp01(v), points: null, explanation: parts.length ? parts.join(', ') : 'Pas de signal financier défavorable dans les données publiées', basis: 'donnee' });
  } else risk.push(unknown('financier', 'Risque financier', rw.financier, 'Aucun compte publié'));
  {
    const liq = active.some((p) => p.type === 'liquidation');
    const rj = active.some((p) => p.type === 'redressement');
    const sv = active.some((p) => p.type === 'sauvegarde' || p.type === 'conciliation');
    const recentClosed = s.proceedings.some((p) => p.status === 'cloturee' && p.closedAt && now.getTime() - new Date(p.closedAt).getTime() < 3 * 365 * 86400_000);
    const v = liq ? 1 : rj ? 0.8 : sv ? 0.6 : recentClosed ? 0.35 : s.adminStatus === 'C' ? 0.9 : 0.1;
    risk.push({ key: 'juridique', label: 'Risque juridique', weight: rw.juridique, value: v, points: null, explanation: liq ? 'Liquidation judiciaire en cours' : rj ? 'Redressement judiciaire en cours' : sv ? 'Sauvegarde ou conciliation en cours' : recentClosed ? 'Procédure clôturée depuis moins de 3 ans' : s.adminStatus === 'C' ? 'Entreprise cessée' : 'Aucune procédure collective connue (BODACC)', basis: 'donnee' });
  }
  if (hc !== null) {
    const v = active.length ? lerp(hc, 0, 30) * 0.9 + 0.1 : lerp(hc, 0, 100) * 0.5;
    risk.push({ key: 'social', label: 'Risque social', weight: rw.social, value: clamp01(v), points: null, explanation: `Effectif estimé ${hc}${active.length ? ', avec procédure en cours (passif social possible)' : ''}`, basis: 'donnee' });
  } else risk.push(unknown('social', 'Risque social', rw.social, 'Effectif inconnu'));
  if (age !== null) risk.push({ key: 'operationnel', label: 'Risque opérationnel', weight: rw.operationnel, value: age < 3 ? 0.7 : age < 7 ? 0.4 : 0.25, points: null, explanation: `${Math.floor(age)} an(s) d'ancienneté`, basis: 'donnee' });
  else risk.push(unknown('operationnel', 'Risque opérationnel', rw.operationnel, 'Ancienneté inconnue'));
  if (hc !== null || s.isIndividual) {
    const v = s.isIndividual ? 0.9 : hc === 0 ? 0.85 : hc !== null && hc <= 2 ? 0.75 : hc !== null && hc <= 9 ? 0.5 : 0.3;
    risk.push({ key: 'dirigeant', label: 'Dépendance au dirigeant', weight: rw.dirigeant, value: v, points: null, explanation: s.isIndividual ? 'Entreprise individuelle' : `Structure de ${hc} personne(s) en moyenne de tranche`, basis: 'hypothese' });
  } else risk.push(unknown('dirigeant', 'Dépendance au dirigeant', rw.dirigeant, 'Effectif inconnu'));
  risk.push(unknown('clients', 'Dépendance aux clients', rw.clients, 'Concentration de la clientèle non documentée publiquement'));
  if (last && num(last.fixedAssets) && num(last.depreciation) && num(last.revenue) && last.revenue > 0) {
    const v = lerp(last.depreciation / last.revenue, 0.01, 0.1);
    risk.push({ key: 'investissement', label: "Besoin d'investissement", weight: rw.investissement, value: v, points: null, explanation: `Dotations = ${((last.depreciation / last.revenue) * 100).toFixed(1)} % du CA`, basis: 'donnee' });
  } else risk.push(unknown('investissement', "Besoin d'investissement", rw.investissement, 'État et âge des équipements inconnus'));

  // Fiabilité ----------------------------------------------------------------
  const rel: Component[] = [];
  const identityFields = [s.creationDate, s.headcountBand, s.sectorId, s.adminStatus].filter((x) => x !== null && x !== undefined).length;
  rel.push({ key: 'identite', label: 'Identité officielle', weight: 25, value: identityFields / 4, points: null, explanation: `${identityFields}/4 champs d'identité renseignés`, basis: 'donnee' });
  rel.push({ key: 'comptes', label: 'Comptes disponibles', weight: 30, value: lerp(fin.filter((y) => num(y.revenue) || num(y.netIncome)).length, 0, 3), points: null, explanation: `${fin.length} exercice(s) publié(s)`, basis: 'donnee' });
  const lastYear = last?.fiscalYear ?? null;
  const freshFin = lastYear !== null ? lerp(lastYear, now.getFullYear() - 4, now.getFullYear() - 1) : 0;
  const freshId = s.identityCheckedAt ? 1 - lerp((now.getTime() - new Date(s.identityCheckedAt).getTime()) / 86400_000, 30, 365) : 0;
  rel.push({ key: 'fraicheur', label: 'Fraîcheur', weight: 20, value: (freshFin + freshId) / 2, points: null, explanation: `Dernier exercice : ${lastYear ?? 'aucun'} ; identité vérifiée ${s.identityCheckedAt ? `le ${s.identityCheckedAt.slice(0, 10)}` : 'jamais'}`, basis: 'donnee' });
  rel.push({ key: 'provenance', label: 'Provenance', weight: 15, value: s.officialFieldShare ?? 0, points: null, explanation: s.officialFieldShare === null ? 'Provenance non tracée' : `${Math.round((s.officialFieldShare ?? 0) * 100)} % des champs issus de sources officielles`, basis: 'donnee' });
  rel.push({ key: 'localisation', label: 'Géolocalisation', weight: 10, value: s.hasGeo ? 1 : 0, points: null, explanation: s.hasGeo ? 'Coordonnées connues' : 'Non géolocalisée', basis: 'donnee' });

  const score = (cs: Component[]) => {
    const tw = cs.reduce((a, c) => a + c.weight, 0) || 1;
    for (const c of cs) c.points = c.value === null ? null : Math.round(c.value * c.weight * 10) / 10;
    return Math.round((cs.reduce((a, c) => a + (c.value ?? 0) * c.weight, 0) / tw) * 100);
  };
  const reliability = score(rel);
  // Incertitude des données intégrée au risque
  const inc = 1 - reliability / 100;
  risk.push({ key: 'incertitude', label: 'Incertitude sur les données', weight: rw.incertitude, value: inc, points: Math.round(inc * rw.incertitude * 10) / 10, explanation: `Fiabilité des données ${reliability}/100`, basis: 'donnee' });
  const riskFinal = score(risk);

  const dataStatus = economic === null || reliability < 35 ? 'insuffisant' : coverage < 0.75 || reliability < 60 ? 'partiel' : 'suffisant';
  const summary =
    economic === null
      ? `Données insuffisantes pour une note économique (${Math.round(coverage * 100)} % des critères évaluables). Risque ${riskFinal}/100, fiabilité ${reliability}/100.`
      : `Score économique ${economic}/100 (${Math.round(coverage * 100)} % des critères évalués), risque ${riskFinal}/100, fiabilité ${reliability}/100.`;
  return { economic, economicCoverage: coverage, risk: riskFinal, reliability, dataStatus, economicComponents: eco, riskComponents: risk, reliabilityComponents: rel, summary };
}

export const WEIGHTS_VERSION = (w: ScoringWeights, rw: RiskWeights) => `e${Object.values(w).join('-')}_r${Object.values(rw).join('-')}`;
