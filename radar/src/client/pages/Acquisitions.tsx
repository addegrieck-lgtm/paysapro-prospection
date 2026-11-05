import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api } from '../api';
import { useApp } from '../App';
import { RangeBar } from '../components/charts';
import { ScenarioPanel } from '../components/Scenarios';
import { Badge, Button, Card, Empty, ErrorBox, Field, inputCls, Loading, Notice, OppBadge, PageHeader, ScoreCell, Table, Tabs, td, useApi } from '../components/ui';
import { date, dateTime, eur } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
const ACTIVE = ['nouvelle', 'a_analyser', 'interessante', 'a_contacter', 'contact_effectue', 'echange', 'infos_demandees', 'negociation', 'due_diligence', 'offre'];

function List() {
  const { meta } = useApp();
  const nav = useNavigate();
  const [view, setView] = useState<'actifs' | 'clos'>('actifs');
  const { data, error, loading, reload } = useApi(() => api.get<{ rows: any[]; reminders: any[] }>('/projects'), []);
  const rows = (data?.rows ?? []).filter((r) => (view === 'actifs' ? ACTIVE.includes(r.status) : !ACTIVE.includes(r.status)));
  return (
    <div className="fade-in space-y-4">
      <PageHeader title="Acquisition Manager" subtitle="Suivi des entreprises ciblées. L'outil n'envoie jamais de message : chaque prise de contact est faite par vous, puis consignée ici." />
      <ErrorBox error={error} onRetry={reload} />
      {data?.reminders.length ? (
        <Card title="Rappels à venir">
          <ul className="space-y-1 text-sm">
            {data.reminders.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <Link className="text-volt-300 hover:underline" to={`/acquisitions/${r.project_id}`}>
                    {r.name}
                  </Link>{' '}
                  — {r.content}
                </span>
                <span className={`text-xs ${r.due_at && r.due_at < new Date().toISOString() ? 'text-warn' : 'text-fog-400'}`}>{date(r.due_at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <Tabs value={view} onChange={setView} items={[{ id: 'actifs', label: 'En cours' }, { id: 'clos', label: 'Acquises, refusées, abandonnées' }]} />
      <Card pad={false}>
        {loading && !data ? (
          <Loading />
        ) : rows.length ? (
          <Table head={['Entreprise', 'Statut', 'Priorité', 'Score / risque', 'Valeur estimée', 'Prix demandé', 'Offre', 'Prochaine action']}>
            {rows.map((r) => (
              <tr key={r.id} className="cursor-pointer hover:bg-ink-750/50" onClick={() => nav(`/acquisitions/${r.id}`)}>
                <td className={td}>
                  <div className="font-medium text-fog-50">{r.name}</div>
                  <div className="text-xs text-fog-500">
                    {r.commune_name} · <OppBadge type={r.primary_type} />
                  </div>
                </td>
                <td className={td}>
                  <Badge>{meta.projectStatuses[r.status]}</Badge>
                </td>
                <td className={`${td} text-xs`}>{['', 'Haute', 'Normale', 'Basse'][r.priority]}</td>
                <td className={td}>
                  <ScoreCell value={r.economic_score} status={r.data_status} />
                  <br />
                  <ScoreCell value={r.risk_score} kind="risk" />
                </td>
                <td className={`${td} tabular`}>{eur(r.valuation_central, true)}</td>
                <td className={`${td} tabular`}>{eur(r.asking_price, true)}</td>
                <td className={`${td} tabular`}>{eur(r.offer_price, true)}</td>
                <td className={`${td} text-xs`}>
                  {r.next_action ?? '—'}
                  {r.next_action_at && <div className="text-fog-500">{date(r.next_action_at)}</div>}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Aucune entreprise suivie">Depuis une fiche entreprise, cliquez « Suivre dans l'Acquisition Manager ».</Empty>
        )}
      </Card>
    </div>
  );
}

function ProjectView({ id }: { id: number }) {
  const { meta, can } = useApp();
  const nav = useNavigate();
  const { data, error, loading, reload } = useApi(() => api.get<any>(`/projects/${id}`), [id]);
  const company = useApi(() => (data ? api.get<any>(`/companies/${data.project.company_id}`) : Promise.resolve(null)), [data?.project.company_id]);
  const [tab, setTab] = useState<'suivi' | 'contacts' | 'documents' | 'scenarios'>('suivi');
  const [note, setNote] = useState({ kind: 'note', content: '', due_at: '' });
  const [contact, setContact] = useState({ name: '', role: '', organisation: '', email: '', phone: '', notes: '' });
  const [err, setErr] = useState<unknown>(null);
  const [uploading, setUploading] = useState(false);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const p = data.project;
  const edit = can('analyste');
  const patch = (b: Record<string, unknown>) => api.patch(`/projects/${id}`, b).then(() => (reload(), company.reload())).catch(setErr);
  const numOrNull = (s: string) => (s.trim() === '' ? null : Number(s.replace(/\s/g, '').replace(',', '.')));
  return (
    <div className="fade-in space-y-4">
      <PageHeader
        title={p.name}
        subtitle={<Link className="text-volt-300 hover:underline" to={`/entreprises/${p.company_id}`}>Fiche entreprise · SIREN {p.siren}</Link>}
        actions={
          <>
            <Button onClick={() => nav('/acquisitions')}>← Liste</Button>
            {edit && (
              <Button variant="danger" onClick={() => confirm('Retirer cette entreprise de l\'Acquisition Manager (notes et documents supprimés) ?') && api.del(`/projects/${id}`).then(() => nav('/acquisitions'))}>
                Retirer
              </Button>
            )}
          </>
        }
      />
      <ErrorBox error={err} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Statut et prix" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Statut">
              <select className={inputCls} value={p.status} disabled={!edit} onChange={(e) => patch({ status: e.target.value })}>
                {Object.entries(meta.projectStatuses).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priorité">
              <select className={inputCls} value={p.priority} disabled={!edit} onChange={(e) => patch({ priority: Number(e.target.value) })}>
                <option value={1}>Haute</option>
                <option value={2}>Normale</option>
                <option value={3}>Basse</option>
              </select>
            </Field>
            <Field label="Prochaine action (échéance)">
              <input className={inputCls} type="date" disabled={!edit} defaultValue={p.next_action_at?.slice(0, 10) ?? ''} onBlur={(e) => patch({ next_action_at: e.target.value || null })} />
            </Field>
            <Field label="Prix demandé (€)" hint="Entre dans le score « prix et valorisation »">
              <input className={inputCls} disabled={!edit} defaultValue={p.asking_price ?? ''} onBlur={(e) => patch({ asking_price: numOrNull(e.target.value) })} inputMode="decimal" />
            </Field>
            <Field label="Estimation retenue (€)">
              <input className={inputCls} disabled={!edit} defaultValue={p.estimated_price ?? ''} onBlur={(e) => patch({ estimated_price: numOrNull(e.target.value) })} inputMode="decimal" />
            </Field>
            <Field label="Offre proposée (€)">
              <input className={inputCls} disabled={!edit} defaultValue={p.offer_price ?? ''} onBlur={(e) => patch({ offer_price: numOrNull(e.target.value) })} inputMode="decimal" />
            </Field>
            <div className="sm:col-span-3">
              <Field label="Prochaine action">
                <input className={inputCls} disabled={!edit} defaultValue={p.next_action ?? ''} onBlur={(e) => patch({ next_action: e.target.value || null })} placeholder="ex. Appeler le cédant pour demander les liasses 2023-2025" />
              </Field>
            </div>
          </div>
        </Card>
        <Card title="Valorisation">
          {company.data?.valuation?.central ? <RangeBar low={company.data.valuation.low} central={company.data.valuation.central} high={company.data.valuation.high} marker={p.asking_price} markerLabel="Prix demandé" /> : <p className="text-sm text-fog-400">Non calculable avec les données disponibles.</p>}
          {company.data?.score && (
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div>
                Éco. <ScoreCell value={company.data.score.economic_score} status={company.data.score.data_status} />
              </div>
              <div>
                Risque <ScoreCell value={company.data.score.risk_score} kind="risk" />
              </div>
              <div>
                Fiab. <ScoreCell value={company.data.score.reliability_score} kind="rel" />
              </div>
            </div>
          )}
        </Card>
      </div>
      <Tabs value={tab} onChange={setTab} items={[{ id: 'suivi', label: 'Notes, actions et rappels' }, { id: 'contacts', label: `Contacts (${data.contacts.length})` }, { id: 'documents', label: `Documents (${data.documents.length})` }, { id: 'scenarios', label: 'Scénarios' }]} />
      {tab === 'suivi' && (
        <Card>
          {edit && (
            <div className="mb-4 grid gap-2 sm:grid-cols-[140px_1fr_160px_auto]">
              <select className={inputCls} value={note.kind} onChange={(e) => setNote({ ...note, kind: e.target.value })} aria-label="Type">
                <option value="note">Note</option>
                <option value="action">Action effectuée</option>
                <option value="rappel">Rappel</option>
              </select>
              <input className={inputCls} value={note.content} onChange={(e) => setNote({ ...note, content: e.target.value })} placeholder="Contenu (ex. Échange téléphonique avec le cédant : …)" aria-label="Contenu" />
              <input className={inputCls} type="date" value={note.due_at} disabled={note.kind !== 'rappel'} onChange={(e) => setNote({ ...note, due_at: e.target.value })} aria-label="Échéance" />
              <Button
                variant="primary"
                disabled={!note.content.trim()}
                onClick={() =>
                  api
                    .post(`/projects/${id}/notes`, { kind: note.kind, content: note.content, due_at: note.kind === 'rappel' && note.due_at ? note.due_at : null })
                    .then(() => (setNote({ kind: 'note', content: '', due_at: '' }), reload()))
                    .catch(setErr)
                }
              >
                Ajouter
              </Button>
            </div>
          )}
          <ul className="space-y-2">
            {data.notes.map((n: any) => (
              <li key={n.id} className="flex gap-3 border-l-2 border-ink-600 pl-3 text-sm">
                <div className="flex-1">
                  <div className="text-[11px] text-fog-500">
                    {dateTime(n.created_at)} · {n.user_name ?? '—'} · {{ note: 'Note', action: 'Action', rappel: 'Rappel', statut: 'Statut' }[n.kind as string]}
                    {n.due_at && ` · échéance ${date(n.due_at)}`}
                  </div>
                  <div className={n.done_at ? 'text-fog-500 line-through' : 'text-fog-100'}>{n.content}</div>
                </div>
                {edit && n.kind === 'rappel' && (
                  <Button size="sm" variant="ghost" onClick={() => api.patch(`/notes/${n.id}`, { done: !n.done_at }).then(reload)}>
                    {n.done_at ? 'Rouvrir' : 'Fait'}
                  </Button>
                )}
                {edit && n.kind !== 'statut' && (
                  <Button size="sm" variant="ghost" onClick={() => api.del(`/notes/${n.id}`).then(reload)} aria-label="Supprimer">
                    ✕
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {tab === 'contacts' && (
        <Card>
          <Notice>Contacts professionnels uniquement (cédant, intermédiaire, mandataire, expert-comptable…). Ils restent dans l'outil ; aucun message n'est envoyé automatiquement.</Notice>
          {edit && (
            <div className="my-4 grid gap-2 sm:grid-cols-3">
              {(['name', 'role', 'organisation', 'email', 'phone', 'notes'] as const).map((k) => (
                <input key={k} className={inputCls} value={contact[k]} onChange={(e) => setContact({ ...contact, [k]: e.target.value })} placeholder={{ name: 'Nom *', role: 'Rôle', organisation: 'Organisation', email: 'E-mail', phone: 'Téléphone', notes: 'Notes' }[k]} aria-label={k} />
              ))}
              <Button variant="primary" disabled={!contact.name.trim()} onClick={() => api.post(`/projects/${id}/contacts`, contact).then(() => (setContact({ name: '', role: '', organisation: '', email: '', phone: '', notes: '' }), reload())).catch(setErr)}>
                Ajouter le contact
              </Button>
            </div>
          )}
          <Table dense head={['Nom', 'Rôle', 'Organisation', 'Coordonnées', 'Notes', '']}>
            {data.contacts.map((c: any) => (
              <tr key={c.id}>
                <td className={td}>{c.name}</td>
                <td className={td}>{c.role}</td>
                <td className={td}>{c.organisation}</td>
                <td className={td}>{[c.email, c.phone].filter(Boolean).join(' · ')}</td>
                <td className={td}>{c.notes}</td>
                <td className={td}>{edit && <Button size="sm" variant="ghost" onClick={() => api.del(`/contacts/${c.id}`).then(reload)}>✕</Button>}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
      {tab === 'documents' && (
        <Card>
          {edit && (
            <div className="mb-4">
              <input
                type="file"
                aria-label="Ajouter un document"
                accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls,.docx,.doc,.csv,.txt"
                disabled={uploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const fd = new FormData();
                  fd.append('file', file);
                  try {
                    await api.post(`/projects/${id}/documents`, fd);
                    reload();
                  } catch (x) {
                    setErr(x);
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
                className="text-sm text-fog-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-fog-100"
              />
              <p className="mt-1 text-[11px] text-fog-500">PDF, images, Excel, Word, CSV, texte — 20 Mo maximum. Stockage privé.</p>
            </div>
          )}
          {data.documents.length ? (
            <ul className="divide-y divide-ink-700 text-sm">
              {data.documents.map((d: any) => (
                <li key={d.id} className="flex items-center justify-between gap-2 py-2">
                  <a className="text-volt-300 hover:underline" href={`/api/documents/${d.id}`}>
                    {d.filename}
                  </a>
                  <span className="flex items-center gap-3 text-xs text-fog-500">
                    {(d.size / 1024).toFixed(0)} Ko · {date(d.created_at)}
                    {edit && (
                      <button className="hover:text-bad" onClick={() => confirm('Supprimer ce document ?') && api.del(`/documents/${d.id}`).then(reload)}>
                        Supprimer
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Aucun document" />
          )}
        </Card>
      )}
      {tab === 'scenarios' && (
        <div className="space-y-4">
          {data.scenarios.length > 0 && (
            <Card title="Simulations enregistrées" pad={false}>
              <Table dense head={['Date', 'Nom', 'Prix', 'Apport', 'TRI fonds propres (prudent / central / optimiste)']}>
                {data.scenarios.map((s: any) => {
                  const params = JSON.parse(s.params);
                  const res = JSON.parse(s.results);
                  return (
                    <tr key={s.id}>
                      <td className={td}>{dateTime(s.created_at)}</td>
                      <td className={td}>{s.name}</td>
                      <td className={`${td} tabular`}>{eur(params.price)}</td>
                      <td className={`${td} tabular`}>{eur(res[1]?.financing.equity)}</td>
                      <td className={`${td} tabular`}>{res.map((r: any) => (r.equityIrr === null ? 'n.c.' : `${(r.equityIrr * 100).toFixed(1)} %`)).join(' / ')}</td>
                    </tr>
                  );
                })}
              </Table>
            </Card>
          )}
          <ScenarioPanel companyId={p.company_id} projectId={id} />
        </div>
      )}
    </div>
  );
}

export default function Acquisitions() {
  const id = useParams().id;
  return id ? <ProjectView id={Number(id)} /> : <List />;
}
