import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { api } from '../api';
import { useApp } from '../App';
import { BarList, StackedColumns } from '../components/charts';
import { Button, Card, Empty, ErrorBox, Loading, Notice, OppBadge, PageHeader, ScoreCell, Stat, Table, td, useApi } from '../components/ui';
import { ago, eur, OPP_HEX, OPP_SHORT } from '../lib/format';

interface Dash {
  counts: { total: number; forSale: number; procedures: number; transmission: number; hidden: number; newOpps: number; withFin: number; alertsUnread: number };
  procByType: { type: string; status: string; n: number }[];
  bySector: { sector_id: string; n: number; opps: number }[];
  byCommune: { commune: string; n: number; opps: number }[];
  discoveries: { day: string; primary_type: string; n: number }[];
  top: { id: number; siren: string; name: string; commune_name: string | null; sector_id: string | null; primary_type: string; economic_score: number; risk_score: number; reliability_score: number; data_status: string; revenue: number | null; net_income: number | null; last_year: number | null; valuation_central: number | null }[];
  sources: { id: string; label: string; enabled: number; last_sync_at: string | null; last_success_at: string | null; last_status: string | null; last_error: string | null }[];
  lastRun: { id: number; status: string; started_at: string; finished_at: string | null; summary: Record<string, { status: string; created: number; updated: number; errors: number }> | null } | null;
}

function weekOf(day: string) {
  const d = new Date(`${day}T12:00:00`);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export default function Dashboard() {
  const { meta, can } = useApp();
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<Dash>('/dashboard'), []);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState<unknown>(null);
  const sectorLabel = (id: string) => meta.sectors.find((s) => s.id === id)?.label ?? (id === 'autre' ? 'Hors secteurs suivis' : id);

  const start = async () => {
    setStarting(true);
    setStartErr(null);
    try {
      await api.post('/admin/sync/start', {});
      nav('/admin/synchronisations?auto=1');
    } catch (e) {
      setStartErr(e);
    } finally {
      setStarting(false);
    }
  };

  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data!;
  const lastRunBanner =
    d.lastRun && d.lastRun.status !== 'success' ? (
      <Notice tone="warn">
        {d.lastRun.status === 'running' ? (
          <>Veille en cours depuis {ago(d.lastRun.started_at)} : les chiffres ci-dessous ne sont pas encore complets.</>
        ) : (
          <>
            Dernière veille <strong>{d.lastRun.status === 'partial' ? 'partielle' : 'en erreur'}</strong> ({ago(d.lastRun.finished_at)}) : certaines sources n'ont pas pu être interrogées, les résultats ne sont pas exhaustifs.{' '}
            {can('admin') && (
              <Link className="underline" to="/admin/synchronisations">
                Voir le journal
              </Link>
            )}
          </>
        )}
      </Notice>
    ) : null;

  if (d.counts.total === 0) {
    return (
      <>
        <PageHeader title="Vue générale" subtitle={`Seine-Maritime (${meta.departments.join(', ')})`} />
        {lastRunBanner}
        <Card>
          <Empty
            title="Aucune entreprise réelle n'est encore enregistrée"
            action={
              can('admin') ? (
                <div className="flex flex-col items-center gap-2">
                  <Button variant="primary" busy={starting} onClick={start}>
                    Lancer la première synchronisation
                  </Button>
                  <ErrorBox error={startErr} />
                </div>
              ) : (
                <span className="text-xs">Demandez à un administrateur de lancer la synchronisation.</span>
              )
            }
          >
            Le tableau de bord ne montre que des données issues de sources vérifiables : aucune entreprise fictive n'est affichée. La première veille interroge l'annuaire officiel des entreprises (SIRENE / RNE), le BODACC et le référentiel des communes ; elle avance par étapes et peut prendre plusieurs heures pour tout le département.
          </Empty>
        </Card>
      </>
    );
  }

  const weeks = new Map<string, Record<string, number>>();
  for (const r of d.discoveries) {
    const w = weekOf(r.day);
    const v = weeks.get(w) ?? {};
    v[r.primary_type] = (v[r.primary_type] ?? 0) + r.n;
    weeks.set(w, v);
  }
  const series = ['a_vendre', 'procedure', 'transmission', 'cachee'].map((k) => ({ key: k, label: OPP_SHORT[k]!, color: OPP_HEX[k]! }));
  const procActive = d.procByType.filter((p) => p.status !== 'cloturee');
  const sum = (t: string) => procActive.filter((p) => p.type === t).reduce((a, p) => a + p.n, 0);

  return (
    <div className="fade-in space-y-5">
      <PageHeader title="Vue générale" subtitle={`Seine-Maritime (${meta.departments.join(', ')}) · données officielles et calculs explicables`} />
      {lastRunBanner}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <Stat label="Entreprises recensées" value={d.counts.total.toLocaleString('fr-FR')} to="/entreprises" />
        <Stat label="Officiellement à vendre" value={d.counts.forSale} to="/a-vendre" />
        <Stat label="En procédure collective" value={d.counts.procedures} to="/procedures" tone={d.counts.procedures ? 'warn' : undefined} />
        <Stat label="Signaux de transmission" value={d.counts.transmission} to="/transmissions" />
        <Stat label="Pistes de prospection" value={d.counts.hidden} hint="non déclarées à vendre" to="/transmissions?onglet=pistes" />
        <Stat label="Nouvelles (7 jours)" value={d.counts.newOpps} tone={d.counts.newOpps ? 'good' : undefined} />
        <Stat label="Opportunités chiffrées" value={d.counts.withFin} hint="comptes publiés exploitables" />
        <Stat label="Alertes non lues" value={d.counts.alertsUnread} to="/alertes" tone={d.counts.alertsUnread ? 'warn' : undefined} />
      </div>

      <Card
        title="TOP OPPORTUNITÉS"
        actions={
          <Link to="/entreprises?sort=score&opportunityTypes=a_vendre,procedure,transmission,cachee" className="text-xs text-volt-300 hover:underline">
            Voir tout →
          </Link>
        }
        pad={false}
      >
        {d.top.length ? (
          <Table head={['#', 'Entreprise', 'Situation', 'Score économique', 'Risque', 'Fiabilité', 'Dernier CA', 'Valeur centrale']}>
            {d.top.map((r, i) => (
              <tr key={r.id} className="hover:bg-ink-750/50">
                <td className={`${td} text-fog-500 tabular`}>{i + 1}</td>
                <td className={td}>
                  <Link to={`/entreprises/${r.id}`} className="font-medium text-fog-50 hover:text-volt-300">
                    {r.name}
                  </Link>
                  <div className="text-xs text-fog-500">
                    {[r.commune_name, r.sector_id ? sectorLabel(r.sector_id) : null].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td className={td}>
                  <OppBadge type={r.primary_type} />
                </td>
                <td className={td}>
                  <ScoreCell value={r.economic_score} status={r.data_status} />
                </td>
                <td className={td}>
                  <ScoreCell value={r.risk_score} kind="risk" />
                </td>
                <td className={td}>
                  <ScoreCell value={r.reliability_score} kind="rel" />
                </td>
                <td className={`${td} tabular`}>
                  {eur(r.revenue, true)} <span className="text-xs text-fog-500">{r.last_year ?? ''}</span>
                </td>
                <td className={`${td} tabular`}>{eur(r.valuation_central, true)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Aucune opportunité notée pour l'instant">Le classement n'inclut que les entreprises dont les données permettent une note économique (comptes publiés). Les autres restent consultables dans les listes, avec la mention « données insuffisantes ».</Empty>
        )}
        <p className="border-t border-ink-700 px-4 py-2 text-[11px] text-fog-500">Classement par score économique. Le risque et la fiabilité des données sont affichés séparément et doivent être lus ensemble ; les « pistes » ne sont pas des entreprises à vendre.</p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Évolution des découvertes (90 jours)" className="lg:col-span-2">
          {weeks.size ? <StackedColumns data={[...weeks.entries()].map(([x, values]) => ({ x: new Date(`${x}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), values }))} series={series} /> : <Empty title="Pas encore d'historique de découvertes" />}
        </Card>
        <Card title="Procédures collectives en cours">
          <ul className="space-y-2 text-sm">
            {(['sauvegarde', 'redressement', 'liquidation'] as const).map((t) => (
              <li key={t} className="flex items-center justify-between">
                <Link className="text-fog-300 hover:text-fog-50" to={`/procedures?type=${t}`}>
                  {meta.procTypeLabels[t]}
                </Link>
                <span className="tabular font-semibold">{sum(t)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between border-t border-ink-700 pt-2 text-xs text-fog-500">
              <span>Plans de cession arrêtés</span>
              <span className="tabular">{procActive.filter((p) => p.status === 'cession_arretee').reduce((a, p) => a + p.n, 0)}</span>
            </li>
          </ul>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Répartition sectorielle">
          <BarList rows={d.bySector.slice(0, 12).map((s) => ({ key: s.sector_id, label: sectorLabel(s.sector_id), value: s.n, sub: s.opps, onClick: s.sector_id !== 'autre' ? () => nav(`/entreprises?sectors=${s.sector_id}`) : undefined }))} secondary="opp." />
        </Card>
        <Card title="Répartition géographique" actions={<Link to="/carte" className="text-xs text-volt-300 hover:underline">Carte →</Link>}>
          <BarList rows={d.byCommune.map((c) => ({ key: c.commune, label: c.commune, value: c.n, sub: c.opps }))} secondary="opp." />
        </Card>
        <Card title="Dernières mises à jour des sources" actions={can('admin') ? <Link to="/admin/sources" className="text-xs text-volt-300 hover:underline">Gérer →</Link> : undefined}>
          <ul className="space-y-2 text-xs">
            {d.sources.map((s) => (
              <li key={s.id} className="flex items-start justify-between gap-2">
                <span className={s.enabled ? 'text-fog-100' : 'text-fog-500'}>
                  {s.label}
                  {!s.enabled && ' (désactivée)'}
                </span>
                <span className={s.last_status === 'error' ? 'text-bad' : s.last_status === 'skipped' ? 'text-warn' : 'text-fog-400'} title={s.last_error ?? undefined}>
                  {s.last_status === 'error' ? '⚠ erreur' : s.last_status === 'skipped' ? 'non interrogée' : ago(s.last_success_at)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
