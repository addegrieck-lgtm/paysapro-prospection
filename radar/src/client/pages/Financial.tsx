import { useNavigate, useParams, Link } from 'react-router';
import { api } from '../api';
import { FinancialChart, RangeBar } from '../components/charts';
import { CompanyPicker } from '../components/CompanyPicker';
import { ScenarioPanel } from '../components/Scenarios';
import { Card, Empty, ErrorBox, Loading, PageHeader, Table, td, useApi } from '../components/ui';
import { eur, isNum, num, pct } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
export default function Financial() {
  const params = useParams();
  const id = params.id ? Number(params.id) : null;
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi(() => (id ? api.get<any>(`/companies/${id}`) : Promise.resolve(null)), [id]);
  return (
    <div className="fade-in space-y-4">
      <PageHeader title="Analyse financière" subtitle="Indicateurs calculés uniquement quand les données existent, tendances sur 3 à 5 exercices, valorisation multi-méthodes et scénarios de reprise." />
      <div className="max-w-xl">
        <CompanyPicker onPick={(c) => nav(`/analyse/${c.id}`)} />
      </div>
      {!id && (
        <Card>
          <Empty title="Choisissez une entreprise à analyser">Les entreprises disposant de comptes publiés offrent l'analyse la plus complète. Pour une entreprise sans comptes publics, importez les liasses du vendeur (Administration → Imports).</Empty>
        </Card>
      )}
      <ErrorBox error={error} onRetry={reload} />
      {id && loading && !data && <Loading />}
      {data && (
        <>
          <h2 className="text-lg font-semibold">
            <Link className="hover:text-volt-300" to={`/entreprises/${id}`}>
              {data.company.name}
            </Link>{' '}
            <span className="text-sm font-normal text-fog-400">SIREN {data.company.siren}</span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Évolution" className="lg:col-span-2">
              <FinancialChart years={data.financials.map((y: any) => ({ ...y, ebe: y.ebe ?? y.ebitda ?? (isNum(y.operatingIncome) && isNum(y.depreciation) ? y.operatingIncome + y.depreciation : null) }))} />
            </Card>
            <Card title="Lecture des tendances">
              {data.trends.findings.length ? (
                <ul className="space-y-1.5 text-xs">
                  {data.trends.findings.map((f: any, i: number) => (
                    <li key={i}>
                      <span className={f.severity === 'positif' ? 'text-good' : f.severity === 'critique' ? 'text-bad' : f.severity === 'attention' ? 'text-warn' : 'text-fog-300'}>{f.label}</span>
                      <div className="text-fog-500">{f.explanation}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fog-400">{data.trends.summary}</p>
              )}
              {isNum(data.trends.revenueCagr) && <p className="mt-3 text-xs text-fog-400">TCAM du chiffre d'affaires : {pct(data.trends.revenueCagr)}</p>}
            </Card>
          </div>
          {data.indicators.length > 0 && (
            <Card title="Indicateurs du dernier exercice" pad={false}>
              <Table dense head={['Indicateur', 'Valeur', 'Formule', 'Données utilisées']}>
                {data.indicators[data.indicators.length - 1].indicators.map((it: any) => (
                  <tr key={it.key}>
                    <td className={`${td} text-fog-100`}>{it.label}</td>
                    <td className={`${td} whitespace-nowrap tabular`}>{it.value === null ? <span className="text-fog-500">non calculable</span> : it.unit === '%' ? pct(it.value) : it.unit === '€' ? eur(it.value) : it.unit === 'x' ? `${num(it.value, 2)} ×` : `${num(it.value, 1)} ${it.unit}`}</td>
                    <td className={`${td} text-fog-400`}>{it.formula}</td>
                    <td className={`${td} text-fog-500`}>
                      {Object.entries(it.inputs)
                        .map(([k, v]) => `${k} : ${isNum(v) ? eur(v as number) : 'manquant'}`)
                        .join(' · ')}
                      {it.note && <div className="text-warn">{it.note}</div>}
                    </td>
                  </tr>
                ))}
              </Table>
            </Card>
          )}
          {data.valuation?.central && (
            <Card title="Valorisation indicative (synthèse pondérée)">
              <RangeBar low={data.valuation.low} central={data.valuation.central} high={data.valuation.high} marker={data.project?.asking_price} markerLabel="Prix demandé" />
              <p className="text-xs text-fog-500">Détail des méthodes, hypothèses et limites dans la fiche entreprise (onglet « Valorisation »).</p>
            </Card>
          )}
          <ScenarioPanel companyId={id!} projectId={data.project?.id} />
        </>
      )}
    </div>
  );
}
