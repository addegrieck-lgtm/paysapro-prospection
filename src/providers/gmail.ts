// Envoi direct des e-mails depuis VOTRE adresse Gmail, gratuitement et sans nom de domaine.
//
//   EmailProvider
//   ├── MailtoEmailProvider      (défaut : ouvre le message dans votre messagerie)
//   └── AppsScriptEmailProvider  (facultatif : un petit script Google installé sur votre compte envoie le message)
//
// Solution d'attente : le jour où vous avez un nom de domaine, un fournisseur (Brevo, Resend…) se branche à la place
// en implémentant `DirectEmailSender`, sans toucher aux écrans.
//
// Sécurité : le script vit sur VOTRE compte Google et n'accepte que les demandes portant le code secret généré par
// l'application. L'adresse du script et ce code restent sur cet appareil (jamais dans le code publié ni dans les
// sauvegardes). Aucun envoi groupé : un message à la fois, déclenché par vous.

import { ENRICHMENT_CONFIG } from '../config';

const STORE = 'paysapro.email.gmail';
const URL_RE = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/;

/** Mention ajoutée à chaque e-mail envoyé directement (droit d'opposition). */
export const OPT_OUT_LINE = 'Si vous ne souhaitez plus recevoir de message de ma part, répondez simplement « stop » à cet e-mail.';

export interface GmailConfig {
  url: string;
  secret: string;
}

export interface DirectEmail {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Nom affiché de l'expéditeur */
  name?: string;
}

export interface SendResult {
  /** Envois encore possibles aujourd'hui d'après Google ; null si inconnu */
  remaining: number | null;
}

export interface DirectEmailSender {
  readonly id: string;
  readonly label: string;
  readonly configured: boolean;
  send(email: DirectEmail): Promise<SendResult>;
}

export function newSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function validScriptUrl(url: string): boolean {
  return URL_RE.test(url.trim());
}

/** Code à coller dans Google Apps Script (le code secret y est déjà inscrit). */
export function appsScriptCode(secret: string): string {
  return `// Paysapro Prospection — envoi des e-mails depuis votre adresse Gmail.
// Déploiement : Déployer → Nouveau déploiement → Application Web → Exécuter en tant que : Moi → Accès : Tout le monde.
var SECRET = '${secret}';

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (d.secret !== SECRET) return out({ ok: false, error: 'Accès refusé' });
    if (d.action === 'ping') return out({ ok: true, from: Session.getEffectiveUser().getEmail(), remaining: MailApp.getRemainingDailyQuota() });
    if (!d.to || !d.subject || !d.text) return out({ ok: false, error: 'Message incomplet' });
    if (MailApp.getRemainingDailyQuota() < 1) return out({ ok: false, error: 'Quota Gmail du jour atteint', remaining: 0 });
    var message = { to: d.to, subject: d.subject, body: d.text };
    if (d.html) message.htmlBody = d.html;
    if (d.name) message.name = d.name;
    if (d.image) message.inlineImages = { apercu: Utilities.newBlob(Utilities.base64Decode(d.image.data), d.image.type, 'apercu') };
    MailApp.sendEmail(message);
    return out({ ok: true, remaining: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return out({ ok: false, error: String(err) });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
`;
}

/** Une image incorporée (data:) n'est pas affichée par Gmail : elle part en pièce jointe intégrée (cid). */
export function inlineImage(html: string): { html: string; image: { type: string; data: string } | null } {
  const m = /src="data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)"/.exec(html);
  if (!m) return { html, image: null };
  return { html: html.replace(m[0], 'src="cid:apercu"'), image: { type: m[1]!, data: m[2]! } };
}

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export class AppsScriptEmailProvider implements DirectEmailSender {
  readonly id = 'gmail';
  readonly label = 'Gmail (script Google personnel)';
  private config: GmailConfig | null;
  private fetchImpl: FetchLike;

  private relay: string;

  constructor(config: GmailConfig | null = storedGmailConfig(), fetchImpl: FetchLike = (u, i) => fetch(u, i), relay: string = ENRICHMENT_CONFIG.webProxyUrl) {
    this.config = config && validScriptUrl(config.url) && config.secret ? { url: config.url.trim(), secret: config.secret } : null;
    this.fetchImpl = fetchImpl;
    this.relay = relay.replace(/\/$/, '');
  }

  get configured(): boolean {
    return !!this.config;
  }

  private async call(payload: Record<string, unknown>): Promise<{ from?: string; remaining?: number }> {
    if (!this.config) throw new Error('Envoi direct non configuré (Paramètres → Envoi direct des e-mails).');
    const signed = { ...payload, secret: this.config.secret };
    let res: Awaited<ReturnType<FetchLike>>;
    try {
      // Par le relais (serveur à serveur) quand il existe : appelé directement depuis un navigateur, le script
      // Google répond parfois 404. Sans relais : requête simple « text/plain », acceptée sans vérification préalable.
      res = this.relay
        ? await this.fetchImpl(`${this.relay}/gmail`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: this.config.url, payload: signed }) })
        : await this.fetchImpl(this.config.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(signed), redirect: 'follow' });
    } catch {
      throw new Error(this.relay ? 'Relais injoignable : vérifiez votre connexion.' : 'Script Google injoignable : vérifiez votre connexion et l’adresse du script.');
    }
    if (!res.ok) throw new Error(this.relay ? `Relais indisponible (${res.status}).` : `Script Google indisponible (${res.status}). Vérifiez qu’il est déployé avec l’accès « Tout le monde ».`);
    let data: { ok?: boolean; error?: string; from?: string; remaining?: number };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      throw new Error('Réponse inattendue du script Google : vérifiez l’adresse (elle doit se terminer par /exec) et le déploiement.');
    }
    if (!data.ok) throw new Error(data.error === 'Accès refusé' ? 'Le script a refusé le code secret : recollez le script fourni puis redéployez-le.' : (data.error ?? 'Envoi refusé par le script Google.'));
    return data;
  }

  /** Vérifie la liaison : renvoie l'adresse d'envoi et le quota restant. */
  async ping(): Promise<{ from: string; remaining: number | null }> {
    const d = await this.call({ action: 'ping' });
    return { from: d.from ?? '', remaining: typeof d.remaining === 'number' ? d.remaining : null };
  }

  async send(email: DirectEmail): Promise<SendResult> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.to)) throw new Error('Adresse du destinataire invalide.');
    const rich = email.html ? inlineImage(email.html) : null;
    const d = await this.call({ action: 'send', to: email.to, subject: email.subject, text: email.text, html: rich?.html, image: rich?.image ?? undefined, name: email.name || undefined });
    return { remaining: typeof d.remaining === 'number' ? d.remaining : null };
  }
}

export function storedGmailConfig(): GmailConfig | null {
  try {
    const raw = localStorage.getItem(STORE);
    return raw ? (JSON.parse(raw) as GmailConfig) : null;
  } catch {
    return null;
  }
}

export function saveGmailConfig(config: GmailConfig | null): void {
  try {
    if (config) localStorage.setItem(STORE, JSON.stringify(config));
    else localStorage.removeItem(STORE);
  } catch {
    // stockage indisponible : l'envoi direct reste désactivé
  }
}
