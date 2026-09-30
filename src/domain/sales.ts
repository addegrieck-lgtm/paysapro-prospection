// Assistant commercial : base de connaissances, scripts, e-mails, préparation d'appel.
//
// Tout est calculé à partir (1) de la configuration commerciale administrable (`SalesConfig`, stockée dans les
// paramètres) et (2) des données connues de la fiche prospect. Rien n'est inventé : une variable inconnue supprime
// la ligne qui l'utilise, un lien non configuré masque son bouton, un tarif non configuré n'est jamais annoncé.
import type { ActivityType, Prospect, ProspectActivity, ProspectRow, ProspectStatus, Settings, TaskType } from './types';
import { renderTemplate } from './templates';
import { SERVICE_LABEL, headcountMin } from './referentials';
import { stripAccents } from './normalize';
import { phoneType, toE164 } from './phone';
import { departmentName } from './geo';
import { defaultSalesConfig } from './salesContent';

export type KbCategory =
  | 'produit'
  | 'fonctionnalites'
  | 'tarifs'
  | 'avantages'
  | 'limites'
  | 'securite'
  | 'donnees'
  | 'sources'
  | 'rgpd'
  | 'enrichissement'
  | 'crm'
  | 'prospection'
  | 'demonstration';

export const KB_CATEGORIES: { id: KbCategory; label: string }[] = [
  { id: 'produit', label: 'Produit' },
  { id: 'fonctionnalites', label: 'Fonctionnalités' },
  { id: 'tarifs', label: 'Tarifs' },
  { id: 'avantages', label: 'Avantages' },
  { id: 'limites', label: 'Limites' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'donnees', label: 'Données' },
  { id: 'sources', label: 'Sources' },
  { id: 'rgpd', label: 'RGPD' },
  { id: 'enrichissement', label: 'Enrichissement' },
  { id: 'crm', label: 'CRM' },
  { id: 'prospection', label: 'Prospection' },
  { id: 'demonstration', label: 'Démonstration' },
];
export const KB_CATEGORY_LABEL = Object.fromEntries(KB_CATEGORIES.map((c) => [c.id, c.label])) as Record<KbCategory, string>;

/** Réponse calculée à partir des formules configurées (jamais de prix écrit dans le code) */
export type DynamicAnswer = 'price' | 'commitment' | 'trial';

export interface SalesEntry {
  id: string;
  category: KbCategory;
  question: string;
  short: string;
  long: string;
  /** Formulations risquées ou promesses à éviter */
  avoid: string;
  /** Affichée dans la foire aux questions */
  faq?: boolean;
  /** Affichée dans la fiche « en 30 secondes » */
  sheet?: boolean;
  dynamic?: DynamicAnswer;
}

export interface SalesObjection {
  id: string;
  objection: string;
  short: string;
  long: string;
  followUp: string;
  dynamic?: DynamicAnswer;
}

export interface SalesArgument {
  id: string;
  need: string;
  text: string;
}

export interface SalesComparison {
  id: string;
  method: string;
  strength: string;
  limit: string;
}

export interface SalesOffer {
  id: string;
  name: string;
  price: string;
  period: string;
  features: string;
  limits: string;
  trial: string;
  commitment: string;
  cta: string;
}

export interface SalesEmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
}

export interface TreeNode {
  id: string;
  /** null = réponse à la question d'ouverture */
  parent: string | null;
  prospectSays: string;
  reply: string;
  next: string;
}

export interface SalesLinks {
  presentation: string;
  demo: string;
  signup: string;
  booking: string;
  video: string;
}

export interface SalesConfig {
  version: 1;
  productName: string;
  presentation: string;
  pitch30: string;
  pitch60: string;
  script: {
    intro: string;
    introStructure: string;
    introHasCrm: string;
    introNeverProspected: string;
    questions: string[];
    nextSteps: string[];
    beginnerSteps: string[];
  };
  tree: TreeNode[];
  closings: { interested: string; hesitant: string; callback: string };
  links: SalesLinks;
  /** Image de présentation : importée (dataUrl) et / ou hébergée en ligne (url, recommandée pour les e-mails) */
  image: { dataUrl: string | null; url: string; clickable: boolean };
  contact: { name: string; phone: string; email: string };
  signature: string;
  offers: SalesOffer[];
  entries: SalesEntry[];
  objections: SalesObjection[];
  arguments: SalesArgument[];
  comparison: SalesComparison[];
  emails: SalesEmailTemplate[];
  messages: { sms: string; whatsapp: string; linkedin: string };
}

export { defaultSalesConfig };

/** Configuration effective : le contenu enregistré complète / remplace le contenu par défaut. */
export function salesConfig(s: Pick<Settings, 'sales'>): SalesConfig {
  const d = defaultSalesConfig();
  const c = s.sales;
  if (!c) return d;
  return {
    ...d,
    ...c,
    script: { ...d.script, ...c.script },
    closings: { ...d.closings, ...c.closings },
    links: { ...d.links, ...c.links },
    image: { ...d.image, ...c.image },
    contact: { ...d.contact, ...c.contact },
    messages: { ...d.messages, ...c.messages },
  };
}

/** Seules les adresses http(s) sont acceptées (jamais `javascript:` ni un texte libre). */
export function safeUrl(u: string | null | undefined): string | null {
  const v = (u ?? '').trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.includes('.') ? url.toString() : null;
  } catch {
    return null;
  }
}

// ─────────────── Profil du prospect (uniquement d'après les données de la fiche) ───────────────

export type ProspectKind = 'independent' | 'structure';

/** Situation constatée PAR LE COMMERCIAL pendant l'appel (jamais déduite) */
export type CallSituation = 'none' | 'has_crm' | 'never_prospected';

export interface Personalization {
  firstName: string;
  company: string;
  city: string;
  department: string;
  sector: string;
  kind: ProspectKind;
  salesperson: string;
  signature: string;
}

export function prospectKind(p: Pick<Prospect, 'headcount' | 'headcountBand'> | null): ProspectKind {
  const n = p ? headcountMin(p.headcountBand, p.headcount) : null;
  return n !== null && n >= 10 ? 'structure' : 'independent';
}

export function prospectSector(p: Pick<Prospect, 'services' | 'activity'>): string {
  if (p.services.length) return p.services.slice(0, 3).map((x) => SERVICE_LABEL[x].toLowerCase()).join(', ');
  return p.activity?.toLowerCase() ?? '';
}

/** Valeurs de personnalisation pré-remplies depuis la fiche (vide = inconnu, jamais deviné). */
export function personalizationFor(p: Prospect | null, s: Settings, cfg: SalesConfig): Personalization {
  return {
    firstName: p?.contactFirstName ?? '',
    company: p ? (p.tradeName ?? p.name) : '',
    city: p?.city ?? '',
    department: p?.department ? (departmentName(p.department) ?? p.department) : '',
    sector: p ? prospectSector(p) : '',
    kind: prospectKind(p),
    salesperson: cfg.contact.name || s.senderName || (s.userName && s.userName !== 'Moi' ? s.userName : ''),
    signature: cfg.signature || s.signature,
  };
}

export function salesVars(per: Personalization, cfg: SalesConfig, extra: Record<string, string | null> = {}): Record<string, string | null> {
  const v = (x: string) => x.trim() || null;
  return {
    produit: v(cfg.productName),
    prenom: v(per.firstName),
    entreprise: v(per.company),
    ville: v(per.city),
    departement: v(per.department),
    activite: v(per.sector),
    commercial: v(per.salesperson),
    signature: v(per.signature),
    lien_presentation: safeUrl(cfg.links.presentation),
    lien_demo: safeUrl(cfg.links.demo),
    lien_inscription: safeUrl(cfg.links.signup),
    lien_rdv: safeUrl(cfg.links.booking),
    lien_video: safeUrl(cfg.links.video),
    ...extra,
  };
}

/** Texte commercial prêt à dire / copier. Sans nom de commercial connu, « X de Produit » devient « ici Produit ». */
export function say(text: string, vars: Record<string, string | null>): string {
  return renderTemplate(vars.commercial ? text : text.split('{{commercial|}} de {{produit}}').join('ici {{produit}}'), vars);
}

export function introScript(cfg: SalesConfig, kind: ProspectKind, situation: CallSituation, vars: Record<string, string | null>): string {
  const t = situation === 'has_crm' ? cfg.script.introHasCrm : situation === 'never_prospected' ? cfg.script.introNeverProspected : kind === 'structure' ? cfg.script.introStructure : cfg.script.intro;
  return say(t, vars);
}

export function treeChildren(cfg: SalesConfig, parent: string | null): TreeNode[] {
  return cfg.tree.filter((n) => (n.parent ?? null) === parent);
}

// ─────────────── Tarifs (toujours calculés depuis les formules configurées) ───────────────

export interface Spoken {
  short: string;
  long: string;
  /** Avertissement destiné au commercial (non dit au prospect) */
  warning: string | null;
}

const offerLine = (o: SalesOffer) => `${o.name}${o.price ? ` : ${o.price}${o.period ? ` ${o.period}` : ''}` : ''}`;

export function dynamicAnswer(kind: DynamicAnswer, cfg: SalesConfig): Spoken {
  const offers = cfg.offers.filter((o) => o.name.trim());
  if (kind === 'price') {
    const priced = offers.filter((o) => o.price.trim());
    if (!priced.length)
      return {
        short: 'Je préfère vous donner un tarif exact plutôt qu’un ordre de grandeur : je vous l’envoie par écrit juste après notre échange.',
        long: 'Le tarif dépend de la formule. Je vous transmets la proposition écrite, et nous pouvons la parcourir ensemble lors de la démonstration.',
        warning: 'Aucun tarif n’est configuré : n’annoncez aucun prix. Demandez à votre responsable de renseigner les formules (Assistant commercial → Configurer → Tarifs).',
      };
    return {
      short: priced.length === 1 ? `La formule ${offerLine(priced[0]!)}.` : `Nous proposons ${priced.length} formules : ${priced.map(offerLine).join(' ; ')}.`,
      long: priced
        .map((o) => [offerLine(o), o.features && `Inclus : ${o.features}`, o.limits && `Limites : ${o.limits}`, o.trial && `Essai : ${o.trial}`, o.commitment && `Engagement : ${o.commitment}`].filter(Boolean).join('. '))
        .join('\n'),
      warning: null,
    };
  }
  const field = kind === 'trial' ? 'trial' : 'commitment';
  const known = offers.filter((o) => o[field].trim());
  if (!known.length)
    return {
      short: kind === 'trial' ? 'Je vérifie les conditions d’essai et je vous les confirme par écrit.' : 'Je vérifie les conditions d’engagement et je vous les confirme par écrit.',
      long: 'Je préfère vous donner une information exacte : je vous envoie les conditions avec la proposition.',
      warning: kind === 'trial' ? 'Aucune condition d’essai n’est configurée : ne promettez pas d’essai.' : 'Aucune condition d’engagement n’est configurée : n’improvisez pas.',
    };
  const text = known.map((o) => `${o.name} : ${o[field]}`).join(' ; ');
  return { short: kind === 'trial' ? `Essai — ${text}.` : `Engagement — ${text}.`, long: known.map(offerLine).join(' ; '), warning: null };
}

export function entryAnswer(e: SalesEntry | SalesObjection, cfg: SalesConfig, vars: Record<string, string | null>): Spoken {
  if (e.dynamic) return dynamicAnswer(e.dynamic, cfg);
  return { short: say(e.short, vars), long: say(e.long, vars), warning: null };
}

// ─────────────── Recherche dans la base de connaissances ───────────────

const STOP = new Set('le la les un une des de du d l et ou a au aux en que qui quoi est ce c ca cela il elle me nous vous on je tu se sa son ses mon ma mes votre vos pour par sur dans avec pas ne n y t comment demande dit vraiment peut peuvent etre faire avoir'.split(' '));
const SYNONYMS: Record<string, string> = {
  mail: 'email',
  mails: 'email',
  emails: 'email',
  courriel: 'email',
  tel: 'telephone',
  telephones: 'telephone',
  numero: 'telephone',
  numeros: 'telephone',
  portable: 'telephone',
  prix: 'coute',
  tarif: 'coute',
  tarifs: 'coute',
  cout: 'coute',
  cher: 'coute',
  combien: 'coute',
  abonnement: 'engagement',
  abonner: 'engagement',
  loi: 'legal',
  legale: 'legal',
  droit: 'legal',
  cnil: 'rgpd',
  tester: 'essayer',
  essai: 'essayer',
  gratuit: 'essayer',
  equipe: 'commerciaux',
  plusieurs: 'commerciaux',
  collegues: 'commerciaux',
  coordonnees: 'donnees',
  provenance: 'viennent',
  origine: 'viennent',
  source: 'sources',
  fichier: 'importer',
  csv: 'importer',
  excel: 'importer',
  relance: 'relances',
  rappel: 'relances',
  departement: 'zone',
  ville: 'zone',
  secteur: 'zone',
  region: 'zone',
};

export function tokens(text: string): string[] {
  return stripAccents(text.toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map((w) => SYNONYMS[w] ?? w)
    .map((w) => (w.length > 5 ? w.slice(0, 5) : w));
}

export type KbHit = { kind: 'entry'; item: SalesEntry; score: number } | { kind: 'objection'; item: SalesObjection; score: number };

/** Recherche plein texte (question ×3, réponses ×1), synonymes courants, sans accents. */
export function searchKb(cfg: SalesConfig, query: string, limit = 6): KbHit[] {
  const name = new Set(tokens(cfg.productName));
  const q = [...new Set(tokens(query))].filter((w) => !name.has(w));
  if (!q.length) return [];
  const vars = { produit: cfg.productName };
  const score = (title: string, body: string) => {
    const t = new Set(tokens(renderTemplate(title, vars)));
    const b = new Set(tokens(renderTemplate(body, vars)));
    let s = 0;
    let inTitle = 0;
    for (const w of q) {
      if (t.has(w)) inTitle++;
      s += (t.has(w) ? 3 : 0) + (b.has(w) ? 0.5 : 0);
    }
    // À égalité, la question la plus proche (la plus grande part de ses mots retrouvée) passe devant
    return s / q.length + (t.size ? inTitle / t.size : 0);
  };
  const hits: KbHit[] = [
    ...cfg.entries.map((item) => ({ kind: 'entry' as const, item, score: score(item.question, `${item.short} ${item.long} ${KB_CATEGORY_LABEL[item.category]}`) })),
    ...cfg.objections.map((item) => ({ kind: 'objection' as const, item, score: score(item.objection, `${item.short} ${item.long}`) })),
  ];
  return hits
    .filter((h) => h.score >= 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─────────────── Préparation commerciale ───────────────

export type ReadinessLevel = 'ready' | 'incomplete' | 'enrich' | 'blocked';

export interface Readiness {
  level: ReadinessLevel;
  label: string;
  checks: { label: string; ok: boolean }[];
}

export function readiness(p: Pick<Prospect, 'phone' | 'email' | 'website' | 'contactFirstName' | 'contactLastName' | 'activity' | 'services' | 'nafCode' | 'city' | 'postalCode' | 'doNotContact' | 'demo'>): Readiness {
  const checks = [
    { label: 'Téléphone', ok: !!p.phone },
    { label: 'E-mail', ok: !!p.email },
    { label: 'Site', ok: !!p.website },
    { label: 'Nom du contact', ok: !!(p.contactFirstName || p.contactLastName) },
    { label: 'Activité', ok: !!(p.activity || p.services.length || p.nafCode) },
    { label: 'Localisation', ok: !!(p.city || p.postalCode) },
  ];
  if (p.doNotContact || p.demo) return { level: 'blocked', label: p.demo ? '⛔ Donnée de démonstration' : '⛔ Ne plus contacter', checks };
  if (!p.phone) return { level: 'enrich', label: '🔴 À enrichir avant appel', checks };
  const [, email, site, , activity, place] = checks.map((c) => c.ok);
  const ready = activity && place && (email || site);
  return ready ? { level: 'ready', label: '🟢 Prêt à appeler', checks } : { level: 'incomplete', label: '🟠 Informations incomplètes', checks };
}

// ─────────────── Résultat d'appel ───────────────

export type CallOutcome = 'interested' | 'demo' | 'callback' | 'email_requested' | 'not_interested' | 'wrong_contact' | 'invalid_number' | 'other';

export interface OutcomeDef {
  id: CallOutcome;
  label: string;
  /** Statut CRM appliqué (rien si absent) */
  status?: ProspectStatus;
  /** Relance proposée par défaut */
  task?: { type: TaskType; days: number; reason: string };
  /** L'appel n'a pas abouti : pas de passage à « Contacté » */
  noContact?: boolean;
  /** Modèle d'e-mail de suivi proposé */
  email?: string;
}

export const CALL_OUTCOMES: OutcomeDef[] = [
  { id: 'interested', label: 'Intéressé', status: 'interested', task: { type: 'follow_up', days: 2, reason: 'Relancer le prospect intéressé' }, email: 'demo' },
  { id: 'demo', label: 'Démonstration à prévoir', status: 'interested', task: { type: 'demo', days: 2, reason: 'Fixer la démonstration' }, email: 'demo' },
  { id: 'callback', label: 'Rappel', task: { type: 'call', days: 3, reason: 'Rappel demandé par le prospect' } },
  { id: 'email_requested', label: 'E-mail demandé', task: { type: 'email', days: 0, reason: 'Envoyer la présentation demandée' }, email: 'aftercall' },
  { id: 'not_interested', label: 'Pas intéressé', status: 'not_interested' },
  { id: 'wrong_contact', label: 'Mauvais contact', task: { type: 'call', days: 1, reason: 'Trouver le bon interlocuteur' } },
  { id: 'invalid_number', label: 'Numéro invalide', noContact: true },
  { id: 'other', label: 'Autre' },
];
export const OUTCOME = Object.fromEntries(CALL_OUTCOMES.map((o) => [o.id, o])) as Record<CallOutcome, OutcomeDef>;

// ─────────────── E-mails ───────────────

export interface BuiltEmail {
  subject: string;
  /** Corps sans liens (zone de rédaction) */
  body: string;
}

export function buildEmail(t: SalesEmailTemplate, vars: Record<string, string | null>): BuiltEmail {
  return { subject: renderTemplate(t.subject, vars).split('\n').join(' '), body: renderTemplate(t.body, vars) };
}

export interface EmailLink {
  label: string;
  url: string;
}

/** Boutons de l'e-mail : uniquement les liens réellement configurés. */
export function emailLinks(cfg: SalesConfig): EmailLink[] {
  const out: EmailLink[] = [];
  const discover = safeUrl(cfg.links.demo) ?? safeUrl(cfg.links.presentation) ?? safeUrl(cfg.links.signup);
  if (discover) out.push({ label: `Découvrir ${cfg.productName}`, url: discover });
  const video = safeUrl(cfg.links.video);
  if (video) out.push({ label: 'Voir la démonstration', url: video });
  const booking = safeUrl(cfg.links.booking);
  if (booking) out.push({ label: 'Prendre rendez-vous', url: booking });
  return out;
}

/** Version texte (messagerie, copier) : le corps puis les liens configurés. */
export function emailText(body: string, cfg: SalesConfig, signature = ''): string {
  const links = emailLinks(cfg);
  if (!links.length) return body;
  const block = links.map((l) => `${l.label} : ${l.url}`).join('\n');
  // Les liens se placent avant la signature lorsque le message se termine par elle
  const [main, sig] = splitSignature(body, signature);
  return [main, block, sig].filter(Boolean).join('\n\n');
}

/** Sépare la signature du reste du message (uniquement si le message se termine réellement par elle). */
export function splitSignature(body: string, signature: string): [string, string] {
  const sig = signature.trim();
  const text = body.trimEnd();
  return sig && text.endsWith(sig) ? [text.slice(0, -sig.length).trimEnd(), sig] : [text, ''];
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Image de présentation : l'adresse en ligne est prioritaire (mieux affichée par les messageries). */
export function emailImage(cfg: SalesConfig): string | null {
  return safeUrl(cfg.image.url) ?? (cfg.image.dataUrl && /^data:image\/(png|jpeg|webp);base64,/.test(cfg.image.dataUrl) ? cfg.image.dataUrl : null);
}

/**
 * E-mail HTML compatible avec les principales messageries : tableaux, styles en ligne, largeur 600 px,
 * aucune feuille de style ni script. Structure : nom du produit, titre, texte, avantages, image, boutons, signature.
 */
export function emailHtml(subject: string, body: string, cfg: SalesConfig, signature = ''): string {
  const font = 'font-family:Arial,Helvetica,sans-serif';
  const links = emailLinks(cfg);
  const image = emailImage(cfg);
  const [main, sig] = splitSignature(body, signature);
  const blocks = main
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const html = blocks
    .map((b) => {
      const lines = b.split('\n');
      if (lines.every((l) => /^[-•]\s+/.test(l)))
        return `<ul style="margin:0 0 16px;padding:0 0 0 20px;${font};font-size:15px;line-height:1.6;color:#1d2421">${lines.map((l) => `<li style="margin:0 0 6px">${escapeHtml(l.replace(/^[-•]\s+/, ''))}</li>`).join('')}</ul>`;
      return `<p style="margin:0 0 16px;${font};font-size:15px;line-height:1.6;color:#1d2421">${lines.map(escapeHtml).join('<br>')}</p>`;
    });
  // La signature passe après l'image et les boutons
  const signatureHtml = sig ? `<p style="margin:0;${font};font-size:14px;line-height:1.6;color:#5b6660">${sig.split('\n').map(escapeHtml).join('<br>')}</p>` : '';
  const img = image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(`Aperçu de ${cfg.productName}`)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:1px solid #e2dccf;border-radius:8px">` : '';
  const target = links[0]?.url;
  const imageBlock = img ? `<tr><td style="padding:0 24px 20px">${cfg.image.clickable && target ? `<a href="${escapeHtml(target)}" target="_blank" rel="noopener">${img}</a>` : img}</td></tr>` : '';
  const buttons = links
    .map(
      (l, i) =>
        `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;border-radius:8px;${font};font-size:15px;font-weight:bold;text-decoration:none;${i === 0 ? 'background:#1f5c44;color:#ffffff' : 'background:#e4efe7;color:#1f5c44'}">${escapeHtml(l.label)}</a>`,
    )
    .join('');
  return `<!doctype html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f7f5ef">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f5ef"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2dccf;border-radius:12px">
<tr><td style="padding:20px 24px;border-bottom:1px solid #e2dccf;${font};font-size:20px;font-weight:bold;color:#1f5c44">${escapeHtml(cfg.productName)}</td></tr>
<tr><td style="padding:24px 24px 8px"><h1 style="margin:0 0 16px;${font};font-size:20px;line-height:1.3;color:#1d2421">${escapeHtml(subject)}</h1>
${html.join('\n')}</td></tr>
${imageBlock}${buttons ? `<tr><td style="padding:0 24px 12px">${buttons}</td></tr>` : ''}
${signatureHtml ? `<tr><td style="padding:8px 24px 24px">${signatureHtml}</td></tr>` : '<tr><td style="padding:0 0 16px"></td></tr>'}
</table>
</td></tr></table>
</body>
</html>`;
}

export function smsUrl(phone: string | null, text: string): string | null {
  const e = toE164(phone);
  return e ? `sms:${e}?body=${encodeURIComponent(text)}` : null;
}

/** WhatsApp n'est proposé que pour un numéro mobile. */
export function whatsappUrl(phone: string | null, text: string): string | null {
  const e = toE164(phone);
  return e && phoneType(e) === 'mobile' ? `https://wa.me/${e.slice(1)}?text=${encodeURIComponent(text)}` : null;
}

// ─────────────── Suivi commercial (chiffres calculés, jamais inventés) ───────────────

export interface SalesFunnelStep {
  id: string;
  label: string;
  count: number;
  hint: string;
}

export function salesFunnel(rows: Pick<ProspectRow, 'milestones' | 'demo'>[], activities: Pick<ProspectActivity, 'type' | 'at'>[], sinceISO: string | null): SalesFunnelStep[] {
  const inPeriod = (at: string | undefined) => !!at && (!sinceISO || at >= sinceISO);
  const real = rows.filter((r) => !r.demo);
  const m = (k: keyof ProspectRow['milestones']) => real.filter((r) => inPeriod(r.milestones[k])).length;
  const a = (t: ActivityType) => activities.filter((x) => x.type === t && inPeriod(x.at)).length;
  return [
    { id: 'contacts', label: 'Contacts', count: m('contacted'), hint: 'prospects contactés' },
    { id: 'emails', label: 'E-mails', count: a('email'), hint: 'e-mails enregistrés comme envoyés' },
    { id: 'replies', label: 'Réponses', count: m('replied'), hint: 'prospects ayant répondu' },
    { id: 'calls', label: 'Appels', count: a('call'), hint: 'appels enregistrés' },
    { id: 'followups', label: 'Relances', count: a('task_created'), hint: 'relances programmées' },
    { id: 'demos', label: 'Démonstrations', count: m('demo'), hint: 'démos programmées ou réalisées' },
    { id: 'clients', label: 'Clients', count: m('client'), hint: 'prospects devenus clients' },
  ];
}

// ─────────────── Contrôle des textes (saisie ou IA) ───────────────

const RISKY = [/\bgaranti\w*/i, /\b100\s?%/, /\brévolutionnaire\w*/i, /\bsans aucun risque\b/i, /\bnuméro 1\b/i, /\bmeilleur\w* (outil|logiciel|solution)\b/i];

/** Signale les formulations à éviter (promesses irréalistes). */
export function riskyWording(text: string): string[] {
  return RISKY.flatMap((re) => {
    const m = re.exec(text);
    return m ? [m[0]] : [];
  });
}
