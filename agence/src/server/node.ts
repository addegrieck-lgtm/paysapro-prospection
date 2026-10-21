/**
 * Serveur Node.js (VPS, Render, Railway, Fly.io…).
 *   npm run build && npm start
 * Variables d'environnement : voir .env.example.
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openNodeDb } from '../db/sqlite-node';
import { diskStorage } from '../lib/storage-node';
import { createMailer, type MailConfig } from '../lib/mail';
import { createApp, prepareDatabase } from '../app';

// Chargement du fichier .env s'il existe (les variables déjà définies par l'hébergeur restent prioritaires).
if (existsSync('.env')) process.loadEnvFile('.env');
const env = process.env;
const production = env.NODE_ENV === 'production';

let appSecret = env.APP_SECRET ?? '';
if (appSecret.length < 32) {
  if (production) {
    console.error('APP_SECRET manquant ou trop court (32 caractères minimum). Arrêt.');
    process.exit(1);
  }
  appSecret = randomBytes(32).toString('hex');
  console.warn('[dev] APP_SECRET absent : secret temporaire généré (les formulaires ouverts seront invalidés au redémarrage).');
}

const dbPath = resolve(env.DATABASE_PATH ?? './data/agence.db');
mkdirSync(dirname(dbPath), { recursive: true });
const db = openNodeDb(dbPath);
await prepareDatabase({ db });

const provider = (env.MAIL_PROVIDER ?? 'log') as MailConfig['provider'];
const mailer = createMailer(db, {
  provider: ['log', 'brevo', 'resend'].includes(provider) ? provider : 'log',
  apiKey: provider === 'brevo' ? env.BREVO_API_KEY : env.RESEND_API_KEY,
  from: env.MAIL_FROM,
  fromName: env.MAIL_FROM_NAME,
});

const trustProxy = env.TRUST_PROXY === '1';
const app = createApp({
  db,
  storage: diskStorage(env.UPLOAD_DIR ?? './data/uploads'),
  mailer,
  config: { appSecret, production, setupToken: env.ADMIN_SETUP_TOKEN ?? '' },
  clientIp: (c) => {
    if (trustProxy) {
      const fwd = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
      if (fwd) return fwd;
    }
    try {
      return getConnInfo(c).remote.address ?? 'inconnu';
    } catch {
      return 'inconnu';
    }
  },
});

const root = new Hono();
root.use(
  '/assets/*',
  serveStatic({
    root: './public',
    onFound: (path, c) => {
      const long = path.includes('/fonts/') ? 'public, max-age=31536000, immutable' : 'public, max-age=3600, stale-while-revalidate=86400';
      c.header('Cache-Control', production ? long : 'no-cache');
      c.header('X-Content-Type-Options', 'nosniff');
    },
  }),
);
// Toute autre requête est confiée à l'application (y compris sa page 404 et sa gestion d'erreurs).
root.all('*', (c) => app.fetch(c.req.raw, c.env));

const port = Number(env.PORT ?? 3000);
serve({ fetch: root.fetch, port, hostname: env.HOST ?? '0.0.0.0' }, (info) => {
  console.log(`Agence : http://localhost:${info.port} (${production ? 'production' : 'développement'}, e-mails : ${mailer.provider})`);
});
