/**
 * Classification hiérarchique des secteurs (nomenclature NAF rév. 2, en vigueur jusqu'au passage à la NAF 2025).
 * Un code NAF peut correspondre à plusieurs secteurs (ex. 62.01Z : agence web, création de sites, développement) :
 * le nom de l'entreprise départage via des mots-clés, sinon le premier secteur listé est retenu.
 * Le résultat indique toujours la règle appliquée (explicabilité).
 */
export interface SectorDef {
  id: string;
  parent: string | null;
  label: string;
  priority: number | null;
  naf: string[];
  keywords: string[];
}

const G = (id: string, label: string): SectorDef => ({ id, parent: null, label, priority: null, naf: [], keywords: [] });

export const SECTORS: SectorDef[] = [
  G('numerique', 'Numérique, web & communication'),
  { id: 'agences-web', parent: 'numerique', label: 'Agences web', priority: 1, naf: ['62.01Z', '63.12Z', '74.10Z', '73.11Z'], keywords: ['agence web', 'web', 'digital', 'internet'] },
  { id: 'agences-marketing', parent: 'numerique', label: 'Agences marketing', priority: 2, naf: ['73.11Z', '73.12Z', '73.20Z'], keywords: ['marketing', 'publicite', 'publicité'] },
  { id: 'seo', parent: 'numerique', label: 'SEO et référencement naturel', priority: 3, naf: ['73.11Z', '62.01Z', '63.12Z'], keywords: ['seo', 'referencement', 'référencement'] },
  { id: 'communication-digitale', parent: 'numerique', label: 'Communication digitale', priority: 4, naf: ['70.21Z', '73.11Z'], keywords: ['communication', 'social media', 'community'] },
  { id: 'creation-sites', parent: 'numerique', label: 'Création de sites internet', priority: 5, naf: ['62.01Z', '74.10Z'], keywords: ['site internet', 'sites internet', 'creation de site', 'webdesign', 'web design'] },
  { id: 'developpement-informatique', parent: 'numerique', label: 'Développement informatique', priority: 6, naf: ['62.01Z', '62.02A', '58.29A', '58.29B', '58.29C'], keywords: ['logiciel', 'developpement', 'développement', 'software', 'informatique'] },
  { id: 'maintenance-informatique', parent: 'numerique', label: 'Maintenance informatique', priority: 7, naf: ['62.02B', '62.03Z', '62.09Z', '95.11Z'], keywords: ['maintenance', 'depannage', 'dépannage', 'reseau', 'réseau'] },

  G('paysage', 'Paysage & espaces verts'),
  { id: 'paysagisme', parent: 'paysage', label: 'Paysagisme', priority: 8, naf: ['81.30Z'], keywords: ['paysag'] },
  { id: 'jardinage', parent: 'paysage', label: 'Jardinage professionnel', priority: 9, naf: ['81.30Z'], keywords: ['jardin'] },
  { id: 'elagage', parent: 'paysage', label: 'Élagage', priority: 10, naf: ['81.30Z', '02.40Z', '02.20Z'], keywords: ['élagage', 'elagage', 'abattage', 'arbor'] },
  { id: 'espaces-verts', parent: 'paysage', label: "Entretien d'espaces verts", priority: 11, naf: ['81.30Z'], keywords: ['espaces verts', 'espace vert', 'entretien'] },

  G('services', 'Services aux entreprises'),
  { id: 'nettoyage', parent: 'services', label: 'Nettoyage professionnel', priority: 12, naf: ['81.21Z', '81.22Z', '81.29A', '81.29B'], keywords: ['nettoyage', 'proprete', 'propreté'] },

  G('batiment', 'Bâtiment & artisanat'),
  { id: 'batiment-artisanat', parent: 'batiment', label: 'Bâtiment et artisanat', priority: 13, naf: ['41.20A', '41.20B', '43.11Z', '43.12A', '43.12B', '43.29A', '43.29B', '43.31Z', '43.32A', '43.32B', '43.32C', '43.33Z', '43.34Z', '43.39Z', '43.91A', '43.91B', '43.99A', '43.99B', '43.99D', '43.99E'], keywords: [] },
  { id: 'electricite', parent: 'batiment', label: 'Électricité', priority: 14, naf: ['43.21A', '43.21B'], keywords: ['electri', 'électri'] },
  { id: 'plomberie-chauffage', parent: 'batiment', label: 'Plomberie et chauffage', priority: 15, naf: ['43.22A', '43.22B'], keywords: ['plomb', 'chauff', 'sanitaire', 'climatisation'] },
  { id: 'piscinistes', parent: 'batiment', label: 'Piscinistes', priority: 18, naf: ['42.99Z', '43.99C'], keywords: ['piscine', 'spa'] },

  G('impression', 'Impression & signalétique'),
  { id: 'imprimerie', parent: 'impression', label: 'Imprimerie', priority: 16, naf: ['18.11Z', '18.12Z', '18.13Z', '18.14Z'], keywords: ['imprim', 'print'] },
  { id: 'signaletique', parent: 'impression', label: 'Signalétique et enseignes', priority: 17, naf: ['32.99Z', '73.11Z', '18.12Z'], keywords: ['enseigne', 'signal', 'marquage', 'adhesif', 'adhésif'] },

  G('transport', 'Transport & logistique'),
  { id: 'transport-logistique', parent: 'transport', label: 'Transport et logistique', priority: 19, naf: ['49.39A', '49.41A', '49.41B', '49.41C', '49.42Z', '52.10A', '52.10B', '52.24B', '52.29A', '52.29B', '53.20Z'], keywords: [] },

  G('commerce', 'Commerce'),
  { id: 'commerce-proximite', parent: 'commerce', label: 'Commerce de proximité', priority: 20, naf: ['47.11B', '47.11C', '47.11D', '47.21Z', '47.22Z', '47.23Z', '47.24Z', '47.25Z', '47.26Z', '47.29Z', '47.41Z', '47.42Z', '47.43Z', '47.51Z', '47.52A', '47.52B', '47.53Z', '47.59B', '47.61Z', '47.62Z', '47.64Z', '47.65Z', '47.71Z', '47.72A', '47.73Z', '47.75Z', '47.76Z', '47.77Z', '47.78C', '10.13B', '10.71C', '10.71D', '96.02A', '96.02B'], keywords: [] },

  // Recherche transversale : secteurs complémentaires souvent intéressants en reprise (services récurrents B2B).
  G('transversal', 'Recherche transversale'),
  { id: 'expertise-comptable', parent: 'transversal', label: 'Expertise comptable & gestion', priority: null, naf: ['69.20Z'], keywords: [] },
  { id: 'maintenance-industrielle', parent: 'transversal', label: 'Maintenance & réparation industrielle', priority: null, naf: ['33.12Z', '33.14Z', '33.20A', '33.20B', '33.20C', '33.20D'], keywords: [] },
  { id: 'securite', parent: 'transversal', label: 'Sécurité privée & surveillance', priority: null, naf: ['80.10Z', '80.20Z'], keywords: [] },
  { id: 'garages', parent: 'transversal', label: 'Garages & entretien automobile', priority: null, naf: ['45.20A', '45.20B'], keywords: [] },
  { id: 'ingenierie', parent: 'transversal', label: 'Ingénierie & bureaux d\'études', priority: null, naf: ['71.12B', '71.20B'], keywords: [] },
  { id: 'formation', parent: 'transversal', label: 'Formation professionnelle', priority: null, naf: ['85.59A'], keywords: [] },
];

export const SECTOR_BY_ID = new Map(SECTORS.map((s) => [s.id, s]));

export function normalizeNaf(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase().replace(/\s/g, '');
  const m = c.match(/^(\d{2})\.?(\d{2})([A-Z])$/);
  return m ? `${m[1]}.${m[2]}${m[3]}` : null;
}

/** Tous les codes NAF suivis par les secteurs actifs (sert à planifier les synchronisations). */
export function trackedNafCodes(enabled?: Set<string>): string[] {
  const set = new Set<string>();
  for (const s of SECTORS) if (!enabled || enabled.has(s.id)) for (const n of s.naf) set.add(n);
  return [...set].sort();
}

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export interface SectorMatch {
  sectorId: string | null;
  rule: string;
}

/** Secteur d'une entreprise d'après son code NAF et, en cas d'ambiguïté, son nom. */
export function classifySector(naf: string | null | undefined, name: string | null | undefined, sectors: SectorDef[] = SECTORS): SectorMatch {
  const code = normalizeNaf(naf);
  if (!code) return { sectorId: null, rule: 'Code NAF absent' };
  const candidates = sectors.filter((s) => s.parent && s.naf.includes(code));
  if (!candidates.length) return { sectorId: null, rule: `Code NAF ${code} hors secteurs suivis` };
  if (candidates.length === 1) return { sectorId: candidates[0]!.id, rule: `Code NAF ${code}` };
  const n = fold(name ?? '');
  for (const s of candidates) {
    const kw = s.keywords.find((k) => n.includes(fold(k)));
    if (kw) return { sectorId: s.id, rule: `Code NAF ${code} + mot-clé « ${kw} » dans le nom` };
  }
  return { sectorId: candidates[0]!.id, rule: `Code NAF ${code} (secteur par défaut)` };
}

/** Libellés des tranches d'effectif salarié INSEE. */
export const HEADCOUNT_BANDS: Record<string, { label: string; min: number; max: number | null }> = {
  NN: { label: 'Non employeuse', min: 0, max: 0 },
  '00': { label: '0 salarié', min: 0, max: 0 },
  '01': { label: '1 ou 2 salariés', min: 1, max: 2 },
  '02': { label: '3 à 5 salariés', min: 3, max: 5 },
  '03': { label: '6 à 9 salariés', min: 6, max: 9 },
  '11': { label: '10 à 19 salariés', min: 10, max: 19 },
  '12': { label: '20 à 49 salariés', min: 20, max: 49 },
  '21': { label: '50 à 99 salariés', min: 50, max: 99 },
  '22': { label: '100 à 199 salariés', min: 100, max: 199 },
  '31': { label: '200 à 249 salariés', min: 200, max: 249 },
  '32': { label: '250 à 499 salariés', min: 250, max: 499 },
  '41': { label: '500 à 999 salariés', min: 500, max: 999 },
  '42': { label: '1 000 à 1 999 salariés', min: 1000, max: 1999 },
  '51': { label: '2 000 à 4 999 salariés', min: 2000, max: 4999 },
  '52': { label: '5 000 à 9 999 salariés', min: 5000, max: 9999 },
  '53': { label: '10 000 salariés et plus', min: 10000, max: null },
};

/** Libellés des principales catégories juridiques (nomenclature INSEE niveau III). */
export const LEGAL_FORMS: Record<string, string> = {
  '1000': 'Entrepreneur individuel',
  '5202': 'Société en nom collectif',
  '5306': 'Société en commandite simple',
  '5410': 'SARL nationale',
  '5422': 'SARL immobilière pour le commerce et l\'industrie',
  '5426': 'SARL immobilière de gestion',
  '5430': 'SARL d\'aménagement foncier et d\'équipement rural',
  '5431': 'SARL mixte d\'intérêt agricole',
  '5432': 'SARL d\'intérêt collectif agricole',
  '5442': 'SARL d\'attribution',
  '5443': 'SARL coopérative de construction',
  '5451': 'SARL coopérative de consommation',
  '5453': 'SARL coopérative artisanale',
  '5454': 'SARL coopérative d\'intérêt maritime',
  '5455': 'SARL coopérative de transport',
  '5458': 'SARL coopérative ouvrière de production (SCOP)',
  '5459': 'SARL union de sociétés coopératives',
  '5460': 'Autre SARL coopérative',
  '5485': 'Société d\'exercice libéral à responsabilité limitée',
  '5498': 'SARL unipersonnelle',
  '5499': 'SARL',
  '5505': 'SA à participation ouvrière à conseil d\'administration',
  '5599': 'SA à conseil d\'administration',
  '5699': 'SA à directoire',
  '5710': 'SAS',
  '5720': 'SASU',
  '5785': 'Société d\'exercice libéral par actions simplifiée',
  '6540': 'Société civile immobilière',
  '6599': 'Autre société civile',
  '9220': 'Association déclarée',
};

export function legalFormLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return LEGAL_FORMS[code] ?? null;
}
