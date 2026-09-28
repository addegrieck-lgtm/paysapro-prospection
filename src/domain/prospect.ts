// Fabrique, fusion et projection des fiches prospect.
import type { Milestone, Prospect, ProspectRow, ProspectStatus, SourceKind } from './types';
import { computeScore } from './scoring';
import { headcountMin, STATUS_MILESTONES } from './referentials';
import { departmentFromPostalCode, regionOfDepartment } from './geo';
import { normText } from './normalize';
import { uid } from '../utils/id';

/** Champs qu'une source (import, saisie) peut fournir. */
export type ProspectInput = Partial<
  Omit<Prospect, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'score' | 'milestones' | 'dateCollected'>
> & { name?: string };

/** Champs d'identité officielle (SIRENE font foi pour ceux-ci). */
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
] as const satisfies readonly (keyof Prospect)[];

export interface Context {
  workspaceId: string;
  user: string;
  now?: string;
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
  };
}

/** Complète les champs dérivés (département, région, score) sans rien inventer. */
export function finalize(p: Prospect): Prospect {
  const department = p.department ?? departmentFromPostalCode(p.postalCode);
  const region = p.region ?? regionOfDepartment(department);
  const next = { ...p, department, region };
  if (next.doNotContact) next.status = 'do_not_contact';
  next.score = computeScore(next).score;
  return next;
}

export function createProspect(input: ProspectInput, ctx: Context, source: SourceKind): Prospect {
  const base = emptyProspect(ctx, source);
  const defined = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  return finalize({ ...base, ...defined, name: input.name?.trim() || base.name });
}

export type MergeMode =
  /** Complète uniquement les champs vides (doublon probable, import CSV) */
  | 'fill'
  /** Une valeur fournie remplace l'ancienne (fichier d'enrichissement, saisie) */
  | 'overwrite'
  /** SIRENE : l'identité officielle est rafraîchie, les coordonnées seulement complétées */
  | 'identity';

function isEmpty(v: unknown) {
  return v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
}

/** Fusion sûre : ne supprime jamais une donnée existante par une valeur vide. Renvoie les champs modifiés. */
export function mergeProspect(existing: Prospect, input: ProspectInput, mode: MergeMode, now: string): { prospect: Prospect; changed: string[] } {
  const next: Prospect = { ...existing };
  const bag = next as unknown as Record<string, unknown>;
  const changed: string[] = [];
  const identity = new Set<string>(IDENTITY_FIELDS);
  for (const [key, value] of Object.entries(input) as [keyof Prospect, unknown][]) {
    if (value === undefined || isEmpty(value)) continue;
    const current = next[key];
    if (key === 'services') {
      const merged = Array.from(new Set([...(existing.services ?? []), ...(value as string[])]));
      if (merged.length !== existing.services.length) {
        bag.services = merged;
        changed.push(key);
      }
      continue;
    }
    const write = mode === 'overwrite' ? current !== value : mode === 'identity' && identity.has(key) ? current !== value : isEmpty(current);
    if (write) {
      bag[key] = value;
      changed.push(key);
    }
  }
  if (changed.length) next.updatedAt = now;
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

export function toRow(p: Prospect): ProspectRow {
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
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
    search: normText(
      [p.name, p.tradeName, p.siren, p.siret, p.city, p.postalCode, p.department, p.phone?.replace(/\D/g, ''), p.email, p.contactLastName]
        .filter(Boolean)
        .join(' '),
    ),
  };
}

export function displayName(p: Pick<Prospect, 'name' | 'tradeName'>): string {
  return p.tradeName && p.tradeName !== p.name ? `${p.tradeName} (${p.name})` : p.name;
}
