import { useMemo, useState } from 'react';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle, Badge } from '../components/ui/Card';
import { ConfirmDialog, EmptyState } from '../components/ui/Feedback';
import { SelectField, TextArea, TextField } from '../components/ui/Form';
import { useAction } from '../components/common';
import { useApp, useCan, useQuery } from '../app/context';
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_LABEL } from '../domain/referentials';
import { VARIABLES, renderTemplate, toInformal, wordCount } from '../domain/templates';
import type { MessageTemplate, TemplateCategory } from '../domain/types';

const SAMPLE = {
  prenom: null,
  entreprise: 'Jardin Concept (exemple)',
  ville: 'Rouen',
  nombre_avis: '87',
  note_google: '4,8',
  site: 'jardin-concept.fr',
  activite: 'aménagement paysager',
  nom_saas: '',
  signature: '',
};

export function TemplatesPage() {
  const { api, settings } = useApp();
  const run = useAction();
  const canEdit = useCan('prospecting.edit');
  const { data: templates = [] } = useQuery((a) => a.listTemplates(), []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Pick<MessageTemplate, 'name' | 'category' | 'subject' | 'body'> & { id?: string } | null>(null);
  const [remove, setRemove] = useState(false);

  const current = draft ?? templates.find((t) => t.id === selectedId) ?? templates[0] ?? null;
  const edit = (patch: Partial<MessageTemplate>) => current && setDraft({ ...current, ...patch });
  const vars = { ...SAMPLE, nom_saas: settings.saasName, signature: settings.signature || '(votre signature)' };
  const preview = useMemo(() => {
    if (!current) return { subject: '', body: '' };
    const f = (t: string) => (settings.formality === 'tu' ? toInformal(t) : t);
    return { subject: f(renderTemplate(current.subject, vars)), body: f(renderTemplate(current.body, vars)) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.subject, current?.body, settings]);

  return (
    <>
      <PageHeader
        title="Templates"
        subtitle="Modèles utilisés sans IA (gratuit) et comme base pour l'IA si elle est configurée."
        actions={canEdit && <Button size="sm" icon={<Plus className="h-5 w-5" />} onClick={() => setDraft({ name: 'Nouveau modèle', category: 'first_contact', subject: '', body: 'Bonjour {{prenom|}},\n\n\n\n{{signature}}' })}>Nouveau</Button>}
      />
      {templates.length === 0 && !draft ? (
        <EmptyState icon={<FileText className="h-7 w-7" />} title="Aucun modèle" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <nav aria-label="Modèles">
            <ul className="space-y-1">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setSelectedId(t.id);
                    }}
                    className={`w-full rounded-xl px-3 py-2 text-left ${current?.id === t.id ? 'bg-brand-soft text-brand' : 'hover:bg-surface-2'}`}
                  >
                    <span className="block font-medium">{t.name}</span>
                    <span className="text-xs text-muted">{TEMPLATE_CATEGORY_LABEL[t.category]}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          {current && (
            <div className="space-y-4">
              <Card>
                <CardTitle action={current.id && 'builtIn' in current && current.builtIn ? <Badge>Modèle fourni</Badge> : null}>Modifier</CardTitle>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Nom" value={current.name} onChange={(v) => edit({ name: v })} disabled={!canEdit} />
                    <SelectField label="Catégorie" value={current.category} onChange={(v) => edit({ category: v as TemplateCategory })} options={TEMPLATE_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} disabled={!canEdit} />
                  </div>
                  <TextField label="Objet" value={current.subject} onChange={(v) => edit({ subject: v })} disabled={!canEdit} />
                  <TextArea label="Message" value={current.body} onChange={(v) => edit({ body: v })} rows={12} disabled={!canEdit} />
                  <div className="text-sm text-muted">
                    <p className="mb-1 font-medium text-ink">Variables disponibles</p>
                    <div className="flex flex-wrap gap-1.5">
                      {VARIABLES.map((v) => (
                        <code key={v.key} title={v.label} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">{`{{${v.key}}}`}</code>
                      ))}
                    </div>
                    <p className="mt-2">
                      Une ligne dont une variable est inconnue pour le prospect est <strong>retirée</strong> du message (jamais de donnée inventée). <code className="text-xs">{'{{prenom|}}'}</code> : valeur de repli (ici vide).
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={!draft} onClick={async () => {
                        const saved = await run(() => api.saveTemplate(draft!), 'Modèle enregistré');
                        if (saved) {
                          setDraft(null);
                          setSelectedId(saved.id);
                        }
                      }}>
                        Enregistrer
                      </Button>
                      {draft && (
                        <Button variant="secondary" onClick={() => setDraft(null)}>
                          Annuler
                        </Button>
                      )}
                      {current.id && (
                        <Button variant="ghost" className="text-danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setRemove(true)}>
                          Supprimer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
              <Card>
                <CardTitle>Aperçu (prospect d'exemple, {settings.formality === 'tu' ? 'tutoiement' : 'vouvoiement'})</CardTitle>
                {preview.subject && <p className="mb-2 text-sm"><strong>Objet :</strong> {preview.subject}</p>}
                <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-sm">{preview.body}</pre>
                <p className={`mt-2 text-xs ${wordCount(preview.body) > 120 ? 'text-warning' : 'text-muted'}`}>{wordCount(preview.body)} mots (120 maximum conseillés)</p>
              </Card>
            </div>
          )}
        </div>
      )}
      <ConfirmDialog
        open={remove}
        title="Supprimer ce modèle ?"
        message="Les campagnes déjà créées conservent leurs messages."
        confirmLabel="Supprimer"
        danger
        onClose={() => setRemove(false)}
        onConfirm={async () => {
          if (current?.id) await run(() => api.deleteTemplate(current.id!), 'Modèle supprimé');
          setRemove(false);
          setDraft(null);
          setSelectedId(null);
        }}
      />
    </>
  );
}
