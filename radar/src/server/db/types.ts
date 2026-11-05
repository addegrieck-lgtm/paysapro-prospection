/**
 * Couche d'accès aux données, indépendante de l'environnement d'exécution :
 * SQLite intégré à Node (serveur classique, tests) ou Cloudflare D1 (Workers).
 * Toutes les requêtes utilisent des paramètres positionnels « ? » (jamais de concaténation de valeurs).
 */
export type SqlValue = string | number | null;

export interface Statement {
  sql: string;
  params?: SqlValue[];
}

export interface RunResult {
  changes: number;
  lastId: number;
}

export interface Db {
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | undefined>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  /** Exécute plusieurs écritures de façon atomique (tout ou rien). */
  batch(statements: Statement[]): Promise<void>;
}
