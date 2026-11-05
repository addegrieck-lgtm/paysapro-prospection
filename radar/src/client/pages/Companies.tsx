import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api, qs, type CompanyRow } from '../api';
import { useApp } from '../App';
import { CompanyTable } from '../components/CompanyTable';
import { FilterPanel, useFilters } from '../components/Filters';
import { Button, Card, ErrorBox, Field, inputCls, Loading, PageHeader, Pagination, useApi } from '../components/ui';

interface Result {
  rows: CompanyRow[];
  total: number;
  page: number;
  pageSize: number;
}
interface Saved {
  id: number;
  name: string;
  query: string;
  alert_enabled: number;
  last_count: number | null;
}

/** Liste filtrée réutilisée par plusieurs pages (préfiltres imposés). */
export function CompanyList({ preset = {}, hide = [], title }: { preset?: Record<string, string>; hide?: string[]; title?: string }) {
  const f = useFilters();
  const query = { ...f.values, ...preset };
  delete query.communeCenter;
  delete query.onglet;
  const key = JSON.stringify(query);
  const { data, error, loading, reload } = useApi(() => api.get<Result>(`/companies${qs(query)}`), [key]);
  return (
    <>
      <FilterPanel f={f} hide={hide} />
      <ErrorBox error={error} onRetry={reload} />
      <Card title={title} pad={false}>
        {loading && !data ? <Loading /> : data && <CompanyTable rows={data.rows} showDistance={!!query.radiusKm} />}
        {data && data.total > 0 && (
          <div className="border-t border-ink-700 px-3">
            <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => f.set({ page: String(p) })} />
          </div>
        )}
      </Card>
    </>
  );
}

export default function Companies() {
  const { can } = useApp();
  const nav = useNavigate();
  const f = useFilters();
  const saved = useApi(() => api.get<{ rows: Saved[] }>('/searches'), []);
  const [name, setName] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const query = { ...f.values };
  delete query.page;
  delete query.communeCenter;
  const save = async () => {
    if (!name.trim()) return;
    try {
      await api.post('/searches', { name, query, alert: true });
      setName('');
      saved.reload();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <div className="fade-in">
      <PageHeader
        title="Toutes les entreprises"
        subtitle="Recherche multicritère sur les entreprises synchronisées. Les notes ne sont attribuées que lorsque les données le permettent."
        actions={
          can('analyste') && (
            <>
              <a className="inline-flex h-9 items-center rounded-lg border border-ink-600 bg-ink-750 px-3.5 text-sm hover:bg-ink-700" href={`/api/export${qs({ ...query, format: 'csv' })}`}>
                Export CSV
              </a>
              <a className="inline-flex h-9 items-center rounded-lg border border-ink-600 bg-ink-750 px-3.5 text-sm hover:bg-ink-700" href={`/api/export${qs({ ...query, format: 'xlsx' })}`}>
                Export Excel
              </a>
            </>
          )
        }
      />
      <CompanyList />
      <Card title="Recherches enregistrées" className="mt-5">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label="Enregistrer la recherche actuelle (avec alerte sur les nouveaux résultats)">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Agences web rentables près de Rouen" />
          </Field>
          <Button onClick={save} disabled={!name.trim()}>
            Enregistrer
          </Button>
        </div>
        <ErrorBox error={err ?? saved.error} />
        {saved.data?.rows.length ? (
          <ul className="divide-y divide-ink-700 text-sm">
            {saved.data.rows.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <button className="text-left text-volt-300 hover:underline" onClick={() => nav(`/entreprises${qs(JSON.parse(s.query))}`)}>
                  {s.name}
                </button>
                <span className="flex items-center gap-3 text-xs text-fog-400">
                  {s.last_count ?? 0} résultat(s)
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={!!s.alert_enabled} onChange={(e) => api.patch(`/searches/${s.id}`, { alert: e.target.checked }).then(saved.reload)} />
                    alerte
                  </label>
                  <button className="text-fog-500 hover:text-bad" onClick={() => api.del(`/searches/${s.id}`).then(saved.reload)}>
                    Supprimer
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-fog-500">Aucune recherche enregistrée.</p>
        )}
      </Card>
    </div>
  );
}
