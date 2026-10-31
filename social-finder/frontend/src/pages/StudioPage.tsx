import { useState } from 'react';
import { MessageSquareText, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { useApi, useReferentials } from '../lib/hooks';
import { Badge, Button, Card, Empty, Input, Label, Modal, PageHeader, Select, Textarea, useToast } from '../components/ui';

interface Tpl { id: number; name: string; style: string; channel: string; body: string }
const VARS = ['{entreprise}', '{activite}', '{ville}', '{reseau}', '{observation}', '{proposition}', '{presentation}', '{signature}'];
const EXAMPLE = 'Bonjour,\n\nJ\'ai découvert {entreprise} sur {reseau}. {observation}\n\n{presentation} Je pense que {proposition} pourrait vous intéresser.\n\nSeriez-vous ouvert à un échange ?\n\n{signature}';

export default function StudioPage() {
  const ref = useReferentials();
  const toast = useToast();
  const { data, reload } = useApi<Tpl[]>('/templates');
  const ai = useApi<{ ai: { provider: string; ready: boolean; message: string } }>('/connectors');
  const [edit, setEdit] = useState<Partial<Tpl> | null>(null);
  const save = async () => {
    if (!edit?.name || !edit.body) return;
    if (edit.id) await api.put(`/templates/${edit.id}`, edit); else await api.post('/templates', edit);
    setEdit(null);
    toast('Modèle enregistré', 'good');
    void reload();
  };
  return (
    <>
      <PageHeader eyebrow="Rédaction" title="AI Message Studio"
        subtitle="Les messages se génèrent depuis chaque fiche prospect ou la file de prospection. Ici : vos modèles personnalisés et le moteur de rédaction."
        actions={<Button variant="primary" onClick={() => setEdit({ name: '', style: 'professional', channel: 'any', body: EXAMPLE })}><Plus className="size-4" />Nouveau modèle</Button>} />
      <div className="grid lg:grid-cols-[1fr_340px] gap-4">
        <Card title="Modèles personnalisés">
          {data?.length ? <ul className="space-y-3">{data.map((t) => (
            <li key={t.id} className="rounded-xl border border-line p-4">
              <div className="flex items-center gap-2 mb-2"><span className="font-medium">{t.name}</span><Badge>{ref?.styles.find((s) => s.key === t.style)?.label ?? t.style}</Badge>
                <div className="ml-auto flex gap-1"><Button size="sm" variant="ghost" onClick={() => setEdit(t)}><Pencil className="size-3.5" /></Button>
                  <Button size="sm" variant="ghost" onClick={async () => { await api.del(`/templates/${t.id}`); void reload(); }}><Trash2 className="size-3.5" /></Button></div></div>
              <p className="text-[13px] whitespace-pre-line text-ink-2">{t.body}</p>
            </li>))}</ul>
            : <Empty icon={<MessageSquareText className="size-6" />} title="Aucun modèle personnalisé">La rédaction automatique (3 styles, variantes, personnalisée par activité et observations) fonctionne sans modèle.</Empty>}
        </Card>
        <div className="space-y-4">
          <Card title="Moteur de rédaction">
            <p className="text-[13.5px]"><span className="font-medium">{ai.data?.ai.message ?? '…'}</span></p>
            <p className="mt-2 text-[12.5px] text-muted">Par défaut : modèles intégrés, gratuits et hors ligne. Facultatif : Ollama (IA locale gratuite), une API compatible OpenAI ou Anthropic — à régler dans Paramètres. En cas d'échec de l'IA, les modèles prennent le relais.</p>
          </Card>
          <Card title="Règles de rédaction">
            <ul className="text-[12.5px] text-ink-2 space-y-1.5 list-disc pl-4">
              <li>Court (50 à 90 mots), naturel, sans pression.</li>
              <li>Seuls les éléments <b>constatés</b> sont cités ; une hypothèse devient une question.</li>
              <li>Jamais « j'ai analysé vos publications » si ce n'est pas le cas.</li>
              <li>Aucune promesse de résultat.</li>
              <li>Envoi manuel uniquement, depuis votre compte.</li>
            </ul>
          </Card>
        </div>
      </div>
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifier le modèle' : 'Nouveau modèle'} wide>
        {edit && <div className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Nom</Label><Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div><Label>Style</Label><Select value={edit.style} onChange={(e) => setEdit({ ...edit, style: e.target.value })}>{ref?.styles.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</Select></div>
          </div>
          <div><Label hint={VARS.join(' ')}>Texte</Label><Textarea rows={10} value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} /></div>
          <p className="text-[12px] text-muted">{'{observation}'} n'est rempli que par un élément réellement constaté (ou une question si c'est une hypothèse) ; sinon il reste vide.</p>
          <Button variant="primary" onClick={save}>Enregistrer</Button>
        </div>}
      </Modal>
    </>
  );
}
