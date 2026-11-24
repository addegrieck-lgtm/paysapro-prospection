import { getCookie } from 'hono/cookie';
import type { Ctx } from '../app/context';
import { cookieName } from '../app/security';
import { hmacHex } from '../lib/crypto';
import { todayParis } from '../domain/dates';
import { ANALYTICS_RETENTION_DAYS, classifyOrigin, deviceOf, isBot, isTrackedPath } from '../domain/analytics';

/**
 * Mesure d'audience interne, sans cookie : chaque page publique affichée dans le navigateur d'un visiteur humain est
 * enregistrée avec sa provenance. Le visiteur est identifié par une empreinte du jour (IP + navigateur + date, signée par APP_SECRET) :
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

const MAX_BODY = 2_000;
/** Plafond de pages vues par visiteur et par jour : au-delà, il s'agit d'un automate (aspirateur de site). */
const MAX_VIEWS_PER_DAY = 150;
/** Rechargement de la même page par le même visiteur dans ce délai : non recompté. */
const RELOAD_SECONDS = 30;

/**
 * Réception d'une page vue, envoyée par le navigateur (src/client/site.ts) une fois la page réellement affichée.
 * Mesurer côté navigateur — et non à chaque page servie — écarte la très grande majorité des robots : scanners de
 * failles, aspirateurs, outils d'audit et de surveillance n'exécutent pas le JavaScript, même lorsqu'ils se font passer
 * pour un navigateur ordinaire. L'origine est contrôlée par sameOrigin (en-tête Origin obligatoire).
 */
export const collectPageView = async (c: Ctx) => {
  const done = () => c.body(null, 204);
  const ua = c.req.header('user-agent') ?? '';
  if (isBot(ua) || /prefetch|prerender/i.test(c.req.header('sec-purpose') ?? c.req.header('purpose') ?? '')) return done();
  // Vos propres visites (administrateur connecté) ne sont pas comptées.
  const deps = c.get('deps');
  if (getCookie(c, cookieName(deps.config.production))) return done();

  const text = await c.req.text().catch(() => '');
  if (!text || text.length > MAX_BODY) return done();
  const hit = parseBeacon(text);
  if (!hit) return done();

  const url = new URL(c.req.url);
  const own = [url.hostname, deps.config.canonicalHost ?? ''].filter(Boolean);
  const o = classifyOrigin(hit.referrer || undefined, new URLSearchParams(hit.query), own);
  const now = new Date();
  const day = todayParis(now);
  const country = (c.req.header('cf-ipcountry') ?? '').toUpperCase();
  await background(
    c,
    visitorId(c, day).then(async (visitor) => {
      const recent = await deps.db.get<{ n: number; same: number }>(
        `SELECT COUNT(*) AS n, SUM(path = ? AND created_at >= ?) AS same FROM page_views WHERE day = ? AND visitor = ?`,
        [hit.path, new Date(now.getTime() - RELOAD_SECONDS * 1000).toISOString(), day, visitor],
      );
      if ((recent?.n ?? 0) >= MAX_VIEWS_PER_DAY || (recent?.same ?? 0) > 0) return;
      await deps.db.run(
        `INSERT INTO page_views (day, created_at, path, status, entry, medium, source, campaign, referrer, country, device, visitor)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [day, now.toISOString(), hit.path, hit.status, o.entry ? 1 : 0, o.medium, o.source, o.campaign, o.referrer,
          /^[A-Z]{2}$/.test(country) && country !== 'XX' && country !== 'T1' ? country : '', deviceOf(ua), visitor],
      );
    }),
  );
  return done();
};

/** Lecture du message du navigateur : { p: chemin, q: paramètres, r: page précédente, s: statut 200 | 404 }. */
export function parseBeacon(text: string): { path: string; query: string; referrer: string; status: 200 | 404 } | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  const path = typeof d.p === 'string' ? d.p : '';
  if (!path.startsWith('/') || path.startsWith('//') || !isTrackedPath(path)) return null;
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
  return { path: path.slice(0, 200), query: str(d.q, 500), referrer: str(d.r, 500), status: d.s === 404 ? 404 : 200 };
}

/** Efface les mesures antérieures à un jour donné (données faussées par l'ancien mode de comptage). */
export async function clearPageViewsBefore(c: Ctx, day: string): Promise<void> {
  await c.get('deps').db.run('DELETE FROM page_views WHERE day < ?', [day]);
}

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
    'SELECT medium, source, campaign, path FROM page_views WHERE day = ? AND visitor = ? AND entry = 1 ORDER BY id LIMIT 1',
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
