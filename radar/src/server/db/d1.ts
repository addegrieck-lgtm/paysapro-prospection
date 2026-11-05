import type { Db, RunResult, SqlValue, Statement } from './types';

/** Sous-ensemble de l'API Cloudflare D1 utilisé ici (évite une dépendance aux types Workers). */
export interface D1Like {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T>(): Promise<{ results: T[] }>;
      first<T>(): Promise<T | null>;
      run(): Promise<{ meta: { changes?: number; last_row_id?: number } }>;
    };
  };
  batch(statements: unknown[]): Promise<unknown>;
}

export function openD1(d1: D1Like): Db {
  const stmt = (sql: string, params?: SqlValue[]) => d1.prepare(sql).bind(...(params ?? []));
  return {
    async all<T>(sql: string, params?: SqlValue[]) {
      return (await stmt(sql, params).all<T>()).results;
    },
    async get<T>(sql: string, params?: SqlValue[]) {
      return (await stmt(sql, params).first<T>()) ?? undefined;
    },
    async run(sql: string, params?: SqlValue[]): Promise<RunResult> {
      const r = await stmt(sql, params).run();
      return { changes: r.meta.changes ?? 0, lastId: r.meta.last_row_id ?? 0 };
    },
    async batch(statements: Statement[]) {
      if (statements.length) await d1.batch(statements.map((s) => stmt(s.sql, s.params)));
    },
  };
}
