// Assistant commercial : aide à l'appel (script, pitch, objections, questions), messages (e-mail HTML, SMS,
// WhatsApp, LinkedIn), fin d'appel (résultat, note, relance) et suivi. Ouvert seul (/assistant) ou depuis une
// fiche prospect (/assistant/:id) : les informations connues du prospect sont alors reprises automatiquement.
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowDown, Download, Mail, Phone, Search, Send, Settings2, Sparkles } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, CardTitle, Badge } from '../components/ui/Card';
import { Alert, ConfirmDialog, EmptyState, useToast } from '../components/ui/Feedback';
import { Checkbox, Chip, Segmented, SelectField, TextArea, TextField } from '../components/ui/Form';
import { Skeleton } from '../components/ui/Extras';
import { CopyButton, StatusBadge, copyText, formatDateTime, nf, useAction } from '../components/common';
import { AnswerCard, ReadinessBadge, ReadinessChecks } from '../components/sales';
import { useApp, useCan, useDebounced, useQuery } from '../app/context';
import { mailtoUrl, telUrl } from '../domain/links';
import { formatPhone, normText } from '../domain/normalize';
import { STATUS_LABEL, TASK_TYPES, TASK_TYPE_LABEL } from '../domain/referentials';
import { downloadText } from '../data/export';
import { salesAssistant, SALES_AI_TASKS, type SalesAiTask } from '../providers/salesAssistant';
import { AppsScriptEmailProvider, OPT_OUT_LINE } from '../providers/gmail';
import {
  CALL_OUTCOMES,
  KB_CATEGORIES,
  KB_CATEGORY_LABEL,
  OUTCOME,
  buildEmail,
  dynamicAnswer,
  emailHtml,
  emailImage,
  emailLinks,
  emailText,
  entryAnswer,
  introScript,
  personalizationFor,
  readiness,
  riskyWording,
  safeUrl,
  salesConfig,
  salesFunnel,
  salesVars,
  say,
  searchKb,
  smsUrl,
  treeChildren,
  whatsappUrl,
  type CallOutcome,
  type CallSituation,
  type KbCategory,
  type Personalization,
} from '../domain/sales';
import type { TaskType } from '../domain/types';

type View = 'intro' | 'pitch30' | 'present' | 'question' | 'objection' | 'tarif' | 'fonctionnement' | 'rgpd' | 'rdv' | 'send' | 'args' | 'suivi';
type Mode = 'beginner' | 'expert';
type Channel = 'email' | 'sms' | 'whatsapp' | 'linkedin';

const MODE_KEY = 'paysapro.assistant.mode';
function readMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'expert' ? 'expert' : 'beginner';
  } catch {
    return 'beginner';
  }
}

const GROUPS: Partial<Record<View, KbCategory[]>> = {
  fonctionnement: ['fonctionnalites', 'devis', 'chantiers', 'ia', 'prospection', 'enrichissement', 'crm'],
  rgpd: ['donnees', 'sources', 'rgpd', 'securite', 'limites'],
};

function localInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dueIn(days: number): string {
  const d = new Date();
  if (days === 0) d.setHours(d.getHours() + 1, 0, 0, 0);
  else {
    d.setDate(d.getDate() + days);
    d.setHours(9, 0, 0, 0);
  }
  return localInput(d);
}

async function copyRich(html: string, text: string): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]);
    return true;
  } catch {
    return copyText(text);
  }
}

export function AssistantPage() {
  const { id } = useParams();
  return <Assistant key={id ?? 'none'} id={id} />;
}

function Assistant({ id }: { id?: string }) {
  const { api, settings } = useApp();
  const run = useAction();
  const toast = useToast();
  const navigate = useNavigate();
  const canEdit = useCan('prospecting.edit');
  const canAdmin = useCan('assistant.admin');
  const cfg = useMemo(() => salesConfig(settings), [settings]);

  const { data, loading } = useQuery(
    async (a) => {
      if (!id) return null;
      const prospect = await a.getProspect(id);
      if (!prospect) return null;
      const [notes, tasks, timeline] = await Promise.all([a.notesFor(id), a.tasksFor(id), a.timeline(id)]);
      return { prospect, notes, tasks, timeline };
    },
    [id],
  );
  const p = data?.prospect ?? null;
  const blocked = !!p && (p.doNotContact || p.demo);

  const [mode, setModeState] = useState<Mode>(readMode);
  const expert = mode === 'expert';
  const [view, setView] = useState<View>(expert ? 'pitch30' : 'intro');
  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // stockage indisponible : le choix vaut pour cette session
    }
    if (m === 'expert' && !['pitch30', 'objection', 'tarif', 'rdv'].includes(view)) setView('pitch30');
  };

  // Personnalisation : pré-remplie depuis la fiche, modifiable sans toucher au CRM
  const [over, setOver] = useState<Partial<Personalization>>({});
  const [situation, setSituation] = useState<CallSituation>('none');
  const [resume, setResume] = useState('');
  const per: Personalization = { ...personalizationFor(p, settings, cfg), ...over };
  const vars = salesVars(per, cfg, { resume: resume.trim() || null });
  const setPer = <K extends keyof Personalization>(k: K) => (v: Personalization[K]) => setOver((o) => ({ ...o, [k]: v }));

  // Zone de rédaction
  const [channel, setChannel] = useState<Channel>('email');
  const [templateId, setTemplateId] = useState(cfg.emails[0]?.id ?? '');
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [msgDraft, setMsgDraft] = useState<Partial<Record<Exclude<Channel, 'email'>, string>>>({});
  const [preview, setPreview] = useState(false);
  const [aiTask, setAiTask] = useState<SalesAiTask>('rephrase');
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const tpl = cfg.emails.find((t) => t.id === templateId) ?? cfg.emails[0];
  const email = draft ?? (tpl ? buildEmail(tpl, vars) : { subject: '', body: '' });
  const message = channel === 'email' ? '' : (msgDraft[channel] ?? say(cfg.messages[channel], vars));

  const use = (text: string) => {
    if (channel === 'email') {
      // Le texte s'insère avant la signature lorsqu'il y en a une
      const sig = per.signature.trim();
      const body = sig && email.body.endsWith(sig) ? `${email.body.slice(0, -sig.length).trimEnd()}\n\n${text}\n\n${sig}` : email.body ? `${email.body}\n\n${text}` : text;
      setDraft({ subject: email.subject, body });
    } else setMsgDraft((d) => ({ ...d, [channel]: message ? `${message} ${text}` : text }));
    toast('Ajouté à la zone de rédaction (✉️ Envoyer)');
  };

  // Arbre de conversation, objections, recherche
  const [path, setPath] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [question, setQuestion] = useState('');
  const [category, setCategory] = useState<KbCategory | 'faq'>('faq');
  const [objectionQuery, setObjectionQuery] = useState('');

  // Fin d'appel
  const [outcome, setOutcomeState] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState('');
  const [withTask, setWithTask] = useState(false);
  const [due, setDue] = useState(dueIn(3));
  const [taskType, setTaskType] = useState<TaskType>('call');
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState<CallOutcome | null>(null);

  // Envoi direct (Gmail), si activé sur cet appareil
  const [gmail] = useState(() => new AppsScriptEmailProvider());
  const [confirmSend, setConfirmSend] = useState(false);
  const [sending, setSending] = useState(false);
  const setOutcome = (o: CallOutcome) => {
    const def = OUTCOME[o];
    setOutcomeState(o);
    setSaved(null);
    setWithTask(!!def.task);
    setDue(dueIn(def.task?.days ?? 3));
    setTaskType(def.task?.type ?? 'follow_up');
    setReason(def.task?.reason ?? '');
  };

  // Recherche d'un prospect (assistant ouvert hors fiche)
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const { data: matches = [] } = useQuery(
    async (a) => {
      const n = normText(dq);
      return n.length < 2 ? [] : (await a.allRows()).filter((r) => r.search.includes(n)).slice(0, 6);
    },
    [dq],
  );

  const [period, setPeriod] = useState<'7' | '30' | 'all'>('30');
  const { data: funnel } = useQuery(
    async (a) => {
      if (view !== 'suivi') return null;
      const since = period === 'all' ? null : new Date(Date.now() - Number(period) * 86_400_000).toISOString();
      return salesFunnel(await a.allRows(), await a.allActivities(), since);
    },
    [view, period],
  );

  if (id && loading && !data) return <Skeleton className="h-64" />;
  if (id && !p)
    return (
      <EmptyState icon={<Search className="h-7 w-7" />} title="Prospect introuvable" action={<ButtonLink to="/assistant">Ouvrir l’assistant sans prospect</ButtonLink>}>
        Il a peut-être été supprimé ou fusionné avec un doublon.
      </EmptyState>
    );

  const ready = p ? readiness(p) : null;
  const tel = p && !blocked ? telUrl(p.phone) : null;
  const product = cfg.productName;
  const onUse = canEdit ? use : undefined;
  const card = { onUse, compact: expert, open: !expert };

  const buttons: { id: View; label: string; expert?: boolean }[] = [
    { id: 'intro', label: '🎤 Introduction' },
    { id: 'pitch30', label: '⚡ Pitch 30 sec', expert: true },
    { id: 'present', label: `📖 Présenter ${product}` },
    { id: 'question', label: '❓ Question du prospect' },
    { id: 'objection', label: '🛑 Objection', expert: true },
    { id: 'tarif', label: '💰 Tarif', expert: true },
    { id: 'fonctionnement', label: '🔍 Fonctionnement' },
    { id: 'rgpd', label: '🛡️ Données / RGPD' },
    { id: 'rdv', label: expert ? '📅 Prochaine action' : '📅 Prendre rendez-vous', expert: true },
    { id: 'send', label: '✉️ Envoyer la présentation' },
    { id: 'args', label: '🧰 Arguments' },
    { id: 'suivi', label: '📊 Suivi commercial' },
  ];
  const shown = expert ? buttons.filter((b) => b.expert) : buttons;

  const kbList = (cats: KbCategory[] | 'faq') =>
    cfg.entries
      .filter((e) => (cats === 'faq' ? e.faq : cats.includes(e.category)))
      .map((e) => {
        const a = entryAnswer(e, cfg, vars);
        return <AnswerCard key={e.id} title={say(e.question, vars)} short={a.short} long={a.long} avoid={e.avoid} warning={a.warning} badge={<Badge>{KB_CATEGORY_LABEL[e.category]}</Badge>} {...card} open={false} />;
      });

  const closings = (
    <div className="grid gap-3 md:grid-cols-3">
      <AnswerCard title="Prospect intéressé" short={say(cfg.closings.interested, vars)} onUse={onUse} compact />
      <AnswerCard title="Prospect hésitant" short={say(cfg.closings.hesitant, vars)} onUse={onUse} compact />
      <AnswerCard title="Demande un rappel" short={say(cfg.closings.callback, vars)} onUse={onUse} compact />
    </div>
  );

  // ─────────────── Vues ───────────────

  const node = path.length ? cfg.tree.find((n) => n.id === path[path.length - 1]) : undefined;
  const options = treeChildren(cfg, node?.id ?? null);
  const tree = (
    <div className="space-y-3">
      {node ? (
        <>
          <p className="text-sm text-muted">
            Le prospect : <span className="font-medium text-ink">« {say(node.prospectSays, vars)} »</span>
          </p>
          <AnswerCard title="Réponse suggérée" short={say(node.reply, vars)} followUp={say(node.next, vars)} followUpLabel="Question suivante" onUse={onUse} compact />
        </>
      ) : (
        <p className="text-sm text-muted">Que répond le prospect à votre question d’ouverture ?</p>
      )}
      {options.length > 0 ? (
        <div className="flex flex-col gap-2">
          {node && <p className="text-sm text-muted">Et ensuite, que répond-il ?</p>}
          {options.map((o) => (
            <button key={o.id} type="button" onClick={() => setPath((x) => [...x, o.id])} className="min-h-12 rounded-xl border border-line bg-surface px-4 py-2 text-left font-medium hover:border-brand/50">
              « {say(o.prospectSays, vars)} »
            </button>
          ))}
        </div>
      ) : (
        node && (
          <div className="flex flex-wrap gap-2">
            <Button variant="soft" onClick={() => setView('objection')}>
              🛑 Il a une objection
            </Button>
            <Button onClick={() => setView('rdv')}>📅 Conclure l’appel</Button>
          </div>
        )
      )}
      {node && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPath((x) => x.slice(0, -1))}>
            ← Réponse précédente
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPath([])}>
            Recommencer
          </Button>
        </div>
      )}
    </div>
  );

  const steps: { title: string; body: ReactNode }[] = [
    {
      title: 'Introduction',
      body: (
        <div className="space-y-3">
          <div>
            <p className="mb-1.5 text-sm font-medium">Situation constatée pendant l’appel (facultatif)</p>
            <div className="flex flex-wrap gap-2">
              <Chip selected={situation === 'none'} onClick={() => setSituation('none')}>
                Standard
              </Chip>
              <Chip selected={situation === 'has_crm'} onClick={() => setSituation('has_crm')}>
                A déjà un logiciel de devis
              </Chip>
              <Chip selected={situation === 'never_prospected'} onClick={() => setSituation('never_prospected')}>
                Fait ses devis à la main
              </Chip>
            </div>
          </div>
          <AnswerCard
            title={`Phrase d’ouverture${situation === 'none' && per.kind === 'structure' ? ' — entreprise structurée' : ''}`}
            short={introScript(cfg, per.kind, situation, vars)}
            onUse={onUse}
            compact
          />
          <p className="text-sm text-muted">Posez la question, puis laissez parler : pas de monologue.</p>
        </div>
      ),
    },
    { title: 'Écouter la réponse', body: tree },
    { title: 'Présenter en 30 secondes', body: <AnswerCard title="Pitch 30 sec" short={say(cfg.pitch30, vars)} long={say(cfg.pitch60, vars)} {...card} open={false} /> },
    {
      title: 'Questions à poser',
      body: (
        <ul className="space-y-2">
          {cfg.script.questions.map((x) => (
            <li key={x} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <span>{say(x, vars)}</span>
              <CopyButton text={say(x, vars)} label="Copier" />
            </li>
          ))}
        </ul>
      ),
    },
    {
      title: 'Conclure',
      body: (
        <div className="space-y-3">
          {closings}
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {cfg.script.nextSteps.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          <Button onClick={() => setView('rdv')}>Enregistrer le résultat de l’appel</Button>
        </div>
      ),
    },
  ];

  const views: Record<View, () => ReactNode> = {
    intro: () => (
      <div className="space-y-4">
        {!expert && (
          <Card>
            <CardTitle>Que faire maintenant ?</CardTitle>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              {cfg.script.beginnerSteps.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ol>
          </Card>
        )}
        <Card>
          <CardTitle
            action={
              <span className="text-sm text-muted">
                Étape {step + 1} / {steps.length}
              </span>
            }
          >
            {steps[step]!.title}
          </CardTitle>
          {steps[step]!.body}
          <div className="mt-4 flex justify-between gap-2 border-t border-line pt-3">
            <Button variant="secondary" disabled={step === 0} onClick={() => setStep((x) => x - 1)}>
              ← Précédent
            </Button>
            <Button disabled={step === steps.length - 1} onClick={() => setStep((x) => x + 1)}>
              Suivant →
            </Button>
          </div>
        </Card>
      </div>
    ),
    pitch30: () => (
      <div className="space-y-3">
        <AnswerCard title="⚡ Pitch 30 sec" short={say(cfg.pitch30, vars)} onUse={onUse} compact />
        {!expert && <AnswerCard title="Pitch 1 min" short={say(cfg.pitch60, vars)} onUse={onUse} compact />}
      </div>
    ),
    present: () => (
      <div className="space-y-3">
        <AnswerCard title={`${product} en une phrase`} short={say(cfg.presentation, vars)} onUse={onUse} compact />
        <AnswerCard title="Pitch 1 min" short={say(cfg.pitch60, vars)} onUse={onUse} compact />
        <h2 className="pt-2 text-base font-semibold">{product.toUpperCase()} EN 30 SECONDES</h2>
        {cfg.entries
          .filter((e) => e.sheet)
          .map((e) => {
            const a = entryAnswer(e, cfg, vars);
            return <AnswerCard key={e.id} title={say(e.question, vars)} short={a.short} long={a.long} avoid={e.avoid} {...card} open={false} />;
          })}
      </div>
    ),
    question: () => {
      const hits = searchKb(cfg, question, 5);
      return (
        <div className="space-y-4">
          <Card>
            <TextField label="🔎 Que voulez-vous savoir ?" value={question} onChange={setQuestion} placeholder="Ex. Il me demande si ça fait aussi les factures" autoFocus />
            {question.trim().length > 1 && hits.length === 0 && <p className="mt-2 text-sm text-muted">Aucune réponse officielle trouvée. Ne répondez pas au hasard : proposez de revenir vers le prospect avec une réponse précise.</p>}
          </Card>
          {hits.map((h, i) => {
            const a = entryAnswer(h.item, cfg, vars);
            return (
              <AnswerCard
                key={h.item.id}
                title={h.kind === 'entry' ? say(h.item.question, vars) : `« ${h.item.objection} »`}
                short={a.short}
                long={a.long}
                followUp={h.kind === 'objection' ? say(h.item.followUp, vars) : undefined}
                avoid={h.kind === 'entry' ? h.item.avoid : undefined}
                warning={a.warning}
                badge={i === 0 ? <Badge tone="success">⚡ Réponse rapide</Badge> : undefined}
                {...card}
                open={i === 0 && !expert}
              />
            );
          })}
          {!question.trim() && (
            <>
              <div className="flex flex-wrap gap-2">
                <Chip selected={category === 'faq'} onClick={() => setCategory('faq')}>
                  Questions fréquentes
                </Chip>
                {KB_CATEGORIES.filter((c) => cfg.entries.some((e) => e.category === c.id)).map((c) => (
                  <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
                    {c.label}
                  </Chip>
                ))}
              </div>
              {kbList(category === 'faq' ? 'faq' : [category])}
            </>
          )}
        </div>
      );
    },
    objection: () => {
      const n = normText(objectionQuery);
      const list = cfg.objections.filter((o) => !n || normText(`${o.objection} ${o.short}`).includes(n));
      return (
        <div className="space-y-3">
          {!expert && <TextField label="Rechercher une objection" value={objectionQuery} onChange={setObjectionQuery} placeholder="Ex. temps, logiciel, prix…" />}
          {list.map((o) => {
            const a = entryAnswer(o, cfg, vars);
            return <AnswerCard key={o.id} title={`« ${o.objection} »`} short={a.short} long={a.long} followUp={say(o.followUp, vars)} warning={a.warning} {...card} open={false} />;
          })}
          {list.length === 0 && <p className="text-sm text-muted">Aucune objection ne correspond.</p>}
        </div>
      );
    },
    tarif: () => {
      const price = dynamicAnswer('price', cfg);
      const offers = cfg.offers.filter((o) => o.name.trim());
      return (
        <div className="space-y-3">
          <AnswerCard title="💰 Réponse prête à dire" short={price.short} long={price.long} warning={price.warning} {...card} />
          {offers.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              {offers.map((o) => (
                <Card key={o.id}>
                  <CardTitle>{o.name}</CardTitle>
                  {o.price && (
                    <p className="text-xl font-bold">
                      {o.price} <span className="text-sm font-normal text-muted">{o.period}</span>
                    </p>
                  )}
                  <dl className="mt-2 space-y-1 text-sm">
                    {(
                      [
                        ['Fonctionnalités', o.features],
                        ['Limites', o.limits],
                        ['Essai', o.trial],
                        ['Engagement', o.commitment],
                      ] as const
                    )
                      .filter(([, v]) => v.trim())
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="inline font-semibold">{k} : </dt>
                          <dd className="inline whitespace-pre-line">{v}</dd>
                        </div>
                      ))}
                  </dl>
                  {o.cta && safeUrl(cfg.links.signup) && (
                    <a href={safeUrl(cfg.links.signup)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-10 items-center rounded-xl bg-brand-soft px-3 text-sm font-semibold text-brand">
                      {o.cta}
                    </a>
                  )}
                </Card>
              ))}
            </div>
          )}
          {!expert && (
            <>
              <AnswerCard title="Est-ce qu’il y a un engagement ?" {...dynamicAnswer('commitment', cfg)} onUse={onUse} compact />
              <AnswerCard title="Est-ce que je peux essayer ?" {...dynamicAnswer('trial', cfg)} onUse={onUse} compact />
            </>
          )}
        </div>
      );
    },
    fonctionnement: () => (
      <div className="space-y-3">
        {kbList(GROUPS.fonctionnement!)}
        <Card>
          <CardTitle>Comparaison avec les méthodes classiques</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="py-2 pr-3 font-medium">Méthode</th>
                  <th className="py-2 pr-3 font-medium">Point fort</th>
                  <th className="py-2 font-medium">Limite</th>
                </tr>
              </thead>
              <tbody>
                {cfg.comparison.map((c) => (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="py-2 pr-3 font-semibold">{say(c.method, vars)}</td>
                    <td className="py-2 pr-3">{say(c.strength, vars)}</td>
                    <td className="py-2">{say(c.limit, vars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">Comparaison factuelle : ne dénigrez jamais un concurrent.</p>
        </Card>
      </div>
    ),
    rgpd: () => <div className="space-y-3">{kbList(GROUPS.rgpd!)}</div>,
    args: () => (
      <div className="grid gap-3 md:grid-cols-2">
        {cfg.arguments.map((a) => (
          <AnswerCard key={a.id} title={a.need} short={say(a.text, vars)} onUse={onUse} compact />
        ))}
      </div>
    ),
    rdv: () => {
      const def = outcome ? OUTCOME[outcome] : null;
      const booking = safeUrl(cfg.links.booking);
      return (
        <div className="space-y-4">
          {closings}
          {booking && (
            <a href={booking} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-line bg-surface px-4 font-semibold hover:bg-surface-2">
              📅 Ouvrir la prise de rendez-vous
            </a>
          )}
          <Card>
            <CardTitle>Résultat de l’appel</CardTitle>
            {!p ? (
              <p className="text-sm text-muted">Ouvrez l’assistant depuis une fiche prospect pour enregistrer le résultat, la note et la relance dans son historique.</p>
            ) : !canEdit ? (
              <p className="text-sm text-muted">Votre rôle ne permet pas d’enregistrer un appel.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {CALL_OUTCOMES.map((o) => (
                    <Chip key={o.id} selected={outcome === o.id} onClick={() => setOutcome(o.id)}>
                      {o.label}
                    </Chip>
                  ))}
                </div>
                {def && (
                  <>
                    <TextArea label="Note (facultatif)" value={note} onChange={setNote} rows={3} placeholder="Ex. rappeler après 17 h, demander le gérant…" />
                    <div>
                      <p className="mb-1 text-sm font-semibold">Prochaine action</p>
                      <Checkbox checked={withTask} onChange={setWithTask}>
                        Créer une relance
                      </Checkbox>
                      {withTask && (
                        <div className="mt-2 grid gap-3 sm:grid-cols-2">
                          <TextField label="Date et heure" type="datetime-local" value={due} onChange={setDue} />
                          <SelectField label="Type" value={taskType} onChange={(v) => setTaskType(v as TaskType)} options={TASK_TYPES.map((t) => ({ value: t.id, label: t.label }))} />
                          <TextField label="Motif" value={reason} onChange={setReason} className="sm:col-span-2" />
                        </div>
                      )}
                    </div>
                    {def.status && <p className="text-sm text-muted">Le statut du prospect passera à « {STATUS_LABEL[def.status]} ».</p>}
                    {def.noContact && <p className="text-sm text-muted">L’appel est noté dans l’historique sans compter comme un contact. Pensez à marquer le numéro « ✗ Incorrect » dans la fiche.</p>}
                    <Button
                      disabled={blocked || saved === outcome}
                      onClick={async () => {
                        const ok = await run(async () => {
                          await api.logCallOutcome(p.id, { outcome: def.id, note, task: withTask ? { type: taskType, dueAt: new Date(due).toISOString(), note: reason } : null });
                          return true;
                        }, 'Résultat enregistré dans l’historique');
                        if (ok) {
                          setSaved(def.id);
                          if (note.trim()) setResume(note.trim());
                          setNote('');
                        }
                      }}
                    >
                      Enregistrer le résultat
                    </Button>
                    {blocked && <p className="text-sm text-danger">Prospect exclu : aucun appel ne peut être enregistré.</p>}
                  </>
                )}
                {saved && (
                  <Alert tone="success" title="Appel enregistré">
                    Le résultat{withTask ? ', la relance' : ''} et la note figurent dans l’historique du prospect.
                    <div className="mt-2 flex flex-wrap gap-2">
                      {OUTCOME[saved].email && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setTemplateId(OUTCOME[saved].email!);
                            setDraft(null);
                            setChannel('email');
                            setView('send');
                          }}
                        >
                          ✉️ Préparer le message de suivi
                        </Button>
                      )}
                      <ButtonLink size="sm" variant="secondary" to={`/prospects/${p.id}`}>
                        Retour à la fiche
                      </ButtonLink>
                    </div>
                  </Alert>
                )}
              </div>
            )}
          </Card>
        </div>
      );
    },
    send: () => {
      const links = emailLinks(cfg);
      const image = emailImage(cfg);
      const html = emailHtml(email.subject, email.body, cfg, per.signature);
      const text = emailText(email.body, cfg, per.signature);
      const to = settings.testMode ? settings.adminEmail : (p?.email ?? '');
      const risky = riskyWording(channel === 'email' ? `${email.subject} ${email.body}` : message);
      const phone = p?.phone ?? null;
      const external = channel === 'sms' ? smsUrl(phone, message) : channel === 'whatsapp' ? whatsappUrl(phone, message) : channel === 'linkedin' ? safeUrl(p?.linkedin) : null;
      const logSent = (kind: 'email' | 'message', label: string) => run(() => api.logContact(p!.id, kind, label), 'Envoi enregistré dans l’historique');
      return (
        <div className="space-y-4">
          <Card>
            <details open={!p}>
              <summary className="cursor-pointer font-semibold">Personnalisation {p ? '(reprise de la fiche, modifiable)' : ''}</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <SelectField
                  label="Type de prospect"
                  value={per.kind}
                  onChange={(v) => setPer('kind')(v as Personalization['kind'])}
                  options={[
                    { value: 'independent', label: 'Indépendant / petite entreprise' },
                    { value: 'structure', label: 'Entreprise structurée (10 personnes et plus)' },
                  ]}
                />
                <TextField label="Secteur / activité" value={per.sector} onChange={setPer('sector')} />
                <TextField label="Prénom (si connu)" value={per.firstName} onChange={setPer('firstName')} hint="Vide = formule générique « Bonjour, »" />
                <TextField label="Nom de l’entreprise" value={per.company} onChange={setPer('company')} />
                <TextField label="Ville" value={per.city} onChange={setPer('city')} />
                <TextField label="Département" value={per.department} onChange={setPer('department')} />
                <TextField label="Commercial" value={per.salesperson} onChange={setPer('salesperson')} />
                <TextArea label="Signature" value={per.signature} onChange={setPer('signature')} rows={3} />
                <TextArea label="Résumé de l’échange (modèle « Après appel »)" value={resume} onChange={setResume} rows={2} className="sm:col-span-2" />
              </div>
              {draft && (
                <p className="mt-2 text-sm text-muted">
                  Le message a été modifié à la main.{' '}
                  <button type="button" className="font-semibold text-brand underline" onClick={() => setDraft(null)}>
                    Régénérer depuis le modèle
                  </button>
                </p>
              )}
            </details>
          </Card>

          <Segmented
            label="Canal"
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'email', label: 'E-mail' },
              { value: 'sms', label: 'SMS' },
              { value: 'whatsapp', label: 'WhatsApp' },
              { value: 'linkedin', label: 'LinkedIn' },
            ]}
          />

          {blocked && (
            <Alert tone="danger" title={p?.demo ? 'Donnée de démonstration' : 'Ne plus contacter'}>
              Aucun message ne peut être envoyé à ce prospect.
            </Alert>
          )}
          {risky.length > 0 && (
            <Alert tone="warning" title="Formulation à éviter">
              {risky.join(', ')} — ne promettez rien qui ne soit pas vérifié.
            </Alert>
          )}
          {aiWarnings.map((w) => (
            <Alert key={w} tone="warning">
              {w}
            </Alert>
          ))}

          {channel === 'email' ? (
            <Card>
              <div className="space-y-3">
                <SelectField
                  label="Modèle"
                  value={tpl?.id ?? ''}
                  onChange={(v) => {
                    setTemplateId(v);
                    setDraft(null);
                  }}
                  options={cfg.emails.map((t) => ({ value: t.id, label: t.name }))}
                />
                <TextField label="Objet" value={email.subject} onChange={(v) => setDraft({ ...email, subject: v })} />
                <TextArea label="Message (zone de rédaction)" value={email.body} onChange={(v) => setDraft({ ...email, body: v })} rows={12} />
                <div className="rounded-xl bg-surface-2 p-3 text-sm">
                  <p>
                    <span className="font-semibold">Image de présentation : </span>
                    {image ? 'insérée dans la version mise en forme.' : 'aucune image configurée.'}
                  </p>
                  <p>
                    <span className="font-semibold">Boutons : </span>
                    {links.length ? links.map((l) => l.label).join(' · ') : 'aucun lien configuré (boutons masqués).'}
                  </p>
                  {(!image || !links.length) && (
                    <p className="text-muted">
                      {canAdmin ? (
                        <Link to="/assistant/admin" className="font-semibold text-brand underline">
                          Configurer l’image et les liens
                        </Link>
                      ) : (
                        'Demandez à votre responsable de les configurer.'
                      )}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <CopyButton text={email.subject} label="Copier l’objet" />
                  <CopyButton text={text} label="Copier le texte" />
                  <button
                    type="button"
                    onClick={async () => toast((await copyRich(html, text)) ? 'E-mail mis en forme copié : collez-le dans votre messagerie' : 'Copie impossible', 'success')}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
                  >
                    <Sparkles className="h-4 w-4" aria-hidden /> Copier l’e-mail mis en forme
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(html, 'email-presentation.html', 'text/html;charset=utf-8')}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium hover:bg-surface-2"
                  >
                    <Download className="h-4 w-4" aria-hidden /> Télécharger le HTML
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => setPreview((x) => !x)}>
                    {preview ? 'Masquer l’aperçu' : 'Aperçu mis en forme'}
                  </Button>
                </div>
                {salesAssistant.canRewrite && (
                  <div className="flex flex-wrap items-end gap-2">
                    <SelectField label="Aide à la rédaction (IA)" value={aiTask} onChange={(v) => setAiTask(v as SalesAiTask)} options={SALES_AI_TASKS.map((t) => ({ value: t.id, label: t.label }))} />
                    <Button
                      variant="soft"
                      onClick={async () => {
                        const r = await run(() => salesAssistant.rewrite({ task: aiTask, text: email.body, cfg, prospect: { entreprise: per.company, ville: per.city, activite: per.sector } }));
                        if (r) {
                          setAiWarnings(r.warnings);
                          if (r.provider === 'ai') setDraft({ ...email, body: r.text });
                        }
                      }}
                    >
                      Appliquer
                    </Button>
                  </div>
                )}
                {preview && <iframe title="Aperçu de l’e-mail" sandbox="" srcDoc={html} className="h-[34rem] w-full rounded-xl border border-line bg-white" />}
                {settings.testMode && (
                  <Alert tone="warning" title="Mode test">
                    {settings.adminEmail ? `Le message s'ouvrira adressé à ${settings.adminEmail} (votre adresse), pas au prospect.` : 'Renseignez votre adresse dans Paramètres pour utiliser le mode test.'}
                  </Alert>
                )}
                {!blocked && (
                  <div className="flex flex-wrap items-center gap-2">
                    {gmail.configured && canEdit && (
                      <Button icon={<Send className="h-5 w-5" />} disabled={!to || sending} onClick={() => setConfirmSend(true)}>
                        {sending ? 'Envoi…' : 'Envoyer maintenant'}
                      </Button>
                    )}
                    <a
                      href={to ? mailtoUrl(to, email.subject, text) : undefined}
                      aria-disabled={!to}
                      onClick={(e) => !to && e.preventDefault()}
                      className={`inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold ${!to ? 'cursor-not-allowed bg-surface-2 text-muted' : gmail.configured ? 'border border-line bg-surface hover:bg-surface-2' : 'bg-brand text-on-brand hover:bg-brand-strong'}`}
                    >
                      <Mail className="h-5 w-5" aria-hidden /> Ouvrir dans mon e-mail
                    </a>
                    {!to && <span className="text-sm text-muted">{p ? 'E-mail du prospect inconnu : copiez le message.' : 'Sans prospect : copiez le message.'}</span>}
                    {p && canEdit && !settings.testMode && (
                      <Button variant="soft" onClick={() => logSent('email', `E-mail envoyé : « ${email.subject} »`)}>
                        J’ai envoyé l’e-mail
                      </Button>
                    )}
                  </div>
                )}
                <ConfirmDialog
                  open={confirmSend}
                  title="Envoyer cet e-mail ?"
                  message={
                    <>
                      <p>
                        Destinataire : <strong className="text-ink">{to}</strong>
                        {settings.testMode && ' (mode test : votre propre adresse)'}
                      </p>
                      <p>Objet : « {email.subject} »</p>
                      <p>Le message part immédiatement de votre adresse Gmail, avec l’image, les boutons et la mention permettant de ne plus être contacté.</p>
                    </>
                  }
                  confirmLabel="Envoyer"
                  onClose={() => setConfirmSend(false)}
                  onConfirm={async () => {
                    setConfirmSend(false);
                    setSending(true);
                    await run(async () => {
                      // La limite quotidienne est vérifiée AVANT l'envoi (un message parti ne se rattrape pas)
                      if (p && !settings.testMode && (await api.contactsToday()) >= settings.dailyContactLimit) throw new Error(`Limite de ${settings.dailyContactLimit} contacts par jour atteinte (Paramètres).`);
                      const r = await gmail.send({ to, subject: email.subject, text: `${text}\n\n${OPT_OUT_LINE}`, html: emailHtml(email.subject, email.body, cfg, per.signature, OPT_OUT_LINE), name: per.salesperson || undefined });
                      if (p && !settings.testMode) await api.logContact(p.id, 'email', `E-mail envoyé (Gmail) : « ${email.subject} »`);
                      toast(r.remaining !== null ? `E-mail envoyé — ${r.remaining} envoi(s) encore possible(s) aujourd’hui` : 'E-mail envoyé');
                    });
                    setSending(false);
                  }}
                />
                <p className="text-xs text-muted">
                  {gmail.configured ? '« Envoyer maintenant » envoie la version avec image et boutons depuis votre adresse Gmail. ' : 'Pour envoyer directement depuis l’application, activez l’envoi Gmail dans les Paramètres. '}
                  « Ouvrir dans mon e-mail » prépare la version texte avec les liens. Pour la version avec image et boutons, utilisez « Copier l’e-mail mis en forme » puis collez dans votre messagerie. Chaque message est déclenché par vous : aucun envoi automatique.
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="space-y-3">
                <TextArea label="Message (zone de rédaction)" value={message} onChange={(v) => setMsgDraft((d) => ({ ...d, [channel]: v }))} rows={5} />
                <p className="text-xs text-muted">{message.length} caractères</p>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyButton text={message} label="Copier" />
                  {!blocked && external && (
                    <a href={external} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-brand px-3 text-sm font-semibold text-on-brand">
                      {channel === 'sms' ? 'Ouvrir dans mes SMS' : channel === 'whatsapp' ? 'Ouvrir WhatsApp' : 'Ouvrir le profil LinkedIn'}
                    </a>
                  )}
                  {p && canEdit && !blocked && (
                    <Button size="sm" variant="soft" onClick={() => logSent('message', `${channel === 'sms' ? 'SMS' : channel === 'whatsapp' ? 'WhatsApp' : 'LinkedIn'} envoyé`)}>
                      J’ai envoyé le message
                    </Button>
                  )}
                </div>
                {!external && (
                  <p className="text-sm text-muted">
                    {channel === 'whatsapp' ? 'WhatsApp n’est proposé que si la fiche contient un numéro de mobile.' : channel === 'sms' ? 'Aucun numéro dans la fiche : copiez le message.' : 'Aucun profil LinkedIn dans la fiche : copiez le message.'}
                  </p>
                )}
              </div>
            </Card>
          )}
        </div>
      );
    },
    suivi: () => (
      <Card>
        <CardTitle action={<Segmented label="Période" value={period} onChange={setPeriod} options={[{ value: '7', label: '7 jours' }, { value: '30', label: '30 jours' }, { value: 'all', label: 'Tout' }]} />}>Suivi commercial</CardTitle>
        {!funnel ? (
          <Skeleton className="h-64" />
        ) : (
          <ol className="mx-auto max-w-sm">
            {funnel.map((s, i) => (
              <li key={s.id} className="text-center">
                {i > 0 && <ArrowDown className="mx-auto my-1 h-4 w-4 text-muted" aria-hidden />}
                <div className="rounded-xl border border-line p-3">
                  <div className="text-2xl font-bold tabular-nums">{nf.format(s.count)}</div>
                  <div className="font-semibold">{s.label}</div>
                  <div className="text-xs text-muted">{s.hint}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-3 text-xs text-muted">Chiffres calculés depuis l’historique réel de vos prospects (hors données de démonstration). Un e-mail ou un appel n’est compté que s’il a été enregistré.</p>
      </Card>
    ),
  };

  return (
    <>
      <PageHeader
        title="Assistant commercial"
        subtitle={p ? (p.tradeName ?? p.name) : 'Scripts, réponses et messages prêts à l’emploi'}
        back={p ? `/prospects/${p.id}` : undefined}
        actions={
          canAdmin ? (
            <Link to="/assistant/admin" aria-label="Configurer l’assistant" title="Configurer l’assistant" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink">
              <Settings2 className="h-5 w-5" />
            </Link>
          ) : undefined
        }
      />

      <div className="mb-4 max-w-md">
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'beginner', label: '👨‍💼 Commercial débutant' },
            { value: 'expert', label: '⚡ Mode expert' },
          ]}
        />
      </div>

      {p && ready ? (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold">{p.tradeName ?? p.name}</span>
            <StatusBadge status={p.status} />
            <ReadinessBadge readiness={ready} />
          </div>
          <p className="mt-1 text-sm text-muted">{[p.city, per.sector].filter(Boolean).join(' · ') || 'Ville et activité inconnues'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            {tel ? (
              <a href={tel} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 font-semibold text-on-brand">
                <Phone className="h-4 w-4" aria-hidden /> {formatPhone(p.phone)}
              </a>
            ) : (
              <span className="text-muted">Téléphone inconnu</span>
            )}
            <span>{p.email ?? <span className="text-muted">E-mail inconnu</span>}</span>
            <span>{p.website ? p.website.replace(/^https?:\/\/(www\.)?/, '') : <span className="text-muted">Site inconnu</span>}</span>
          </div>
          {ready.level === 'enrich' && (
            <p className="mt-2 text-sm">
              <Link to={`/prospects/${p.id}`} className="font-semibold text-brand underline">
                Enrichir la fiche avant d’appeler
              </Link>
            </p>
          )}
          {!expert && (
            <details className="mt-3 border-t border-line pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand">Préparation, notes et historique</summary>
              <div className="mt-2 space-y-3">
                <ReadinessChecks readiness={ready} />
                {data!.tasks.filter((t) => !t.done).length > 0 && (
                  <div className="text-sm">
                    <p className="font-semibold">Relances prévues</p>
                    <ul>
                      {data!.tasks
                        .filter((t) => !t.done)
                        .slice(0, 3)
                        .map((t) => (
                          <li key={t.id}>
                            {formatDateTime(t.dueAt)} · {TASK_TYPE_LABEL[t.type]}
                            {t.note && ` · ${t.note}`}
                          </li>
                        ))}
                    </ul>
                  </div>
                )}
                {data!.notes.length > 0 && (
                  <div className="text-sm">
                    <p className="font-semibold">Dernières notes</p>
                    <ul className="space-y-1">
                      {data!.notes.slice(0, 3).map((n) => (
                        <li key={n.id} className="whitespace-pre-wrap">
                          <span className="text-muted">{formatDateTime(n.createdAt)} — </span>
                          {n.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="text-sm">
                  <p className="font-semibold">Historique récent</p>
                  <ul>
                    {data!.timeline.slice(0, 6).map((a) => (
                      <li key={a.id}>
                        <span className="text-muted">{formatDateTime(a.at)} — </span>
                        {a.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </details>
          )}
        </Card>
      ) : (
        <Card className="mb-4">
          <TextField label="Prospect (facultatif)" value={q} onChange={setQ} placeholder="Rechercher une entreprise de votre base…" hint="Avec un prospect, le script et les messages reprennent ses informations et l’appel est enregistré dans son historique." />
          {matches.length > 0 && (
            <ul className="mt-2 space-y-1">
              {matches.map((r) => (
                <li key={r.id}>
                  <button type="button" onClick={() => navigate(`/assistant/${r.id}`)} className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-line px-3 text-left hover:border-brand/50">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-sm text-muted">{r.city}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-5">
        <aside aria-label="Assistant commercial" className="sticky top-14 z-10 -mx-4 mb-4 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur lg:top-4 lg:order-2 lg:mx-0 lg:mb-0 lg:rounded-2xl lg:border lg:bg-surface lg:p-3 lg:shadow-card">
          <p className="mb-2 hidden items-center gap-2 text-sm font-bold lg:flex">
            🎧 ASSISTANT COMMERCIAL
          </p>
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {shown.map((b) => (
              <button
                key={b.id}
                type="button"
                aria-pressed={view === b.id}
                onClick={() => setView(b.id)}
                className={`min-h-11 shrink-0 whitespace-nowrap rounded-xl border px-3 text-left text-sm font-semibold lg:whitespace-normal ${view === b.id ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface hover:border-brand/50'}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </aside>
        <div className="min-w-0 lg:order-1">{views[view]()}</div>
      </div>
    </>
  );
}
