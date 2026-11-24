import { useState } from 'react';
import { Link } from 'react-router';
import { Check, GitMerge, X } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { fmtDateTime } from '../lib/format';
import type { CompanySummary, Profile } from '../lib/types';
import { Badge, Button, Card, DemoBadge, Empty, Input, Label, PageHeader, Spinner, Tabs, useToast } from '../components/ui';
import { PlatformIcon } from '../components/brand';
import { ScorePill } from '../components/scores';

interface Match { id: number; score: number; reasons: string[]; a: CompanySummary; b: CompanySummary; a_profiles: Profile[]; b_profiles: Profile[] }
interface Dup { a: { id: number; name: string; city: string | null }; b: { id: number; name: string; city: string | null }; similarity: number }

function Side({ c, profiles }: { c: CompanySummary; profiles: Profile[] }) {
  return (
    <div className="flex-1 min-w-0 rounded-xl border border-line p-3">
      <Link to={`/prospects/${c.id}`} className="font-medium hover:underline inline-flex items-center gap-2">{c.name}{!!c.is_demo && <DemoBadge />}</Link>
      <div className="mt-1 flex gap-3"><ScorePill kind="confidence" score={c.confidence_score} /><ScorePill kind="commercial" score={c.commercial_score} /></div>
      {profiles.map((p) => (
        <div key={p.id} className="mt-2 text-[12.5px]">
          <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-seine hover:underline"><PlatformIcon platform={p.platform} />@{p.handle}</a>
          {p.bio && <p className="text-muted line-clamp-2">{p.bio}</p>}
        </div>
      ))}
    </div>
  );
}

export default function MatchesPage() {
  const [tab, setTab] = useState<'pending' | 'duplicates' | 'history' | 'manual'>('pending');
  const toast = useToast();
  const pending = useApi<Match[]>('/matches');
  const dups = useApi<Dup[]>(tab === 'duplicates' ? '/duplicates' : null, [tab]);
  const history = useApi<{ id: number; action: string; detail: Record<string, unknown>; created_at: string }[]>(tab === 'history' ? '/matches/history' : null, [tab]);
  const [keep, setKeep] = useState('');
  const [remove, setRemove] = useState('');
  const decide = async (id: number, d: 'accept' | 'reject') => {
    await api.post(`/matches/${id}/${d}`);
    toast(d === 'accept' ? 'Profils fusionnés : scores recalculés' : 'Correspondance rejetée (ne sera plus proposée)', 'good');
    void pending.reload();
  };
  const merge = async (k: number, r: number) => {
    try { await api.post('/companies/merge', { keep_id: k, remove_id: r }); toast('Fusion effectuée', 'good'); void dups.reload(); } catch (e) { toast((e as Error).message, 'bad'); }
  };
  const ACTIONS: Record<string, string> = { auto_link: 'Rapprochement automatique', merge: 'Fusion manuelle', split: 'Séparation', reject: 'Rejet' };
  return (
    <>
      <PageHeader eyebrow="Identification" title="Correspondances & doublons"
        subtitle="Fusion automatique uniquement sur preuve forte (lien croisé explicite, même identifiant et même nom). Tout le reste vous est soumis."
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ key: 'pending', label: `À valider (${pending.data?.length ?? 0})` }, { key: 'duplicates', label: 'Doublons de noms' }, { key: 'manual', label: 'Fusion manuelle' }, { key: 'history', label: 'Historique' }]} />} />
      {tab === 'pending' && (pending.loading && !pending.data ? <Spinner /> : pending.data?.length ? (
        <div className="space-y-3">{pending.data.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-center gap-2 mb-3"><Badge tone="seine">Correspondance {m.score}/100</Badge>{m.reasons.map((r) => <Badge key={r}>{r}</Badge>)}</div>
            <div className="flex flex-col md:flex-row gap-3"><Side c={m.a} profiles={m.a_profiles} /><GitMerge className="size-5 text-muted self-center shrink-0" /><Side c={m.b} profiles={m.b_profiles} /></div>
            <div className="mt-3 flex gap-2"><Button variant="primary" onClick={() => decide(m.id, 'accept')}><Check className="size-4" />Même entreprise : fusionner</Button>
              <Button onClick={() => decide(m.id, 'reject')}><X className="size-4" />Entreprises différentes</Button></div>
          </Card>
        ))}</div>
      ) : <Card><Empty icon={<GitMerge className="size-6" />} title="Aucune correspondance à valider" /></Card>)}
      {tab === 'duplicates' && (
        <Card title="Noms quasi identiques dans la même ville">
          {dups.data?.length ? <ul className="divide-y divide-line">{dups.data.map((d) => (
            <li key={`${d.a.id}-${d.b.id}`} className="flex flex-wrap items-center gap-3 py-2.5 text-[13.5px]">
              <Link to={`/prospects/${d.a.id}`} className="hover:underline">{d.a.name}</Link><span className="text-muted">≈</span><Link to={`/prospects/${d.b.id}`} className="hover:underline">{d.b.name}</Link>
              <Badge>{Math.round(d.similarity * 100)} %</Badge><Button size="sm" className="ml-auto" onClick={() => merge(d.a.id, d.b.id)}>Fusionner</Button>
            </li>))}</ul> : <p className="text-sm text-muted">Aucun doublon de nom détecté.</p>}
        </Card>
      )}
      {tab === 'manual' && (
        <Card title="Fusion manuelle" subtitle="Indiquez les numéros des fiches (visibles dans l'adresse : /prospects/12).">
          <div className="flex flex-wrap items-end gap-3">
            <div><Label>Fiche conservée</Label><Input className="w-32" value={keep} onChange={(e) => setKeep(e.target.value)} placeholder="12" /></div>
            <div><Label>Fiche absorbée</Label><Input className="w-32" value={remove} onChange={(e) => setRemove(e.target.value)} placeholder="15" /></div>
            <Button variant="primary" disabled={!keep || !remove} onClick={() => merge(Number(keep), Number(remove))}><GitMerge className="size-4" />Fusionner</Button>
          </div>
        </Card>
      )}
      {tab === 'history' && (
        <Card title="Historique des correspondances">
          <ul className="divide-y divide-line">{history.data?.map((h) => (
            <li key={h.id} className="flex gap-3 py-2 text-[13px]"><span className="w-28 text-muted num shrink-0">{fmtDateTime(h.created_at)}</span><Badge>{ACTIONS[h.action] ?? h.action}</Badge>
              <span className="text-ink-2">{h.detail.keep_name ? `${String(h.detail.removed_name)} → ${String(h.detail.keep_name)}${h.detail.reason ? ` (${String(h.detail.reason)})` : ''}` : JSON.stringify(h.detail)}</span></li>
          ))}</ul>
        </Card>
      )}
    </>
  );
}
