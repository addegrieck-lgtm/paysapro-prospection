// Petits composants partagés du module.
import { useState, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import { Badge } from './ui/Card';
import { useToast } from './ui/Feedback';
import { priorityOf } from '../domain/scoring';
import { STATUS_LABEL, STATUS_TONE } from '../domain/referentials';
import type { ProspectStatus } from '../domain/types';

export const NOT_AVAILABLE = 'Non disponible';

/** Valeur ou « Non disponible » (jamais de donnée inventée). */
export function Value({ children, href, external }: { children: ReactNode; href?: string | null; external?: boolean }) {
  const empty = children === null || children === undefined || children === '' || (Array.isArray(children) && children.length === 0);
  if (empty) return <span className="text-muted/80 italic">{NOT_AVAILABLE}</span>;
  if (href)
    return (
      <a href={href} className="break-words text-brand underline-offset-2 hover:underline" {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {children}
      </a>
    );
  return <span className="break-words">{children}</span>;
}

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(7rem,38%)_1fr] gap-3 border-b border-line/70 py-2 text-sm last:border-0">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

const scoreClass: Record<string, string> = {
  max: 'bg-danger-soft text-danger',
  high: 'bg-warning-soft text-warning',
  normal: 'bg-info-soft text-info',
  low: 'bg-surface-2 text-muted',
};

export function ScoreBadge({ score, large }: { score: number; large?: boolean }) {
  const p = priorityOf(score);
  return (
    <span
      title={`${p.label} — catégorie interne de prospection`}
      aria-label={`Score ${score} sur 100, ${p.label}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold tabular-nums ${scoreClass[p.id]} ${large ? 'px-3 py-1 text-lg' : 'px-2 py-0.5 text-xs'}`}
    >
      <span aria-hidden>{p.emoji}</span>
      {score}
    </span>
  );
}

export function StatusBadge({ status }: { status: ProspectStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function DemoTag() {
  return (
    <span className="inline-flex items-center rounded-md bg-accent px-1.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-white" title="Entreprise fictive">
      Démo
    </span>
  );
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Repli pour les navigateurs sans API presse-papiers
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label, className = '' }: { text: string | null | undefined; label: string; className?: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <button
      type="button"
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          toast(`${label} copié`);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-2 ${className}`}
    >
      {done ? <Check className="h-4 w-4 text-success" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
      {label}
    </button>
  );
}

/** Exécute une action et affiche l'erreur éventuelle dans un toast. */
export function useAction() {
  const toast = useToast();
  return async function run<T>(task: () => Promise<T>, success?: string): Promise<T | undefined> {
    try {
      const r = await task();
      if (success) toast(success);
      return r;
    } catch (e) {
      console.error(e);
      toast(e instanceof Error ? e.message : 'Une erreur est survenue.', 'danger');
      return undefined;
    }
  };
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const nf = new Intl.NumberFormat('fr-FR');
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 pt-3 text-sm text-muted">
      <span>
        {nf.format((page - 1) * pageSize + 1)}–{nf.format(Math.min(total, page * pageSize))} sur {nf.format(total)}
      </span>
      <div className="flex items-center gap-1">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Page précédente" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface disabled:opacity-40">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="px-2 tabular-nums">
          {page} / {pages}
        </span>
        <button type="button" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Page suivante" className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface disabled:opacity-40">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}

export const nf = new Intl.NumberFormat('fr-FR');
export const pctFmt = (v: number | null) => (v === null ? '—' : `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 }).format(v)} %`);

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}
