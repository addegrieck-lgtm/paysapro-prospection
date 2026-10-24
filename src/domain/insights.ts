// « Pourquoi contacter cette entreprise ? » et « Angle de prospection ».
// Uniquement des FAITS tirés de la fiche : jamais de problème supposé, jamais de besoin inventé.
import type { Prospect } from './types';
import { HEADCOUNT_BANDS, headcountMin, SERVICE_LABEL } from './referentials';
import { nafKeyword, offerByWorkspace } from './offers';

const fr = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

export function contactReasons(p: Prospect, now = new Date()): string[] {
  if (offerByWorkspace(p.workspaceId).id === 'agence') return agencyReasons(p, now);
  const reasons: string[] = [];
  if (p.googleReviews !== null && p.googleReviews >= 20) {
    reasons.push(`Forte présence locale : ${fr(p.googleReviews)} avis Google${p.googleRating !== null ? ` (note ${fr(p.googleRating)})` : ''}.`);
  } else if (p.googleRating !== null && p.googleRating >= 4.5 && (p.googleReviews ?? 0) >= 5) {
    reasons.push(`Clients satisfaits : note Google ${fr(p.googleRating)}.`);
  }
  if (p.website) reasons.push('Site internet actif : entreprise déjà présente en ligne.');
  const hc = headcountMin(p.headcountBand, p.headcount);
  if (hc !== null && hc >= 3) {
    reasons.push(`Équipe structurée : ${p.headcount !== null ? `${p.headcount} personnes` : HEADCOUNT_BANDS[p.headcountBand ?? '']?.[0]}.`);
  }
  if (p.services.includes('creation') || p.services.includes('amenagement')) reasons.push('Activité orientée création / aménagement extérieur (projets à chiffrer).');
  else if (p.services.length >= 2) reasons.push(`Plusieurs prestations : ${p.services.slice(0, 3).map((s) => SERVICE_LABEL[s].toLowerCase()).join(', ')}.`);
  if (p.creationDate) {
    const years = now.getFullYear() - Number(p.creationDate.slice(0, 4));
    if (years <= 3) reasons.push(`Entreprise récente (créée en ${p.creationDate.slice(0, 4)}) : période où l'on met en place ses outils.`);
    else if (years >= 10) reasons.push(`Entreprise établie depuis ${years} ans.`);
  }
  if (p.active) reasons.push('Établissement actif au répertoire SIRENE.');
  return reasons.slice(0, 3);
}

/** Signe & Seine : uniquement des constats (site trouvé ou non, fiche Google, date de création). */
function agencyReasons(p: Prospect, now: Date): string[] {
  const reasons: string[] = [];
  const metier = nafKeyword(p.nafCode);
  if (p.creationDate) {
    const years = now.getFullYear() - Number(p.creationDate.slice(0, 4));
    if (years <= 1) reasons.push(`Entreprise créée en ${p.creationDate.slice(0, 4)} : logo, cartes, site et fiche Google sont souvent à mettre en place.`);
    else if (years <= 3) reasons.push(`Entreprise récente (créée en ${p.creationDate.slice(0, 4)}) : période où l'on construit son image.`);
  }
  if (!p.website && p.contactsCheckedAt) reasons.push('Aucun site internet trouvé lors de la recherche de coordonnées.');
  else if (p.website) reasons.push('A déjà un site : angle refonte, référencement local ou maintenance.');
  const hasGoogle = !!p.googleUrl || p.googleReviews !== null || p.googleRating !== null;
  if (!hasGoogle && p.googleCheckedAt) reasons.push('Pas de fiche Google trouvée : les clients du secteur ne la voient pas sur Maps.');
  else if (hasGoogle && (p.googleReviews ?? 0) < 10) reasons.push(`Fiche Google avec peu d'avis (${fr(p.googleReviews ?? 0)}) : marge de progression locale.`);
  else if (p.googleReviews !== null && p.googleReviews >= 50) reasons.push(`Clientèle importante : ${fr(p.googleReviews)} avis Google.`);
  const hc = headcountMin(p.headcountBand, p.headcount);
  if (hc !== null && hc >= 3) reasons.push(`Équipe de ${p.headcount !== null ? `${p.headcount} personnes` : HEADCOUNT_BANDS[p.headcountBand ?? '']?.[0]} : véhicules, tenues et supports à identifier.`);
  if (metier && reasons.length < 3) reasons.push(`Métier : ${metier}${p.city ? ` à ${p.city}` : ''}.`);
  if (p.active) reasons.push('Établissement actif au répertoire SIRENE.');
  return reasons.slice(0, 3);
}

export type Angle =
  | 'Gain de temps'
  | 'Devis'
  | 'Suivi client'
  | 'Organisation'
  | 'Relances'
  | 'Gestion commerciale'
  | 'Professionnalisation'
  // Signe & Seine
  | 'Pack Bien démarrer'
  | 'Création de site'
  | 'Fiche Google'
  | 'Refonte & référencement'
  | 'Supports imprimés';

export interface AngleResult {
  angle: Angle;
  why: string[];
}

export function prospectingAngle(p: Prospect, now = new Date()): AngleResult {
  if (offerByWorkspace(p.workspaceId).id === 'agence') return agencyAngle(p, now);
  const hc = headcountMin(p.headcountBand, p.headcount);
  if (p.googleReviews !== null && p.googleReviews >= 50) {
    return { angle: 'Suivi client', why: [`${fr(p.googleReviews)} avis Google : beaucoup de clients particuliers à suivre.`] };
  }
  if (hc !== null && hc >= 6) return { angle: 'Organisation', why: [`Effectif d'au moins ${hc} personnes : plusieurs équipes et chantiers en parallèle.`] };
  if (p.services.includes('creation') || p.services.includes('amenagement')) {
    return { angle: 'Devis', why: ['Création / aménagement : des projets sur mesure à chiffrer.'] };
  }
  if (p.creationDate && now.getFullYear() - Number(p.creationDate.slice(0, 4)) <= 3) {
    return { angle: 'Gestion commerciale', why: [`Entreprise créée en ${p.creationDate.slice(0, 4)}.`] };
  }
  if (!p.website && p.googleReviews === null) {
    return { angle: 'Professionnalisation', why: ['Aucun site ni fiche Google renseignés : des devis soignés renforcent l’image.'] };
  }
  if (p.services.includes('entretien')) return { angle: 'Relances', why: ['Entretien : contrats récurrents et relances régulières.'] };
  return { angle: 'Gain de temps', why: ['Angle par défaut : pas de donnée plus spécifique sur ce prospect.'] };
}

function agencyAngle(p: Prospect, now: Date): AngleResult {
  const hasGoogle = !!p.googleUrl || p.googleReviews !== null || p.googleRating !== null;
  if (p.creationDate && now.getFullYear() - Number(p.creationDate.slice(0, 4)) <= 1) {
    return { angle: 'Pack Bien démarrer', why: [`Entreprise créée en ${p.creationDate.slice(0, 4)} : identité, imprimés, site et fiche Google en une fois.`] };
  }
  if (!p.website && p.contactsCheckedAt) return { angle: 'Création de site', why: ['Aucun site trouvé : un site vitrine simple, avec coordonnées et prestations.'] };
  if (!hasGoogle && p.googleCheckedAt) return { angle: 'Fiche Google', why: ['Pas de fiche Google : création de la fiche, photos, horaires et avis.'] };
  if (p.website) return { angle: 'Refonte & référencement', why: ['Site existant : modernisation, affichage sur téléphone, référencement local.'] };
  if (hasGoogle && (p.googleReviews ?? 0) < 10) return { angle: 'Fiche Google', why: ['Peu d’avis Google : cartes « laissez-nous un avis », photos, publications.'] };
  return { angle: 'Supports imprimés', why: ['Angle par défaut : cartes de visite, flyers et identité visuelle.'] };
}
