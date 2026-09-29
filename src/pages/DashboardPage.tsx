import { Link } from 'react-router';
import { AlarmClock, Flame, Sparkles } from 'lucide-react';
import { FindProspects } from '../components/FindProspects';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { StatCard, Skeleton } from '../components/ui/Extras';
import { FunnelChart, GeoTable } from '../components/charts';
import { ScoreBadge, formatDateShort, nf, pctFmt } from '../components/common';
import { useApp, useQuery } from '../app/context';
import { byGeo, computeKpis, funnel } from '../domain/stats';
import { sortRows, today } from '../domain/filters';
import { TASK_TYPE_LABEL } from '../domain/referentials';

const money = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

export function DashboardPage() {
  const { settings } = useApp();
  const { data } = useQuery(async (api) => {
    const [rows, tasks] = await Promise.all([api.allRows(), api.listTasks()]);
    const kpis = computeKpis(rows, tasks, settings.averageDealValue);
    const priority = sortRows(
      rows.filter((r) => r.score >= 80 && !r.doNotContact && !r.milestones.contacted && !r.demo),
      'score',
    ).slice(0, 6);
    const t = today();
    const due = tasks.filter((x) => !x.done && x.dueAt.slice(0, 10) <= t).slice(0, 6);
    return { rows, kpis, priority, due, geo: byGeo(rows, 'department') };
  }, [settings.averageDealValue]);

  if (!data) return <Skeleton className="h-96" />;
  const { kpis, priority, due, geo } = data;

  return (
    <>
      <PageHeader title="Prospection commerciale" subtitle="Trouvez, qualifiez et transformez les paysagistes en clients." />

      <div className="mb-4">
        <FindProspects />
      </div>
      {kpis.total === 0 ? (
        <p className="text-sm text-muted">
          Vous pouvez aussi <Link to="/import" className="font-medium text-brand hover:underline">importer un fichier CSV</Link> ou charger 100 entreprises fictives pour découvrir l'outil.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Total entreprises" value={nf.format(kpis.total)} />
            <StatCard label="Téléphones trouvés" value={nf.format(kpis.withPhone)} hint="téléphone principal" />
            <StatCard label="Téléphones vérifiés" value={nf.format(kpis.phonesVerified)} hint="🟢 fortement associés" />
            <StatCard label="Taux de téléphone" value={pctFmt(kpis.phoneRate)} />
            <StatCard label="E-mails trouvés" value={nf.format(kpis.withEmail)} />
            <StatCard label="Sites trouvés" value={nf.format(kpis.withWebsite)} />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard label="Prospects" value={nf.format(kpis.total)} />
            <StatCard label="Priorité élevée" value={nf.format(kpis.priority)} hint="score ≥ 80" />
            <StatCard label="À contacter" value={nf.format(kpis.toContact)} />
            <StatCard label="En cours" value={nf.format(kpis.inProgress)} hint="séquence engagée" />
            <StatCard label="Démos" value={nf.format(kpis.demos)} />
            <StatCard label="Clients convertis" value={nf.format(kpis.clients)} />
            <StatCard label="Taux de conversion" value={pctFmt(kpis.conversionRate)} hint="clients / contactés" />
            <StatCard
              label="Valeur potentielle"
              value={kpis.potentialValue !== null ? money.format(kpis.potentialValue) : '—'}
              hint={kpis.potentialValue !== null ? 'prospects ouverts × panier moyen' : <Link to="/settings" className="text-brand hover:underline">Définir le panier moyen</Link>}
            />
          </div>

          <Card>
            <CardTitle icon={<Sparkles className="h-5 w-5" />} action={<Link to="/import" className="text-sm font-medium text-brand hover:underline">Import & enrichissement</Link>}>
              Qualité des données
            </CardTitle>
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  ['Entreprises actives', kpis.active],
                  ['Enrichis', kpis.enriched],
                  ['Partiellement enrichis', kpis.partial],
                  ['Non enrichis', kpis.notEnriched + kpis.failed],
                  ['Avec e-mail', kpis.withEmail],
                  ['Avec téléphone', kpis.withPhone],
                  ['Avec site', kpis.withWebsite],
                  ['Score moyen', kpis.averageScore],
                  ['Relances prévues', kpis.followUpsPlanned],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl bg-surface-2 p-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="text-xl font-bold tabular-nums text-ink">{value === null ? '—' : nf.format(value)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle action={<Link to="/stats" className="text-sm font-medium text-brand hover:underline">Statistiques</Link>}>Funnel commercial</CardTitle>
              <FunnelChart steps={funnel(kpis)} />
            </Card>

            <Card>
              <CardTitle icon={<AlarmClock className="h-5 w-5" />} action={<Link to="/tasks" className="text-sm font-medium text-brand hover:underline">Toutes</Link>}>
                Relances du jour ({nf.format(kpis.followUpsToday)})
              </CardTitle>
              {due.length === 0 ? (
                <p className="text-sm text-muted">Aucune relance due. 👌</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {due.map((t) => (
                    <li key={t.id}>
                      <Link to={`/prospects/${t.prospectId}`} className="flex justify-between gap-2 py-2 hover:text-brand">
                        <span className="font-medium">{t.prospectName}</span>
                        <span className="text-muted">
                          {TASK_TYPE_LABEL[t.type]} · {formatDateShort(t.dueAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle icon={<Flame className="h-5 w-5" />} action={<Link to="/prospects?view=priority" className="text-sm font-medium text-brand hover:underline">Mes prospects prioritaires</Link>}>
                Prioritaires jamais contactés ({nf.format(kpis.priorityNeverContacted)})
              </CardTitle>
              {priority.length === 0 ? (
                <p className="text-sm text-muted">Aucun prospect ≥ 80 en attente. Enrichissez des fiches (site, Google, téléphone) pour faire émerger les meilleurs.</p>
              ) : (
                <ul className="divide-y divide-line text-sm">
                  {priority.map((r) => (
                    <li key={r.id}>
                      <Link to={`/prospects/${r.id}`} className="flex items-center gap-3 py-2 hover:text-brand">
                        <ScoreBadge score={r.score} />
                        <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                        <span className="text-muted">{r.city}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle action={<Link to="/stats" className="text-sm font-medium text-brand hover:underline">Tout voir</Link>}>Répartition géographique</CardTitle>
              <GeoTable lines={geo} limit={8} level="department" compact />
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
