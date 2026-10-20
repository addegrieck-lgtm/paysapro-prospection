import type { FileStorage } from './storage';

/** Sous-ensemble de l'API Cloudflare R2 utilisé (évite une dépendance aux types Workers). */
export interface R2Like {
  put(key: string, value: Uint8Array, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer>; httpMetadata?: { contentType?: string } } | null>;
  delete(key: string): Promise<void>;
}

/** Stockage des fichiers privés dans un bucket R2 (non public). */
export function r2Storage(bucket: R2Like): FileStorage {
  return {
    async put(key, body, type) {
      await bucket.put(key, body, { httpMetadata: { contentType: type } });
    },
    async get(key) {
      const o = await bucket.get(key);
      if (!o) return null;
      return { body: new Uint8Array(await o.arrayBuffer()), type: o.httpMetadata?.contentType ?? 'application/octet-stream' };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
