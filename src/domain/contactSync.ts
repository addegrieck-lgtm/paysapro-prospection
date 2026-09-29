// Synchronisation fiche ↔ coordonnées multi-sources (company_phones / company_emails / company_websites).
//
// • Les champs `phone`, `email`, `website` de la fiche restent la valeur PRINCIPALE (utilisée par le CRM,
//   les campagnes, les filtres) ; le détail de toutes les valeurs trouvées vit dans les tables de coordonnées.
// • Priorité : Manuel > Source officielle > Site officiel > Source secondaire ; une valeur manuelle n'est
//   jamais remplacée automatiquement.
import type { CompanyEmail, CompanyPhone, CompanyWebsite, ContactEvidence, ContactSourceKind, FieldSource, Prospect } from './types';
import { addEvidence, assignRoles, pickPrimary, rescore } from './contacts';
import { displayPhone, nationalPhone, phoneType, toE164 } from './phone';
import { classifyEmail, domainOf } from './webContacts';
import { normEmail, normUrl } from './normalize';
import { uid } from '../utils/id';

export type ContactKind = 'phone' | 'email' | 'website';

/** Provenance d'un champ de fiche → type de source d'une coordonnée. */
export function evidenceFromFieldSource(src: FieldSource | undefined, at: string): ContactEvidence {
  const map: Record<FieldSource['type'], ContactSourceKind> = { manual: 'manual', official_api: 'official', csv: 'import', import: 'import', web: 'website' };
  if (!src) return { kind: 'import', provider: 'Donnée existante', url: null, at, matched: [] };
  const provider = src.type === 'csv' ? `Import CSV (${src.provider})` : src.type === 'manual' ? 'Saisie manuelle' : src.provider;
  return { kind: map[src.type], provider, url: null, at: src.at, matched: [] };
}

/** Clé normalisée d'une coordonnée (null si inexploitable). */
export function contactKey(kind: ContactKind, raw: string | null | undefined): string | null {
  if (kind === 'phone') return toE164(raw);
  if (kind === 'email') return normEmail(raw);
  return domainOf(normUrl(raw));
}

function base(p: Pick<Prospect, 'id' | 'workspaceId'>, value: string, display: string, e: ContactEvidence, now: string) {
  return {
    id: uid(),
    workspaceId: p.workspaceId,
    prospectId: p.id,
    value,
    display,
    evidence: [e],
    confidence: 0,
    confidenceReasons: [],
    status: 'unverified' as const,
    isPrimary: false,
    manual: e.kind === 'manual',
    shared: false,
    foundAt: now,
    verifiedAt: null,
    updatedAt: now,
    lastSeenAt: now,
    currency: 'current' as const,
  };
}

export function newPhone(p: Pick<Prospect, 'id' | 'workspaceId'>, raw: string, e: ContactEvidence, now: string, fax = false): CompanyPhone | null {
  const e164 = toE164(raw);
  if (!e164) return null;
  return rescore({ ...base(p, e164, displayPhone(e164), e, now), e164, type: fax ? 'fax' : phoneType(e164), role: 'secondary' });
}

export function newEmail(p: Pick<Prospect, 'id' | 'workspaceId'>, raw: string, e: ContactEvidence, now: string): CompanyEmail | null {
  const email = normEmail(raw);
  if (!email) return null;
  return rescore({ ...base(p, email, email, e, now), kind: classifyEmail(email) });
}

export function newWebsite(p: Pick<Prospect, 'id' | 'workspaceId'>, raw: string, e: ContactEvidence, now: string, verified = false): CompanyWebsite | null {
  const url = normUrl(raw);
  const domain = domainOf(url);
  if (!url || !domain) return null;
  return rescore({ ...base(p, domain, url, e, now), verified });
}

/** Ajoute / fusionne une coordonnée dans une liste (même valeur = mêmes preuves cumulées). */
export function upsertContact<T extends CompanyPhone | CompanyEmail | CompanyWebsite>(list: T[], c: T, now: string): { list: T[]; created: boolean } {
  const i = list.findIndex((x) => x.value === c.value);
  if (i === -1) return { list: [...list, c], created: true };
  const prev = list[i]!;
  let evidence = prev.evidence;
  for (const e of c.evidence) evidence = addEvidence(evidence, e);
  const merged = rescore({
    ...prev,
    evidence,
    manual: prev.manual || c.manual,
    ...('verified' in prev ? { verified: (prev as CompanyWebsite).verified || (c as CompanyWebsite).verified } : {}),
    ...('type' in prev && (c as CompanyPhone).type === 'fax' ? { type: 'fax' } : {}),
    // Une coordonnée écartée redevient active seulement si l'utilisateur la saisit lui-même
    status: prev.status === 'rejected' && !c.manual ? 'rejected' : prev.status === 'rejected' ? 'unverified' : prev.status,
    // Revue sur une source (page, annuaire) ou saisie : elle est de nouveau « actuelle »
    ...(c.manual || c.evidence.some((e) => e.url) ? { currency: 'current', lastSeenAt: now } : {}),
    updatedAt: now,
  } as T);
  const copy = list.slice();
  copy[i] = merged;
  return { list: copy, created: false };
}

/** Coordonnées déduites des champs actuels d'une fiche (migration, import, saisie). */
export function contactsFromFields(p: Prospect, now: string): { phones: CompanyPhone[]; emails: CompanyEmail[]; websites: CompanyWebsite[] } {
  const phones: CompanyPhone[] = [];
  const emails: CompanyEmail[] = [];
  const websites: CompanyWebsite[] = [];
  if (p.demo) return { phones, emails, websites };
  if (p.phone) {
    const c = newPhone(p, p.phone, evidenceFromFieldSource(p.fieldSources.phone, now), now);
    if (c) phones.push(c);
  }
  if (p.email) {
    const c = newEmail(p, p.email, evidenceFromFieldSource(p.fieldSources.email, now), now);
    if (c) emails.push(c);
  }
  if (p.website) {
    const c = newWebsite(p, p.website, evidenceFromFieldSource(p.fieldSources.website, now), now, !!p.websiteVerified);
    if (c) websites.push(c);
  }
  return { phones, emails, websites };
}

function fieldSourceOf(c: CompanyPhone | CompanyEmail | CompanyWebsite): FieldSource {
  const best = c.evidence.slice().sort((a, b) => ['manual', 'official', 'website', 'import', 'directory', 'social'].indexOf(a.kind) - ['manual', 'official', 'website', 'import', 'directory', 'social'].indexOf(b.kind))[0]!;
  const type: FieldSource['type'] = best.kind === 'manual' ? 'manual' : best.kind === 'official' ? 'official_api' : best.kind === 'import' ? 'csv' : 'web';
  return { type, provider: best.provider, at: best.at, confidence: c.confidence >= 80 ? 'high' : c.confidence >= 50 ? 'medium' : 'low' };
}

/**
 * Recopie les valeurs principales sur la fiche. Une valeur manuelle déjà présente sur la fiche n'est jamais
 * remplacée ; une valeur non vérifiée (< 50) n'est pas promue en principale si la fiche n'en a pas.
 */
export function applyPrimaryContacts(
  p: Prospect,
  phones: CompanyPhone[],
  emails: CompanyEmail[],
  websites: CompanyWebsite[],
): { prospect: Prospect; phones: CompanyPhone[]; emails: CompanyEmail[]; websites: CompanyWebsite[]; changed: string[] } {
  const next: Prospect = { ...p, fieldSources: { ...p.fieldSources } };
  const changed: string[] = [];
  // Une valeur saisie manuellement sur la fiche est toujours la principale
  const preferred = (field: ContactKind) => (next.fieldSources[field]?.type === 'manual' ? contactKey(field, next[field]) : null);
  const rolled = assignRoles(phones, preferred('phone'));
  const primaryPhone = rolled.find((x) => x.isPrimary) ?? null;
  const markPrimary = <T extends CompanyEmail | CompanyWebsite>(list: T[], pref: string | null) => {
    const primary = (pref ? list.find((x) => x.value === pref && x.status !== 'rejected') : undefined) ?? pickPrimary(list);
    return { list: list.map((x) => ({ ...x, isPrimary: x.id === primary?.id })), primary };
  };
  const em = markPrimary(emails, preferred('email'));
  const ws = markPrimary(websites, preferred('website'));

  const promote = (field: 'phone' | 'email' | 'website', c: CompanyPhone | CompanyEmail | CompanyWebsite | null, value: string | null) => {
    const manualOnFiche = next.fieldSources[field]?.type === 'manual' && !!next[field];
    if (manualOnFiche) return; // la saisie manuelle fait foi
    if (!c || c.status === 'rejected' || (c.confidence < 50 && !next[field])) {
      if (next[field] && !c) {
        // la valeur de la fiche a été écartée
        next[field] = null;
        delete next.fieldSources[field];
        changed.push(field);
      }
      return;
    }
    if (next[field] !== value) {
      next[field] = value;
      next.fieldSources[field] = fieldSourceOf(c);
      changed.push(field);
    } else if (!next.fieldSources[field]) next.fieldSources[field] = fieldSourceOf(c);
  };
  promote('phone', primaryPhone, primaryPhone ? nationalPhone(primaryPhone.e164) : null);
  promote('email', em.primary, em.primary?.value ?? null);
  promote('website', ws.primary, ws.primary?.display ?? null);

  const ph = primaryPhone && contactKey('phone', next.phone) === primaryPhone.value ? primaryPhone : rolled.find((x) => contactKey('phone', next.phone) === x.value) ?? null;
  next.phoneConfidence = ph ? ph.confidence : null;
  next.phoneStatus = ph ? ph.status : null;
  const site = ws.list.find((x) => x.value === contactKey('website', next.website));
  next.websiteVerified = site ? site.verified : next.website ? false : null;
  return { prospect: next, phones: rolled, emails: em.list, websites: ws.list, changed };
}
