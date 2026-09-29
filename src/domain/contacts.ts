// PhoneVerificationEngine (et équivalents e-mail / site) : score de confiance TRANSPARENT de 0 à 100.
//
// Principe : quantité + exactitude + provenance. Un numéro n'est jamais « vérifié » simplement parce qu'il
// apparaît sur une page ; il faut que la source soit liée à l'entreprise par des éléments concordants.
//
//   Base selon la source        Site officiel 55 · Import CSV 50 · Annuaire public (OSM) 45 · Réseau social 35
//   Éléments concordants        SIRET/SIREN +25 · site officiel vérifié +15 · adresse +10 · nom +10 · ville +10
//                               code postal +5 · lien « tel: » +5
//   Sources indépendantes       +10 par source supplémentaire (max +20)
//   Numéro partagé              −30 (même numéro chez une autre entreprise)
//   Saisie / validation manuelle = 100
//
//   ≥ 80 🟢 Vérifié (fortement associé) · 50–79 🟠 À vérifier · < 50 ⚪ Non vérifié
import type { CompanyEmail, CompanyPhone, CompanyWebsite, ContactEvidence, ContactSourceKind, ContactStatus } from './types';

export const SOURCE_BASE: Record<ContactSourceKind, number> = {
  manual: 100,
  official: 70,
  website: 55,
  import: 50,
  directory: 45,
  social: 35,
};

export const SOURCE_KIND_LABEL: Record<ContactSourceKind, string> = {
  manual: 'Saisie manuelle',
  official: 'Données publiques officielles',
  website: 'Site officiel',
  import: 'Import utilisateur',
  directory: 'Annuaire public',
  social: 'Réseau social',
};

export const MATCH_POINTS: Record<string, [number, string]> = {
  siret: [25, 'même SIRET'],
  siren: [25, 'même SIREN'],
  website_verified: [15, 'présent sur le site officiel vérifié'],
  address: [10, 'même adresse'],
  name: [10, 'même nom'],
  city: [10, 'même ville'],
  postalCode: [5, 'même code postal'],
  tel_link: [5, 'lien d’appel sur le site'],
};

export const THRESHOLDS = { verified: 80, toVerify: 50 };

export function statusOf(confidence: number): Exclude<ContactStatus, 'rejected'> {
  return confidence >= THRESHOLDS.verified ? 'verified' : confidence >= THRESHOLDS.toVerify ? 'to_verify' : 'unverified';
}

export const STATUS_LABEL: Record<ContactStatus, string> = {
  verified: 'Vérifié',
  to_verify: 'À vérifier',
  unverified: 'Non vérifié',
  rejected: 'Écarté',
};

export const STATUS_DOT: Record<ContactStatus, string> = { verified: '🟢', to_verify: '🟠', unverified: '⚪', rejected: '✕' };

/** Évalue une preuve isolée : base de la source + éléments concordants (sans doublon SIRET/SIREN). */
function evidenceScore(e: ContactEvidence): { score: number; reasons: string[] } {
  const base = SOURCE_BASE[e.kind];
  const reasons = [`${e.provider} (${base})`];
  let score = base;
  const matched = new Set(e.matched);
  if (matched.has('siret')) matched.delete('siren');
  for (const m of matched) {
    const p = MATCH_POINTS[m];
    if (!p) continue;
    score += p[0];
    reasons.push(`${p[1]} (+${p[0]})`);
  }
  return { score, reasons };
}

export interface ConfidenceResult {
  confidence: number;
  status: Exclude<ContactStatus, 'rejected'>;
  reasons: string[];
  sources: number;
}

/** Confiance d'une coordonnée à partir de toutes ses preuves. */
export function computeConfidence(evidence: ContactEvidence[], opts: { manual?: boolean; shared?: boolean } = {}): ConfidenceResult {
  const providers = new Set(evidence.map((e) => `${e.kind}|${e.provider}`));
  if (opts.manual || evidence.some((e) => e.kind === 'manual')) {
    return { confidence: 100, status: 'verified', reasons: ['Saisi ou validé manuellement (100)'], sources: providers.size };
  }
  if (!evidence.length) return { confidence: 0, status: 'unverified', reasons: ['Aucune source'], sources: 0 };
  const best = evidence.map(evidenceScore).sort((a, b) => b.score - a.score)[0]!;
  let confidence = best.score;
  const reasons = [...best.reasons];
  const extra = Math.min(2, providers.size - 1);
  if (extra > 0) {
    confidence += extra * 10;
    reasons.push(`${providers.size} sources concordantes (+${extra * 10})`);
  }
  if (opts.shared) {
    confidence -= 30;
    reasons.push('numéro partagé avec une autre entreprise (−30)');
  }
  confidence = Math.max(0, Math.min(99, confidence));
  return { confidence, status: statusOf(confidence), reasons, sources: providers.size };
}

/** Ajoute une preuve (même source + même URL = mise à jour, pas de doublon). */
export function addEvidence(list: ContactEvidence[], e: ContactEvidence): ContactEvidence[] {
  const i = list.findIndex((x) => x.kind === e.kind && x.provider === e.provider && x.url === e.url);
  if (i === -1) return [...list, e];
  const copy = list.slice();
  copy[i] = { ...e, matched: Array.from(new Set([...list[i]!.matched, ...e.matched])) };
  return copy;
}

type AnyContact = CompanyPhone | CompanyEmail | CompanyWebsite;

/** Recalcule confiance et statut (sauf coordonnée écartée par l'utilisateur). */
export function rescore<T extends AnyContact>(c: T): T {
  if (c.status === 'rejected') return c;
  const r = computeConfidence(c.evidence, { manual: c.manual, shared: c.shared });
  return { ...c, confidence: r.confidence, status: r.status, confidenceReasons: r.reasons, verifiedAt: r.status === 'verified' ? (c.verifiedAt ?? c.updatedAt) : null };
}

/**
 * Choix du numéro principal : saisie manuelle d'abord, puis confiance, puis fixe avant mobile, jamais un fax ni
 * un numéro écarté. Priorité des sources : Manuel > Officiel > Site officiel > Source secondaire.
 */
export function pickPrimary<T extends AnyContact>(list: T[], isFax: (c: T) => boolean = () => false): T | null {
  const usable = list.filter((c) => c.status !== 'rejected' && !isFax(c));
  const kindRank = (c: T) => Math.min(...c.evidence.map((e) => ['manual', 'official', 'website', 'import', 'directory', 'social'].indexOf(e.kind)));
  return (
    usable.sort(
      (a, b) =>
        Number(b.manual) - Number(a.manual) ||
        Number(b.isPrimary && b.manual) - Number(a.isPrimary && a.manual) ||
        b.confidence - a.confidence ||
        kindRank(a) - kindRank(b) ||
        a.foundAt.localeCompare(b.foundAt),
    )[0] ?? null
  );
}

/** Rôles affichés dans le CRM : 📞 Principal · 📱 Mobile · ☎ Secondaire · 📠 Fax */
export function assignRoles(phones: CompanyPhone[], preferred: string | null = null): CompanyPhone[] {
  const forced = preferred ? phones.find((p) => p.value === preferred && p.status !== 'rejected') : undefined;
  const primary = forced ?? pickPrimary(phones, (p) => p.type === 'fax');
  return phones.map((p) => ({
    ...p,
    isPrimary: p.id === primary?.id,
    role: p.id === primary?.id ? 'primary' : p.type === 'fax' ? 'fax' : p.type === 'mobile' ? 'mobile' : 'secondary',
  }));
}

export const ROLE_LABEL: Record<CompanyPhone['role'], string> = { primary: '📞 Principal', mobile: '📱 Mobile', secondary: '☎ Secondaire', fax: '📠 Fax' };
