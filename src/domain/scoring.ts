// Moteur de scoring transparent (0–100), entièrement local, basé uniquement sur des critères objectifs.
//
// Configurable dans le code : modifiez SCORING_CONFIG (les poids), puis « Recalculer les scores »
// (Paramètres → Données). Chaque critère ne compte qu'une fois (pas de double comptage) :
//  • le site compte une fois quelle que soit sa source ;
//  • les avis sont un palier unique ; la note n'est prise en compte qu'avec au moins 5 avis ;
//  • le code NAF « aménagement paysager » ne donne pas de points (tous les prospects l'ont).
//
// Chaque offre a son barème : Paysapro (SCORING_CONFIG) cherche des entreprises équipées et joignables ;
// Signe & Seine (AGENCE_SCORING_CONFIG) cherche celles qui ont BESOIN d'une agence : pas de site, pas de fiche
// Google, peu d'avis, création récente. Le barème suit l'espace de travail de la fiche (workspaceId).
import type { Prospect, ServiceTag } from './types';
import { HEADCOUNT_BANDS, headcountMin } from './referentials';
import { offerByWorkspace } from './offers';

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

/**
 * Signe & Seine — « besoin d'une agence » + « joignable » (total 100). Une absence n'est comptée que si elle a été
 * constatée : « aucun site » après la recherche de coordonnées, « pas de fiche Google » après vérification.
 */
export const AGENCE_SCORING_CONFIG = {
  active: 15, // Entreprise active (source officielle)
  phone: 10,
  email: 10,
  noWebsite: 20, // Aucun site trouvé après la recherche de coordonnées
  noGoogle: 10, // Pas de fiche Google (vérifiée)
  fewReviews: 5, // Fiche Google avec moins de 10 avis (remplace le palier précédent)
  noSocial: 5, // Aucun réseau social trouvé après la recherche de coordonnées
  recent1: 15, // Créée depuis moins d'un an : tout est à faire (logo, cartes, site)
  recent3: 10, // Créée depuis 1 à 3 ans (remplace le palier précédent)
  employer: 5, // Au moins un salarié : budget communication plus probable
  targetZone: 5, // Département ciblé dans les paramètres
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
  Partial<
    Pick<
      Prospect,
      | 'active'
      | 'creationDate'
      | 'department'
      | 'facebook'
      | 'instagram'
      | 'linkedin'
      | 'tiktok'
      | 'siren'
      | 'siret'
      | 'nafCode'
      | 'address'
      | 'postalCode'
      | 'city'
      | 'name'
      | 'workspaceId'
      | 'contactsCheckedAt'
      | 'googleCheckedAt'
    >
  >;

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

const ADMIN_KEYS = ['siren', 'siret', 'nafCode', 'address', 'postalCode', 'city', 'creationDate', 'name'] as const;

const CREATION: ServiceTag[] = ['creation', 'amenagement'];
const fr = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

export function computeScore(p: ScoreInput, ctx: ScoringContext = context): ScoreResult {
  if (offerByWorkspace(p.workspaceId).id === 'agence') return computeAgencyScore(p, ctx);
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

  if (ADMIN_KEYS.every((k) => p[k]) && p.active != null) add(C.complete, 'Informations administratives complètes');
  else missing.push('Informations administratives incomplètes');

  if (!(p.facebook || p.instagram || p.linkedin || p.tiktok)) missing.push('Réseaux sociaux inconnus');

  const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
  return { score, reasons, missing };
}

/** Barème Signe & Seine : les entreprises qui ont le plus besoin de l'agence, et que l'on peut joindre. */
export function computeAgencyScore(p: ScoreInput, ctx: ScoringContext = context): ScoreResult {
  const C = AGENCE_SCORING_CONFIG;
  const reasons: ScoreReason[] = [];
  const missing: string[] = [];
  const add = (points: number, label: string) => reasons.push({ points, label });
  const searched = !!p.contactsCheckedAt;

  if (p.active === true) add(C.active, 'Entreprise active');
  else if (p.active === false) missing.push('Établissement fermé');
  else missing.push('Statut administratif inconnu');

  if (p.phone) add(C.phone, 'Téléphone disponible');
  else missing.push('Téléphone');
  if (p.email) add(C.email, 'E-mail disponible');
  else missing.push('E-mail');

  if (p.website) missing.push('A déjà un site (refonte possible)');
  else if (searched) add(C.noWebsite, 'Aucun site internet trouvé');
  else missing.push('Site web (lancer la recherche de coordonnées)');

  const reviews = p.googleReviews ?? null;
  const hasGoogle = !!p.googleUrl || reviews !== null || p.googleRating !== null;
  if (hasGoogle && (reviews ?? 0) < 10) add(C.fewReviews, reviews ? `Peu d'avis Google (${fr(reviews)})` : 'Fiche Google sans avis');
  else if (hasGoogle) missing.push(`Fiche Google déjà active (${fr(reviews ?? 0)} avis)`);
  else if (p.googleCheckedAt) add(C.noGoogle, 'Pas de fiche Google');
  else missing.push('Présence Google (à vérifier)');

  if (p.facebook || p.instagram || p.linkedin || p.tiktok) missing.push('Déjà présente sur les réseaux sociaux');
  else if (searched) add(C.noSocial, 'Aucun réseau social trouvé');
  else missing.push('Réseaux sociaux inconnus');

  if (p.creationDate) {
    const months = monthsSince(p.creationDate, ctx.now ?? new Date());
    if (months >= 0 && months < 12) add(C.recent1, `Entreprise créée il y a moins d'un an (${p.creationDate.slice(0, 7).split('-').reverse().join('/')})`);
    else if (months >= 0 && months < 36) add(C.recent3, `Entreprise récente (${p.creationDate.slice(0, 4)})`);
  } else missing.push('Date de création');

  const hc = headcountMin(p.headcountBand, p.headcount);
  if (hc !== null && hc >= 1) add(C.employer, `Employeur : ${p.headcount !== null ? `${p.headcount} personne(s)` : (HEADCOUNT_BANDS[p.headcountBand ?? '']?.[0] ?? '')}`);
  else if (hc === null) missing.push('Effectif');

  if (p.department && ctx.targetDepartments.includes(p.department)) add(C.targetZone, `Zone ciblée (${p.department})`);

  if (ADMIN_KEYS.every((k) => p[k]) && p.active != null) add(C.complete, 'Informations administratives complètes');
  else missing.push('Informations administratives incomplètes');

  const score = Math.min(100, reasons.reduce((s, r) => s + r.points, 0));
  return { score, reasons, missing };
}

function monthsSince(isoDate: string, now: Date): number {
  const [y, m] = isoDate.slice(0, 7).split('-').map(Number);
  if (!y) return -1;
  return (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - (m || 1));
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
