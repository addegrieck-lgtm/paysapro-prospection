// Services facultatifs du relais (recherche web, fiches Google) : leurs clés sont détenues par le relais, jamais
// par l'application. Un service sans clé répond { ok: false, code: 'not_configured' } : il est alors désactivé
// pour la session ; un quota atteint ou une panne le met en pause 15 minutes (la file d'enrichissement continue).
import { fetchJson, ProviderError, RateLimiter, type FetchLike } from './http';

export type RelayCode = 'not_configured' | 'quota' | 'unavailable';

export interface RelayReply {
  ok: boolean;
  code?: RelayCode;
  error?: string;
}

export class RelayService {
  private base: string;
  private path: string;
  private fetchImpl?: FetchLike;
  private limiter: RateLimiter;
  /** null : pas encore interrogé ; false : clé absente côté relais */
  configured: boolean | null = null;
  private pausedUntil = 0;
  lastError: string | null = null;

  constructor(base: string, path: string, o: { fetchImpl?: FetchLike; perSecond?: number } = {}) {
    this.base = base.replace(/\/$/, '');
    this.path = path;
    this.fetchImpl = o.fetchImpl;
    this.limiter = new RateLimiter(o.perSecond ?? 1);
  }

  get enabled(): boolean {
    return !!this.base && this.configured !== false && Date.now() >= this.pausedUntil;
  }

  async call<T extends RelayReply>(params: Record<string, string>, signal?: AbortSignal): Promise<T> {
    if (!this.enabled) throw new ProviderError('unavailable', `${this.path} indisponible`);
    const qs = new URLSearchParams(params).toString();
    const data = await fetchJson<T>(`${this.base}${this.path}?${qs}`, { fetchImpl: this.fetchImpl, limiter: this.limiter, retries: 1, timeoutMs: 20_000, signal }).catch((e) => {
      if (e instanceof ProviderError && e.kind !== 'aborted') this.pausedUntil = Date.now() + 15 * 60_000;
      throw e;
    });
    // Ancien relais (route inconnue) : service absent
    if (!data) {
      this.configured = false;
      throw new ProviderError('unavailable', `${this.path} : relais à mettre à jour`);
    }
    if (!data.ok) {
      this.lastError = data.error ?? null;
      if (data.code === 'not_configured') this.configured = false;
      else this.pausedUntil = Date.now() + (data.code === 'quota' ? 60 : 15) * 60_000;
      throw new ProviderError(data.code === 'quota' ? 'rate_limited' : 'unavailable', data.error ?? `${this.path} indisponible`);
    }
    this.configured = true;
    return data;
  }
}
