import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  Check,
  Compass,
  ExternalLink,
  Globe,
  Lightbulb,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  StickyNote,
  Trash2,
} from 'lucide-react';
import { Button, ButtonLink, IconButton } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert, ConfirmDialog, EmptyState } from '../components/ui/Feedback';
import { Avatar, Skeleton } from '../components/ui/Extras';
import { Checkbox } from '../components/ui/Form';
import { InfoRow, ScoreBadge, StatusBadge, Value, formatDateShort, formatDateTime, useAction } from '../components/common';
import { MessageDialog, NoteDialog, StatusDialog, TaskDialog } from '../components/dialogs';
import { useApp, useCan, useQuery } from '../app/context';
import { computeScore, priorityOf } from '../domain/scoring';
import { contactReasons, prospectingAngle } from '../domain/insights';
import { annuaireEntreprisesUrl, googleMapsSearchUrl, googleSearchUrl, telUrl } from '../domain/links';
import { departmentLabel, regionName } from '../domain/geo';
import { NAF_LABELS, PRIORITY_LABEL, SERVICE_LABEL, TASK_TYPE_LABEL, headcountLabel } from '../domain/referentials';
import { formatPhone } from '../domain/normalize';
import type { ProspectTask } from '../domain/types';

const SOURCE_LABEL = { sirene: 'SIRENE (INSEE)', csv: 'Import CSV', manual: 'Saisie manuelle', demo: 'Démonstration', enrichment: 'Enrichissement' } as const;

export function ProspectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { api } = useApp();
  const run = useAction();
  const canEdit = useCan('prospecting.edit');
  const canDelete = useCan('prospecting.delete');
  const { data: prospect, loading } = useQuery((a) => a.getProspect(id), [id]);
  const { data: timeline = [] } = useQuery((a) => a.timeline(id), [id]);
  const { data: notes = [] } = useQuery((a) => a.notesFor(id), [id]);
  const { data: tasks = [] } = useQuery((a) => a.tasksFor(id), [id]);
  const [dialog, setDialog] = useState<'message' | 'note' | 'task' | 'status' | 'dnc' | 'delete' | null>(null);
  const [editNote, setEditNote] = useState<{ id: string; text: string } | null>(null);
  const [editTask, setEditTask] = useState<ProspectTask | null>(null);
  const [suppress, setSuppress] = useState(true);

  if (loading && !prospect) return <Skeleton className="h-64" />;
  if (!prospect)
    return (
      <EmptyState icon={<Search className="h-7 w-7" />} title="Prospect introuvable" action={<ButtonLink to="/prospects">Retour aux prospects</ButtonLink>}>
        Il a peut-être été supprimé.
      </EmptyState>
    );

  const p = prospect;
  const score = computeScore(p);
  const priority = priorityOf(score.score);
  const reasons = contactReasons(p);
  const angle = prospectingAngle(p);
  const tel = telUrl(p.phone);
  const blocked = p.doNotContact || p.demo;

  return (
    <>
      <Link to="/prospects" className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Prospects
      </Link>
      {p.demo && (
        <div className="mb-4">
          <Alert tone="warning" title="DONNÉE DE DÉMONSTRATION">
            Entreprise fictive, générée pour tester l'outil. Elle ne peut pas être contactée.
          </Alert>
        </div>
      )}
      {p.doNotContact && (
        <div className="mb-4">
          <Alert tone="danger" title="Ne plus contacter">
            {p.doNotContactReason ?? 'Exclu de toute prospection.'} Aucun message, relance ou campagne n'est possible. L'information est conservée.
          </Alert>
        </div>
      )}

      {/* En-tête */}
      <div className="mb-5 flex flex-wrap items-start gap-4">
        <Avatar name={p.tradeName ?? p.name} className="h-14 w-14 text-lg" />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink">{p.tradeName ?? p.name}</h1>
          {p.tradeName && <p className="text-muted">{p.name}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ScoreBadge score={p.score} large />
            <span className="text-sm text-muted">{priority.label}</span>
            <StatusBadge status={p.status} />
            {p.city && <span className="text-sm text-muted">· {p.city}</span>}
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {tel && !blocked && (
          <a href={tel} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong">
            <Phone className="h-5 w-5" aria-hidden /> Appeler
          </a>
        )}
        <Button variant={tel && !blocked ? 'secondary' : 'primary'} icon={<Mail className="h-5 w-5" />} disabled={blocked} onClick={() => setDialog('message')}>
          E-mail / message
        </Button>
        <a href={googleSearchUrl(p)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
          <Search className="h-5 w-5" aria-hidden /> Google
        </a>
        {p.website && (
          <a href={p.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
            <Globe className="h-5 w-5" aria-hidden /> Site
          </a>
        )}
        {canEdit && (
          <>
            <Button variant="secondary" icon={<StickyNote className="h-5 w-5" />} onClick={() => setDialog('note')}>
              Note
            </Button>
            <Button variant="secondary" icon={<AlarmClock className="h-5 w-5" />} disabled={p.doNotContact} onClick={() => setDialog('task')}>
              Relance
            </Button>
            <Button variant="secondary" icon={<RefreshCw className="h-5 w-5" />} onClick={() => setDialog('status')}>
              Statut
            </Button>
            <ButtonLink to={`/prospects/${p.id}/edit`} variant="secondary" icon={<Pencil className="h-5 w-5" />}>
              Modifier / enrichir
            </ButtonLink>
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Colonne gauche : informations */}
        <div className="space-y-4">
          <Card>
            <CardTitle>Score : {score.score}/100</CardTitle>
            <p className="mb-2 text-sm font-medium text-ink">Pourquoi ce score ?</p>
            {score.reasons.length ? (
              <ul className="space-y-1 text-sm">
                {score.reasons.map((r) => (
                  <li key={r.label} className="flex gap-2">
                    <span className="w-9 shrink-0 font-semibold tabular-nums text-success">+{r.points}</span>
                    {r.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Aucun critère rempli pour l'instant.</p>
            )}
            {score.missing.length > 0 && (
              <p className="mt-3 text-sm text-muted">
                À vérifier pour affiner : {score.missing.join(', ')}. <a className="font-medium text-brand hover:underline" href={googleSearchUrl(p)} target="_blank" rel="noopener noreferrer">Rechercher sur Google</a>
              </p>
            )}
            <p className="mt-3 text-xs text-muted">Catégorie interne de prospection, pas un jugement sur l'entreprise.</p>
          </Card>

          <Card>
            <CardTitle>Informations entreprise</CardTitle>
            <dl>
              <InfoRow label="Raison sociale"><Value>{p.name}</Value></InfoRow>
              <InfoRow label="Nom commercial"><Value>{p.tradeName}</Value></InfoRow>
              <InfoRow label="SIREN"><Value href={annuaireEntreprisesUrl(p.siren)} external>{p.siren}</Value></InfoRow>
              <InfoRow label="SIRET"><Value>{p.siret}</Value></InfoRow>
              <InfoRow label="Forme juridique"><Value>{p.legalForm}</Value></InfoRow>
              <InfoRow label="Code NAF"><Value>{p.nafCode ? `${p.nafCode}${NAF_LABELS[p.nafCode] ? ` — ${NAF_LABELS[p.nafCode]}` : ''}` : null}</Value></InfoRow>
              <InfoRow label="Activité"><Value>{p.activity}</Value></InfoRow>
              <InfoRow label="Date de création"><Value>{p.creationDate ? formatDateShort(p.creationDate) : null}</Value></InfoRow>
              <InfoRow label="Effectif"><Value>{p.headcount !== null || p.headcountBand ? headcountLabel(p.headcountBand, p.headcount) : null}</Value></InfoRow>
              <InfoRow label="Établissement"><Value>{p.active === null ? null : p.active ? 'Actif' : 'Fermé'}</Value></InfoRow>
            </dl>
          </Card>

          <Card>
            <CardTitle>Coordonnées</CardTitle>
            <dl>
              <InfoRow label="Adresse"><Value>{p.address}</Value></InfoRow>
              <InfoRow label="Code postal"><Value>{p.postalCode}</Value></InfoRow>
              <InfoRow label="Ville"><Value>{p.city}</Value></InfoRow>
              <InfoRow label="Département"><Value>{p.department ? departmentLabel(p.department) : null}</Value></InfoRow>
              <InfoRow label="Région"><Value>{regionName(p.region)}</Value></InfoRow>
              <InfoRow label="Contact"><Value>{[p.contactFirstName, p.contactLastName].filter(Boolean).join(' ') || null}</Value></InfoRow>
              <InfoRow label="Téléphone"><Value href={blocked ? null : tel}>{p.phone ? formatPhone(p.phone) : null}</Value></InfoRow>
              <InfoRow label="E-mail"><Value>{p.email}</Value></InfoRow>
              <InfoRow label="Site web"><Value href={p.website} external>{p.website?.replace(/^https?:\/\//, '')}</Value></InfoRow>
            </dl>
          </Card>

          <Card>
            <CardTitle action={<a href={googleMapsSearchUrl(p)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Chercher sur Maps <ExternalLink className="h-3.5 w-3.5" /></a>}>
              Google et présence en ligne
            </CardTitle>
            <dl>
              <InfoRow label="Fiche Google"><Value href={p.googleUrl} external>{p.googleUrl ? 'Voir la fiche' : null}</Value></InfoRow>
              <InfoRow label="Note"><Value>{p.googleRating !== null ? `${String(p.googleRating).replace('.', ',')} / 5` : null}</Value></InfoRow>
              <InfoRow label="Nombre d'avis"><Value>{p.googleReviews}</Value></InfoRow>
              <InfoRow label="Catégorie principale"><Value>{p.googleCategory}</Value></InfoRow>
              <InfoRow label="Dernière vérification"><Value>{p.googleCheckedAt ? formatDateShort(p.googleCheckedAt) : null}</Value></InfoRow>
              <InfoRow label="Facebook"><Value href={p.facebook} external>{p.facebook ? 'Profil' : null}</Value></InfoRow>
              <InfoRow label="Instagram"><Value href={p.instagram} external>{p.instagram ? 'Profil' : null}</Value></InfoRow>
              <InfoRow label="LinkedIn"><Value href={p.linkedin} external>{p.linkedin ? 'Profil' : null}</Value></InfoRow>
              <InfoRow label="TikTok"><Value href={p.tiktok} external>{p.tiktok ? 'Profil' : null}</Value></InfoRow>
            </dl>
            <p className="mt-3 text-xs text-muted">Données saisies manuellement ou importées : aucune n'est récupérée automatiquement sur Google.</p>
          </Card>

          <Card>
            <CardTitle>Qualification</CardTitle>
            <dl>
              <InfoRow label="Prestations"><Value>{p.services.map((s) => SERVICE_LABEL[s]).join(', ') || null}</Value></InfoRow>
              <InfoRow label="Zone d'intervention"><Value>{p.interventionArea}</Value></InfoRow>
              <InfoRow label="Responsable"><Value>{p.owner}</Value></InfoRow>
            </dl>
          </Card>

          <Card>
            <CardTitle>Origine de la donnée (RGPD)</CardTitle>
            <dl>
              <InfoRow label="Source"><Value>{SOURCE_LABEL[p.source]}</Value></InfoRow>
              <InfoRow label="URL source"><Value href={p.sourceUrl} external>{p.sourceUrl ? 'Consulter' : null}</Value></InfoRow>
              <InfoRow label="Date de collecte"><Value>{formatDateShort(p.dateCollected)}</Value></InfoRow>
              <InfoRow label="Dernière vérification"><Value>{p.lastVerifiedAt ? formatDateShort(p.lastVerifiedAt) : null}</Value></InfoRow>
            </dl>
            {canEdit && !p.demo && (
              <div className="mt-4 flex flex-wrap gap-2">
                {p.doNotContact ? (
                  <Button variant="secondary" onClick={() => run(() => api.setDoNotContact(p.id, false), 'Exclusion retirée')}>
                    Retirer « Ne plus contacter »
                  </Button>
                ) : (
                  <Button variant="danger" icon={<Ban className="h-5 w-5" />} onClick={() => setDialog('dnc')}>
                    Ne plus contacter
                  </Button>
                )}
              </div>
            )}
            {canDelete && (
              <div className="mt-2">
                <Button variant="ghost" icon={<Trash2 className="h-5 w-5" />} onClick={() => setDialog('delete')} className="text-danger">
                  Supprimer ce prospect
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Colonne droite : intelligence, tâches, notes, historique */}
        <div className="space-y-4">
          <Card>
            <CardTitle icon={<Lightbulb className="h-5 w-5" />}>Pourquoi contacter cette entreprise ?</CardTitle>
            {reasons.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Pas encore assez de données. Vérifiez sa présence sur Google et complétez la fiche.</p>
            )}
            <div className="mt-4 rounded-xl bg-surface-2 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Compass className="h-4 w-4 text-brand" aria-hidden /> Angle de prospection : {angle.angle}
              </p>
              <p className="mt-1 text-sm text-muted">Pourquoi cet angle ? {angle.why.join(' ')}</p>
            </div>
          </Card>

          <Card>
            <CardTitle action={canEdit && !p.doNotContact && <Button size="sm" variant="soft" onClick={() => setDialog('task')}>Ajouter</Button>}>Relances</CardTitle>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted">Aucune relance programmée.</p>
            ) : (
              <ul className="space-y-2">
                {tasks.map((t) => (
                  <li key={t.id} className={`flex items-start gap-2 rounded-xl border border-line p-3 text-sm ${t.done ? 'opacity-60' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {TASK_TYPE_LABEL[t.type]} · {formatDateTime(t.dueAt)} {t.done && '· terminée'}
                      </p>
                      <p className="text-muted">Priorité {PRIORITY_LABEL[t.priority].toLowerCase()}{t.note && ` · ${t.note}`}</p>
                    </div>
                    {!t.done && canEdit && (
                      <>
                        <IconButton label="Terminer" onClick={() => run(() => api.completeTask(t.id), 'Relance terminée')}>
                          <Check className="h-5 w-5" />
                        </IconButton>
                        <IconButton label="Modifier" onClick={() => setEditTask(t)}>
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle action={canEdit && <Button size="sm" variant="soft" onClick={() => setDialog('note')}>Ajouter</Button>}>Notes commerciales</CardTitle>
            {notes.length === 0 ? (
              <p className="text-sm text-muted">Aucune note.</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-xl border border-line p-3 text-sm">
                    <p className="whitespace-pre-wrap">{n.text}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                      <span>
                        {n.author} · {formatDateTime(n.createdAt)}
                        {n.updatedAt !== n.createdAt && ' (modifiée)'}
                      </span>
                      {canEdit && (
                        <span className="flex">
                          <IconButton label="Modifier la note" onClick={() => setEditNote({ id: n.id, text: n.text })}>
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton label="Supprimer la note" onClick={() => run(() => api.deleteNote(n.id), 'Note supprimée')}>
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardTitle>Historique</CardTitle>
            <Timeline items={timeline.map((a) => ({ id: a.id, date: a.at, label: a.label, by: a.by }))} />
          </Card>
        </div>
      </div>

      {dialog === 'message' && <MessageDialog open onClose={() => setDialog(null)} prospect={p} />}
      {dialog === 'note' && <NoteDialog open onClose={() => setDialog(null)} prospectId={p.id} />}
      {editNote && <NoteDialog open onClose={() => setEditNote(null)} prospectId={p.id} noteId={editNote.id} initial={editNote.text} />}
      {dialog === 'task' && <TaskDialog open onClose={() => setDialog(null)} prospectId={p.id} />}
      {editTask && <TaskDialog open onClose={() => setEditTask(null)} task={editTask} />}
      {dialog === 'status' && <StatusDialog open onClose={() => setDialog(null)} prospect={p} />}
      <ConfirmDialog
        open={dialog === 'dnc'}
        title="Ne plus contacter ce prospect ?"
        message="Il sera exclu de toute campagne, génération de message et relance. Ses coordonnées sont ajoutées à la liste de suppression pour qu'il ne soit jamais réimporté comme contactable."
        confirmLabel="Ne plus contacter"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await run(() => api.setDoNotContact(p.id, true, 'Demande du prospect (droit d’opposition)'), 'Prospect exclu');
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Supprimer définitivement ?"
        message={
          <>
            <p>La fiche, ses notes, relances et son historique seront effacés.</p>
            <Checkbox checked={suppress} onChange={setSuppress}>
              Ajouter à la liste de suppression (demande RGPD : ne jamais le réimporter)
            </Checkbox>
          </>
        }
        confirmLabel="Supprimer"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await run(() => api.deleteProspects([p.id], suppress), 'Prospect supprimé');
          navigate('/prospects', { replace: true });
        }}
      />
    </>
  );
}

export function Timeline({ items }: { items: { id: string; date: string; label: ReactNode; by?: string }[] }) {
  if (!items.length) return <p className="text-sm text-muted">Aucun événement.</p>;
  return (
    <ol className="relative space-y-3 border-l border-line pl-5">
      {items.map((i) => (
        <li key={i.id} className="relative text-sm">
          <span className="absolute -left-[1.6rem] top-1.5 h-2.5 w-2.5 rounded-full bg-brand ring-4 ring-surface" aria-hidden />
          <p className="text-xs text-muted">
            {formatDateTime(i.date)}
            {i.by && ` · ${i.by}`}
          </p>
          <p className="text-ink">{i.label}</p>
        </li>
      ))}
    </ol>
  );
}
