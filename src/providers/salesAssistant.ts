// Assistant commercial : génération de réponses.
//
//   SalesAssistantProvider
//   ├── KnowledgeBaseProvider  (défaut, gratuit, hors-ligne : réponses de la base de connaissances officielle)
//   └── ExternalSalesAIProvider (optionnel : reformule via VOTRE proxy VITE_AI_ENDPOINT — aucune clé dans ce code)
//
// L'IA ne sert qu'à la FORME (reformuler, adapter le ton, personnaliser, résumer). Les faits viennent toujours de la
// base de connaissances : ils sont transmis à l'IA comme seule source autorisée, et tout chiffre ou promesse absent
// du texte d'origine déclenche un avertissement.
import { dynamicAnswer, entryAnswer, riskyWording, say, searchKb, type SalesConfig, type Spoken } from '../domain/sales';

export type SalesAiTask = 'rephrase' | 'tone' | 'personalize_email' | 'summarize' | 'objection' | 'follow_up';

export const SALES_AI_TASKS: { id: SalesAiTask; label: string }[] = [
  { id: 'rephrase', label: 'Reformuler' },
  { id: 'tone', label: 'Ton plus chaleureux' },
  { id: 'personalize_email', label: 'Personnaliser l’e-mail' },
  { id: 'summarize', label: 'Résumer la conversation' },
  { id: 'objection', label: 'Répondre à l’objection' },
  { id: 'follow_up', label: 'Rédiger une relance' },
];

export const SALES_AI_SYSTEM_PROMPT = `Tu aides un commercial à formuler ses messages.
Tu travailles UNIQUEMENT sur la forme du texte fourni : clarté, ton, concision.
Les seules informations autorisées sur le produit sont celles de la liste « faits ».
Tu n'inventes jamais : fonctionnalité, prix, garantie, résultat, client, statistique, performance, engagement juridique.
Tu n'ajoutes aucun chiffre absent du texte d'origine ou des faits.
Tu n'utilises pas : « garanti », « 100 % », « révolutionnaire », ni aucune pression commerciale.
Ton : professionnel, simple, humain, direct, rassurant.
Réponds uniquement en JSON : {"text": "..."}.`;

export interface SalesAnswer extends Spoken {
  question: string;
  avoid: string;
  source: 'knowledge_base';
}

export interface RewriteRequest {
  task: SalesAiTask;
  text: string;
  cfg: SalesConfig;
  /** Données connues du prospect (jamais devinées) */
  prospect?: Record<string, string>;
}

export interface RewriteResult {
  text: string;
  provider: 'knowledge_base' | 'ai';
  warnings: string[];
}

export interface SalesAssistantProvider {
  readonly id: string;
  readonly label: string;
  /** Une IA de reformulation est-elle branchée ? */
  readonly canRewrite: boolean;
  /** Réponse à une question du prospect, tirée de la base de connaissances officielle */
  answer(question: string, cfg: SalesConfig): SalesAnswer | null;
  rewrite(req: RewriteRequest): Promise<RewriteResult>;
}

/** Faits officiels transmis à l'IA : base de connaissances + tarifs configurés (rien d'autre). */
export function officialFacts(cfg: SalesConfig): string[] {
  const vars = { produit: cfg.productName };
  return [
    ...cfg.entries.filter((e) => !e.dynamic).map((e) => entryAnswer(e, cfg, vars).short),
    dynamicAnswer('price', cfg).warning ? 'Tarifs : non communiqués.' : dynamicAnswer('price', cfg).short,
  ].filter(Boolean);
}

/** Avertit si le texte produit contient un chiffre ou une promesse absents du texte d'origine et des faits. */
export function checkRewrite(result: string, source: string, facts: string[]): string[] {
  const warnings: string[] = [];
  const allowed = `${source} ${facts.join(' ')}`;
  const numbers = (result.match(/\d+(?:[.,]\d+)?\s?(?:%|€|euros?)?/g) ?? []).map((n) => n.trim()).filter((n) => !allowed.includes(n));
  if (numbers.length) warnings.push(`Chiffre absent de la base de connaissances : ${[...new Set(numbers)].join(', ')}. Vérifiez avant d'utiliser ce texte.`);
  const risky = riskyWording(result).filter((w) => !riskyWording(source).includes(w));
  if (risky.length) warnings.push(`Formulation à éviter : ${risky.join(', ')}.`);
  return warnings;
}

export class KnowledgeBaseProvider implements SalesAssistantProvider {
  readonly id: string = 'knowledge_base';
  readonly label: string = 'Base de connaissances (sans IA)';
  readonly canRewrite: boolean = false;

  answer(question: string, cfg: SalesConfig): SalesAnswer | null {
    const hit = searchKb(cfg, question, 1)[0];
    if (!hit) return null;
    const vars = { produit: cfg.productName };
    const spoken = entryAnswer(hit.item, cfg, vars);
    return {
      ...spoken,
      question: hit.kind === 'entry' ? say(hit.item.question, vars) : hit.item.objection,
      avoid: hit.kind === 'entry' ? hit.item.avoid : '',
      source: 'knowledge_base',
    };
  }

  async rewrite(req: RewriteRequest): Promise<RewriteResult> {
    // Sans IA : le texte officiel est rendu tel quel (aucune reformulation inventée)
    return { text: req.text, provider: 'knowledge_base', warnings: [] };
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class ExternalSalesAIProvider extends KnowledgeBaseProvider {
  override readonly id = 'ai';
  override readonly label = 'IA (via votre proxy)';
  override readonly canRewrite: boolean;
  private endpoint: string;
  private fetchImpl: FetchLike;

  constructor(endpoint: string, fetchImpl?: FetchLike) {
    super();
    this.endpoint = endpoint;
    this.canRewrite = !!endpoint;
    this.fetchImpl = fetchImpl ?? ((url, init) => fetch(url, init));
  }

  override async rewrite(req: RewriteRequest): Promise<RewriteResult> {
    if (!this.canRewrite) return super.rewrite(req);
    const facts = officialFacts(req.cfg);
    try {
      const res = await this.fetchImpl(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sales', system: SALES_AI_SYSTEM_PROMPT, task: req.task, text: req.text, facts, prospect: req.prospect ?? {} }),
      });
      if (!res.ok) throw new Error(`Service IA indisponible (${res.status})`);
      const data = (await res.json()) as { text?: unknown; body?: unknown };
      const text = typeof data.text === 'string' ? data.text : typeof data.body === 'string' ? data.body : '';
      if (!text.trim()) throw new Error('Réponse IA invalide');
      return { text: text.trim(), provider: 'ai', warnings: checkRewrite(text, req.text, facts) };
    } catch (e) {
      // L'utilisateur n'est jamais bloqué : le texte d'origine est conservé
      return { text: req.text, provider: 'knowledge_base', warnings: [`IA indisponible (${e instanceof Error ? e.message : 'erreur'}) : texte d'origine conservé.`] };
    }
  }
}

const env = import.meta.env ?? {};
export const salesAssistant: SalesAssistantProvider = new ExternalSalesAIProvider(env.VITE_AI_ENDPOINT ?? '');
