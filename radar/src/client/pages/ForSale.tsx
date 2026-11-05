import { useState } from 'react';
import { Link } from 'react-router';
import { api } from '../api';
import { useApp } from '../App';
import { Badge, Card, Empty, ErrorBox, Loading, Notice, PageHeader, ScoreCell, Table, Tabs, td, useApi } from '../components/ui';
import { date, eur } from '../lib/format';

interface Listing {
  id: number;
  company_id: number | null;
  company_name: string | null;
  siren: string | null;
  source_id: string;
  kind: string;
  status: string;
  title: string;
  description: string | null;
  asking_price: number | null;
  declared_revenue: number | null;
  commune_name: string | null;
  url: string | null;
  published_at: string | null;
  collected_at: string;
  economic_score?: number | null;
  risk_score?: number | null;
  reliability_score?: number | null;
}

const KIND: Record<string, string> = { fonds_de_commerce: 'Fonds de commerce', societe: 'Société', titres: 'Titres', actifs: 'Actifs', clientele: 'Clientèle', plan_cession: 'Plan de cession', autre: 'Autre' };
const STATUS: Record<string, string> = { active: 'Active', retiree: 'Retirée', realisee: 'Réalisée', inconnue: 'Statut inconnu' };

export default function ForSale() {
  const { meta, can } = useApp();
  const [tab, setTab] = useState<'offres' | 'realisees'>('offres');
  const { data, error, loading, reload } = useApi(() => api.get<{ offers: Listing[]; completed: Listing[] }>('/listings'), []);
  const source = (id: string) => meta.sources.find((s) => s.id === id)?.label ?? id;
  return (
    <div className="fade-in">
      <PageHeader title="Opportunités à vendre" subtitle="Annonces de cession publiques (flux RSS configurés, imports d'annonces consultées sur les plateformes de cession) et cessions publiées au BODACC." />
      <Notice>
        Les plateformes de cession sans API ni flux (Bpifrance Transmission, Transentreprise CCI/CMA, cabinets) ne sont pas aspirées : importez les annonces qui vous intéressent depuis <em>Administration → Imports</em> (modèle CSV fourni). Les cessions du BODACC sont des ventes <strong>déjà réalisées</strong> et figurent dans l'onglet dédié.
      </Notice>
      <div className="mt-4">
        <Tabs value={tab} onChange={setTab} items={[{ id: 'offres', label: `Annonces de cession${data ? ` (${data.offers.length})` : ''}` }, { id: 'realisees', label: `Cessions réalisées publiées${data ? ` (${data.completed.length})` : ''}` }]} />
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : tab === 'offres' ? (
        <Card pad={false}>
          {data?.offers.length ? (
            <Table head={['Annonce', 'Type', 'Prix demandé', 'CA déclaré', 'Entreprise liée', 'Score / risque', 'Source', 'Statut']}>
              {data.offers.map((l) => (
                <tr key={l.id} className="hover:bg-ink-750/50">
                  <td className={td}>
                    <div className="font-medium text-fog-50">{l.url ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="hover:text-volt-300">{l.title} ↗</a> : l.title}</div>
                    <div className="text-xs text-fog-500">{[l.commune_name, date(l.published_at ?? l.collected_at)].filter(Boolean).join(' · ')}</div>
                    {l.description && <p className="mt-1 line-clamp-2 max-w-xl text-xs text-fog-400">{l.description}</p>}
                  </td>
                  <td className={td}>
                    <Badge>{KIND[l.kind] ?? l.kind}</Badge>
                  </td>
                  <td className={`${td} tabular`}>{eur(l.asking_price)}</td>
                  <td className={`${td} tabular`}>{eur(l.declared_revenue)}</td>
                  <td className={td}>{l.company_id ? <Link className="text-volt-300 hover:underline" to={`/entreprises/${l.company_id}`}>{l.company_name}</Link> : <span className="text-xs text-fog-500">non identifiée</span>}</td>
                  <td className={td}>
                    {l.company_id ? (
                      <div className="space-y-1">
                        <ScoreCell value={l.economic_score} />
                        <ScoreCell value={l.risk_score} kind="risk" />
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className={`${td} text-xs text-fog-400`}>{source(l.source_id)}</td>
                  <td className={td}>
                    {can('analyste') ? (
                      <select className="rounded border border-ink-600 bg-ink-850 px-1 py-0.5 text-xs" value={l.status} onChange={(e) => api.patch(`/listings/${l.id}`, { status: e.target.value }).then(reload)} aria-label="Statut de l'annonce">
                        {Object.entries(STATUS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    ) : (
                      STATUS[l.status]
                    )}
                  </td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty title="Aucune annonce de cession enregistrée">Ajoutez des flux RSS d'annonces (Administration → Sources) ou importez des annonces (Administration → Imports).</Empty>
          )}
        </Card>
      ) : (
        <Card pad={false}>
          {data?.completed.length ? (
            <Table head={['Date', 'Cession', 'Cédant', 'Commune', 'Annonce officielle']}>
              {data.completed.map((l) => (
                <tr key={l.id}>
                  <td className={`${td} whitespace-nowrap text-xs`}>{date(l.published_at)}</td>
                  <td className={td}>
                    <div className="text-fog-100">{l.title}</div>
                    {l.description && <div className="max-w-xl text-xs text-fog-500">{l.description}</div>}
                  </td>
                  <td className={td}>{l.company_id ? <Link className="text-volt-300 hover:underline" to={`/entreprises/${l.company_id}`}>{l.company_name}</Link> : '—'}</td>
                  <td className={`${td} text-xs`}>{l.commune_name ?? '—'}</td>
                  <td className={td}>{l.url && <a className="text-xs text-volt-300 hover:underline" href={l.url} target="_blank" rel="noopener noreferrer">BODACC ↗</a>}</td>
                </tr>
              ))}
            </Table>
          ) : (
            <Empty title="Aucune cession publiée récupérée">La source BODACC (famille « Ventes et cessions ») alimente cet onglet.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
