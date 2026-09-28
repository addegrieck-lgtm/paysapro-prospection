// Génération de messages : IA OPTIONNELLE, modèles dynamiques par défaut.
//
//   MessageProvider
//   ├── TemplateMessageProvider  (défaut, gratuit, hors-ligne : modèles + variables)
//   └── ExternalAIProvider       (optionnel : appelle VOTRE proxy, ex. Cloudflare Worker gratuit)
//
// Sans VITE_AI_ENDPOINT, le module fonctionne normalement et affiche « IA non configurée ».
// Une clé d'API n'est JAMAIS placée dans ce code (site statique = code lisible par tous).
import type { MessageTemplate, Prospect, Settings } from '../domain/types';
import { HEADCOUNT_BANDS, SERVICE_LABEL } from '../domain/referentials';
import { renderTemplate, toInformal, variablesFor, wordCount } from '../domain/templates';
import { prospectingAngle } from '../domain/insights';

export const AI_SYSTEM_PROMPT = `Tu es un commercial B2B spécialisé dans les logiciels pour paysagistes.
Tu dois rédiger un message court, naturel et professionnel.
Ne promets jamais de résultats financiers.
Ne prétends jamais connaître un problème du prospect sans preuve.
N'invente jamais : problème rencontré, chiffre d'affaires, nombre de salariés, client, expérience, avis, besoin.
Utilise uniquement les données fournies.
Ne sois pas agressif.
Le message doit donner envie de découvrir le logiciel.
Préfère « Je développe un outil pensé pour les entreprises de paysagisme qui souhaitent simplifier… »
à « Nous avons remarqué que votre entreprise souffre de… ».
Longueur maximale : 120 mots.
Réponds uniquement en JSON : {"subject": "...", "body": "..."}.`;

/** Faits CONNUS sur le prospect — un champ inconnu est absent (jamais deviné). */
export interface ProspectFacts {
  entreprise: string;
  ville?: string;
  departement?: string;
  activite?: string;
  prestations?: string[];
  nombre_avis?: number;
  note_google?: number;
  site_internet?: boolean;
  effectif?: string;
  annee_creation?: string;
  prenom_contact?: string;
}

export function buildFacts(p: Prospect): ProspectFacts {
  const f: ProspectFacts = { entreprise: p.tradeName ?? p.name };
  if (p.city) f.ville = p.city;
  if (p.department) f.departement = p.department;
  if (p.activity) f.activite = p.activity;
  if (p.services.length) f.prestations = p.services.map((s) => SERVICE_LABEL[s]);
  if (p.googleReviews !== null) f.nombre_avis = p.googleReviews;
  if (p.googleRating !== null) f.note_google = p.googleRating;
  if (p.website) f.site_internet = true;
  if (p.headcount !== null) f.effectif = `${p.headcount} personnes`;
  else if (p.headcountBand && HEADCOUNT_BANDS[p.headcountBand]) f.effectif = HEADCOUNT_BANDS[p.headcountBand]![0];
  if (p.creationDate) f.annee_creation = p.creationDate.slice(0, 4);
  if (p.contactFirstName) f.prenom_contact = p.contactFirstName;
  return f;
}

export interface MessageRequest {
  prospect: Prospect;
  template: MessageTemplate;
  settings: Settings;
}

export interface GeneratedMessage {
  subject: string;
  body: string;
  provider: 'template' | 'ai';
  warnings: string[];
}

export interface MessageProvider {
  readonly id: 'template' | 'ai';
  readonly label: string;
  readonly configured: boolean;
  generate(req: MessageRequest): Promise<GeneratedMessage>;
}

export class DoNotContactError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'DoNotContactError';
  }
}

/** Refuse toute génération / tout envoi vers un prospect exclu. */
export function assertContactable(p: Prospect): void {
  if (p.doNotContact || p.status === 'do_not_contact') throw new DoNotContactError('Ce prospect est marqué « Ne plus contacter » : aucun message ne peut être préparé.');
  if (p.demo) throw new DoNotContactError('Donnée de démonstration : entreprise fictive, jamais contactable.');
}

function signed(text: string, s: Settings) {
  return s.formality === 'tu' ? toInformal(text) : text;
}

export class TemplateMessageProvider implements MessageProvider {
  readonly id = 'template' as const;
  readonly label = 'Modèles dynamiques (sans IA)';
  readonly configured = true;

  async generate({ prospect, template, settings }: MessageRequest): Promise<GeneratedMessage> {
    const vars = variablesFor(prospect, settings);
    const subject = renderTemplate(template.subject, vars).split('\n').join(' ');
    const body = renderTemplate(template.body, vars);
    return { subject: signed(subject, settings), body: signed(body, settings), provider: 'template', warnings: [] };
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class ExternalAIProvider implements MessageProvider {
  readonly id = 'ai' as const;
  readonly label = 'IA (via votre proxy)';
  readonly configured: boolean;
  private endpoint: string;
  private fetchImpl: FetchLike;

  constructor(endpoint: string, fetchImpl?: FetchLike) {
    this.endpoint = endpoint;
    this.configured = !!endpoint;
    this.fetchImpl = fetchImpl ?? ((url, init) => fetch(url, init));
  }

  async generate({ prospect, template, settings }: MessageRequest): Promise<GeneratedMessage> {
    if (!this.configured) throw new Error('IA non configurée');
    const angle = prospectingAngle(prospect);
    const payload = {
      system: AI_SYSTEM_PROMPT,
      facts: buildFacts(prospect),
      context: {
        nom_saas: settings.saasName,
        signature: settings.signature,
        tutoiement: settings.formality === 'tu',
        type_message: template.name,
        angle: angle.angle,
        canal: template.category === 'short' ? 'SMS / réseaux sociaux (1 à 2 phrases)' : 'e-mail',
      },
    };
    const res = await this.fetchImpl(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`Service IA indisponible (${res.status})`);
    const data = (await res.json()) as { subject?: unknown; body?: unknown };
    if (typeof data.body !== 'string' || !data.body.trim()) throw new Error('Réponse IA invalide');
    const warnings: string[] = [];
    if (wordCount(data.body) > 120) warnings.push(`Message de ${wordCount(data.body)} mots (maximum conseillé : 120). Relisez-le avant l'envoi.`);
    return { subject: typeof data.subject === 'string' ? data.subject : '', body: data.body.trim(), provider: 'ai', warnings };
  }
}

const env = import.meta.env ?? {};
export const templateProvider = new TemplateMessageProvider();
export const aiProvider = new ExternalAIProvider(env.VITE_AI_ENDPOINT ?? '');

/**
 * Génère un message. Refuse les prospects exclus. Si l'IA est demandée mais échoue,
 * repli automatique sur le modèle (avec un avertissement) : l'utilisateur n'est jamais bloqué.
 */
export async function generateMessage(req: MessageRequest, useAI: boolean, ai: MessageProvider = aiProvider): Promise<GeneratedMessage> {
  assertContactable(req.prospect);
  if (useAI && ai.configured) {
    try {
      return await ai.generate(req);
    } catch (e) {
      const fallback = await templateProvider.generate(req);
      return { ...fallback, warnings: [`IA indisponible (${e instanceof Error ? e.message : 'erreur'}) : message généré à partir du modèle.`] };
    }
  }
  return templateProvider.generate(req);
}
