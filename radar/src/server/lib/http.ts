/**
 * Client HTTP des connecteurs : délai maximal, nouvelles tentatives bornées sur 429 / 5xx / erreurs réseau,
 * espacement minimal entre requêtes par source (respect des quotas), budget de sous-requêtes par exécution
 * (Cloudflare limite le nombre de sous-requêtes par invocation).
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export class BudgetExhausted extends Error {
  constructor() {
    super('Budget de requêtes épuisé pour cette exécution (reprise automatique à la prochaine étape).');
    this.name = 'BudgetExhausted';
  }
}

export interface HttpClientOptions {
  fetch: FetchLike;
  minIntervalMs?: number;
  timeoutMs?: number;
  retries?: number;
  budget?: { remaining: number };
  sleep?: (ms: number) => Promise<void>;
  userAgent?: string;
}

export const USER_AGENT = 'NormandieBusinessRadar/0.1 (veille economique personnelle; respecte robots.txt)';

export function createHttp(o: HttpClientOptions) {
  const sleep = o.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  let last = 0;
  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const retries = o.retries ?? 2;
    for (let attempt = 0; ; attempt++) {
      if (o.budget) {
        if (o.budget.remaining <= 0) throw new BudgetExhausted();
        o.budget.remaining--;
      }
      const wait = (o.minIntervalMs ?? 0) - (Date.now() - last);
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 20000);
      let res: Response | undefined;
      let netErr: unknown;
      try {
        res = await o.fetch(url, { ...init, signal: ctrl.signal, headers: { 'User-Agent': o.userAgent ?? USER_AGENT, Accept: 'application/json', ...(init.headers as Record<string, string>) } });
      } catch (e) {
        netErr = e;
      } finally {
        clearTimeout(timer);
      }
      const retriable = netErr !== undefined || (res && (res.status === 429 || res.status >= 500));
      if (retriable && attempt < retries) {
        const ra = Number(res?.headers.get('retry-after'));
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 1000 * 2 ** attempt);
        continue;
      }
      if (netErr !== undefined) throw new HttpError(`Erreur réseau : ${(netErr as Error)?.message ?? String(netErr)}`, 0);
      return res!;
    }
  }
  async function json<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await request(url, init);
    if (!res.ok) {
      const body = (await res.text().catch(() => '')).slice(0, 500);
      throw new HttpError(`HTTP ${res.status} sur ${redact(url)}`, res.status, body);
    }
    return (await res.json()) as T;
  }
  return { request, json };
}

/** Masque les jetons éventuellement présents dans une URL avant journalisation. */
export function redact(url: string): string {
  return url.replace(/(api_token|token|key|apikey)=[^&]+/gi, '$1=***');
}

export type Http = ReturnType<typeof createHttp>;
