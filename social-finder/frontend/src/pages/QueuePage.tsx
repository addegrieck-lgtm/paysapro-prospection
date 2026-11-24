import { useState } from 'react';
import { Link } from 'react-router';
import { Check, Clock, Copy, ExternalLink, Send, Wand2, XCircle } from 'lucide-react';
import { api } from '../lib/api';
import { useApi } from '../lib/hooks';
import type { CompanySummary, Message } from '../lib/types';
import { Button, Card, DemoBadge, Empty, PageHeader, Select, Spinner, Textarea, Toggle, useToast } from '../components/ui';
import { PlatformIcon } from '../components/brand';
import { ScorePill } from '../components/scores';
import { StatusBadge } from '../components/CompanyTable';
import { copyText } from '../components/MessageComposer';

type Item = CompanySummary & { message: Message | null };

function QueueItem({ it, onDone }: { it: Item; onDone: () => void }) {
  const toast = useToast();
  const [msg, setMsg] = useState<Message | null>(it.message);
  const [body, setBody] = useState(it.message?.body ?? '');
  const [style, setStyle] = useState('professional');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const target = it.profiles.find((p) => p.platform === (msg?.channel === 'messenger' ? 'facebook' : 'instagram')) ?? it.profiles[0];
  const channel = target?.platform === 'facebook' ? 'messenger' : 'instagram_dm';

  const generate = async () => {
    setBusy(true);
    try {
      const m = await api.post<Message>(`/companies/${it.id}/messages/generate`, { channel, style });
      setMsg(m);
      setBody(m.body);
    } finally { setBusy(false); }
  };
  const persist = async () => { if (msg && body !== msg.body) setMsg(await api.patch<Message>(`/messages/${msg.id}`, { body })); };
  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    await persist();
    await api.post(`/queue/${it.id}/${action}`, { message_id: msg?.id, platform: target?.platform, ...extra });
    toast(action === 'sent' ? `« ${it.name} » marqué comme contacté` : action === 'postpone' ? 'Reporté de 3 jours' : 'Ignoré', 'good');
    onDone();
  };

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-60">
          <div className="flex items-center gap-2 flex-wrap">
            <Link to={`/prospects/${it.id}`} className="font-semibold hover:underline">{it.name}</Link>{!!it.is_demo && <DemoBadge />}<StatusBadge status={it.status} label={it.status_label} />
          </div>
          <div className="text-[12.5px] text-muted">{[it.activity_label, it.city].filter(Boolean).join(' · ')}</div>
          <div className="mt-2 flex flex-wrap gap-4"><ScorePill kind="confidence" score={it.confidence_score} /><ScorePill kind="commercial" score={it.commercial_score} /></div>
          {target && (
            <div className="mt-2 text-[13px] flex items-center gap-1.5"><PlatformIcon platform={target.platform} />Profil à contacter : <a href={target.url} target="_blank" rel="noreferrer" className="text-seine hover:underline">@{target.handle}</a></div>
          )}
          {it.confidence_score < 75 && <p className="mt-2 text-[12px] text-warn">Identification à vérifier avant l'envoi (confiance &lt; 75).</p>}
        </div>
        <div className="flex-[1.6] min-w-72">
          {msg ? (
            <Textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} />
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-line p-4">
              <Select value={style} onChange={(e) => setStyle(e.target.value)} className="w-56">
                <option value="professional">Professionnel</option><option value="friendly">Naturel et convivial</option><option value="direct">Commercial direct</option>
              </Select>
              <Button variant="primary" loading={busy} onClick={generate}><Wand2 className="size-4" />Préparer le message</Button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" disabled={!msg} onClick={async () => { await persist(); await copyText(body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
              {copied ? <Check className="size-3.5 text-good" /> : <Copy className="size-3.5" />}{copied ? 'Copié' : 'Copier le message'}</Button>
            <Button size="sm" disabled={!target} onClick={() => { window.open(target!.url, '_blank', 'noopener'); void api.post(`/queue/${it.id}/opened`, { platform: target!.platform }); }}>
              <ExternalLink className="size-3.5" />Ouvrir le profil</Button>
            <Button size="sm" variant="brass" disabled={!msg} onClick={() => act('sent')}><Send className="size-3.5" />Marquer comme envoyé</Button>
            <Button size="sm" variant="ghost" onClick={() => act('postpone', { days: 3 })}><Clock className="size-3.5" />Reporter</Button>
            <Button size="sm" variant="ghost" onClick={() => act('ignore')}><XCircle className="size-3.5" />Ignorer</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function QueuePage() {
  const [withDemo, setWithDemo] = useState(true);
  const [reliable, setReliable] = useState(false);
  const { data, loading, reload } = useApi<{ items: Item[]; postponed: number }>(`/queue?include_demo=${withDemo}&min_confidence=${reliable ? 75 : 0}`, [withDemo, reliable]);
  return (
    <>
      <PageHeader eyebrow="Envoi manuel" title="File de prospection"
        subtitle="Copiez le message, ouvrez le profil, envoyez-le vous-même depuis Instagram ou Facebook, puis revenez marquer l'envoi. Aucun message n'est envoyé automatiquement."
        actions={<><Toggle checked={reliable} onChange={setReliable} label="Fiables uniquement (≥ 75)" /><Toggle checked={withDemo} onChange={setWithDemo} label="Inclure la démo" /></>} />
      {loading && !data ? <Spinner /> : data && data.items.length ? (
        <div className="space-y-3">
          {data.items.map((it) => <QueueItem key={it.id} it={it} onDone={reload} />)}
          {data.postponed > 0 && <p className="text-[13px] text-muted text-center">{data.postponed} prospect(s) reporté(s) réapparaîtront à leur date.</p>}
        </div>
      ) : (
        <Card><Empty icon={<Send className="size-6" />} title="La file est vide">
          Ajoutez des prospects depuis la liste (« Ajouter à la file ») ou passez une fiche au statut « À contacter ».
        </Empty></Card>
      )}
    </>
  );
}
