/**
 * Serveur Node.js (poste personnel, VPS) : même API, base SQLite locale, documents sur disque.
 * La veille avance automatiquement : lancement quotidien à 4 h 17 et une étape toutes les 2 minutes tant qu'une
 * veille est en cours. Sans limite d'invocation, une étape peut traiter beaucoup plus qu'un Worker.
 *   npm run start   (après npm run build pour servir l'interface compilée)
 */
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { getConnInfo } from '@hono/node-server/conninfo';
import { Hono } from 'hono';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { openNodeDb } from './db/sqlite-node';
import { prepareDatabase } from './db/bootstrap';
import { createApp } from './app';
import type { FileStorage } from './lib/storage';
import { activeRun, startRun, tick } from './services/sync';
import { purgeExpired } from './services/rgpd';
import { getSettings, setSetting } from './services/settings';

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
  console.warn('[dev] APP_SECRET absent : secret temporaire généré.');
}

const dbPath = resolve(env.DATABASE_PATH ?? './data/radar.db');
mkdirSync(dirname(dbPath), { recursive: true });
const db = openNodeDb(dbPath);
await prepareDatabase(db);
const deps = (env.DEPARTMENTS ?? '').split(',').map((d) => d.trim()).filter(Boolean);
if (deps.length && !(await db.get("SELECT 1 FROM settings WHERE key = 'sync'"))) {
  const s = await getSettings(db);
  await setSetting(db, 'sync', { ...s.sync, departments: deps });
}

const filesDir = resolve(env.FILES_DIR ?? './data/files');
const diskStorage: FileStorage = {
  async put(key, data) {
    const p = join(filesDir, key.replace(/\.\./g, ''));
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, Buffer.from(data));
  },
  async get(key) {
    try {
      const b = await readFile(join(filesDir, key.replace(/\.\./g, '')));
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
    } catch {
      return null;
    }
  },
  async delete(key) {
    await rm(join(filesDir, key.replace(/\.\./g, '')), { force: true });
  },
};

const secrets = { INSEE_API_KEY: env.INSEE_API_KEY, INPI_USERNAME: env.INPI_USERNAME, INPI_PASSWORD: env.INPI_PASSWORD, PAPPERS_API_TOKEN: env.PAPPERS_API_TOKEN, ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
let setupToken = env.SETUP_TOKEN ?? '';
if (!setupToken && !production && !(await db.get('SELECT 1 FROM users LIMIT 1'))) {
  setupToken = randomBytes(12).toString('hex');
  console.log(`[dev] Aucun compte : jeton d'installation temporaire = ${setupToken}`);
}

const app = createApp({
  db,
  fetch: (input, init) => fetch(input, init),
  secrets,
  storage: diskStorage,
  config: { production, setupToken, appSecret },
  clientIp: (c) => {
    if (env.TRUST_PROXY === '1') {
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
root.all('/api/*', (c) => app.fetch(c.req.raw));
if (existsSync('dist/client/index.html')) {
  root.use('/assets/*', serveStatic({ root: './dist/client' }));
  root.use('*', serveStatic({ root: './dist/client' }));
  const index = readFileSync('dist/client/index.html', 'utf8');
  root.get('*', (c) => c.html(index)); // application monopage
}

const port = Number(env.PORT ?? 8788);
serve({ fetch: root.fetch, port, hostname: env.HOST ?? '127.0.0.1' }, (info) => {
  console.log(`Normandie Business Radar : http://localhost:${info.port} (${production ? 'production' : 'développement'})`);
});

// Veille planifiée
const syncEnv = { db, fetch: (input: string, init?: RequestInit) => fetch(input, init), secrets };
let busy = false;
let lastDaily = '';
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    if (env.DISABLE_CRON !== '1' && now.getHours() === 4 && now.getMinutes() >= 17 && lastDaily !== day) {
      lastDaily = day;
      await startRun(syncEnv, 'cron');
      await purgeExpired(db);
    }
    if (await activeRun(db)) await tick(syncEnv, { maxMs: 60_000, maxRequests: 300 });
  } catch (e) {
    console.error('[veille]', (e as Error).message);
  } finally {
    busy = false;
  }
}, 120_000);
