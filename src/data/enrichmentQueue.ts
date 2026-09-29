// EnrichmentQueue : enrichissement progressif de milliers de prospects, sans bloquer l'interface.
//
//   Import → Validation → Déduplication → File d'attente → EnrichmentEngine → Base → Statistiques
//
// • La file est ENREGISTRÉE (table enrichment_queue) : fermer l'onglet ne perd rien, elle reprend au lancement.
// • Un prospect à la fois ; chaque source a son propre limiteur de débit (API officielle, OSM, relais web).
// • États : pending → processing → completed | partial | failed, avec retry_count (attempts), last_error (error)
//   et next_retry_at (nextRetryAt) : une erreur temporaire est réessayée plus tard (1 min, 2 min, 4 min), 3 fois.
import type { EnrichmentJob } from '../domain/types';
import type { ProspectsApi } from './repository';
import type { EnrichmentEngine } from './enrichmentEngine';
import { ProviderError, sleep } from '../providers/http';
import { ENRICHMENT_CONFIG } from '../config';

export interface QueueProgress {
  running: boolean;
  total: number;
  processed: number;
  enriched: number;
  partial: number;
  noChange: number;
  failed: number;
  pending: number;
  current: string | null;
  // Résultats cumulés de la file (mode « Maximiser les téléphones »)
  phonesFound: number;
  phonesVerified: number;
  emailsFound: number;
  websitesFound: number;
  /** Prospects de la file ayant au moins un téléphone après traitement */
  withPhone: number;
  maxPhones: boolean;
}

const MAX_ATTEMPTS = 3;

export function summarize(jobs: EnrichmentJob[], running: boolean, current: string | null = null): QueueProgress {
  const count = (f: (j: EnrichmentJob) => boolean) => jobs.filter(f).length;
  const sum = (k: 'phones' | 'verifiedPhones' | 'emails' | 'websites') => jobs.reduce((s, j) => s + Math.max(0, j.result?.[k] ?? 0), 0);
  const pending = count((j) => j.status === 'pending' || j.status === 'processing');
  return {
    running,
    total: jobs.length,
    processed: jobs.length - pending,
    enriched: count((j) => j.outcome === 'enriched'),
    partial: count((j) => j.outcome === 'partial'),
    noChange: count((j) => j.outcome === 'no_change'),
    failed: count((j) => j.status === 'failed'),
    pending,
    current,
    phonesFound: sum('phones'),
    phonesVerified: sum('verifiedPhones'),
    emailsFound: sum('emails'),
    websitesFound: sum('websites'),
    withPhone: count((j) => (j.result?.phones ?? 0) > 0),
    maxPhones: jobs.some((j) => j.maxPhones),
  };
}

/**
 * Un seul traitement de la file à la fois, même avec plusieurs onglets ouverts (Web Locks API).
 * Si un autre onglet traite déjà la file, celui-ci ne fait rien (l'autre onglet s'en charge).
 */
async function withQueueLock<T>(fn: () => Promise<T>, busy: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return fn();
  return locks.request('paysapro-enrichment-queue', { ifAvailable: true }, (lock) => (lock ? fn() : busy()));
}

export class EnrichmentQueue {
  private api: ProspectsApi;
  private engine: EnrichmentEngine;
  private controller: AbortController | null = null;
  private listeners = new Set<(p: QueueProgress) => void>();
  private progress: QueueProgress = summarize([], false);
  private current: Promise<QueueProgress> | null = null;
  /** Attente maximale avant un nouvel essai différé (réduite dans les tests) */
  retryDelayMs = (attempt: number) => 60_000 * 2 ** Math.max(0, attempt - 1);

  constructor(api: ProspectsApi, engine: EnrichmentEngine) {
    this.api = api;
    this.engine = engine;
  }

  get running(): boolean {
    return !!this.controller;
  }

  subscribe(fn: (p: QueueProgress) => void): () => void {
    this.listeners.add(fn);
    fn(this.progress);
    return () => this.listeners.delete(fn);
  }

  getProgress(): QueueProgress {
    return this.progress;
  }

  private publish(p: QueueProgress) {
    this.progress = p;
    this.listeners.forEach((l) => l(p));
  }

  async refresh(): Promise<QueueProgress> {
    const p = summarize(await this.api.queueJobs(), this.running, this.progress.current);
    this.publish(p);
    return p;
  }

  /** Ajoute des prospects et démarre le traitement. */
  async add(ids: string[], force = false, maxPhones = false): Promise<number> {
    const n = await this.api.enqueueEnrichment(ids, force, maxPhones);
    await this.refresh();
    void this.start();
    return n;
  }

  async retryFailed(): Promise<number> {
    const n = await this.api.retryFailedJobs();
    await this.refresh();
    void this.start();
    return n;
  }

  stop(): void {
    this.controller?.abort();
  }

  async cancel(): Promise<void> {
    this.stop();
    await this.api.cancelPendingJobs();
    await this.refresh();
  }

  async clearFinished(): Promise<void> {
    await this.api.clearFinishedJobs();
    await this.refresh();
  }

  /** Traite la file jusqu'à épuisement (ou interruption). Si déjà en cours, attend la fin du traitement en cours. */
  start(): Promise<QueueProgress> {
    if (!this.current) this.current = withQueueLock(() => this.loop(), () => this.refresh()).finally(() => (this.current = null));
    return this.current;
  }

  private async loop(): Promise<QueueProgress> {
    const controller = new AbortController();
    this.controller = controller;
    try {
      // Tâches restées « processing » (onglet fermé en plein traitement) : on les reprend.
      for (const j of (await this.api.queueJobs()).filter((x) => x.status === 'processing')) await this.api.saveJob({ ...j, status: 'pending' });
      for (;;) {
        if (controller.signal.aborted) break;
        const jobs = await this.api.queueJobs();
        const pending = jobs.filter((j) => j.status === 'pending');
        if (!pending.length) break;
        const now = Date.now();
        const ready = pending.filter((j) => !j.nextRetryAt || new Date(j.nextRetryAt).getTime() <= now).slice(0, ENRICHMENT_CONFIG.batchSize);
        if (!ready.length) {
          // Uniquement des nouveaux essais différés : on attend le plus proche (sans bloquer l'interface)
          const next = Math.min(...pending.map((j) => new Date(j.nextRetryAt!).getTime()));
          await sleep(Math.max(200, Math.min(60_000, next - now)), controller.signal).catch(() => undefined);
          continue;
        }
        const names = new Map((await this.api.allRows()).map((r) => [r.id, r.name]));
        for (const job of ready) {
          if (controller.signal.aborted) break;
          const all = await this.api.queueJobs();
          // Tâche déjà prise / annulée entre-temps : on ne la traite jamais deux fois
          if (all.find((j) => j.id === job.id)?.status !== 'pending') continue;
          this.publish(summarize(all, true, names.get(job.prospectId) ?? null));
          await this.api.saveJob({ ...job, status: 'processing' });
          await this.api.saveJob(await this.process(job, controller.signal));
        }
      }
    } finally {
      this.controller = null;
      this.progress = { ...this.progress, current: null };
      await this.refresh();
    }
    return this.progress;
  }

  private async process(job: EnrichmentJob, signal: AbortSignal): Promise<EnrichmentJob> {
    const attempts = job.attempts + 1;
    try {
      const r = await this.engine.enrichCompany(job.prospectId, { force: job.force, maxPhones: job.maxPhones, signal });
      if (r.error && !r.found.phones && !r.found.emails && !r.found.websites && attempts < MAX_ATTEMPTS) {
        // Indisponibilité temporaire : nouvel essai différé
        return { ...job, attempts, status: 'pending', outcome: 'error', error: r.error, nextRetryAt: new Date(Date.now() + this.retryDelayMs(attempts)).toISOString(), result: r.found };
      }
      if (r.outcome === 'not_found' || r.outcome === 'ambiguous') {
        return { ...job, attempts, status: 'failed', outcome: r.outcome, error: r.prospect?.enrichmentError ?? null, nextRetryAt: null, result: r.found };
      }
      if (r.error && !r.found.phones && !r.found.emails && !r.found.websites) {
        return { ...job, attempts, status: 'failed', outcome: 'error', error: r.error, nextRetryAt: null, result: r.found };
      }
      const outcome = r.outcome === 'skipped' ? 'no_change' : r.outcome === 'failed' ? 'error' : r.outcome;
      return { ...job, attempts, status: outcome === 'partial' ? 'partial' : 'completed', outcome, error: null, nextRetryAt: null, result: r.found };
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'aborted') return { ...job, status: 'pending' };
      console.error('[file d’enrichissement]', job.prospectId, e);
      return { ...job, attempts, status: 'failed', outcome: 'error', error: e instanceof Error ? e.message : 'Erreur inconnue', nextRetryAt: null };
    }
  }
}
