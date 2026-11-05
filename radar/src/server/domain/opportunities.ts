/**
 * Moteurs de détection (indépendants, règles explicables) :
 *  A. a_vendre      — annonce publique de cession (fonds, société, actifs, clientèle) encore active.
 *  B. procedure     — procédure collective non clôturée (BODACC).
 *  C. transmission  — signaux publics vérifiables (annonce de recherche de successeur, de départ, cession partielle…).
 *  D. cachee        — piste de prospection : entreprise non officiellement à vendre dont les caractéristiques
 *                     publiques justifient une étude. JAMAIS présentée comme disponible à la vente.
 *
 * Interdits : aucune déduction de l'âge, de la santé, de la situation familiale ou des intentions d'un dirigeant.
 * L'indice de transmission ne mesure que des signaux publics documentés (avec preuve et source).
 */
import type { ProcStatus, ProcType } from './proceedings';
import { ageYears, headcountMid } from './scoring';
import { SECTOR_BY_ID } from './sectors';

export type OpportunityType = 'a_vendre' | 'procedure' | 'transmission' | 'cachee';

export const OPPORTUNITY_LABELS: Record<OpportunityType, string> = {
  a_vendre: 'Officiellement à vendre',
  procedure: 'Procédure collective',
  transmission: 'Signal de transmission',
  cachee: 'Piste de prospection',
};

export interface SignalInput {
  type: string;
  strength: number; // 1..3
  evidence: string;
  url?: string | null;
  source: string;
}

export interface OpportunityInput {
  sectorId: string | null;
  creationDate: string | null;
  headcountBand: string | null;
  adminStatus: string | null;
  establishments: number | null;
  openEstablishments: number | null;
  hasWebsite: boolean | null;
  activeListings: { kind: string; title: string; source: string }[];
  proceedings: { type: ProcType; status: ProcStatus }[];
  signals: SignalInput[];
  lastNetIncome: number | null;
  now?: Date;
}

export interface Reason {
  engine: OpportunityType;
  rule: string;
  detail: string;
}

export interface OpportunityResult {
  types: OpportunityType[];
  primary: OpportunityType | null;
  reasons: Reason[];
  transmissionIndex: number | null;
}

/** Signaux textuels publics : expressions explicites uniquement (pas d'interprétation des intentions). */
export const TEXT_SIGNALS: { type: string; label: string; strength: number; pattern: RegExp }[] = [
  { type: 'recherche_repreneur', label: 'Recherche publique de repreneur / successeur', strength: 3, pattern: /\b(?:recherch\w+|cherch\w+)\s+(?:un\s+|d['’]un\s+)?(?:repreneur|successeur)s?\b/i },
  { type: 'affaire_a_ceder', label: 'Affaire annoncée à céder / à reprendre', strength: 3, pattern: /\b(?:(?:affaire|entreprise|soci[ée]t[ée]|fonds(?: de commerce)?|cabinet|activit[ée]|commerce)\s+[àa]\s+(?:c[ée]der|reprendre|vendre))\b|\bcession\s+(?:de\s+(?:l['’]|notre\s+)?(?:entreprise|soci[ée]t[ée]|fonds|activit[ée]))\b/i },
  { type: 'depart_retraite_annonce', label: 'Départ à la retraite annoncé publiquement', strength: 3, pattern: /\b(?:d[ée]part|partir|prends?|prendre)\s+(?:[àa]\s+)?(?:(?:ma|sa|notre|la|une)\s+)?retraite\b/i },
  { type: 'transmission_annoncee', label: 'Transmission annoncée', strength: 2, pattern: /\btransmission\s+(?:de\s+(?:l['’]|notre\s+|mon\s+)?(?:entreprise|activit[ée]|soci[ée]t[ée]|affaire))\b/i },
  { type: 'fermeture_annoncee', label: 'Fermeture définitive annoncée', strength: 2, pattern: /\bfermeture\s+d[ée]finitive\b|\bcessation\s+d['’]activit[ée]\b/i },
];

export function detectTextSignals(text: string): { type: string; label: string; strength: number; excerpt: string }[] {
  const out: { type: string; label: string; strength: number; excerpt: string }[] = [];
  const clean = text.replace(/\s+/g, ' ');
  for (const s of TEXT_SIGNALS) {
    const m = s.pattern.exec(clean);
    if (m) {
      const start = Math.max(0, m.index - 90);
      const end = Math.min(clean.length, m.index + m[0].length + 90);
      out.push({ type: s.type, label: s.label, strength: s.strength, excerpt: `${start > 0 ? '…' : ''}${clean.slice(start, end).trim()}${end < clean.length ? '…' : ''}` });
    }
  }
  return out;
}

/** Indice de transmission potentielle 0..100 : somme plafonnée des forces des signaux distincts. */
export function transmissionIndex(signals: SignalInput[]): number | null {
  if (!signals.length) return null;
  const byType = new Map<string, number>();
  for (const s of signals) byType.set(s.type, Math.max(byType.get(s.type) ?? 0, s.strength));
  const pts = [...byType.values()].reduce((a, st) => a + (st >= 3 ? 60 : st === 2 ? 30 : 12), 0);
  return Math.min(100, pts);
}

export function detectOpportunities(i: OpportunityInput): OpportunityResult {
  const now = i.now ?? new Date();
  const reasons: Reason[] = [];
  const types = new Set<OpportunityType>();
  const ceased = i.adminStatus === 'C';

  // A. Radar des entreprises à vendre
  for (const l of i.activeListings) {
    types.add('a_vendre');
    reasons.push({ engine: 'a_vendre', rule: 'Annonce de cession active', detail: `${l.title} (${l.source})` });
  }

  // B. Radar des procédures collectives
  for (const p of i.proceedings.filter((p) => p.status !== 'cloturee')) {
    types.add('procedure');
    reasons.push({ engine: 'procedure', rule: `Procédure ${p.type} non clôturée`, detail: `Statut : ${p.status}` });
  }

  // C. Radar de transmission (signaux publics uniquement)
  const tIndex = transmissionIndex(i.signals);
  for (const s of i.signals) {
    types.add('transmission');
    reasons.push({ engine: 'transmission', rule: `Signal public : ${s.type}`, detail: `${s.evidence.slice(0, 200)} (${s.source})` });
  }
  if (i.establishments !== null && i.openEstablishments !== null && i.establishments >= 2 && i.openEstablishments < i.establishments && !ceased) {
    // Fermetures d'établissements : fait public (SIRENE), signal faible, ne déclenche pas seul le radar
    reasons.push({ engine: 'transmission', rule: "Établissements fermés (SIRENE)", detail: `${i.establishments - i.openEstablishments} établissement(s) fermé(s) sur ${i.establishments}` });
  }

  // D. Radar des opportunités cachées (pistes de prospection)
  if (!ceased && !types.has('a_vendre') && !types.has('procedure')) {
    const age = ageYears(i.creationDate, now);
    const hc = headcountMid(i.headcountBand);
    const criteria: string[] = [];
    if (age !== null && age >= 15) criteria.push(`activité établie depuis ${Math.floor(age)} ans`);
    if (hc !== null && hc >= 1 && hc <= 49) criteria.push('entreprise employeuse de taille reprenable (1 à 49 salariés)');
    if ((i.openEstablishments ?? 0) >= 2) criteria.push(`${i.openEstablishments} établissements ouverts`);
    if (i.sectorId && SECTOR_BY_ID.get(i.sectorId)?.priority) criteria.push(`secteur prioritaire (${SECTOR_BY_ID.get(i.sectorId)!.label})`);
    if (i.lastNetIncome !== null && i.lastNetIncome > 0) criteria.push('dernier résultat publié bénéficiaire');
    if (i.hasWebsite === false) criteria.push('aucun site internet constaté (présence commerciale à développer)');
    // Règle : ancienneté ≥ 15 ans ET taille reprenable ET au moins un autre critère.
    if (age !== null && age >= 15 && hc !== null && hc >= 1 && hc <= 49 && criteria.length >= 3) {
      types.add('cachee');
      reasons.push({ engine: 'cachee', rule: 'Piste de prospection (non officiellement à vendre)', detail: criteria.join(' ; ') });
    }
  }

  const order: OpportunityType[] = ['a_vendre', 'procedure', 'transmission', 'cachee'];
  const list = order.filter((t) => types.has(t));
  return { types: list, primary: list[0] ?? null, reasons, transmissionIndex: tIndex };
}
