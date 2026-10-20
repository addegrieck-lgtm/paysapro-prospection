/**
 * Point d'entrée Cloudflare Workers (offre gratuite) : base D1, fichiers privés dans R2,
 * fichiers statiques (public/) servis directement par Cloudflare (Workers Static Assets).
 * Déploiement : voir docs/DEPLOIEMENT.md.
 */
import { createApp, prepareDatabase } from '../app';
import { openD1, type D1Like } from '../db/d1';
import { r2Storage, type R2Like } from '../lib/storage-r2';
import { createMailer, type MailConfig } from '../lib/mail';

interface Env {
  DB: D1Like;
  FILES: R2Like;
  APP_SECRET?: string;
  ADMIN_SETUP_TOKEN?: string;
  MAIL_PROVIDER?: string;
  BREVO_API_KEY?: string;
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
  MAIL_FROM_NAME?: string;
  ENVIRONMENT?: string;
}

let ready: Promise<void> | null = null;

export default {
  async fetch(request: Request, env: Env, ctx: unknown): Promise<Response> {
    if (!env.APP_SECRET || env.APP_SECRET.length < 32) {
      return new Response('Configuration incomplète : secret APP_SECRET manquant (voir docs/DEPLOIEMENT.md).', { status: 500 });
    }
    const db = openD1(env.DB);
    // Migrations appliquées une fois par instance (idempotentes).
    ready ??= prepareDatabase({ db }).catch((e) => {
      ready = null;
      throw e;
    });
    await ready;
    const provider = (['log', 'brevo', 'resend'].includes(env.MAIL_PROVIDER ?? '') ? env.MAIL_PROVIDER : 'log') as MailConfig['provider'];
    const app = createApp({
      db,
      storage: r2Storage(env.FILES),
      mailer: createMailer(db, {
        provider,
        apiKey: provider === 'brevo' ? env.BREVO_API_KEY : env.RESEND_API_KEY,
        from: env.MAIL_FROM,
        fromName: env.MAIL_FROM_NAME,
      }),
      config: { appSecret: env.APP_SECRET, production: env.ENVIRONMENT !== 'development', setupToken: env.ADMIN_SETUP_TOKEN ?? '' },
      clientIp: (c) => c.req.header('cf-connecting-ip') ?? 'inconnu',
    });
    return app.fetch(request, env, ctx as never);
  },
};
