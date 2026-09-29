// GET /api/prospects/export : export CSV compatible Excel (toutes les colonnes).
import type { Prospect } from '../domain/types';
import type { ProspectsApi } from './repository';
import { toCsv } from '../domain/csv';
import { STATUS_LABEL, SERVICE_LABEL, headcountLabel } from '../domain/referentials';
import { departmentName, regionName } from '../domain/geo';
import { priorityOf } from '../domain/scoring';
import { assertCan } from '../domain/access';
import { ENRICHMENT_LABEL } from '../domain/enrichment';
import { STATUS_LABEL as CONTACT_STATUS_LABEL } from '../domain/contacts';
import { formatPhone } from '../domain/normalize';
import type { CompanyEmail, CompanyPhone, CompanyWebsite } from '../domain/types';

type Ctx = { phones: CompanyPhone[]; emails: CompanyEmail[]; websites: CompanyWebsite[] };

const activePhones = (c: Ctx) => c.phones.filter((x) => x.status !== 'rejected');
const active = <T extends { status: string }>(l: T[]) => l.filter((x) => x.status !== 'rejected');
const primaryConfidence = (l: { status: string; isPrimary: boolean; confidence: number }[]) => {
  const p = active(l).find((x) => x.isPrimary);
  return p ? `${p.confidence} %` : null;
};

export const EXPORT_COLUMNS: [string, (p: Prospect, c: Ctx) => unknown][] = [
  ['Entreprise', (p) => p.name],
  ['Nom commercial', (p) => p.tradeName],
  ['SIREN', (p) => p.siren],
  ['SIRET', (p) => p.siret],
  ['Adresse', (p) => p.address],
  ['Code postal', (p) => p.postalCode],
  ['Ville', (p) => p.city],
  ['Département', (p) => p.department],
  ['Nom du département', (p) => departmentName(p.department)],
  ['Région', (p) => regionName(p.region)],
  ['Téléphone principal', (p) => (p.phone ? formatPhone(p.phone) : null)],
  ['Téléphones secondaires', (_p, c) => activePhones(c).filter((x) => !x.isPrimary).map((x) => `${x.display} (${x.type === 'mobile' ? 'mobile' : x.type === 'fax' ? 'fax' : 'fixe'}, ${x.confidence} %)`).join(' | ') || null],
  ['Confiance téléphone', (p) => (p.phoneConfidence !== null ? `${p.phoneConfidence} %` : null)],
  ['Statut téléphone', (p) => (p.phoneStatus ? CONTACT_STATUS_LABEL[p.phoneStatus] : null)],
  ['Source téléphone', (p, c) => activePhones(c).find((x) => x.isPrimary)?.evidence.map((e) => e.provider + (e.url ? ` (${e.url})` : '')).join(' ; ') ?? p.fieldSources.phone?.provider ?? null],
  ['E-mail', (p) => p.email],
  ['Autres e-mails', (_p, c) => active(c.emails).filter((x) => !x.isPrimary).map((x) => `${x.value} (${x.confidence} %)`).join(' | ') || null],
  ['Confiance e-mail', (_p, c) => primaryConfidence(c.emails)],
  ['Site web', (p) => p.website],
  ['Confiance site', (_p, c) => primaryConfidence(c.websites)],
  ['Sources', (_p, c) => [...new Set([...active(c.phones), ...active(c.emails), ...active(c.websites)].flatMap((x) => x.evidence.map((e) => e.provider)))].join(' ; ') || null],
  ['Date de vérification des coordonnées', (p) => p.contactsCheckedAt?.slice(0, 10)],
  ['Prénom contact', (p) => p.contactFirstName],
  ['Nom contact', (p) => p.contactLastName],
  ['Google URL', (p) => p.googleUrl],
  ['Note Google', (p) => p.googleRating],
  ['Avis Google', (p) => p.googleReviews],
  ['Facebook', (p) => p.facebook],
  ['Instagram', (p) => p.instagram],
  ['LinkedIn', (p) => p.linkedin],
  ['TikTok', (p) => p.tiktok],
  ['Code NAF', (p) => p.nafCode],
  ['Activité', (p) => p.activity],
  ['Prestations', (p) => p.services.map((s) => SERVICE_LABEL[s])],
  ['Forme juridique', (p) => p.legalForm],
  ['Effectif', (p) => (p.headcount !== null || p.headcountBand ? headcountLabel(p.headcountBand, p.headcount) : null)],
  ['Date de création', (p) => p.creationDate],
  ['Établissement actif', (p) => (p.active === null ? null : p.active ? 'Oui' : 'Non')],
  ['Siège', (p) => (p.isHeadOffice === null ? null : p.isHeadOffice ? 'Oui' : 'Non')],
  ['Catégorie d’entreprise', (p) => p.companyCategory],
  ['Statut enrichissement', (p) => ENRICHMENT_LABEL[p.enrichmentStatus]],
  ['Date enrichissement', (p) => p.enrichedAt?.slice(0, 10)],
  ['Source e-mail', (p) => p.fieldSources.email?.provider],
  ['Source adresse', (p) => p.fieldSources.address?.provider],
  ['Score', (p) => p.score],
  ['Priorité', (p) => priorityOf(p.score).label],
  ['Statut', (p) => STATUS_LABEL[p.status]],
  ['Ne plus contacter', (p) => (p.doNotContact ? 'Oui' : 'Non')],
  ['Dernier contact', (p) => p.lastContactAt?.slice(0, 10)],
  ['Prochaine relance', (p) => p.nextFollowUpAt?.slice(0, 10)],
  ['Responsable', (p) => p.owner],
  ['Source', (p) => p.source],
  ['URL source', (p) => p.sourceUrl],
  ['Date de collecte', (p) => p.dateCollected.slice(0, 10)],
  ['Dernière vérification', (p) => p.lastVerifiedAt?.slice(0, 10)],
  ['Donnée de démonstration', (p) => (p.demo ? 'OUI — FICTIVE' : 'Non')],
];

/** Colonnes proposées par défaut dans le choix des colonnes. */
export const DEFAULT_EXPORT_COLUMNS = ['Entreprise', 'SIREN', 'SIRET', 'Adresse', 'Ville', 'Téléphone principal', 'Téléphones secondaires', 'E-mail', 'Confiance e-mail', 'Site web', 'Confiance site', 'Effectif', 'Score', 'Confiance téléphone', 'Source téléphone', 'Sources', 'Date de vérification des coordonnées', 'Date de collecte'];

export async function exportProspectsCsv(api: ProspectsApi, ids: string[], columns?: string[]): Promise<string> {
  assertCan(api.ctx.role, 'prospecting.export');
  const COLUMNS = columns?.length ? EXPORT_COLUMNS.filter(([h]) => columns.includes(h)) : EXPORT_COLUMNS;
  const rows: unknown[][] = [];
  const all = await api.allContacts();
  const group = <T extends { prospectId: string }>(l: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of l) m.set(x.prospectId, [...(m.get(x.prospectId) ?? []), x]);
    return m;
  };
  const phones = group(all.phones);
  const emails = group(all.emails);
  const websites = group(all.websites);
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = await api.getProspects(ids.slice(i, i + 1000));
    batch.forEach((p) => rows.push(COLUMNS.map(([, get]) => get(p, { phones: phones.get(p.id) ?? [], emails: emails.get(p.id) ?? [], websites: websites.get(p.id) ?? [] }) ?? '')));
  }
  return toCsv(
    COLUMNS.map(([h]) => h),
    rows,
  );
}

export function downloadText(content: string, filename: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function stampedName(base: string, ext: string): string {
  return `${base}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}
