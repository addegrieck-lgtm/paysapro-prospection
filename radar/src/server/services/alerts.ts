import type { Db } from '../db/types';
import { ALERT_TYPES, getSettings, type AppSettings } from './settings';

export type Severity = 'info' | 'positif' | 'attention' | 'critique';

export interface AlertInput {
  type: keyof typeof ALERT_TYPES | string;
  severity?: Severity;
  companyId?: number | null;
  title: string;
  message?: string | null;
  dedupeKey: string;
  runId?: number | null;
}

/** Crée une alerte si son type est activé et si elle n'existe pas déjà (clé de déduplication). */
export async function raiseAlert(db: Db, a: AlertInput, settings?: AppSettings): Promise<boolean> {
  const s = settings ?? (await getSettings(db));
  if (s.alerts.enabled[a.type] === false) return false;
  const r = await db.run(
    `INSERT OR IGNORE INTO alerts (type, severity, company_id, title, message, dedupe_key, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.type, a.severity ?? 'info', a.companyId ?? null, a.title, a.message ?? null, a.dedupeKey, a.runId ?? null, new Date().toISOString()],
  );
  return r.changes > 0;
}

export async function listAlerts(db: Db, opts: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number }) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.unreadOnly) where.push('a.read_at IS NULL');
  if (opts.type) {
    where.push('a.type = ?');
    params.push(opts.type);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await db.all(
    `SELECT a.*, c.name AS company_name, c.siren FROM alerts a LEFT JOIN companies c ON c.id = a.company_id ${w} ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...params, Math.min(opts.limit ?? 50, 200), opts.offset ?? 0],
  );
  const total = (await db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM alerts a ${w}`, params))?.n ?? 0;
  const unread = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM alerts WHERE read_at IS NULL'))?.n ?? 0;
  return { rows, total, unread };
}
