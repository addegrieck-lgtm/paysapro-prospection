/**
 * Point d'entrée Cloudflare Workers : API (/api/*), interface (Workers Static Assets, dist/client) et veille
 * planifiée (Cron Triggers). Voir docs/DEPLOIEMENT.md.
 *
 *  - « 17 4 * * * »  : lancement de la veille quotidienne + purge RGPD
 *  - « *\/15 * * * * » : une étape de veille (lot borné en temps et en requêtes ; reprise automatique)
 */
import { createApp } from './app';
import { openD1, type D1Like } from './db/d1';
import { prepareDatabase } from './db/bootstrap';
import { kvStorage, r2Storage, type KVLike, type R2Like } from './lib/storage';
import { startRun, tick } from './services/sync';
import { purgeExpired } from './services/rgpd';
import { getSettings, setSetting } from './services/settings';
import type { Secrets } from './connectors/types';

interface Env extends Secrets {
  DB: D1Like;
  FILES_KV?: KVLike;
  FILES?: R2Like;
  APP_SECRET?: string;
  SETUP_TOKEN?: string;
  ENVIRONMENT?: string;
  DEPARTMENTS?: string;
}

interface ExecCtx {
  waitUntil(p: Promise<unknown>): void;
}

let ready: Promise<void> | null = null;

async function init(env: Env) {
  const db = openD1(env.DB);
  ready ??= (async () => {
    await prepareDatabase(db);
    // Départements initiaux depuis la configuration (modifiables ensuite dans l'administration)
    const s = await getSettings(db);
    const fromEnv = (env.DEPARTMENTS ?? '').split(',').map((d) => d.trim()).filter(Boolean);
    const stored = await db.get("SELECT 1 FROM settings WHERE key = 'sync'");
    if (!stored && fromEnv.length) await setSetting(db, 'sync', { ...s.sync, departments: fromEnv });
  })().catch((e) => {
    ready = null;
    throw e;
  });
  await ready;
  return db;
}

const secrets = (env: Env): Secrets => ({
  INSEE_API_KEY: env.INSEE_API_KEY,
  INPI_USERNAME: env.INPI_USERNAME,
  INPI_PASSWORD: env.INPI_PASSWORD,
  PAPPERS_API_TOKEN: env.PAPPERS_API_TOKEN,
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
});

export default {
  async fetch(request: Request, env: Env, ctx: ExecCtx): Promise<Response> {
    if (!env.APP_SECRET || env.APP_SECRET.length < 32) return new Response('Configuration incomplète : secret APP_SECRET manquant (voir docs/DEPLOIEMENT.md).', { status: 500 });
    if (!env.FILES && !env.FILES_KV) return new Response('Configuration incomplète : aucun stockage de documents lié (FILES_KV ou FILES).', { status: 500 });
    const db = await init(env);
    const app = createApp({
      db,
      fetch: (input, init) => fetch(input, init),
      secrets: secrets(env),
      storage: env.FILES ? r2Storage(env.FILES) : kvStorage(env.FILES_KV!),
      config: { production: env.ENVIRONMENT !== 'development', setupToken: env.SETUP_TOKEN ?? '', appSecret: env.APP_SECRET },
      clientIp: (c) => c.req.header('cf-connecting-ip') ?? 'inconnu',
    });
    return app.fetch(request, env, ctx as never);
  },

  async scheduled(event: { cron: string }, env: Env, ctx: ExecCtx): Promise<void> {
    const db = await init(env);
    const syncEnv = { db, fetch: (input: string, init?: RequestInit) => fetch(input, init), secrets: secrets(env) };
    const work = (async () => {
      if (event.cron === '17 4 * * *') {
        await startRun(syncEnv, 'cron');
        await purgeExpired(db);
      }
      await tick(syncEnv, { maxMs: 25_000, maxRequests: 45 });
    })();
    ctx.waitUntil(work);
    await work;
  },
};
