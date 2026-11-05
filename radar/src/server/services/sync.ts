/**
 * Orchestrateur de veille.
 *
 *  startRun()  planifie une exécution : une ou plusieurs tâches par source activée.
 *  tick()      avance les tâches par lots bornés (temps et nombre de requêtes), à tour de rôle entre sources.
 *              Chaque lot enregistre son curseur : une interruption (fin d'invocation, panne) reprend au même point.
 *              Une tâche en échec est retentée 3 fois puis marquée « erreur » ; les autres sources continuent.
 *  Quand toutes les tâches sont terminées : réanalyse des entreprises modifiées, alertes des recherches
 *  enregistrées, rapport d'exécution. Statut « partiel » dès qu'une source activée n'a pas pu être interrogée.
 */
import type { Db } from '../db/types';
import { connectorById, CONNECTORS } from '../connectors/registry';
import type { ConnectorContext, Secrets } from '../connectors/types';
import { createHttp, type FetchLike } from '../lib/http';
import { getSettings } from './settings';
import { processAnalysisQueue } from './analysis';
import { raiseAlert } from './alerts';
import { checkSavedSearches } from './search';

export interface SyncEnv {
  db: Db;
  fetch: FetchLike;
  secrets: Secrets;
  now?: () => Date;
  /** Attente entre requêtes / nouvelles tentatives (injectable pour les tests). */
  sleep?: (ms: number) => Promise<void>;
}

const iso = () => new Date().toISOString();
const MAX_ATTEMPTS = 3;

export async function activeRun(db: Db) {
  return db.get<{ id: number; trigger: string; started_at: string }>("SELECT id, trigger, started_at FROM sync_runs WHERE status = 'running' ORDER BY id DESC LIMIT 1");
}

/** Démarre une veille (toutes les sources activées, ou une seule). Retourne l'exécution en cours si elle existe. */
export async function startRun(env: SyncEnv, trigger: string, onlySource?: string): Promise<{ runId: number; alreadyRunning: boolean }> {
  const running = await activeRun(env.db);
  if (running) return { runId: running.id, alreadyRunning: true };
  const settings = await getSettings(env.db);
  const run = await env.db.get<{ id: number }>("INSERT INTO sync_runs (trigger, status, started_at) VALUES (?, 'running', ?) RETURNING id", [trigger, iso()]);
  const runId = run!.id;
  const sources = await env.db.all<{ id: string; enabled: number; config: string }>('SELECT id, enabled, config FROM sources');
  for (const c of CONNECTORS) {
    if (onlySource && c.id !== onlySource) continue;
    const src = sources.find((s) => s.id === c.id);
    if (!src?.enabled) continue;
    const missing = c.requiredSecrets.filter((k) => !env.secrets[k]);
    if (missing.length) {
      await env.db.run("INSERT INTO sync_jobs (run_id, source_id, task, status, error_log, finished_at) VALUES (?, ?, 'configuration', 'skipped', ?, ?)", [runId, c.id, `Clé manquante : ${missing.join(', ')}. Source non interrogée.`, iso()]);
      await env.db.run("UPDATE sources SET last_status = 'skipped', last_error = ?, last_sync_at = ? WHERE id = ?", [`Clé manquante : ${missing.join(', ')}`, iso(), c.id]);
      continue;
    }
    try {
      const ctx = await buildContext(env, c.id, settings, runId);
      const tasks = await c.planTasks(ctx);
      if (!tasks.length) {
        await env.db.run("INSERT INTO sync_jobs (run_id, source_id, task, status, error_log, finished_at) VALUES (?, ?, 'aucune', 'skipped', ?, ?)", [runId, c.id, c.needsConfig ? 'Source à configurer (aucun flux ou paramètre défini).' : 'Aucune tâche à exécuter.', iso()]);
        continue;
      }
      await env.db.batch(tasks.map((t) => ({ sql: "INSERT INTO sync_jobs (run_id, source_id, task, status) VALUES (?, ?, ?, 'pending')", params: [runId, c.id, t] })));
    } catch (e) {
      await env.db.run("INSERT INTO sync_jobs (run_id, source_id, task, status, errors, error_log, finished_at) VALUES (?, ?, 'planification', 'error', 1, ?, ?)", [runId, c.id, (e as Error).message, iso()]);
    }
  }
  return { runId, alreadyRunning: false };
}

async function buildContext(env: SyncEnv, sourceId: string, settings: Awaited<ReturnType<typeof getSettings>>, runId: number | null, budget?: { remaining: number }): Promise<ConnectorContext> {
  const row = await env.db.get<{ config: string }>('SELECT config FROM sources WHERE id = ?', [sourceId]);
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(row?.config ?? '{}');
  } catch {
    config = {};
  }
  return {
    db: env.db,
    fetch: env.fetch,
    http: (o) => createHttp({ fetch: env.fetch, budget, sleep: env.sleep, ...o }),
    secrets: env.secrets,
    settings,
    departments: settings.sync.departments,
    config: { ...config, __runId: runId },
    now: env.now ?? (() => new Date()),
  };
}

export interface TickResult {
  runId: number | null;
  chunks: number;
  finished: boolean;
  analysed: number;
  stoppedBy: 'temps' | 'requetes' | 'termine' | 'rien';
}

/** Avance la veille en cours dans la limite de temps et de requêtes fixée. */
export async function tick(env: SyncEnv, opts: { maxMs?: number; maxRequests?: number } = {}): Promise<TickResult> {
  const t0 = Date.now();
  const maxMs = opts.maxMs ?? 20_000;
  const budget = { remaining: opts.maxRequests ?? 40 };
  const run = await activeRun(env.db);
  if (!run) return { runId: null, chunks: 0, finished: false, analysed: 0, stoppedBy: 'rien' };
  const settings = await getSettings(env.db);
  const done = new Set<number>();
  let lastSource: string | null = null;
  let chunks = 0;
  let stoppedBy: TickResult['stoppedBy'] = 'termine';
  for (;;) {
    if (Date.now() - t0 > maxMs) {
      stoppedBy = 'temps';
      break;
    }
    if (budget.remaining <= 0) {
      stoppedBy = 'requetes';
      break;
    }
    const pending = await env.db.all<{ id: number; source_id: string; task: string; cursor: string | null; attempts: number }>(
      "SELECT id, source_id, task, cursor, attempts FROM sync_jobs WHERE run_id = ? AND status IN ('pending','running') ORDER BY attempts, id",
      [run.id],
    );
    if (!pending.length) break;
    // Tour de rôle : alterne les sources et ne reprend une tâche qu'après avoir servi les autres
    const candidates = pending.filter((j) => !done.has(j.id));
    let job = candidates.find((j) => j.source_id !== lastSource) ?? candidates[0];
    if (!job) {
      done.clear();
      job = pending.find((j) => j.source_id !== lastSource) ?? pending[0]!;
    }
    lastSource = job.source_id;
    done.add(job.id);
    const connector = connectorById(job.source_id);
    if (!connector) {
      await env.db.run("UPDATE sync_jobs SET status = 'error', error_log = 'Connecteur inconnu', finished_at = ? WHERE id = ?", [iso(), job.id]);
      continue;
    }
    const ctx = await buildContext(env, job.source_id, settings, run.id, budget);
    const start = Date.now();
    await env.db.run("UPDATE sync_jobs SET status = 'running', started_at = COALESCE(started_at, ?) WHERE id = ?", [iso(), job.id]);
    try {
      const cursor = job.cursor ? JSON.parse(job.cursor) : null;
      const r = await connector.runChunk(ctx, job.task, cursor);
      chunks++;
      const log = r.errors.length ? r.errors.slice(0, 20).join('\n') : null;
      await env.db.run(
        `UPDATE sync_jobs SET cursor = ?, fetched = fetched + ?, created = created + ?, updated = updated + ?, errors = errors + ?,
         error_log = CASE WHEN ? IS NULL THEN error_log ELSE substr(COALESCE(error_log || char(10), '') || ?, -4000) END,
         duration_ms = duration_ms + ?, status = ?, finished_at = ? WHERE id = ?`,
        [r.cursor === null || r.cursor === undefined ? null : JSON.stringify(r.cursor), r.fetched, r.created, r.updated, r.errors.length, log, log, Date.now() - start, r.done ? 'success' : 'running', r.done ? iso() : null, job.id],
      );
      if (r.configPatch) {
        const row = await env.db.get<{ config: string }>('SELECT config FROM sources WHERE id = ?', [job.source_id]);
        const cfg = { ...JSON.parse(row?.config ?? '{}'), ...r.configPatch };
        await env.db.run('UPDATE sources SET config = ? WHERE id = ?', [JSON.stringify(cfg), job.source_id]);
      }
      if (r.done) await env.db.run("UPDATE sources SET last_sync_at = ?, last_success_at = ?, last_status = 'success', last_error = NULL WHERE id = ?", [iso(), iso(), job.source_id]);
    } catch (e) {
      const err = e as Error;
      if (err.name === 'BudgetExhausted') {
        await env.db.run('UPDATE sync_jobs SET duration_ms = duration_ms + ? WHERE id = ?', [Date.now() - start, job.id]);
        stoppedBy = 'requetes';
        break;
      }
      const attempts = job.attempts + 1;
      const final = attempts >= MAX_ATTEMPTS;
      await env.db.run(
        `UPDATE sync_jobs SET attempts = ?, errors = errors + 1, status = ?, duration_ms = duration_ms + ?, finished_at = ?,
         error_log = substr(COALESCE(error_log || char(10), '') || ?, -4000) WHERE id = ?`,
        [attempts, final ? 'error' : 'pending', Date.now() - start, final ? iso() : null, `Tentative ${attempts} : ${err.message}`, job.id],
      );
      await env.db.run("UPDATE sources SET last_sync_at = ?, last_status = 'error', last_error = ? WHERE id = ?", [iso(), err.message.slice(0, 500), job.source_id]);
      if (final) await raiseAlert(env.db, { type: 'source_en_erreur', severity: 'attention', title: `Source en erreur : ${connector.label}`, message: `${job.task} — ${err.message}`, dedupeKey: `srcerr:${run.id}:${job.id}`, runId: run.id }, settings);
    }
  }

  // Réanalyse des entreprises modifiées (par lots, dans le temps restant)
  let analysed = 0;
  const remainingMs = Math.max(2_000, maxMs - (Date.now() - t0));
  analysed = await processAnalysisQueue(env.db, settings, { maxMs: remainingMs, runId: run.id });
  const left = await env.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM sync_jobs WHERE run_id = ? AND status IN ('pending','running')", [run.id]);
  const queue = await env.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM analysis_queue');
  let finished = false;
  if (!left?.n && !queue?.n) {
    await finishRun(env.db, run.id);
    finished = true;
    stoppedBy = 'termine';
  }
  return { runId: run.id, chunks, finished, analysed, stoppedBy };
}

export async function finishRun(db: Db, runId: number): Promise<void> {
  const jobs = await db.all<{ source_id: string; status: string; fetched: number; created: number; updated: number; errors: number; duration_ms: number; error_log: string | null }>('SELECT source_id, status, fetched, created, updated, errors, duration_ms, error_log FROM sync_jobs WHERE run_id = ?', [runId]);
  const bySource: Record<string, { status: string; fetched: number; created: number; updated: number; errors: number; duration_ms: number; problems: string[] }> = {};
  for (const j of jobs) {
    const s = (bySource[j.source_id] ??= { status: 'success', fetched: 0, created: 0, updated: 0, errors: 0, duration_ms: 0, problems: [] });
    s.fetched += j.fetched;
    s.created += j.created;
    s.updated += j.updated;
    s.errors += j.errors;
    s.duration_ms += j.duration_ms;
    if (j.status === 'error') s.status = 'error';
    else if (j.status === 'skipped' && s.status === 'success') s.status = 'skipped';
    if ((j.status === 'error' || j.status === 'skipped') && j.error_log) s.problems.push(j.error_log.split('\n').slice(-1)[0]!);
  }
  const statuses = Object.values(bySource).map((s) => s.status);
  const status = !statuses.length ? 'error' : statuses.every((s) => s === 'error') ? 'error' : statuses.some((s) => s !== 'success') ? 'partial' : 'success';
  await checkSavedSearches(db, runId);
  await db.run('UPDATE sync_runs SET status = ?, finished_at = ?, summary = ? WHERE id = ?', [status, iso(), JSON.stringify(bySource), runId]);
}

/** Exécute une veille complète (ligne de commande / serveur Node, sans limite d'invocation). */
export async function runToCompletion(env: SyncEnv, trigger = 'cli', onlySource?: string, log: (m: string) => void = () => {}): Promise<number> {
  const { runId } = await startRun(env, trigger, onlySource);
  for (;;) {
    const r = await tick(env, { maxMs: 60_000, maxRequests: 400 });
    log(`Lots traités : ${r.chunks}, entreprises analysées : ${r.analysed}${r.finished ? ' — terminé' : ''}`);
    if (r.finished || r.runId === null) break;
  }
  return runId;
}

/** Interrompt la veille en cours (les tâches restantes sont marquées interrompues). */
export async function cancelRun(db: Db): Promise<boolean> {
  const run = await activeRun(db);
  if (!run) return false;
  await db.run("UPDATE sync_jobs SET status = 'error', error_log = substr(COALESCE(error_log || char(10), '') || 'Interrompue par l''utilisateur', -4000), finished_at = ? WHERE run_id = ? AND status IN ('pending','running')", [iso(), run.id]);
  await finishRun(db, run.id);
  return true;
}
