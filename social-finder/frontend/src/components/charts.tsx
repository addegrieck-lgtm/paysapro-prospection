// Graphiques SVG légers : barres groupées (2 séries, légende + infobulle) et répartition (1 série).
import { useState } from 'react';
import { cn } from '../lib/format';

export function TimelineChart({ data }: { data: { date: string; discovered: number; sent: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.flatMap((d) => [d.discovered, d.sent]));
  const H = 140;
  const ticks = [...new Set([0, Math.ceil(max / 2), max])];
  return (
    <div>
      <div className="flex items-center gap-4 mb-3 text-[12px] text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-series-1" />Entreprises découvertes</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-series-2" />Messages envoyés</span>
      </div>
      <div className="relative flex">
        <div className="flex flex-col justify-between text-[10.5px] text-muted num pr-2 h-[140px]">
          {[...ticks].reverse().map((t) => <span key={t}>{t}</span>)}
        </div>
        <div className="relative flex-1">
          {ticks.map((t) => <div key={t} className="absolute inset-x-0 border-t border-dashed border-line" style={{ bottom: `${(t / max) * H}px` }} />)}
          <div className="relative flex items-end gap-[3px] h-[140px]">
            {data.map((d, i) => (
              <div key={d.date} className="relative flex-1 h-full flex items-end justify-center gap-[2px]" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <div className={cn('w-full max-w-3 rounded-t-[4px] bg-series-1 transition-opacity', hover !== null && hover !== i && 'opacity-40')} style={{ height: `${(d.discovered / max) * H}px` }} />
                <div className={cn('w-full max-w-3 rounded-t-[4px] bg-series-2 transition-opacity', hover !== null && hover !== i && 'opacity-40')} style={{ height: `${(d.sent / max) * H}px` }} />
                {hover === i && (
                  <div className="absolute bottom-full mb-2 z-10 whitespace-nowrap rounded-lg bg-ink text-white text-[11.5px] px-2.5 py-1.5 shadow-lg pointer-events-none">
                    <div className="font-semibold">{new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                    <div>{d.discovered} découverte(s) · {d.sent} envoi(s)</div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10.5px] text-muted mt-1.5">
            <span>{new Date(data[0]?.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
            <span>Aujourd'hui</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DistributionChart({ data, color }: { data: { label: string; count: number }[]; color: string }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="group" title={`${d.label} : ${d.count} (${total ? Math.round((d.count / total) * 100) : 0} %)`}>
          <div className="flex justify-between text-[12.5px] mb-1"><span className="text-ink-2">{d.label}</span><span className="num font-semibold">{d.count}</span></div>
          <div className="h-2 rounded-full bg-paper overflow-hidden">
            <div className="h-full rounded-full transition-all group-hover:opacity-80" style={{ width: `${(d.count / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
