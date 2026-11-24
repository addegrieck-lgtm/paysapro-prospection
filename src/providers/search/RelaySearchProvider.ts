// Recherche web AUTORISÉE : API officielle Brave Search, appelée par le relais (clé BRAVE_SEARCH_KEY côté relais).
// Active les stratégies « Recherche web » du moteur (domain/strategies.ts) : les résultats servent à trouver le site
// officiel, qui est ensuite vérifié en le lisant. Les extraits ne sont jamais enregistrés comme source.
import type { FetchLike } from '../http';
import { RelayService, type RelayReply } from '../relayService';
import type { SearchOptions, SearchResult, WebSearchProvider } from './WebSearchProvider';

export class RelaySearchProvider implements WebSearchProvider {
  readonly id = 'brave';
  readonly label = 'Recherche web (Brave Search, via le relais)';
  readonly service: RelayService;

  constructor(proxyUrl: string, o: { fetchImpl?: FetchLike } = {}) {
    this.service = new RelayService(proxyUrl, '/search', { fetchImpl: o.fetchImpl, perSecond: 1 });
  }

  get enabled(): boolean {
    return this.service.enabled;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const r = await this.service.call<RelayReply & { results?: SearchResult[] }>({ q: query, count: String(options.count ?? 10) }, options.signal);
    return r.results ?? [];
  }
}
