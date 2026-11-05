/** Client de l'API : cookies de session, en-tête anti-CSRF, erreurs lisibles. */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'X-Requested-With': 'radar' };
  let payload: BodyInit | undefined;
  if (body instanceof FormData) payload = body;
  else if (typeof body === 'string') {
    payload = body;
    headers['Content-Type'] = 'text/plain; charset=utf-8';
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers['Content-Type'] = 'application/json';
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError('Serveur injoignable. Vérifiez votre connexion.', 0);
  }
  if (res.status === 401 && !path.startsWith('/auth')) {
    window.dispatchEvent(new Event('radar:unauthorized'));
  }
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json().catch(() => ({})) : await res.text();
  if (!res.ok) throw new ApiError((data as { error?: string })?.error ?? `Erreur ${res.status}`, res.status);
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b ?? {}),
  patch: <T>(p: string, b: unknown) => request<T>('PATCH', p, b),
  put: <T>(p: string, b: unknown) => request<T>('PUT', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),
};

export function qs(params: Record<string, unknown>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
    u.set(k, Array.isArray(v) ? v.join(',') : String(v));
  }
  const s = u.toString();
  return s ? `?${s}` : '';
}

// --- Types partagés -------------------------------------------------------------
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'analyste' | 'lecteur';
}

export interface CompanyRow {
  id: number;
  siren: string;
  name: string;
  trade_name: string | null;
  naf_code: string | null;
  sector_id: string | null;
  commune_name: string | null;
  postal_code: string | null;
  creation_date: string | null;
  headcount_band: string | null;
  legal_form_label: string | null;
  admin_status: string | null;
  lat: number | null;
  lon: number | null;
  website: string | null;
  economic_score: number | null;
  risk_score: number | null;
  reliability_score: number | null;
  data_status: string | null;
  primary_type: string | null;
  types: string | null;
  transmission_index: number | null;
  revenue: number | null;
  net_income: number | null;
  ebe: number | null;
  last_year: number | null;
  valuation_central: number | null;
  project_status: string | null;
  distance_km?: number;
}

export interface Meta {
  departments: string[];
  sectors: { id: string; parent_id: string | null; label: string; priority: number | null; enabled: number }[];
  communes: { code_insee: string; name: string; postal_codes: string; lat: number | null; lon: number | null; population: number | null }[];
  headcountBands: Record<string, { label: string; min: number; max: number | null }>;
  legalForms: Record<string, string>;
  opportunityLabels: Record<string, string>;
  procTypeLabels: Record<string, string>;
  procStatusLabels: Record<string, string>;
  projectStatuses: Record<string, string>;
  alertTypes: Record<string, string>;
  sources: { id: string; label: string; official: boolean }[];
  map: { tileUrl: string; attribution: string };
  aiEnabled: boolean;
}
