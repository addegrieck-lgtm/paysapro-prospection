// Performance de l'enrichissement : quantité + exactitude + provenance, calculées sur les données réelles.
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { StatCard, Skeleton } from '../components/ui/Extras';
import { Alert } from '../components/ui/Feedback';
import { nf, pctFmt } from '../components/common';
import { useQuery } from '../app/context';
import { ENRICHMENT_CONFIG } from '../config';
import { OSM_ATTRIBUTION } from '../providers/company/OpenStreetMapProvider';
import type { CompanyEmail, CompanyPhone, CompanyWebsite, EnrichmentAttempt, EnrichmentFeedback, EnrichmentLog, ProspectRow, Settings, SourcePerformance, StrategyStat } from '../domain/types';
import type { ContactSet } from '../data/repository';
import { correctOf, LEARNING_CONFIG, MODE_LABEL, summarizeStrategy } from '../domain/learning';
import { strategyLabel } from '../domain/strategies';

function bySource(list: (CompanyPhone | CompanyEmail | CompanyWebsite)[]) {
  const m = new Map<string, number>();
  for (const c of list) {
    if (c.status === 'rejected') continue;
    // Une confirmation de l'utilisateur n'est pas une source où la donnée a été trouvée
    for (const p of new Set(c.evidence.filter((e) => e.kind !== 'manual' || !/^(Confirmé|Validé) par/.test(e.provider)).map((e) => e.provider))) m.set(p, (m.get(p) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

function SourceBars({ title, entries }: { title: string; entries: [string, number][] }) {
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Aucune donnée pour l'instant.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {entries.map(([source, n]) => (
            <li key={source} className="grid grid-cols-[minmax(8rem,40%)_1fr_auto] items-center gap-3">
              <span className="truncate text-muted" title={source}>
                {source}
              </span>
              <span className="h-2.5 rounded-r-[4px] bg-brand" style={{ width: `${Math.max(3, (n / max) * 100)}%` }} aria-hidden />
              <span className="tabular-nums font-semibold">{nf.format(n)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)} %`);

/** Une mesure par graphique (jamais deux échelles) : barres fines, valeur au survol et en fin de ligne. */
function WeekBars({ title, entries, unit = '%' }: { title: string; entries: { week: string; value: number | null; n: number }[]; unit?: string }) {
  const max = Math.max(1, ...entries.map((e) => e.value ?? 0));
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Pas encore assez d'historique.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {entries.map((e) => (
            <li key={e.week} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-2" title={`${e.week} : ${e.value === null ? '—' : `${Math.round(e.value)} ${unit}`} (${e.n} entreprise(s))`}>
              <span className="text-muted tabular-nums">{e.week}</span>
              <span className="h-2.5 rounded-r-[4px] bg-brand" style={{ width: `${Math.max(2, ((e.value ?? 0) / max) * 100)}%` }} aria-hidden />
              <span className="text-right font-semibold tabular-nums">{e.value === null ? '—' : `${Math.round(e.value)} ${unit}`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type PerfData = {
  rows: ProspectRow[];
  contacts: ContactSet;
  logs: EnrichmentLog[];
  stats: StrategyStat[];
  sources: SourcePerformance[];
  feedback: EnrichmentFeedback[];
  attempts: EnrichmentAttempt[];
  settings: Settings;
};

/** Couverture, précision, performance de l'IA, apprentissage, vue technique (§43–45, §75, §81, §84). */
function LearningSections({ data }: { data: PerfData }) {
  const { rows, contacts, logs, stats, sources, feedback, attempts, settings } = data;
  const engineLogs = logs.filter((l) => l.provider === 'moteur').sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const analysed = new Set(engineLogs.map((l) => l.prospectId));
  const names = new Map(rows.map((r) => [r.id, r.name]));
  const good = (c: CompanyPhone | CompanyEmail | CompanyWebsite) => c.status !== 'rejected' && analysed.has(c.prospectId) && (c.status === 'verified' || c.feedback === 'correct');
  const companiesWith = (list: (CompanyPhone | CompanyEmail | CompanyWebsite)[]) => new Set(list.filter(good).map((c) => c.prospectId)).size;
  const rate = (n: number) => (analysed.size ? n / analysed.size : null);
  const verifiedContacts = [...contacts.phones, ...contacts.emails, ...contacts.websites].filter(good).length;
  // Précision mesurée : le DERNIER avis sur chaque coordonnée (un changement d'avis remplace le précédent)
  const latest = new Map<string, EnrichmentFeedback>();
  for (const f of [...feedback].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) latest.set(`${f.prospectId}|${f.field}|${f.oldValue}`, f);
  const correct = [...latest.values()].filter((f) => f.feedbackType === 'correct').length;
  const incorrect = [...latest.values()].filter((f) => f.feedbackType === 'incorrect').length;
  const found = stats.reduce((n, s) => n + s.found, 0);
  const estimatedCorrect = stats.reduce((n, s) => n + correctOf(s), 0);
  const withStrategies = engineLogs.filter((l) => l.strategies);
  const avgSearches = withStrategies.length ? withStrategies.reduce((n, l) => n + (l.strategies?.length ?? 0), 0) / withStrategies.length : null;
  const providerErrors = attempts.filter((a) => a.error).length;

  // Performance de l'IA : stratégies classées par score (formule réglable, domain/learning.ts)
  const summaries = [...new Set(stats.map((s) => s.strategyId))].map((id) => summarizeStrategy(stats, id)).sort((a, b) => (b.score ?? -9) - (a.score ?? -9));
  const tested = summaries.filter((s) => s.attempts >= 5);
  const best = tested.slice(0, 3);
  const weak = tested.slice(-3).filter((s) => !best.includes(s)).reverse();
  const bySourceAgg = new Map<string, { attempts: number; found: number; verified: number; falsePositive: number }>();
  for (const s of sources) {
    const a = bySourceAgg.get(s.source) ?? { attempts: 0, found: 0, verified: 0, falsePositive: 0 };
    bySourceAgg.set(s.source, { attempts: a.attempts + s.attempts, found: a.found + s.found, verified: a.verified + s.verified, falsePositive: a.falsePositive + s.falsePositive });
  }

  // Apprentissage : évolution par semaine, avant / après, stratégies nouvelles et délaissées
  const weeks = new Map<string, { n: number; phone: number; correct: number; incorrect: number }>();
  for (const l of engineLogs) {
    const w = weeks.get(weekOf(l.completedAt)) ?? { n: 0, phone: 0, correct: 0, incorrect: 0 };
    w.n++;
    if ((l.found?.verifiedPhones ?? 0) > 0) w.phone++;
    weeks.set(weekOf(l.completedAt), w);
  }
  for (const f of latest.values()) {
    const w = weeks.get(weekOf(f.createdAt)) ?? { n: 0, phone: 0, correct: 0, incorrect: 0 };
    if (f.feedbackType === 'correct') w.correct++;
    else w.incorrect++;
    weeks.set(weekOf(f.createdAt), w);
  }
  const weekList = [...weeks.entries()].slice(-8);
  const coverage = weekList.filter(([, w]) => w.n).map(([week, w]) => ({ week, value: (w.phone / w.n) * 100, n: w.n }));
  const precisionWeeks = weekList.filter(([, w]) => w.correct + w.incorrect).map(([week, w]) => ({ week, value: (w.correct / (w.correct + w.incorrect)) * 100, n: w.correct + w.incorrect }));
  const half = Math.floor(engineLogs.length / 2);
  const period = (l: EnrichmentLog[]) => ({
    n: l.length,
    phone: l.length ? l.filter((x) => (x.found?.verifiedPhones ?? 0) > 0).length / l.length : null,
    searches: l.filter((x) => x.strategies).length ? l.reduce((n, x) => n + (x.strategies?.length ?? 0), 0) / l.filter((x) => x.strategies).length : null,
    ms: l.length ? l.reduce((n, x) => n + (x.durationMs ?? 0), 0) / l.length : null,
  });
  const before = period(engineLogs.slice(0, half));
  const after = period(engineLogs.slice(half));
  const firstUse = new Map<string, string>();
  for (const a of attempts) if (!firstUse.has(a.strategyId) || a.timestamp < firstUse.get(a.strategyId)!) firstUse.set(a.strategyId, a.timestamp);
  const recent = Date.now() - 7 * 86_400_000;
  const discovered = summaries.filter((s) => s.found > 0 && firstUse.has(s.id) && new Date(firstUse.get(s.id)!).getTime() > recent);
  const abandoned = summaries.filter((s) => s.attempts >= 10 && (s.successRate ?? 0) < 0.05);
  const isAdmin = settings.role === 'owner' || settings.role === 'admin';

  return (
    <>
      <Card>
        <CardTitle>Couverture et précision</CardTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Contacts vérifiés / entreprise" value={analysed.size ? (verifiedContacts / analysed.size).toFixed(2).replace('.', ',') : '—'} hint="Verified Contact Rate" />
          <StatCard label="Téléphone vérifié" value={pct(rate(companiesWith(contacts.phones)))} hint="des entreprises enrichies" />
          <StatCard label="E-mail vérifié" value={pct(rate(companiesWith(contacts.emails)))} hint="des entreprises enrichies" />
          <StatCard label="Site confirmé" value={pct(rate(companiesWith(contacts.websites)))} hint="des entreprises enrichies" />
          <StatCard label="Précision mesurée" value={pct(correct + incorrect ? correct / (correct + incorrect) : null)} hint={`${nf.format(correct + incorrect)} retour(s) ✓ / ✗`} />
          <StatCard label="Précision estimée" value={pct(found ? estimatedCorrect / found : null)} hint="vérifiées, moins les faux positifs" />
          <StatCard label="Faux positifs" value={pct(found ? incorrect / found : null)} hint={`${nf.format(incorrect)} signalé(s)`} />
          <StatCard label="Recherches / entreprise" value={avgSearches === null ? '—' : avgSearches.toFixed(1).replace('.', ',')} hint={`${nf.format(providerErrors)} erreur(s) de source`} />
        </div>
      </Card>

      <Card>
        <CardTitle>🧠 Performance de l’IA</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Le moteur choisit chaque recherche selon ces statistiques réelles : {Math.round((1 - (settings.exploration ?? LEARNING_CONFIG.exploration)) * 100)} % meilleures stratégies,{' '}
          {Math.round((settings.exploration ?? LEARNING_CONFIG.exploration) * 100)} % exploration. Trouvé ≠ correct : la précision déduit les faux positifs signalés.
        </p>
        {summaries.length === 0 ? (
          <p className="text-sm text-muted">Aucune stratégie exécutée pour l'instant : lancez un enrichissement.</p>
        ) : (
          <>
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-surface-2 p-3 text-sm">
                <p className="mb-1 font-semibold text-success">Meilleures stratégies</p>
                {best.length ? best.map((s) => <p key={s.id}>{s.label}</p>) : <p className="text-muted">Au moins 5 essais nécessaires.</p>}
              </div>
              <div className="rounded-xl bg-surface-2 p-3 text-sm">
                <p className="mb-1 font-semibold text-warning">Stratégies faibles</p>
                {weak.length ? weak.map((s) => <p key={s.id}>{s.label}</p>) : <p className="text-muted">—</p>}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Stratégie</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Essais</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Réussite</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Trouvées</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Précision</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Faux positifs</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Coût moyen</th>
                    <th className="py-1.5 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.id} className="border-t border-line">
                      <td className="py-1.5 pr-3">{s.label}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{nf.format(s.attempts)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pct(s.successRate)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{nf.format(s.found)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{pct(s.precision)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{nf.format(s.falsePositive)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{s.averageCost === null ? '—' : `${s.averageCost.toFixed(1).replace('.', ',')} req.`}</td>
                      <td className="py-1.5 text-right font-semibold tabular-nums">{s.score === null ? '—' : s.score.toFixed(2).replace('.', ',')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 className="mb-2 mt-5 text-sm font-semibold">Sources</h3>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-sm">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-1.5 pr-3 font-medium">Source</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Recherches</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Trouvées</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Vérifiées</th>
                    <th className="py-1.5 text-right font-medium">Faux positifs</th>
                  </tr>
                </thead>
                <tbody>
                  {[...bySourceAgg.entries()].map(([src, a]) => (
                    <tr key={src} className="border-t border-line">
                      <td className="py-1.5 pr-3">{src}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{nf.format(a.attempts)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{nf.format(a.found)}</td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">{nf.format(a.verified)}</td>
                      <td className="py-1.5 text-right tabular-nums">{nf.format(a.falsePositive)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card>
        <CardTitle>📈 Apprentissage</CardTitle>
        <div className="grid gap-5 lg:grid-cols-2">
          <WeekBars title="Couverture : entreprises avec un téléphone vérifié trouvé" entries={coverage} />
          <WeekBars title="Précision mesurée (vos retours ✓ / ✗)" entries={precisionWeeks} />
        </div>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-semibold">Corrections utilisateur</p>
            <p className="text-xl font-bold tabular-nums">{nf.format(feedback.length)}</p>
            <p className="text-xs text-muted">
              avis finaux : {nf.format(correct)} ✓ · {nf.format(incorrect)} ✗ (dont corrections de fiche)
            </p>
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-semibold">Stratégies nouvellement productives</p>
            {discovered.length ? discovered.map((s) => <p key={s.id}>{s.label}</p>) : <p className="text-muted">— (7 derniers jours)</p>}
          </div>
          <div className="rounded-xl bg-surface-2 p-3">
            <p className="font-semibold">Stratégies délaissées</p>
            {abandoned.length ? abandoned.map((s) => <p key={s.id}>{s.label}</p>) : <p className="text-muted">— (moins de 5 % de réussite après 10 essais)</p>}
          </div>
        </div>
        {engineLogs.length >= 4 && (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <caption className="mb-2 text-left font-semibold">Avant / après (première moitié des enrichissements comparée à la seconde)</caption>
              <thead className="text-left text-muted">
                <tr>
                  <th className="py-1.5 pr-3 font-medium">Indicateur</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Avant ({nf.format(before.n)})</th>
                  <th className="py-1.5 text-right font-medium">Après ({nf.format(after.n)})</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-line">
                  <td className="py-1.5 pr-3">Téléphone vérifié trouvé</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{pct(before.phone)}</td>
                  <td className="py-1.5 text-right tabular-nums">{pct(after.phone)}</td>
                </tr>
                <tr className="border-t border-line">
                  <td className="py-1.5 pr-3">Recherches par entreprise</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{before.searches?.toFixed(1).replace('.', ',') ?? '—'}</td>
                  <td className="py-1.5 text-right tabular-nums">{after.searches?.toFixed(1).replace('.', ',') ?? '—'}</td>
                </tr>
                <tr className="border-t border-line">
                  <td className="py-1.5 pr-3">Temps moyen</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">{before.ms === null ? '—' : `${(before.ms / 1000).toFixed(1).replace('.', ',')} s`}</td>
                  <td className="py-1.5 text-right tabular-nums">{after.ms === null ? '—' : `${(after.ms / 1000).toFixed(1).replace('.', ',')} s`}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {isAdmin && attempts.length > 0 && (
        <Card>
          <details>
            <summary className="cursor-pointer font-semibold">🔧 Vue technique — dernières stratégies exécutées ({nf.format(Math.min(100, attempts.length))})</summary>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[56rem] text-xs">
                <thead className="text-left text-muted">
                  <tr>
                    <th className="py-1 pr-2 font-medium">Entreprise</th>
                    <th className="py-1 pr-2 font-medium">Stratégie</th>
                    <th className="py-1 pr-2 font-medium">Requête / cible</th>
                    <th className="py-1 pr-2 font-medium">Mode</th>
                    <th className="py-1 pr-2 text-right font-medium">Résultats</th>
                    <th className="py-1 pr-2 text-right font-medium">Tél.</th>
                    <th className="py-1 pr-2 text-right font-medium">E-mails</th>
                    <th className="py-1 pr-2 text-right font-medium">Vérifiés</th>
                    <th className="py-1 pr-2 text-right font-medium">Durée</th>
                    <th className="py-1 font-medium">Erreur</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.slice(0, 100).map((a) => (
                    <tr key={a.id} className="border-t border-line align-top">
                      <td className="py-1 pr-2">{names.get(a.prospectId) ?? '—'}</td>
                      <td className="py-1 pr-2">
                        {strategyLabel(a.strategyId)}
                        {a.explored && <span className="ml-1 text-muted">(exploration)</span>}
                      </td>
                      <td className="max-w-[16rem] truncate py-1 pr-2" title={a.query}>
                        {a.query}
                      </td>
                      <td className="py-1 pr-2">{MODE_LABEL[a.mode]}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{a.resultCount}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{a.phonesFound}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{a.emailsFound}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{a.verified}</td>
                      <td className="py-1 pr-2 text-right tabular-nums">{(a.executionMs / 1000).toFixed(1).replace('.', ',')} s</td>
                      <td className="py-1 text-danger">{a.error ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </Card>
      )}
    </>
  );
}

function weekOf(iso: string): string {
  const d = new Date(iso);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return `sem. du ${monday.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}`;
}

export function PerformancePage() {
  const { data } = useQuery(async (a) => {
    const [rows, contacts, logs, stats, sources, feedback, attempts, settings] = await Promise.all([
      a.allRows(),
      a.allContacts(),
      a.allEnrichmentLogs(),
      a.strategyStats(),
      a.sourcePerformance(),
      a.feedbackList(),
      a.attemptLogs(),
      a.getSettings(),
    ]);
    return { rows: rows.filter((r) => !r.demo), contacts, logs, stats, sources, feedback, attempts, settings };
  }, []);
  if (!data) return <Skeleton className="h-96" />;
  const { rows, contacts, logs } = data;
  const phones = contacts.phones.filter((c) => c.status !== 'rejected');
  const engineLogs = logs.filter((l) => l.provider === 'moteur');
  const analysed = new Set(engineLogs.map((l) => l.prospectId)).size;
  const withPhone = rows.filter((r) => r.phone).length;
  const verified = rows.filter((r) => r.phone && r.phoneStatus === 'verified').length;
  const durations = engineLogs.map((l) => l.durationMs ?? 0).filter((d) => d > 0);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const errors = logs.filter((l) => l.status === 'failed').length;
  const rejected = contacts.phones.filter((c) => c.status === 'rejected').length;
  const shared = phones.filter((c) => c.shared).length;

  return (
    <>
      <PageHeader title="Performance de l'enrichissement" subtitle="Quantité, exactitude et provenance des coordonnées trouvées — calculées sur vos données réelles." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Entreprises analysées" value={nf.format(analysed)} hint={`sur ${nf.format(rows.length)} prospects réels`} />
          <StatCard label="Téléphones trouvés" value={nf.format(phones.length)} hint={`${nf.format(withPhone)} prospects avec téléphone`} />
          <StatCard label="Téléphones vérifiés" value={nf.format(verified)} hint="🟢 fortement associés (principal)" />
          <StatCard label="Taux de réussite" value={pctFmt(rows.length ? (withPhone / rows.length) * 100 : null)} hint="prospects avec téléphone" />
          <StatCard label="E-mails trouvés" value={nf.format(contacts.emails.filter((c) => c.status !== 'rejected').length)} />
          <StatCard label="Sites trouvés" value={nf.format(contacts.websites.filter((c) => c.status !== 'rejected').length)} hint={`${nf.format(contacts.websites.filter((c) => c.verified).length)} vérifiés`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SourceBars title="Téléphones — sources les plus efficaces" entries={bySource(contacts.phones)} />
          <SourceBars title="E-mails et sites — sources" entries={bySource([...contacts.emails, ...contacts.websites])} />
        </div>

        <Card>
          <CardTitle>Qualité</CardTitle>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Faux positifs signalés</dt>
              <dd className="text-xl font-bold tabular-nums">{nf.format(rejected)}</dd>
              <dd className="text-xs text-muted">numéros écartés par vous</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Numéros partagés</dt>
              <dd className="text-xl font-bold tabular-nums">{nf.format(shared)}</dd>
              <dd className="text-xs text-muted">confiance réduite</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Temps moyen / entreprise</dt>
              <dd className="text-xl font-bold tabular-nums">{avg !== null ? `${(avg / 1000).toFixed(1).replace('.', ',')} s` : '—'}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Erreurs</dt>
              <dd className="text-xl font-bold tabular-nums">{nf.format(errors)}</dd>
            </div>
          </dl>
        </Card>

        <LearningSections data={data} />

        <Alert tone="info" title="Sources configurées">
          Données publiques officielles (SIRENE) · Annuaire public OpenStreetMap ({OSM_ATTRIBUTION}) ·{' '}
          {ENRICHMENT_CONFIG.webProxyUrl ? 'Sites officiels des entreprises (relais web actif)' : 'Sites officiels : relais web non configuré (voir Paramètres)'} · Imports CSV et saisies manuelles. Recherche
          automatique des coordonnées professionnelles disponibles : tous les numéros ne sont pas publics.
        </Alert>
      </div>
    </>
  );
}
