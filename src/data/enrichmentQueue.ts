// EnrichmentQueue : enrichissement progressif de milliers de prospects, sans bloquer l'interface.
//
//   Import → Validation → Déduplication → File d'attente → Enrichissement progressif → Base → Statistiques
//
// • La file est ENREGISTRÉE (table enrichment_queue) : fermer l'onglet ne perd rien, elle reprend au lancement.
// • Un seul prospect traité à la fois ; toutes les requêtes passent par le limiteur de débit partagé (4 req/s).
// • États : pending → processing → completed | partial | failed. Les échecs peuvent être relancés.
// • Erreur réseau / API indisponible : jusqu'à 3 essais par prospect (en plus des reprises HTTP), puis « failed ».
import type { EnrichmentJob } from '../domain/types';
import type { ProspectsApi } from './repository';
import type { CompanyDataProvider } from '../providers/company/CompanyDataProvider';
import { ProviderError } from '../providers/http';
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
}

const MAX_ATTEMPTS = 3;

export function summarize(jobs: EnrichmentJob[], running: boolean, current: string | null = null): QueueProgress {
  const count = (f: (j: EnrichmentJob) => boolean) => jobs.filter(f).length;
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
  };
}

export class EnrichmentQueue {
  private api: ProspectsApi;
  private provider: CompanyDataProvider;
  private controller: AbortController | null = null;
  private listeners = new Set<(p: QueueProgress) => void>();
  private progress: QueueProgress = summarize([], false);

  constructor(api: ProspectsApi, provider: CompanyDataProvider) {
    this.api = api;
    this.provider = provider;
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
  async add(ids: string[], force = false): Promise<number> {
    const n = await this.api.enqueueEnrichment(ids, force);
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

  private current: Promise<QueueProgress> | null = null;

  /** Traite la file jusqu'à épuisement (ou interruption). Si déjà en cours, attend la fin du traitement en cours. */
  start(): Promise<QueueProgress> {
    if (!this.current) this.current = this.loop().finally(() => (this.current = null));
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
        const batch = jobs.filter((j) => j.status === 'pending').slice(0, ENRICHMENT_CONFIG.batchSize);
        if (!batch.length) break;
        for (const job of batch) {
          if (controller.signal.aborted) break;
          const row = (await this.api.allRows()).find((r) => r.id === job.prospectId);
          this.publish({ ...summarize(await this.api.queueJobs(), true, row?.name ?? null) });
          await this.api.saveJob({ ...job, status: 'processing', attempts: job.attempts + 1 });
          const next = await this.process(job, controller.signal);
          await this.api.saveJob(next);
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
      const r = await this.api.enrichProspect(job.prospectId, this.provider, { force: job.force, signal });
      if (r.skipped) return { ...job, attempts, status: 'completed', outcome: 'no_change', error: null };
      if (r.error) {
        // Indisponibilité temporaire : on réessaiera (jusqu'à MAX_ATTEMPTS)
        return { ...job, attempts, status: attempts < MAX_ATTEMPTS ? 'pending' : 'failed', outcome: 'error', error: r.error };
      }
      const outcome = r.application!.outcome;
      if (outcome === 'not_found' || outcome === 'ambiguous') return { ...job, attempts, status: 'failed', outcome, error: r.application!.prospect.enrichmentError };
      return { ...job, attempts, status: outcome === 'partial' ? 'partial' : 'completed', outcome: outcome === 'failed' ? 'error' : outcome, error: null };
    } catch (e) {
      if (e instanceof ProviderError && e.kind === 'aborted') return { ...job, status: 'pending' };
      console.error('[file d’enrichissement]', job.prospectId, e);
      return { ...job, attempts, status: 'failed', outcome: 'error', error: e instanceof Error ? e.message : 'Erreur inconnue' };
    }
  }
}
