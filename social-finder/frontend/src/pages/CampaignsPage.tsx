import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, FolderKanban, Play, Plus, Trash2 } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useApi } from '../lib/hooks';
import { fmtDate, fmtDateTime } from '../lib/format';
import type { Campaign, CompanySummary } from '../lib/types';
import { Button, Card, Empty, Input, Label, Modal, PageHeader, Spinner, Textarea, useToast } from '../components/ui';
import CompanyTable from '../components/CompanyTable';

const STAT_LABELS: [keyof Campaign['stats'], string][] = [
  ['discovered', 'Profils découverts'], ['validated', 'Validés / fiables'], ['high_potential', 'Fort potentiel'], ['messages_ready', 'Messages préparés'],
  ['messages_sent', 'Messages envoyés'], ['replies', 'Réponses'], ['interested', 'Intéressés'], ['response_rate', 'Taux de réponse'],
];

function Stats({ c }: { c: Campaign }) {
  return (
    <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
      {STAT_LABELS.map(([k, l]) => (
        <div key={k} className="rounded-lg bg-paper px-2 py-2 text-center">
          <div className="text-lg font-semibold num">{k === 'response_rate' ? (c.stats.response_rate === null ? '—' : `${c.stats.response_rate} %`) : c.stats[k]}</div>
          <div className="text-[10.5px] text-muted leading-tight">{l}</div>
        </div>
      ))}
    </div>
  );
}

function CampaignDetail({ id }: { id: number }) {
  const nav = useNavigate();
  const toast = useToast();
  const { data: c, reload } = useApi<Campaign>(`/campaigns/${id}`, [id]);
  const list = useApi<{ items: CompanySummary[]; total: number }>(`/companies${qs({ campaign_id: id, limit: 500 })}`, [id]);
  if (!c) return <Spinner />;
  const p = c.params as { activities?: string[]; city?: string; department?: string; platforms?: string[]; target?: number };
  const resume = async () => {
    try {
      const r = await api.post<{ search_id: number }>(`/campaigns/${id}/resume`);
      toast(`Campagne reprise (recherche #${r.search_id}) : les requêtes déjà faites sont ignorées`, 'good');
      setTimeout(() => { void reload(); void list.reload(); }, 2500);
    } catch (e) { toast((e as Error).message, 'bad'); }
  };
  return (
    <>
      <Link to="/campagnes" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink mb-3"><ArrowLeft className="size-4" />Campagnes</Link>
      <PageHeader title={c.name} subtitle={c.description || `${(p.activities ?? []).join(', ')} · ${p.city ?? p.department ?? ''} · ${(p.platforms ?? []).join(' + ')}`}
        actions={<>
          <Button variant="brass" onClick={resume}><Play className="size-4" />Reprendre la recherche</Button>
          <Button variant="danger" onClick={async () => { if (confirm('Supprimer la campagne ? Les entreprises sont conservées.')) { await api.del(`/campaigns/${id}`); nav('/campagnes'); } }}><Trash2 className="size-4" /></Button>
        </>} />
      <Card className="mb-4"><Stats c={c} /></Card>
      <div className="grid lg:grid-cols-[1fr_300px] gap-4">
        <Card title={`${list.data?.total ?? 0} entreprise(s)`}>{list.data?.items.length ? <CompanyTable items={list.data.items} /> : <p className="text-sm text-muted">Aucune entreprise.</p>}</Card>
        <Card title="Recherches">
          <ul className="space-y-2 text-[13px]">{c.searches?.map((s) => (
            <li key={s.id} className="rounded-lg bg-paper px-3 py-2"><div className="font-medium">#{s.id} · {s.status}</div>
              <div className="text-muted text-[12px]">{fmtDateTime(s.started_at)} · {s.stats.new_companies ?? 0} nouvelle(s) · {s.stats.requests ?? 0} requête(s)</div></li>
          ))}</ul>
        </Card>
      </div>
    </>
  );
}

export default function CampaignsPage() {
  const { id } = useParams();
  const { data, loading, reload } = useApi<Campaign[]>('/campaigns');
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  if (id) return <CampaignDetail id={Number(id)} />;
  return (
    <>
      <PageHeader eyebrow="Organisation" title="Campagnes" subtitle="Regroupez vos recherches (ex. « Restaurants au Havre ») et reprenez-les sans refaire les mêmes requêtes."
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="size-4" />Nouvelle campagne</Button>} />
      {loading && !data ? <Spinner /> : data?.length ? (
        <div className="space-y-3">
          {data.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div><Link to={`/campagnes/${c.id}`} className="font-semibold text-[15px] hover:underline">{c.name}</Link>
                  <div className="text-[12.5px] text-muted">Créée le {fmtDate(c.created_at)} · {c.stats.searches} recherche(s)</div></div>
                <Link to={`/campagnes/${c.id}`}><Button size="sm">Ouvrir</Button></Link>
              </div>
              <Stats c={c} />
            </Card>
          ))}
        </div>
      ) : <Card><Empty icon={<FolderKanban className="size-6" />} title="Aucune campagne">Une campagne est créée automatiquement à chaque recherche lancée depuis « Découverte sociale ».</Empty></Card>}
      <Modal open={open} onClose={() => setOpen(false)} title="Nouvelle campagne">
        <div className="space-y-3">
          <div><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coiffeurs en Seine-Maritime" /></div>
          <div><Label>Description</Label><Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
          <p className="text-[12.5px] text-muted">Les critères de recherche s'ajoutent en lançant une recherche rattachée à cette campagne.</p>
          <Button variant="primary" disabled={!name.trim()} onClick={async () => { await api.post('/campaigns', { name, description: desc }); setOpen(false); setName(''); setDesc(''); void reload(); }}>Créer</Button>
        </div>
      </Modal>
    </>
  );
}
