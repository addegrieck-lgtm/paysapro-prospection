// AI Message Studio (par prospect) : générer, régénérer, modifier, copier, ouvrir le profil, marquer envoyé.
import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, RefreshCw, Save, Send, Wand2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, useReferentials } from '../lib/hooks';
import { fmtDateTime } from '../lib/format';
import type { Company, Message } from '../lib/types';
import { Badge, Button, Label, Select, Textarea, useToast } from './ui';

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

export default function MessageComposer({ company, onChange }: { company: Company; onChange: () => void }) {
  const ref = useReferentials();
  const toast = useToast();
  const templates = useApi<{ id: number; name: string; style: string }[]>('/templates');
  const hasIg = company.profiles.some((p) => p.platform === 'instagram');
  const [channel, setChannel] = useState(hasIg ? 'instagram_dm' : 'messenger');
  const [style, setStyle] = useState('professional');
  const [templateId, setTemplateId] = useState<number | ''>('');
  const [variant, setVariant] = useState(0);
  const [current, setCurrent] = useState<Message | null>(company.messages.find((m) => m.status === 'draft') ?? null);
  const [body, setBody] = useState(current?.body ?? '');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => setBody(current?.body ?? ''), [current]);
  const profile = company.profiles.find((p) => p.platform === (channel === 'instagram_dm' ? 'instagram' : 'facebook')) ?? company.profiles[0];
  const blocked = company.status === 'do_not_contact';

  const gen = async (v: number) => {
    setBusy(true);
    try {
      const m = await api.post<Message>(`/companies/${company.id}/messages/generate`, { channel, style, variant: v, template_id: templateId || null });
      setCurrent(m);
      setVariant(v);
      if (m.note) toast(m.note);
      onChange();
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!current) return;
    setCurrent(await api.patch<Message>(`/messages/${current.id}`, { body }));
    toast('Message enregistré', 'good');
    onChange();
  };
  const copy = async () => {
    if (current && body !== current.body) await save();
    await copyText(body);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const open = () => {
    if (!profile) return;
    window.open(profile.url, '_blank', 'noopener');
    void api.post(`/queue/${company.id}/opened`, { platform: profile.platform });
  };
  const sent = async () => {
    if (current && body !== current.body) await save();
    await api.post(`/queue/${company.id}/sent`, { message_id: current?.id, platform: profile?.platform });
    toast('Marqué comme envoyé — relance proposée dans 7 jours', 'good');
    setCurrent(null);
    onChange();
  };

  if (blocked) return <p className="text-sm text-bad">Cette entreprise est en « Ne plus contacter » : aucun message ne peut être préparé.</p>;
  return (
    <div>
      <div className="grid sm:grid-cols-3 gap-3 mb-3">
        <div><Label>Canal</Label><Select value={channel} onChange={(e) => setChannel(e.target.value)}>{ref?.channels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</Select></div>
        <div><Label>Style</Label><Select value={style} onChange={(e) => setStyle(e.target.value)}>{ref?.styles.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></div>
        <div><Label>Modèle</Label><Select value={templateId} onChange={(e) => setTemplateId(Number(e.target.value) || '')}>
          <option value="">Rédaction automatique</option>{templates.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
      </div>
      <div className="flex gap-2 mb-3">
        <Button variant="primary" loading={busy} onClick={() => gen(0)}><Wand2 className="size-4" />Générer</Button>
        {current && <Button loading={busy} onClick={() => gen(variant + 1)}><RefreshCw className="size-4" />Régénérer</Button>}
      </div>
      {current ? (
        <>
          <Textarea rows={9} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="mt-1 flex justify-between text-[11.5px] text-muted">
            <span>{body.split(/\s+/).filter(Boolean).length} mots · {current.provider}</span>
            <span>Relisez avant envoi : aucun élément non observé ne doit être affirmé.</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={copy}>{copied ? <Check className="size-4 text-good" /> : <Copy className="size-4" />}{copied ? 'Copié' : 'Copier le message'}</Button>
            {profile && <Button onClick={open}><ExternalLink className="size-4" />Ouvrir le profil</Button>}
            <Button onClick={save} disabled={body === current.body}><Save className="size-4" />Enregistrer</Button>
            <Button variant="brass" onClick={sent}><Send className="size-4" />Marquer comme envoyé</Button>
          </div>
        </>
      ) : <p className="text-sm text-muted">Choisissez un canal et un style puis « Générer ».</p>}
      {company.messages.length > 0 && (
        <details className="mt-5">
          <summary className="text-[13px] text-muted cursor-pointer">Historique des messages ({company.messages.length})</summary>
          <ul className="mt-2 space-y-2">
            {company.messages.map((m) => (
              <li key={m.id} className="rounded-lg border border-line p-3">
                <div className="flex items-center gap-2 text-[12px] text-muted mb-1.5">
                  <span>{fmtDateTime(m.created_at)}</span><Badge>{m.channel === 'instagram_dm' ? 'Instagram' : 'Messenger'}</Badge><Badge>{m.style}</Badge>
                  {m.status === 'sent' ? <Badge tone="good">Envoyé {fmtDateTime(m.sent_at)}</Badge> : <Badge tone="brass">Brouillon</Badge>}
                  {m.status === 'draft' && m.id !== current?.id && <button className="ml-auto text-seine hover:underline" onClick={() => setCurrent(m)}>Reprendre</button>}
                </div>
                <p className="text-[13px] whitespace-pre-line text-ink-2">{m.body}</p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
