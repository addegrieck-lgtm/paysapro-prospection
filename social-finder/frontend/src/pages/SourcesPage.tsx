import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, ExternalLink, FlaskConical, Info, ScanSearch } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import type { ConnectorStatus } from '../lib/types';
import { Badge, Button, Card, Input, Label, PageHeader, Spinner, Toggle, useToast } from '../components/ui';

type Settings = Record<string, string | number | boolean>;
const FIELDS: Record<string, { key: string; label: string; type?: string; placeholder?: string }[]> = {
  brave: [{ key: 'brave_api_key', label: 'Clé d’API (Subscription token)', type: 'password' }, { key: 'brave_daily_limit', label: 'Limite de requêtes / jour', type: 'number' }],
  google_cse: [{ key: 'google_cse_key', label: 'Clé d’API Google', type: 'password' }, { key: 'google_cse_cx', label: 'Identifiant du moteur (cx)' }, { key: 'google_cse_daily_limit', label: 'Limite / jour', type: 'number' }],
  meta: [{ key: 'meta_access_token', label: 'Jeton d’accès (longue durée)', type: 'password' }, { key: 'meta_ig_user_id', label: 'Id de votre compte Instagram pro' }, { key: 'meta_graph_version', label: 'Version Graph API' }, { key: 'meta_daily_limit', label: 'Limite / jour', type: 'number' }],
};
const ENABLE: Record<string, string> = { brave: 'brave_enabled', google_cse: 'google_cse_enabled' };

function ConnectorCard({ c, settings, onSaved }: { c: ConnectorStatus; settings: Settings; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Settings>({});
  const [testing, setTesting] = useState(false);
  useEffect(() => setForm(Object.fromEntries((FIELDS[c.id] ?? []).map((f) => [f.key, settings[f.key] ?? '']))), [c.id, settings]);
  const save = async () => {
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, (FIELDS[c.id].find((f) => f.key === k)?.type === 'number') ? Number(v) : v]));
    await api.put('/settings', body);
    toast('Configuration enregistrée', 'good');
    onSaved();
  };
  const test = async () => {
    setTesting(true);
    try { const r = await api.post<{ ok: boolean; message: string }>(`/connectors/${c.id}/test`); toast(r.message, r.ok ? 'good' : 'bad'); } finally { setTesting(false); onSaved(); }
  };
  const detect = async () => { const r = await api.post<{ ok: boolean; message: string }>('/connectors/meta/detect'); toast(r.message, r.ok ? 'good' : 'bad'); onSaved(); };
  const ok = c.state === 'ok';
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[15px] flex items-center gap-2">{ok ? <CheckCircle2 className="size-4 text-good" /> : <CircleAlert className="size-4 text-muted" />}{c.label}</h3>
          <p className="text-[13px] text-muted mt-0.5">{c.message}</p>
        </div>
        <div className="flex items-center gap-2">
          {c.daily_limit ? <Badge>{c.used_today} / {c.daily_limit} aujourd’hui</Badge> : null}
          <Badge tone={ok ? 'good' : c.state === 'error' ? 'bad' : 'neutral'}>{ok ? 'Connecté' : c.state === 'error' ? 'À corriger' : c.state === 'disabled' ? 'Désactivé' : 'Non configuré'}</Badge>
        </div>
      </div>
      <div className="mt-4 grid lg:grid-cols-2 gap-5">
        <div>
          <div className="grid sm:grid-cols-2 gap-3">
            {(FIELDS[c.id] ?? []).map((f) => (
              <div key={f.key} className={f.type === 'password' ? 'sm:col-span-2' : ''}>
                <Label>{f.label}</Label>
                <Input type={f.type === 'number' ? 'number' : 'text'} value={String(form[f.key] ?? '')} placeholder={f.placeholder}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} autoComplete="off" spellCheck={false} />
              </div>
            ))}
          </div>
          {ENABLE[c.id] && <div className="mt-2"><Toggle checked={!!settings[ENABLE[c.id]]} onChange={async (v) => { await api.put('/settings', { [ENABLE[c.id]]: v }); onSaved(); }} label="Utiliser cette source" /></div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={save}>Enregistrer</Button>
            <Button onClick={test} loading={testing} disabled={!c.configured}><FlaskConical className="size-4" />Tester</Button>
            {c.id === 'meta' && <Button onClick={detect} disabled={!c.configured}><ScanSearch className="size-4" />Détecter mon compte Instagram</Button>}
          </div>
          {c.id === 'meta' && (c.permissions_granted.length > 0 || c.permissions_missing.length > 0) && (
            <div className="mt-4 text-[12.5px]">
              <p className="font-medium mb-1">Permissions</p>
              <div className="flex flex-wrap gap-1">{c.permissions_granted.map((p) => <Badge key={p} tone="good">{p}</Badge>)}{c.permissions_missing.map((p) => <Badge key={p} tone="bad">manque : {p}</Badge>)}</div>
            </div>
          )}
        </div>
        <div className="text-[13px] space-y-3">
          {c.free_tier && <p className="rounded-lg bg-paper px-3 py-2 text-ink-2"><Info className="inline size-3.5 mr-1 text-seine" />{c.free_tier}</p>}
          <details open={!c.configured}><summary className="font-medium cursor-pointer">Procédure de configuration</summary>
            <ol className="mt-2 list-decimal pl-5 space-y-1 text-ink-2">{c.setup_steps.map((s) => <li key={s}>{s}</li>)}</ol></details>
          <details><summary className="font-medium cursor-pointer">Fonctionnalités accessibles</summary><ul className="mt-2 list-disc pl-5 space-y-1 text-ink-2">{c.features.map((s) => <li key={s}>{s}</li>)}</ul></details>
          <details open={c.id === 'meta'}><summary className="font-medium cursor-pointer">Limites</summary><ul className="mt-2 list-disc pl-5 space-y-1 text-ink-2">{c.limits.map((s) => <li key={s}>{s}</li>)}</ul></details>
          {c.docs_url && <a href={c.docs_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-seine hover:underline">Documentation officielle<ExternalLink className="size-3" /></a>}
        </div>
      </div>
    </Card>
  );
}

export default function SourcesPage() {
  const conn = useApi<{ search: ConnectorStatus[]; meta: ConnectorStatus; website_check: boolean; geo: boolean }>('/connectors');
  const settings = useApi<Settings>('/settings');
  const reload = () => { void conn.reload(); void settings.reload(); };
  if (!conn.data || !settings.data) return <Spinner />;
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Sources & connecteurs"
        subtitle="Uniquement des interfaces officielles et autorisées. Aucun scraping de Facebook ou d’Instagram, aucun contournement de connexion, de CAPTCHA ou de limite." />
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-2">Source 1 — Moteurs de recherche (découverte)</h2>
      <p className="text-[13px] text-muted mb-3">Une seule source suffit. Si plusieurs sont configurées, la suivante prend le relais quand la précédente atteint son quota.</p>
      <div className="space-y-4 mb-8">{conn.data.search.map((c) => <ConnectorCard key={c.id} c={c} settings={settings.data!} onSaved={reload} />)}</div>
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-2">Source 2 — API officielles Meta (vérification, facultatif)</h2>
      <div className="mb-8"><ConnectorCard c={conn.data.meta} settings={settings.data} onSaved={reload} /></div>
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-2">Source 3 — Recherche assistée</h2>
      <Card className="mb-8"><p className="text-[13.5px] text-ink-2">Toujours disponible, sans configuration : depuis « Découverte sociale », le logiciel prépare les requêtes et ouvre Google, Bing ou DuckDuckGo dans votre navigateur. Vous choisissez les profils et les collez dans le logiciel, qui les évalue.</p></Card>
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-2 mb-2">Analyses complémentaires</h2>
      <Card>
        <Toggle checked={!!settings.data.website_check_enabled} onChange={async (v) => { await api.put('/settings', { website_check_enabled: v }); reload(); }}
          label="Diagnostic du site Internet de l’entreprise" hint="Une seule lecture de la page d’accueil du site trouvé dans le profil (jamais sur Facebook / Instagram) : HTTPS, affichage mobile, copyright ancien." />
        <Toggle checked={!!settings.data.geo_api_enabled} onChange={async (v) => { await api.put('/settings', { geo_api_enabled: v }); reload(); }}
          label="Rayon géographique (geo.api.gouv.fr)" hint="API publique et gratuite de l’État : liste les communes proches de la ville choisie." />
      </Card>
    </>
  );
}
