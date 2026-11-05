import type { Db } from '../db/types';
import type { FetchLike, Http } from '../lib/http';
import type { AppSettings } from '../services/settings';

/** Secrets disponibles (variables d'environnement / secrets Cloudflare). Jamais stockés en base ni renvoyés au client. */
export interface Secrets {
  INSEE_API_KEY?: string;
  INPI_USERNAME?: string;
  INPI_PASSWORD?: string;
  PAPPERS_API_TOKEN?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface ConnectorContext {
  db: Db;
  fetch: FetchLike;
  http: (opts?: { minIntervalMs?: number; timeoutMs?: number }) => Http;
  secrets: Secrets;
  settings: AppSettings;
  departments: string[];
  config: Record<string, unknown>; // configuration non secrète de la source (sources.config)
  now: () => Date;
}

export interface ChunkResult {
  done: boolean;
  cursor: unknown;
  fetched: number;
  created: number;
  updated: number;
  errors: string[];
  /** Mise à jour de la configuration persistante de la source (ex. date de dernière annonce traitée). */
  configPatch?: Record<string, unknown>;
}

export interface ConnectorMeta {
  id: string;
  label: string;
  description: string;
  official: boolean;
  /** Variables secrètes nécessaires ; vide = fonctionne sans clé. */
  requiredSecrets: (keyof Secrets)[];
  defaultEnabled: boolean;
  /** Ce qu'apporte la source. */
  provides: string[];
  /** Conditions de réutilisation (licence, CGU). */
  license: string;
  termsUrl: string;
  docsUrl: string;
  quotas: string;
  /** Procédure d'obtention de la clé, le cas échéant. */
  keyProcedure?: string;
  limitations: string[];
  /** La source exige une configuration manuelle (URL de flux, fichier…) avant d'être utile. */
  needsConfig?: boolean;
}

export interface Connector extends ConnectorMeta {
  /** Tâches de la veille quotidienne (ex. un code NAF × département). */
  planTasks(ctx: ConnectorContext): Promise<string[]>;
  /** Traite un lot borné d'une tâche à partir de son curseur ; idempotent. */
  runChunk(ctx: ConnectorContext, task: string, cursor: unknown): Promise<ChunkResult>;
}

export const emptyChunk = (cursor: unknown = null, done = true): ChunkResult => ({ done, cursor, fetched: 0, created: 0, updated: 0, errors: [] });
