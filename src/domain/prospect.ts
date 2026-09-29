// Fabrique, fusion et projection des fiches prospect — avec provenance champ par champ.
//
// Règles de fusion (les plus importantes du module) :
//  • une valeur vide ne remplace JAMAIS une donnée existante ;
//  • une donnée saisie manuellement n'est JAMAIS remplacée automatiquement (API, CSV, import) ;
//  • la source officielle (API Recherche d'entreprises / SIRENE) rafraîchit l'identité administrative
//    qu'elle a elle-même fournie, et complète le reste uniquement s'il est vide ;
//  • chaque champ écrit mémorise sa source, sa date et un niveau de confiance.
import type { FieldSource, Milestone, Prospect, ProspectRow, ProspectStatus, SourceKind } from './types';
import { computeScore } from './scoring';
import { headcountMin, STATUS_MILESTONES } from './referentials';
import { departmentFromPostalCode, regionOfDepartment } from './geo';
import { normText } from './normalize';
import { uid } from '../utils/id';

/** Champs qu'une source (import, saisie, API) peut fournir. */
export type ProspectInput = Partial<
  Omit<Prospect, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'score' | 'milestones' | 'dateCollected' | 'fieldSources'>
> & { name?: string };

/** Identité administrative (la source officielle fait foi pour ces champs). */
export const IDENTITY_FIELDS = [
  'name',
  'tradeName',
  'siren',
  'siret',
  'nafCode',
  'activity',
  'legalForm',
  'individual',
  'active',
  'creationDate',
  'headcountBand',
  'address',
  'postalCode',
  'city',
  'department',
  'region',
  'isHeadOffice',
  'companyCategory',
  'openEstablishments',
  'employer',
] as const satisfies readonly (keyof Prospect)[];

/** Informations commerciales : jamais présentes dans les sources officielles. */
export const COMMERCIAL_FIELDS = [
  'website',
  'email',
  'phone',
  'googleUrl',
  'googleReviews',
  'googleRating',
  'facebook',
  'instagram',
  'linkedin',
  'description',
  'services',
  'interventionArea',
] as const satisfies readonly (keyof Prospect)[];

/** Champs dont on suit la provenance. */
export const SOURCED_FIELDS: readonly (keyof Prospect)[] = [
  ...IDENTITY_FIELDS,
  ...COMMERCIAL_FIELDS,
  'headcount',
  'contactFirstName',
  'contactLastName',
  'googleCategory',
  'tiktok',
];

/** Champs administratifs indispensables : tous présents → « Enrichi », sinon « Partiellement enrichi ». */
export const CORE_ADMIN_FIELDS = ['siren', 'siret', 'name', 'nafCode', 'address', 'postalCode', 'city', 'active', 'creationDate'] as const satisfies readonly (keyof Prospect)[];

/** Données personnelles (à distinguer des données d'entreprise — RGPD). */
export const PERSONAL_FIELDS = ['contactFirstName', 'contactLastName', 'email', 'phone', 'facebook', 'instagram', 'linkedin', 'tiktok'] as const satisfies readonly (keyof Prospect)[];

export const FIELD_LABELS: Partial<Record<keyof Prospect, string>> = {
  name: 'Raison sociale',
  tradeName: 'Nom commercial',
  siren: 'SIREN',
  siret: 'SIRET',
  nafCode: 'Code NAF',
  activity: 'Activité',
  legalForm: 'Forme juridique',
  individual: 'Entrepreneur individuel',
  active: 'Statut (actif)',
  creationDate: 'Date de création',
  headcountBand: 'Tranche d’effectif',
  headcount: 'Effectif',
  address: 'Adresse',
  postalCode: 'Code postal',
  city: 'Ville',
  department: 'Département',
  region: 'Région',
  isHeadOffice: 'Siège',
  companyCategory: 'Catégorie d’entreprise',
  openEstablishments: 'Établissements ouverts',
  employer: 'Employeur',
  website: 'Site web',
  email: 'E-mail',
  phone: 'Téléphone',
  googleUrl: 'Fiche Google',
  googleReviews: 'Nombre d’avis',
  googleRating: 'Note Google',
  googleCategory: 'Catégorie Google',
  facebook: 'Facebook',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  description: 'Description',
  services: 'Services',
  interventionArea: 'Zone d’intervention',
  contactFirstName: 'Prénom du contact',
  contactLastName: 'Nom du contact',
};

export interface Context {
  workspaceId: string;
  user: string;
  now?: string;
}

export const RECHERCHE_ENTREPRISES = 'recherche-entreprises';

/** Provenance correspondant à un type d'import. */
export function originFor(kind: SourceKind, at: string, provider?: string): FieldSource {
  switch (kind) {
    case 'sirene':
    case 'search':
      return { type: 'official_api', provider: provider ?? RECHERCHE_ENTREPRISES, at, confidence: 'high' };
    case 'csv':
    case 'enrichment':
      return { type: 'csv', provider: provider ?? 'Fichier CSV', at, confidence: 'medium' };
    case 'manual':
      return { type: 'manual', provider: provider ?? 'Saisie manuelle', at, confidence: 'high' };
    case 'demo':
      return { type: 'import', provider: 'Démonstration (fictif)', at, confidence: 'low' };
  }
}

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

export function emptyProspect(ctx: Context, source: SourceKind): Prospect {
  const now = ctx.now ?? new Date().toISOString();
  return {
    id: uid(),
    workspaceId: ctx.workspaceId,
    createdAt: now,
    updatedAt: now,
    createdBy: ctx.user,
    name: '',
    tradeName: null,
    siren: null,
    siret: null,
    nafCode: null,
    activity: null,
    legalForm: null,
    individual: null,
    active: null,
    creationDate: null,
    headcountBand: null,
    headcount: null,
    address: null,
    postalCode: null,
    city: null,
    department: null,
    region: null,
    contactFirstName: null,
    contactLastName: null,
    phone: null,
    email: null,
    website: null,
    googleUrl: null,
    googleRating: null,
    googleReviews: null,
    googleCategory: null,
    googleCheckedAt: null,
    facebook: null,
    instagram: null,
    linkedin: null,
    tiktok: null,
    services: [],
    interventionArea: null,
    status: 'new',
    owner: null,
    lastContactAt: null,
    nextFollowUpAt: null,
    milestones: {},
    doNotContact: false,
    doNotContactReason: null,
    score: 0,
    source,
    sourceUrl: null,
    dateCollected: now,
    lastVerifiedAt: null,
    demo: false,
    isHeadOffice: null,
    companyCategory: null,
    openEstablishments: null,
    employer: null,
    description: null,
    enrichmentStatus: 'none',
    enrichedAt: null,
    enrichmentError: null,
    fieldSources: {},
    anonymized: false,
  };
}

/** Complète les champs dérivés (département, région, score) sans rien inventer. */
export function finalize(p: Prospect): Prospect {
  const department = p.department ?? departmentFromPostalCode(p.postalCode);
  const region = p.region ?? regionOfDepartment(department);
  const next = { ...p, department, region };
  const sources = { ...next.fieldSources };
  // Département / région déduits : même provenance que le code postal
  if (department && !p.department && sources.postalCode) sources.department = sources.postalCode;
  if (region && !p.region && (sources.department ?? sources.postalCode)) sources.region = sources.department ?? sources.postalCode;
  next.fieldSources = sources;
  if (next.doNotContact) next.status = 'do_not_contact';
  next.score = computeScore(next).score;
  return next;
}

/** Tous les champs administratifs indispensables sont-ils connus ? */
export function adminComplete(p: Pick<Prospect, (typeof CORE_ADMIN_FIELDS)[number]>): boolean {
  return CORE_ADMIN_FIELDS.every((k) => !isEmpty(p[k]));
}

export function createProspect(input: ProspectInput, ctx: Context, source: SourceKind, origin?: FieldSource): Prospect {
  const base = emptyProspect(ctx, source);
  const defined = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const o = origin ?? originFor(source, base.createdAt);
  const fieldSources: Prospect['fieldSources'] = {};
  for (const k of SOURCED_FIELDS) if (!isEmpty(defined[k])) fieldSources[k] = o;
  const p = { ...base, ...defined, name: input.name?.trim() || base.name, fieldSources };
  // Une fiche issue de la source officielle est déjà « enrichie » administrativement.
  if (o.type === 'official_api' && !input.enrichmentStatus) {
    p.enrichmentStatus = adminComplete(p) ? 'enriched' : 'partial';
    p.enrichedAt = base.createdAt;
  }
  return finalize(p);
}

export type MergeMode =
  /** Complète uniquement les champs vides (doublon probable, import CSV) */
  | 'fill'
  /** Une valeur fournie remplace l'ancienne (fichier d'enrichissement) — sauf donnée manuelle */
  | 'overwrite'
  /** Source officielle : rafraîchit l'identité qu'elle a fournie, complète le reste */
  | 'identity';

export interface MergeResult {
  prospect: Prospect;
  /** Champs écrits (nouveaux ou mis à jour) */
  changed: string[];
  /** Champs dont la valeur fournie est identique à l'existante */
  confirmed: string[];
  /** Champs protégés (saisie manuelle) dont la valeur fournie diffère */
  kept: string[];
}

/** Fusion sûre avec provenance. */
export function mergeProspect(existing: Prospect, input: ProspectInput, mode: MergeMode, now: string, origin?: FieldSource): MergeResult {
  const o = origin ?? (mode === 'identity' ? originFor('sirene', now) : originFor('csv', now));
  const next: Prospect = { ...existing, fieldSources: { ...existing.fieldSources } };
  const bag = next as unknown as Record<string, unknown>;
  const changed: string[] = [];
  const confirmed: string[] = [];
  const kept: string[] = [];
  const identity = new Set<string>(IDENTITY_FIELDS);
  for (const [key, value] of Object.entries(input) as [keyof Prospect, unknown][]) {
    if (value === undefined || isEmpty(value) || key === 'fieldSources') continue;
    const current = next[key];
    const currentSource = next.fieldSources[key];
    if (key === 'services') {
      const merged = Array.from(new Set([...(existing.services ?? []), ...(value as string[])]));
      if (merged.length !== existing.services.length) {
        bag.services = merged;
        next.fieldSources.services = o;
        changed.push(key);
      } else confirmed.push(key);
      continue;
    }
    if (current === value) {
      confirmed.push(key);
      // Même source officielle : la date de vérification est rafraîchie
      if (o.type === 'official_api' && (!currentSource || currentSource.type === 'official_api')) next.fieldSources[key] = o;
      continue;
    }
    const protectedManual = currentSource?.type === 'manual' && o.type !== 'manual' && !isEmpty(current);
    let write: boolean;
    if (isEmpty(current)) write = true;
    else if (protectedManual) write = false;
    else if (mode === 'overwrite') write = true;
    else if (mode === 'identity') write = identity.has(key) && (!currentSource || currentSource.type === 'official_api' || currentSource.type === 'import');
    else write = false;
    if (write) {
      bag[key] = value;
      next.fieldSources[key] = o;
      changed.push(key);
    } else if (protectedManual) kept.push(key);
  }
  if (changed.length) next.updatedAt = now;
  return { prospect: finalize(next), changed, confirmed, kept };
}

/**
 * Saisie manuelle (formulaire) : chaque champ modifié devient « Manuel ».
 * Un champ vidé perd sa provenance.
 */
export function applyManualEdit(existing: Prospect, patch: ProspectInput, now: string, user: string): { prospect: Prospect; changed: string[] } {
  const next: Prospect = { ...existing, ...patch, fieldSources: { ...existing.fieldSources }, updatedAt: now };
  const changed: string[] = [];
  const o = originFor('manual', now, user);
  for (const [key, value] of Object.entries(patch) as [keyof Prospect, unknown][]) {
    const before = existing[key];
    const same = JSON.stringify(before ?? null) === JSON.stringify(value ?? null);
    if (same) continue;
    changed.push(key);
    if (!SOURCED_FIELDS.includes(key)) continue;
    if (isEmpty(value)) delete next.fieldSources[key];
    else next.fieldSources[key] = o;
  }
  return { prospect: finalize(next), changed };
}

/** Change le statut et date les étapes du tunnel atteintes pour la première fois. */
export function applyStatus(p: Prospect, status: ProspectStatus, now: string): Prospect {
  const milestones: Partial<Record<Milestone, string>> = { ...p.milestones };
  for (const m of STATUS_MILESTONES[status] ?? []) milestones[m] ??= now;
  return finalize({
    ...p,
    status,
    milestones,
    doNotContact: status === 'do_not_contact' ? true : p.doNotContact,
    updatedAt: now,
  });
}

/**
 * Fusion de deux fiches en doublon : la fiche conservée garde ses valeurs, complétées par l'autre ;
 * les étapes du tunnel gardent la date la plus ancienne ; une exclusion « Ne plus contacter » est conservée.
 */
export function combineProspects(keep: Prospect, other: Prospect, now: string): Prospect {
  const next: Prospect = { ...keep, fieldSources: { ...keep.fieldSources }, services: Array.from(new Set([...keep.services, ...other.services])) };
  const bag = next as unknown as Record<string, unknown>;
  for (const key of SOURCED_FIELDS) {
    if (key === 'services') continue;
    if (isEmpty(next[key]) && !isEmpty(other[key])) {
      bag[key] = other[key];
      const src = other.fieldSources[key];
      if (src) next.fieldSources[key] = src;
    }
  }
  const milestones: Partial<Record<Milestone, string>> = { ...other.milestones };
  for (const [m, d] of Object.entries(keep.milestones) as [Milestone, string][]) if (!milestones[m] || d < milestones[m]!) milestones[m] = d;
  next.milestones = milestones;
  if (other.doNotContact) {
    next.doNotContact = true;
    next.doNotContactReason = keep.doNotContactReason ?? other.doNotContactReason;
  }
  next.lastContactAt = [keep.lastContactAt, other.lastContactAt].filter(Boolean).sort().pop() ?? null;
  next.dateCollected = keep.dateCollected < other.dateCollected ? keep.dateCollected : other.dateCollected;
  next.updatedAt = now;
  return finalize(next);
}

/**
 * Anonymisation RGPD : les données personnelles sont effacées. Pour un entrepreneur individuel
 * (personne physique), le nom, l'adresse et les identifiants le désignent aussi : ils sont effacés.
 */
export function anonymize(p: Prospect, now: string): Prospect {
  const next: Prospect = { ...p, fieldSources: { ...p.fieldSources } };
  const bag = next as unknown as Record<string, unknown>;
  const personal: (keyof Prospect)[] = [...PERSONAL_FIELDS, 'googleUrl'];
  if (p.individual !== false) personal.push('tradeName', 'siren', 'siret', 'address', 'sourceUrl', 'description');
  for (const k of personal) {
    bag[k] = null;
    delete next.fieldSources[k];
  }
  if (p.individual !== false) next.name = 'Entreprise anonymisée';
  next.anonymized = true;
  next.doNotContact = true;
  next.doNotContactReason = 'Données anonymisées (RGPD)';
  next.nextFollowUpAt = null;
  next.updatedAt = now;
  return finalize(next);
}

/** Met à niveau une fiche enregistrée par une version précédente (valeurs par défaut, provenance déduite). */
export function upgradeProspect(raw: Prospect): Prospect {
  if (raw.fieldSources && raw.enrichmentStatus) return raw;
  const at = raw.lastVerifiedAt ?? raw.dateCollected ?? raw.createdAt;
  const o = originFor(raw.source ?? 'manual', at);
  const fieldSources: Prospect['fieldSources'] = {};
  for (const k of SOURCED_FIELDS) if (!isEmpty(raw[k])) fieldSources[k] = o;
  const p: Prospect = {
    ...raw,
    isHeadOffice: raw.isHeadOffice ?? null,
    companyCategory: raw.companyCategory ?? null,
    openEstablishments: raw.openEstablishments ?? null,
    employer: raw.employer ?? null,
    description: raw.description ?? null,
    enrichmentError: raw.enrichmentError ?? null,
    anonymized: raw.anonymized ?? false,
    fieldSources: raw.fieldSources ?? fieldSources,
    enrichmentStatus: raw.enrichmentStatus ?? (raw.source === 'sirene' ? (adminComplete(raw) ? 'enriched' : 'partial') : 'none'),
    enrichedAt: raw.enrichedAt ?? (raw.source === 'sirene' ? at : null),
  };
  return p;
}

export function toRow(p: Prospect): ProspectRow {
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    address: p.address,
    city: p.city,
    postalCode: p.postalCode,
    department: p.department,
    region: p.region,
    phone: p.phone,
    email: p.email,
    website: p.website,
    googleUrl: p.googleUrl,
    googleRating: p.googleRating,
    googleReviews: p.googleReviews,
    headcountMin: headcountMin(p.headcountBand, p.headcount),
    nafCode: p.nafCode,
    services: p.services,
    activity: p.activity,
    siren: p.siren,
    siret: p.siret,
    creationDate: p.creationDate,
    status: p.status,
    score: p.score,
    owner: p.owner,
    lastContactAt: p.lastContactAt,
    nextFollowUpAt: p.nextFollowUpAt,
    milestones: p.milestones,
    doNotContact: p.doNotContact,
    demo: p.demo,
    createdAt: p.createdAt,
    active: p.active,
    hasSocial: !!(p.facebook || p.instagram || p.linkedin || p.tiktok),
    enrichmentStatus: p.enrichmentStatus,
    enrichedAt: p.enrichedAt,
    search: normText(
      [p.name, p.tradeName, p.siren, p.siret, p.city, p.postalCode, p.department, p.phone?.replace(/\D/g, ''), p.email, p.contactLastName, p.nafCode]
        .filter(Boolean)
        .join(' '),
    ),
  };
}

export function displayName(p: Pick<Prospect, 'name' | 'tradeName'>): string {
  return p.tradeName && p.tradeName !== p.name ? `${p.tradeName} (${p.name})` : p.name;
}
