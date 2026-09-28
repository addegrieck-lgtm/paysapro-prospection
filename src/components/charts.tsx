// Graphiques légers (sans bibliothèque) : une seule teinte (la marque), barres fines à bouts arrondis,
// info-bulle au survol / focus, et un tableau équivalent pour l'accessibilité.
import { useState } from 'react';
import type { FunnelStep, Bucket, GeoLine } from '../domain/stats';
import { nf, pctFmt } from './common';

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  const max = Math.max(1, ...steps.map((s) => s.count));
  return (
    <ol className="space-y-2" aria-label="Tunnel commercial">
      {steps.map((s) => (
        <li key={s.id} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-sm">
          <span className="text-muted">{s.label}</span>
          <span className="h-6 overflow-hidden rounded-r-[4px] bg-surface-2" aria-hidden>
            <span className="block h-full rounded-r-[4px] bg-brand" style={{ width: `${Math.max(s.count ? 1.5 : 0, (s.count / max) * 100)}%` }} />
          </span>
          <span className="w-24 text-right tabular-nums">
            <strong className="text-ink">{nf.format(s.count)}</strong>
            {s.rate !== null && <span className="ml-1 text-xs text-muted">{pctFmt(s.rate)}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function BarChart({ buckets, label }: { buckets: Bucket[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((s, b) => s + b.count, 0);
  const tick = Math.ceil(max / 4) || 1;
  const top = tick * 4;
  return (
    <figure>
      <figcaption className="mb-2 text-sm text-muted">
        {label} : <strong className="text-ink">{nf.format(total)}</strong> sur la période
      </figcaption>
      <div className="relative h-48">
        {/* Grille discrète */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="absolute inset-x-0 border-t border-line/60" style={{ bottom: `${(i / 4) * 100}%` }}>
            <span className="absolute -top-2.5 left-0 bg-surface pr-1 text-[0.65rem] tabular-nums text-muted">{nf.format(tick * i)}</span>
          </div>
        ))}
        <div className="absolute inset-0 left-7 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {buckets.map((b, i) => (
            <button
              key={b.label + i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${b.label} : ${b.count}`}
              className="group relative flex h-full flex-1 items-end focus:outline-none"
            >
              <span className={`block w-full rounded-t-[4px] ${hover === i ? 'bg-brand-strong' : 'bg-brand'}`} style={{ height: `${(b.count / top) * 100}%`, minHeight: b.count ? 2 : 0 }} />
              {hover === i && (
                <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs text-bg shadow-lg">
                  {b.label} · <strong>{nf.format(b.count)}</strong>
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="ml-7 mt-1 flex justify-between text-[0.65rem] text-muted" aria-hidden>
        <span>{buckets[0]?.label}</span>
        <span>{buckets[Math.floor(buckets.length / 2)]?.label}</span>
        <span>{buckets[buckets.length - 1]?.label}</span>
      </div>
    </figure>
  );
}

export function GeoTable({ lines, limit, level, compact }: { lines: GeoLine[]; limit?: number; level: 'department' | 'region'; compact?: boolean }) {
  const extra = compact ? 'hidden' : 'hidden sm:table-cell';
  const shown = limit ? lines.slice(0, limit) : lines;
  const max = Math.max(1, ...shown.map((l) => l.total));
  if (!shown.length) return <p className="text-sm text-muted">Aucune donnée.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th className="py-2 pr-2">{level === 'department' ? 'Département' : 'Région'}</th>
            <th className="py-2 pr-2 text-right">Prospects</th>
            <th className={`${extra} py-2 pr-2 text-right`}>Prioritaires</th>
            <th className="py-2 pr-2 text-right">Clients</th>
            <th className={`${extra} py-2 text-right`}>Conversion</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((l) => (
            <tr key={l.code} className="border-t border-line/70">
              <td className="py-2 pr-2">
                <span className="block font-medium">
                  {l.label}
                  {level === 'department' && l.code !== '—' && <span className="ml-1 text-muted">({l.code})</span>}
                </span>
                <span className="mt-1 block h-1.5 rounded-full bg-brand/80" style={{ width: `${(l.total / max) * 100}%` }} aria-hidden />
              </td>
              <td className="py-2 pr-2 text-right tabular-nums">{nf.format(l.total)}</td>
              <td className={`${extra} py-2 pr-2 text-right tabular-nums`}>{nf.format(l.priority)}</td>
              <td className="py-2 pr-2 text-right tabular-nums">{nf.format(l.clients)}</td>
              <td className={`${extra} py-2 text-right tabular-nums`}>{pctFmt(l.conversionRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
