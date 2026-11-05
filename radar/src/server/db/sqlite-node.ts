import { DatabaseSync } from 'node:sqlite';
import type { Db, RunResult, SqlValue, Statement } from './types';

/** Adaptateur SQLite intégré à Node.js (≥ 22.13). `path` = ':memory:' pour les tests. */
export function openNodeDb(path: string): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  if (path !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA busy_timeout = 5000');
  }
  const p = (params?: SqlValue[]) => params ?? [];
  return {
    async all<T>(sql: string, params?: SqlValue[]) {
      return db.prepare(sql).all(...p(params)) as T[];
    },
    async get<T>(sql: string, params?: SqlValue[]) {
      return db.prepare(sql).get(...p(params)) as T | undefined;
    },
    async run(sql: string, params?: SqlValue[]): Promise<RunResult> {
      const r = db.prepare(sql).run(...p(params));
      return { changes: Number(r.changes), lastId: Number(r.lastInsertRowid) };
    },
    async batch(statements: Statement[]) {
      db.exec('BEGIN');
      try {
        for (const s of statements) db.prepare(s.sql).run(...p(s.params));
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}
