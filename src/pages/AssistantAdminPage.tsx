// Administration de l'Assistant commercial : base de connaissances, pitchs, scripts, tarifs, objections,
// arguments, modèles, liens et image. Réservée aux rôles Propriétaire / Administrateur.
import { useRef, useState, type ReactNode } from 'react';
import { ImagePlus, Plus, ShieldAlert, Trash2 } from 'lucide-react';
import { PageHeader, StickyActions } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Alert, ConfirmDialog, EmptyState } from '../components/ui/Feedback';
import { Checkbox, SelectField, TextArea, TextField } from '../components/ui/Form';
import { useAction } from '../components/common';
import { useApp, useCan } from '../app/context';
import { uid } from '../utils/id';
import { KB_CATEGORIES, defaultSalesConfig, riskyWording, safeUrl, salesConfig, type SalesConfig, type SalesEntry, type SalesLinks, type SalesObjection } from '../domain/sales';

type FieldDef<T> = { key: keyof T & string; label: string; kind?: 'text' | 'area' | 'check' | 'select'; options?: { value: string; label: string }[]; rows?: number };

function ListEditor<T extends { id: string }>({ items, onChange, fields, make, title, addLabel }: { items: T[]; onChange: (items: T[]) => void; fields: FieldDef<T>[]; make: () => T; title: (item: T) => string; addLabel: string }) {
  const patch = (id: string, key: string, value: unknown) => onChange(items.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <details key={item.id} className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer font-medium">{title(item) || '(sans titre)'}</summary>
          <div className="mt-3 space-y-3">
            {fields.map((f) => {
              const v = item[f.key];
              if (f.kind === 'check')
                return (
                  <Checkbox key={f.key} checked={!!v} onChange={(x) => patch(item.id, f.key, x)}>
                    {f.label}
                  </Checkbox>
                );
              if (f.kind === 'select') return <SelectField key={f.key} label={f.label} value={String(v ?? '')} onChange={(x) => patch(item.id, f.key, x === '' && f.key === 'parent' ? null : x)} options={f.options ?? []} />;
              if (f.kind === 'area') return <TextArea key={f.key} label={f.label} value={String(v ?? '')} onChange={(x) => patch(item.id, f.key, x)} rows={f.rows ?? 3} />;
              return <TextField key={f.key} label={f.label} value={String(v ?? '')} onChange={(x) => patch(item.id, f.key, x)} />;
            })}
            <Button size="sm" variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => onChange(items.filter((x) => x.id !== item.id))}>
              Supprimer
            </Button>
          </div>
        </details>
      ))}
      <Button size="sm" variant="soft" icon={<Plus className="h-4 w-4" />} onClick={() => onChange([...items, make()])}>
        {addLabel}
      </Button>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card>
      <details>
        <summary className="cursor-pointer text-base font-semibold">{title}</summary>
        {hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
        <div className="mt-4 space-y-4">{children}</div>
      </details>
    </Card>
  );
}

/** Redimensionne l'image (1 200 px de large au plus) pour la garder légère dans les paramètres et les e-mails. */
async function readImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Format non pris en charge : utilisez une image PNG, JPG ou WEBP.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Image trop lourde (12 Mo maximum).');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Lecture de l’image impossible sur cet appareil.');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}

const LINK_FIELDS: { key: keyof SalesLinks; label: string; hint: string }[] = [
  { key: 'presentation', label: 'URL de présentation', hint: '' },
  { key: 'demo', label: 'URL de démonstration', hint: 'Utilisée par le bouton « Découvrir » de l’e-mail.' },
  { key: 'signup', label: 'URL d’inscription', hint: '' },
  { key: 'booking', label: 'URL de prise de rendez-vous', hint: '' },
  { key: 'video', label: 'URL vidéo', hint: 'Affiche le bouton « Voir la démonstration ».' },
];

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export function AssistantAdminPage() {
  const { api, settings, reloadSettings } = useApp();
  const run = useAction();
  const allowed = useCan('assistant.admin');
  const [c, setC] = useState<SalesConfig>(() => salesConfig(settings));
  const [reset, setReset] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(c) !== JSON.stringify(salesConfig(settings));
  const set = <K extends keyof SalesConfig>(k: K) => (v: SalesConfig[K]) => setC((x) => ({ ...x, [k]: v }));
  const script = (k: keyof SalesConfig['script']) => (v: string) => setC((x) => ({ ...x, script: { ...x.script, [k]: k === 'questions' || k === 'nextSteps' || k === 'beginnerSteps' ? lines(v) : v } }));

  if (!allowed)
    return (
      <>
        <PageHeader title="Configurer l’assistant" back="/assistant" />
        <EmptyState icon={<ShieldAlert className="h-7 w-7" />} title="Accès réservé">
          Seuls les rôles Propriétaire et Administrateur peuvent modifier la base de connaissances commerciale.
        </EmptyState>
      </>
    );

  const risky = riskyWording([c.presentation, c.pitch30, c.pitch60, ...c.entries.flatMap((e) => [e.short, e.long]), ...c.objections.flatMap((o) => [o.short, o.long]), ...c.arguments.map((a) => a.text), ...c.emails.map((e) => e.body)].join(' '));
  const image = c.image.dataUrl;

  const save = () =>
    run(async () => {
      await api.saveSalesConfig(c);
      await reloadSettings();
    }, 'Assistant commercial enregistré');

  return (
    <>
      <PageHeader title="Configurer l’assistant" subtitle="Base de connaissances commerciale" back="/assistant" />
      <div className="space-y-4">
        <Alert tone="info" title="Règle d’or">
          N’écrivez que ce que le produit fait réellement. Variables disponibles dans tous les textes : {'{{produit}} {{prenom}} {{entreprise}} {{ville}} {{departement}} {{activite}} {{commercial}} {{signature}}'}. Une ligne dont la variable est
          inconnue pour le prospect est supprimée ; {'{{prenom|}}'} laisse simplement un vide.
        </Alert>
        {risky.length > 0 && (
          <Alert tone="warning" title="Formulations à éviter détectées">
            {[...new Set(risky)].join(', ')} — évitez les promesses qui ne peuvent pas être vérifiées.
          </Alert>
        )}

        <Section title="Produit et pitchs">
          <TextField label="Nom du produit" value={c.productName} onChange={set('productName')} />
          <TextArea label="Présentation en une phrase" value={c.presentation} onChange={set('presentation')} rows={3} />
          <TextArea label="Pitch 30 secondes" value={c.pitch30} onChange={set('pitch30')} rows={5} hint="Problème, solution, bénéfice, appel à l’action." />
          <TextArea label="Pitch 1 minute" value={c.pitch60} onChange={set('pitch60')} rows={9} />
        </Section>

        <Section title="Script d’appel et fins d’appel" hint="Une phrase courte, puis une question : pas de monologue.">
          <TextArea label="Introduction (standard)" value={c.script.intro} onChange={script('intro')} rows={4} />
          <TextArea label="Introduction — entreprise structurée" value={c.script.introStructure} onChange={script('introStructure')} rows={4} />
          <TextArea label="Introduction — le prospect a déjà un logiciel de devis" value={c.script.introHasCrm} onChange={script('introHasCrm')} rows={4} />
          <TextArea label="Introduction — le prospect fait ses devis à la main" value={c.script.introNeverProspected} onChange={script('introNeverProspected')} rows={4} />
          <TextArea label="Questions à poser (une par ligne)" value={c.script.questions.join('\n')} onChange={script('questions')} rows={6} />
          <TextArea label="Prochaines étapes (une par ligne)" value={c.script.nextSteps.join('\n')} onChange={script('nextSteps')} rows={4} />
          <TextArea label="Aide du mode débutant (une étape par ligne)" value={c.script.beginnerSteps.join('\n')} onChange={script('beginnerSteps')} rows={6} />
          <TextArea label="Fin d’appel — prospect intéressé" value={c.closings.interested} onChange={(v) => set('closings')({ ...c.closings, interested: v })} rows={2} />
          <TextArea label="Fin d’appel — prospect hésitant" value={c.closings.hesitant} onChange={(v) => set('closings')({ ...c.closings, hesitant: v })} rows={2} />
          <TextArea label="Fin d’appel — demande de rappel" value={c.closings.callback} onChange={(v) => set('closings')({ ...c.closings, callback: v })} rows={2} />
        </Section>

        <Section title="Arbre de conversation" hint="Chaque réponse du prospect affiche une réponse suggérée puis la question suivante. « Réponse à » relie une réponse à la précédente.">
          <ListEditor
            items={c.tree}
            onChange={set('tree')}
            title={(n) => `${n.parent ? '↳ ' : ''}${n.prospectSays}`}
            addLabel="Ajouter une réponse du prospect"
            make={() => ({ id: uid(), parent: null, prospectSays: '', reply: '', next: '' })}
            fields={[
              { key: 'prospectSays', label: 'Le prospect dit' },
              { key: 'reply', label: 'Réponse suggérée', kind: 'area' },
              { key: 'next', label: 'Question suivante' },
              { key: 'parent', label: 'Réponse à', kind: 'select', options: [{ value: '', label: 'La question d’ouverture' }, ...c.tree.map((n) => ({ value: n.id, label: n.prospectSays || '(sans titre)' }))] },
            ]}
          />
        </Section>

        <Section title="Liens commerciaux" hint="Un bouton n’apparaît que si son lien est renseigné. Aucune adresse n’est inventée.">
          {LINK_FIELDS.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={c.links[f.key]}
              onChange={(v) => set('links')({ ...c.links, [f.key]: v })}
              hint={f.hint || undefined}
              error={c.links[f.key].trim() && !safeUrl(c.links[f.key]) ? 'Adresse invalide (attendu : https://…)' : null}
            />
          ))}
        </Section>

        <Section title="Image de présentation" hint="Capture d’écran du produit insérée dans l’e-mail mis en forme. Formats : PNG, JPG, WEBP.">
          <input
            ref={file}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              const dataUrl = await run(() => readImage(f), 'Image importée (pensez à enregistrer)');
              if (dataUrl) set('image')({ ...c.image, dataUrl });
            }}
          />
          {image ? <img src={image} alt="Aperçu de l’image de présentation" className="max-h-72 w-auto rounded-xl border border-line" /> : <p className="text-sm text-muted">Aucune image importée.</p>}
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" icon={<ImagePlus className="h-5 w-5" />} onClick={() => file.current?.click()}>
              {image ? 'Remplacer l’image' : 'Importer une image'}
            </Button>
            {image && (
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => set('image')({ ...c.image, dataUrl: null })}>
                Retirer
              </Button>
            )}
          </div>
          <TextField
            label="Adresse en ligne de l’image (recommandé pour les e-mails)"
            type="url"
            placeholder="https://…/capture.png"
            value={c.image.url}
            onChange={(v) => set('image')({ ...c.image, url: v })}
            hint="Certaines messageries n’affichent pas une image collée : une image hébergée en ligne (sur votre site, par exemple) s’affiche de façon plus fiable. Si elle est renseignée, elle est utilisée en priorité."
            error={c.image.url.trim() && !safeUrl(c.image.url) ? 'Adresse invalide (attendu : https://…)' : null}
          />
          <Checkbox checked={c.image.clickable} onChange={(v) => set('image')({ ...c.image, clickable: v })}>
            Image cliquable (ouvre le lien de démonstration)
          </Checkbox>
        </Section>

        <Section title="Coordonnées commerciales et signature">
          <TextField label="Nom du commercial (par défaut)" value={c.contact.name} onChange={(v) => set('contact')({ ...c.contact, name: v })} />
          <TextField label="Téléphone" value={c.contact.phone} onChange={(v) => set('contact')({ ...c.contact, phone: v })} />
          <TextField label="E-mail" type="email" value={c.contact.email} onChange={(v) => set('contact')({ ...c.contact, email: v })} />
          <TextArea label="Signature e-mail" value={c.signature} onChange={set('signature')} rows={4} hint="Vide = signature des Paramètres." />
        </Section>

        <Section title={`Tarifs (${c.offers.length} formule${c.offers.length > 1 ? 's' : ''})`} hint="Tant qu’aucune formule avec un prix n’est renseignée, l’assistant n’annonce aucun tarif.">
          <ListEditor
            items={c.offers}
            onChange={set('offers')}
            title={(o) => [o.name, o.price, o.period].filter(Boolean).join(' — ')}
            addLabel="Ajouter une formule"
            make={() => ({ id: uid(), name: '', price: '', period: '', features: '', limits: '', trial: '', commitment: '', cta: '' })}
            fields={[
              { key: 'name', label: 'Formule' },
              { key: 'price', label: 'Prix (ex. 29 € HT)' },
              { key: 'period', label: 'Périodicité (ex. par mois)' },
              { key: 'features', label: 'Fonctionnalités', kind: 'area' },
              { key: 'limits', label: 'Limites', kind: 'area', rows: 2 },
              { key: 'trial', label: 'Essai éventuel' },
              { key: 'commitment', label: 'Engagement éventuel' },
              { key: 'cta', label: 'Bouton (ex. S’inscrire) — utilise l’URL d’inscription' },
            ]}
          />
        </Section>

        <Section title={`Base de connaissances et FAQ (${c.entries.length})`} hint="Les questions « Tarifs » marquées automatiques sont calculées à partir des formules ci-dessus.">
          <ListEditor<SalesEntry>
            items={c.entries}
            onChange={set('entries')}
            title={(e) => `${e.question}${e.dynamic ? ' (réponse automatique)' : ''}`}
            addLabel="Ajouter une question"
            make={() => ({ id: uid(), category: 'produit', question: '', short: '', long: '', avoid: '', faq: true })}
            fields={[
              { key: 'question', label: 'Question' },
              { key: 'category', label: 'Rubrique', kind: 'select', options: KB_CATEGORIES.map((k) => ({ value: k.id, label: k.label })) },
              { key: 'short', label: 'Réponse courte (à dire tout de suite)', kind: 'area', rows: 2 },
              { key: 'long', label: 'Explication', kind: 'area' },
              { key: 'avoid', label: 'À éviter', kind: 'area', rows: 2 },
              { key: 'faq', label: 'Afficher dans les questions fréquentes', kind: 'check' },
              { key: 'sheet', label: 'Afficher dans la fiche « en 30 secondes »', kind: 'check' },
            ]}
          />
        </Section>

        <Section title={`Objections (${c.objections.length})`}>
          <ListEditor<SalesObjection>
            items={c.objections}
            onChange={set('objections')}
            title={(o) => `${o.objection}${o.dynamic ? ' (réponse automatique)' : ''}`}
            addLabel="Ajouter une objection"
            make={() => ({ id: uid(), objection: '', short: '', long: '', followUp: '' })}
            fields={[
              { key: 'objection', label: 'Objection (phrase du prospect)' },
              { key: 'short', label: 'Réponse courte', kind: 'area', rows: 2 },
              { key: 'long', label: 'Réponse développée', kind: 'area' },
              { key: 'followUp', label: 'Relance (question pour poursuivre)' },
            ]}
          />
        </Section>

        <Section title={`Arguments (${c.arguments.length})`}>
          <ListEditor
            items={c.arguments}
            onChange={set('arguments')}
            title={(a) => a.need}
            addLabel="Ajouter un argument"
            make={() => ({ id: uid(), need: '', text: '' })}
            fields={[
              { key: 'need', label: 'Besoin' },
              { key: 'text', label: 'Argument (court et factuel)', kind: 'area', rows: 2 },
            ]}
          />
        </Section>

        <Section title="Comparaison avec les méthodes classiques" hint="Restez factuel, sans dénigrer.">
          <ListEditor
            items={c.comparison}
            onChange={set('comparison')}
            title={(x) => x.method}
            addLabel="Ajouter une ligne"
            make={() => ({ id: uid(), method: '', strength: '', limit: '' })}
            fields={[
              { key: 'method', label: 'Méthode' },
              { key: 'strength', label: 'Point fort' },
              { key: 'limit', label: 'Limite' },
            ]}
          />
        </Section>

        <Section title={`Modèles d’e-mail (${c.emails.length})`} hint="Les liens et l’image sont ajoutés automatiquement : ne les écrivez pas dans le texte. Une ligne commençant par « - » devient une puce.">
          <ListEditor
            items={c.emails}
            onChange={set('emails')}
            title={(e) => e.name}
            addLabel="Ajouter un modèle"
            make={() => ({ id: uid(), name: 'Nouveau modèle', subject: '', body: 'Bonjour {{prenom|}},\n\n\n\n{{signature}}' })}
            fields={[
              { key: 'name', label: 'Nom du modèle' },
              { key: 'subject', label: 'Objet' },
              { key: 'body', label: 'Message', kind: 'area', rows: 12 },
            ]}
          />
        </Section>

        <Section title="Messages courts (SMS, WhatsApp, LinkedIn)">
          <TextArea label="SMS" value={c.messages.sms} onChange={(v) => set('messages')({ ...c.messages, sms: v })} rows={3} />
          <TextArea label="WhatsApp" value={c.messages.whatsapp} onChange={(v) => set('messages')({ ...c.messages, whatsapp: v })} rows={3} />
          <TextArea label="LinkedIn" value={c.messages.linkedin} onChange={(v) => set('messages')({ ...c.messages, linkedin: v })} rows={3} />
        </Section>

        <Button variant="danger" onClick={() => setReset(true)}>
          Rétablir le contenu par défaut
        </Button>
      </div>

      <StickyActions>
        <Button block disabled={!dirty} onClick={save}>
          {dirty ? 'Enregistrer' : 'Aucune modification'}
        </Button>
      </StickyActions>

      <ConfirmDialog
        open={reset}
        title="Rétablir le contenu par défaut ?"
        message="Tous les textes, tarifs, liens et l’image de l’assistant commercial seront remplacés par le contenu d’origine. Les prospects ne sont pas concernés."
        confirmLabel="Rétablir"
        danger
        onClose={() => setReset(false)}
        onConfirm={async () => {
          setReset(false);
          await run(async () => {
            await api.saveSalesConfig(undefined);
            await reloadSettings();
            setC(defaultSalesConfig());
          }, 'Contenu par défaut rétabli');
        }}
      />
    </>
  );
}
