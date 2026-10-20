import type { Db } from '../db/types';

/**
 * E-mails TRANSACTIONNELS uniquement (confirmation de demande, notification interne, envoi de devis / BAT).
 * Aucune campagne marketing n'est envoyée par l'application.
 *
 * Fournisseurs :
 *  • « log »   : aucun envoi réel ; le message est consultable dans Administration → E-mails (développement).
 *  • « brevo » : API Brevo (offre gratuite : 300 e-mails/jour). Variables : BREVO_API_KEY, MAIL_FROM.
 *  • « resend »: API Resend (offre gratuite : 3 000 e-mails/mois). Variables : RESEND_API_KEY, MAIL_FROM.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  kind: 'confirmation' | 'notification' | 'devis' | 'bat' | 'recette' | 'facture';
}

export interface MailConfig {
  provider: 'log' | 'brevo' | 'resend';
  apiKey?: string;
  from?: string;
  fromName?: string;
}

export interface Mailer {
  readonly provider: MailConfig['provider'];
  send(msg: MailMessage): Promise<{ ok: boolean; error?: string }>;
}

export function createMailer(db: Db, cfg: MailConfig, fetchImpl: typeof fetch = fetch): Mailer {
  async function log(msg: MailMessage, status: string, error?: string) {
    // Corps conservé uniquement en mode « log » (développement) ; sinon seul l'objet est journalisé.
    await db.run(
      'INSERT INTO email_log (to_addr, subject, kind, status, provider, error, body, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [msg.to, msg.subject, msg.kind, status, cfg.provider, error ?? null, cfg.provider === 'log' ? msg.text : null, new Date().toISOString()],
    );
  }

  return {
    provider: cfg.provider,
    async send(msg) {
      if (!msg.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(msg.to)) return { ok: false, error: 'Adresse invalide' };
      if (cfg.provider === 'log') {
        await log(msg, 'simule');
        return { ok: true };
      }
      if (!cfg.apiKey || !cfg.from) {
        await log(msg, 'echec', 'Fournisseur e-mail non configuré');
        return { ok: false, error: 'Fournisseur e-mail non configuré' };
      }
      try {
        let res: Response;
        if (cfg.provider === 'brevo') {
          res = await fetchImpl('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: { 'api-key': cfg.apiKey, 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
              sender: { email: cfg.from, name: cfg.fromName },
              to: [{ email: msg.to }],
              subject: msg.subject,
              textContent: msg.text,
              ...(msg.replyTo ? { replyTo: { email: msg.replyTo } } : {}),
            }),
          });
        } else {
          res = await fetchImpl('https://api.resend.com/emails', {
            method: 'POST',
            headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json' },
            body: JSON.stringify({
              from: cfg.fromName ? `${cfg.fromName} <${cfg.from}>` : cfg.from,
              to: [msg.to],
              subject: msg.subject,
              text: msg.text,
              ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
            }),
          });
        }
        if (!res.ok) {
          const err = `HTTP ${res.status}`;
          await log(msg, 'echec', err);
          return { ok: false, error: err };
        }
        await log(msg, 'envoye');
        return { ok: true };
      } catch (e) {
        const err = e instanceof Error ? e.message.slice(0, 200) : 'Erreur réseau';
        await log(msg, 'echec', err);
        return { ok: false, error: err };
      }
    },
  };
}
