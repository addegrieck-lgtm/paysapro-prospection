const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
const longFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? dateFmt.format(d) : '—';
}

export function formatLongDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? longFmt.format(d) : '—';
}

export function formatTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d ? timeFmt.format(d) : '—';
}

export function addDays(value: string | Date, days: number): Date {
  const d = new Date(value);
  d.setDate(d.getDate() + days);
  return d;
}

/** Jours calendaires entre deux dates (b − a). */
export function daysBetween(a: Date, b: Date): number {
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / 86_400_000);
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Date « AAAA-MM-JJ » (champs <input type="date">) → Date locale à minuit. */
export function fromInputDate(value: string | null): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function relativeTime(iso: string, now = new Date()): string {
  const d = toDate(iso);
  if (!d) return '';
  const days = daysBetween(d, now);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days > 1 && days < 7) return `il y a ${days} jours`;
  return `le ${formatDate(d)}`;
}
