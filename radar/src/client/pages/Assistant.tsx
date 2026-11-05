import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api';
import { useApp } from '../App';
import { CompanyPicker } from '../components/CompanyPicker';
import { Badge, Button, Card, ErrorBox, inputCls, Notice, PageHeader, Spinner } from '../components/ui';
import { renderMarkdown } from '../lib/markdown';

interface Answer {
  intent: string;
  answer: string;
  companies: { id: number; siren: string; name: string }[];
  sources: string[];
  uncertainties: string[];
  mode: 'local' | 'claude';
  aiNote?: string;
}
interface Msg {
  q: string;
  a?: Answer;
  error?: unknown;
}

const EXAMPLES = [
  'Quelles sont les 10 meilleures opportunités du 76 ?',
  'Trouve-moi les agences web les plus intéressantes à reprendre',
  'Quelles entreprises de paysagisme ont un potentiel de transmission ?',
  'Quelle entreprise possède le meilleur rapport rentabilité/risque ?',
  'Quelles liquidations en cours au Havre ?',
  'Quel secteur semble le plus intéressant à développer ?',
  'Quelles informations dois-je demander au vendeur ?',
  'Quels éléments vérifier avant de signer ?',
];

export default function Assistant() {
  const { meta } = useApp();
  const [params] = useSearchParams();
  const [ctx, setCtx] = useState<{ id: number; name: string }[]>([]);
  const [q, setQ] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = Number(params.get('entreprise'));
    if (id) api.get<{ company: { id: number; name: string } }>(`/companies/${id}`).then((d) => setCtx([{ id: d.company.id, name: d.company.name }])).catch(() => {});
  }, [params]);
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [msgs]);
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setQ('');
    setBusy(true);
    setMsgs((m) => [...m, { q: question }]);
    try {
      const a = await api.post<Answer>('/assistant', { question, companyIds: ctx.map((c) => c.id) });
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, a } : x)));
    } catch (e) {
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, error: e } : x)));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fade-in">
      <PageHeader title="RADAR AI" subtitle="Assistant d'analyse fondé exclusivement sur les données de l'outil : il signale ses incertitudes et n'invente ni entreprise, ni compte, ni prix." actions={<Badge>{meta.aiEnabled ? 'Moteur local + synthèse Claude (facultative)' : 'Moteur local (gratuit)'}</Badge>} />
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Card className="flex min-h-[60vh] flex-col">
          <div className="flex-1 space-y-4 overflow-y-auto">
            {!msgs.length && (
              <div className="space-y-2">
                <p className="text-sm text-fog-400">Exemples de questions :</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((e) => (
                    <button key={e} className="rounded-full border border-ink-600 px-3 py-1 text-xs text-fog-300 hover:border-volt-500 hover:text-fog-100" onClick={() => ask(e)}>
                      {e}
                    </button>
                  ))}
                </div>
                <p className="pt-2 text-xs text-fog-500">Pour analyser une entreprise : sélectionnez-la à droite (ou citez son SIREN, ou son nom entre guillemets), puis demandez « Analyse cette société comme si je préparais son acquisition », « Quels sont les risques ? » ou « Quel prix maximum ? ».</p>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className="space-y-2">
                <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-volt-500/20 px-3 py-2 text-sm">{m.q}</div>
                {m.error ? (
                  <ErrorBox error={m.error} />
                ) : m.a ? (
                  <div className="max-w-[95%] rounded-2xl rounded-bl-sm border border-ink-700 bg-ink-850 px-4 py-3 text-sm">
                    <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.a.answer) }} />
                    {m.a.companies.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {m.a.companies.slice(0, 15).map((c) => (
                          <Link key={c.id} to={`/entreprises/${c.id}`} className="rounded border border-ink-600 px-1.5 py-0.5 text-[11px] text-volt-300 hover:bg-ink-750">
                            {c.name}
                          </Link>
                        ))}
                      </div>
                    )}
                    {m.a.uncertainties.length > 0 && (
                      <div className="mt-3 rounded-lg border border-warn/30 bg-warn/5 px-3 py-2 text-xs text-amber-100">
                        <div className="font-medium">Incertitudes</div>
                        <ul className="list-disc pl-4">
                          {m.a.uncertainties.map((u) => (
                            <li key={u}>{u}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-2 text-[11px] text-fog-500">
                      {m.a.sources.length ? `Sources : ${m.a.sources.join(' · ')}` : null}
                      {m.a.aiNote && <div>{m.a.aiNote}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-fog-400">
                    <Spinner small /> Analyse des données…
                  </div>
                )}
              </div>
            ))}
            <div ref={end} />
          </div>
          <form
            className="mt-4 flex gap-2 border-t border-ink-700 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              void ask(q);
            }}
          >
            <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Posez votre question…" aria-label="Question" maxLength={2000} />
            <Button variant="primary" type="submit" busy={busy} disabled={!q.trim()}>
              Envoyer
            </Button>
          </form>
        </Card>
        <div className="space-y-4">
          <Card title="Entreprises en contexte">
            <CompanyPicker onPick={(c) => setCtx((x) => (x.some((y) => y.id === c.id) ? x : [...x, { id: c.id, name: c.name }].slice(-5)))} placeholder="Ajouter une entreprise…" />
            <ul className="mt-2 space-y-1 text-sm">
              {ctx.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">{c.name}</span>
                  <button className="text-xs text-fog-500 hover:text-bad" onClick={() => setCtx((x) => x.filter((y) => y.id !== c.id))}>
                    retirer
                  </button>
                </li>
              ))}
            </ul>
            {ctx.length >= 2 && (
              <Button size="sm" className="mt-2" onClick={() => ask('Compare ces entreprises')}>
                Comparer ces entreprises
              </Button>
            )}
            {ctx.length === 1 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" onClick={() => ask('Analyse cette société comme si je préparais son acquisition')}>
                  Analyse d'acquisition
                </Button>
                <Button size="sm" onClick={() => ask('Quels sont les risques de cette reprise ?')}>
                  Risques
                </Button>
                <Button size="sm" onClick={() => ask('Quel prix maximum pourrait être raisonnable ?')}>
                  Prix maximum
                </Button>
                <Button size="sm" onClick={() => ask('Quels éléments vérifier avant de signer ?')}>
                  Avant de signer
                </Button>
              </div>
            )}
          </Card>
          <Notice>Les réponses s'appuient sur les données synchronisées et des calculs documentés. {meta.aiEnabled ? 'La synthèse par modèle externe ne reçoit que les données affichées, avec un plafond de dépense mensuel.' : 'Un modèle externe peut être activé (facultatif) dans Administration → Paramètres.'}</Notice>
        </div>
      </div>
    </div>
  );
}
