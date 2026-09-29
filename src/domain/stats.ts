// Statistiques calculées depuis la base réelle (jamais de chiffre codé en dur).
import type { Milestone, ProspectRow, ProspectTask } from './types';
import { IN_PROGRESS } from './referentials';
import { departmentName, regionName } from './geo';
import { today } from './filters';

export interface Kpis {
  total: number;
  priority: number;
  toContact: number;
  inProgress: number;
  contacted: number;
  replies: number;
  demos: number;
  trials: number;
  clients: number;
  conversionRate: number | null;
  potentialValue: number | null;
  followUpsToday: number;
  priorityNeverContacted: number;
  awaitingReply: number;
  // Qualité des données / enrichissement
  active: number;
  enriched: number;
  partial: number;
  notEnriched: number;
  failed: number;
  withEmail: number;
  withPhone: number;
  withWebsite: number;
  averageScore: number | null;
  followUpsPlanned: number;
}

const pct = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);

export function computeKpis(rows: ProspectRow[], tasks: ProspectTask[], averageDealValue: number | null, now = new Date()): Kpis {
  const t = today(now);
  let priority = 0;
  let toContact = 0;
  let inProgress = 0;
  let priorityNeverContacted = 0;
  let awaitingReply = 0;
  const q = { active: 0, enriched: 0, partial: 0, notEnriched: 0, failed: 0, withEmail: 0, withPhone: 0, withWebsite: 0, scoreSum: 0 };
  const m: Record<Milestone, number> = { contacted: 0, replied: 0, demo: 0, trial: 0, client: 0 };
  for (const r of rows) {
    if (r.active) q.active++;
    if (r.enrichmentStatus === 'enriched') q.enriched++;
    else if (r.enrichmentStatus === 'partial') q.partial++;
    else if (r.enrichmentStatus === 'failed') q.failed++;
    else q.notEnriched++;
    if (r.email) q.withEmail++;
    if (r.phone) q.withPhone++;
    if (r.website) q.withWebsite++;
    q.scoreSum += r.score;
    if (r.score >= 80) priority++;
    if (r.status === 'to_contact') toContact++;
    if (IN_PROGRESS.includes(r.status)) inProgress++;
    if (r.status === 'replied') awaitingReply++;
    if (r.score >= 80 && !r.milestones.contacted && !r.doNotContact && !r.demo) priorityNeverContacted++;
    for (const k of Object.keys(m) as Milestone[]) if (r.milestones[k]) m[k]++;
  }
  const open = rows.filter((r) => !r.doNotContact && r.status !== 'client' && r.status !== 'not_interested').length;
  return {
    total: rows.length,
    priority,
    toContact,
    inProgress,
    contacted: m.contacted,
    replies: m.replied,
    demos: m.demo,
    trials: m.trial,
    clients: m.client,
    conversionRate: pct(m.client, m.contacted),
    potentialValue: averageDealValue !== null ? open * averageDealValue : null,
    followUpsToday: tasks.filter((x) => !x.done && x.dueAt.slice(0, 10) <= t).length,
    priorityNeverContacted,
    awaitingReply,
    active: q.active,
    enriched: q.enriched,
    partial: q.partial,
    notEnriched: q.notEnriched,
    failed: q.failed,
    withEmail: q.withEmail,
    withPhone: q.withPhone,
    withWebsite: q.withWebsite,
    averageScore: rows.length ? Math.round(q.scoreSum / rows.length) : null,
    followUpsPlanned: tasks.filter((x) => !x.done).length,
  };
}

export interface FunnelStep {
  id: 'prospects' | Milestone;
  label: string;
  count: number;
  /** Taux depuis l'étape précédente */
  rate: number | null;
}

export function funnel(k: Kpis): FunnelStep[] {
  const steps: [FunnelStep['id'], string, number][] = [
    ['prospects', 'Prospects', k.total],
    ['contacted', 'Contactés', k.contacted],
    ['replied', 'Réponses', k.replies],
    ['demo', 'Démos', k.demos],
    ['trial', 'Essais', k.trials],
    ['client', 'Clients', k.clients],
  ];
  return steps.map(([id, label, count], i) => ({ id, label, count, rate: i === 0 ? null : pct(count, steps[i - 1]![2]) }));
}

export function rates(k: Kpis) {
  return {
    contactRate: pct(k.contacted, k.total),
    replyRate: pct(k.replies, k.contacted),
    demoRate: pct(k.demos, k.replies),
    conversionRate: pct(k.clients, k.contacted),
  };
}

export interface GeoLine {
  code: string;
  label: string;
  total: number;
  priority: number;
  contacted: number;
  clients: number;
  conversionRate: number | null;
}

export function byGeo(rows: ProspectRow[], level: 'department' | 'region'): GeoLine[] {
  const map = new Map<string, GeoLine>();
  for (const r of rows) {
    const code = (level === 'department' ? r.department : r.region) ?? '—';
    const label = code === '—' ? 'Non disponible' : ((level === 'department' ? departmentName(code) : regionName(code)) ?? code);
    const line = map.get(code) ?? { code, label, total: 0, priority: 0, contacted: 0, clients: 0, conversionRate: null };
    line.total++;
    if (r.score >= 80) line.priority++;
    if (r.milestones.contacted) line.contacted++;
    if (r.milestones.client) line.clients++;
    map.set(code, line);
  }
  return Array.from(map.values())
    .map((l) => ({ ...l, conversionRate: pct(l.clients, l.contacted) }))
    .sort((a, b) => b.total - a.total);
}

export type Granularity = 'day' | 'week' | 'month';
export type EvolutionMetric = 'new' | Milestone;

export const EVOLUTION_LABEL: Record<EvolutionMetric, string> = {
  new: 'Nouveaux prospects',
  contacted: 'Contacts',
  replied: 'Réponses',
  demo: 'Démos',
  trial: 'Essais',
  client: 'Conversions',
};

function bucketStart(d: Date, g: Granularity): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (g === 'week') x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // lundi
  if (g === 'month') x.setDate(1);
  return x;
}

function step(d: Date, g: Granularity, n: number): Date {
  const x = new Date(d);
  if (g === 'day') x.setDate(x.getDate() + n);
  else if (g === 'week') x.setDate(x.getDate() + 7 * n);
  else x.setMonth(x.getMonth() + n);
  return x;
}

export interface Bucket {
  start: Date;
  label: string;
  count: number;
}

export function evolution(rows: ProspectRow[], metric: EvolutionMetric, g: Granularity, now = new Date()): Bucket[] {
  const n = g === 'day' ? 30 : 12;
  const last = bucketStart(now, g);
  const buckets: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = step(last, g, -i);
    const label =
      g === 'month'
        ? new Intl.DateTimeFormat('fr-FR', { month: 'short', year: '2-digit' }).format(start)
        : new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' }).format(start);
    buckets.push({ start, label, count: 0 });
  }
  const first = buckets[0]!.start.getTime();
  for (const r of rows) {
    const iso = metric === 'new' ? r.createdAt : r.milestones[metric];
    if (!iso) continue;
    const d = new Date(iso);
    if (d.getTime() < first) continue;
    const s = bucketStart(d, g).getTime();
    const b = buckets.find((x) => x.start.getTime() === s);
    if (b) b.count++;
  }
  return buckets;
}
