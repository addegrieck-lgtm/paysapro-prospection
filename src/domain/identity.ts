// CompanyIdentityEngine : identité de référence d'une entreprise, et score de correspondance d'un site web.
//
// L'identité (SIREN, SIRET, raison sociale, nom commercial, adresse, commune, NAF, site connu) est la référence
// utilisée pour vérifier TOUS les résultats : un site, un numéro ou un e-mail n'est retenu que s'il s'y rattache.
//
// Score de correspondance d'un site (0–100, règles centralisées et réglables) :
//   SIREN / SIRET présent 70 · nom 30 · commune 20 · code postal 15 · rue 15 · numéro déjà connu 25
//   activité (paysage, jardin…) 10 · domaine formé sur le nom 10 · page de mentions légales 5
//   95–100 très forte · 85–94 forte · 70–84 probable · 50–69 incertaine · < 50 faible (jamais utilisé seul)
// Un nom identique seul (30) ne suffit JAMAIS : il faut au moins une concordance de lieu ou d'identifiant.
import type { Prospect } from './types';
import { normName } from './normalize';
import { domainOf } from './webContacts';

export interface CompanyIdentity {
  companyId: string;
  siren: string | null;
  siret: string | null;
  legalName: string;
  commercialName: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  department: string | null;
  naf: string | null;
  activity: string | null;
  website: string | null;
}

export function buildIdentity(p: Prospect): CompanyIdentity {
  return {
    companyId: p.id,
    siren: p.siren,
    siret: p.siret,
    legalName: p.name,
    commercialName: p.tradeName,
    address: p.address,
    postalCode: p.postalCode,
    city: p.city,
    department: p.department,
    naf: p.nafCode,
    activity: p.activity,
    website: p.website,
  };
}

/** Signaux constatés sur un site (voir WebsiteProvider.analyze). */
export interface SiteSignals {
  siren: boolean;
  siret: boolean;
  name: boolean;
  city: boolean;
  postalCode: boolean;
  street: boolean;
  activity: boolean;
  domainMatchesName: boolean;
  knownPhone: boolean;
  legalPage: boolean;
}

export const WEBSITE_POINTS: Record<keyof SiteSignals, [number, string]> = {
  siret: [70, 'SIRET présent sur le site'],
  siren: [70, 'SIREN présent sur le site'],
  name: [30, 'nom de l’entreprise'],
  city: [20, 'commune'],
  postalCode: [15, 'code postal'],
  street: [15, 'rue de l’adresse'],
  knownPhone: [25, 'numéro déjà connu de l’entreprise'],
  activity: [10, 'activité concordante'],
  domainMatchesName: [10, 'domaine formé sur le nom'],
  legalPage: [5, 'mentions légales publiées'],
};

/** Seuils de confiance (réglables). */
export const CONFIDENCE_BANDS = { veryStrong: 95, strong: 85, probable: 70, uncertain: 50 };

export type ConfidenceBand = 'very_strong' | 'strong' | 'probable' | 'uncertain' | 'weak';

export function bandOf(score: number): ConfidenceBand {
  const b = CONFIDENCE_BANDS;
  return score >= b.veryStrong ? 'very_strong' : score >= b.strong ? 'strong' : score >= b.probable ? 'probable' : score >= b.uncertain ? 'uncertain' : 'weak';
}

export const BAND_LABEL: Record<ConfidenceBand, string> = {
  very_strong: 'correspondance très forte',
  strong: 'correspondance forte',
  probable: 'correspondance probable',
  uncertain: 'correspondance incertaine',
  weak: 'correspondance faible',
};

export function websiteMatchScore(s: SiteSignals): { score: number; reasons: string[]; accepted: boolean } {
  let score = 0;
  const reasons: string[] = [];
  for (const k of Object.keys(WEBSITE_POINTS) as (keyof SiteSignals)[]) {
    if (!s[k]) continue;
    if (k === 'siren' && s.siret) continue; // SIRET et SIREN ne se cumulent pas
    const [pts, label] = WEBSITE_POINTS[k];
    score += pts;
    reasons.push(`${label} (+${pts})`);
  }
  // Garde-fou : sans identifiant ni lieu, un nom (même avec activité et domaine) reste « incertain »
  if (!s.siren && !s.siret && !s.city && !s.postalCode && !s.street && !s.knownPhone) score = Math.min(score, CONFIDENCE_BANDS.probable - 1);
  score = Math.min(100, score);
  return { score, reasons, accepted: score >= CONFIDENCE_BANDS.probable };
}

/** Le domaine du site est-il formé sur le nom (ou le nom commercial) de l'entreprise ? */
export function domainMatchesName(url: string, names: (string | null | undefined)[]): boolean {
  const flat = (domainOf(url) ?? '').replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]/g, '');
  if (!flat) return false;
  return names.some((n) => normName(n ?? '').split(' ').some((t) => t.length >= 4 && flat.includes(t)));
}
