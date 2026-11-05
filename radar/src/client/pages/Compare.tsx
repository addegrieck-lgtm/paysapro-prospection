import { Link } from 'react-router';
import { api } from '../api';
import { useApp } from '../App';
import { CompanyPicker } from '../components/CompanyPicker';
import { Button, Card, Empty, ErrorBox, Loading, OppBadge, PageHeader, ScoreCell, useApi } from '../components/ui';
import { date, eur, isNum, pct, years } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Compare() {
  const { compare, toggleCompare, meta } = useApp();
  const { data, error, loading, reload } = useApi(() => (compare.length ? api.get<{ items: any[] }>(`/compare?ids=${compare.join(',')}`) : Promise.resolve({ items: [] })), [compare.join(',')]);
  const items = data?.items ?? [];
  const last = (it: any) => it.financials[it.financials.length - 1];
  const rows: { label: string; get: (it: any) => React.ReactNode; best?: (it: any) => number | null; higher?: boolean }[] = [
    { label: 'Situation', get: (it) => <OppBadge type={it.opportunity?.primary_type} /> },
    { label: 'Secteur', get: (it) => meta.sectors.find((s) => s.id === it.company.sector_id)?.label ?? it.company.naf_code ?? '—' },
    { label: 'Commune', get: (it) => it.company.commune_name ?? '—' },
    { label: 'Ancienneté', get: (it) => years(it.company.creation_date) },
    { label: 'Effectif', get: (it) => meta.headcountBands[it.company.headcount_band]?.label ?? '—' },
    { label: 'Score économique', get: (it) => <ScoreCell value={it.score?.economic_score} status={it.score?.data_status} />, best: (it) => it.score?.economic_score ?? null, higher: true },
    { label: 'Score de risque', get: (it) => <ScoreCell value={it.score?.risk_score} kind="risk" />, best: (it) => it.score?.risk_score ?? null, higher: false },
    { label: 'Fiabilité des données', get: (it) => <ScoreCell value={it.score?.reliability_score} kind="rel" />, best: (it) => it.score?.reliability_score ?? null, higher: true },
    { label: 'Dernier exercice', get: (it) => last(it)?.fiscalYear ?? '—' },
    { label: "Chiffre d'affaires", get: (it) => eur(last(it)?.revenue), best: (it) => last(it)?.revenue ?? null, higher: true },
    { label: 'Résultat net', get: (it) => eur(last(it)?.netIncome), best: (it) => last(it)?.netIncome ?? null, higher: true },
    { label: 'Marge nette', get: (it) => (isNum(last(it)?.netIncome) && last(it)?.revenue > 0 ? pct(last(it).netIncome / last(it).revenue) : '—'), best: (it) => (isNum(last(it)?.netIncome) && last(it)?.revenue > 0 ? last(it).netIncome / last(it).revenue : null), higher: true },
    { label: 'TCAM du CA', get: (it) => pct(it.trends.revenueCagr), best: (it) => it.trends.revenueCagr, higher: true },
    { label: 'Valeur centrale estimée', get: (it) => eur(it.valuation?.central) },
    { label: 'Rapport score / risque', get: (it) => (isNum(it.score?.economic_score) ? (it.score.economic_score / Math.max(10, it.score.risk_score)).toFixed(2).replace('.', ',') : '—'), best: (it) => (isNum(it.score?.economic_score) ? it.score.economic_score / Math.max(10, it.score.risk_score) : null), higher: true },
    { label: 'Procédure en cours', get: (it) => { const p = it.proceedings.find((x: any) => x.status !== 'cloturee'); return p ? `${meta.procTypeLabels[p.type]} (${date(p.opened_at)})` : 'aucune'; } },
    { label: 'Signaux publics', get: (it) => it.signals.length || 'aucun' },
  ];
  return (
    <div className="fade-in space-y-4">
      <PageHeader title="Comparateur" subtitle="Jusqu'à 6 entreprises côte à côte. Cochez des entreprises dans les listes ou ajoutez-les ici." />
      <div className="max-w-xl">
        <CompanyPicker onPick={(c) => !compare.includes(c.id) && toggleCompare(c.id)} placeholder="Ajouter une entreprise au comparateur…" />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Card>
          <Empty title="Aucune entreprise à comparer" />
        </Card>
      ) : (
        <Card pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-700">
                  <th className="px-3 py-2 text-left text-[11px] uppercase tracking-wider text-fog-500">Critère</th>
                  {items.map((it) => (
                    <th key={it.company.id} className="min-w-44 px-3 py-2 text-left align-top">
                      <Link className="font-semibold text-fog-50 hover:text-volt-300" to={`/entreprises/${it.company.id}`}>
                        {it.company.name}
                      </Link>
                      <div>
                        <Button size="sm" variant="ghost" onClick={() => toggleCompare(it.company.id)}>
                          Retirer
                        </Button>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-700/70">
                {rows.map((r) => {
                  const vals = r.best ? items.map(r.best) : [];
                  const valid = vals.filter(isNum) as number[];
                  const target = valid.length > 1 ? (r.higher ? Math.max(...valid) : Math.min(...valid)) : null;
                  return (
                    <tr key={r.label}>
                      <td className="px-3 py-2 text-xs text-fog-400">{r.label}</td>
                      {items.map((it, i) => (
                        <td key={it.company.id} className={`px-3 py-2 tabular ${target !== null && vals[i] === target ? 'bg-good/10' : ''}`}>
                          {r.get(it)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-ink-700 px-3 py-2 text-[11px] text-fog-500">Surlignage : meilleure valeur parmi les entreprises disposant de la donnée. Une donnée manquante n'est jamais remplacée par une estimation.</p>
        </Card>
      )}
    </div>
  );
}
