// Contrat commun des sources de données d'entreprises.
//
//   CompanyDataProvider
//   ├── RechercheEntreprisesProvider  (API publique gratuite de l'État — recherche, SIREN, SIRET, enrichissement)
//   ├── SireneProvider                (import massif par département / région / code postal, via la même API)
//   ├── CsvProvider                   (fichiers CSV : export SIRENE, vos listes, enrichissement commercial)
//   ├── ManualProvider                (saisie manuelle, recherche web par l'utilisateur)
//   └── GooglePlacesProvider          (désactivé : payant)
//
// L'application ne dépend que de ces interfaces : changer de fournisseur ne demande pas de réécrire les écrans.
import type { Confidence, Prospect } from '../../domain/types';
import type { ProspectInput } from '../../domain/prospect';

/** Établissement (identifié par un SIRET). */
export interface Establishment {
  siret: string;
  siren: string;
  isHeadOffice: boolean;
  active: boolean;
  nafCode: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  department: string | null;
  region: string | null;
  creationDate: string | null;
  headcountBand: string | null;
  tradeName: string | null;
  employer: boolean | null;
  latitude: number | null;
  longitude: number | null;
  diffusible: boolean;
}

/** Entreprise (unité légale, identifiée par un SIREN). */
export interface Company {
  siren: string;
  name: string;
  legalForm: string | null;
  individual: boolean;
  active: boolean;
  creationDate: string | null;
  headcountBand: string | null;
  category: string | null;
  openEstablishments: number | null;
  nafCode: string | null;
  diffusible: boolean;
  headOffice: Establishment | null;
  /** Établissements correspondant à la recherche */
  matching: Establishment[];
}

export interface SearchParams {
  q?: string;
  siren?: string;
  siret?: string;
  name?: string;
  postalCode?: string;
  /** Nom de la commune (filtre appliqué sur les résultats) */
  commune?: string;
  department?: string;
  region?: string;
  nafCodes?: string[];
  activeOnly?: boolean;
  page?: number;
  perPage?: number;
}

export interface SearchResult {
  companies: Company[];
  total: number;
  pages: number;
}

/** Ce que l'on sait déjà du prospect pour le retrouver. */
export type EnrichTarget = Pick<Prospect, 'siren' | 'siret' | 'name' | 'tradeName' | 'postalCode' | 'city' | 'address'>;

export type EnrichOutcome =
  | { status: 'found'; input: ProspectInput; company: Company; establishment: Establishment | null; matchedBy: 'siret' | 'siren' | 'name'; confidence: Confidence; fromCache: boolean }
  | { status: 'not_found'; reason: string; fromCache: boolean }
  | { status: 'ambiguous'; candidates: Company[]; fromCache: boolean };

export interface EnrichOptions {
  /** Ignore le cache (« Forcer le réenrichissement ») */
  force?: boolean;
  signal?: AbortSignal;
}

export interface CompanyDataProvider {
  readonly id: string;
  readonly label: string;
  readonly free: boolean;
  search(params: SearchParams, signal?: AbortSignal): Promise<SearchResult>;
  getBySiren(siren: string, opts?: EnrichOptions): Promise<Company | null>;
  getBySiret(siret: string, opts?: EnrichOptions): Promise<{ company: Company; establishment: Establishment } | null>;
  enrich(target: EnrichTarget, opts?: EnrichOptions): Promise<EnrichOutcome>;
}
