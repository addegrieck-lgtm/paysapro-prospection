import { useState, type ReactNode } from 'react';
import { eur, isNum } from '../lib/format';

/** Barres horizontales (magnitude) : une seule teinte, valeur en texte neutre, survol. */
export function BarList({ rows, format = (v) => v.toLocaleString('fr-FR'), max: maxIn, secondary }: { rows: { label: ReactNode; value: number; sub?: number; key: string; onClick?: () => void }[]; format?: (v: number) => string; max?: number; secondary?: string }) {
  const max = maxIn ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.key} className="group">
          <button type="button" onClick={r.onClick} disabled={!r.onClick} className="w-full text-left disabled:cursor-default" title={`${typeof r.label === 'string' ? r.label : ''} : ${format(r.value)}${r.sub !== undefined && secondary ? ` · ${r.sub} ${secondary}` : ''}`}>
            <div className="mb-0.5 flex justify-between gap-2 text-xs">
              <span className="truncate text-fog-300 group-hover:text-fog-100">{r.label}</span>
              <span className="tabular text-fog-100">
                {format(r.value)}
                {r.sub !== undefined && secondary && <span className="ml-1.5 text-fog-500">· {r.sub} {secondary}</span>}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-ink-700">
              <div className="h-1.5 rounded-full bg-volt-500 transition-[width] duration-500 group-hover:bg-volt-400" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Colonnes empilées par période (identité : couleurs catégorielles fixes), info-bulle par colonne. */
export function StackedColumns({ data, series, height = 160 }: { data: { x: string; values: Record<string, number> }[]; series: { key: string; label: string; color: string }[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const totals = data.map((d) => series.reduce((a, s) => a + (d.values[s.key] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const w = 100 / Math.max(1, data.length);
  const h = height - 22;
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-fog-300" aria-label="Légende">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
        <svg width="100%" height={height} preserveAspectRatio="none" viewBox={`0 0 100 ${height}`} role="img" aria-label="Découvertes par semaine">
          {[0.5, 1].map((g) => (
            <line key={g} x1="0" x2="100" y1={h - h * g} y2={h - h * g} stroke="var(--color-ink-700)" strokeWidth="0.3" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            let y = h;
            return (
              <g key={d.x} onMouseEnter={() => setHover(i)}>
                <rect x={i * w} y={0} width={w} height={h} fill={hover === i ? 'rgba(255,255,255,0.04)' : 'transparent'} />
                {series.map((s) => {
                  const v = d.values[s.key] ?? 0;
                  const bh = (v / max) * (h - 4);
                  if (!v) return null;
                  y -= bh;
                  return <rect key={s.key} x={i * w + w * 0.2} y={y + 0.5} width={w * 0.6} height={Math.max(0.5, bh - 1)} rx={0.6} fill={s.color} />;
                })}
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-0 flex text-[10px] text-fog-500">
          {data.map((d, i) => (
            <span key={d.x} className="truncate text-center" style={{ width: `${w}%` }}>
              {i % Math.ceil(data.length / 6) === 0 ? d.x : ''}
            </span>
          ))}
        </div>
        {hover !== null && data[hover] && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-md border border-ink-600 bg-ink-850 px-2 py-1.5 text-[11px] shadow-lg" style={{ left: `min(calc(${(hover + 0.5) * w}% + 8px), calc(100% - 150px))` }}>
            <div className="mb-1 font-medium text-fog-100">Semaine du {data[hover]!.x}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center justify-between gap-3 text-fog-300">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tabular text-fog-100">{data[hover]!.values[s.key] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Évolution financière : CA en colonnes, résultat net en ligne, même axe en euros (une seule échelle). */
export function FinancialChart({ years }: { years: { fiscalYear: number; revenue?: number | null; netIncome?: number | null; ebe?: number | null }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const data = years.filter((y) => isNum(y.revenue) || isNum(y.netIncome));
  if (data.length === 0) return <div className="py-6 text-center text-sm text-fog-500">Aucun compte publié.</div>;
  const vals = data.flatMap((d) => [d.revenue, d.netIncome, d.ebe].filter(isNum)) as number[];
  const max = Math.max(1, ...vals);
  const min = Math.min(0, ...vals);
  const H = 180;
  const pad = 18;
  const y = (v: number) => pad + ((max - v) / (max - min)) * (H - pad * 2);
  const w = 100 / data.length;
  const linePts = (k: 'netIncome' | 'ebe') =>
    data
      .map((d, i) => (isNum(d[k]) ? `${(i + 0.5) * w},${y(d[k] as number)}` : null))
      .filter(Boolean)
      .join(' ');
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-3 text-[11px] text-fog-300">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-cat-1" />
          Chiffre d'affaires
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-cat-3" />
          EBE
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 bg-cat-2" />
          Résultat net
        </span>
      </div>
      <div className="relative" onMouseLeave={() => setHover(null)}>
        <svg width="100%" height={H} viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label="Évolution du chiffre d'affaires et du résultat">
          <line x1="0" x2="100" y1={y(0)} y2={y(0)} stroke="var(--color-ink-500)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {data.map((d, i) =>
            isNum(d.revenue) ? <rect key={d.fiscalYear} x={i * w + w * 0.25} y={Math.min(y(d.revenue), y(0))} width={w * 0.5} height={Math.max(1, Math.abs(y(0) - y(d.revenue)))} rx={0.8} fill="var(--color-cat-1)" opacity={hover === null || hover === i ? 0.9 : 0.5} /> : null,
          )}
          <polyline points={linePts('ebe')} fill="none" stroke="var(--color-cat-3)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          <polyline points={linePts('netIncome')} fill="none" stroke="var(--color-cat-2)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          {data.map((_, i) => (
            <rect key={`h${i}`} x={i * w} y={0} width={w} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
        <div className="flex text-[10px] text-fog-500">
          {data.map((d) => (
            <span key={d.fiscalYear} className="text-center" style={{ width: `${w}%` }}>
              {d.fiscalYear}
            </span>
          ))}
        </div>
        {hover !== null && data[hover] && (
          <div className="pointer-events-none absolute top-0 z-10 rounded-md border border-ink-600 bg-ink-850 px-2 py-1.5 text-[11px] shadow-lg" style={{ left: `min(calc(${(hover + 0.5) * w}% + 8px), calc(100% - 170px))` }}>
            <div className="mb-1 font-medium text-fog-100">Exercice {data[hover]!.fiscalYear}</div>
            <div className="flex justify-between gap-3 text-fog-300">
              CA <span className="tabular text-fog-100">{eur(data[hover]!.revenue)}</span>
            </div>
            <div className="flex justify-between gap-3 text-fog-300">
              EBE <span className="tabular text-fog-100">{eur(data[hover]!.ebe)}</span>
            </div>
            <div className="flex justify-between gap-3 text-fog-300">
              Résultat net <span className="tabular text-fog-100">{eur(data[hover]!.netIncome)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Fourchette de valorisation bas / central / haut. */
export function RangeBar({ low, central, high, marker, markerLabel }: { low: number; central: number; high: number; marker?: number | null; markerLabel?: string }) {
  const lo = Math.min(low, marker ?? low) * 0.9;
  const hi = Math.max(high, marker ?? high) * 1.05 || 1;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="py-3">
      <div className="relative h-2 rounded-full bg-ink-700">
        <div className="absolute inset-y-0 rounded-full bg-volt-500/50" style={{ left: pos(low), right: `calc(100% - ${pos(high)})` }} />
        <div className="absolute -top-1 h-4 w-1 rounded bg-volt-300" style={{ left: pos(central) }} title={`Valeur centrale ${eur(central)}`} />
        {isNum(marker) && <div className="absolute -top-1.5 h-5 w-0.5 bg-warn" style={{ left: pos(marker) }} title={`${markerLabel} ${eur(marker)}`} />}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-fog-400 tabular">
        <span>Bas {eur(low, true)}</span>
        <span className="text-fog-100">Central {eur(central, true)}</span>
        <span>Haut {eur(high, true)}</span>
      </div>
      {isNum(marker) && (
        <div className="mt-1 text-[11px] text-warn">
          ▍{markerLabel} : {eur(marker)}
        </div>
      )}
    </div>
  );
}
