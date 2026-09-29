// Cache clé → valeur dans IndexedDB (réponses d'API publiques), avec durée de validité.
import type { DB } from './db';

export interface KeyValueCache {
  get(key: string, maxAgeDays: number): Promise<unknown | undefined>;
  set(key: string, data: unknown): Promise<void>;
}

export function dbCache(db: DB, store: 'company_enrichment_cache' | 'data_cache'): KeyValueCache {
  return {
    async get(key, maxAgeDays) {
      const entry = await db.get(store, key);
      if (!entry) return undefined;
      return Date.now() - new Date(entry.fetchedAt).getTime() < maxAgeDays * 86_400_000 ? entry.data : undefined;
    },
    async set(key, data) {
      await db.put(store, { key, data, fetchedAt: new Date().toISOString() });
    },
  };
}

/** Cache en mémoire (tests, ou absence de base). */
export function memoryCache(): KeyValueCache {
  const map = new Map<string, { data: unknown; at: number }>();
  return {
    async get(key, maxAgeDays) {
      const e = map.get(key);
      return e && Date.now() - e.at < maxAgeDays * 86_400_000 ? e.data : undefined;
    },
    async set(key, data) {
      map.set(key, { data, at: Date.now() });
    },
  };
}
