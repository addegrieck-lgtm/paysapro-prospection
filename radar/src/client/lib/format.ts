export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

export function eur(v: number | null | undefined, compact = false): string {
  if (!isNum(v)) return '—';
  if (compact && Math.abs(v) >= 1000) {
    const abs = Math.abs(v);
    const s = abs >= 1e6 ? `${(v / 1e6).toFixed(abs >= 1e7 ? 0 : 1)} M€` : `${Math.round(v / 1000)} k€`;
    return s.replace('.', ',');
  }
  return `${Math.round(v).toLocaleString('fr-FR')} €`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  return isNum(v) ? `${(v * 100).toFixed(digits).replace('.', ',')} %` : '—';
}

export function num(v: number | null | undefined, digits = 0): string {
  return isNum(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }) : '—';
}

export function date(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString('fr-FR');
}

export function dateTime(v: string | null | undefined): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

export function ago(v: string | null | undefined): string {
  if (!v) return 'jamais';
  const s = (Date.now() - new Date(v).getTime()) / 1000;
  if (s < 90) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return `il y a ${Math.round(s / 86400)} j`;
}

export function years(creation: string | null | undefined): string {
  if (!creation) return '—';
  const y = (Date.now() - new Date(creation).getTime()) / (365.25 * 86400_000);
  return `${Math.floor(y)} an${y >= 2 ? 's' : ''}`;
}

export const OPP_COLORS: Record<string, string> = {
  a_vendre: 'var(--color-cat-1)',
  procedure: 'var(--color-cat-2)',
  transmission: 'var(--color-cat-3)',
  cachee: 'var(--color-cat-4)',
};
export const OPP_HEX: Record<string, string> = { a_vendre: '#3987e5', procedure: '#d95926', transmission: '#199e70', cachee: '#c98500' };
export const OPP_LETTER: Record<string, string> = { a_vendre: 'V', procedure: 'P', transmission: 'T', cachee: 'C' };
export const OPP_SHORT: Record<string, string> = { a_vendre: 'À vendre', procedure: 'Procédure', transmission: 'Transmission', cachee: 'Piste' };
