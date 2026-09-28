// Campagnes : segment → aperçu → messages générés → validation manuelle → envoi un par un depuis ma messagerie.
// Aucun envoi automatique en masse.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronDown, Mail, Plus, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, CardTitle, Badge } from '../components/ui/Card';
import { Alert, ConfirmDialog, EmptyState } from '../components/ui/Feedback';
import { Checkbox, SelectField, TextField } from '../components/ui/Form';
import { Skeleton } from '../components/ui/Extras';
import { CopyButton, formatDateShort, nf, pctFmt, useAction } from '../components/common';
import { useApp, useCan, useQuery } from '../app/context';
import { describeFilter } from '../domain/filters';
import { mailtoUrl } from '../domain/links';
import { TEMPLATE_CATEGORY_LABEL } from '../domain/referentials';
import type { Campaign, CampaignRecipient, ExclusionReason, RecipientState } from '../domain/types';

const STATUS: Record<Campaign['status'], { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' }> = {
  draft: { label: 'Brouillon', tone: 'neutral' },
  validated: { label: 'Validée', tone: 'info' },
  running: { label: 'En cours', tone: 'warning' },
  done: { label: 'Terminée', tone: 'success' },
};

const EXCLUSION: Record<ExclusionReason, string> = {
  do_not_contact: 'Ne plus contacter',
  suppression: 'Liste de suppression',
  no_email: 'Sans e-mail',
  demo: 'Donnée de démonstration',
  client: 'Déjà client',
};

export function CampaignsPage() {
  const canCampaign = useCan('prospecting.campaign');
  const [creating, setCreating] = useState(false);
  const { data } = useQuery(async (a) => {
    const campaigns = await a.listCampaigns();
    return Promise.all(
      campaigns.map(async (c) => {
        const prospects = await a.getProspects(c.recipients.map((r) => r.prospectId));
        return {
          c,
          stats: {
            prospects: c.recipients.length,
            contacts: c.recipients.filter((r) => r.state === 'sent' || r.state === 'replied').length,
            replies: prospects.filter((p) => p.milestones.replied).length,
            demos: prospects.filter((p) => p.milestones.demo).length,
            clients: prospects.filter((p) => p.milestones.client).length,
          },
        };
      }),
    );
  }, []);

  if (creating) return <NewCampaign onCancel={() => setCreating(false)} />;

  return (
    <>
      <PageHeader title="Campagnes" subtitle="Prospection par segment, avec aperçu et validation avant chaque envoi." actions={canCampaign && <Button size="sm" icon={<Plus className="h-5 w-5" />} onClick={() => setCreating(true)}>Nouvelle</Button>} />
      {data && data.length === 0 && (
        <EmptyState icon={<Mail className="h-7 w-7" />} title="Aucune campagne" action={canCampaign && <Button onClick={() => setCreating(true)}>Créer une campagne</Button>}>
          Sélectionnez un segment, prévisualisez les messages, validez, puis envoyez-les depuis votre propre messagerie.
        </EmptyState>
      )}
      <ul className="space-y-3">
        {data?.map(({ c, stats }) => (
          <li key={c.id}>
            <Link to={`/campaigns/${c.id}`} className="block rounded-2xl border border-line bg-surface p-4 shadow-card hover:border-brand/40">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{c.name}</h2>
                <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                {c.testMode && <Badge tone="warning">Mode test</Badge>}
                <span className="ml-auto text-xs text-muted">{formatDateShort(c.createdAt)}</span>
              </div>
              <dl className="mt-3 grid grid-cols-5 gap-2 text-center text-xs text-muted">
                {(
                  [
                    ['Prospects', stats.prospects],
                    ['Contacts', stats.contacts],
                    ['Réponses', stats.replies],
                    ['Démos', stats.demos],
                    ['Clients', stats.clients],
                  ] as const
                ).map(([l, v]) => (
                  <div key={l}>
                    <dd className="text-lg font-bold tabular-nums text-ink">{nf.format(v)}</dd>
                    <dt>{l}</dt>
                  </div>
                ))}
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function NewCampaign({ onCancel }: { onCancel: () => void }) {
  const { api, settings } = useApp();
  const run = useAction();
  const navigate = useNavigate();
  const { data: segments = [] } = useQuery((a) => a.listSegments(), []);
  const { data: templates = [] } = useQuery((a) => a.listTemplates(), []);
  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [testMode, setTestMode] = useState(settings.testMode);
  const segment = segments.find((s) => s.id === segmentId);
  const tplId = templateId || templates.find((t) => t.category === 'first_contact')?.id || templates[0]?.id || '';
  const { data: preview } = useQuery((a) => (segment ? a.previewCampaign(segment.filter) : Promise.resolve(null)), [segment]);
  const { data: todayCount = 0 } = useQuery((a) => a.contactsToday(), []);

  return (
    <>
      <PageHeader title="Nouvelle campagne" back="/campaigns" />
      <div className="space-y-4">
        <Card>
          <CardTitle>1. Segment et message</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Nom de la campagne" value={name} onChange={setName} placeholder={segment ? `${segment.name} — ${new Date().toLocaleDateString('fr-FR')}` : 'Ex. Paysagistes Normandie'} />
            <SelectField label="Segment" value={segmentId} onChange={setSegmentId} options={[{ value: '', label: segments.length ? 'Choisir un segment…' : 'Créez d’abord un segment' }, ...segments.map((s) => ({ value: s.id, label: s.name }))]} />
            <SelectField label="Modèle de message" value={tplId} onChange={setTemplateId} options={templates.map((t) => ({ value: t.id, label: `${t.name} — ${TEMPLATE_CATEGORY_LABEL[t.category]}` }))} />
            <div className="self-end">
              <Checkbox checked={testMode} onChange={setTestMode}>
                Mode test : tous les messages sont adressés à {settings.adminEmail || 'votre adresse (à renseigner dans Paramètres)'}
              </Checkbox>
            </div>
          </div>
          {segments.length === 0 && (
            <p className="mt-3 text-sm">
              <Link to="/segments" className="font-semibold text-brand hover:underline">Créer un segment →</Link>
            </p>
          )}
        </Card>

        {segment && preview && (
          <Card>
            <CardTitle>2. Aperçu</CardTitle>
            <p className="mb-3 text-sm text-muted">{describeFilter(segment.filter)}</p>
            <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
              <Count label="Destinataires" value={preview.counts.recipients} strong />
              <Count label="Exclus (total)" value={preview.counts.excluded} />
              <Count label="« Ne plus contacter »" value={preview.counts.doNotContact} />
              <Count label="Sans e-mail" value={preview.counts.noEmail} />
              <Count label="Données manquantes (ville / activité)" value={preview.counts.missingData} />
              <Count label="Démo / déjà clients" value={preview.counts.demo + preview.counts.clients} />
            </ul>
            {preview.counts.recipients > settings.dailyContactLimit - todayCount && (
              <div className="mt-3">
                <Alert tone="warning" title="Limite de sécurité">
                  {nf.format(preview.counts.recipients)} destinataires pour {nf.format(Math.max(0, settings.dailyContactLimit - todayCount))} envoi(s) restant(s) aujourd'hui (limite : {settings.dailyContactLimit}/jour). La campagne s'étalera sur plusieurs jours.
                </Alert>
              </div>
            )}
            {testMode && !settings.adminEmail && (
              <div className="mt-3">
                <Alert tone="danger">Mode test : renseignez votre adresse e-mail dans Paramètres.</Alert>
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={onCancel}>
                Annuler
              </Button>
              <Button
                disabled={!preview.counts.recipients || !tplId}
                onClick={async () => {
                  const c = await run(() => api.createCampaign({ name: name || `${segment.name} — ${new Date().toLocaleDateString('fr-FR')}`, segmentId: segment.id, filter: segment.filter, templateId: tplId, testMode }), 'Messages générés');
                  if (c) navigate(`/campaigns/${c.id}`);
                }}
              >
                Générer les {nf.format(preview.counts.recipients)} messages
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

function Count({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <li className={`rounded-xl p-3 ${strong ? 'bg-brand-soft text-brand' : 'bg-surface-2'}`}>
      <span className="block text-xl font-bold tabular-nums">{nf.format(value)}</span>
      <span className={strong ? '' : 'text-muted'}>{label}</span>
    </li>
  );
}

export function CampaignPage() {
  const { id = '' } = useParams();
  const { api, settings } = useApp();
  const run = useAction();
  const navigate = useNavigate();
  const { data: c, loading } = useQuery((a) => a.getCampaign(id), [id]);
  const { data: todayCount = 0 } = useQuery((a) => a.contactsToday(), []);
  const [confirm, setConfirm] = useState(false);
  const [remove, setRemove] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | RecipientState>('all');

  if (loading && !c) return <Skeleton className="h-64" />;
  if (!c) return <EmptyState icon={<Mail className="h-7 w-7" />} title="Campagne introuvable" />;

  const count = (s: RecipientState) => c.recipients.filter((r) => r.state === s).length;
  const sent = count('sent') + count('replied');
  const list = filter === 'all' ? c.recipients : c.recipients.filter((r) => r.state === filter);
  const to = (r: CampaignRecipient) => (c.testMode ? settings.adminEmail : (r.email ?? ''));
  const mark = (r: CampaignRecipient, s: RecipientState, msg: string) => run(() => api.markRecipient(c.id, r.prospectId, s), msg);

  return (
    <>
      <PageHeader title={c.name} subtitle={`${nf.format(c.recipients.length)} destinataires · ${nf.format(c.excluded.length)} exclus`} back="/campaigns" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
        {c.testMode && <Badge tone="warning">Mode test → {settings.adminEmail || 'adresse non renseignée'}</Badge>}
        <Badge>
          Aujourd'hui : {todayCount} / {settings.dailyContactLimit} contacts
        </Badge>
      </div>

      {c.status === 'draft' ? (
        <Card className="mb-4">
          <CardTitle icon={<ShieldCheck className="h-5 w-5" />}>3. Validation</CardTitle>
          <p className="mb-3 text-sm text-muted">Relisez quelques messages ci-dessous (cliquez pour les déplier). Rien n'est envoyé tant que vous n'avez pas validé, puis ouvert chaque message dans votre messagerie.</p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setConfirm(true)}>Valider la campagne</Button>
            <Button variant="ghost" className="text-danger" onClick={() => setRemove(true)}>
              Supprimer
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="grid grid-cols-2 gap-2 text-center text-sm sm:grid-cols-4">
            <div>
              <p className="text-xl font-bold tabular-nums">{nf.format(count('pending') + count('opened'))}</p>
              <p className="text-muted">À envoyer</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{nf.format(sent)}</p>
              <p className="text-muted">Envoyés</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{nf.format(count('replied'))}</p>
              <p className="text-muted">Réponses ({pctFmt(sent ? (count('replied') / sent) * 100 : null)})</p>
            </div>
            <div>
              <p className="text-xl font-bold tabular-nums">{nf.format(count('skipped'))}</p>
              <p className="text-muted">Ignorés</p>
            </div>
          </div>
        </Card>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {(['all', 'pending', 'opened', 'sent', 'replied', 'skipped'] as const).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={`min-h-10 rounded-full border px-3 text-sm ${filter === s ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface'}`}>
            {{ all: 'Tous', pending: 'À envoyer', opened: 'Ouverts', sent: 'Envoyés', replied: 'Réponses', skipped: 'Ignorés' }[s]}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.prospectId} className="rounded-2xl border border-line bg-surface shadow-card">
            <button type="button" onClick={() => setOpen(open === r.prospectId ? null : r.prospectId)} aria-expanded={open === r.prospectId} className="flex w-full items-center gap-3 p-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{r.name}</span>
                <span className="block truncate text-sm text-muted">{r.email ?? 'E-mail non disponible'} · {r.subject}</span>
              </span>
              <Badge tone={r.state === 'sent' ? 'success' : r.state === 'replied' ? 'accent' : r.state === 'skipped' ? 'neutral' : r.state === 'opened' ? 'info' : 'warning'}>
                {{ pending: 'À envoyer', opened: 'Ouvert', sent: 'Envoyé', replied: 'Réponse', skipped: 'Ignoré' }[r.state]}
              </Badge>
              <ChevronDown className={`h-5 w-5 text-muted transition-transform ${open === r.prospectId ? 'rotate-180' : ''}`} aria-hidden />
            </button>
            {open === r.prospectId && (
              <div className="space-y-3 border-t border-line p-3">
                <p className="text-sm">
                  <strong>Objet :</strong> {r.subject}
                </p>
                <pre className="whitespace-pre-wrap rounded-xl bg-surface-2 p-3 font-sans text-sm">{r.body}</pre>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={r.subject} label="Copier l'objet" />
                  <CopyButton text={r.body} label="Copier le message" />
                  <CopyButton text={r.email} label="Copier l'e-mail" />
                  <Link to={`/prospects/${r.prospectId}`} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-medium text-brand hover:bg-brand-soft">
                    Voir la fiche
                  </Link>
                </div>
                {c.status !== 'draft' && (
                  <div className="flex flex-wrap gap-2">
                    {to(r) ? (
                      <a
                        href={mailtoUrl(to(r), r.subject, r.body)}
                        onClick={() => r.state === 'pending' && mark(r, 'opened', '')}
                        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong"
                      >
                        <Mail className="h-5 w-5" aria-hidden /> Ouvrir dans mon e-mail
                      </a>
                    ) : (
                      <span className="self-center text-sm text-muted">{c.testMode ? 'Renseignez votre adresse dans Paramètres.' : 'Pas d’e-mail : copiez le message.'}</span>
                    )}
                    {r.state !== 'sent' && r.state !== 'replied' && (
                      <Button variant="soft" onClick={() => mark(r, 'sent', c.testMode ? 'Envoi test enregistré' : 'Contact enregistré')}>
                        Marquer comme envoyé
                      </Button>
                    )}
                    {r.state === 'sent' && (
                      <Button variant="secondary" onClick={() => mark(r, 'replied', 'Réponse enregistrée')}>
                        Réponse reçue
                      </Button>
                    )}
                    {r.state === 'pending' && (
                      <Button variant="ghost" onClick={() => mark(r, 'skipped', 'Destinataire ignoré')}>
                        Ignorer
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {c.excluded.length > 0 && (
        <details className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <summary className="cursor-pointer font-semibold">Prospects exclus ({c.excluded.length})</summary>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-sm">
            {c.excluded.map((e) => (
              <li key={e.prospectId} className="flex justify-between gap-2">
                <span>{e.name}</span>
                <span className="text-muted">{EXCLUSION[e.reason]}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ConfirmDialog
        open={confirm}
        title="Valider la campagne ?"
        message={
          <>
            <p>
              <strong>{nf.format(c.recipients.length)}</strong> destinataires, <strong>{nf.format(c.excluded.length)}</strong> exclus ({nf.format(c.excluded.filter((e) => e.reason === 'do_not_contact' || e.reason === 'suppression').length)} « Ne plus contacter », {nf.format(c.excluded.filter((e) => e.reason === 'no_email').length)} sans e-mail).
            </p>
            <p>{c.testMode ? `Mode test : chaque message s'ouvrira adressé à ${settings.adminEmail || '(adresse à renseigner)'}.` : 'Chaque message s’ouvrira dans votre messagerie, adressé au prospect. Vous l’envoyez vous-même, un par un.'}</p>
            <p>Limite de sécurité : {settings.dailyContactLimit} contacts par jour.</p>
          </>
        }
        confirmLabel="Je confirme"
        onClose={() => setConfirm(false)}
        onConfirm={async () => {
          await run(() => api.validateCampaign(c.id), 'Campagne validée');
          setConfirm(false);
        }}
      />
      <ConfirmDialog
        open={remove}
        title="Supprimer cette campagne ?"
        message="Les prospects et leur historique sont conservés."
        confirmLabel="Supprimer"
        danger
        onClose={() => setRemove(false)}
        onConfirm={async () => {
          await run(() => api.deleteCampaign(c.id), 'Campagne supprimée');
          navigate('/campaigns', { replace: true });
        }}
      />
    </>
  );
}
