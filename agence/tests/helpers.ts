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
