import type { MiddlewareHandler } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import type { AppEnv, Ctx, AdminUser } from './context';
import { hmacHex, randomToken, safeEqual, sha256Hex } from '../lib/crypto';
import { hitRateLimit } from '../lib/ratelimit';

/** En-têtes de sécurité. CSP stricte : aucun script en ligne ; scripts tiers uniquement pour la mesure d'audience choisie. */
export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  const s = c.get('settings');
  const scriptSrc = ["'self'"];
  const connectSrc = ["'self'"];
  if (s?.analyticsProvider === 'plausible') {
    scriptSrc.push('https://plausible.io');
    connectSrc.push('https://plausible.io');
  } else if (s?.analyticsProvider === 'ga4') {
    scriptSrc.push('https://www.googletagmanager.com');
    connectSrc.push('https://*.google-analytics.com', 'https://*.analytics.google.com', 'https://www.googletagmanager.com');
  }
  const h = c.res.headers;
  h.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src ${scriptSrc.join(' ')}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src ${connectSrc.join(' ')}`,
      "frame-src 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'SAMEORIGIN');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (c.get('deps').config.production) h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  const path = new URL(c.req.url).pathname;
  if (path.startsWith('/admin') || path.startsWith('/client')) {
    h.set('Cache-Control', 'no-store');
    h.set('X-Robots-Tag', 'noindex, nofollow');
  }
};

/** Les requêtes qui modifient des données doivent provenir du site lui-même (protection CSRF de base). */
export const sameOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
    const url = new URL(c.req.url);
    const origin = c.req.header('origin');
    const referer = c.req.header('referer');
    const src = origin && origin !== 'null' ? origin : referer;
    let ok = false;
    try {
      ok = !!src && new URL(src).host === url.host;
    } catch {
      ok = false;
    }
    if (!ok) return c.text('Requête refusée (origine non autorisée).', 403);
  }
  await next();
};

// ─── Sessions administrateur ───

const SESSION_HOURS = 12;
export const cookieName = (production: boolean) => (production ? '__Host-agence_session' : 'agence_session');

export async function createSession(c: Ctx, userId: number): Promise<void> {
  const { db, config } = c.get('deps');
  const token = randomToken(32);
  const now = new Date();
  await db.run('INSERT INTO sessions (id, user_id, csrf, created_at, expires_at) VALUES (?, ?, ?, ?, ?)', [
    await sha256Hex(token),
    userId,
    randomToken(24),
    now.toISOString(),
    new Date(now.getTime() + SESSION_HOURS * 3600_000).toISOString(),
  ]);
  await db.run('DELETE FROM sessions WHERE expires_at < ?', [now.toISOString()]);
  setCookie(c, cookieName(config.production), token, {
    httpOnly: true,
    secure: config.production,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession(c: Ctx): Promise<void> {
  const { db, config } = c.get('deps');
  const token = getCookie(c, cookieName(config.production));
  if (token) await db.run('DELETE FROM sessions WHERE id = ?', [await sha256Hex(token)]);
  deleteCookie(c, cookieName(config.production), { path: '/', secure: config.production });
}

/** Charge l'utilisateur connecté (s'il y en a un) et le jeton CSRF de sa session. */
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set('user', null);
  c.set('csrf', '');
  const { db, config } = c.get('deps');
  const token = getCookie(c, cookieName(config.production));
  if (token) {
    const row = await db.get<AdminUser & { csrf: string; expires_at: string }>(
      `SELECT u.id, u.email, u.name, s.csrf, s.expires_at FROM sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.id = ?`,
      [await sha256Hex(token)],
    );
    if (row && row.expires_at > new Date().toISOString()) {
      c.set('user', { id: row.id, email: row.email, name: row.name });
      c.set('csrf', row.csrf);
    }
  }
  await next();
};

/** Accès réservé aux administrateurs connectés + vérification du jeton CSRF sur toute écriture. */
export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get('user')) {
    if (c.req.method === 'GET') return c.redirect(`/admin/connexion?suite=${encodeURIComponent(new URL(c.req.url).pathname)}`);
    return c.text('Session expirée : reconnectez-vous.', 401);
  }
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    const header = c.req.header('x-csrf-token');
    let sent = header ?? '';
    if (!sent) {
      const ct = c.req.header('content-type') ?? '';
      if (ct.includes('form')) {
        const body = await c.req.parseBody({ all: true });
        sent = typeof body._csrf === 'string' ? body._csrf : '';
      }
    }
    if (!sent || !safeEqual(sent, c.get('csrf'))) return c.text('Jeton de sécurité invalide : rechargez la page.', 403);
  }
  await next();
};

// ─── Protection anti-robots des formulaires publics ───

/** Jeton signé contenant l'heure d'affichage du formulaire (piège temporel + preuve d'affichage). */
export async function formToken(secret: string, now = Date.now()): Promise<string> {
  const ts = String(now);
  return `${ts}.${(await hmacHex(secret, `form:${ts}`)).slice(0, 32)}`;
}

/** Vérifie le jeton : signature valide, formulaire affiché depuis au moins 3 s et au plus 24 h. */
export async function checkFormToken(secret: string, token: unknown, now = Date.now()): Promise<'ok' | 'invalid' | 'too_fast' | 'expired'> {
  if (typeof token !== 'string' || !token.includes('.')) return 'invalid';
  const [ts, sig] = token.split('.') as [string, string];
  const expected = (await hmacHex(secret, `form:${ts}`)).slice(0, 32);
  if (!safeEqual(sig, expected)) return 'invalid';
  const age = now - Number(ts);
  if (age < 3000) return 'too_fast';
  if (age > 86_400_000) return 'expired';
  return 'ok';
}

/** Clé de limitation de débit à partir de l'IP HACHÉE (aucune IP stockée en clair). */
export async function ipKey(c: Ctx, scope: string): Promise<string> {
  const { config, clientIp } = c.get('deps');
  return `${scope}:${(await hmacHex(config.appSecret, `ip:${clientIp(c)}`)).slice(0, 24)}`;
}

export async function allowRate(c: Ctx, scope: string, limit: number, windowSeconds: number): Promise<boolean> {
  return hitRateLimit(c.get('deps').db, await ipKey(c, scope), limit, windowSeconds);
}
