import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, BadgeCheck, ExternalLink, Globe, Pencil, RefreshCw, ScanSearch, Scissors, ShieldOff, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, useReferentials } from '../lib/hooks';
import { fmtDate, fmtDateTime, fmtNum } from '../lib/format';
import type { Company, Profile } from '../lib/types';
import { Badge, Button, Card, DemoBadge, Input, Label, Modal, Select, Spinner, Textarea, Toggle, useToast } from '../components/ui';
import { PlatformIcon } from '../components/brand';
import { ScoreBreakdown, ScoreHeader, StatusTag } from '../components/scores';
import MessageComposer from '../components/MessageComposer';

function ProfileCard({ p, canSplit, onEdit, onSplit }: { p: Profile; canSplit: boolean; onEdit: () => void; onSplit: () => void }) {
  const src = p.api_verified ? 'API officielle Meta' : p.source.startsWith('search:') ? `Moteur de recherche (${p.source.slice(7)})` : p.source === 'assisted' ? 'Recherche assistée' : p.source === 'manual' ? 'Complété manuellement' : p.source === 'demo' ? 'Démonstration' : p.source;
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-start gap-3">
        <PlatformIcon platform={p.platform} className="size-5 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={p.url} target="_blank" rel="noreferrer" className="font-medium hover:underline inline-flex items-center gap-1">{p.display_name || `@${p.handle}`}<ExternalLink className="size-3 text-muted" /></a>
            {p.api_verified ? <Badge tone="good"><BadgeCheck className="size-3" />Vérifié API</Badge> : null}
          </div>
          <div className="text-[12.5px] text-muted">@{p.handle} · {src} · {fmtDate(p.discovered_at)}</div>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} title="Compléter"><Pencil className="size-3.5" /></Button>
          {canSplit && <Button size="sm" variant="ghost" onClick={onSplit} title="Séparer : ce profil n'appartient pas à cette entreprise"><Scissors className="size-3.5" /></Button>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[['Abonnés', p.followers], ['Publications', p.posts], ['J’aime', p.likes], ['Dernière pub.', p.last_post_at ? fmtDate(p.last_post_at) : null]].map(([l, v]) => (
          <div key={l as string} className="rounded-lg bg-paper py-1.5"><div className="text-[13px] font-semibold num">{typeof v === 'number' ? fmtNum(v) : v ?? '—'}</div><div className="text-[10.5px] text-muted">{l}</div></div>
        ))}
      </div>
      {p.bio && <p className="mt-3 text-[13px] text-ink-2 whitespace-pre-line">{p.bio}</p>}
      {(p.category || p.location || p.website) && (
        <p className="mt-2 text-[12.5px] text-muted">{[p.category, p.location, p.website].filter(Boolean).join(' · ')}</p>
      )}
      {p.search_query && <p className="mt-2 text-[11.5px] text-muted">Requête : <code>{p.search_query}</code></p>}
      {!p.api_verified && p.source.startsWith('search:') && <p className="mt-1 text-[11.5px] text-muted">Valeurs lues dans l'extrait indexé du moteur : elles peuvent dater.</p>}
    </div>
  );
}

export default function ProspectPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const ref = useReferentials();
  const { data: c, reload, loading } = useApi<Company>(`/companies/${id}`, [id]);
  const [notes, setNotes] = useState<string | null>(null);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [del, setDel] = useState(false);
  const [suppress, setSuppress] = useState(true);
  if (loading && !c) return <Spinner />;
  if (!c) return <p>Entreprise introuvable.</p>;

  const patch = async (body: Record<string, unknown>) => { await api.patch(`/companies/${c.id}`, body); await reload(); };
  const verify = async () => {
    setBusy('verify');
    try {
      const r = await api.post<{ notes: string[] }>(`/companies/${c.id}/verify`);
      toast(r.notes.join(' · '), 'good');
      await reload();
    } finally { setBusy(''); }
  };
  const saveProfile = async () => {
    if (!editing) return;
    await api.patch(`/profiles/${editing.id}`, form);
    setEditing(null);
    toast('Profil complété : scores recalculés', 'good');
    await reload();
  };
  const split = async (p: Profile) => {
    const r = await api.post<{ company_id: number }>(`/profiles/${p.id}/split`);
    toast('Profil séparé dans une nouvelle fiche', 'good');
    nav(`/prospects/${r.company_id}`);
  };
  const remove = async () => {
    await api.del(`/companies/${c.id}?suppress=${suppress}&reason=${encodeURIComponent(suppress ? 'Opposition / ne plus contacter' : 'Suppression manuelle')}`);
    toast('Données supprimées', 'good');
    nav('/prospects');
  };
  const a = c.analysis;

  return (
    <>
      <Link to="/prospects" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink mb-3"><ArrowLeft className="size-4" />Prospects</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-[30px] leading-tight flex items-center gap-3 flex-wrap">{c.name}{!!c.is_demo && <DemoBadge />}{!!c.validated && <Badge tone="good"><BadgeCheck className="size-3" />Validée</Badge>}</h1>
          <p className="text-sm text-muted mt-1">
            {[c.activity_label, c.city ?? (c.search_location?.city ? `zone recherchée : ${c.search_location.city} (ville non confirmée par le profil)` : null)].filter(Boolean).join(' · ')}
            {' · '}Découverte le {fmtDate(c.discovered_at)} via {c.source}{c.campaign && <> · campagne <Link className="underline" to={`/campagnes/${c.campaign.id}`}>{c.campaign.name}</Link></>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={c.status} onChange={(e) => patch({ status: e.target.value })} className="w-44">
            {ref?.statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </Select>
          <Button onClick={verify} loading={busy === 'verify'}><ScanSearch className="size-4" />Vérifier</Button>
          <Button onClick={async () => { await api.post(`/companies/${c.id}/rescore`); await reload(); toast('Scores recalculés'); }}><RefreshCw className="size-4" />Recalculer</Button>
          <Button variant="danger" onClick={() => setDel(true)}><Trash2 className="size-4" /></Button>
        </div>
      </div>

      {c.suggestions.length > 0 && (
        <div className="mb-4 rounded-xl border border-seine/30 bg-seine-soft px-4 py-3 text-[13.5px]">
          Correspondance possible avec « {c.suggestions[0].a_name === c.name ? c.suggestions[0].b_name : c.suggestions[0].a_name} » ({c.suggestions[0].score}/100) — <Link to="/correspondances" className="underline">valider ou rejeter</Link>.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card><ScoreHeader kind="confidence" detail={c.confidence_detail} /><div className="mt-4"><ScoreBreakdown detail={c.confidence_detail} /></div>
          <div className="mt-3 border-t border-line pt-3"><Toggle checked={!!c.validated} onChange={(v) => patch({ validated: v })} label="J'ai vérifié l'identité de cette entreprise" hint="Validation humaine : visible dans les statistiques, ne modifie pas le calcul" /></div>
        </Card>
        <Card><ScoreHeader kind="commercial" detail={c.commercial_detail} /><div className="mt-4"><ScoreBreakdown detail={c.commercial_detail} /></div></Card>
      </div>

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-4">
        <div className="space-y-4">
          <Card title="Analyse des opportunités" subtitle={a.priority.label}>
            <p className="text-[14px] text-ink leading-relaxed">{a.summary}</p>
            {a.opportunities.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {a.opportunities.map((o, i) => <li key={i} className="flex items-start gap-2 text-[13.5px]"><span className="shrink-0 mt-0.5"><StatusTag status={o.status} /></span><span className="text-ink-2">{o.text}</span></li>)}
              </ul>
            )}
            {a.services.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{a.services.map((s) => <Badge key={s.key} tone="brass">{s.label}</Badge>)}</div>}
            <div className="mt-4 rounded-lg bg-paper px-3 py-2.5 text-[13.5px]"><span className="font-semibold">Recommandation : </span>{a.recommendation}</div>
            {a.missing.length > 0 && <p className="mt-3 text-[12.5px] text-muted">Informations manquantes : {a.missing.join(', ')}.</p>}
          </Card>
          <Card title="AI Message Studio" subtitle="Rédaction personnalisée, envoi manuel depuis votre compte">
            <MessageComposer company={c} onChange={reload} />
          </Card>
        </div>
        <div className="space-y-4">
          <Card title="Profils sociaux">
            <div className="space-y-3">{c.profiles.map((p) => <ProfileCard key={p.id} p={p} canSplit={c.profiles.length > 1}
              onEdit={() => { setEditing(p); setForm({ display_name: p.display_name ?? '', bio: p.bio ?? '', website: p.website ?? '', location: p.location ?? '', category: p.category ?? '' }); }}
              onSplit={() => split(p)} />)}</div>
          </Card>
          <Card title="Site Internet">
            {c.website ? (
              <div className="text-[13.5px]">
                <a href={c.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-seine hover:underline"><Globe className="size-4" />{c.website}</a>
                {c.website_check ? (
                  <ul className="mt-2 space-y-1 text-[13px] text-ink-2">
                    {(c.website_check.reachable as boolean) ? ((c.website_check.issues as string[]).length ? (c.website_check.issues as string[]).map((i) => <li key={i}>• {i}</li>) : <li>Aucun défaut technique constaté.</li>) : <li>Site injoignable ({String(c.website_check.error)})</li>}
                    {c.website_check.builder ? <li className="text-muted">Réalisé avec {String(c.website_check.builder)}</li> : null}
                  </ul>
                ) : <p className="text-[12.5px] text-muted mt-1">Non analysé — cliquez « Vérifier ».</p>}
              </div>
            ) : <p className="text-[13px] text-muted">Aucun site identifié dans les informations disponibles.</p>}
          </Card>
          <Card title="Notes & relance">
            <Textarea rows={4} value={notes ?? c.notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes personnelles…" />
            <div className="mt-2 flex flex-wrap items-end gap-2">
              <Button size="sm" variant="primary" disabled={notes === null || notes === c.notes} onClick={async () => { await patch({ notes }); setNotes(null); toast('Notes enregistrées', 'good'); }}>Enregistrer</Button>
              <div className="ml-auto"><Label>Relance le</Label>
                <Input type="date" className="w-40" value={c.follow_up_at?.slice(0, 10) ?? ''} onChange={(e) => patch({ follow_up_at: e.target.value ? `${e.target.value}T08:00:00+00:00` : null })} /></div>
            </div>
          </Card>
          <Card title="Historique des actions">
            <ul className="space-y-1.5 max-h-72 overflow-y-auto scroll-thin">
              {c.events.map((e) => <li key={e.id} className="flex gap-3 text-[12.5px]"><span className="w-28 shrink-0 text-muted num">{fmtDateTime(e.created_at)}</span><span className="text-ink-2">{e.detail}</span></li>)}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Compléter @${editing?.handle}`}>
        <p className="text-[13px] text-muted mb-3">Renseignez uniquement ce que vous avez vérifié vous-même sur le profil. Ces données sont marquées « saisie manuelle ».</p>
        <div className="space-y-3">
          {[['display_name', 'Nom affiché'], ['location', 'Ville / adresse'], ['category', 'Catégorie'], ['website', 'Site Internet']].map(([k, l]) => (
            <div key={k}><Label>{l}</Label><Input value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></div>
          ))}
          <div><Label>Description (bio)</Label><Textarea rows={4} value={form.bio ?? ''} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <Button variant="primary" onClick={saveProfile}>Enregistrer et recalculer</Button>
        </div>
      </Modal>
      <Modal open={del} onClose={() => setDel(false)} title="Supprimer cette entreprise">
        <p className="text-sm text-ink-2 mb-3">Toutes les données (profils, messages, notes, historique) seront supprimées définitivement.</p>
        <Toggle checked={suppress} onChange={setSuppress} label="Ajouter à la liste de suppression (opposition)" hint={<><ShieldOff className="inline size-3" /> Elle ne sera plus jamais redécouverte. Seuls l'identifiant du profil et le nom normalisé sont conservés.</>} />
        <div className="mt-4 flex gap-2"><Button variant="danger" onClick={remove}><Trash2 className="size-4" />Supprimer</Button><Button onClick={() => setDel(false)}>Annuler</Button></div>
      </Modal>
    </>
  );
}
