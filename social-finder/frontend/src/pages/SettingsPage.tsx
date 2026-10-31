import { useEffect, useState } from 'react';
import { Database, Download, FileText, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import { fmtDateTime } from '../lib/format';
import { Badge, Button, Card, Input, Label, PageHeader, Select, Tabs, Textarea, useToast } from '../components/ui';

type Settings = Record<string, string | number | boolean>;

export default function SettingsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'profile' | 'ai' | 'data' | 'rgpd' | 'logs'>('profile');
  const s = useApi<Settings>('/settings');
  const [form, setForm] = useState<Settings>({});
  useEffect(() => { if (s.data) setForm(s.data); }, [s.data]);
  const save = async (keys: string[]) => {
    await api.put('/settings', Object.fromEntries(keys.map((k) => [k, form[k]])));
    toast('Paramètres enregistrés', 'good');
    void s.reload();
  };
  const field = (k: string, label: string, type = 'text', hint?: string) => (
    <div><Label hint={hint}>{label}</Label><Input type={type} value={String(form[k] ?? '')} onChange={(e) => setForm({ ...form, [k]: type === 'number' ? Number(e.target.value) : e.target.value })} autoComplete="off" /></div>
  );
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Paramètres & RGPD"
        actions={<Tabs value={tab} onChange={setTab} tabs={[{ key: 'profile', label: 'Signature' }, { key: 'ai', label: 'IA' }, { key: 'data', label: 'Données' }, { key: 'rgpd', label: 'RGPD' }, { key: 'logs', label: 'Journal' }]} />} />
      {tab === 'profile' && (
        <Card title={<span className="flex items-center gap-2"><UserRound className="size-4" />Expéditeur des messages</span>}>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl">
            {field('sender_name', 'Votre prénom et nom')}{field('agency_name', 'Agence')}
            <div className="md:col-span-2"><Label>Signature</Label><Textarea rows={2} value={String(form.sender_signature ?? '')} onChange={(e) => setForm({ ...form, sender_signature: e.target.value })} placeholder="Alex — Signe & Seine, création de sites et communication visuelle" /></div>
            <div className="md:col-span-2"><Label hint="une phrase, utilisée dans les messages">Présentation de l’agence</Label><Textarea rows={2} value={String(form.agency_pitch ?? '')} onChange={(e) => setForm({ ...form, agency_pitch: e.target.value })} /></div>
          </div>
          <Button variant="primary" className="mt-4" onClick={() => save(['sender_name', 'agency_name', 'sender_signature', 'agency_pitch'])}>Enregistrer</Button>
        </Card>
      )}
      {tab === 'ai' && <AiSettings form={form} setForm={setForm} save={save} field={field} />}
      {tab === 'data' && <DataSettings />}
      {tab === 'rgpd' && <RgpdSettings form={form} setForm={setForm} save={save} />}
      {tab === 'logs' && <Logs />}
    </>
  );
}

type FormProps = { form: Settings; setForm: (f: Settings) => void; save: (k: string[]) => Promise<void> };

function AiSettings({ form, setForm, save, field }: FormProps & { field: (k: string, l: string, t?: string, h?: string) => React.ReactNode }) {
  const toast = useToast();
  const p = String(form.ai_provider ?? 'templates');
  return (
    <Card title={<span className="flex items-center gap-2"><Sparkles className="size-4" />Fournisseur de rédaction</span>} subtitle="Aucune IA payante n’est obligatoire. Les scores ne dépendent jamais de l’IA : ils sont calculés par des règles transparentes.">
      <div className="max-w-3xl space-y-4">
        <div className="w-80"><Label>Mode</Label>
          <Select value={p} onChange={(e) => setForm({ ...form, ai_provider: e.target.value })}>
            <option value="templates">Modèles intégrés (gratuit, hors ligne)</option><option value="ollama">Ollama — IA locale gratuite</option>
            <option value="openai">API compatible OpenAI (LM Studio, OpenAI…)</option><option value="anthropic">API Anthropic</option>
          </Select></div>
        {p === 'ollama' && <div className="grid md:grid-cols-2 gap-4">{field('ai_ollama_url', 'Adresse Ollama')}{field('ai_ollama_model', 'Modèle', 'text', 'ex. llama3.1, mistral')}</div>}
        {p === 'openai' && <div className="grid md:grid-cols-2 gap-4">{field('ai_openai_url', 'Adresse de l’API', 'text', 'ex. http://localhost:1234/v1 pour LM Studio')}{field('ai_openai_model', 'Modèle')}<div className="md:col-span-2">{field('ai_openai_key', 'Clé (vide pour un serveur local)', 'password')}</div></div>}
        {p === 'anthropic' && <div className="grid md:grid-cols-2 gap-4">{field('ai_anthropic_model', 'Modèle')}{field('ai_anthropic_key', 'Clé d’API', 'password')}</div>}
        <p className="text-[12.5px] text-muted">Seuls les faits de la fiche (nom, activité, ville, observations marquées constatées ou hypothèses) sont transmis au fournisseur choisi. Avec Ollama, rien ne quitte l’ordinateur.</p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => save(['ai_provider', 'ai_ollama_url', 'ai_ollama_model', 'ai_openai_url', 'ai_openai_model', 'ai_openai_key', 'ai_anthropic_model', 'ai_anthropic_key'])}>Enregistrer</Button>
          <Button onClick={async () => { const r = await api.post<{ ok: boolean; message: string }>('/connectors/ai/test'); toast(r.message, r.ok ? 'good' : 'bad'); }}>Tester</Button>
        </div>
      </div>
    </Card>
  );
}

function DataSettings() {
  const toast = useToast();
  const backups = useApi<{ name: string; size: number; date: string }[]>('/backup/list');
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title={<span className="flex items-center gap-2"><Database className="size-4" />Sauvegardes</span>} subtitle="Copie complète de la base SQLite dans le dossier data/backups (20 dernières conservées).">
        <Button variant="primary" onClick={async () => { const r = await api.post<{ name: string }>('/backup'); toast(`Sauvegarde créée : ${r.name}`, 'good'); void backups.reload(); }}>Créer une sauvegarde</Button>
        <ul className="mt-4 space-y-1.5 text-[13px]">{backups.data?.map((b) => (
          <li key={b.name} className="flex items-center justify-between rounded-lg bg-paper px-3 py-1.5"><span>{fmtDateTime(b.date)} · {(b.size / 1024).toFixed(0)} Ko</span>
            <a href={`/api/backup/download/${b.name}`} className="text-seine hover:underline inline-flex items-center gap-1"><Download className="size-3.5" />Télécharger</a></li>))}</ul>
        <p className="mt-3 text-[12px] text-muted">Restauration : fermez le logiciel, remplacez data/social_finder.db par la sauvegarde, relancez START.bat.</p>
      </Card>
      <Card title={<span className="flex items-center gap-2"><Download className="size-4" />Exports</span>}>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/companies.csv"><Button>Toutes les entreprises (CSV)</Button></a>
          <a href="/api/export/companies.csv?min_confidence=75&min_commercial=70"><Button>Meilleurs prospects (CSV)</Button></a>
        </div>
        <p className="mt-3 text-[12px] text-muted">Format compatible Excel (séparateur « ; »), avec les deux scores, l’opportunité principale et le statut — pour reprendre les prospects dans votre autre logiciel.</p>
      </Card>
      <Card title="Données de démonstration" subtitle="Entreprises FICTIVES pour découvrir l’interface, marquées « DÉMO » partout et exclues des statistiques réelles.">
        <div className="flex gap-2">
          <Button onClick={async () => { const r = await api.post<{ created: number }>('/demo/load'); toast(`${r.created} fiche(s) de démonstration ajoutée(s)`, 'good'); }}>Charger la démo</Button>
          <Button variant="danger" onClick={async () => { const r = await api.post<{ deleted: number }>('/demo/clear'); toast(`${r.deleted} fiche(s) de démonstration supprimée(s)`, 'good'); }}>Supprimer la démo</Button>
        </div>
      </Card>
    </div>
  );
}

function RgpdSettings({ form, setForm, save }: FormProps) {
  const toast = useToast();
  const list = useApi<{ id: number; platform: string | null; handle: string | null; name: string | null; reason: string; created_at: string }[]>('/suppression');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card title={<span className="flex items-center gap-2"><ShieldCheck className="size-4" />Liste de suppression (oppositions)</span>}
        subtitle="Une entreprise qui refuse d’être contactée est supprimée et ne sera plus jamais redécouverte. Seuls l’identifiant du profil et le nom normalisé sont conservés.">
        <div className="grid sm:grid-cols-2 gap-2">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL du profil Instagram / Facebook" />
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ou nom de l’entreprise" />
        </div>
        <Button className="mt-2" variant="primary" disabled={!url && !name} onClick={async () => {
          try { const r = await api.post<{ removed: number }>('/suppression', { url: url || null, name: name || null, reason: 'Opposition' }); toast(r.removed ? 'Ajoutée à la liste et données supprimées' : 'Ajoutée à la liste', 'good'); setUrl(''); setName(''); void list.reload(); }
          catch (e) { toast((e as Error).message, 'bad'); }
        }}>Ajouter une opposition</Button>
        <ul className="mt-4 divide-y divide-line text-[13px] max-h-72 overflow-y-auto scroll-thin">{list.data?.map((x) => (
          <li key={x.id} className="flex items-center gap-2 py-1.5"><Badge>{x.platform ?? 'nom'}</Badge><span className="flex-1">{x.handle ? `@${x.handle}` : x.name}</span>
            <span className="text-muted text-[12px]">{x.reason}</span><button className="text-muted hover:text-bad" title="Retirer" onClick={async () => { await api.del(`/suppression/${x.id}`); void list.reload(); }}><Trash2 className="size-3.5" /></button></li>))}</ul>
      </Card>
      <div className="space-y-4">
        <Card title="Durée de conservation" subtitle="Les entreprises jamais contactées sont supprimées au-delà de cette durée (bouton ci-dessous).">
          <div className="flex items-end gap-2"><div className="w-40"><Label>Jours</Label><Input type="number" value={String(form.retention_days ?? 365)} onChange={(e) => setForm({ ...form, retention_days: Number(e.target.value) })} /></div>
            <Button onClick={() => save(['retention_days'])}>Enregistrer</Button>
            <Button variant="danger" onClick={async () => { const r = await api.post<{ deleted: number }>('/rgpd/purge'); toast(`${r.deleted} entreprise(s) supprimée(s)`, 'good'); }}>Appliquer maintenant</Button></div>
        </Card>
        <Card title={<span className="flex items-center gap-2"><FileText className="size-4" />Principes appliqués</span>}>
          <ul className="list-disc pl-5 text-[12.5px] text-ink-2 space-y-1">
            <li>Stockage local uniquement (dossier data), aucune donnée envoyée à un serveur tiers sauf aux API que vous configurez.</li>
            <li>Collecte minimale : profils publics professionnels, sans e-mail ni téléphone.</li>
            <li>Source et date de découverte conservées pour chaque profil.</li>
            <li>Prospection B2B : message en lien avec l’activité professionnelle, opposition respectée immédiatement.</li>
            <li>Une information publique n’est pas libre de toute utilisation : vérifiez la pertinence avant chaque contact.</li>
          </ul>
        </Card>
        <Card title="Supprimer toutes les données">
          <p className="text-[12.5px] text-muted mb-2">Une sauvegarde est créée automatiquement avant. Tapez SUPPRIMER pour confirmer.</p>
          <div className="flex gap-2"><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-40" />
            <Button variant="danger" disabled={confirm !== 'SUPPRIMER'} onClick={async () => { await api.post(`/rgpd/delete-all?confirm=SUPPRIMER`); toast('Toutes les données ont été supprimées', 'good'); setConfirm(''); }}>Tout supprimer</Button></div>
        </Card>
      </div>
    </div>
  );
}

function Logs() {
  const { data, reload } = useApi<{ lines: string[] }>('/logs?lines=400');
  return (
    <Card title="Journal technique" subtitle="data/logs/app.log" action={<Button size="sm" onClick={() => void reload()}>Actualiser</Button>}>
      <pre className="max-h-[60vh] overflow-auto scroll-thin rounded-lg bg-ink text-white/80 text-[11.5px] p-3 whitespace-pre-wrap">{data?.lines.join('') || 'Journal vide.'}</pre>
    </Card>
  );
}
