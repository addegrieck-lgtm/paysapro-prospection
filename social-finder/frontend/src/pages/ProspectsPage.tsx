import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Award, Download, Search, Send, Users } from 'lucide-react';
import { api, qs } from '../lib/api';
import { useApi, useReferentials } from '../lib/hooks';
import type { Campaign, CompanySummary } from '../lib/types';
import { Button, Card, Empty, Input, Label, PageHeader, Select, Spinner, useToast } from '../components/ui';
import CompanyTable from '../components/CompanyTable';
import ProspectionExport, { ProspectionIcon } from '../components/ProspectionExport';

export default function ProspectsPage({ best = false }: { best?: boolean }) {
  const [sp, setSp] = useSearchParams();
  const ref = useReferentials();
  const toast = useToast();
  const campaigns = useApi<Campaign[]>('/campaigns');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const f = {
    q: sp.get('q') ?? '', status: sp.get('status') ?? '', campaign_id: sp.get('campaign_id') ?? '', platform: sp.get('platform') ?? '',
    networks: sp.get('networks') ?? '', demo: sp.get('demo') ?? 'include', sort: sp.get('sort') ?? 'priority', order: sp.get('order') ?? 'desc',
    min_confidence: sp.get('min_confidence') ?? '', min_commercial: sp.get('min_commercial') ?? '', preset: sp.get('preset') ?? '',
  };
  const presetValues = f.preset === 'conf' ? { min_confidence: 75 } : f.preset === 'com' ? { min_commercial: 70 } : f.preset === 'both' ? { min_confidence: 75, min_commercial: 70 } : {};
  const path = `/companies${qs({ ...f, preset: undefined, best, ...presetValues, limit: 500 })}`;
  const { data, loading } = useApi<{ total: number; items: CompanySummary[] }>(path, [path]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [toProspection, setToProspection] = useState(false);
  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); if (v) n.set(k, v); else n.delete(k); setSp(n, { replace: true }); };
  const toggle = (id: number) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const enqueue = async () => {
    const r = await api.post<{ updated: number }>('/companies/bulk/enqueue', [...selected]);
    toast(`${r.updated} prospect(s) passé(s) « À contacter »`, 'good');
    setSelected(new Set());
  };
  const exportUrl = `/api/export/companies.csv${qs({ campaign_id: f.campaign_id, include_demo: f.demo !== 'exclude', min_confidence: best ? 75 : f.min_confidence || (presetValues as { min_confidence?: number }).min_confidence, min_commercial: best ? 70 : f.min_commercial || (presetValues as { min_commercial?: number }).min_commercial })}`;

  return (
    <>
      <PageHeader eyebrow={best ? 'Classement' : 'Suivi'} title={best ? 'Meilleurs prospects' : 'Prospects'}
        subtitle={best ? 'Confiance ≥ 75 ET potentiel commercial ≥ 70. Classement par priorité = confiance × 0,60 + commercial × 0,40 ; une identité incertaine n’est jamais compensée par le potentiel.'
          : 'Toutes les entreprises découvertes, avec leurs deux scores indépendants.'}
        actions={<>
          {selected.size > 0 && <Button variant="primary" onClick={enqueue}><Send className="size-4" />Ajouter {selected.size} à la file</Button>}
          <Button variant="brass" onClick={() => setToProspection(true)}><ProspectionIcon className="size-4" />Envoyer vers Prospection{selected.size ? ` (${selected.size})` : ''}</Button>
          <a href={exportUrl}><Button><Download className="size-4" />Exporter CSV</Button></a>
        </>} />
      <Card className="mb-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <form className="lg:col-span-2" onSubmit={(e) => { e.preventDefault(); set('q', q); }}>
            <Label>Recherche</Label>
            <div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted" />
              <Input className="pl-8" value={q} onChange={(e) => setQ(e.target.value)} onBlur={() => set('q', q)} placeholder="Nom, ville, @identifiant, notes" /></div>
          </form>
          {!best && (
            <div><Label>Filtre par scores</Label>
              <Select value={f.preset} onChange={(e) => set('preset', e.target.value)}>
                <option value="">Tous les scores</option><option value="conf">Confiance &gt; 75</option><option value="com">Commercial &gt; 70</option><option value="both">Les deux</option>
              </Select></div>
          )}
          <div><Label>Statut</Label>
            <Select value={f.status} onChange={(e) => set('status', e.target.value)}>
              <option value="">Tous</option>{ref?.statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </Select></div>
          <div><Label>Campagne</Label>
            <Select value={f.campaign_id} onChange={(e) => set('campaign_id', e.target.value)}>
              <option value="">Toutes</option>{campaigns.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select></div>
          <div><Label>Réseaux</Label>
            <Select value={f.networks || f.platform} onChange={(e) => { const v = e.target.value; const n = new URLSearchParams(sp); n.delete('networks'); n.delete('platform');
              if (v === 'both' || v === 'single') n.set('networks', v); else if (v) n.set('platform', v); setSp(n, { replace: true }); }}>
              <option value="">Tous</option><option value="instagram">Avec Instagram</option><option value="facebook">Avec Facebook</option>
              <option value="both">Les deux réseaux</option><option value="single">Un seul réseau</option>
            </Select></div>
          <div><Label>Tri</Label>
            <Select value={`${f.sort}:${f.order}`} onChange={(e) => { const [s, o] = e.target.value.split(':'); const n = new URLSearchParams(sp); n.set('sort', s); n.set('order', o); setSp(n, { replace: true }); }}>
              <option value="priority:desc">Priorité</option><option value="confidence:desc">Confiance</option><option value="commercial:desc">Potentiel commercial</option>
              <option value="discovered:desc">Plus récents</option><option value="name:asc">Nom (A→Z)</option>
            </Select></div>
          <div><Label>Données de démo</Label>
            <Select value={f.demo} onChange={(e) => set('demo', e.target.value)}>
              <option value="include">Incluses</option><option value="exclude">Masquées</option><option value="only">Uniquement</option>
            </Select></div>
        </div>
      </Card>
      <Card title={data ? `${data.total} entreprise${data.total > 1 ? 's' : ''}` : ' '}>
        {loading && !data ? <Spinner /> : data && data.items.length ? (
          <CompanyTable items={data.items} selected={selected} onSelect={toggle} />
        ) : (
          <Empty icon={best ? <Award className="size-6" /> : <Users className="size-6" />} title={best ? 'Aucun prospect ne remplit les deux conditions' : 'Aucune entreprise'}>
            {best ? 'Vérifiez les profils « À vérifier » (fiche → Vérifier / compléter) pour faire monter leur score de confiance.' : 'Lancez une recherche depuis « Découverte sociale ».'}
          </Empty>
        )}
      </Card>
      <ProspectionExport open={toProspection} onClose={() => setToProspection(false)} ids={[...selected]} campaignId={f.campaign_id}
        onDone={() => setSelected(new Set())} />
    </>
  );
}
