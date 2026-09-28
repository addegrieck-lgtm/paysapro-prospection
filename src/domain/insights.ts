// « Pourquoi contacter cette entreprise ? » et « Angle de prospection ».
// Uniquement des FAITS tirés de la fiche : jamais de problème supposé, jamais de besoin inventé.
import type { Prospect } from './types';
import { HEADCOUNT_BANDS, headcountMin, SERVICE_LABEL } from './referentials';

const fr = (n: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(n);

export function contactReasons(p: Prospect, now = new Date()): string[] {
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

export type Angle = 'Gain de temps' | 'Devis' | 'Suivi client' | 'Organisation' | 'Relances' | 'Gestion commerciale' | 'Professionnalisation';

export interface AngleResult {
  angle: Angle;
  why: string[];
}

export function prospectingAngle(p: Prospect, now = new Date()): AngleResult {
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
