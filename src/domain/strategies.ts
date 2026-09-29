// Catalogue des stratégies de recherche du moteur auto-apprenant.
//
// Une stratégie = une façon précise de chercher une coordonnée (source + méthode), avec :
//   • les champs qu'elle peut trouver (site, téléphone, e-mail) ;
//   • son coût estimé (requêtes) ;
//   • ses prérequis (site connu, nom commercial…) et les modes où elle est autorisée ;
//   • une estimation a priori (utilisée tant que l'historique est insuffisant).
// Le choix, l'ordre et l'arrêt sont ensuite décidés par les STATISTIQUES réelles (domain/learning.ts).
import type { ContactField, EnrichmentMode, StrategyId } from './types';

export type StrategyKind = 'directory' | 'discovery' | 'site' | 'web_search';

export interface StrategyDef {
  id: StrategyId;
  label: string;
  kind: StrategyKind;
  /** Source affichée (performance des sources) */
  source: string;
  fields: ContactField[];
  /** Requêtes estimées (coût) */
  cost: number;
  modes: EnrichmentMode[];
  requires?: 'known_site' | 'verified_site' | 'no_verified_site' | 'trade_name' | 'city' | 'landscape' | 'search_provider';
  /** Estimation a priori : probabilité de trouver, précision attendue */
  prior: { success: number; precision: number };
  /** Modèle de requête web (stratégies web uniquement) */
  query?: string;
}

const ALL: EnrichmentMode[] = ['fast', 'normal', 'max'];

export const STRATEGIES: StrategyDef[] = [
  {
    id: 'osm_directory',
    label: 'Annuaire public OpenStreetMap',
    kind: 'directory',
    source: 'OpenStreetMap',
    fields: ['phone', 'email', 'website'],
    cost: 0,
    modes: ALL,
    prior: { success: 0.1, precision: 0.85 },
  },
  {
    id: 'site_known',
    label: 'Site connu : accueil, contact, mentions légales',
    kind: 'site',
    source: 'Site officiel',
    fields: ['phone', 'email'],
    cost: 4,
    modes: ALL,
    requires: 'known_site',
    prior: { success: 0.7, precision: 0.85 },
  },
  {
    id: 'site_deep',
    label: 'Site vérifié : exploration approfondie (plan du site, devis, à propos, services)',
    kind: 'site',
    source: 'Site officiel',
    fields: ['phone', 'email'],
    cost: 7,
    modes: ['normal', 'max'],
    requires: 'verified_site',
    prior: { success: 0.25, precision: 0.8 },
  },
  {
    id: 'domain_name',
    label: 'Site : domaine formé sur la raison sociale',
    kind: 'discovery',
    source: 'Site officiel',
    fields: ['website', 'phone', 'email'],
    cost: 4,
    modes: ALL,
    requires: 'no_verified_site',
    prior: { success: 0.12, precision: 0.85 },
  },
  {
    id: 'domain_trade',
    label: 'Site : domaine formé sur le nom commercial',
    kind: 'discovery',
    source: 'Site officiel',
    fields: ['website', 'phone', 'email'],
    cost: 4,
    modes: ALL,
    requires: 'trade_name',
    prior: { success: 0.15, precision: 0.85 },
  },
  {
    id: 'domain_name_city',
    label: 'Site : domaine nom + commune',
    kind: 'discovery',
    source: 'Site officiel',
    fields: ['website', 'phone', 'email'],
    cost: 2,
    modes: ['normal', 'max'],
    requires: 'city',
    prior: { success: 0.05, precision: 0.85 },
  },
  {
    id: 'domain_activity',
    label: 'Site : domaine nom + activité (paysage, jardins…)',
    kind: 'discovery',
    source: 'Site officiel',
    fields: ['website', 'phone', 'email'],
    cost: 4,
    modes: ['max'],
    requires: 'landscape',
    prior: { success: 0.05, precision: 0.8 },
  },
];

/**
 * Stratégies de recherche web (§5). Elles ne s'activent QUE si un fournisseur de recherche autorisé est configuré
 * (interface WebSearchProvider) : aucun moteur n'est interrogé sans autorisation. Les résultats servent à trouver
 * le SITE OFFICIEL, qui est ensuite vérifié en le lisant.
 */
export const WEB_QUERIES: { id: StrategyId; query: string; fields: ContactField[] }[] = [
  { id: 'web_name_city', query: '"{name}" "{city}"', fields: ['website', 'phone', 'email'] },
  { id: 'web_name_city_phone', query: '"{name}" "{city}" téléphone', fields: ['phone', 'website'] },
  { id: 'web_name_city_email', query: '"{name}" "{city}" email', fields: ['email', 'website'] },
  { id: 'web_name_city_contact', query: '"{name}" "{city}" contact', fields: ['phone', 'email', 'website'] },
  { id: 'web_name_city_activity', query: '"{name}" "{city}" paysagiste', fields: ['website', 'phone'] },
  { id: 'web_name_address', query: '"{name}" "{address}"', fields: ['website', 'phone'] },
  { id: 'web_name_city_legal', query: '"{name}" "{city}" "mentions légales"', fields: ['website', 'email'] },
  { id: 'web_name_city_quote', query: '"{name}" "{city}" devis', fields: ['website', 'phone'] },
  { id: 'web_name_city_06', query: '"{name}" "{city}" "06"', fields: ['phone'] },
  { id: 'web_name_city_02', query: '"{name}" "{city}" "0{area}"', fields: ['phone'] },
];

for (const w of WEB_QUERIES) {
  STRATEGIES.push({
    id: w.id,
    label: `Recherche web : ${w.query}`,
    kind: 'web_search',
    source: 'Recherche web',
    fields: w.fields,
    cost: 3,
    modes: w.id === 'web_name_city' || w.id === 'web_name_city_contact' ? ALL : ['normal', 'max'],
    requires: 'search_provider',
    prior: { success: 0.3, precision: 0.8 },
    query: w.query,
  });
}

export const STRATEGY_BY_ID = new Map(STRATEGIES.map((s) => [s.id, s]));

export function strategyLabel(id: string): string {
  return STRATEGY_BY_ID.get(id as StrategyId)?.label ?? id;
}

/** Indicatif régional français d'un code postal (pour la requête « 0X ») : 1 IDF, 2 NO, 3 NE, 4 SE, 5 SO. */
export function areaDigit(postalCode: string | null): string {
  const d = Number((postalCode ?? '').slice(0, 2));
  if ([75, 77, 78, 91, 92, 93, 94, 95].includes(d)) return '1';
  if ([14, 18, 22, 27, 28, 29, 35, 36, 37, 41, 44, 45, 49, 50, 53, 56, 61, 72, 76, 85, 97].includes(d)) return '2';
  if ([2, 8, 10, 21, 25, 39, 51, 52, 54, 55, 57, 58, 59, 60, 62, 67, 68, 70, 71, 80, 88, 89, 90].includes(d)) return '3';
  if ([1, 3, 4, 5, 6, 7, 11, 13, 15, 20, 26, 30, 34, 38, 42, 43, 48, 63, 66, 69, 73, 74, 83, 84].includes(d)) return '4';
  return '5';
}

/** Requête web concrète d'une stratégie (null s'il manque une donnée : jamais de requête vide ou inventée). */
export function buildQuery(def: StrategyDef, c: { name: string; tradeName?: string | null; city: string | null; address: string | null; postalCode: string | null }): string | null {
  if (!def.query) return null;
  const name = c.tradeName || c.name;
  if (!name || (def.query.includes('{city}') && !c.city) || (def.query.includes('{address}') && !c.address)) return null;
  return def.query
    .replace('{name}', name)
    .replace('{city}', c.city ?? '')
    .replace('{address}', c.address ?? '')
    .replace('{area}', areaDigit(c.postalCode));
}
