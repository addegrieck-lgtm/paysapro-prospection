import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { api } from '../api';
import { useApp } from '../App';
import { Badge, Button, Card, Empty, ErrorBox, Field, inputCls, Loading, Notice, PageHeader, Table, Tabs, td, useApi } from '../components/ui';
import { ago, dateTime } from '../lib/format';

/* eslint-disable @typescript-eslint/no-explicit-any */
type TabId = 'synchronisations' | 'sources' | 'secteurs' | 'parametres' | 'utilisateurs' | 'imports' | 'sauvegarde' | 'rgpd' | 'journal';

const STATUS: Record<string, string> = { running: 'en cours', success: 'complète', partial: 'PARTIELLE', error: 'en erreur', pending: 'en attente', skipped: 'non interrogée' };
const statusCls = (s: string) => (s === 'success' ? 'text-good' : s === 'partial' || s === 'skipped' ? 'text-warn' : s === 'error' ? 'text-bad' : 'text-volt-300');

function Sync() {
  const { data, error, loading, reload } = useApi(() => api.get<any>('/admin/sync/runs'), []);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [params] = useSearchParams();
  const [auto, setAuto] = useState(params.get('auto') === '1');
  const [jobs, setJobs] = useState<{ id: number; rows: any[] } | null>(null);
  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      await api.post(path, body);
    } catch (e) {
      setErr(e);
      setAuto(false);
    } finally {
      setBusy(false);
      reload();
    }
  };
  // Avancement automatique depuis le navigateur tant que la page est ouverte (en plus de la tâche planifiée)
  useEffect(() => {
    if (!auto || !data || busy) return; // attendre le chargement et la fin de l'étape précédente
    if (!data.active && !data.analysisQueue) return setAuto(false);
    const t = setTimeout(() => void act(data?.active ? '/admin/sync/tick' : '/admin/analysis/continue'), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, data]);
  if (loading && !data) return <Loading />;
  return (
    <div className="space-y-4">
      <ErrorBox error={error ?? err} />
      <Card title="Veille quotidienne">
        <p className="mb-3 text-sm text-fog-400">
          Sur Cloudflare, la veille démarre chaque jour à 4 h 17 (UTC) et avance par étapes toutes les 15 minutes. Chaque étape traite un lot borné ; une source en panne n'arrête pas les autres et une tâche interrompue reprend où elle s'était arrêtée.
        </p>
        {data.active ? (
          <div className="space-y-3">
            <Notice>
              Veille n° {data.active.id} en cours depuis {ago(data.active.started_at)} ({data.active.trigger}). File d'analyse : {data.analysisQueue} entreprise(s).
            </Notice>
            <Table dense head={['Source', 'Statut des tâches', 'Lus', 'Nouveaux', 'Modifiés', 'Erreurs']}>
              {data.progress.map((p: any, i: number) => (
                <tr key={i}>
                  <td className={td}>{p.source_id}</td>
                  <td className={td}>
                    <span className={statusCls(p.status)}>{p.n} {STATUS[p.status] ?? p.status}</span>
                  </td>
                  <td className={`${td} tabular`}>{p.fetched}</td>
                  <td className={`${td} tabular`}>{p.created}</td>
                  <td className={`${td} tabular`}>{p.updated}</td>
                  <td className={`${td} tabular`}>{p.errors}</td>
                </tr>
              ))}
            </Table>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" busy={busy} onClick={() => act('/admin/sync/tick')}>
                Avancer d'une étape
              </Button>
              <Button onClick={() => setAuto(!auto)}>{auto ? 'Arrêter l\'avancement automatique' : 'Avancer automatiquement (page ouverte)'}</Button>
              <Button variant="danger" onClick={() => confirm('Interrompre la veille en cours ? Les tâches restantes seront marquées en erreur.') && act('/admin/sync/cancel')}>
                Interrompre
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" busy={busy} onClick={() => act('/admin/sync/start', {}).then(() => setAuto(true))}>
              Lancer une veille maintenant
            </Button>
            {data.analysisQueue > 0 && (
              <Button busy={busy} onClick={() => setAuto(true)}>
                Terminer l'analyse ({data.analysisQueue} en attente)
              </Button>
            )}
            <Button onClick={() => act('/admin/reanalyze')}>Recalculer tous les scores</Button>
          </div>
        )}
      </Card>
      <Card title="Journal des synchronisations" pad={false}>
        {data.runs.length ? (
          <Table dense head={['N°', 'Déclenchement', 'Début', 'Fin', 'Statut', 'Par source (lus / nouveaux / modifiés / erreurs)', '']}>
            {data.runs.map((r: any) => (
              <tr key={r.id}>
                <td className={td}>{r.id}</td>
                <td className={td}>{r.trigger}</td>
                <td className={td}>{dateTime(r.started_at)}</td>
                <td className={td}>{dateTime(r.finished_at)}</td>
                <td className={td}>
                  <span className={statusCls(r.status)}>{STATUS[r.status] ?? r.status}</span>
                </td>
                <td className={td}>
                  {r.summary
                    ? Object.entries(r.summary).map(([src, s]: [string, any]) => (
                        <div key={src} className={statusCls(s.status)} title={s.problems?.join('\n')}>
                          {src} : {s.fetched} / {s.created} / {s.updated} / {s.errors}
                          {s.status !== 'success' && ` — ${STATUS[s.status]}`}
                          <span className="text-fog-500"> · {Math.round(s.duration_ms / 1000)} s</span>
                          {s.problems?.length ? <div className="max-w-xl truncate text-[10px] text-fog-500">{s.problems[0]}</div> : null}
                        </div>
                      ))
                    : '—'}
                </td>
                <td className={td}>
                  <Button size="sm" variant="ghost" onClick={() => api.get<any>(`/admin/sync/runs/${r.id}`).then((x) => setJobs({ id: r.id, rows: x.jobs }))}>
                    Tâches
                  </Button>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Aucune synchronisation exécutée" />
        )}
      </Card>
      {jobs && (
        <Card title={`Tâches de la veille n° ${jobs.id}`} actions={<Button size="sm" variant="ghost" onClick={() => setJobs(null)}>Fermer</Button>} pad={false}>
          <Table dense head={['Source', 'Tâche', 'Statut', 'Tentatives', 'Lus', 'Nouv.', 'Modif.', 'Erreurs', 'Durée', 'Journal']}>
            {jobs.rows.map((j) => (
              <tr key={j.id}>
                <td className={td}>{j.source_id}</td>
                <td className={td}>{j.task}</td>
                <td className={td}>
                  <span className={statusCls(j.status)}>{STATUS[j.status] ?? j.status}</span>
                </td>
                <td className={td}>{j.attempts}</td>
                <td className={td}>{j.fetched}</td>
                <td className={td}>{j.created}</td>
                <td className={td}>{j.updated}</td>
                <td className={td}>{j.errors}</td>
                <td className={td}>{Math.round(j.duration_ms / 1000)} s</td>
                <td className={`${td} max-w-md whitespace-pre-wrap text-[10px] text-fog-500`}>{j.error_log}</td>
              </tr>
            ))}
          </Table>
        </Card>
      )}
    </div>
  );
}

function Sources() {
  const { data, error, loading, reload } = useApi(() => api.get<{ sources: any[] }>('/admin/sources'), []);
  const [feeds, setFeeds] = useState('');
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    const rss = data?.sources.find((s) => s.id === 'rss');
    if (rss) setFeeds(((rss.config.feeds ?? []) as { url: string; label?: string }[]).map((f) => (f.label ? `${f.label} | ${f.url}` : f.url)).join('\n'));
  }, [data]);
  if (loading && !data) return <Loading />;
  return (
    <div className="space-y-3">
      <ErrorBox error={error ?? err} />
      <Notice>Chaque connecteur est indépendant. Les clés d'API sont des secrets du serveur (variables d'environnement / secrets Cloudflare) : elles ne sont jamais saisies ni affichées ici, seule leur présence est indiquée.</Notice>
      {data!.sources.map((s) => (
        <Card
          key={s.id}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {s.label} {s.official && <Badge className="text-good">source officielle</Badge>}
              {!s.syncable && <Badge>sans synchronisation</Badge>}
            </span>
          }
          actions={
            s.syncable && (
              <>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={s.enabled} onChange={(e) => api.patch(`/admin/sources/${s.id}`, { enabled: e.target.checked }).then(reload).catch(setErr)} /> activée
                </label>
                <Button size="sm" busy={busy === s.id} disabled={!s.enabled} onClick={() => (setBusy(s.id), api.post('/admin/sync/start', { source: s.id }).catch(setErr).finally(() => (setBusy(null), reload())))}>
                  Synchroniser
                </Button>
              </>
            )
          }
        >
          <div className="grid gap-3 text-xs lg:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm text-fog-300">{s.description}</p>
              <p>
                <span className="text-fog-500">Apporte :</span> {s.provides.join(' · ') || '—'}
              </p>
              <p>
                <span className="text-fog-500">Conditions :</span> {s.license}{' '}
                {s.termsUrl && (
                  <a className="text-volt-300 hover:underline" href={s.termsUrl} target="_blank" rel="noopener noreferrer">
                    conditions ↗
                  </a>
                )}{' '}
                {s.docsUrl && (
                  <a className="text-volt-300 hover:underline" href={s.docsUrl} target="_blank" rel="noopener noreferrer">
                    documentation ↗
                  </a>
                )}
              </p>
              <p>
                <span className="text-fog-500">Quotas :</span> {s.quotas}
              </p>
              {s.limitations.length > 0 && (
                <ul className="list-disc pl-4 text-fog-400">
                  {s.limitations.map((l: string) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              )}
            </div>
            <div className="space-y-1.5">
              {Object.keys(s.secrets).length > 0 && (
                <div>
                  <span className="text-fog-500">Clés :</span>{' '}
                  {Object.entries(s.secrets).map(([k, ok]) => (
                    <Badge key={k} className={ok ? 'text-good' : 'text-warn'}>
                      {k} {ok ? 'configurée' : 'manquante'}
                    </Badge>
                  ))}
                  {s.keyProcedure && <p className="mt-1 text-fog-400">{s.keyProcedure}</p>}
                </div>
              )}
              {s.syncable && (
                <p>
                  <span className="text-fog-500">Dernière synchronisation :</span> {dateTime(s.last_sync_at)} · <span className="text-fog-500">dernier succès :</span> {dateTime(s.last_success_at)}{' '}
                  {s.last_status && <span className={statusCls(s.last_status)}>({STATUS[s.last_status] ?? s.last_status})</span>}
                </p>
              )}
              {s.last_error && <p className="text-bad">Dernière erreur : {s.last_error}</p>}
              {s.id === 'rss' && (
                <div className="space-y-1">
                  <Field label="Flux RSS / Atom (un par ligne, format « Libellé | https://… »)" hint="N'ajoutez que des flux publiés pour être syndiqués, dont les conditions permettent la réutilisation.">
                    <textarea className={`${inputCls} h-28 py-2 font-mono text-xs`} value={feeds} onChange={(e) => setFeeds(e.target.value)} />
                  </Field>
                  <Button
                    size="sm"
                    onClick={() =>
                      api
                        .patch('/admin/sources/rss', {
                          feeds: feeds
                            .split('\n')
                            .map((l) => l.trim())
                            .filter(Boolean)
                            .map((l) => {
                              const [a, b] = l.includes('|') ? l.split('|').map((x) => x.trim()) : [undefined, l];
                              return { label: b ? a : undefined, url: b ?? a! };
                            }),
                        })
                        .then(reload)
                        .catch(setErr)
                    }
                  >
                    Enregistrer les flux
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function Sectors() {
  const { refreshMeta } = useApp();
  const { data, error, loading, reload } = useApi(() => api.get<{ rows: any[]; builtin: any[] }>('/admin/sectors'), []);
  const [err, setErr] = useState<unknown>(null);
  if (loading && !data) return <Loading />;
  return (
    <Card title="Secteurs suivis (classification hiérarchique NAF rév. 2)" pad={false}>
      <ErrorBox error={error ?? err} />
      <Table dense head={['Secteur', 'Priorité', 'Codes NAF intégrés', 'Codes NAF ajoutés', 'Suivi']}>
        {data!.rows.map((s) => {
          const b = data!.builtin.find((x) => x.id === s.id);
          return (
            <tr key={s.id} className={s.parent_id ? '' : 'bg-ink-750/40'}>
              <td className={`${td} ${s.parent_id ? 'pl-6' : 'font-semibold'}`}>{s.label}</td>
              <td className={td}>{s.priority ?? (s.parent_id ? 'transversal' : '')}</td>
              <td className={`${td} max-w-sm text-fog-500`}>{b?.naf.join(', ')}</td>
              <td className={td}>
                {s.parent_id && (
                  <input className={`${inputCls} h-7 text-xs`} defaultValue={s.naf_codes} placeholder="ex. 43.29A" onBlur={(e) => e.target.value !== s.naf_codes && api.patch(`/admin/sectors/${s.id}`, { naf_codes: e.target.value }).then(reload).catch(setErr)} aria-label={`Codes NAF ajoutés pour ${s.label}`} />
                )}
              </td>
              <td className={td}>
                <input type="checkbox" checked={!!s.enabled} onChange={(e) => api.patch(`/admin/sectors/${s.id}`, { enabled: e.target.checked }).then(() => (reload(), refreshMeta())).catch(setErr)} aria-label={`Suivre ${s.label}`} />
              </td>
            </tr>
          );
        })}
      </Table>
      <p className="px-3 py-2 text-[11px] text-fog-500">La découverte interroge les codes NAF des secteurs suivis. Désactiver un groupe désactive ses sous-secteurs.</p>
    </Card>
  );
}

function JsonSetting({ k, title, help, value, onSaved }: { k: string; title: string; help: string; value: unknown; onSaved: () => void }) {
  const [text, setText] = useState(JSON.stringify(value, null, 2));
  const [err, setErr] = useState<unknown>(null);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    setText(JSON.stringify(value, null, 2));
  }, [value]);
  const save = async () => {
    setErr(null);
    try {
      await api.put(`/admin/settings/${k}`, JSON.parse(text));
      setOk(true);
      setTimeout(() => setOk(false), 2000);
      onSaved();
    } catch (e) {
      setErr(e instanceof SyntaxError ? new Error('JSON invalide.') : e);
    }
  };
  return (
    <Card title={title} actions={<Button size="sm" onClick={save}>{ok ? 'Enregistré ✓' : 'Enregistrer'}</Button>}>
      <p className="mb-2 text-xs text-fog-400">{help}</p>
      <textarea className={`${inputCls} h-56 py-2 font-mono text-xs`} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label={title} />
      <ErrorBox error={err} />
    </Card>
  );
}

function Weights({ value, k, labels, onSaved }: { value: Record<string, number>; k: string; labels: Record<string, string>; onSaved: () => void }) {
  const [w, setW] = useState(value);
  const [err, setErr] = useState<unknown>(null);
  useEffect(() => {
    setW(value);
  }, [value]);
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return (
    <Card title={k === 'scoringWeights' ? 'Pondérations du score économique' : 'Pondérations du score de risque'} actions={<Button size="sm" onClick={() => api.put(`/admin/settings/${k}`, w).then(onSaved).catch(setErr)}>Enregistrer et recalculer</Button>}>
      <div className="grid gap-2 sm:grid-cols-2">
        {Object.entries(w).map(([key, v]) => (
          <Field key={key} label={labels[key] ?? key}>
            <input type="number" min={0} max={100} className={inputCls} value={v} onChange={(e) => setW({ ...w, [key]: Number(e.target.value) })} />
          </Field>
        ))}
      </div>
      <p className="mt-2 text-xs text-fog-400">Total : {total} points (le score est normalisé sur 100).</p>
      <ErrorBox error={err} />
    </Card>
  );
}

function Settings() {
  const { data, error, loading, reload } = useApi(() => api.get<any>('/admin/settings'), []);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const s = data.settings;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Weights k="scoringWeights" value={s.scoringWeights} onSaved={reload} labels={{ rentabilite: 'Rentabilité', recurrence: 'Récurrence clientèle', prix: 'Prix et valorisation', croissance: 'Potentiel de croissance', solidite: "Solidité de l'activité", facilite: 'Facilité de reprise' }} />
      <Weights k="riskWeights" value={s.riskWeights} onSaved={reload} labels={{ financier: 'Financier', juridique: 'Juridique', social: 'Social', operationnel: 'Opérationnel', dirigeant: 'Dépendance au dirigeant', clients: 'Dépendance aux clients', investissement: "Besoin d'investissement", incertitude: 'Incertitude des données' }} />
      <JsonSetting k="valuation" title="Valorisation (hypothèses paramétrables)" help="Multiples d'EBE par taille, ajustements, multiples de CA et secteurs concernés, fonds de commerce, flux actualisés, pondération des méthodes. Ces coefficients sont des hypothèses de travail, pas des références officielles." value={s.valuation} onSaved={reload} />
      <JsonSetting k="deal" title="Hypothèses de financement par défaut" help="Frais d'acquisition, part d'emprunt, taux, durée, impôt, BFR, trésorerie de sécurité (en mois de CA × 30 %)." value={s.deal} onSaved={reload} />
      <JsonSetting k="alerts" title="Alertes" help="Types activés, seuil de score élevé, fiabilité minimale, variation financière déclenchant une alerte (0,2 = 20 %)." value={s.alerts} onSaved={reload} />
      <JsonSetting k="sync" title="Synchronisation" help="Départements couverts (ex. [&quot;76&quot;, &quot;27&quot;]), profondeur d'historique BODACC (années), lots par étape, rafraîchissement de l'identité (jours), plafond Pappers quotidien, sites lus par étape." value={s.sync} onSaved={reload} />
      <JsonSetting k="retention" title="Durées de conservation (jours)" help="Journal d'audit, journaux de synchronisation, alertes, extraits bruts des sources, entreprises inactives sans opportunité ni projet." value={s.retention} onSaved={reload} />
      <JsonSetting
        k="ai"
        title="RADAR AI — modèle externe (facultatif)"
        help={`provider : "local" (gratuit, par défaut) ou "anthropic". Le modèle externe ne reçoit que la question, la réponse locale et les données utilisées ; plafond de dépense mensuel en dollars. Clé ANTHROPIC_API_KEY ${data.secrets.ANTHROPIC_API_KEY ? 'configurée' : 'NON configurée (secret serveur)'}.`}
        value={s.ai}
        onSaved={reload}
      />
      <JsonSetting k="map" title="Fond de carte" help="URL de tuiles (HTTPS, avec {z}/{x}/{y}) et attribution exigée par le fournisseur. Pensez à autoriser le domaine dans public/_headers (Content-Security-Policy)." value={s.map} onSaved={reload} />
    </div>
  );
}

function Users() {
  const { user } = useApp();
  const { data, error, loading, reload } = useApi(() => api.get<{ rows: any[] }>('/admin/users'), []);
  const [f, setF] = useState({ email: '', name: '', password: '', role: 'analyste' });
  const [err, setErr] = useState<unknown>(null);
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwMsg, setPwMsg] = useState<unknown>(null);
  if (loading && !data) return <Loading />;
  return (
    <div className="space-y-4">
      <ErrorBox error={error ?? err} />
      <Card title="Utilisateurs" pad={false}>
        <Table dense head={['Nom', 'E-mail', 'Rôle', 'Dernière connexion', 'État', '']}>
          {data!.rows.map((u) => (
            <tr key={u.id}>
              <td className={td}>{u.name}</td>
              <td className={td}>{u.email}</td>
              <td className={td}>
                <select className="rounded border border-ink-600 bg-ink-850 px-1 text-xs" value={u.role} disabled={u.id === user.id} onChange={(e) => api.patch(`/admin/users/${u.id}`, { role: e.target.value }).then(reload).catch(setErr)}>
                  <option value="admin">admin</option>
                  <option value="analyste">analyste</option>
                  <option value="lecteur">lecteur</option>
                </select>
              </td>
              <td className={td}>{dateTime(u.last_login_at)}</td>
              <td className={td}>{u.disabled ? <span className="text-bad">désactivé</span> : u.locked_until && u.locked_until > new Date().toISOString() ? <span className="text-warn">verrouillé</span> : 'actif'}</td>
              <td className={td}>
                {u.id !== user.id && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => api.patch(`/admin/users/${u.id}`, { disabled: !u.disabled }).then(reload)}>
                      {u.disabled ? 'Réactiver' : 'Désactiver'}
                    </Button>
                    {u.failed_attempts > 0 && (
                      <Button size="sm" variant="ghost" onClick={() => api.patch(`/admin/users/${u.id}`, { unlock: true }).then(reload)}>
                        Déverrouiller
                      </Button>
                    )}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Créer un compte">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="Nom" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-label="Nom" />
            <input className={inputCls} placeholder="E-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-label="E-mail" />
            <input className={inputCls} placeholder="Mot de passe initial (12+ car.)" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} aria-label="Mot de passe" autoComplete="new-password" />
            <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Rôle">
              <option value="lecteur">Lecteur (consultation)</option>
              <option value="analyste">Analyste (suivi, exports)</option>
              <option value="admin">Administrateur</option>
            </select>
          </div>
          <Button className="mt-3" variant="primary" onClick={() => api.post('/admin/users', f).then(() => (setF({ email: '', name: '', password: '', role: 'analyste' }), reload())).catch(setErr)}>
            Créer
          </Button>
        </Card>
        <Card title="Mon mot de passe">
          <div className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} type="password" placeholder="Mot de passe actuel" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} aria-label="Mot de passe actuel" autoComplete="current-password" />
            <input className={inputCls} type="password" placeholder="Nouveau mot de passe" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} aria-label="Nouveau mot de passe" autoComplete="new-password" />
          </div>
          <Button className="mt-3" onClick={() => api.post('/auth/password', pw).then(() => window.location.reload()).catch(setPwMsg)}>
            Changer (reconnexion requise)
          </Button>
          <ErrorBox error={pwMsg} />
        </Card>
      </div>
    </div>
  );
}

function Imports() {
  const [kind, setKind] = useState<'entreprises' | 'comptes' | 'annonces' | 'signaux'>('annonces');
  const [report, setReport] = useState<any>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const HELP: Record<string, string> = {
    entreprises: "Liste de SIREN à suivre (+ site internet facultatif). Les identités sont ensuite vérifiées dans l'annuaire officiel à la prochaine veille.",
    comptes: "Comptes détaillés (liasses fournies par le vendeur, comptes consultés…). Statut « déclarative » par défaut, « officielle » si vous l'indiquez et que la source est officielle.",
    annonces: 'Annonces de cession consultées sur Bpifrance Transmission, Transentreprise, cabinets, presse… Elles alimentent « Opportunités à vendre ».',
    signaux: 'Signaux publics de transmission (avec description de la preuve et lien). Force 1 (faible) à 3 (explicite).',
  };
  return (
    <Card title="Import manuel (CSV, séparateur « ; » ou « , »)">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Type de données">
          <select className={inputCls} value={kind} onChange={(e) => (setKind(e.target.value as typeof kind), setReport(null))}>
            <option value="annonces">Annonces de cession</option>
            <option value="comptes">Comptes annuels détaillés</option>
            <option value="entreprises">Liste d'entreprises (SIREN)</option>
            <option value="signaux">Signaux de transmission</option>
          </select>
        </Field>
        <a className="mb-2 text-sm text-volt-300 hover:underline" href={`/api/admin/import/template/${kind}`}>
          Télécharger le modèle
        </a>
      </div>
      <p className="my-2 text-xs text-fog-400">{HELP[kind]}</p>
      <input
        type="file"
        accept=".csv,text/csv"
        disabled={busy}
        aria-label="Fichier CSV"
        className="text-sm text-fog-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-fog-100"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          setErr(null);
          try {
            setReport(await api.post(`/admin/import/${kind}`, await file.text()));
          } catch (x) {
            setErr(x);
          } finally {
            setBusy(false);
            e.target.value = '';
          }
        }}
      />
      <ErrorBox error={err} />
      {report && (
        <div className="mt-3 space-y-2">
          <Notice tone={report.errors.length ? 'warn' : 'good'}>
            {report.imported} ligne(s) importée(s) sur {report.rows}. {report.errors.length} ligne(s) rejetée(s).
          </Notice>
          {report.errors.length > 0 && (
            <ul className="max-h-60 overflow-y-auto text-xs text-fog-400">
              {report.errors.map((e: any) => (
                <li key={e.line}>
                  Ligne {e.line} : {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function Backup() {
  const [err, setErr] = useState<unknown>(null);
  const [msg, setMsg] = useState('');
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Sauvegarde">
        <p className="mb-3 text-sm text-fog-400">Fichier JSON complet (données, réglages, comptes avec mots de passe hachés, journaux). Les documents de l'Acquisition Manager ne sont pas inclus. Conservez-le en lieu sûr.</p>
        <a className="inline-flex h-9 items-center rounded-lg bg-volt-500 px-3.5 text-sm font-medium text-white hover:bg-volt-600" href="/api/admin/backup">
          Télécharger la sauvegarde
        </a>
        <p className="mt-3 text-xs text-fog-500">Sur Cloudflare D1, la fonction « Time Travel » permet aussi de restaurer la base à un instant des 30 derniers jours (voir docs/DEPLOIEMENT.md).</p>
      </Card>
      <Card title="Restauration">
        <Notice tone="warn">La restauration remplace toutes les données actuelles et déconnecte tous les utilisateurs.</Notice>
        <input
          type="file"
          accept=".json,application/json"
          aria-label="Fichier de sauvegarde"
          className="mt-3 text-sm text-fog-300 file:mr-3 file:rounded-lg file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-fog-100"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || !confirm('Remplacer toutes les données par cette sauvegarde ?')) return;
            try {
              const r = await api.post<{ counts: Record<string, number> }>('/admin/restore', JSON.parse(await file.text()));
              setMsg(`Restauration effectuée (${r.counts.companies ?? 0} entreprises). Reconnectez-vous.`);
              setTimeout(() => window.location.reload(), 2500);
            } catch (x) {
              setErr(x);
            }
          }}
        />
        {msg && <Notice tone="good">{msg}</Notice>}
        <ErrorBox error={err} />
      </Card>
    </div>
  );
}

function Rgpd() {
  const { data, error, loading, reload } = useApi(() => api.get<any>('/admin/rgpd'), []);
  const [req, setReq] = useState({ kind: 'suppression', subject: '', siren: '', notes: '' });
  const [err, setErr] = useState<unknown>(null);
  const [purge, setPurge] = useState<any>(null);
  if (loading && !data) return <Loading />;
  if (error) return <ErrorBox error={error} />;
  const r = data.register;
  return (
    <div className="space-y-4">
      <ErrorBox error={err} />
      <Card title="Registre des traitements">
        <dl className="grid gap-2 text-sm lg:grid-cols-2">
          {Object.entries(r).map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wider text-fog-500">{k.replace(/_/g, ' ')}</dt>
              <dd className="text-fog-300">{Array.isArray(v) ? (v as string[]).join(' ; ') : String(v)}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Enregistrer une demande">
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={inputCls} value={req.kind} onChange={(e) => setReq({ ...req, kind: e.target.value })} aria-label="Type de demande">
              <option value="suppression">Effacement</option>
              <option value="opposition">Opposition</option>
              <option value="acces">Accès</option>
              <option value="rectification">Rectification</option>
            </select>
            <input className={inputCls} placeholder="SIREN concerné (facultatif)" value={req.siren} onChange={(e) => setReq({ ...req, siren: e.target.value })} aria-label="SIREN" />
            <input className={`${inputCls} sm:col-span-2`} placeholder="Demandeur / objet" value={req.subject} onChange={(e) => setReq({ ...req, subject: e.target.value })} aria-label="Objet" />
            <input className={`${inputCls} sm:col-span-2`} placeholder="Notes" value={req.notes} onChange={(e) => setReq({ ...req, notes: e.target.value })} aria-label="Notes" />
          </div>
          <Button className="mt-3" onClick={() => api.post('/admin/rgpd/requests', { ...req, siren: req.siren || undefined, notes: req.notes || undefined }).then(() => (setReq({ kind: 'suppression', subject: '', siren: '', notes: '' }), reload())).catch(setErr)}>
            Enregistrer
          </Button>
        </Card>
        <Card title="Purge selon les durées de conservation">
          <p className="mb-2 text-sm text-fog-400">Exécutée automatiquement chaque jour avec la veille. Durées : {Object.entries(data.retention).map(([k, v]) => `${k} ${v} j`).join(', ')}.</p>
          <Button onClick={() => api.post('/admin/rgpd/purge').then(setPurge).catch(setErr)}>Purger maintenant</Button>
          {purge && <p className="mt-2 text-xs text-fog-400">{Object.entries(purge).map(([k, v]) => `${k} : ${v}`).join(' · ')}</p>}
        </Card>
      </div>
      <Card title="Demandes" pad={false}>
        {data.requests.length ? (
          <Table dense head={['Date', 'Type', 'Objet', 'Entreprise', 'Statut', 'Actions']}>
            {data.requests.map((x: any) => (
              <tr key={x.id}>
                <td className={td}>{dateTime(x.created_at)}</td>
                <td className={td}>{x.kind}</td>
                <td className={td}>
                  {x.subject}
                  {x.notes && <div className="text-fog-500">{x.notes}</div>}
                </td>
                <td className={td}>{x.company_name ?? '—'}</td>
                <td className={td}>{x.status}</td>
                <td className={td}>
                  {x.status === 'recue' && (
                    <span className="flex flex-wrap gap-1">
                      {x.company_id && (x.kind === 'suppression' || x.kind === 'opposition') && (
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={async () => {
                            const siren = prompt('Confirmez le SIREN à effacer (suppression définitive + opposition à la réimportation) :');
                            if (siren) await api.post('/admin/rgpd/erase', { siren, reason: `${x.kind} : ${x.subject}`, requestId: x.id }).catch(setErr);
                            reload();
                          }}
                        >
                          Effacer et opposer
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => api.patch(`/admin/rgpd/requests/${x.id}`, { status: 'traitee' }).then(reload)}>
                        Traitée
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => api.patch(`/admin/rgpd/requests/${x.id}`, { status: 'rejetee' }).then(reload)}>
                        Rejetée
                      </Button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Aucune demande" />
        )}
      </Card>
      <Card title={`Liste d'opposition (${data.suppression.length})`}>
        <p className="text-xs text-fog-400">{data.suppression.map((s: any) => s.siren).join(', ') || 'Vide.'}</p>
      </Card>
    </div>
  );
}

function Journal() {
  const [page, setPage] = useState(1);
  const { data, error, loading } = useApi(() => api.get<{ rows: any[] }>(`/admin/audit?page=${page}`), [page]);
  if (loading && !data) return <Loading />;
  return (
    <Card title="Journal d'audit" pad={false}>
      <ErrorBox error={error} />
      <Table dense head={['Date', 'Utilisateur', 'Action', 'Objet', 'Détails']}>
        {data!.rows.map((a) => (
          <tr key={a.id}>
            <td className={`${td} whitespace-nowrap`}>{dateTime(a.created_at)}</td>
            <td className={td}>{a.email ?? '—'}</td>
            <td className={td}>{a.action}</td>
            <td className={td}>{[a.entity_type, a.entity_id].filter(Boolean).join(' ')}</td>
            <td className={`${td} max-w-lg truncate text-fog-500`} title={a.details ?? ''}>
              {a.details}
            </td>
          </tr>
        ))}
      </Table>
      <div className="flex justify-end gap-2 p-2">
        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ← Plus récents
        </Button>
        <Button size="sm" variant="ghost" disabled={(data?.rows.length ?? 0) < 100} onClick={() => setPage(page + 1)}>
          Plus anciens →
        </Button>
      </div>
    </Card>
  );
}

export default function Admin() {
  const { can } = useApp();
  const tab = ((useParams()['*'] || 'synchronisations') as TabId) ?? 'synchronisations';
  const nav = useNavigate();
  if (!can('admin')) return <Empty title="Accès réservé aux administrateurs" />;
  return (
    <div className="fade-in">
      <PageHeader title="Administration" subtitle="Sources, synchronisations, secteurs, pondérations, utilisateurs, imports, sauvegardes et conformité." />
      <Tabs<TabId>
        value={tab}
        onChange={(t) => nav(`/admin/${t}`)}
        items={[
          { id: 'synchronisations', label: 'Synchronisations' },
          { id: 'sources', label: 'Sources' },
          { id: 'secteurs', label: 'Secteurs' },
          { id: 'parametres', label: 'Scoring & paramètres' },
          { id: 'utilisateurs', label: 'Utilisateurs' },
          { id: 'imports', label: 'Imports' },
          { id: 'sauvegarde', label: 'Sauvegarde' },
          { id: 'rgpd', label: 'RGPD' },
          { id: 'journal', label: 'Journal' },
        ]}
      />
      {tab === 'synchronisations' && <Sync />}
      {tab === 'sources' && <Sources />}
      {tab === 'secteurs' && <Sectors />}
      {tab === 'parametres' && <Settings />}
      {tab === 'utilisateurs' && <Users />}
      {tab === 'imports' && <Imports />}
      {tab === 'sauvegarde' && <Backup />}
      {tab === 'rgpd' && <Rgpd />}
      {tab === 'journal' && <Journal />}
    </div>
  );
}
