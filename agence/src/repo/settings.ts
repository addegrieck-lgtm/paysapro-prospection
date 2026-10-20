import type { Db } from '../db/types';
import { mergeSettings, type Settings } from '../domain/settings';

let cache: { at: number; value: Settings; db: Db } | null = null;

export async function getSettings(db: Db): Promise<Settings> {
  if (cache && cache.db === db && Date.now() - cache.at < 5000) return cache.value;
  const row = await db.get<{ value: string }>("SELECT value FROM settings WHERE key = 'site'");
  let parsed: unknown = {};
  try {
    parsed = row ? JSON.parse(row.value) : {};
  } catch {
    parsed = {};
  }
  const value = mergeSettings(parsed);
  cache = { at: Date.now(), value, db };
  return value;
}

export async function saveSettings(db: Db, s: Settings): Promise<void> {
  await db.run("INSERT INTO settings (key, value) VALUES ('site', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(s)]);
  cache = null;
}

/**
 * Numérotation chronologique continue et sans doublon : incrément atomique (une seule instruction SQL),
 * fiable même avec plusieurs requêtes simultanées. Une série par préfixe et par année (ex. F-2026-0001).
 */
export async function nextNumber(db: Db, prefix: string, year: number): Promise<string> {
  const name = `${prefix}-${year}`;
  const row = await db.get<{ value: number }>(
    `INSERT INTO counters (name, value) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET value = counters.value + 1 RETURNING value`,
    [name],
  );
  return `${prefix}-${year}-${String(row!.value).padStart(4, '0')}`;
}

export async function audit(db: Db, userId: number | null, action: string, entity?: string, entityId?: string | number): Promise<void> {
  await db.run('INSERT INTO audit_log (user_id, action, entity, entity_id, created_at) VALUES (?, ?, ?, ?, ?)', [
    userId,
    action,
    entity ?? null,
    entityId == null ? null : String(entityId),
    new Date().toISOString(),
  ]);
}
