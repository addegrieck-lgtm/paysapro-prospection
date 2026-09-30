import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  AlarmClock,
  ArrowLeft,
  Ban,
  Check,
  ClipboardPaste,
  Compass,
  EyeOff,
  Globe,
  Lightbulb,
  Mail,
  Pencil,
  Phone,
  RefreshCw,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { Button, ButtonLink, IconButton } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert, ConfirmDialog, Dialog, EmptyState, useToast } from '../components/ui/Feedback';
import { Avatar, Skeleton } from '../components/ui/Extras';
import { Checkbox } from '../components/ui/Form';
import { InfoRow, ScoreBadge, StatusBadge, Value, formatDateShort, formatDateTime, useAction } from '../components/common';
import { MessageDialog, NoteDialog, StatusDialog, TaskDialog } from '../components/dialogs';
import { EnrichmentBadge, LastEnrichment, SourceLine, WebSearchDialog } from '../components/enrichment';
import { ConfidenceBadge, ContactHistoryPanel, ContactSummary, ContactsPanel, EnrichProgress, GoogleCardDialog, SourcesPanel } from '../components/ContactsPanel';
import type { EnrichStage } from '../data/enrichmentEngine';
import { useApp, useCan, useQuery } from '../app/context';
import { computeScore, priorityOf } from '../domain/scoring';
import { contactReasons, prospectingAngle } from '../domain/insights';
import { knowledgeChecklist } from '../domain/enrichment';
import { annuaireEntreprisesUrl, telUrl } from '../domain/links';
import { departmentLabel, regionName } from '../domain/geo';
import { NAF_LABELS, PRIORITY_LABEL, SERVICE_LABEL, TASK_TYPE_LABEL, headcountLabel } from '../domain/referentials';
import { formatPhone } from '../domain/normalize';
import type { Company } from '../providers/company/CompanyDataProvider';
import type { EnrichmentMode, Prospect, ProspectTask, SourceKind } from '../domain/types';

const SOURCE_LABEL: Record<SourceKind, string> = {
  sirene: 'SIRENE (INSEE)',
  search: 'Recherche d’entreprises (données publiques)',
  csv: 'Import CSV',
  manual: 'Saisie manuelle',
  demo: 'Démonstration',
  enrichment: 'Fichier d’enrichissement',
};

/** Ligne d'information avec sa provenance. */
function Sourced({ p, field, label, children, href }: { p: Prospect; field: keyof Prospect; label: string; children: ReactNode; href?: string | null }) {
  return (
    <InfoRow label={label}>
      <Value href={href} external={!!href}>
        {children}
      </Value>
      <SourceLine source={p.fieldSources[field]} />
    </InfoRow>
  );
}

const yesNo = (v: boolean | null) => (v === null ? null : v ? 'Oui' : 'Non');

export function ProspectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { api, companyProvider, engine } = useApp();
  const run = useAction();
  const canEdit = useCan('prospecting.edit');
  const canDelete = useCan('prospecting.delete');
  const { data: prospect, loading } = useQuery((a) => a.getProspect(id), [id]);
  const { data: timeline = [] } = useQuery((a) => a.timeline(id), [id]);
  const { data: notes = [] } = useQuery((a) => a.notesFor(id), [id]);
  const { data: tasks = [] } = useQuery((a) => a.tasksFor(id), [id]);
  const { data: duplicates = [] } = useQuery(async (a) => (await a.listDuplicates('open')).filter((d) => d.prospectIdA === id || d.prospectIdB === id), [id]);
  const [dialog, setDialog] = useState<'message' | 'note' | 'task' | 'status' | 'dnc' | 'delete' | 'web' | 'anonymize' | null>(null);
  const [editNote, setEditNote] = useState<{ id: string; text: string } | null>(null);
  const [editTask, setEditTask] = useState<ProspectTask | null>(null);
  const [suppress, setSuppress] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [found, setFound] = useState<string[] | null>(null);
  const [candidates, setCandidates] = useState<Company[] | null>(null);
  const [mode, setMode] = useState<EnrichmentMode>('normal');
  const [stages, setStages] = useState<EnrichStage[]>([]);
  const [stageDetail, setStageDetail] = useState<string | null>(null);
  const [googleCard, setGoogleCard] = useState(false);
  const toast = useToast();

  if (loading && !prospect) return <Skeleton className="h-64" />;
  if (!prospect)
    return (
      <EmptyState icon={<Search className="h-7 w-7" />} title="Prospect introuvable" action={<ButtonLink to="/prospects">Retour aux prospects</ButtonLink>}>
        Il a peut-être été supprimé ou fusionné avec un doublon.
      </EmptyState>
    );

  const p = prospect;
  const score = computeScore(p);
  const priority = priorityOf(score.score);
  const reasons = contactReasons(p);
  const angle = prospectingAngle(p);
  const tel = telUrl(p.phone);
  const blocked = p.doNotContact || p.demo;
  const checklist = knowledgeChecklist(p);
  const canEnrich = canEdit && !p.demo && !p.anonymized;

  const enrich = async (force: boolean) => {
    setEnriching(true);
    setFound(null);
    setStages([]);
    setStageDetail(null);
    const r = await run(() =>
      engine.enrichCompany(p.id, {
        force,
        mode,
        onProgress: (s, d) => {
          setStages((prev) => (prev.at(-1) === s ? prev : [...prev.filter((x) => x !== s), s]));
          setStageDetail(d ?? null);
        },
      }),
    );
    setEnriching(false);
    if (!r) return;
    if (r.candidates?.length) setCandidates(r.candidates);
    // Notification de fin (§107) : ce qui a été trouvé, sans promesse
    const c = await api.contactsFor(p.id);
    const has = (l: { status: string }[]) => l.some((x) => x.status !== 'rejected');
    toast(`✓ Enrichissement terminé — ${[has(c.phones) ? 'Téléphone trouvé' : 'Téléphone non trouvé', has(c.emails) ? 'E-mail trouvé' : 'E-mail non trouvé', has(c.websites) ? 'Site trouvé' : 'Site non trouvé'].join(' · ')}`);
    const lines = [...(r.error ? [r.error] : []), ...r.details];
    setFound(lines.length ? lines : [`Aucune nouvelle donnée publique trouvée (étapes : ${r.steps.join(', ')}). Utilisez « Réenrichir » pour réinterroger toutes les sources, ou « Rechercher sur le web ».`]);
  };

  return (
    <>
      <Link to="/prospects" className="-ml-2 mb-3 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-medium text-muted hover:bg-surface-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Prospects
      </Link>
      {p.demo && (
        <div className="mb-4">
          <Alert tone="warning" title="DONNÉE DE DÉMONSTRATION">
            Entreprise fictive, générée pour tester l'outil. Elle ne peut pas être contactée ni enrichie.
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
      {duplicates.length > 0 && (
        <div className="mb-4">
          <Alert tone="warning" title="Doublon potentiel">
            Cette fiche ressemble à une autre fiche de votre base.{' '}
            <Link to="/duplicates" className="font-semibold underline">
              Vérifier : fusionner, ignorer ou conserver les deux
            </Link>
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
            <EnrichmentBadge status={p.enrichmentStatus} />
            {p.city && <span className="text-sm text-muted">· {p.city}</span>}
          </div>
          {p.demo && p.phone && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold tabular-nums">
              📞 {formatPhone(p.phone)}
              <ConfidenceBadge value={p.phoneConfidence} status={p.phoneStatus} />
            </p>
          )}
          {!p.demo && <ContactSummary prospect={p} blocked={blocked} />}
          <p className="mt-1 text-sm">
            <LastEnrichment at={p.enrichedAt} />
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {canEnrich && (
          <>
            <Button size="lg" icon={<Sparkles className="h-5 w-5" />} onClick={() => enrich(false)} disabled={enriching}>
              {enriching ? 'Enrichissement…' : '🚀 ENRICHIR'}
            </Button>
            <label className="flex items-center gap-1 text-sm text-muted">
              <span className="sr-only">Mode de recherche</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as EnrichmentMode)} disabled={enriching} className="min-h-11 rounded-xl border border-line bg-surface px-2 text-sm text-ink">
                <option value="fast">Rapide (site, téléphone, e-mail)</option>
                <option value="normal">Normal (équilibré)</option>
                <option value="max">Maximum contact</option>
              </select>
            </label>
            {p.contactsCheckedAt && (
              <Button variant="secondary" icon={<RefreshCw className="h-5 w-5" />} onClick={() => enrich(true)} disabled={enriching}>
                Réenrichir
              </Button>
            )}
            <Button variant="secondary" icon={<ClipboardPaste className="h-5 w-5" />} onClick={() => setGoogleCard(true)} disabled={enriching}>
              Coller une fiche Google
            </Button>
          </>
        )}
        {tel && !blocked && (
          <a href={tel} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
            <Phone className="h-5 w-5" aria-hidden /> Appeler
          </a>
        )}
        <Button variant="secondary" icon={<Mail className="h-5 w-5" />} disabled={blocked} onClick={() => setDialog('message')}>
          E-mail / message
        </Button>
        <Button variant="secondary" icon={<Search className="h-5 w-5" />} onClick={() => setDialog('web')}>
          Rechercher sur le web
        </Button>
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
              Compléter manuellement
            </ButtonLink>
          </>
        )}
      </div>

      {enriching && <EnrichProgress stages={stages} detail={stageDetail} />}
      {googleCard && (
        <GoogleCardDialog
          prospect={p}
          onClose={() => setGoogleCard(false)}
          onSaved={() => {
            setGoogleCard(false);
            // Le site collé est lu et vérifié, l'e-mail et les autres numéros recherchés
            void enrich(true);
          }}
        />
      )}
      {found && (
        <div className="mb-4">
          <Alert tone={p.enrichmentStatus === 'failed' ? 'warning' : 'success'} title={p.enrichmentStatus === 'failed' ? 'Enrichissement impossible' : 'Résultat de l’enrichissement'}>
            <ul className="mt-1 space-y-0.5">
              {found.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {canEnrich && p.enrichedAt && (
              <button type="button" onClick={() => enrich(true)} className="mt-2 font-semibold underline">
                Réenrichir (vérifier à nouveau toutes les sources)
              </button>
            )}
          </Alert>
        </div>
      )}
      {!found && p.enrichmentStatus === 'failed' && p.enrichmentError && (
        <div className="mb-4">
          <Alert tone="warning" title="Dernier enrichissement : échec">
            {p.enrichmentError}
          </Alert>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Colonne gauche : informations */}
        <div className="space-y-4">
          <ContactsPanel prospect={p} />

          <Card>
            <CardTitle>Ce que l'application connaît</CardTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <ul className="space-y-1 text-sm">
                {checklist.known.map((k) => (
                  <li key={k} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-success" aria-hidden /> {k}
                  </li>
                ))}
              </ul>
              <ul className="space-y-1 text-sm">
                {checklist.missing.map((k) => (
                  <li key={k} className="flex items-center gap-2 text-muted">
                    <TriangleAlert className="h-4 w-4 shrink-0 text-warning" aria-hidden /> {k} non trouvé
                  </li>
                ))}
              </ul>
            </div>
            {checklist.missing.length > 0 && canEdit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="soft" icon={<Search className="h-4 w-4" />} onClick={() => setDialog('web')}>
                  Rechercher sur le web
                </Button>
                <ButtonLink size="sm" variant="ghost" to={`/prospects/${p.id}/edit`}>
                  Compléter manuellement
                </ButtonLink>
              </div>
            )}
          </Card>

          <Card>
            <CardTitle>Score : {score.score}/100</CardTitle>
            <p className="mb-2 text-sm font-medium text-ink">Pourquoi ce score ?</p>
            <ul className="space-y-1 text-sm">
              {score.reasons.map((r) => (
                <li key={r.label} className="flex gap-2">
                  <span className="w-9 shrink-0 font-semibold tabular-nums text-success">+{r.points}</span>
                  {r.label}
                </li>
              ))}
              {score.missing.map((m) => (
                <li key={m} className="flex gap-2 text-muted">
                  <span className="w-9 shrink-0 font-semibold">−</span>
                  {m}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Critères objectifs uniquement. Catégorie interne de prospection, pas un jugement sur l'entreprise.</p>
          </Card>

          <Card>
            <CardTitle action={<EnrichmentBadge status={p.enrichmentStatus} short />}>🔎 Données enrichies</CardTitle>
            <h3 className="mb-1 mt-1 text-xs font-semibold uppercase tracking-wide text-muted">Identité</h3>
            <dl>
              <Sourced p={p} field="name" label="Raison sociale">
                {p.name}
              </Sourced>
              <Sourced p={p} field="tradeName" label="Nom commercial">
                {p.tradeName}
              </Sourced>
              <Sourced p={p} field="siren" label="SIREN" href={annuaireEntreprisesUrl(p.siren)}>
                {p.siren}
              </Sourced>
              <Sourced p={p} field="siret" label="SIRET">
                {p.siret}
              </Sourced>
              <Sourced p={p} field="active" label="Statut">
                {p.active === null ? null : p.active ? 'Actif' : 'Fermé'}
              </Sourced>
            </dl>
            <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Activité</h3>
            <dl>
              <Sourced p={p} field="nafCode" label="Code NAF">
                {p.nafCode ? `${p.nafCode}${NAF_LABELS[p.nafCode] ? ` — ${NAF_LABELS[p.nafCode]}` : ''}` : null}
              </Sourced>
              <Sourced p={p} field="activity" label="Activité">
                {p.activity}
              </Sourced>
              <Sourced p={p} field="creationDate" label="Date de création">
                {p.creationDate ? formatDateShort(p.creationDate) : null}
              </Sourced>
              <Sourced p={p} field={p.headcount !== null ? 'headcount' : 'headcountBand'} label="Tranche d'effectif">
                {p.headcount !== null || p.headcountBand ? headcountLabel(p.headcountBand, p.headcount) : null}
              </Sourced>
            </dl>
            <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Localisation</h3>
            <dl>
              <Sourced p={p} field="address" label="Adresse">
                {p.address}
              </Sourced>
              <Sourced p={p} field="postalCode" label="Code postal">
                {p.postalCode}
              </Sourced>
              <Sourced p={p} field="city" label="Ville">
                {p.city}
              </Sourced>
              <Sourced p={p} field="department" label="Département">
                {p.department ? departmentLabel(p.department) : null}
              </Sourced>
              <Sourced p={p} field="region" label="Région">
                {regionName(p.region)}
              </Sourced>
            </dl>
            {(p.isHeadOffice !== null || p.legalForm || p.companyCategory || p.openEstablishments !== null || p.employer !== null) && (
              <>
                <h3 className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Informations complémentaires</h3>
                <dl>
                  {p.legalForm && (
                    <Sourced p={p} field="legalForm" label="Forme juridique">
                      {p.legalForm}
                    </Sourced>
                  )}
                  {p.isHeadOffice !== null && (
                    <Sourced p={p} field="isHeadOffice" label="Siège">
                      {yesNo(p.isHeadOffice)}
                    </Sourced>
                  )}
                  {p.companyCategory && (
                    <Sourced p={p} field="companyCategory" label="Catégorie">
                      {p.companyCategory}
                    </Sourced>
                  )}
                  {p.openEstablishments !== null && (
                    <Sourced p={p} field="openEstablishments" label="Établissements ouverts">
                      {p.openEstablishments}
                    </Sourced>
                  )}
                  {p.employer !== null && (
                    <Sourced p={p} field="employer" label="Employeur">
                      {yesNo(p.employer)}
                    </Sourced>
                  )}
                </dl>
              </>
            )}
            {p.individual && (
              <p className="mt-3 rounded-xl bg-info-soft p-3 text-xs text-info">
                Entrepreneur individuel : le nom et l'adresse désignent une personne physique. Ce sont des données personnelles (RGPD) : informez-le de l'origine des données et
                respectez son droit d'opposition.
              </p>
            )}
          </Card>

          <Card>
            <CardTitle action={<Button size="sm" variant="ghost" icon={<Search className="h-4 w-4" />} onClick={() => setDialog('web')}>Rechercher</Button>}>
              Présence en ligne et activité
            </CardTitle>
            <p className="mb-2 text-xs text-muted">Téléphones, e-mails et sites : voir « Contact ». Ces informations ne figurent jamais dans les données officielles : annuaire public, site de l'entreprise, import CSV ou saisie après une recherche web.</p>
            <dl>
              <Sourced p={p} field="googleUrl" label="Google Business" href={p.googleUrl}>
                {p.googleUrl ? 'Voir la fiche' : null}
              </Sourced>
              <Sourced p={p} field="googleReviews" label="Nombre d'avis">
                {p.googleReviews}
              </Sourced>
              <Sourced p={p} field="googleRating" label="Note">
                {p.googleRating !== null ? `${String(p.googleRating).replace('.', ',')} / 5` : null}
              </Sourced>
              <Sourced p={p} field="facebook" label="Facebook" href={p.facebook}>
                {p.facebook ? 'Profil' : null}
              </Sourced>
              <Sourced p={p} field="instagram" label="Instagram" href={p.instagram}>
                {p.instagram ? 'Profil' : null}
              </Sourced>
              <Sourced p={p} field="linkedin" label="LinkedIn" href={p.linkedin}>
                {p.linkedin ? 'Profil' : null}
              </Sourced>
              <Sourced p={p} field="description" label="Description">
                {p.description}
              </Sourced>
              <Sourced p={p} field="services" label="Services">
                {p.services.map((s) => SERVICE_LABEL[s]).join(', ') || null}
              </Sourced>
              <Sourced p={p} field="interventionArea" label="Zone d'intervention">
                {p.interventionArea}
              </Sourced>
              <InfoRow label="Contact">
                <Value>{[p.contactFirstName, p.contactLastName].filter(Boolean).join(' ') || null}</Value>
              </InfoRow>
              <InfoRow label="Responsable">
                <Value>{p.owner}</Value>
              </InfoRow>
            </dl>
          </Card>

          <Card>
            <CardTitle>Origine de la donnée (RGPD)</CardTitle>
            <dl>
              <InfoRow label="Source">
                <Value>{SOURCE_LABEL[p.source]}</Value>
              </InfoRow>
              <InfoRow label="URL source">
                <Value href={p.sourceUrl} external>
                  {p.sourceUrl ? 'Consulter' : null}
                </Value>
              </InfoRow>
              <InfoRow label="Date de collecte">
                <Value>{formatDateShort(p.dateCollected)}</Value>
              </InfoRow>
              <InfoRow label="Dernière vérification">
                <Value>{p.lastVerifiedAt ? formatDateShort(p.lastVerifiedAt) : null}</Value>
              </InfoRow>
            </dl>
            {canEdit && !p.demo && !p.anonymized && (
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
              <div className="mt-2 flex flex-wrap gap-1">
                {!p.anonymized && !p.demo && (
                  <Button variant="ghost" icon={<EyeOff className="h-5 w-5" />} onClick={() => setDialog('anonymize')}>
                    Anonymiser
                  </Button>
                )}
                <Button variant="ghost" icon={<Trash2 className="h-5 w-5" />} onClick={() => setDialog('delete')} className="text-danger">
                  Supprimer ce prospect
                </Button>
              </div>
            )}
          </Card>
        </div>

        {/* Colonne droite : intelligence, tâches, notes, historique */}
        <div className="space-y-4">
          <SourcesPanel prospect={p} />
          <ContactHistoryPanel prospectId={p.id} />

          <Card>
            <CardTitle icon={<Lightbulb className="h-5 w-5" />}>Pourquoi contacter cette entreprise ?</CardTitle>
            {reasons.length ? (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Pas encore assez de données. Enrichissez la fiche puis vérifiez sa présence sur le web.</p>
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
                      <p className="text-muted">
                        Priorité {PRIORITY_LABEL[t.priority].toLowerCase()}
                        {t.note && ` · ${t.note}`}
                      </p>
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
            <Timeline items={timeline.map((a) => ({ id: a.id, date: a.at, label: a.label, by: a.by, details: a.details }))} />
          </Card>
        </div>
      </div>

      {dialog === 'message' && <MessageDialog open onClose={() => setDialog(null)} prospect={p} />}
      {dialog === 'note' && <NoteDialog open onClose={() => setDialog(null)} prospectId={p.id} />}
      {dialog === 'web' && <WebSearchDialog open onClose={() => setDialog(null)} prospect={p} />}
      {editNote && <NoteDialog open onClose={() => setEditNote(null)} prospectId={p.id} noteId={editNote.id} initial={editNote.text} />}
      {dialog === 'task' && <TaskDialog open onClose={() => setDialog(null)} prospectId={p.id} />}
      {editTask && <TaskDialog open onClose={() => setEditTask(null)} task={editTask} />}
      {dialog === 'status' && <StatusDialog open onClose={() => setDialog(null)} prospect={p} />}
      {candidates && (
        <Dialog open onClose={() => setCandidates(null)} title="Plusieurs entreprises possibles">
          <p className="mb-3 text-sm text-muted">La recherche par nom et localisation renvoie plusieurs entreprises. Choisissez la bonne (vérifiez le SIREN) : la fiche sera enrichie avec ses données officielles.</p>
          <ul className="space-y-2">
            {candidates.map((c) => {
              const est = c.matching[0] ?? c.headOffice;
              return (
                <li key={c.siren}>
                  <button
                    type="button"
                    disabled={!est}
                    onClick={async () => {
                      setCandidates(null);
                      const r = await run(() => api.chooseCompany(p.id, est!.siret, companyProvider), 'Entreprise associée');
                      if (r?.application) setFound(r.application.details);
                    }}
                    className="w-full rounded-xl border border-line p-3 text-left hover:border-brand/50 disabled:opacity-50"
                  >
                    <span className="block font-semibold">{c.name}</span>
                    <span className="text-sm text-muted">
                      SIREN {c.siren} · {[est?.address, est?.postalCode, est?.city].filter(Boolean).join(' ')} · {c.active ? 'active' : 'fermée'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Dialog>
      )}
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
        open={dialog === 'anonymize'}
        title="Anonymiser ce prospect ?"
        message={
          <>
            <p>Les données personnelles (contact, e-mail, téléphone, réseaux{p.individual !== false ? ', nom, adresse et identifiants de l’entrepreneur individuel' : ''}) ainsi que les notes et relances seront effacées.</p>
            <p>Les données d'entreprise non personnelles (activité, commune, statistiques) sont conservées. Le prospect est définitivement exclu de la prospection.</p>
          </>
        }
        confirmLabel="Anonymiser"
        danger
        onClose={() => setDialog(null)}
        onConfirm={async () => {
          await run(() => api.anonymizeProspect(p.id), 'Prospect anonymisé');
          setDialog(null);
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        title="Supprimer définitivement ?"
        message={
          <>
            <p>La fiche, ses notes, relances, historique et journaux d'enrichissement seront effacés.</p>
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

export function Timeline({ items }: { items: { id: string; date: string; label: ReactNode; by?: string; details?: string[] }[] }) {
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
          {i.details && i.details.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs text-muted">
              {i.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}
