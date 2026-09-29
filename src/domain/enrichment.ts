// Application d'un résultat d'enrichissement à une fiche (fonction pure, testée).
//
// Principe : « donnée trouvée → enregistrée avec sa source ; donnée absente → Non disponible ».
//  • correspondance par SIRET / SIREN (confiance haute) : l'identité officielle est rafraîchie, le reste complété ;
//  • correspondance par nom (confiance moyenne / faible) : seuls les champs VIDES sont complétés ;
//  • une donnée saisie manuellement n'est jamais remplacée.
import type { EnrichmentLog, EnrichmentStatus, Prospect } from './types';
import type { EnrichOutcome } from '../providers/company/CompanyDataProvider';
import { adminComplete, COMMERCIAL_FIELDS, FIELD_LABELS, mergeProspect, RECHERCHE_ENTREPRISES } from './prospect';

export const ENRICHMENT_LABEL: Record<EnrichmentStatus, string> = {
  none: 'Non enrichi',
  pending: 'En attente',
  processing: 'En cours',
  enriched: 'Enrichi',
  partial: 'Partiellement enrichi',
  failed: 'Échec',
};

export const ENRICHMENT_BADGE: Record<EnrichmentStatus, { emoji: string; tone: 'success' | 'warning' | 'neutral' | 'danger' | 'info' }> = {
  enriched: { emoji: '🟢', tone: 'success' },
  partial: { emoji: '🟡', tone: 'warning' },
  none: { emoji: '⚪', tone: 'neutral' },
  failed: { emoji: '🔴', tone: 'danger' },
  pending: { emoji: '⏳', tone: 'info' },
  processing: { emoji: '⏳', tone: 'info' },
};

/** Champs résumés dans l'historique (« ✓ SIREN confirmé », « ✓ Adresse mise à jour »…) */
const SUMMARY_FIELDS = ['siren', 'siret', 'name', 'nafCode', 'address', 'postalCode', 'city', 'active', 'isHeadOffice', 'creationDate', 'headcountBand', 'legalForm', 'companyCategory'];

/** Libellés féminins (accord : « Adresse récupérée », « Ville conservée »). */
const FEMININE = new Set(['name', 'address', 'city', 'creationDate', 'headcountBand', 'legalForm', 'companyCategory', 'activity', 'region']);

export interface EnrichmentApplication {
  prospect: Prospect;
  outcome: EnrichmentLog['status'];
  fieldsUpdated: string[];
  fieldsConfirmed: string[];
  fieldsKept: string[];
  /** Lignes de l'historique */
  details: string[];
}

function fieldLabel(k: string) {
  return FIELD_LABELS[k as keyof Prospect] ?? k;
}

export function applyEnrichment(p: Prospect, outcome: EnrichOutcome, now: string): EnrichmentApplication {
  if (outcome.status !== 'found') {
    const reason = outcome.status === 'ambiguous' ? 'Plusieurs entreprises correspondent : précisez le SIREN ou choisissez la bonne entreprise.' : outcome.reason;
    return {
      prospect: { ...p, enrichmentStatus: 'failed', enrichmentError: reason, enrichedAt: now },
      outcome: outcome.status,
      fieldsUpdated: [],
      fieldsConfirmed: [],
      fieldsKept: [],
      details: [outcome.status === 'ambiguous' ? '⚠ Plusieurs entreprises possibles' : `⚠ ${reason}`],
    };
  }
  const origin = { type: 'official_api' as const, provider: RECHERCHE_ENTREPRISES, at: now, confidence: outcome.confidence };
  // Correspondance par nom : on ne remplace rien, on complète seulement.
  const mode = outcome.matchedBy === 'name' ? 'fill' : 'identity';
  const { prospect, changed, confirmed, kept } = mergeProspect(p, outcome.input, mode, now, origin);
  const status: EnrichmentStatus = adminComplete(prospect) && outcome.confidence !== 'low' ? 'enriched' : 'partial';
  const details: string[] = [];
  if (outcome.matchedBy === 'name') details.push(`✓ Entreprise identifiée par son nom (SIREN ${outcome.company.siren}) — à vérifier`);
  for (const k of SUMMARY_FIELDS) {
    const label = k === 'active' ? 'Statut' : fieldLabel(k);
    const e = FEMININE.has(k) ? 'e' : '';
    if (changed.includes(k)) details.push(`✓ ${label} ${p[k as keyof Prospect] == null || p[k as keyof Prospect] === '' ? `récupéré${e}` : `mis${e ? 'e' : ''} à jour`}`);
    else if (confirmed.includes(k)) details.push(k === 'active' ? `✓ Statut confirmé : ${prospect.active ? 'actif' : 'fermé'}` : `✓ ${label} confirmé${e}`);
  }
  for (const k of kept) details.push(`• ${fieldLabel(k)} conservé${FEMININE.has(k) ? 'e' : ''} (saisie manuelle)`);
  if (prospect.active === false) details.push('⚠ Établissement fermé selon les données officielles');
  return {
    prospect: {
      ...prospect,
      enrichmentStatus: status,
      enrichedAt: now,
      enrichmentError: null,
      lastVerifiedAt: now,
      sourceUrl: prospect.sourceUrl ?? outcome.input.sourceUrl ?? null,
    },
    outcome: changed.length ? (status === 'enriched' ? 'enriched' : 'partial') : 'no_change',
    fieldsUpdated: changed,
    fieldsConfirmed: confirmed,
    fieldsKept: kept,
    details,
  };
}

/** Ce que l'application connaît / ce qui manque (fiche prospect). */
export function knowledgeChecklist(p: Prospect): { known: string[]; missing: string[] } {
  const admin = ['siren', 'siret', 'address', 'nafCode', 'active', 'creationDate', 'headcountBand'] as const;
  const commercial = ['phone', 'website', 'email', 'googleUrl', 'facebook', 'instagram', 'linkedin'] as const;
  const known: string[] = [];
  const missing: string[] = [];
  for (const k of [...admin, ...commercial]) {
    const v = k === 'headcountBand' ? (p.headcountBand ?? p.headcount) : p[k];
    (v === null || v === undefined || v === '' ? missing : known).push(fieldLabel(k === 'headcountBand' ? 'headcount' : k));
  }
  return { known, missing };
}

export { COMMERCIAL_FIELDS };
