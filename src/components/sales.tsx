// Briques de l'Assistant commercial : carte de réponse (copier / utiliser), préparation commerciale.
import type { ReactNode } from 'react';
import { ArrowRight, CornerDownLeft, TriangleAlert } from 'lucide-react';
import { Badge } from './ui/Card';
import { CopyButton } from './common';
import type { Tone } from '../domain/referentials';
import type { Readiness, ReadinessLevel } from '../domain/sales';

const READINESS_TONE: Record<ReadinessLevel, Tone> = { ready: 'success', incomplete: 'warning', enrich: 'danger', blocked: 'danger' };

export function ReadinessBadge({ readiness }: { readiness: Readiness }) {
  return <Badge tone={READINESS_TONE[readiness.level]}>{readiness.label}</Badge>;
}

export function ReadinessChecks({ readiness }: { readiness: Readiness }) {
  return (
    <ul className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
      {readiness.checks.map((c) => (
        <li key={c.label} className={c.ok ? 'text-ink' : 'text-muted'}>
          {c.ok ? `✓ ${c.label}` : `— ${c.label} : à compléter`}
        </li>
      ))}
    </ul>
  );
}

/** Bouton « Utiliser cette réponse » : place le texte dans la zone de rédaction. */
export function UseButton({ onUse, text }: { onUse?: (text: string) => void; text: string }) {
  if (!onUse || !text) return null;
  return (
    <button type="button" onClick={() => onUse(text)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-2">
      <CornerDownLeft className="h-4 w-4" aria-hidden />
      Utiliser cette réponse
    </button>
  );
}

/**
 * Réponse commerciale : phrase courte à dire tout de suite, réponse développée repliée, relance, points à éviter.
 * `compact` (mode expert) n'affiche que la phrase courte.
 */
export function AnswerCard({
  title,
  short,
  long,
  followUp,
  followUpLabel = 'Relance',
  avoid,
  warning,
  onUse,
  compact,
  open,
  badge,
}: {
  title?: ReactNode;
  short: string;
  long?: string;
  followUp?: string;
  followUpLabel?: string;
  avoid?: string;
  warning?: string | null;
  onUse?: (text: string) => void;
  compact?: boolean;
  /** Réponse développée dépliée d'office (mode débutant) */
  open?: boolean;
  badge?: ReactNode;
}) {
  return (
    <article className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      {(title || badge) && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          {title && <h3 className="font-semibold text-ink">{title}</h3>}
          {badge}
        </div>
      )}
      {warning && (
        <p className="mb-2 flex gap-2 rounded-xl bg-warning-soft p-2.5 text-sm text-warning">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {warning}
        </p>
      )}
      <p className="whitespace-pre-line text-[1.05rem] leading-relaxed text-ink">{short}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={short} label="Copier" />
        <UseButton onUse={onUse} text={short} />
      </div>
      {!compact && long && (
        <details className="mt-3 border-t border-line pt-3" open={open}>
          <summary className="cursor-pointer text-sm font-semibold text-brand">Réponse développée</summary>
          <p className="mt-2 whitespace-pre-line leading-relaxed text-ink">{long}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <CopyButton text={long} label="Copier" />
            <UseButton onUse={onUse} text={long} />
          </div>
        </details>
      )}
      {followUp && (
        <p className="mt-3 flex gap-2 rounded-xl bg-brand-soft p-2.5 text-sm font-medium text-brand">
          <ArrowRight className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">{followUpLabel} : </span>
            {followUp}
          </span>
        </p>
      )}
      {!compact && avoid && (
        <p className="mt-2 text-sm text-muted">
          <span className="font-semibold">À éviter : </span>
          {avoid}
        </p>
      )}
    </article>
  );
}
