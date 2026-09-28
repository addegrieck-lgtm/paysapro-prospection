// GET /api/prospects/export : export CSV compatible Excel (toutes les colonnes).
import type { Prospect } from '../domain/types';
import type { ProspectsApi } from './repository';
import { toCsv } from '../domain/csv';
import { STATUS_LABEL, SERVICE_LABEL, headcountLabel } from '../domain/referentials';
import { departmentName, regionName } from '../domain/geo';
import { priorityOf } from '../domain/scoring';
import { assertCan } from '../domain/access';

const COLUMNS: [string, (p: Prospect) => unknown][] = [
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
  ['Téléphone', (p) => p.phone],
  ['E-mail', (p) => p.email],
  ['Site web', (p) => p.website],
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

export async function exportProspectsCsv(api: ProspectsApi, ids: string[]): Promise<string> {
  assertCan(api.ctx.role, 'prospecting.export');
  const rows: unknown[][] = [];
  for (let i = 0; i < ids.length; i += 1000) {
    const batch = await api.getProspects(ids.slice(i, i + 1000));
    batch.forEach((p) => rows.push(COLUMNS.map(([, get]) => get(p) ?? '')));
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
