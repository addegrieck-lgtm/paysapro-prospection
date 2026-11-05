import { useState } from 'react';
import { Link } from 'react-router';
import { api, qs } from '../api';
import { useApp } from '../App';
import { Button, Card, Empty, ErrorBox, inputCls, Loading, PageHeader, Pagination, useApi } from '../components/ui';
import { dateTime } from '../lib/format';

interface Alert {
  id: number;
  type: string;
  severity: 'info' | 'positif' | 'attention' | 'critique';
  company_id: number | null;
  company_name: string | null;
  title: string;
  message: string | null;
  created_at: string;
  read_at: string | null;
}

const SEV: Record<string, { icon: string; cls: string; label: string }> = {
  critique: { icon: '■', cls: 'text-bad', label: 'Critique' },
  attention: { icon: '◆', cls: 'text-warn', label: 'Attention' },
  positif: { icon: '▲', cls: 'text-good', label: 'Positif' },
  info: { icon: '●', cls: 'text-volt-400', label: 'Info' },
};

export default function Alerts({ onRead }: { onRead: () => void }) {
  const { meta } = useApp();
  const [unread, setUnread] = useState(false);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(() => api.get<{ rows: Alert[]; total: number; unread: number }>(`/alerts${qs({ unread: unread ? 1 : undefined, type, page })}`), [unread, type, page]);
  const mark = async (body: { ids?: number[]; all?: boolean }) => {
    await api.post('/alerts/read', body);
    reload();
    onRead();
  };
  return (
    <div className="fade-in">
      <PageHeader
        title="Alertes"
        subtitle="Produites par la veille quotidienne : nouvelles procédures, annonces, signaux, évolutions financières documentées, scores élevés, sources en erreur. Seuils réglables dans l'administration."
        actions={
          data?.unread ? (
            <Button onClick={() => mark({ all: true })}>Tout marquer comme lu ({data.unread})</Button>
          ) : undefined
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className={`${inputCls} sm:max-w-72`} value={type} onChange={(e) => (setType(e.target.value), setPage(1))} aria-label="Type d'alerte">
          <option value="">Tous les types</option>
          {Object.entries(meta.alertTypes).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-fog-300">
          <input type="checkbox" checked={unread} onChange={(e) => (setUnread(e.target.checked), setPage(1))} /> Non lues seulement
        </label>
      </div>
      <ErrorBox error={error} onRetry={reload} />
      <Card pad={false}>
        {loading && !data ? (
          <Loading />
        ) : data?.rows.length ? (
          <ul className="divide-y divide-ink-700">
            {data.rows.map((a) => (
              <li key={a.id} className={`flex gap-3 px-4 py-3 ${a.read_at ? 'opacity-60' : ''}`}>
                <span className={`${SEV[a.severity]?.cls} mt-0.5 text-sm`} aria-label={SEV[a.severity]?.label}>
                  {SEV[a.severity]?.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-fog-50">{a.title}</span>
                    <span className="text-[11px] text-fog-500">
                      {meta.alertTypes[a.type] ?? a.type} · {dateTime(a.created_at)}
                    </span>
                  </div>
                  {a.message && <p className="mt-0.5 break-words text-xs text-fog-400">{a.message}</p>}
                  <div className="mt-1 flex gap-3 text-xs">
                    {a.company_id && (
                      <Link className="text-volt-300 hover:underline" to={`/entreprises/${a.company_id}`} onClick={() => !a.read_at && void mark({ ids: [a.id] })}>
                        Voir {a.company_name ?? 'la fiche'} →
                      </Link>
                    )}
                    {!a.read_at && (
                      <button className="text-fog-500 hover:text-fog-100" onClick={() => mark({ ids: [a.id] })}>
                        Marquer comme lue
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="Aucune alerte">Les alertes apparaissent après chaque veille.</Empty>
        )}
        {data && data.total > 50 && (
          <div className="border-t border-ink-700 px-3">
            <Pagination page={page} pageSize={50} total={data.total} onPage={setPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
