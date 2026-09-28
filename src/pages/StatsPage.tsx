import { useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { StatCard, Skeleton } from '../components/ui/Extras';
import { Segmented } from '../components/ui/Form';
import { BarChart, FunnelChart, GeoTable } from '../components/charts';
import { nf, pctFmt } from '../components/common';
import { useApp, useQuery } from '../app/context';
import { byGeo, computeKpis, evolution, funnel, rates, EVOLUTION_LABEL, type EvolutionMetric, type Granularity } from '../domain/stats';
import { emailProvider } from '../providers/email';

export function StatsPage() {
  const { settings } = useApp();
  const [metric, setMetric] = useState<EvolutionMetric>('new');
  const [gran, setGran] = useState<Granularity>('week');
  const [level, setLevel] = useState<'department' | 'region'>('department');
  const { data } = useQuery(async (api) => {
    const [rows, tasks, campaigns] = await Promise.all([api.allRows(), api.listTasks(), api.listCampaigns()]);
    const real = campaigns.filter((c) => !c.testMode);
    const recipients = real.flatMap((c) => c.recipients);
    return {
      rows,
      kpis: computeKpis(rows, tasks, settings.averageDealValue),
      emails: {
        sent: recipients.filter((r) => r.state === 'sent' || r.state === 'replied').length,
        replied: recipients.filter((r) => r.state === 'replied').length,
      },
    };
  }, [settings.averageDealValue]);

  if (!data) return <Skeleton className="h-96" />;
  const { kpis, rows, emails } = data;
  const r = rates(kpis);

  return (
    <>
      <PageHeader title="Statistiques" subtitle="Calculées en direct depuis votre base." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Prospects" value={nf.format(kpis.total)} />
          <StatCard label="Contacts" value={nf.format(kpis.contacted)} hint={`Taux de contact ${pctFmt(r.contactRate)}`} />
          <StatCard label="Réponses" value={nf.format(kpis.replies)} hint={`Taux de réponse ${pctFmt(r.replyRate)}`} />
          <StatCard label="Démos" value={nf.format(kpis.demos)} hint={`Taux de démo ${pctFmt(r.demoRate)}`} />
          <StatCard label="Essais" value={nf.format(kpis.trials)} />
          <StatCard label="Clients" value={nf.format(kpis.clients)} hint={`Conversion ${pctFmt(r.conversionRate)}`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardTitle>Funnel commercial</CardTitle>
            <FunnelChart steps={funnel(kpis)} />
          </Card>
          <Card>
            <CardTitle>E-mails de campagne</CardTitle>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted">Envoyés</dt>
                <dd className="text-xl font-bold tabular-nums">{nf.format(emails.sent)}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted">Réponses</dt>
                <dd className="text-xl font-bold tabular-nums">{nf.format(emails.replied)}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted">Livrés / ouverts / cliqués</dt>
                <dd className="text-sm">{emailProvider.tracking ? '—' : 'Non mesurables avec votre messagerie (envoi gratuit)'}</dd>
              </div>
              <div className="rounded-xl bg-surface-2 p-3">
                <dt className="text-muted">Démos · essais · clients</dt>
                <dd className="text-xl font-bold tabular-nums">
                  {nf.format(kpis.demos)} · {nf.format(kpis.trials)} · {nf.format(kpis.clients)}
                </dd>
              </div>
            </dl>
          </Card>
        </div>

        <Card>
          <CardTitle>Évolution</CardTitle>
          <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="sr-only">Indicateur</span>
              <select value={metric} onChange={(e) => setMetric(e.target.value as EvolutionMetric)} className="min-h-11 w-full rounded-xl border border-line bg-surface px-3">
                {Object.entries(EVOLUTION_LABEL).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <Segmented<Granularity>
              label="Période"
              value={gran}
              onChange={setGran}
              options={[
                { value: 'day', label: 'Jour' },
                { value: 'week', label: 'Semaine' },
                { value: 'month', label: 'Mois' },
              ]}
            />
          </div>
          <BarChart buckets={evolution(rows, metric, gran)} label={`${EVOLUTION_LABEL[metric]} par ${gran === 'day' ? 'jour (30 j)' : gran === 'week' ? 'semaine (12 sem.)' : 'mois (12 mois)'}`} />
        </Card>

        <Card>
          <CardTitle action={<Segmented label="Niveau" value={level} onChange={setLevel} options={[{ value: 'department', label: 'Départements' }, { value: 'region', label: 'Régions' }]} />}>
            Répartition géographique
          </CardTitle>
          <GeoTable lines={byGeo(rows, level)} level={level} />
        </Card>
      </div>
    </>
  );
}
