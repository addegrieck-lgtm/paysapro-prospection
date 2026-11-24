import { describe, expect, it } from 'vitest';
import { adminSession, makeApp, ORIGIN, req } from './helpers';
import { isHostingNetwork } from '../src/domain/analytics';
import { migrate } from '../src/db/migrations';

const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const count = async (db: Awaited<ReturnType<typeof makeApp>>['db']) => (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM page_views'))!.n;

/** Page vue envoyée par le navigateur, avec l'opérateur réseau que Cloudflare fournit (request.cf.asOrganization). */
function beacon(path: string, opts: { network?: string; cookie?: string } = {}) {
  const r = new Request(`${ORIGIN}/api/v`, {
    method: 'POST',
    body: JSON.stringify({ p: path, q: '', r: '', s: 200 }),
    headers: { 'user-agent': DESKTOP, 'content-type': 'text/plain', origin: ORIGIN, ...(opts.cookie ? { cookie: opts.cookie } : {}) },
  });
  if (opts.network) Object.defineProperty(r, 'cf', { value: { asOrganization: opts.network } });
  return r;
}

describe('statistiques : fausses visites exclues', () => {
  it('reconnaît les réseaux d’hébergement, pas les fournisseurs d’accès', () => {
    for (const n of ['Amazon.com, Inc.', 'Google LLC', 'Microsoft Corporation', 'OVH SAS', 'Hetzner Online GmbH', 'DigitalOcean, LLC', 'Scaleway S.A.S.', 'Contabo GmbH'])
      expect(isHostingNetwork(n), n).toBe(true);
    for (const n of ['Orange', 'Free SAS', 'Free Mobile SAS', 'Societe Francaise Du Radiotelephone - SFR SA', 'Bouygues Telecom SA', 'Proximus NV'])
      expect(isHostingNetwork(n), n).toBe(false);
  });

  it('ignore le trafic des centres de données et compte celui des box', async () => {
    const { app, db } = await makeApp();
    await app.request(beacon('/tarifs', { network: 'Amazon.com, Inc.' }));
    await app.request(beacon('/', { network: 'Google LLC' }));
    expect(await count(db)).toBe(0);
    await app.request(beacon('/', { network: 'Free SAS' }));
    expect(await count(db)).toBe(1);
  });

  it('un appareil passé par l’administration n’est plus compté, même déconnecté', async () => {
    const { app, db } = await makeApp();
    const s = await adminSession(app, db);
    const res = await s.get('/admin/statistiques');
    const owner = (res.headers.get('set-cookie') ?? '').match(/ss_exploitant=1/);
    expect(owner).not.toBeNull();
    expect(res.headers.get('set-cookie')).toMatch(/ss_exploitant=1;[^,]*Max-Age=34560000/);
    await app.request(beacon('/tarifs', { cookie: 'ss_exploitant=1' }));
    expect(await count(db)).toBe(0);
    await req(app, '/api/v', { method: 'POST', body: JSON.stringify({ p: '/tarifs' }), headers: { 'user-agent': DESKTOP } });
    expect(await count(db)).toBe(1);
  });

  it('migration 15 : efface les pages vues de l’ancienne mesure, garde les demandes', async () => {
    const { db } = await makeApp();
    await db.run("INSERT INTO page_views (day, created_at, path, status, entry, medium, source, campaign, referrer, country, device, visitor) VALUES ('2026-11-01', '2026-11-01T10:00:00Z', '/', 200, 1, 'direct', '', '', '', 'US', 'ordinateur', 'abc')");
    const before = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_requests').catch(() => null);
    await db.run('DELETE FROM schema_migrations WHERE version = 15');
    expect(await migrate(db)).toEqual([15]);
    expect(await count(db)).toBe(0);
    if (before) expect(await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM quote_requests')).toEqual(before);
  });
});
