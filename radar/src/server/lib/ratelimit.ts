import type { Db } from '../db/types';

/**
 * Limitation de débit à fenêtre fixe, stockée en base (fonctionne aussi sur plusieurs instances).
 * Retourne true si l'action est autorisée. La clé ne doit pas contenir d'IP en clair (utiliser un hachage).
 */
export async function hitRateLimit(db: Db, key: string, limit: number, windowSeconds: number, now = Date.now()): Promise<boolean> {
  const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
  const row = await db.get<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1)
     ON CONFLICT(key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start = excluded.window_start THEN rate_limits.count + 1 ELSE 1 END,
       window_start = excluded.window_start
     RETURNING count`,
    [key, windowStart],
  );
  return (row?.count ?? 1) <= limit;
}

/** Nettoyage occasionnel des compteurs périmés. */
export async function purgeRateLimits(db: Db, olderThanSeconds = 86_400, now = Date.now()): Promise<void> {
  await db.run('DELETE FROM rate_limits WHERE window_start < ?', [Math.floor(now / 1000) - olderThanSeconds]);
}
