// Fenêtres d'action réutilisées (fiche, liste, relances) : relance, note, message, statut.
import { useEffect, useState } from 'react';
import { Mail, Sparkles } from 'lucide-react';
import { Dialog } from './ui/Feedback';
import { Button } from './ui/Button';
import { Alert } from './ui/Feedback';
import { SelectField, TextArea, TextField, Checkbox } from './ui/Form';
import { CopyButton, useAction } from './common';
import { useApp, useQuery } from '../app/context';
import { PRIORITY_LABEL, STATUSES, TASK_TYPES, TEMPLATE_CATEGORY_LABEL } from '../domain/referentials';
import { mailtoUrl } from '../domain/links';
import { formatPhone } from '../domain/normalize';
import { aiProvider, type GeneratedMessage } from '../providers/ai';
import type { Prospect, ProspectStatus, ProspectTask, TaskPriority, TaskType } from '../domain/types';

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDue(days = 3) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function TaskDialog({ open, onClose, prospectId, task }: { open: boolean; onClose: () => void; prospectId?: string; task?: ProspectTask | null }) {
  const { api } = useApp();
  const run = useAction();
  const [type, setType] = useState<TaskType>(task?.type ?? 'follow_up');
  const [due, setDue] = useState(toLocalInput(task?.dueAt ?? defaultDue()));
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? 'normal');
  const [note, setNote] = useState(task?.note ?? '');
  const quick = [
    { label: 'Demain', days: 1 },
    { label: 'Dans 3 jours', days: 3 },
    { label: 'Dans 1 semaine', days: 7 },
    { label: 'Dans 1 mois', days: 30 },
  ];
  const save = async () => {
    const dueAt = new Date(due).toISOString();
    const ok = await run(async () => {
      if (task) await api.updateTask(task.id, { type, dueAt, priority, note });
      else await api.addTask(prospectId!, { type, dueAt, priority, note });
      return true;
    }, task ? 'Relance modifiée' : 'Relance programmée');
    if (ok) onClose();
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? 'Modifier la relance' : 'Planifier une relance'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={save}>{task ? 'Enregistrer' : 'Programmer'}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button key={q.label} type="button" onClick={() => setDue(toLocalInput(defaultDue(q.days)))} className="min-h-10 rounded-full border border-line px-3 text-sm hover:border-brand/50">
              {q.label}
            </button>
          ))}
        </div>
        <TextField label="Date et heure" type="datetime-local" value={due} onChange={setDue} />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Type" value={type} onChange={(v) => setType(v as TaskType)} options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
          <SelectField label="Priorité" value={priority} onChange={(v) => setPriority(v as TaskPriority)} options={(['low', 'normal', 'high'] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
        </div>
        <TextArea label="Note" value={note} onChange={setNote} rows={3} placeholder="Ex. rappeler après 17 h, demander le gérant…" />
      </div>
    </Dialog>
  );
}

export function NoteDialog({ open, onClose, prospectId, noteId, initial = '' }: { open: boolean; onClose: () => void; prospectId: string; noteId?: string; initial?: string }) {
  const { api } = useApp();
  const run = useAction();
  const [text, setText] = useState(initial);
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={noteId ? 'Modifier la note' : 'Ajouter une note'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!text.trim()}
            onClick={async () => {
              await run(async () => {
                if (noteId) await api.updateNote(noteId, text);
                else await api.addNote(prospectId, text);
              }, 'Note enregistrée');
              setText('');
              onClose();
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <TextArea label="Note commerciale" value={text} onChange={setText} rows={5} autoFocus />
    </Dialog>
  );
}

export function StatusDialog({ open, onClose, prospect }: { open: boolean; onClose: () => void; prospect: Prospect }) {
  const { api } = useApp();
  const run = useAction();
  const choose = async (s: ProspectStatus) => {
    if (s === 'do_not_contact') await run(() => api.setDoNotContact(prospect.id, true, 'Statut « Ne plus contacter »'), 'Prospect exclu');
    else await run(() => api.setStatus(prospect.id, s), 'Statut mis à jour');
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Changer le statut">
      {prospect.doNotContact && (
        <div className="mb-3">
          <Alert tone="danger">Ce prospect est exclu (« Ne plus contacter »). Retirez l'exclusion depuis la fiche pour changer son statut.</Alert>
        </div>
      )}
      <ul className="grid gap-2 sm:grid-cols-2">
        {STATUSES.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              disabled={prospect.doNotContact || s.id === prospect.status}
              onClick={() => choose(s.id)}
              className={`flex min-h-11 w-full items-center rounded-xl border px-3 text-left font-medium disabled:opacity-50 ${s.id === prospect.status ? 'border-brand bg-brand-soft text-brand' : 'border-line hover:border-brand/50'}`}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

/** Génération d'un message (IA optionnelle ou modèle) + copier / ouvrir dans ma messagerie. */
export function MessageDialog({ open, onClose, prospect }: { open: boolean; onClose: () => void; prospect: Prospect }) {
  const { api, settings } = useApp();
  const run = useAction();
  const { data: templates = [] } = useQuery((a) => a.listTemplates(), []);
  const [templateId, setTemplateId] = useState('');
  const [useAI, setUseAI] = useState(aiProvider.configured);
  const [msg, setMsg] = useState<GeneratedMessage | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [opened, setOpened] = useState(false);
  const blocked = prospect.doNotContact || prospect.demo;

  useEffect(() => {
    if (!templateId && templates.length) setTemplateId(templates[0]!.id);
  }, [templates, templateId]);

  const generate = async () => {
    const m = await run(() => api.generateMessageFor(prospect.id, templateId, useAI));
    if (m) {
      setMsg(m);
      setSubject(m.subject);
      setBody(m.body);
      setOpened(false);
    }
  };

  const to = settings.testMode ? settings.adminEmail : (prospect.email ?? '');

  return (
    <Dialog open={open} onClose={onClose} title="Générer mon message">
      <div className="space-y-4">
        {blocked ? (
          <Alert tone="danger" title={prospect.demo ? 'Donnée de démonstration' : 'Ne plus contacter'}>
            {prospect.demo ? 'Entreprise fictive : aucun message ne peut être préparé.' : 'Ce prospect a demandé à ne plus être contacté. Aucun message ne peut être préparé.'}
          </Alert>
        ) : (
          <>
            <SelectField
              label="Modèle"
              value={templateId}
              onChange={setTemplateId}
              options={templates.map((t) => ({ value: t.id, label: `${t.name} — ${TEMPLATE_CATEGORY_LABEL[t.category]}` }))}
            />
            {aiProvider.configured ? (
              <Checkbox checked={useAI} onChange={setUseAI}>
                Personnaliser avec l'IA (reçoit uniquement les données connues de la fiche)
              </Checkbox>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Sparkles className="h-4 w-4" aria-hidden /> IA non configurée — message généré à partir du modèle, gratuitement.
              </p>
            )}
            <Button onClick={generate} disabled={!templateId} icon={<Sparkles className="h-5 w-5" />}>
              Générer le message
            </Button>
          </>
        )}

        {msg && !blocked && (
          <div className="space-y-3 border-t border-line pt-4">
            {msg.warnings.map((w) => (
              <Alert key={w} tone="warning">
                {w}
              </Alert>
            ))}
            <TextField label="Objet" value={subject} onChange={setSubject} />
            <TextArea label="Message (modifiable)" value={body} onChange={setBody} rows={10} />
            <p className="text-xs text-muted">Relisez toujours le message : il n'affirme rien d'autre que les données de la fiche.</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={subject} label="Copier l'objet" />
              <CopyButton text={body} label="Copier le message" />
              <CopyButton text={prospect.email} label="Copier l'e-mail" />
              <CopyButton text={prospect.phone ? formatPhone(prospect.phone) : null} label="Copier le téléphone" />
            </div>
            {settings.testMode && (
              <Alert tone="warning" title="Mode test">
                {settings.adminEmail ? `Le message s'ouvrira adressé à ${settings.adminEmail} (votre adresse), pas au prospect.` : "Renseignez votre adresse dans Paramètres pour utiliser le mode test."}
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <a
                href={to ? mailtoUrl(to, subject, body) : undefined}
                aria-disabled={!to}
                onClick={(e) => {
                  if (!to) e.preventDefault();
                  else setOpened(true);
                }}
                className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold ${to ? 'bg-brand text-on-brand hover:bg-brand-strong' : 'cursor-not-allowed bg-surface-2 text-muted'}`}
              >
                <Mail className="h-5 w-5" aria-hidden /> Ouvrir dans mon e-mail
              </a>
              {!prospect.email && !settings.testMode && <span className="self-center text-sm text-muted">E-mail non disponible : copiez le message.</span>}
              {!settings.testMode && (
                <Button
                  variant={opened ? 'primary' : 'soft'}
                  onClick={async () => {
                    await run(() => api.logContact(prospect.id, 'email', `E-mail envoyé : « ${subject} »`), 'Contact enregistré');
                    onClose();
                  }}
                >
                  J'ai envoyé le message
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
