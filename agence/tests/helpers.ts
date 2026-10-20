import { openNodeDb } from '../src/db/sqlite-node';
import { memoryStorage } from '../src/lib/storage';
import { createMailer } from '../src/lib/mail';
import { createApp, prepareDatabase } from '../src/app';
import type { Deps } from '../src/app/context';

export const ORIGIN = 'http://localhost';

export async function makeApp(over: Partial<Deps> = {}) {
  const db = openNodeDb(':memory:');
  await prepareDatabase({ db });
  const deps: Deps = {
    db,
    storage: memoryStorage(),
    mailer: createMailer(db, { provider: 'log' }),
    config: { appSecret: 'test-secret-test-secret-test-secret-123', production: false, setupToken: 'setup-token-for-tests' },
    clientIp: () => '203.0.113.7',
    ...over,
  };
  const app = createApp(deps);
  return { app, deps, db };
}

/** Requête « navigateur » : même origine. */
export function req(app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> }, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET' && !headers.has('origin')) headers.set('origin', ORIGIN);
  return app.request(`${ORIGIN}${path}`, { ...init, headers });
}

import { hashPassword } from '../src/lib/crypto';

/** Crée un administrateur, se connecte, et retourne un client HTTP qui envoie cookie + jeton CSRF. */
export async function adminSession(app: Awaited<ReturnType<typeof makeApp>>['app'], db: Awaited<ReturnType<typeof makeApp>>['db']) {
  await db.run('INSERT INTO admin_users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)', ['admin@example.com', 'Admin', await hashPassword('motdepasse-test-2026'), new Date().toISOString()]);
  const login = await req(app, '/admin/connexion', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ email: 'admin@example.com', password: 'motdepasse-test-2026', suite: '/admin' }),
  });
  if (login.status !== 303) throw new Error(`connexion échouée : ${login.status}`);
  const cookie = login.headers.get('set-cookie')!.split(';')[0]!;
  const dash = await req(app, '/admin', { headers: { cookie } });
  const csrf = (await dash.text()).match(/name="_csrf" value="([^"]+)"/)![1]!;
  const get = (path: string) => req(app, path, { headers: { cookie } });
  const post = (path: string, data: Record<string, string | string[]> = {}, opts: { csrf?: boolean } = {}) => {
    const body = new URLSearchParams();
    if (opts.csrf !== false) body.append('_csrf', csrf);
    for (const [k, v] of Object.entries(data)) for (const x of Array.isArray(v) ? v : [v]) body.append(k, x);
    return req(app, path, { method: 'POST', body, headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' } });
  };
  const postMultipart = (path: string, fd: FormData) => {
    fd.append('_csrf', csrf);
    return req(app, path, { method: 'POST', body: fd, headers: { cookie } });
  };
  return { cookie, csrf, get, post, postMultipart };
}
