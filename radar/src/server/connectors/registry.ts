import { bodacc } from './bodacc';
import { geoCommunes } from './geo-communes';
import { inpiRne } from './inpi-rne';
import { inseeSirene } from './insee-sirene';
import { pappers } from './pappers';
import { rechercheEntreprises } from './recherche-entreprises';
import { rss } from './rss';
import type { Connector, ConnectorMeta } from './types';
import { website } from './website';

/** Ordre d'exécution : référentiel, découverte, événements légaux, enrichissements. */
export const CONNECTORS: Connector[] = [geoCommunes, rechercheEntreprises, bodacc, inseeSirene, inpiRne, pappers, website, rss];

/** Sources sans synchronisation automatique (provenance des données saisies, importées ou calculées). */
export const PSEUDO_SOURCES: ConnectorMeta[] = [
  {
    id: 'import-manuel',
    label: 'Import manuel (CSV)',
    description: "Fichiers importés depuis l'administration : listes de SIREN, comptes détaillés, annonces de cession consultées sur des plateformes sans API (Bpifrance Transmission, Transentreprise CCI/CMA, cabinets…).",
    official: false,
    requiredSecrets: [],
    defaultEnabled: true,
    provides: ['Annonces de cession', 'Comptes détaillés', 'Listes d\'entreprises à suivre'],
    license: 'Sous la responsabilité de l\'utilisateur (droits sur les données importées)',
    termsUrl: '',
    docsUrl: '',
    quotas: '—',
    limitations: ['Les données importées sont marquées « déclaratives » sauf mention contraire.'],
  },
  {
    id: 'saisie',
    label: 'Saisie utilisateur',
    description: "Informations saisies dans l'outil (prix demandé, site internet, notes…).",
    official: false,
    requiredSecrets: [],
    defaultEnabled: true,
    provides: [],
    license: '—',
    termsUrl: '',
    docsUrl: '',
    quotas: '—',
    limitations: [],
  },
  {
    id: 'calcul',
    label: 'Calculs de l\'outil',
    description: 'Indicateurs, scores, valorisations et scénarios calculés à partir des données sources (formules documentées).',
    official: false,
    requiredSecrets: [],
    defaultEnabled: true,
    provides: [],
    license: '—',
    termsUrl: '',
    docsUrl: '',
    quotas: '—',
    limitations: [],
  },
];

export const ALL_SOURCES: ConnectorMeta[] = [...CONNECTORS, ...PSEUDO_SOURCES];
export const connectorById = (id: string) => CONNECTORS.find((c) => c.id === id);
export const sourceMeta = (id: string) => ALL_SOURCES.find((c) => c.id === id);
