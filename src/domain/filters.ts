// Filtres, recherche et tri des prospects (utilisés par la base, les segments et les campagnes).
import type { Presence, ProspectFilter, ProspectRow, SortKey } from './types';
import { normText } from './normalize';

const has = (v: unknown) => v !== null && v !== undefined && v !== '';

function presence(p: Presence | undefined, value: boolean): boolean {
  return !p || p === 'any' || (p === 'yes') === value;
}

function day(iso: string | null): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/** Date du jour (AAAA-MM-JJ, heure locale). */
export function today(now = new Date()): string {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
}

export function matchesFilter(r: ProspectRow, f: ProspectFilter, now = new Date()): boolean {
  if (!f.includeDoNotContact && r.doNotContact && !(f.statuses ?? []).includes('do_not_contact')) return false;
  if (f.q) {
    const terms = normText(f.q).split(' ').filter(Boolean);
    const digits = f.q.replace(/\D/g, '');
    const hay = r.search;
    const ok = terms.every((t) => hay.includes(t)) || (digits.length >= 4 && hay.includes(digits));
    if (!ok) return false;
  }
  if (f.regions?.length && !f.regions.includes(r.region ?? '')) return false;
  if (f.departments?.length && !f.departments.includes(r.department ?? '')) return false;
  if (f.city && !normText(r.city).includes(normText(f.city))) return false;
  if (f.scoreMin != null && r.score < f.scoreMin) return false;
  if (f.scoreMax != null && r.score > f.scoreMax) return false;
  if (f.statuses?.length && !f.statuses.includes(r.status)) return false;
  if (f.ratingMin != null && (r.googleRating ?? -1) < f.ratingMin) return false;
  if (f.reviewsMin != null && (r.googleReviews ?? -1) < f.reviewsMin) return false;
  if (f.headcountMin != null && (r.headcountMin ?? -1) < f.headcountMin) return false;
  if (!presence(f.hasPhone, has(r.phone))) return false;
  if (!presence(f.hasWebsite, has(r.website))) return false;
  if (!presence(f.hasEmail, has(r.email))) return false;
  if (!presence(f.hasGoogle, has(r.googleUrl) || r.googleReviews !== null)) return false;
  if (!presence(f.demo, r.demo)) return false;
  if (f.services?.length && !f.services.some((s) => r.services.includes(s))) return false;
  if (f.nafCodes?.length && !f.nafCodes.includes(r.nafCode ?? '')) return false;
  if (f.createdAfter && (!r.creationDate || r.creationDate < f.createdAfter)) return false;
  if (f.createdBefore && (!r.creationDate || r.creationDate > f.createdBefore)) return false;
  const last = day(r.lastContactAt);
  if (f.lastContactAfter && (!last || last < f.lastContactAfter)) return false;
  if (f.lastContactBefore && last && last > f.lastContactBefore) return false;
  if (f.followUpDue && !(r.nextFollowUpAt && day(r.nextFollowUpAt)! <= today(now))) return false;
  if (f.neverContacted && (r.lastContactAt || r.milestones.contacted)) return false;
  return true;
}

const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });

/** Tri stable ; les valeurs inconnues sont toujours rangées en fin de liste. */
export function sortRows(rows: ProspectRow[], sort: SortKey = 'score'): ProspectRow[] {
  const nullsLast = (a: number | string | null, b: number | string | null, desc: boolean) => {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    const c = typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b));
    return desc ? -c : c;
  };
  const cmp: Record<SortKey, (a: ProspectRow, b: ProspectRow) => number> = {
    score: (a, b) => b.score - a.score || (b.googleReviews ?? -1) - (a.googleReviews ?? -1),
    reviews: (a, b) => nullsLast(a.googleReviews, b.googleReviews, true),
    rating: (a, b) => nullsLast(a.googleRating, b.googleRating, true),
    name: (a, b) => collator.compare(a.name, b.name),
    department: (a, b) => nullsLast(a.department, b.department, false),
    lastContact: (a, b) => nullsLast(a.lastContactAt, b.lastContactAt, true),
    nextFollowUp: (a, b) => nullsLast(a.nextFollowUpAt, b.nextFollowUpAt, false),
    created: (a, b) => collator.compare(b.createdAt, a.createdAt),
  };
  return rows.slice().sort((a, b) => cmp[sort](a, b) || collator.compare(a.name, b.name));
}

export const SORT_LABEL: Record<SortKey, string> = {
  score: 'Score décroissant',
  reviews: 'Avis décroissants',
  rating: 'Note décroissante',
  name: 'Entreprise (A → Z)',
  department: 'Département',
  lastContact: 'Dernier contact',
  nextFollowUp: 'Prochaine relance',
  created: 'Ajout le plus récent',
};

/** Nombre de critères actifs (hors recherche) — pour le badge « Filtres (3) ». */
export function activeFilterCount(f: ProspectFilter): number {
  return Object.entries(f).filter(([k, v]) => {
    if (k === 'q') return false;
    if (Array.isArray(v)) return v.length > 0;
    if (v === 'any' || v === undefined || v === null || v === '' || v === false) return false;
    return true;
  }).length;
}

/** Description lisible d'un filtre (« Score ≥ 80 · Département 76 »). */
export function describeFilter(f: ProspectFilter): string {
  const parts: string[] = [];
  if (f.q) parts.push(`« ${f.q} »`);
  if (f.scoreMin != null) parts.push(`Score ≥ ${f.scoreMin}`);
  if (f.scoreMax != null) parts.push(`Score ≤ ${f.scoreMax}`);
  if (f.departments?.length) parts.push(`Dép. ${f.departments.join(', ')}`);
  if (f.regions?.length) parts.push(`${f.regions.length} région(s)`);
  if (f.city) parts.push(`Ville : ${f.city}`);
  if (f.statuses?.length) parts.push(`${f.statuses.length} statut(s)`);
  if (f.reviewsMin != null) parts.push(`Avis ≥ ${f.reviewsMin}`);
  if (f.ratingMin != null) parts.push(`Note ≥ ${f.ratingMin}`);
  if (f.headcountMin != null) parts.push(`Effectif ≥ ${f.headcountMin}`);
  const pres: [Presence | undefined, string][] = [
    [f.hasPhone, 'téléphone'],
    [f.hasWebsite, 'site'],
    [f.hasEmail, 'e-mail'],
    [f.hasGoogle, 'Google'],
  ];
  pres.forEach(([p, l]) => p && p !== 'any' && parts.push(`${p === 'yes' ? 'Avec' : 'Sans'} ${l}`));
  if (f.services?.length) parts.push(`${f.services.length} prestation(s)`);
  if (f.followUpDue) parts.push('Relance due');
  if (f.neverContacted) parts.push('Jamais contacté');
  if (f.createdAfter) parts.push(`Créée après ${f.createdAfter}`);
  if (f.createdBefore) parts.push(`Créée avant ${f.createdBefore}`);
  return parts.join(' · ') || 'Tous les prospects';
}
