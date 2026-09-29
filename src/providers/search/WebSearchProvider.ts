// WebSearchEngine : abstraction de recherche web, indépendante de tout fournisseur.
//
// Aucun fournisseur n'est branché par défaut (option « tout gratuit ») : récupérer automatiquement les pages de
// résultats de Google, Bing, DuckDuckGo… est interdit par leurs conditions et par les règles du projet.
// Pour ajouter une API AUTORISÉE plus tard (ex. API officielle payante ou gratuite limitée), il suffit
// d'implémenter WebSearchProvider — la clé éventuelle reste côté serveur (relais), jamais dans l'application —
// et de la passer au moteur : les stratégies « Recherche web » s'activent alors automatiquement.
//
// Usage des résultats : trouver le SITE OFFICIEL (vérifié ensuite en le lisant). Les extraits (snippets) ne sont
// jamais enregistrés comme source d'un numéro ou d'un e-mail.
import { domainOf } from '../../domain/webContacts';
import { normName, normText } from '../../domain/normalize';
import { extractPhones } from '../../domain/phone';

export interface SearchOptions {
  signal?: AbortSignal;
  /** Nombre de résultats souhaités */
  count?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchProvider {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
}

/** Chaîne de fournisseurs : A échoue → B → C (§99). Le premier qui répond est utilisé. */
export class FallbackSearchProvider implements WebSearchProvider {
  readonly id = 'fallback';
  readonly label: string;
  private providers: WebSearchProvider[];

  constructor(providers: WebSearchProvider[]) {
    this.providers = providers.filter((p) => p.enabled);
    this.label = this.providers.map((p) => p.label).join(' → ') || 'Aucun';
  }

  get enabled(): boolean {
    return this.providers.length > 0;
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    let last: unknown = null;
    for (const p of this.providers) {
      try {
        return await p.search(query, options);
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') throw e;
        last = e;
      }
    }
    throw last ?? new Error('Aucun fournisseur de recherche disponible');
  }
}

// Annuaires, réseaux sociaux, places de marché : jamais le site officiel
const DIRECTORY = /(^|\.)(pagesjaunes|societe|pappers|verif|infogreffe|annuaire-entreprises|manageo|kompass|118712|118000|mappy|yelp|tripadvisor|houzz|travaux|habitatpresto|starofservice|hellowork|indeed|lefigaro|ouest-france|leboncoin|facebook|instagram|linkedin|youtube|tiktok|twitter|x|google|bing|wikipedia|annuaire[a-z-]*)\.[a-z.]+$/i;

export interface AnalyzedResult extends SearchResult {
  domain: string | null;
  phoneCandidates: string[];
  nameMatch: boolean;
  placeMatch: boolean;
  relevance: number;
  isRelevant: boolean;
  isPotentialOfficialSite: boolean;
  isPotentialDirectory: boolean;
  isPotentialFalsePositive: boolean;
}

/**
 * WebResultAnalyzer : classe un résultat (site officiel possible, annuaire, faux positif probable).
 * Un nom seul n'est jamais suffisant : il faut aussi la commune / le code postal (ou le domaine formé sur le nom).
 */
export function analyzeResult(r: SearchResult, c: { name: string; tradeName?: string | null; city: string | null; postalCode: string | null }): AnalyzedResult {
  const domain = domainOf(r.url);
  const text = normText(`${r.title} ${r.snippet}`);
  const names = [c.name, c.tradeName].filter(Boolean).map((n) => normName(n!)).filter((n) => n.length >= 4);
  const nameMatch = names.some((n) => normName(`${r.title} ${r.snippet}`).includes(n));
  const placeMatch = (!!c.city && text.includes(normText(c.city))) || (!!c.postalCode && `${r.title} ${r.snippet}`.includes(c.postalCode));
  const flatDomain = (domain ?? '').replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]/g, '');
  const domainName = names.some((n) => n.split(' ').some((t) => t.length >= 4 && flatDomain.includes(t)));
  const isPotentialDirectory = !!domain && DIRECTORY.test(domain);
  const relevance = (nameMatch ? 0.5 : 0) + (placeMatch ? 0.3 : 0) + (domainName ? 0.2 : 0);
  return {
    ...r,
    domain,
    phoneCandidates: extractPhones(r.snippet).map((p) => p.e164),
    nameMatch,
    placeMatch,
    relevance,
    isRelevant: relevance >= 0.5,
    isPotentialOfficialSite: !isPotentialDirectory && (domainName || (nameMatch && placeMatch)),
    isPotentialDirectory,
    isPotentialFalsePositive: nameMatch && !placeMatch && !domainName,
  };
}
