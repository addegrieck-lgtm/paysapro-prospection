import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { useApp } from '../App';
import { FinancialChart, RangeBar } from '../components/charts';
import { ScenarioPanel } from '../components/Scenarios';
import { Badge, Button, Card, Empty, ErrorBox, inputCls, Loading, Notice, OppBadge, PageHeader, ProvTag, StatusTag, Table, Tabs, td, useApi, type Prov } from '../components/ui';
import { date, dateTime, eur, isNum, num, pct, years } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Detail = Record<string, any>;

export function Row({ label, children, prov }: { label: string; children: ReactNode; prov?: Prov | null }) {
  return (
    <div className="grid grid-cols-[minmax(120px,40%)_1fr] gap-2 py-1.5 text-sm">
      <dt className="text-fog-400">{label}</dt>
      <dd className="text-fog-100">
        {children ?? <span className="text-fog-500">inconnu</span>}
        {prov !== undefined && <ProvTag p={prov} />}
      </dd>
    </div>
  );
}

function Components({ items }: { items: { key: string; label: string; weight: number; value: number | null; points: number | null; explanation: string; basis: string }[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c) => (
        <li key={c.key} className="text-xs">
          <div className="flex justify-between gap-2">
            <span className="text-fog-100">
              {c.label} <span className="text-fog-500">({c.weight} pts)</span>
            </span>
            <span className="tabular text-fog-300">{c.points === null ? 'non évalué' : `${c.points} / ${c.weight}`}</span>
          </div>
          <div className="mt-0.5 text-fog-500">
            {c.explanation}
            {c.basis === 'hypothese' && <Badge className="ml-1">hypothèse</Badge>}
            {c.basis === 'inconnu' && <Badge className="ml-1">non documenté</Badge>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function CompanyPage() {
  const id = Number(useParams().id);
  const { meta, can, compare, toggleCompare } = useApp();
  const nav = useNavigate();
  const [tab, setTab] = useState<'synthese' | 'identite' | 'finances' | 'valorisation' | 'juridique' | 'provenance'>('synthese');
  const { data, error, loading, reload } = useApi(() => api.get<Detail>(`/companies/${id}`), [id]);
  const [site, setSite] = useState('');
  const [msg, setMsg] = useState<unknown>(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data!;
  const c = d.company;
  const p = d.provenance as Record<string, Prov>;
  const sector = meta.sectors.find((s) => s.id === c.sector_id)?.label;
  const s = d.score;
  const v = d.valuation;
  const activeProc = (d.proceedings as any[]).find((x) => x.status !== 'cloturee');

  const follow = async () => {
    try {
      const r = await api.post<{ id: number }>('/projects', { companyId: id });
      nav(`/acquisitions/${r.id}`);
    } catch (e) {
      setMsg(e);
    }
  };

  return (
    <div className="fade-in space-y-4">
      <PageHeader
        title={c.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>SIREN {c.siren}</span>
            {c.trade_name && <span>· {c.trade_name}</span>}
            {sector && <span>· {sector}</span>}
            {c.commune_name && <span>· {c.commune_name}</span>}
            {c.admin_status === 'C' && <Badge className="border-bad/40 text-bad">Cessée</Badge>}
            {d.opportunity && <OppBadge type={d.opportunity.primary_type} />}
          </span>
        }
        actions={
          <>
            <Button onClick={() => toggleCompare(id)}>{compare.includes(id) ? '✓ Au comparateur' : 'Comparer'}</Button>
            <Button onClick={() => nav(`/radar-ai?entreprise=${id}`)}>Demander à RADAR AI</Button>
            {can('analyste') &&
              (d.project ? (
                <Button variant="primary" onClick={() => nav(`/acquisitions/${d.project.id}`)}>
                  Voir dans l'Acquisition Manager
                </Button>
              ) : (
                <Button variant="primary" onClick={follow}>
                  Suivre dans l'Acquisition Manager
                </Button>
              ))}
          </>
        }
      />
      <ErrorBox error={msg} />
      {d.opportunity?.primary_type === 'cachee' && <Notice tone="warn">Piste de prospection : cette entreprise n'est <strong>pas</strong> déclarée à vendre. Les critères ci-dessous justifient seulement une étude.</Notice>}
      {s?.data_status === 'insuffisant' && <Notice tone="warn">Données insuffisantes : aucune note économique n'est attribuée tant que les comptes ou informations nécessaires manquent (pas de chiffre inventé).</Notice>}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'synthese', label: 'Synthèse' },
          { id: 'identite', label: 'Identité & établissements' },
          { id: 'finances', label: 'Finances' },
          { id: 'valorisation', label: 'Valorisation & scénarios' },
          { id: 'juridique', label: `Juridique${activeProc ? ' ⚠' : ''}` },
          { id: 'provenance', label: 'Sources & historique' },
        ]}
      />

      {tab === 'synthese' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Scores">
            {s ? (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="text-[11px] text-fog-400">Économique</div>
                    <div className="text-2xl font-semibold tabular">{s.economic_score ?? '—'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-fog-400">Risque</div>
                    <div className="text-2xl font-semibold tabular">{s.risk_score}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-fog-400">Fiabilité</div>
                    <div className="text-2xl font-semibold tabular">{s.reliability_score}</div>
                  </div>
                </div>
                <p className="text-xs text-fog-400">{s.detail?.summary}</p>
                <details>
                  <summary className="cursor-pointer text-xs text-volt-300">Détail du score économique</summary>
                  <div className="mt-2">
                    <Components items={s.detail?.economic ?? []} />
                  </div>
                </details>
                <details>
                  <summary className="cursor-pointer text-xs text-volt-300">Détail du risque</summary>
                  <div className="mt-2">
                    <Components items={s.detail?.risk ?? []} />
                  </div>
                </details>
                <details>
                  <summary className="cursor-pointer text-xs text-volt-300">Détail de la fiabilité</summary>
                  <div className="mt-2">
                    <Components items={s.detail?.reliability ?? []} />
                  </div>
                </details>
              </div>
            ) : (
              <Empty title="Analyse en attente" />
            )}
          </Card>
          <Card title="Pourquoi cette entreprise apparaît">
            {d.opportunity ? (
              <ul className="space-y-2 text-xs">
                {d.opportunity.reasons.map((r: any, i: number) => (
                  <li key={i}>
                    <OppBadge type={r.engine} /> <span className="text-fog-100">{r.rule}</span>
                    <div className="mt-0.5 text-fog-500">{r.detail}</div>
                  </li>
                ))}
                {isNum(d.opportunity.transmission_index) && <li className="text-fog-300">Indice de transmission (signaux publics) : {d.opportunity.transmission_index}/100</li>}
              </ul>
            ) : (
              <p className="text-sm text-fog-400">Aucun moteur de détection n'a retenu cette entreprise.</p>
            )}
          </Card>
          <Card title="Valorisation indicative">
            {v?.central ? (
              <>
                <RangeBar low={v.low} central={v.central} high={v.high} marker={d.project?.asking_price} markerLabel="Prix demandé" />
                <p className="text-[11px] text-fog-500">Estimation à partir des comptes publiés et d'hypothèses paramétrables — pas une référence officielle.</p>
              </>
            ) : (
              <p className="text-sm text-fog-400">Non calculable avec les données disponibles.</p>
            )}
          </Card>
          <Card title="Chiffres clés publiés" className="lg:col-span-2">
            <FinancialChart years={(d.financials as any[]).map((y) => ({ ...y, ebe: y.ebe ?? y.ebitda ?? (isNum(y.operatingIncome) && isNum(y.depreciation) ? y.operatingIncome + y.depreciation : null) }))} />
            <p className="mt-2 text-xs text-fog-400">{d.trends.summary}</p>
          </Card>
          <Card title="Signaux et annonces">
            {(d.signals as any[]).length || (d.listings as any[]).length ? (
              <ul className="space-y-2 text-xs">
                {(d.listings as any[]).map((l) => (
                  <li key={`l${l.id}`}>
                    <Badge color={l.is_offer ? 'var(--color-cat-1)' : undefined}>{l.is_offer ? 'Annonce de cession' : 'Cession réalisée'}</Badge> {l.url ? <a className="text-volt-300 hover:underline" href={l.url} target="_blank" rel="noopener noreferrer">{l.title} ↗</a> : l.title}
                    {isNum(l.asking_price) && <span className="ml-1 text-fog-300">— {eur(l.asking_price)}</span>}
                  </li>
                ))}
                {(d.signals as any[]).map((sg) => (
                  <li key={`s${sg.id}`}>
                    <Badge color="var(--color-cat-3)">Signal ({'●'.repeat(sg.strength)})</Badge> <span className="text-fog-300">« {sg.evidence} »</span>
                    {sg.evidence_url && (
                      <a className="ml-1 text-volt-300 hover:underline" href={sg.evidence_url} target="_blank" rel="noopener noreferrer">
                        preuve ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fog-400">Aucun signal public ni annonce connus.</p>
            )}
          </Card>
        </div>
      )}

      {tab === 'identite' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Informations générales">
            <dl className="divide-y divide-ink-700/60">
              <Row label="Dénomination" prov={p.name}>{c.name}</Row>
              <Row label="Nom commercial / enseigne" prov={c.trade_name ? p.trade_name : undefined}>{c.trade_name}</Row>
              <Row label="SIREN">{c.siren}</Row>
              <Row label="SIRET du siège" prov={p.siege_siret}>{c.siege_siret}</Row>
              <Row label="Code NAF" prov={p.naf_code}>{c.naf_code}</Row>
              <Row label="Secteur (classement de l'outil)">{sector}</Row>
              <Row label="Forme juridique" prov={p.legal_form_code}>{c.legal_form_label ?? c.legal_form_code}</Row>
              <Row label="Création" prov={p.creation_date}>{c.creation_date ? `${date(c.creation_date)} (${years(c.creation_date)})` : null}</Row>
              <Row label="Effectif (tranche INSEE)" prov={p.headcount_band}>{c.headcount_band ? `${meta.headcountBands[c.headcount_band]?.label ?? c.headcount_band}${c.headcount_year ? ` (${c.headcount_year})` : ''}` : null}</Row>
              <Row label="Catégorie" prov={p.category}>{c.category}</Row>
              <Row label="Adresse du siège" prov={p.address}>{c.address}</Row>
              <Row label="Localisation">{isNum(c.lat) ? (c.geo_precision === 'commune' ? 'Approximation : centre de la commune' : 'Adresse géocodée') : 'Non géolocalisée'}</Row>
              <Row label="Site internet" prov={c.website ? p.website : undefined}>
                {c.website ? (
                  <a href={c.website} target="_blank" rel="noopener noreferrer" className="text-volt-300 hover:underline">
                    {c.website}
                  </a>
                ) : null}
              </Row>
            </dl>
            {can('analyste') && (
              <div className="mt-3 flex gap-2">
                <input className={inputCls} placeholder="https://… (site officiel de l'entreprise)" value={site} onChange={(e) => setSite(e.target.value)} aria-label="Site internet" />
                <Button onClick={() => api.patch(`/companies/${id}`, { website: site }).then(() => (setSite(''), reload())).catch(setMsg)} disabled={!site}>
                  Enregistrer
                </Button>
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <a className="text-volt-300 hover:underline" href={d.officialLinks.annuaire} target="_blank" rel="noopener noreferrer">
                Annuaire des entreprises ↗
              </a>
              <a className="text-volt-300 hover:underline" href={d.officialLinks.bodacc} target="_blank" rel="noopener noreferrer">
                Annonces BODACC ↗
              </a>
              <a className="text-volt-300 hover:underline" href={d.officialLinks.inpi} target="_blank" rel="noopener noreferrer">
                Data INPI ↗
              </a>
            </div>
          </Card>
          <div className="space-y-4">
            <Card title="Dirigeants et mandataires (registres publics)">
              {(d.directors as any[]).length ? (
                <ul className="space-y-1 text-sm">
                  {(d.directors as any[]).map((x, i) => (
                    <li key={i}>
                      <span className="text-fog-100">{x.kind === 'personne_morale' ? x.name : `${x.first_names ?? ''} ${x.name}`.trim()}</span> <span className="text-xs text-fog-400">— {x.role || 'qualité non précisée'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-fog-400">Non renseignés par les sources consultées.</p>
              )}
              <p className="mt-2 text-[11px] text-fog-500">Seuls le nom et la qualité publiés sont conservés (pas de date de naissance, aucune déduction d'âge ou d'intention).</p>
            </Card>
            <Card title={`Établissements (${(d.establishments as any[]).length}${isNum(c.establishments_count) ? ` connus sur ${c.establishments_count}` : ''})`} pad={false}>
              <Table dense head={['SIRET', 'Adresse', 'État', 'Création']}>
                {(d.establishments as any[]).map((e) => (
                  <tr key={e.siret}>
                    <td className={`${td} tabular`}>
                      {e.siret}
                      {e.is_siege ? <Badge className="ml-1">siège</Badge> : null}
                    </td>
                    <td className={td}>{e.address ?? e.commune_name ?? '—'}</td>
                    <td className={td}>{e.admin_status === 'F' ? <span className="text-fog-500">fermé</span> : e.admin_status === 'A' ? 'actif' : '—'}</td>
                    <td className={td}>{date(e.creation_date)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          </div>
        </div>
      )}

      {tab === 'finances' && (
        <div className="space-y-4">
          <Card title="Exercices publiés">
            <FinancialChart years={(d.financials as any[]).map((y) => ({ ...y, ebe: y.ebe ?? y.ebitda ?? (isNum(y.operatingIncome) && isNum(y.depreciation) ? y.operatingIncome + y.depreciation : null) }))} />
          </Card>
          <Card title="Analyse des tendances">
            {d.trends.findings.length ? (
              <ul className="space-y-1.5 text-sm">
                {d.trends.findings.map((f: any, i: number) => (
                  <li key={i} className="flex gap-2">
                    <span className={f.severity === 'positif' ? 'text-good' : f.severity === 'critique' ? 'text-bad' : f.severity === 'attention' ? 'text-warn' : 'text-fog-400'}>{f.severity === 'positif' ? '▲' : f.severity === 'critique' ? '■' : f.severity === 'attention' ? '◆' : '●'}</span>
                    <span>
                      <span className="text-fog-100">{f.label}</span> <span className="text-fog-400">— {f.explanation}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fog-400">{d.trends.summary}</p>
            )}
          </Card>
          {(d.indicators as any[]).length ? (
            <Card title="Indicateurs calculés (formules et données utilisées)" pad={false}>
              <Table dense head={['Indicateur', ...(d.indicators as any[]).map((y) => y.year), 'Formule']}>
                {(d.indicators as any[])[0].indicators.map((ind: any, row: number) => (
                  <tr key={ind.key}>
                    <td className={`${td} text-fog-100`}>{ind.label}</td>
                    {(d.indicators as any[]).map((y) => {
                      const it = y.indicators[row];
                      const val = it.value === null ? null : it.unit === '%' ? pct(it.value) : it.unit === '€' ? eur(it.value) : it.unit === 'x' ? `${num(it.value, 2)} ×` : `${num(it.value, 1)} ${it.unit}`;
                      return (
                        <td key={y.year} className={`${td} whitespace-nowrap tabular`} title={it.value === null ? `Non calculable${it.missing ? ` : manque ${it.missing.join(', ')}` : ''}${it.note ? ` — ${it.note}` : ''}` : it.note ?? undefined}>
                          {val ?? <span className="text-fog-500">n.c.</span>}
                          {it.status === 'calculee' && it.note && <span className="ml-1 text-warn">*</span>}
                        </td>
                      );
                    })}
                    <td className={`${td} max-w-xs text-fog-500`}>{ind.formula}</td>
                  </tr>
                ))}
              </Table>
              <p className="border-t border-ink-700 px-3 py-2 text-[11px] text-fog-500">« n.c. » : non calculable faute de données (survolez pour voir ce qui manque). Aucun indicateur n'est estimé quand ses données sont absentes.</p>
            </Card>
          ) : (
            <Card>
              <Empty title="Aucun compte publié">Les comptes sont confidentiels ou non déposés. Importez les liasses transmises par le vendeur (Administration → Imports → comptes) pour activer l'analyse.</Empty>
            </Card>
          )}
          {(d.financials as any[]).length > 0 && (
            <Card title="Provenance des chiffres" pad={false}>
              <Table dense head={['Exercice', 'Sources', 'Statut', 'Collecte']}>
                {(d.financials as any[]).map((y) => {
                  const fsrc = Object.values(y.fieldSources ?? {}) as any[];
                  return (
                    <tr key={y.fiscalYear}>
                      <td className={td}>{y.fiscalYear}</td>
                      <td className={td}>{y.sources.map((x: string) => meta.sources.find((m) => m.id === x)?.label ?? x).join(', ')}</td>
                      <td className={td}>{[...new Set(fsrc.map((f) => f.status))].map((st) => <StatusTag key={st} status={st} />)}</td>
                      <td className={td}>{fsrc[0] ? dateTime(fsrc[0].collectedAt) : '—'}</td>
                    </tr>
                  );
                })}
              </Table>
            </Card>
          )}
        </div>
      )}

      {tab === 'valorisation' && (
        <div className="space-y-4">
          <Card title="Méthodes de valorisation">
            {v?.detail?.methods?.length ? (
              <div className="space-y-3">
                {v.central !== null && <RangeBar low={v.low} central={v.central} high={v.high} marker={d.project?.asking_price} markerLabel="Prix demandé" />}
                <div className="grid gap-3 lg:grid-cols-2">
                  {v.detail.methods.map((m: any) => (
                    <div key={m.method} className="rounded-lg border border-ink-700 p-3 text-xs">
                      <div className="flex justify-between gap-2">
                        <span className="font-medium text-fog-100">{m.label}</span>
                        {m.applicable ? (
                          <span className="tabular text-fog-100">
                            {eur(m.low, true)} – <strong>{eur(m.central, true)}</strong> – {eur(m.high, true)}
                          </span>
                        ) : (
                          <span className="text-fog-500">non applicable</span>
                        )}
                      </div>
                      {m.applicable ? (
                        <>
                          <div className="mt-1 text-fog-400">{m.basis}</div>
                          <ul className="mt-1 list-disc pl-4 text-fog-400">
                            {m.assumptions.map((a: string) => (
                              <li key={a}>{a}</li>
                            ))}
                          </ul>
                          {m.limits.map((l: string) => (
                            <p key={l} className="mt-1 text-warn">
                              Limite : {l}
                            </p>
                          ))}
                        </>
                      ) : (
                        <div className="mt-1 text-fog-500">{m.reason}</div>
                      )}
                    </div>
                  ))}
                </div>
                {[...(v.detail.assumptions ?? []), ...(v.detail.limits ?? [])].map((t: string) => (
                  <p key={t} className="text-xs text-fog-400">
                    {t}
                  </p>
                ))}
              </div>
            ) : (
              <Empty title="Aucune valorisation possible">Il faut au moins un exercice avec EBE (ou résultat d'exploitation et dotations) ou des capitaux propres publiés.</Empty>
            )}
          </Card>
          <ScenarioPanel companyId={id} projectId={d.project?.id} />
        </div>
      )}

      {tab === 'juridique' && (
        <div className="space-y-4">
          <Card title="Procédures collectives">
            {(d.proceedings as any[]).length ? (
              <ul className="space-y-2 text-sm">
                {(d.proceedings as any[]).map((x) => (
                  <li key={x.id} className="rounded-lg border border-ink-700 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{meta.procTypeLabels[x.type]}</span>
                      <Badge>{meta.procStatusLabels[x.status]}</Badge>
                      <span className="text-xs text-fog-400">
                        ouverte le {date(x.opened_at)}
                        {x.closed_at && ` · clôturée le ${date(x.closed_at)} (${x.closure_reason})`}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-fog-400">
                      {x.tribunal} · dernier jugement : {x.latest_nature} ({date(x.last_event_at)})
                    </div>
                    {x.administrator && <div className="mt-1 text-xs text-fog-300">Texte publié : « {x.administrator} »</div>}
                    {x.url && (
                      <a className="text-xs text-volt-300 hover:underline" href={x.url} target="_blank" rel="noopener noreferrer">
                        Publication officielle ↗
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-fog-400">Aucune procédure collective connue au BODACC.</p>
            )}
          </Card>
          {d.distress && (
            <Card title="Reprise d'une entreprise en difficulté">
              <p className="mb-3 text-sm text-fog-300">{d.distress.context}</p>
              <div className="grid gap-3 lg:grid-cols-2">
                {d.distress.modes.map((m: any) => (
                  <div key={m.key} className="rounded-lg border border-ink-700 p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-fog-100">{m.label}</span>
                      <Badge className={m.applicability === 'possible' ? 'text-good' : m.applicability === 'peu_probable' ? 'text-fog-500' : 'text-warn'}>{m.applicability === 'possible' ? 'possible' : m.applicability === 'peu_probable' ? 'peu probable' : 'à vérifier'}</Badge>
                    </div>
                    <p className="mt-1 text-fog-400">{m.explanation}</p>
                    <ul className="mt-1 list-disc pl-4 text-fog-500">
                      {m.points.map((pt: string) => (
                        <li key={pt}>{pt}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <h3 className="mt-4 text-sm font-semibold">Risques à analyser</h3>
              <ul className="mt-1 space-y-1 text-xs">
                {d.distress.risks.map((r: any) => (
                  <li key={r.key}>
                    <span className="text-fog-100">{r.label}</span> <span className="text-fog-400">— {r.detail}</span>
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 text-sm font-semibold">Checklist juridique de due diligence</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-fog-300">
                {d.distress.checklist.map((x: string) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
              <p className="mt-3 text-[11px] text-fog-500">{d.distress.disclaimer}</p>
            </Card>
          )}
          <Card title="Historique des événements juridiques" pad={false}>
            {(d.events as any[]).length ? (
              <Table dense head={['Date', 'Événement', 'Tribunal', 'Source']}>
                {(d.events as any[]).map((e) => (
                  <tr key={e.id}>
                    <td className={`${td} whitespace-nowrap`}>{date(e.event_date)}</td>
                    <td className={td}>
                      <span className={e.details?.annule ? 'text-fog-500 line-through' : 'text-fog-100'}>{e.title}</span>
                      {e.details?.complement && <div className="mt-0.5 max-w-2xl text-fog-500">{e.details.complement}</div>}
                    </td>
                    <td className={td}>{e.tribunal ?? '—'}</td>
                    <td className={td}>{e.url ? <a className="text-volt-300 hover:underline" href={e.url} target="_blank" rel="noopener noreferrer">{e.source_label ?? e.source_id} ↗</a> : e.source_label ?? e.source_id}</td>
                  </tr>
                ))}
              </Table>
            ) : (
              <Empty title="Aucun événement enregistré" />
            )}
          </Card>
        </div>
      )}

      {tab === 'provenance' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Provenance de chaque champ" pad={false}>
            <Table dense head={['Champ', 'Valeur', 'Source', 'Statut', 'Confiance', 'Collecte']}>
              {Object.entries(p).map(([k, x]) => (
                <tr key={k}>
                  <td className={td}>{k}</td>
                  <td className={`${td} max-w-48 truncate`}>{(x as any).value}</td>
                  <td className={td}>{x.source_label}</td>
                  <td className={td}>
                    <StatusTag status={x.status} />
                  </td>
                  <td className={`${td} tabular`}>{x.confidence}</td>
                  <td className={`${td} whitespace-nowrap`}>{dateTime(x.collected_at)}</td>
                </tr>
              ))}
            </Table>
          </Card>
          <div className="space-y-4">
            <Card title="Enregistrements sources" pad={false}>
              <Table dense head={['Source', 'Identifiant', 'Première collecte', 'Dernière collecte']}>
                {(d.records as any[]).map((r, i) => (
                  <tr key={i}>
                    <td className={td}>{r.url ? <a className="text-volt-300 hover:underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.source_label} ↗</a> : r.source_label}</td>
                    <td className={`${td} tabular`}>{r.external_id}</td>
                    <td className={td}>{dateTime(r.first_collected_at)}</td>
                    <td className={td}>{dateTime(r.collected_at)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card title="Historique des changements" pad={false}>
              {(d.changes as any[]).length ? (
                <Table dense head={['Date', 'Champ', 'Avant', 'Après', 'Source']}>
                  {(d.changes as any[]).map((x, i) => (
                    <tr key={i}>
                      <td className={`${td} whitespace-nowrap`}>{dateTime(x.changed_at)}</td>
                      <td className={td}>{x.field}</td>
                      <td className={`${td} text-fog-500`}>{x.old_value}</td>
                      <td className={td}>{x.new_value}</td>
                      <td className={td}>{x.source_id}</td>
                    </tr>
                  ))}
                </Table>
              ) : (
                <Empty title="Aucun changement depuis la première collecte" />
              )}
            </Card>
          </div>
        </div>
      )}
      <p className="text-center text-xs text-fog-500">
        <Link to="/entreprises" className="hover:text-fog-300">
          ← Retour à la liste
        </Link>
      </p>
    </div>
  );
}

