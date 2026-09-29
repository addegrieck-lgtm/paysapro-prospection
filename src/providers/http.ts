// Accès réseau aux API gratuites : limiteur de débit partagé, reprises avec attente progressive, délai maximal.
//
//   429 → attendre (Retry-After ou 1 s, 2 s, 4 s…) → réessayer
//   500 → réessayer          timeout / réseau → réessayer
//   404 → « introuvable » (null)       nombre de tentatives borné : jamais de boucle infinie
import { ENRICHMENT_CONFIG } from '../config';

export interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  headers?: { get(name: string): string | null };
}

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<HttpResponse>;

export type ProviderErrorKind = 'rate_limited' | 'unavailable' | 'timeout' | 'invalid' | 'aborted';

/** Erreur fournisseur : `message` est destiné à l'utilisateur (jamais d'erreur technique brute). */
export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly detail: string;
  constructor(kind: ProviderErrorKind, detail: string) {
    super(
      kind === 'aborted'
        ? 'Opération interrompue.'
        : kind === 'invalid'
          ? 'La recherche n’a pas pu être traitée par la source de données.'
          : 'Impossible de récupérer les données actuellement. Le prospect reste enregistré : vous pourrez relancer l’enrichissement plus tard.',
    );
    this.name = 'ProviderError';
    this.kind = kind;
    this.detail = detail;
  }
}

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new ProviderError('aborted', 'aborted'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new ProviderError('aborted', 'aborted'));
    });
  });

/** Limiteur de débit : espace les appels de 1 / N seconde, même s'ils sont lancés en parallèle. */
export class RateLimiter {
  private next = 0;
  readonly intervalMs: number;
  constructor(perSecond: number) {
    this.intervalMs = perSecond > 0 ? 1000 / perSecond : 0;
  }
  async wait(signal?: AbortSignal): Promise<void> {
    const now = Date.now();
    const slot = Math.max(now, this.next);
    this.next = slot + this.intervalMs;
    if (slot > now) await sleep(slot - now, signal);
  }
}

/** Limiteur partagé par toutes les requêtes vers l'API Recherche d'entreprises (≈ 7 req/s autorisées). */
export const sharedLimiter = new RateLimiter(ENRICHMENT_CONFIG.rateLimitPerSecond);

export interface FetchJsonOptions {
  fetchImpl?: FetchLike;
  limiter?: RateLimiter;
  retries?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Attente entre deux tentatives (remplaçable dans les tests) */
  backoff?: (attempt: number, retryAfterSeconds: number | null) => number;
  wait?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

const defaultBackoff = (attempt: number, retryAfter: number | null) => (retryAfter !== null ? retryAfter * 1000 : 1000 * 2 ** attempt);

/** GET JSON robuste. Renvoie null si la ressource n'existe pas (404). */
export async function fetchJson<T>(url: string, o: FetchJsonOptions = {}): Promise<T | null> {
  const fetchImpl: FetchLike = o.fetchImpl ?? ((u, init) => fetch(u, init) as Promise<HttpResponse>);
  const retries = o.retries ?? 4;
  const wait = o.wait ?? sleep;
  const backoff = o.backoff ?? defaultBackoff;
  let last = '';
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (o.signal?.aborted) throw new ProviderError('aborted', 'aborted');
    await (o.limiter ?? sharedLimiter).wait(o.signal);
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), o.timeoutMs ?? 15_000);
    const onAbort = () => timeout.abort();
    o.signal?.addEventListener('abort', onAbort);
    let res: HttpResponse;
    try {
      res = await fetchImpl(url, { signal: timeout.signal });
    } catch (e) {
      if (o.signal?.aborted) throw new ProviderError('aborted', 'aborted');
      last = timeout.signal.aborted ? 'timeout' : `network: ${e instanceof Error ? e.message : String(e)}`;
      console.warn(`[http] ${url} → ${last} (tentative ${attempt + 1})`);
      if (attempt < retries) await wait(backoff(attempt, null), o.signal);
      continue;
    } finally {
      clearTimeout(timer);
      o.signal?.removeEventListener('abort', onAbort);
    }
    if (res.status === 404) return null;
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 || res.status >= 500) {
      last = `HTTP ${res.status}`;
      const ra = Number(res.headers?.get('Retry-After'));
      console.warn(`[http] ${url} → ${last} (tentative ${attempt + 1})`);
      if (attempt < retries) await wait(Math.min(60_000, backoff(attempt, Number.isFinite(ra) && ra > 0 ? ra : null)), o.signal);
      continue;
    }
    let body = '';
    try {
      body = JSON.stringify(await res.json());
    } catch {
      /* corps illisible */
    }
    console.warn(`[http] ${url} → HTTP ${res.status} ${body}`);
    throw new ProviderError('invalid', `HTTP ${res.status} ${body}`);
  }
  throw new ProviderError(last.startsWith('HTTP 429') ? 'rate_limited' : last === 'timeout' ? 'timeout' : 'unavailable', last);
}
