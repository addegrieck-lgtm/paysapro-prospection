// Moteur de scoring transparent (0–100), entièrement local, basé uniquement sur des critères objectifs.
//
// Configurable dans le code : modifiez SCORING_CONFIG (les poids), puis « Recalculer les scores »
// (Paramètres → Données). Chaque critère ne compte qu'une fois (pas de double comptage) :
//  • le site compte une fois quelle que soit sa source ;
//  • les avis sont un palier unique ; la note n'est prise en compte qu'avec au moins 5 avis ;
//  • le code NAF « aménagement paysager » ne donne pas de points (tous les prospects l'ont).
import type { Prospect, ServiceTag } from './types';
import { HEADCOUNT_BANDS, headcountMin } from './referentials';

export const SCORING_CONFIG = {
  active: 15, // Entreprise active (source officielle)
  phone: 10,
  email: 15,
  website: 10,
  google: 5, // Présence Google renseignée (URL, note ou avis)
  reviews20: 5, // Plus de 20 avis Google
  reviews50: 10, // Plus de 50 avis Google (remplace le palier précédent)
  rating: 5, // Note ≥ 4,5 avec au moins 5 avis
  headcountKnown: 5, // Effectif connu
  headcount3: 5, // Effectif ≥ 3 (en plus)
  recent: 5, // Entreprise récente (≤ 3 ans) : période où l'on s'équipe
  targetZone: 5, // Département ciblé dans les paramètres
  services: 5, // Création / aménagement, ou au moins 2 prestations
  complete: 5, // Informations administratives complètes
} as const;

export interface ScoreReason {
  points: number;
  label: string;
}

export interface ScoreResult {
  score: number;
  reasons: ScoreReason[];
  /** Critères non remplis (« − ») : ce qu'il faudrait vérifier pour affiner le score */
  missing: string[];
}

export type ScoreInput = Pick<
  Prospect,
  | 'phone'
  | 'email'
  | 'website'
  | 'googleUrl'
  | 'googleRating'
  | 'googleReviews'
  | 'headcount'
  | 'headcountBand'
  | 'services'
  | 'activity'
> &
  Partial<Pick<Prospect, 'active' | 'creationDate' | 'department' | 'facebook' | 'instagram' | 'linkedin' | 'tiktok' | 'siren' | 'siret' | 'nafCode' | 'address' | 'postalCode' | 'city' | 'name'>>;

export interface ScoringContext {
  targetDepartments: string[];
  now?: Date;
}

let context: ScoringContext = { targetDepartments: [] };

/** Contexte global (départements ciblés), fixé à partir des paramètres. */
export function setScoringContext(ctx: ScoringContext): void {
  context = ctx;
}

export function getScoringContext(): ScoringContext {
  return context;
}

const CREATION: ServiceTag[] = ['creation', 'amenagement'];
const fr = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

export function computeScore(p: ScoreInput, ctx: ScoringContext = context): ScoreResult {
  const C = SCORING_CONFIG;
  const reasons: ScoreReason[] = [];
  const missing: string[] = [];
  const add = (points: number, label: string) => reasons.push({ points, label });

  if (p.active === true) add(C.active, 'Entreprise active');
  else if (p.active === false) missing.push('Établissement fermé');
  else missing.push('Statut administratif inconnu');

  if (p.phone) add(C.phone, 'Téléphone disponible');
  else missing.push('Téléphone');
  if (p.email) add(C.email, 'E-mail disponible');
  else missing.push('E-mail');
  if (p.website) add(C.website, 'Site web disponible');
  else missing.push('Site web');

  const reviews = p.googleReviews ?? null;
  if (p.googleUrl || reviews !== null || p.googleRating !== null) add(C.google, 'Présence Google');
  else missing.push('Présence Google (à vérifier)');
  if (reviews !== null && reviews > 50) add(C.reviews50, `${fr(reviews)} avis Google`);
  else if (reviews !== null && reviews > 20) add(C.reviews20, `${fr(reviews)} avis Google`);
  if (p.googleRating !== null && p.googleRating >= 4.5 && (reviews ?? 0) >= 5) add(C.rating, `Note Google ${fr(p.googleRating)}`);

  const hc = headcountMin(p.headcountBand, p.headcount);
  if (hc !== null) {
    add(C.headcountKnown, `Effectif connu : ${p.headcount !== null ? `${p.headcount} personne(s)` : (HEADCOUNT_BANDS[p.headcountBand ?? '']?.[0] ?? '')}`);
    if (hc >= 3) add(C.headcount3, 'Effectif ≥ 3 personnes');
  } else missing.push('Effectif');

  if (p.creationDate) {
    const years = (ctx.now ?? new Date()).getFullYear() - Number(p.creationDate.slice(0, 4));
    if (years >= 0 && years <= 3) add(C.recent, `Entreprise récente (${p.creationDate.slice(0, 4)})`);
  }

  if (p.department && ctx.targetDepartments.includes(p.department)) add(C.targetZone, `Zone ciblée (${p.department})`);

  const services = p.services ?? [];
  if (services.some((s) => CREATION.includes(s))) add(C.services, 'Services correspondants (création / aménagement)');
  else if (services.length >= 2) add(C.services, `${services.length} prestations complémentaires`);
  else if (services.length === 0) missing.push('Services');

  const adminKeys = ['siren', 'siret', 'nafCode', 'address', 'postalCode', 'city', 'creationDate', 'name'] as const;
  if (adminKeys.every((k) => p[k]) && p.active != null) add(C.complete, 'Informations administratives complètes');
  else missing.push('Informations administratives incomplètes');

  if (!(p.facebook || p.instagram || p.linkedin || p.tiktok)) missing.push('Réseaux sociaux inconnus');

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
