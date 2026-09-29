/** Relais web (Cloudflare Worker) — déclaration de types pour les tests. */
export function handle(request: Request, env?: { ALLOWED_ORIGINS?: string }, fetchImpl?: typeof fetch): Promise<Response>;
declare const worker: { fetch(request: Request, env: { ALLOWED_ORIGINS?: string }): Promise<Response> };
export default worker;
