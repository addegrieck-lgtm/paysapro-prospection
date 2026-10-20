import type { FileStorage } from './storage';

/** Sous-ensemble de l'API Cloudflare KV utilisé. */
export interface KVLike {
  put(key: string, value: ArrayBuffer | Uint8Array, options?: { metadata?: unknown }): Promise<void>;
  getWithMetadata<M = unknown>(key: string, type: 'arrayBuffer'): Promise<{ value: ArrayBuffer | null; metadata: M | null }>;
  delete(key: string): Promise<void>;
}

/**
 * Fichiers privés dans Cloudflare KV (offre gratuite, sans carte bancaire ; 25 Mo maximum par fichier,
 * nos envois sont limités à 10 Mo). Les clés sont préfixées pour ne jamais croiser d'autres données.
 */
export function kvStorage(kv: KVLike): FileStorage {
  const k = (key: string) => `fichier:${key}`;
  return {
    async put(key, body, type) {
      await kv.put(k(key), body, { metadata: { type } });
    },
    async get(key) {
      const r = await kv.getWithMetadata<{ type?: string }>(k(key), 'arrayBuffer');
      if (!r.value) return null;
      return { body: new Uint8Array(r.value), type: r.metadata?.type ?? 'application/octet-stream' };
    },
    async delete(key) {
      await kv.delete(k(key));
    },
  };
}
