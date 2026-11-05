import { Link } from 'react-router';
import { api, qs } from '../api';
import { useApp } from '../App';
import { useFilters } from '../components/Filters';
import { Badge, Card, Empty, ErrorBox, inputCls, Loading, Notice, PageHeader, ScoreCell, Table, Tabs, td, useApi } from '../components/ui';
import { date, eur } from '../lib/format';

interface Row {
  id: number;
  company_id: number;
  name: string;
  siren: string;
  commune_name: string | null;
  sector_id: string | null;
  type: string;
  status: string;
  opened_at: string | null;
  last_event_at: string | null;
  closed_at: string | null;
  closure_reason: string | null;
  tribunal: string | null;
  latest_nature: string | null;
  administrator: string | null;
  url: string | null;
  economic_score: number | null;
  risk_score: number | null;
  revenue: number | null;
  last_year: number | null;
}

const STATUS_TONE: Record<string, string> = { ouverte: 'border-bad/40 text-red-300', en_cours: 'border-warn/40 text-amber-200', plan_arrete: 'border-volt-500/40 text-volt-300', cession_arretee: 'border-cat-1/40 text-blue-200', cloturee: '' };

export default function Proceedings() {
  const { meta } = useApp();
  const f = useFilters({ scope: 'actives' });
  const v = f.values;
  const { data, error, loading, reload } = useApi(() => api.get<{ rows: Row[] }>(`/proceedings${qs({ scope: v.scope, type: v.type, status: v.status })}`), [v.scope, v.type, v.status]);
  return (
    <div className="fade-in">
      <PageHeader title="Procédures judiciaires" subtitle="Sauvegardes, redressements et liquidations publiés au BODACC, reconstitués jugement par jugement." />
      <Notice>
        Statuts strictement distingués : <strong>ouverte</strong> (jugement d'ouverture seul), <strong>en cours</strong> (étapes ultérieures), <strong>plan arrêté</strong>, <strong>plan de cession arrêté</strong>, <strong>clôturée</strong>. Le mandataire ou liquidateur n'est affiché que tel qu'il figure dans le texte officiel publié.
      </Notice>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <Tabs value={v.scope as 'actives'} onChange={(scope) => f.set({ scope })} items={[{ id: 'actives', label: 'Non clôturées' }, { id: 'cloturees', label: 'Clôturées' }, { id: 'toutes', label: 'Toutes' }]} />
        <select className={`${inputCls} mb-4 w-auto`} value={v.type ?? ''} onChange={(e) => f.set({ type: e.target.value })} aria-label="Type de procédure">
          <option value="">Tous types</option>
          {Object.entries(meta.procTypeLabels).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <select className={`${inputCls} mb-4 w-auto`} value={v.status ?? ''} onChange={(e) => f.set({ status: e.target.value })} aria-label="Statut">
          <option value="">Tous statuts</option>
          {Object.entries(meta.procStatusLabels).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      <Card pad={false}>
        {loading && !data ? (
          <Loading />
        ) : data?.rows.length ? (
          <Table head={['Entreprise', 'Procédure', 'Statut', 'Ouverture', 'Dernier jugement', 'Tribunal / mandataire publié', 'CA', 'Score / risque']}>
            {data.rows.map((r) => (
              <tr key={r.id} className="hover:bg-ink-750/50">
                <td className={td}>
                  <Link to={`/entreprises/${r.company_id}`} className="font-medium text-fog-50 hover:text-volt-300">
                    {r.name}
                  </Link>
                  <div className="text-xs text-fog-500">
                    {r.siren} · {r.commune_name ?? '—'}
                  </div>
                </td>
                <td className={td}>{meta.procTypeLabels[r.type] ?? r.type}</td>
                <td className={td}>
                  <Badge className={STATUS_TONE[r.status]}>{meta.procStatusLabels[r.status] ?? r.status}</Badge>
                  {r.closure_reason && <div className="mt-1 text-[11px] text-fog-500">{r.closure_reason}</div>}
                </td>
                <td className={`${td} whitespace-nowrap text-xs`}>{date(r.opened_at)}</td>
                <td className={`${td} text-xs`}>
                  <div>{date(r.last_event_at)}</div>
                  <div className="max-w-56 text-fog-500">{r.latest_nature}</div>
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-volt-300 hover:underline">
                      Annonce BODACC ↗
                    </a>
                  )}
                </td>
                <td className={`${td} max-w-72 text-xs text-fog-400`}>
                  <div>{r.tribunal ?? '—'}</div>
                  {r.administrator && <div className="mt-1 text-fog-300">« {r.administrator} »</div>}
                </td>
                <td className={`${td} whitespace-nowrap tabular`}>
                  {eur(r.revenue, true)} <span className="text-xs text-fog-500">{r.last_year ?? ''}</span>
                </td>
                <td className={td}>
                  <div className="space-y-1">
                    <ScoreCell value={r.economic_score} />
                    <ScoreCell value={r.risk_score} kind="risk" />
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Aucune procédure ne correspond">La source BODACC alimente cette page à chaque veille quotidienne.</Empty>
        )}
      </Card>
    </div>
  );
}
