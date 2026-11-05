import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { OPP_COLORS, OPP_SHORT } from '../lib/format';

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-xl border border-ink-700 bg-ink-800/80 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 px-4 py-2.5">
          <h2 className="text-[13px] font-semibold tracking-wide text-fog-100">{title}</h2>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={pad ? 'p-4' : ''}>{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-fog-50">{title}</h1>
        {subtitle && <p className="mt-1 max-w-3xl text-sm text-fog-400">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'subtle'; size?: 'sm' | 'md'; busy?: boolean };
export function Button({ variant = 'subtle', size = 'md', busy, className, children, disabled, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      disabled={disabled || busy}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-volt-500 text-white hover:bg-volt-600',
        variant === 'subtle' && 'border border-ink-600 bg-ink-750 text-fog-100 hover:border-ink-500 hover:bg-ink-700',
        variant === 'ghost' && 'text-fog-300 hover:bg-ink-750 hover:text-fog-100',
        variant === 'danger' && 'border border-bad/40 bg-bad/10 text-bad hover:bg-bad/20',
        className,
      )}
    >
      {busy && <Spinner small />}
      {children}
    </button>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return <span role="status" aria-label="Chargement" className={cx('inline-block animate-spin rounded-full border-2 border-fog-500 border-t-transparent', small ? 'h-3 w-3' : 'h-5 w-5')} />;
}

export function Loading({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 p-6 text-sm text-fog-400">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-red-200">
      <span>{error instanceof Error ? error.message : String(error)}</span>
      {onRetry && (
        <Button size="sm" variant="ghost" onClick={onRetry}>
          Réessayer
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'good'; children: ReactNode }) {
  return (
    <div className={cx('rounded-lg border px-3 py-2 text-sm', tone === 'warn' && 'border-warn/40 bg-warn/10 text-amber-100', tone === 'info' && 'border-volt-500/30 bg-volt-500/10 text-blue-100', tone === 'good' && 'border-good/40 bg-good/10 text-emerald-100')}>
      {children}
    </div>
  );
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="text-sm font-medium text-fog-100">{title}</div>
      {children && <div className="max-w-md text-sm text-fog-400">{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, to, tone }: { label: string; value: ReactNode; hint?: ReactNode; to?: string; tone?: 'good' | 'warn' | 'bad' }) {
  const body = (
    <div className={cx('h-full rounded-xl border border-ink-700 bg-ink-800/80 px-4 py-3 transition-colors', to && 'hover:border-volt-500/50')}>
      <div className="text-xs text-fog-400">{label}</div>
      <div className={cx('mt-1 text-2xl font-semibold tabular', tone === 'good' && 'text-good', tone === 'warn' && 'text-warn', tone === 'bad' && 'text-bad', !tone && 'text-fog-50')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-fog-500">{hint}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Badge({ children, color, className, title }: { children: ReactNode; color?: string; className?: string; title?: string }) {
  return (
    <span title={title} className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-ink-600 bg-ink-750 px-1.5 py-0.5 text-[11px] font-medium text-fog-300', className)}>
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </span>
  );
}

export function OppBadge({ type }: { type: string | null | undefined }) {
  if (!type) return <span className="text-xs text-fog-500">—</span>;
  return (
    <Badge color={OPP_COLORS[type]} title={type === 'cachee' ? 'Piste de prospection : entreprise NON déclarée à vendre' : undefined}>
      {OPP_SHORT[type] ?? type}
    </Badge>
  );
}

/** Score économique : pas de couleur verte/rouge sur un score sans données. */
export function ScoreCell({ value, kind = 'eco', status }: { value: number | null | undefined; kind?: 'eco' | 'risk' | 'rel'; status?: string | null }) {
  if (value === null || value === undefined) {
    return (
      <span className="text-[11px] text-fog-500" title="Données insuffisantes pour noter sans inventer">
        {kind === 'eco' ? 'données insuff.' : '—'}
      </span>
    );
  }
  const good = kind === 'risk' ? value < 35 : value >= 65;
  const bad = kind === 'risk' ? value >= 65 : kind === 'rel' ? value < 35 : value < 35;
  return (
    <span className="inline-flex items-center gap-1.5 tabular">
      <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-ink-600" aria-hidden>
        <span className={cx('absolute inset-y-0 left-0 rounded-full', good ? 'bg-good' : bad ? 'bg-bad' : 'bg-warn')} style={{ width: `${value}%` }} />
      </span>
      <span className={cx('text-xs', status === 'insuffisant' && 'text-fog-500')}>{value}</span>
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = { officielle: 'Officielle', declarative: 'Déclarative', calculee: 'Calculée', estimee: 'Estimée', inconnue: 'Inconnue' };
export interface Prov {
  source_id: string;
  source_label?: string;
  status: string;
  confidence: number;
  collected_at: string;
  url?: string | null;
}
/** Indicateur de provenance : source, date, statut et confiance de l'information. */
export function ProvTag({ p }: { p?: Prov | null }) {
  if (!p) return <span className="ml-1 text-[10px] text-fog-500" title="Provenance inconnue">●</span>;
  const tone = p.status === 'officielle' ? 'text-good' : p.status === 'calculee' ? 'text-volt-400' : p.status === 'estimee' ? 'text-warn' : 'text-fog-400';
  return (
    <span className={cx('ml-1 cursor-help text-[10px]', tone)} title={`${STATUS_LABEL[p.status] ?? p.status} · ${p.source_label ?? p.source_id} · collecté le ${new Date(p.collected_at).toLocaleDateString('fr-FR')} · confiance ${p.confidence}/100`}>
      ● <span className="sr-only">{STATUS_LABEL[p.status]} — {p.source_label ?? p.source_id}</span>
    </span>
  );
}

export function StatusTag({ status }: { status: string }) {
  return <Badge className={status === 'officielle' ? 'border-good/40 text-good' : status === 'calculee' ? 'border-volt-500/40 text-volt-300' : status === 'estimee' ? 'border-warn/40 text-warn' : ''}>{STATUS_LABEL[status] ?? status}</Badge>;
}

export function Pagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-2 text-xs text-fog-400">
      <span className="tabular">
        {total.toLocaleString('fr-FR')} résultat{total > 1 ? 's' : ''} · page {page} / {pages}
      </span>
      <div className="flex gap-1">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Précédente
        </Button>
        <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Suivante →
        </Button>
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block text-xs">
      <span className="mb-1 block text-fog-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-fog-500">{hint}</span>}
    </label>
  );
}

export const inputCls = 'h-9 w-full rounded-lg border border-ink-600 bg-ink-850 px-2.5 text-sm text-fog-100 placeholder:text-fog-500 focus:border-volt-500 focus:outline-none';

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-ink-700">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} onClick={() => onChange(i.id)} className={cx('-mb-px border-b-2 px-3 py-2 text-sm transition-colors', value === i.id ? 'border-volt-500 text-fog-50' : 'border-transparent text-fog-400 hover:text-fog-100')}>
          {i.label}
        </button>
      ))}
    </div>
  );
}

/** Chargement de données avec état d'erreur et rechargement. */
export function useApi<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loader()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { data, error, loading, reload: () => setN((x) => x + 1), setData };
}

export function Table({ head, children, dense }: { head: ReactNode[]; children: ReactNode; dense?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full text-left text-sm', dense && 'text-xs')}>
        <thead>
          <tr className="border-b border-ink-700 text-[11px] uppercase tracking-wider text-fog-500">
            {head.map((h, i) => (
              <th key={i} scope="col" className="whitespace-nowrap px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-700/70">{children}</tbody>
      </table>
    </div>
  );
}

export const td = 'px-3 py-2 align-top';
