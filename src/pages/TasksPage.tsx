import { useState } from 'react';
import { Link } from 'react-router';
import { AlarmClock, Check, CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Card';
import { EmptyState } from '../components/ui/Feedback';
import { Segmented } from '../components/ui/Form';
import { IconButton } from '../components/ui/Button';
import { formatDateTime, nf, useAction } from '../components/common';
import { TaskDialog } from '../components/dialogs';
import { useApp, useCan, useQuery } from '../app/context';
import { today } from '../domain/filters';
import { PRIORITY_LABEL, TASK_TYPE_LABEL } from '../domain/referentials';
import type { ProspectTask } from '../domain/types';

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Relances groupées : en retard, aujourd'hui, demain, cette semaine, plus tard. */
export function groupTasks(tasks: ProspectTask[], now = new Date()) {
  const t = today(now);
  const tomorrow = addDays(t, 1);
  const week = addDays(t, 7);
  const groups: Record<'late' | 'today' | 'tomorrow' | 'week' | 'later', ProspectTask[]> = { late: [], today: [], tomorrow: [], week: [], later: [] };
  for (const task of tasks) {
    const d = task.dueAt.slice(0, 10);
    if (d < t) groups.late.push(task);
    else if (d === t) groups.today.push(task);
    else if (d === tomorrow) groups.tomorrow.push(task);
    else if (d <= week) groups.week.push(task);
    else groups.later.push(task);
  }
  return groups;
}

const LABEL = { late: 'En retard', today: "Aujourd'hui", tomorrow: 'Demain', week: 'Cette semaine', later: 'Plus tard' } as const;

export function TasksPage() {
  const { api } = useApp();
  const run = useAction();
  const canEdit = useCan('prospecting.edit');
  const [view, setView] = useState<'open' | 'done'>('open');
  const [edit, setEdit] = useState<ProspectTask | null>(null);
  const { data: tasks = [] } = useQuery((a) => a.listTasks(), []);
  const open = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const groups = groupTasks(open);

  const item = (t: ProspectTask) => (
    <li key={t.id} className="flex items-start gap-2 border-b border-line/70 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <Link to={`/prospects/${t.prospectId}`} className="font-semibold text-ink hover:text-brand">
          {t.prospectName}
        </Link>
        <p className="text-sm text-muted">
          {TASK_TYPE_LABEL[t.type]} · {formatDateTime(t.dueAt)} {t.note && `· ${t.note}`}
        </p>
        <div className="mt-1 flex gap-1.5">
          <Badge tone={t.priority === 'high' ? 'warning' : 'neutral'}>Priorité {PRIORITY_LABEL[t.priority].toLowerCase()}</Badge>
          {t.done && <Badge tone="success">Terminée</Badge>}
        </div>
      </div>
      {canEdit && !t.done && (
        <div className="flex flex-wrap justify-end">
          <IconButton label="Terminer" onClick={() => run(() => api.completeTask(t.id), 'Relance terminée')}>
            <Check className="h-5 w-5 text-success" />
          </IconButton>
          <IconButton label="Reporter d'un jour" onClick={() => run(() => api.postponeTask(t.id, 1), 'Reportée à demain')}>
            <CalendarPlus className="h-5 w-5" />
          </IconButton>
          <IconButton label="Modifier" onClick={() => setEdit(t)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label="Supprimer" onClick={() => run(() => api.deleteTask(t.id), 'Relance supprimée')}>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      )}
    </li>
  );

  return (
    <>
      <PageHeader title="Relances" subtitle={`${nf.format(groups.today.length + groups.late.length)} à traiter aujourd'hui · ${nf.format(groups.tomorrow.length)} demain · ${nf.format(groups.week.length)} cette semaine`} />
      <div className="mb-4 max-w-xs">
        <Segmented label="Affichage" value={view} onChange={setView} options={[{ value: 'open', label: `À faire (${open.length})` }, { value: 'done', label: `Terminées (${done.length})` }]} />
      </div>
      {view === 'open' ? (
        open.length === 0 ? (
          <EmptyState icon={<AlarmClock className="h-7 w-7" />} title="Aucune relance à faire">
            Programmez une relance depuis la fiche d'un prospect ou la liste (icône ⏰).
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map(
              (k) =>
                groups[k].length > 0 && (
                  <Card key={k}>
                    <h2 className={`mb-1 font-semibold ${k === 'late' ? 'text-danger' : 'text-ink'}`}>
                      {LABEL[k]} <span className="text-muted">({groups[k].length})</span>
                    </h2>
                    <ul>{groups[k].map(item)}</ul>
                  </Card>
                ),
            )}
          </div>
        )
      ) : (
        <Card>
          <ul>{done.slice(0, 200).map(item)}</ul>
          {done.length === 0 && <p className="text-sm text-muted">Aucune relance terminée.</p>}
        </Card>
      )}
      {edit && <TaskDialog open onClose={() => setEdit(null)} task={edit} />}
    </>
  );
}
