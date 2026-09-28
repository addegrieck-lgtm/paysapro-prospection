// Moteur de scoring transparent (0–100), entièrement calculé en local, sans service payant.
//
// Chaque règle ne compte qu'une fois (pas de double comptage) :
//  • le site web compte une seule fois, qu'il vienne de SIRENE, d'un CSV ou de la fiche Google ;
//  • les avis sont un palier unique (+10 au-delà de 20, +20 au-delà de 50) ;
//  • la note n'est prise en compte qu'avec au moins 5 avis (une note de 5/5 sur 1 avis ne dit rien) ;
//  • le code NAF « aménagement paysager » ne donne PAS de points (tous les prospects l'ont) :
//    seules les prestations réellement renseignées comptent.
import type { Prospect, ServiceTag } from './types';
import { HEADCOUNT_BANDS, headcountMin } from './referentials';

export interface ScoreReason {
  points: number;
  label: string;
}

export interface ScoreResult {
  score: number;
  reasons: ScoreReason[];
  /** Critères non remplis : ce qu'il faudrait vérifier pour affiner le score */
  missing: string[];
}

export type ScoreInput = Pick<
  Prospect,
  'phone' | 'email' | 'website' | 'googleUrl' | 'googleRating' | 'googleReviews' | 'headcount' | 'headcountBand' | 'services' | 'activity'
>;

export const SCORING_RULES = [
  { points: 15, label: 'Téléphone disponible' },
  { points: 5, label: 'E-mail disponible' },
  { points: 15, label: 'Site internet' },
  { points: 15, label: 'Présence Google renseignée' },
  { points: 10, label: 'Plus de 20 avis Google (+10 de plus au-delà de 50)' },
  { points: 10, label: 'Note Google ≥ 4,5 (avec au moins 5 avis)' },
  { points: 10, label: 'Effectif ≥ 3 personnes' },
  { points: 5, label: 'Activité de création / aménagement' },
  { points: 5, label: 'Plusieurs prestations complémentaires' },
] as const;

const CREATION: ServiceTag[] = ['creation', 'amenagement'];

const fr = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

export function computeScore(p: ScoreInput): ScoreResult {
  const reasons: ScoreReason[] = [];
  const missing: string[] = [];
  const add = (points: number, label: string) => reasons.push({ points, label });

  if (p.phone) add(15, 'Téléphone disponible');
  else missing.push('Téléphone');
  if (p.email) add(5, 'E-mail disponible');
  else missing.push('E-mail');
  if (p.website) add(15, 'Site internet');
  else missing.push('Site internet');

  const reviews = p.googleReviews ?? null;
  const hasGoogle = !!p.googleUrl || reviews !== null || p.googleRating !== null;
  if (hasGoogle) add(15, 'Présence Google');
  else missing.push('Présence Google (à vérifier)');

  if (reviews !== null && reviews > 50) add(20, `${fr(reviews)} avis Google`);
  else if (reviews !== null && reviews > 20) add(10, `${fr(reviews)} avis Google`);

  if (p.googleRating !== null && p.googleRating >= 4.5 && (reviews ?? 0) >= 5) add(10, `Note Google ${fr(p.googleRating)}`);

  const hc = headcountMin(p.headcountBand, p.headcount);
  if (hc !== null && hc >= 3) {
    add(10, p.headcount !== null ? `Effectif : ${p.headcount} personnes` : `Effectif : ${HEADCOUNT_BANDS[p.headcountBand ?? '']?.[0] ?? ''}`);
  } else if (hc === null) missing.push('Effectif');

  const services = p.services ?? [];
  if (services.some((s) => CREATION.includes(s))) add(5, "Activité de création / d'aménagement");
  if (services.length >= 2) add(5, `${services.length} prestations complémentaires`);
  else if (services.length === 0) missing.push('Prestations');

  const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
  return { score, reasons, missing };
}

export type PriorityLevel = 'max' | 'high' | 'normal' | 'low';

export const PRIORITIES: { id: PriorityLevel; min: number; label: string; emoji: string }[] = [
  { id: 'max', min: 80, label: 'Priorité maximale', emoji: '🔥' },
  { id: 'high', min: 60, label: 'Priorité élevée', emoji: '🟠' },
  { id: 'normal', min: 40, label: 'Priorité normale', emoji: '🟡' },
  { id: 'low', min: 0, label: 'Faible priorité', emoji: '⚪' },
];

export function priorityOf(score: number): (typeof PRIORITIES)[number] {
  return PRIORITIES.find((p) => score >= p.min) ?? PRIORITIES[PRIORITIES.length - 1]!;
}
