// Composants d'enrichissement : badge de statut, provenance d'un champ, recherche web, progression de la file.
import { useState } from 'react';
import { ExternalLink, Pause, Play, RotateCcw, Search, X } from 'lucide-react';
import { Badge } from './ui/Card';
import { Button } from './ui/Button';
import { Dialog } from './ui/Feedback';
import { formatDateShort, formatDateTime, nf, useAction } from './common';
import { useApp, useQueueProgress } from '../app/context';
import { ENRICHMENT_BADGE, ENRICHMENT_LABEL } from '../domain/enrichment';
import { webSearchLinks } from '../domain/links';
import type { EnrichmentMode, EnrichmentStatus, FieldSource, Prospect, ProspectFilter } from '../domain/types';
import type { EnrichPriority } from '../data/repository';

const BATCH_SIZES = [10, 100, 500, 1000];
const PRIORITY_LABEL: Record<EnrichPriority, string> = {
  all: 'Jamais enrichies d’abord, puis meilleur score',
  no_phone: 'Entreprises sans téléphone',
  no_email: 'Entreprises sans e-mail',
  no_website: 'Entreprises sans site',
  priority: 'Prospects prioritaires (meilleur score)',
  new: 'Nouveaux prospects',
};

/**
 * Enrichissement par lots (§51–54) : 10, 100, 500 ou 1000 entreprises, par priorité, en mode Rapide / Normal /
 * Maximum contact. Traitement en arrière-plan : le CRM reste utilisable (progression « 245 / 1000 »).
 */
export function BatchEnrichDialog({ filter, onClose }: { filter: ProspectFilter; onClose: () => void }) {
  const { api, queue } = useApp();
  const run = useAction();
  const [size, setSize] = useState(100);
  const [priority, setPriority] = useState<EnrichPriority>('all');
  const [mode, setMode] = useState<EnrichmentMode>('normal');
  const [busy, setBusy] = useState(false);
  const launch = async () => {
    setBusy(true);
    const ids = await api.enrichmentBatch(filter, priority, size);
    const n = await run(() => queue.add(ids, false, mode));
    setBusy(false);
    if (n !== undefined) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="⚡ Enrichir un lot d’entreprises"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={launch} disabled={busy}>
            Enrichir {nf.format(size)} entreprise{size > 1 ? 's' : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Combien ?</legend>
          <div className="flex flex-wrap gap-2">
            {BATCH_SIZES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={size === s}
                onClick={() => setSize(s)}
                className={`min-h-11 rounded-xl border px-4 font-semibold tabular-nums ${size === s ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface hover:border-brand/50'}`}
              >
                {nf.format(s)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">En priorité</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as EnrichPriority)} className="min-h-11 w-full rounded-xl border border-line bg-surface px-3">
            {Object.entries(PRIORITY_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Mode</legend>
          {(
            [
              ['fast', 'Rapide', 'site, téléphone, e-mail avec un budget réduit'],
              ['normal', 'Normal', 'équilibre vitesse, couverture et précision'],
              ['max', 'Maximum contact', 'plus de stratégies et d’exploration du site, plusieurs numéros et e-mails'],
            ] as const
          ).map(([k, l, d]) => (
            <label key={k} className="flex min-h-11 items-center gap-2">
              <input type="radio" name="mode" checked={mode === k} onChange={() => setMode(k)} />
              <span>
                <span className="font-medium">{l}</span> <span className="text-sm text-muted">— {d}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-muted">
          Traitement en arrière-plan, une entreprise à la fois, dans le respect des limites des sources gratuites. Vous pouvez continuer à utiliser
          le CRM. Recherche automatique des coordonnées professionnelles disponibles : tous les numéros ne sont pas publics.
        </p>
      </div>
    </Dialog>
  );
}

export function EnrichmentBadge({ status, short }: { status: EnrichmentStatus; short?: boolean }) {
  const b = ENRICHMENT_BADGE[status];
  const label = short && status === 'partial' ? 'Partiel' : short && status === 'failed' ? 'Erreur' : ENRICHMENT_LABEL[status];
  return (
    <Badge tone={b.tone}>
      <span aria-hidden className="mr-1">
        {b.emoji}
      </span>
      {label}
    </Badge>
  );
}

const SOURCE_TYPE_LABEL: Record<FieldSource['type'], string> = {
  official_api: 'Données publiques',
  csv: 'Import CSV',
  manual: 'Manuel',
  web: 'Recherche web',
  import: 'Import',
};

const CONFIDENCE_LABEL: Record<FieldSource['confidence'], string> = { high: 'fiable', medium: 'à vérifier', low: 'faible' };

/** Ligne « Source : Données publiques · 29/09/2026 » sous une valeur. */
export function SourceLine({ source }: { source: FieldSource | undefined }) {
  if (!source) return null;
  const provider = source.type === 'official_api' ? 'API Recherche d’entreprises' : source.provider;
  return (
    <span className="mt-0.5 block text-xs text-muted" title={`${SOURCE_TYPE_LABEL[source.type]} — ${provider} — confiance ${CONFIDENCE_LABEL[source.confidence]}`}>
      Source : {source.type === 'manual' ? 'Manuel' : `${SOURCE_TYPE_LABEL[source.type]} (${provider})`} · {formatDateShort(source.at)}
      {source.confidence !== 'high' && <span className="text-warning"> · {CONFIDENCE_LABEL[source.confidence]}</span>}
    </span>
  );
}

/** « Rechercher sur le web » : recherches préparées, ouvertes dans un nouvel onglet (aucun scraping). */
export function WebSearchDialog({ open, onClose, prospect }: { open: boolean; onClose: () => void; prospect: Pick<Prospect, 'name' | 'tradeName' | 'city' | 'phone' | 'siret' | 'siren'> }) {
  const links = webSearchLinks(prospect);
  return (
    <Dialog open={open} onClose={onClose} title="Rechercher sur le web">
      <p className="mb-3 text-sm text-muted">
        Recherches préparées automatiquement. Ouvrez-les, vérifiez les informations, puis reportez ce que vous avez constaté avec « Compléter manuellement ». Rien n'est
        récupéré automatiquement sur ces sites.
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-line p-3 hover:border-brand/50">
              <Search className="h-5 w-5 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{l.label}</span>
                <span className="text-sm text-muted">{l.hint}</span>
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export function WebSearchButton({ prospect, size = 'md' }: { prospect: Pick<Prospect, 'name' | 'tradeName' | 'city' | 'phone' | 'siret' | 'siren'>; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" size={size} icon={<Search className="h-5 w-5" />} onClick={() => setOpen(true)}>
        Rechercher sur le web
      </Button>
      {open && <WebSearchDialog open onClose={() => setOpen(false)} prospect={prospect} />}
    </>
  );
}

/** Carte de progression de la file d'enrichissement (import, liste, bandeau). */
export function QueueProgressCard({ compact }: { compact?: boolean }) {
  const { queue } = useApp();
  const run = useAction();
  const p = useQueueProgress();
  if (!p.total) return null;
  const pct = p.total ? Math.round((p.processed / p.total) * 100) : 0;
  return (
    <div className={`rounded-2xl border border-line bg-surface ${compact ? 'p-3' : 'p-4'} shadow-card`} role="status" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">{p.running ? 'Enrichissement en cours' : p.pending ? 'Enrichissement en pause' : 'Enrichissement terminé'}</p>
        <span className="ml-auto text-sm tabular-nums text-muted">{pct} %</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm tabular-nums text-muted">
        {nf.format(p.processed)} / {nf.format(p.total)} entreprises analysées{p.current && p.running ? ` · ${p.current}` : ''}
      </p>
      <dl className={`mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 ${compact ? 'text-xs' : 'text-sm'}`}>
        {(
          [
            ['📞 Téléphones trouvés', p.phonesFound],
            ['🟢 Fortement associés', p.phonesVerified],
            ['✉ E-mails trouvés', p.emailsFound],
            ['🌐 Sites trouvés', p.websitesFound],
          ] as const
        ).map(([l, v]) => (
          <div key={l} className="rounded-lg bg-surface-2 px-2 py-1.5">
            <dt className="text-muted">{l}</dt>
            <dd className="text-base font-bold tabular-nums">{nf.format(v)}</dd>
          </div>
        ))}
      </dl>
      <p className={`mt-2 text-muted ${compact ? 'text-xs' : 'text-sm'}`}>
        Taux : {p.processed ? `${Math.round((p.withPhone / p.processed) * 1000) / 10} %`.replace('.', ',') : '—'} des entreprises analysées avec un nouveau téléphone ·{' '}
        {nf.format(p.enriched)} enrichies · {nf.format(p.partial)} partielles · {nf.format(p.noChange)} sans nouvelle donnée ·{' '}
        <span className={p.failed ? 'text-danger' : ''}>{nf.format(p.failed)} échecs</span>
      </p>
      <p className="mt-1 text-xs text-muted">Recherche automatique des coordonnées professionnelles disponibles dans les sources configurées — tous les numéros ne sont pas publics.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {p.running ? (
          <Button size="sm" variant="secondary" icon={<Pause className="h-4 w-4" />} onClick={() => queue.stop()}>
            Mettre en pause
          </Button>
        ) : (
          p.pending > 0 && (
            <Button size="sm" icon={<Play className="h-4 w-4" />} onClick={() => void queue.start()}>
              Reprendre
            </Button>
          )
        )}
        {p.failed > 0 && !p.running && (
          <Button size="sm" variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => run(() => queue.retryFailed(), 'Échecs relancés')}>
            Relancer les échecs ({p.failed})
          </Button>
        )}
        {p.pending > 0 && (
          <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => run(() => queue.cancel(), 'File annulée')}>
            Annuler
          </Button>
        )}
        {!p.pending && (
          <Button size="sm" variant="ghost" onClick={() => run(() => queue.clearFinished())}>
            Masquer
          </Button>
        )}
      </div>
    </div>
  );
}

export function LastEnrichment({ at }: { at: string | null }) {
  if (!at) return <span className="text-muted">Jamais enrichi</span>;
  return <span className="text-muted">Dernier enrichissement : {formatDateTime(at).replace(' ', ' à ')}</span>;
}
