import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { createApp } from '../src/server/app';
import { memoryStorage } from '../src/server/lib/storage';
import { fakeFetch, json, reCompany, S1, S2, testDb } from './helpers';
import { RE_BASE } from '../src/server/connectors/recherche-entreprises';
import { ingestReResult } from '../src/server/connectors/recherche-entreprises';
import { processAnalysisQueue } from '../src/server/services/analysis';
import { getSettings } from '../src/server/services/settings';
import { parseCsv } from '../src/server/lib/tabular';
import type { Db } from '../src/server/db/types';

const SETUP = 'jeton-installation-de-test-123';
const PWD = 'MotDePasse-Solide-2026';

async function setup(opts: { seed?: boolean } = {}) {
  const db = await testDb();
  const f = fakeFetch([[`${RE_BASE}/search`, () => json({ results: [], total_results: 0, page: 1, per_page: 25, total_pages: 0 })]]);
  const app = createApp({ db, fetch: f, secrets: {}, storage: memoryStorage(), config: { production: false, setupToken: SETUP, appSecret: 'x'.repeat(40) }, clientIp: () => '203.0.113.7' });
  let cookie = '';
  const call = async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
    const headers: Record<string, string> = { cookie, ...extra };
    if (method !== 'GET') headers['x-requested-with'] = extra['x-requested-with'] ?? 'radar';
    let payload: BodyInit | undefined;
    if (typeof body === 'string') payload = body;
    else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['content-type'] = 'application/json';
    }
    const res = await app.request(`http://radar.test/api${path}`, { method, headers, body: payload });
    const set = res.headers.get('set-cookie');
    if (set?.startsWith('nbr_session=')) cookie = set.split(';')[0]!;
    return res;
  };
  if (opts.seed) await seed(db);
  return { db, app, call, setCookie: (c: string) => (cookie = c), getCookie: () => cookie };
}

async function seed(db: Db) {
  await ingestReResult({ db, departments: ['76'] }, reCompany(S1) as never, new Date().toISOString());
  await ingestReResult({ db, departments: ['76'] }, reCompany(S2, { nom_raison_sociale: '=CMD()', finances: {} }) as never, new Date().toISOString());
  await processAnalysisQueue(db, await getSettings(db));
}

describe('authentification', () => {
  it('installation avec jeton, puis connexion / déconnexion', async () => {
    const { call } = await setup();
    expect(await (await call('GET', '/auth/status')).json()).toMatchObject({ setupRequired: true, user: null });
    expect((await call('POST', '/auth/setup', { token: 'mauvais', email: 'a@b.fr', name: 'A', password: PWD })).status).toBe(403);
    expect((await call('POST', '/auth/setup', { token: SETUP, email: 'admin@exemple.fr', name: 'Admin', password: 'court' })).status).toBe(400); // mot de passe refusé
    const ok = await call('POST', '/auth/setup', { token: SETUP, email: 'admin@exemple.fr', name: 'Admin', password: PWD });
    expect(ok.status).toBe(200);
    expect(((await (await call('GET', '/auth/status')).json()) as { user: { role: string } }).user.role).toBe('admin');
    expect((await call('POST', '/auth/setup', { token: SETUP, email: 'b@exemple.fr', name: 'B', password: PWD })).status).toBe(409);
    await call('POST', '/auth/logout');
    expect((await call('GET', '/dashboard')).status).toBe(401);
  });

  it('verrouille le compte après 5 échecs et ne révèle pas si le compte existe', async () => {
    const { call } = await setup();
    await call('POST', '/auth/setup', { token: SETUP, email: 'admin@exemple.fr', name: 'Admin', password: PWD });
    await call('POST', '/auth/logout');
    const r1 = await call('POST', '/auth/login', { email: 'inconnu@exemple.fr', password: 'x' });
    const r2 = await call('POST', '/auth/login', { email: 'admin@exemple.fr', password: 'x' });
    expect(await r1.json()).toEqual(await r2.json());
    for (let i = 0; i < 4; i++) await call('POST', '/auth/login', { email: 'admin@exemple.fr', password: 'x' });
    const locked = await call('POST', '/auth/login', { email: 'admin@exemple.fr', password: PWD });
    expect(locked.status).toBe(423);
  });

  it('refuse les écritures sans en-tête anti-CSRF ou depuis une autre origine', async () => {
    const { call } = await setup();
    expect((await call('POST', '/auth/login', { email: 'a', password: 'b' }, { 'x-requested-with': '' })).status).toBe(403);
    expect((await call('POST', '/auth/login', { email: 'a', password: 'b' }, { origin: 'https://malveillant.example' })).status).toBe(403);
  });

  it('le mot de passe est haché, le jeton de session aussi', async () => {
    const { call, db, getCookie } = await setup();
    await call('POST', '/auth/setup', { token: SETUP, email: 'admin@exemple.fr', name: 'Admin', password: PWD });
    const u = await db.get<{ password_hash: string }>('SELECT password_hash FROM users');
    expect(u!.password_hash).toMatch(/^pbkdf2\$/);
    expect(u!.password_hash).not.toContain(PWD);
    const token = getCookie().split('=')[1]!;
    expect(await db.get('SELECT 1 FROM sessions WHERE id = ?', [token])).toBeUndefined();
  });
});

describe('rôles et données', () => {
  async function asAdmin(seedData = true) {
    const s = await setup({ seed: seedData });
    await s.call('POST', '/auth/setup', { token: SETUP, email: 'admin@exemple.fr', name: 'Admin', password: PWD });
    return s;
  }

  it('un lecteur consulte mais ne peut ni exporter ni administrer', async () => {
    const s = await asAdmin();
    expect((await s.call('POST', '/admin/users', { email: 'lecteur@exemple.fr', name: 'L', password: PWD, role: 'lecteur' })).status).toBe(200);
    await s.call('POST', '/auth/logout');
    await s.call('POST', '/auth/login', { email: 'lecteur@exemple.fr', password: PWD });
    expect((await s.call('GET', '/companies')).status).toBe(200);
    expect((await s.call('GET', '/export?format=csv')).status).toBe(403);
    expect((await s.call('GET', '/admin/sources')).status).toBe(403);
    expect((await s.call('POST', '/projects', { companyId: 1 })).status).toBe(403);
  });

  it('liste, fiche avec provenance, tableau de bord et carte', async () => {
    const s = await asAdmin();
    const list = (await (await s.call('GET', '/companies?sort=score')).json()) as { total: number; rows: { id: number; siren: string }[] };
    expect(list.total).toBe(2);
    const id = list.rows.find((r) => r.siren === S1)!.id;
    const d = (await (await s.call(`GET`, `/companies/${id}`)).json()) as Record<string, any>;
    expect(d.provenance.naf_code).toMatchObject({ source_id: 'recherche-entreprises', status: 'officielle' });
    expect(d.indicators.length).toBe(2);
    expect(d.officialLinks.annuaire).toContain(S1);
    const dash = (await (await s.call('GET', '/dashboard')).json()) as Record<string, any>;
    expect(dash.counts.total).toBe(2);
    const map = (await (await s.call('GET', '/map')).json()) as { points: unknown[][] };
    expect(map.points).toHaveLength(2);
    const filtered = (await (await s.call('GET', '/map?hasAccounts=true')).json()) as { points: unknown[][] };
    expect(filtered.points).toHaveLength(1);
  });

  it('exports CSV et Excel protégés contre l\'injection de formules', async () => {
    const s = await asAdmin();
    const csv = await (await s.call('GET', '/export?format=csv')).text();
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(csv).toContain("'=CMD()");
    const xlsx = new Uint8Array(await (await s.call('GET', '/export?format=xlsx')).arrayBuffer());
    const files = unzipSync(xlsx);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain("'=CMD()");
    expect(sheet).toContain(S1);
    expect((await s.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'export'"))!.n).toBe(2);
  });

  it('import CSV : comptes détaillés validés ligne par ligne', async () => {
    const s = await asAdmin();
    const csv = `siren;annee;chiffre_affaires;ebe;resultat_exploitation;resultat_net;capitaux_propres;dettes_financieres;tresorerie\n${S1};2024;1 000 000;150000;110000;80000;300000;50000;90000\n123;2024;1;1;1;1;1;1;1\n`;
    const r = (await (await s.call('POST', '/admin/import/comptes', csv)).json()) as { imported: number; errors: { line: number; message: string }[] };
    expect(r.imported).toBe(1);
    expect(r.errors[0]!.line).toBe(3);
    const fin = await s.db.get<Record<string, unknown>>("SELECT revenue, ebe, status, source_id FROM company_financials WHERE fiscal_year = 2024");
    expect(fin).toEqual({ revenue: 1000000, ebe: 150000, status: 'declarative', source_id: 'import-manuel' });
  });

  it('import d\'annonces de cession : « officiellement à vendre » avec alerte', async () => {
    const s = await asAdmin();
    const csv = `titre;type;prix;commune;siren;url;source\nCession agence web Rouen;societe;350000;Rouen;${S1};https://exemple.test/annonce;Cabinet de cession\n`;
    expect(((await (await s.call('POST', '/admin/import/annonces', csv)).json()) as { imported: number }).imported).toBe(1);
    const opp = await s.db.get<{ primary_type: string }>('SELECT o.primary_type FROM acquisition_opportunities o JOIN companies c ON c.id = o.company_id WHERE c.siren = ?', [S1]);
    expect(opp!.primary_type).toBe('a_vendre');
    expect((await s.db.get<{ n: number }>("SELECT COUNT(*) AS n FROM alerts WHERE type = 'nouvelle_vente'"))!.n).toBe(1);
  });

  it('Acquisition Manager : projet, prix demandé (pris en compte dans le score), notes, documents, scénarios', async () => {
    const s = await asAdmin();
    const id = (await s.db.get<{ id: number }>('SELECT id FROM companies WHERE siren = ?', [S1]))!.id;
    // Comptes détaillés nécessaires à une valorisation (sinon le critère « prix » reste non évalué)
    await s.call('POST', '/admin/import/comptes', `siren;annee;chiffre_affaires;ebe;resultat_net;capitaux_propres\n${S1};2023;900000;120000;55000;250000\n`);
    const pid = ((await (await s.call('POST', '/projects', { companyId: id })).json()) as { id: number }).id;
    expect((await s.call('PATCH', `/projects/${pid}`, { status: 'a_contacter', asking_price: 300000 })).status).toBe(200);
    const detail = (await (await s.call('GET', `/projects/${pid}`)).json()) as { notes: { content: string }[] };
    expect(detail.notes.map((n) => n.content).join(' ')).toContain('À contacter');
    const score = await s.db.get<{ detail: string }>('SELECT detail FROM scoring_results WHERE company_id = ?', [id]);
    expect(JSON.parse(score!.detail).economic.find((c: { key: string }) => c.key === 'prix').value).not.toBeNull();
    const form = new FormData();
    form.append('file', new File([new Uint8Array([37, 80, 68, 70])], 'bilan.pdf', { type: 'application/pdf' }));
    const app = s.app;
    const up = await app.request(`http://radar.test/api/projects/${pid}/documents`, { method: 'POST', headers: { cookie: s.getCookie(), 'x-requested-with': 'radar' }, body: form });
    expect(up.status).toBe(200);
    const bad = new FormData();
    bad.append('file', new File(['x'], 'script.exe'));
    expect((await app.request(`http://radar.test/api/projects/${pid}/documents`, { method: 'POST', headers: { cookie: s.getCookie(), 'x-requested-with': 'radar' }, body: bad })).status).toBe(400);
    const sc = (await (await s.call('POST', '/scenarios', { companyId: id, save: { projectId: pid, name: 'Test' } })).json()) as { available: boolean; priceOrigin: string; results: unknown[] };
    expect(sc.available).toBe(true);
    expect(sc.priceOrigin).toMatch(/prix demandé/);
    expect(sc.results).toHaveLength(3);
  });

  it('RADAR AI local : répond à partir des données, sans inventer', async () => {
    const s = await asAdmin();
    const top = (await (await s.call('POST', '/assistant', { question: 'Quelles sont les 10 meilleures opportunités du 76 ?' })).json()) as { answer: string; mode: string; uncertainties: string[] };
    expect(top.mode).toBe('local');
    expect(top.answer).toContain(`SIREN ${S1}`);
    expect(top.uncertainties.join(' ')).toMatch(/veille|prospection/);
    const prix = (await (await s.call('POST', '/assistant', { question: `Quel prix maximum pour ${S2} ?` })).json()) as { answer: string };
    expect(prix.answer).toMatch(/impossible d'estimer/i);
    const vendeur = (await (await s.call('POST', '/assistant', { question: 'Quelles informations dois-je demander au vendeur ?' })).json()) as { answer: string };
    expect(vendeur.answer).toContain('Liasses fiscales');
  });

  it('RADAR AI sans données : refuse de répondre au lieu d\'inventer', async () => {
    const s = await asAdmin(false);
    const r = (await (await s.call('POST', '/assistant', { question: 'Top 10 des opportunités' })).json()) as { answer: string };
    expect(r.answer).toMatch(/aucune entreprise/);
  });

  it('sauvegarde puis restauration à l\'identique', async () => {
    const s = await asAdmin();
    const backup = await (await s.call('GET', '/admin/backup')).json();
    expect((await s.call('POST', '/admin/restore', { format: 'autre' })).status).toBe(400);
    await s.db.run('DELETE FROM companies');
    expect((await s.call('POST', '/admin/restore', backup)).status).toBe(200);
    expect((await s.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM companies'))!.n).toBe(2);
    expect((await s.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))!.n).toBe(1);
    // Les sessions sont invalidées par la restauration
    expect((await s.call('GET', '/dashboard')).status).toBe(401);
  });

  it('effacement RGPD : suppression et opposition à la réimportation', async () => {
    const s = await asAdmin();
    expect(((await (await s.call('POST', '/admin/rgpd/erase', { siren: S1, reason: 'Demande de la personne' })).json()) as { erased: boolean }).erased).toBe(true);
    expect(await s.db.get('SELECT 1 FROM companies WHERE siren = ?', [S1])).toBeUndefined();
    await ingestReResult({ db: s.db, departments: ['76'] }, reCompany(S1) as never, new Date().toISOString());
    expect(await s.db.get('SELECT 1 FROM companies WHERE siren = ?', [S1])).toBeUndefined();
  });

  it('administration des sources : activation et état des clés (jamais leur valeur)', async () => {
    const s = await asAdmin();
    const src = (await (await s.call('GET', '/admin/sources')).json()) as { sources: { id: string; enabled: boolean; secrets: Record<string, boolean> }[] };
    expect(src.sources.find((x) => x.id === 'insee-sirene')!.secrets).toEqual({ INSEE_API_KEY: false });
    await s.call('PATCH', '/admin/sources/bodacc', { enabled: false });
    const after = (await (await s.call('GET', '/admin/sources')).json()) as { sources: { id: string; enabled: boolean }[] };
    expect(after.sources.find((x) => x.id === 'bodacc')!.enabled).toBe(false);
  });
});
