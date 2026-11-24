import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, Hand, Loader2, MapPin, Radar, Square, Tag } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useApi, useReferentials } from '../lib/hooks';
import { cn, fmtDateTime } from '../lib/format';
import type { AssistedQuery, Campaign, CompanySummary, SearchRun } from '../lib/types';
import { Badge, Button, Card, Chip, Input, Label, PageHeader, Select, Toggle, useToast } from '../components/ui';
import { FacebookIcon, InstagramIcon } from '../components/brand';
import CompanyTable from '../components/CompanyTable';
import AssistedSearch from '../components/AssistedSearch';

type Networks = 'instagram' | 'facebook' | 'both';
const FILTERS: { key: string; label: string; hint: string }[] = [
  { key: 'recent_activity', label: 'Activité récente', hint: 'Exclut les profils dont la dernière publication connue date de plus de 90 jours' },
  { key: 'single_network', label: 'Présence sur un seul réseau', hint: '' },
  { key: 'both_networks', label: 'Présents sur les deux réseaux', hint: '' },
  { key: 'high_potential', label: 'Fort potentiel commercial', hint: 'Score commercial ≥ 70' },
  { key: 'new_only', label: 'Nouveaux profils uniquement', hint: 'Ignore les entreprises déjà enregistrées' },
];

export default function DiscoveryPage() {
  const ref = useReferentials();
  const toast = useToast();
  const conn = useApi<{ any_search_ready: boolean; search: { label: string; state: string }[]; meta: { state: string } }>('/connectors');
  const campaigns = useApi<Campaign[]>('/campaigns');
  const [region, setRegion] = useState('28');
  const [department, setDepartment] = useState('76');
  const [city, setCity] = useState('');
  const [radius, setRadius] = useState(0);
  const [activities, setActivities] = useState<string[]>([]);
  const [keywords, setKeywords] = useState('');
  const [networks, setNetworks] = useState<Networks>('both');
  const [target, setTarget] = useState(25);
  const [filters, setFilters] = useState<Record<string, boolean>>({});
  const [campaignMode, setCampaignMode] = useState<'none' | 'new' | 'existing'>('new');
  const [campaignId, setCampaignId] = useState<number | ''>('');
  const [campaignName, setCampaignName] = useState('');
  const [run, setRun] = useState<SearchRun | null>(null);
  const [results, setResults] = useState<CompanySummary[]>([]);
  const [assisted, setAssisted] = useState<AssistedQuery[] | null>(null);
  const [assistedResults, setAssistedResults] = useState<CompanySummary[]>([]);
  const [launching, setLaunching] = useState(false);
  const timer = useRef<number | null>(null);
  const history = useApi<SearchRun[]>('/searches?limit=8', [run?.status]);

  const deps = useMemo(() => (ref?.departments ?? []).filter((d) => !region || d.region === region), [ref, region]);
  const actLabel = (k: string) => ref?.activities.find((a) => a.key === k)?.label ?? k;
  const autoName = useMemo(() => {
    const what = activities.map(actLabel).join(', ') || keywords.split(',')[0]?.trim() || 'Prospects';
    const where = city || deps.find((d) => d.code === department)?.name || ref?.regions.find((r) => r.code === region)?.name || '';
    return `${what}${where ? ` — ${where}` : ''}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities, keywords, city, department, region, ref]);

  const sectors = useMemo(() => {
    const m = new Map<string, NonNullable<typeof ref>['activities']>();
    for (const a of ref?.activities ?? []) m.set(a.sector, [...(m.get(a.sector) ?? []), a]);
    return [...m.entries()];
  }, [ref]);

  const params = () => ({
    activities, keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
    platforms: networks === 'both' ? ['instagram', 'facebook'] : [networks], target, country: 'FR', region: region || null,
    department: department || null, city: city.trim() || null, radius_km: city ? radius : 0, filters,
    campaign_id: campaignMode === 'existing' && campaignId ? campaignId : null,
    campaign_name: campaignMode === 'new' ? (campaignName.trim() || autoName) : null,
  });

  const poll = (id: number) => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      const s = await api.get<SearchRun>(`/searches/${id}`);
      setRun(s);
      const list = await api.get<{ items: CompanySummary[] }>(`/companies${qs({ search_id: id, limit: 200 })}`);
      setResults(list.items);
      if (s.status !== 'running') {
        window.clearInterval(timer.current!);
        if (s.status === 'no_source') setAssisted(s.stats.assisted_queries ?? []);
      }
    }, 1200);
  };
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);

  const launch = async () => {
    if (!activities.length && !keywords.trim()) return toast('Choisissez au moins une activité ou un mot-clé.', 'bad');
    if (!city && !department && !region) return toast('Choisissez une localisation.', 'bad');
    setLaunching(true);
    setAssisted(null);
    setResults([]);
    try {
      const r = await api.post<{ search_id: number }>('/searches', params());
      setRun({ id: r.search_id, status: 'running', stats: { target } as SearchRun['stats'], log: [], params: {}, campaign_id: null, started_at: '', finished_at: null });
      poll(r.search_id);
      campaigns.reload();
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setLaunching(false);
    }
  };
  const openAssisted = async () => setAssisted(await api.post<AssistedQuery[]>('/assisted/queries', params()));
  const cancel = async () => run && api.post(`/searches/${run.id}/cancel`);
  const enqueueAll = async () => {
    const ids = results.filter((r) => r.status === 'new' && r.confidence_score >= 50).map((r) => r.id);
    const r = await api.post<{ updated: number }>('/companies/bulk/enqueue', ids);
    toast(`${r.updated} prospect(s) ajouté(s) à la file « À contacter »`, 'good');
  };

  const s = run?.stats;
  const pct = s && s.target ? Math.min(100, Math.round(((s.qualified ?? 0) / s.target) * 100)) : 0;
  const running = run?.status === 'running';
  const noSource = conn.data && !conn.data.any_search_ready;

  return (
    <>
      <PageHeader eyebrow="Moteur autonome" title="Découverte sociale"
        subtitle="Le logiciel interroge les moteurs de recherche autorisés, repère les profils Instagram et les pages Facebook professionnels, les rapproche et calcule leurs deux scores." />

      {noSource && (
        <div className="mb-5 flex gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13.5px]">
          <AlertTriangle className="size-5 text-warn shrink-0" />
          <div>
            <p className="font-medium text-ink">Aucune source de recherche automatique n'est configurée.</p>
            <p className="text-ink-2">Aucun résultat ne sera inventé : configurez une API gratuite dans <Link to="/sources" className="underline">Sources &amp; connecteurs</Link> (Brave Search conseillé), ou utilisez la <button onClick={openAssisted} className="underline">recherche assistée</button>.</p>
          </div>
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_340px] gap-5">
        <Card>
          <div className="space-y-7">
            <section>
              <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-3"><MapPin className="size-4 text-brass" />1 · Localisation</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3">
                <div><Label>Pays</Label><Select value="FR" disabled><option value="FR">France</option></Select></div>
                <div><Label>Région</Label>
                  <Select value={region} onChange={(e) => { setRegion(e.target.value); setDepartment(''); }}>
                    <option value="">Toutes</option>{ref?.regions.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </Select></div>
                <div><Label>Département</Label>
                  <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
                    <option value="">Tous</option>{deps.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
                  </Select></div>
                <div><Label>Ville</Label><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="ex. Le Havre" /></div>
                <div title="Communes voisines via geo.api.gouv.fr"><Label>Rayon</Label>
                  <Select value={radius} onChange={(e) => setRadius(Number(e.target.value))} disabled={!city}>
                    {[0, 5, 10, 20, 30, 50].map((r) => <option key={r} value={r}>{r ? `${r} km` : 'Ville seule'}</option>)}
                  </Select></div>
              </div>
            </section>

            <section>
              <h3 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-3"><Tag className="size-4 text-brass" />2 · Activités</h3>
              <div className="space-y-3">
                {sectors.map(([sector, acts]) => (
                  <div key={sector}>
                    <p className="text-[12px] text-muted mb-1.5">{sector}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {acts.map((a) => (
                        <Chip key={a.key} active={activities.includes(a.key)}
                          onClick={() => setActivities((x) => (x.includes(a.key) ? x.filter((k) => k !== a.key) : [...x, a.key]))}>{a.label}</Chip>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="max-w-xl"><Label hint="séparés par des virgules ; seuls, ils servent d'activité">Mots-clés personnalisés</Label>
                  <Input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="ex. fait maison, bio, traiteur événementiel" /></div>
              </div>
            </section>

            <section className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-3">3 · Réseaux sociaux</h3>
                <div className="flex flex-wrap gap-1.5">
                  <Chip active={networks === 'instagram'} onClick={() => setNetworks('instagram')} icon={<InstagramIcon className="size-3.5" />}>Instagram</Chip>
                  <Chip active={networks === 'facebook'} onClick={() => setNetworks('facebook')} icon={<FacebookIcon className="size-3.5" />}>Facebook</Chip>
                  <Chip active={networks === 'both'} onClick={() => setNetworks('both')}>Instagram + Facebook</Chip>
                </div>
              </div>
              <div>
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-3">4 · Quantité</h3>
                <div className="flex flex-wrap gap-1.5">
                  {[10, 25, 50, 100].map((n) => <Chip key={n} active={target === n} onClick={() => setTarget(n)}>{n} entreprises</Chip>)}
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-2">5 · Filtres</h3>
              <div className="grid sm:grid-cols-2 gap-x-6">
                {FILTERS.map((f) => (
                  <Toggle key={f.key} checked={!!filters[f.key]} label={f.label} hint={f.hint || undefined}
                    onChange={(v) => setFilters((x) => ({ ...x, [f.key]: v, ...(v && f.key === 'both_networks' ? { single_network: false } : {}), ...(v && f.key === 'single_network' ? { both_networks: false } : {}) }))} />
                ))}
              </div>
            </section>

            <section className="flex flex-wrap items-end gap-3 border-t border-line pt-5">
              <div className="w-48"><Label>Campagne</Label>
                <Select value={campaignMode} onChange={(e) => setCampaignMode(e.target.value as typeof campaignMode)}>
                  <option value="new">Nouvelle campagne</option><option value="existing">Campagne existante</option><option value="none">Sans campagne</option>
                </Select></div>
              {campaignMode === 'new' && <div className="flex-1 min-w-52"><Label>Nom</Label><Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder={autoName} /></div>}
              {campaignMode === 'existing' && (
                <div className="flex-1 min-w-52"><Label>Campagne</Label>
                  <Select value={campaignId} onChange={(e) => setCampaignId(Number(e.target.value) || '')}>
                    <option value="">Choisir…</option>{campaigns.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select></div>
              )}
              <div className="flex gap-2 ml-auto">
                <Button onClick={openAssisted}><Hand className="size-4" />Recherche assistée</Button>
                <Button variant="brass" size="lg" onClick={launch} loading={launching} disabled={running}>
                  <Radar className="size-5" />LANCER LA RECHERCHE
                </Button>
              </div>
            </section>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Sources actives">
            <ul className="space-y-2 text-[13px]">
              {conn.data?.search.map((c) => (
                <li key={c.label} className="flex items-center justify-between gap-2">
                  <span className="text-ink-2">{c.label}</span>
                  <Badge tone={c.state === 'ok' ? 'good' : 'neutral'}>{c.state === 'ok' ? 'Active' : c.state === 'disabled' ? 'Désactivée' : 'Non configurée'}</Badge>
                </li>
              ))}
              <li className="flex items-center justify-between gap-2"><span className="text-ink-2">Vérification API Meta</span>
                <Badge tone={conn.data?.meta.state === 'ok' ? 'good' : 'neutral'}>{conn.data?.meta.state === 'ok' ? 'Active' : 'Facultative'}</Badge></li>
            </ul>
            <Link to="/sources" className="mt-3 inline-block text-[13px] text-seine hover:underline">Configurer les sources →</Link>
          </Card>
          <Card title="Recherches récentes">
            {history.data?.length ? (
              <ul className="space-y-2">
                {history.data.map((h) => (
                  <li key={h.id}>
                    <button className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-paper" onClick={() => { setRun(h); poll(h.id); }}>
                      <div className="flex justify-between text-[13px]"><span className="font-medium">#{h.id} · {(h.params.city as string) || (h.params.department as string) || 'Zone'}</span>
                        <span className="text-muted num">{h.stats.qualified ?? 0}/{h.stats.target ?? '—'}</span></div>
                      <div className="text-[11.5px] text-muted">{fmtDateTime(h.started_at)} · {statusText(h.status)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted">Aucune recherche.</p>}
          </Card>
        </div>
      </div>

      {run && (
        <Card className="mt-5" title={<span className="flex items-center gap-2">{running ? <Loader2 className="size-4 animate-spin text-seine" /> : <CheckCircle2 className="size-4 text-good" />}Recherche #{run.id} — {statusText(run.status)}</span>}
          action={running ? <Button size="sm" variant="danger" onClick={cancel}><Square className="size-3.5" />Arrêter</Button> :
            results.length > 0 ? <Button size="sm" variant="primary" onClick={enqueueAll}>Ajouter les fiables à la file</Button> : null}>
          <div className="mb-4">
            <div className="flex justify-between text-[13px] mb-1.5"><span className="text-ink-2">Entreprises correspondant aux critères</span><span className="num font-semibold">{s?.qualified ?? 0} / {s?.target ?? target}</span></div>
            <div className="h-2.5 rounded-full bg-paper overflow-hidden"><div className={cn('h-full rounded-full bg-seine transition-all', running && 'animate-pulse')} style={{ width: `${pct}%` }} /></div>
          </div>
          {s && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-4 text-center">
              {[['Requêtes', s.requests], ['Résultats lus', s.results], ['Instagram', s.instagram], ['Facebook', s.facebook], ['Rapprochements', s.auto_merged], ['À valider', s.suggestions]].map(([l, v]) => (
                <div key={l as string} className="rounded-lg bg-paper py-2"><div className="text-lg font-semibold num">{v ?? 0}</div><div className="text-[11px] text-muted">{l}</div></div>
              ))}
            </div>
          )}
          {run.log && run.log.length > 0 && (
            <details className="mb-4" open={running}>
              <summary className="text-[13px] text-muted cursor-pointer">Journal de la recherche</summary>
              <pre className="mt-2 max-h-48 overflow-y-auto scroll-thin rounded-lg bg-ink text-white/80 text-[11.5px] p-3 whitespace-pre-wrap">{run.log.join('\n')}</pre>
            </details>
          )}
          {results.length > 0 && <CompanyTable items={results} />}
        </Card>
      )}

      {assisted && (
        <Card className="mt-5" title="Recherche assistée" subtitle="Validation humaine : vous ouvrez les recherches, vous choisissez les profils. Aucune collecte automatique sur Facebook ou Instagram.">
          <AssistedSearch queries={assisted} context={{ activity: activities[0] ?? keywords.split(',')[0]?.trim(), city: city || undefined, department: department || undefined, region: region || undefined, campaign_id: campaignMode === 'existing' && campaignId ? campaignId : null }}
            onAdded={async (ids) => {
              const list = await api.get<{ items: CompanySummary[] }>(`/companies${qs({ limit: 100, sort: 'discovered' })}`);
              setAssistedResults((prev) => [...list.items.filter((c) => ids.includes(c.id)), ...prev.filter((p) => !ids.includes(p.id))]);
            }} />
          {assistedResults.length > 0 && <div className="mt-6 border-t border-line pt-4"><CompanyTable items={assistedResults} /></div>}
        </Card>
      )}
    </>
  );
}

function statusText(s: string) {
  return ({ running: 'en cours', done: 'terminée', failed: 'échec', cancelled: 'arrêtée', no_source: 'aucune source configurée' } as Record<string, string>)[s] ?? s;
}
