// Client de l'API locale (FastAPI). Toutes les données restent sur l'ordinateur.
export class ApiError extends Error {}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === 'string') msg = data.detail;
      else if (Array.isArray(data.detail)) msg = data.detail.map((d: { msg: string }) => d.msg).join(', ');
    } catch {
      /* réponse non JSON */
    }
    throw new ApiError(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b: unknown = {}) => request<T>('POST', p, b),
  put: <T,>(p: string, b: unknown) => request<T>('PUT', p, b),
  patch: <T,>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T,>(p: string) => request<T>('DELETE', p),
};

export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '' && v !== false) u.set(k, String(v));
  const s = u.toString();
  return s ? `?${s}` : '';
}
