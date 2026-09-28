// Correspondance colonnes CSV → champs prospect (détection automatique + validation ligne à ligne).
import type { ProspectInput } from './prospect';
import { normalizeDepartment, departmentFromPostalCode } from './geo';
import { normalizeNaf, servicesFromText, HEADCOUNT_BANDS } from './referentials';
import {
  clean,
  normDate,
  normEmail,
  normNumber,
  normPhone,
  normPostalCode,
  normSiren,
  normSiret,
  normText,
  normUrl,
} from './normalize';

export type FieldKey =
  | 'name'
  | 'tradeName'
  | 'siren'
  | 'siret'
  | 'address'
  | 'postalCode'
  | 'city'
  | 'department'
  | 'phone'
  | 'email'
  | 'website'
  | 'googleUrl'
  | 'googleRating'
  | 'googleReviews'
  | 'headcount'
  | 'nafCode'
  | 'activity'
  | 'services'
  | 'creationDate'
  | 'contactFirstName'
  | 'contactLastName'
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'tiktok'
  | 'sourceUrl';

export const FIELDS: { key: FieldKey; label: string; synonyms: string[] }[] = [
  { key: 'name', label: 'Nom entreprise', synonyms: ['nom', 'nom entreprise', 'entreprise', 'raison sociale', 'denomination', 'societe', 'company', 'name', 'nom complet'] },
  { key: 'tradeName', label: 'Nom commercial', synonyms: ['nom commercial', 'enseigne', 'trade name'] },
  { key: 'siren', label: 'SIREN', synonyms: ['siren'] },
  { key: 'siret', label: 'SIRET', synonyms: ['siret'] },
  { key: 'address', label: 'Adresse', synonyms: ['adresse', 'address', 'rue', 'adresse complete'] },
  { key: 'postalCode', label: 'Code postal', synonyms: ['cp', 'code postal', 'postal code', 'zip', 'codepostal'] },
  { key: 'city', label: 'Ville', synonyms: ['ville', 'commune', 'city', 'localite', 'libelle commune'] },
  { key: 'department', label: 'Département', synonyms: ['departement', 'dept', 'dep', 'department'] },
  { key: 'phone', label: 'Téléphone', synonyms: ['telephone', 'tel', 'phone', 'portable', 'mobile', 'numero'] },
  { key: 'email', label: 'E-mail', synonyms: ['email', 'e mail', 'mail', 'courriel', 'adresse email'] },
  { key: 'website', label: 'Site web', synonyms: ['site', 'site web', 'site internet', 'website', 'url site', 'web'] },
  { key: 'googleUrl', label: 'URL Google', synonyms: ['google url', 'google', 'url google', 'fiche google', 'google maps', 'google business'] },
  { key: 'googleRating', label: 'Note Google', synonyms: ['google rating', 'note', 'note google', 'rating'] },
  { key: 'googleReviews', label: "Nombre d'avis Google", synonyms: ['google reviews', 'avis', 'nombre avis', 'nb avis', 'reviews', 'nombre d avis'] },
  { key: 'headcount', label: 'Effectif', synonyms: ['effectif', 'salaries', 'employes', 'headcount', 'tranche effectif', 'tranche effectif salarie'] },
  { key: 'nafCode', label: 'Code NAF', synonyms: ['naf', 'code naf', 'ape', 'code ape', 'activite principale'] },
  { key: 'activity', label: 'Activité', synonyms: ['activite', 'activity', 'description', 'secteur'] },
  { key: 'services', label: 'Prestations', synonyms: ['prestations', 'services', 'metiers'] },
  { key: 'creationDate', label: 'Date de création', synonyms: ['date creation', 'creation', 'date de creation', 'created'] },
  { key: 'contactFirstName', label: 'Prénom du contact', synonyms: ['prenom', 'first name', 'prenom contact'] },
  { key: 'contactLastName', label: 'Nom du contact', synonyms: ['nom contact', 'last name', 'contact'] },
  { key: 'facebook', label: 'Facebook', synonyms: ['facebook'] },
  { key: 'instagram', label: 'Instagram', synonyms: ['instagram'] },
  { key: 'linkedin', label: 'LinkedIn', synonyms: ['linkedin'] },
  { key: 'tiktok', label: 'TikTok', synonyms: ['tiktok'] },
  { key: 'sourceUrl', label: 'URL de la source', synonyms: ['source url', 'source', 'url source'] },
];

export const FIELD_LABEL = Object.fromEntries(FIELDS.map((f) => [f.key, f.label])) as Record<FieldKey, string>;

export type Mapping = (FieldKey | null)[];

/** Associe chaque colonne à un champ (au plus une colonne par champ). */
export function autoDetectMapping(headers: string[]): Mapping {
  const used = new Set<FieldKey>();
  const norm = headers.map((h) => normText(h.replace(/[_-]/g, ' ')));
  const result: Mapping = headers.map(() => null);
  // 1er passage : correspondances exactes ; 2e passage : le libellé contient un synonyme.
  for (const exact of [true, false]) {
    norm.forEach((h, i) => {
      if (result[i]) return;
      const field = FIELDS.find(
        (f) => !used.has(f.key) && f.synonyms.some((s) => (exact ? h === s || h.replace(/ /g, '') === s.replace(/ /g, '') : s.length > 3 && h.includes(s))),
      );
      if (field) {
        result[i] = field.key;
        used.add(field.key);
      }
    });
  }
  return result;
}

export interface RowResult {
  input: ProspectInput | null;
  errors: string[];
}

function headcountFrom(value: string): { headcount?: number; headcountBand?: string } {
  const v = value.trim();
  if (HEADCOUNT_BANDS[v]) return { headcountBand: v };
  const n = normNumber(v);
  return n !== null && n >= 0 ? { headcount: Math.round(n) } : {};
}

/**
 * Transforme une ligne CSV en données prospect. Une valeur illisible est ignorée (jamais devinée)
 * et signalée. `requireName` : faux pour un fichier d'enrichissement (identifié par SIREN/SIRET).
 */
export function mapRow(values: string[], mapping: Mapping, requireName = true): RowResult {
  const errors: string[] = [];
  const input: ProspectInput = {};
  const get = (k: FieldKey) => {
    const i = mapping.indexOf(k);
    return i >= 0 ? (values[i] ?? '').trim() : '';
  };
  const setIf = <K extends keyof ProspectInput>(key: K, raw: string, value: ProspectInput[K] | null, label: string) => {
    if (!raw) return;
    if (value === null || value === undefined) errors.push(`${label} illisible : « ${raw.slice(0, 40)} »`);
    else input[key] = value;
  };

  const name = clean(get('name'));
  if (name) input.name = name;
  const tradeName = clean(get('tradeName'));
  if (tradeName) input.tradeName = tradeName;
  setIf('siren', get('siren'), normSiren(get('siren')), 'SIREN');
  setIf('siret', get('siret'), normSiret(get('siret')), 'SIRET');
  if (input.siret && !input.siren) input.siren = input.siret.slice(0, 9);
  const address = clean(get('address'));
  if (address) input.address = address;
  setIf('postalCode', get('postalCode'), normPostalCode(get('postalCode')), 'Code postal');
  const city = clean(get('city'));
  if (city) input.city = city;
  const dept = get('department');
  setIf('department', dept, normalizeDepartment(dept), 'Département');
  if (!input.department && input.postalCode) input.department = departmentFromPostalCode(input.postalCode) ?? undefined;
  setIf('phone', get('phone'), normPhone(get('phone')), 'Téléphone');
  setIf('email', get('email'), normEmail(get('email')), 'E-mail');
  setIf('website', get('website'), normUrl(get('website')), 'Site web');
  setIf('googleUrl', get('googleUrl'), normUrl(get('googleUrl')), 'URL Google');
  const rating = normNumber(get('googleRating'));
  setIf('googleRating', get('googleRating'), rating !== null && rating >= 0 && rating <= 5 ? rating : null, 'Note Google');
  const reviews = normNumber(get('googleReviews'));
  setIf('googleReviews', get('googleReviews'), reviews !== null && reviews >= 0 ? Math.round(reviews) : null, "Nombre d'avis");
  if (get('headcount')) Object.assign(input, headcountFrom(get('headcount')));
  setIf('nafCode', get('nafCode'), normalizeNaf(get('nafCode')), 'Code NAF');
  const activity = clean(get('activity'));
  if (activity) input.activity = activity;
  const services = servicesFromText([get('services'), activity].join(' '));
  if (services.length) input.services = services;
  setIf('creationDate', get('creationDate'), normDate(get('creationDate')), 'Date de création');
  for (const k of ['contactFirstName', 'contactLastName'] as const) {
    const v = clean(get(k));
    if (v) input[k] = v;
  }
  for (const k of ['facebook', 'instagram', 'linkedin', 'tiktok', 'sourceUrl'] as const) setIf(k, get(k), normUrl(get(k)), FIELD_LABEL[k]);

  if (requireName && !input.name) return { input: null, errors: ['Nom de l’entreprise manquant', ...errors] };
  if (!requireName && !input.siren && !input.siret && !input.name) return { input: null, errors: ['Ni SIREN, ni SIRET, ni nom : impossible de retrouver le prospect', ...errors] };
  return { input, errors };
}
