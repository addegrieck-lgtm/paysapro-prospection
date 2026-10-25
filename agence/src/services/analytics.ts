import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import type { AppEnv, Ctx } from '../app/context';
import { cookieName } from '../app/security';
import { hmacHex } from '../lib/crypto';
import { todayParis } from '../domain/dates';
import { ANALYTICS_RETENTION_DAYS, classifyOrigin, deviceOf, isBot, isHostingNetwork, isTrackedPath } from '../domain/analytics';

/**
 * Mesure d'audience interne, sans cookie : chaque page publique affichée à un visiteur humain est enregistrée avec sa
 * provenance. Le visiteur est identifié par une empreinte du jour (IP + navigateur + date, signée par APP_SECRET) :
 * elle change chaque jour, ne permet pas de retrouver l'adresse IP et ne suit personne d'un jour à l'autre.
 */
async function visitorId(c: Ctx, day: string): Promise<string> {
  const { config, clientIp } = c.get('deps');
  return (await hmacHex(config.appSecret, `visiteur|${day}|${clientIp(c)}|${c.req.header('user-agent') ?? ''}`)).slice(0, 16);
}

/** Exécute une écriture après la réponse quand l'environnement le permet (Cloudflare), sinon l'attend. */
async function background(c: Ctx, task: Promise<unknown>): Promise<void> {
  const safe = task.catch((e) => console.error(`[statistiques] ${e instanceof Error ? e.message : String(e)}`));
  try {
    c.executionCtx.waitUntil(safe);
  } catch {
    await safe;
  }
}

export const trackPageView: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  if (c.req.method !== 'GET' || (c.res.status !== 200 && c.res.status !== 404)) return;
  const url = new URL(c.req.url);
  if (!isTrackedPath(url.pathname) || !(c.res.headers.get('content-type') ?? '').includes('text/html')) return;
  const ua = c.req.header('user-agent') ?? '';
  if (isBot(ua) || /prefetch|prerender/i.test(c.req.header('sec-purpose') ?? c.req.header('purpose') ?? '')) return;
  // Requête venue d'un centre de données (Cloudflare indique le réseau d'origine) : robot, même déguisé en navigateur
  if (isHostingNetwork((c.req.raw as Request & { cf?: { asn?: number } }).cf?.asn)) return;
  // Vos propres visites (administrateur connecté) ne sont pas comptées.
  const deps = c.get('deps');
  if (getCookie(c, cookieName(deps.config.production))) return;

  const own = [url.hostname, deps.config.canonicalHost ?? ''].filter(Boolean);
  const o = classifyOrigin(c.req.header('referer'), url.searchParams, own);
  const now = new Date();
  const day = todayParis(now);
  const country = (c.req.header('cf-ipcountry') ?? '').toUpperCase();
  await background(
    c,
    visitorId(c, day).then((visitor) =>
      deps.db.run(
        `INSERT INTO page_views (day, created_at, path, status, entry, medium, source, campaign, referrer, country, device, visitor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [day, now.toISOString(), url.pathname.slice(0, 200), c.res.status, o.entry ? 1 : 0, o.medium, o.source, o.campaign, o.referrer,
          /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : '', deviceOf(ua), visitor],
      ),
    ),
  );
};

/**
 * Enregistre une demande (devis ou message) avec la provenance de la visite du jour qui l'a précédée : première entrée
 * sur le site, aujourd'hui, du même visiteur. Sans visite retrouvée : « inconnue ».
 */
export async function recordConversion(c: Ctx, kind: 'devis' | 'contact', refId: number): Promise<void> {
  // La demande est déjà enregistrée : un incident de mesure ne doit jamais la faire échouer.
  await background(c, saveConversion(c, kind, refId));
}

async function saveConversion(c: Ctx, kind: 'devis' | 'contact', refId: number): Promise<void> {
  const { db } = c.get('deps');
  const now = new Date();
  const day = todayParis(now);
  const visitor = await visitorId(c, day);
  const entry = await db.get<{ medium: string; source: string; campaign: string; path: string }>(
    'SELECT medium, source, campaign, path FROM page_views WHERE status = 200 AND day = ? AND visitor = ? AND entry = 1 ORDER BY id LIMIT 1',
    [day, visitor],
  );
  await db.run(
    'INSERT INTO conversions (day, created_at, kind, ref_id, medium, source, campaign, landing, visitor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [day, now.toISOString(), kind, refId, entry?.medium ?? 'inconnu', entry?.source ?? '', entry?.campaign ?? '', entry?.path ?? '', visitor],
  );
}

/** Supprime les mesures plus anciennes que la durée de conservation. */
export async function purgeAnalytics(c: Ctx): Promise<void> {
  const { db } = c.get('deps');
  const limit = new Date(Date.now() - ANALYTICS_RETENTION_DAYS * 86_400_000).toISOString().slice(0, 10);
  await db.batch([
    { sql: 'DELETE FROM page_views WHERE day < ?', params: [limit] },
    { sql: 'DELETE FROM conversions WHERE day < ?', params: [limit] },
  ]);
}
