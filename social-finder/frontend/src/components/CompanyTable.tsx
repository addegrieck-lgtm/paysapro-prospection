import { Link } from 'react-router';
import type { CompanySummary } from '../lib/types';
import { cn, fmtDate, PROSPECT_STATUS_TONE } from '../lib/format';
import { PlatformIcon } from './brand';
import { ScorePill } from './scores';
import { DemoBadge } from './ui';

export function StatusBadge({ status, label }: { status: string; label: string }) {
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap', PROSPECT_STATUS_TONE[status])}>{label}</span>;
}

export default function CompanyTable({ items, selected, onSelect }: { items: CompanySummary[]; selected?: Set<number>; onSelect?: (id: number) => void }) {
  return (
    <div className="overflow-x-auto scroll-thin -mx-5">
      <table className="w-full text-[13.5px]">
        <thead>
          <tr className="text-left text-[11.5px] uppercase tracking-wider text-muted border-b border-line">
            {onSelect && <th className="pl-5 w-8" />}
            <th className={cn('py-2 font-medium', !onSelect && 'pl-5')}>Entreprise</th>
            <th className="py-2 font-medium">Réseaux</th>
            <th className="py-2 font-medium">Confiance</th>
            <th className="py-2 font-medium">Commercial</th>
            <th className="py-2 font-medium hidden xl:table-cell">Opportunité</th>
            <th className="py-2 font-medium">Statut</th>
            <th className="py-2 pr-5 font-medium hidden md:table-cell">Découvert</th>
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c.id} className="border-b border-line last:border-0 hover:bg-paper/70">
              {onSelect && (
                <td className="pl-5"><input type="checkbox" checked={selected?.has(c.id)} onChange={() => onSelect(c.id)} className="accent-[#0f1e33]" aria-label={`Sélectionner ${c.name}`} /></td>
              )}
              <td className={cn('py-2.5 pr-3', !onSelect && 'pl-5')}>
                <Link to={`/prospects/${c.id}`} className="font-medium text-ink hover:underline inline-flex items-center gap-2">{c.name}{!!c.is_demo && <DemoBadge />}</Link>
                <div className="text-[12px] text-muted">{[c.activity_label, c.city ?? (c.zone ? `zone : ${c.zone}` : null)].filter(Boolean).join(' · ')}</div>
              </td>
              <td className="py-2.5"><div className="flex gap-1.5">{c.profiles.map((p) => (
                <a key={p.id} href={p.url} target="_blank" rel="noreferrer" title={`@${p.handle}${p.api_verified ? ' (vérifié par l’API)' : ''}`}><PlatformIcon platform={p.platform} /></a>
              ))}</div></td>
              <td className="py-2.5"><ScorePill kind="confidence" score={c.confidence_score} /></td>
              <td className="py-2.5"><ScorePill kind="commercial" score={c.commercial_score} /></td>
              <td className="py-2.5 pr-3 hidden xl:table-cell max-w-[280px]">
                <span className="text-[12.5px] text-ink-2 line-clamp-2">{c.main_opportunity?.text ?? <span className="text-muted">—</span>}</span>
              </td>
              <td className="py-2.5"><StatusBadge status={c.status} label={c.status_label} /></td>
              <td className="py-2.5 pr-5 text-muted text-[12.5px] hidden md:table-cell num">{fmtDate(c.discovered_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
