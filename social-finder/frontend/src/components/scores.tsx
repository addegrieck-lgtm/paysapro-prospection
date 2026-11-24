// Affichage des DEUX scores, toujours séparés : confiance (identification) et potentiel commercial.
import { useState } from 'react';
import { ChevronDown, ShieldCheck, TrendingUp } from 'lucide-react';
import type { Criterion, ScoreDetail, Status } from '../lib/types';
import { cn, commercialLabel, commercialTone, confidenceLabel, confidenceTone, STATUS_LABEL } from '../lib/format';
import { Badge, type Tone } from './ui';

const BAR: Record<string, string> = { good: 'bg-good', seine: 'bg-seine', warn: 'bg-[#d4920f]', bad: 'bg-bad' };
const STATUS_TONE: Record<Status, Tone> = { verified: 'good', observed: 'seine', hypothesis: 'brass', unknown: 'neutral', contradiction: 'bad' };

export function StatusTag({ status }: { status: Status }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function ScorePill({ kind, score }: { kind: 'confidence' | 'commercial'; score: number }) {
  const tone = kind === 'confidence' ? confidenceTone(score) : commercialTone(score);
  const Icon = kind === 'confidence' ? ShieldCheck : TrendingUp;
  return (
    <span title={kind === 'confidence' ? `Confiance : ${confidenceLabel(score)}` : `Commercial : ${commercialLabel(score)}`}
      className="inline-flex items-center gap-1.5 num">
      <Icon className={cn('size-3.5', tone === 'good' ? 'text-good' : tone === 'seine' ? 'text-seine' : tone === 'warn' ? 'text-warn' : 'text-bad')} />
      <span className="font-semibold text-ink">{score}</span>
      <span className="relative h-1.5 w-12 rounded-full bg-slate-200 overflow-hidden">
        <span className={cn('absolute inset-y-0 left-0 rounded-full', BAR[tone])} style={{ width: `${score}%` }} />
      </span>
    </span>
  );
}

export function ScoreHeader({ kind, detail }: { kind: 'confidence' | 'commercial'; detail: ScoreDetail }) {
  const s = detail.score;
  const tone = kind === 'confidence' ? confidenceTone(s) : commercialTone(s);
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 36 36" className="size-20 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" stroke="#ebe9e3" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.5" fill="none" strokeWidth="3" strokeLinecap="round"
            className={tone === 'good' ? 'stroke-good' : tone === 'seine' ? 'stroke-seine' : tone === 'warn' ? 'stroke-[#d4920f]' : 'stroke-bad'}
            strokeDasharray={`${(s / 100) * 97.4} 97.4`} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold num leading-none">{s}</span><span className="text-[10px] text-muted">/100</span>
        </div>
      </div>
      <div>
        <p className="text-[11.5px] uppercase tracking-[0.12em] text-muted font-semibold">{kind === 'confidence' ? 'Score de confiance' : 'Score commercial'}</p>
        <p className="text-lg font-semibold">{detail.level.label}</p>
        <p className="text-[13px] text-muted">{detail.level.action}</p>
      </div>
    </div>
  );
}

function CriterionRow({ c }: { c: Criterion }) {
  const [open, setOpen] = useState(false);
  const pct = Math.max(0, (c.points / c.max) * 100);
  return (
    <li className="border-t border-line first:border-t-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-3 py-2.5 text-left">
        <span className="flex-1 min-w-0 text-[13.5px] text-ink">{c.label}</span>
        <StatusTag status={c.status} />
        <span className="relative h-1.5 w-20 rounded-full bg-slate-200 overflow-hidden hidden sm:block">
          <span className={cn('absolute inset-y-0 left-0 rounded-full', c.points < 0 ? 'bg-bad' : 'bg-ink-2')} style={{ width: `${c.points < 0 ? 100 : pct}%` }} />
        </span>
        <span className={cn('w-14 text-right text-[13px] num font-semibold', c.points < 0 ? 'text-bad' : 'text-ink')}>{c.points}/{c.max}</span>
        <ChevronDown className={cn('size-4 text-muted transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="pb-3 pl-1 space-y-1.5 fade-in">
          {c.evidence.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-[12.5px]">
              <span className={cn('num w-9 shrink-0 text-right font-semibold', e.points < 0 ? 'text-bad' : e.points > 0 ? 'text-good' : 'text-muted')}>
                {e.points > 0 ? `+${e.points}` : e.points}
              </span>
              <span className="flex-1 text-ink-2">{e.text}{e.source && <span className="text-muted"> — {e.source}</span>}</span>
              <StatusTag status={e.status} />
            </div>
          ))}
          {c.missing.length > 0 && <p className="text-[12px] text-muted pl-11">Information manquante : {c.missing.join(', ')}</p>}
        </div>
      )}
    </li>
  );
}

export function ScoreBreakdown({ detail }: { detail: ScoreDetail }) {
  return (
    <div>
      <ul>{detail.criteria.map((c) => <CriterionRow key={c.key} c={c} />)}</ul>
      {detail.sources && detail.sources.length > 0 && (
        <p className="mt-3 text-[12px] text-muted">Sources utilisées : {detail.sources.join(' · ')}</p>
      )}
      <p className="mt-1 text-[11.5px] text-muted">Calcul : {detail.method} — mêmes informations, même score. Une donnée inconnue ne rapporte aucun point.</p>
    </div>
  );
}
