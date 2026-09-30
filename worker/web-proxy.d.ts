/** Relais web (Cloudflare Worker) — déclaration de types pour les tests. */
export interface BackupStore {
  put(key: string, value: ArrayBuffer, options?: { metadata?: unknown }): Promise<void>;
  getWithMetadata(key: string, type: 'arrayBuffer'): Promise<{ value: ArrayBuffer | null; metadata: { savedAt?: string; size?: number } | null }>;
}
export interface RelayEnv {
  ALLOWED_ORIGINS?: string;
  BACKUPS?: BackupStore;
}
export function handle(request: Request, env?: RelayEnv, fetchImpl?: typeof fetch): Promise<Response>;
declare const worker: { fetch(request: Request, env: RelayEnv): Promise<Response> };
export default worker;
