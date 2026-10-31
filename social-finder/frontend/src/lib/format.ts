export const fmtDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
export const fmtNum = (n?: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('fr-FR'));
export const cn = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export const STATUS_LABEL: Record<string, string> = {
  verified: 'Vérifié', observed: 'Constaté', hypothesis: 'Hypothèse', unknown: 'Inconnu', contradiction: 'Contradiction',
};

export function confidenceTone(score: number): 'good' | 'seine' | 'warn' | 'bad' {
  return score >= 90 ? 'good' : score >= 75 ? 'seine' : score >= 50 ? 'warn' : 'bad';
}
export function commercialTone(score: number): 'good' | 'seine' | 'warn' | 'bad' {
  return score >= 85 ? 'good' : score >= 70 ? 'seine' : score >= 50 ? 'warn' : 'bad';
}
export const confidenceLabel = (s: number) => (s >= 90 ? 'Très fiable' : s >= 75 ? 'Fiable' : s >= 50 ? 'À vérifier' : 'Incertain');
export const commercialLabel = (s: number) => (s >= 85 ? 'Excellent potentiel' : s >= 70 ? 'Bon potentiel' : s >= 50 ? 'Potentiel moyen' : 'Faible potentiel');

export const PROSPECT_STATUS_TONE: Record<string, string> = {
  new: 'bg-slate-100 text-slate-700', to_contact: 'bg-seine-soft text-seine', message_ready: 'bg-brass-soft text-[#7a5a1c]',
  contacted: 'bg-indigo-50 text-indigo-700', replied: 'bg-violet-50 text-violet-700', interested: 'bg-good-soft text-good',
  not_interested: 'bg-stone-100 text-stone-600', follow_up: 'bg-warn-soft text-warn', do_not_contact: 'bg-bad-soft text-bad',
};
