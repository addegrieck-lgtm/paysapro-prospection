/**
 * API HTTP (Hono) — identique sur Cloudflare Workers et Node.js.
 * Sécurité : sessions par cookie HttpOnly/SameSite=Strict, en-tête anti-CSRF obligatoire sur les écritures,
 * contrôle d'origine, rôles, validation zod de toutes les entrées, requêtes SQL paramétrées, limites de taille et
 * de débit, journal d'audit, en-têtes de sécurité.
 */
import { Hono, type Context, type Next } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import { z } from 'zod';
import type { Db } from './db/types';
import type { Secrets } from './connectors/types';
import { ALL_SOURCES, CONNECTORS, sourceMeta } from './connectors/registry';
import type { FetchLike } from './lib/http';
import { sha256Hex, safeEqual } from './lib/crypto';
import { hitRateLimit } from './lib/ratelimit';
import { toCsv, toXlsx } from './lib/tabular';
import { ALLOWED_TYPES, MAX_FILE_BYTES, type FileStorage } from './lib/storage';
import { changePassword, createUser, login, logout, ROLE_RANK, sessionUser, SESSION_COOKIE, SESSION_DAYS, userCount, type Role, type SessionUser } from './services/auth';
import { searchCompanies, SearchSchema } from './services/search';
import { companyDetail, dashboard, mapPoints } from './services/views';
import { listAlerts } from './services/alerts';
import { ALERT_TYPES, getSettings, setSetting, DEFAULT_SETTINGS, type AppSettings } from './services/settings';
import { activeRun, cancelRun, startRun, tick } from './services/sync';
import { queueAll, processAnalysisQueue, loadFinancials } from './services/analysis';
import { ask } from './services/assistant';
import { ContactInput, ensureProject, listProjects, NoteInput, PROJECT_STATUSES, ProjectPatch, projectDetail, updateProject, upcomingReminders } from './services/projects';
import { createBackup, exportRows, importCsv, IMPORT_TEMPLATES, restoreBackup, type ImportKind } from './services/io';
import { eraseCompany, PROCESSING_REGISTER, purgeExpired } from './services/rgpd';
import { queueAnalysis, upsertCompany } from './services/companies';
import { SECTORS, HEADCOUNT_BANDS, LEGAL_FORMS } from './domain/sectors';
import { OPPORTUNITY_LABELS } from './domain/opportunities';
import { PROC_STATUS_LABELS, PROC_TYPE_LABELS } from './domain/proceedings';
import { defaultScenarios, runScenario, type ScenarioParams } from './domain/scenarios';
import { ebeOf } from './domain/financial';
import { randomToken } from './lib/crypto';

export interface AppDeps {
  db: Db;
  fetch: FetchLike;
  secrets: Secrets;
  storage: FileStorage;
  config: { production: boolean; setupToken: string; appSecret: string };
  clientIp: (c: Context) => string;
}

/** Erreur métier renvoyée telle quelle (400). */
class HttpFail extends Error {}

type Env = { Variables: { user: SessionUser; ipHash: string } };

const ok = (c: Context, data: unknown, status = 200) => c.json(data as object, status as 200);
const fail = (c: Context, message: string, status = 400) => c.json({ error: message }, status as 400);

export function createApp(deps: AppDeps) {
  const { db } = deps;
  const app = new Hono<Env>().basePath('/api');

  app.use('*', secureHeaders({ contentSecurityPolicy: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] }, referrerPolicy: 'same-origin' }));
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    c.set('ipHash', (await sha256Hex(`${deps.config.appSecret}:${deps.clientIp(c)}`)).slice(0, 32));
    // Anti-CSRF : toute écriture exige un en-tête personnalisé (impossible à poser depuis un autre site sans CORS)
    // et, si présent, une origine identique.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) {
      if (c.req.header('x-requested-with') !== 'radar') return fail(c, 'Requête refusée (en-tête de sécurité manquant).', 403);
      const origin = c.req.header('origin');
      if (origin && new URL(origin).host !== new URL(c.req.url).host) return fail(c, 'Origine refusée.', 403);
    }
    await next();
  });
  app.use('*', bodyLimit({ maxSize: 25 * 1024 * 1024, onError: (c) => fail(c, 'Contenu trop volumineux.', 413) }));
  app.onError((err, c) => {
    if (err instanceof HttpFail) return fail(c, err.message, 400);
    if (err instanceof z.ZodError) return fail(c, `Données invalides : ${err.issues.map((i) => `${i.path.join('.') || 'champ'} — ${i.message}`).join(' ; ')}`, 400);
    console.error(err);
    return fail(c, deps.config.production ? 'Erreur interne.' : `Erreur interne : ${err.message}`, 500);
  });

  const audit = (c: Context<Env>, action: string, entityType?: string, entityId?: string | number, details?: unknown) =>
    db.run('INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_hash) VALUES (?, ?, ?, ?, ?, ?)', [c.get('user')?.id ?? null, action, entityType ?? null, entityId === undefined ? null : String(entityId), details === undefined ? null : JSON.stringify(details).slice(0, 2000), c.get('ipHash')]);

  const requireRole = (role: Role) => async (c: Context<Env>, next: Next) => {
    const user = await sessionUser(db, getCookie(c, SESSION_COOKIE));
    if (!user) return fail(c, 'Authentification requise.', 401);
    if (ROLE_RANK[user.role] < ROLE_RANK[role]) return fail(c, 'Droits insuffisants.', 403);
    c.set('user', user);
    await next();
  };
  const reader = requireRole('lecteur');
  const analyst = requireRole('analyste');
  const admin = requireRole('admin');
  const idParam = (c: Context) => z.coerce.number().int().positive().parse(c.req.param('id'));

  // --- Santé et authentification -------------------------------------------------
  app.get('/health', async (c) => ok(c, { ok: true, time: new Date().toISOString() }));

  app.get('/auth/status', async (c) => ok(c, { setupRequired: (await userCount(db)) === 0, setupTokenConfigured: !!deps.config.setupToken, user: await sessionUser(db, getCookie(c, SESSION_COOKIE)) }));

  const cookieOpts = { httpOnly: true, secure: deps.config.production, sameSite: 'Strict' as const, path: '/', maxAge: SESSION_DAYS * 86400 };

  app.post('/auth/setup', async (c) => {
    const b = z.object({ token: z.string().max(200), email: z.string().max(200), name: z.string().min(1).max(100), password: z.string().max(200) }).parse(await c.req.json());
    if (!(await hitRateLimit(db, `setup:${c.get('ipHash')}`, 5, 900))) return fail(c, 'Trop de tentatives.', 429);
    if ((await userCount(db)) > 0) return fail(c, 'Installation déjà effectuée.', 409);
    if (!deps.config.setupToken || deps.config.setupToken.length < 16 || !safeEqual(b.token, deps.config.setupToken)) return fail(c, "Jeton d'installation invalide (secret SETUP_TOKEN, 16 caractères minimum).", 403);
    let id: number;
    try {
      id = await createUser(db, { email: b.email, name: b.name, password: b.password, role: 'admin' });
    } catch (e) {
      return fail(c, (e as Error).message);
    }
    await db.run("INSERT INTO audit_logs (user_id, action, ip_hash) VALUES (?, 'installation', ?)", [id, c.get('ipHash')]);
    const r = await login(db, b.email, b.password, c.get('ipHash'), c.req.header('user-agent') ?? null);
    if (r.ok) setCookie(c, SESSION_COOKIE, r.token, cookieOpts);
    return ok(c, { ok: true });
  });

  app.post('/auth/login', async (c) => {
    const b = z.object({ email: z.string().max(200), password: z.string().max(200) }).parse(await c.req.json());
    const r = await login(db, b.email, b.password, c.get('ipHash'), c.req.header('user-agent') ?? null);
    if (!r.ok) return fail(c, r.error, r.status);
    setCookie(c, SESSION_COOKIE, r.token, cookieOpts);
    return ok(c, { user: r.user });
  });

  app.post('/auth/logout', async (c) => {
    await logout(db, getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return ok(c, { ok: true });
  });

  app.post('/auth/password', reader, async (c) => {
    const b = z.object({ current: z.string().max(200), next: z.string().max(200) }).parse(await c.req.json());
    await changePassword(db, c.get('user').id, b.current, b.next).catch((e: Error) => {
      throw new HttpFail(e.message);
    });
    await audit(c, 'mot_de_passe');
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return ok(c, { ok: true });
  });

  // --- Référentiels -------------------------------------------------------------
  app.get('/meta', reader, async (c) => {
    const settings = await getSettings(db);
    const deps2 = settings.sync.departments;
    return ok(c, {
      departments: deps2,
      sectors: await db.all('SELECT id, parent_id, label, priority, enabled FROM sectors ORDER BY sort'),
      communes: await db.all(`SELECT code_insee, name, postal_codes, lat, lon, population FROM communes WHERE department IN (${deps2.map(() => '?').join(',')}) ORDER BY name`, deps2),
      headcountBands: HEADCOUNT_BANDS,
      legalForms: LEGAL_FORMS,
      opportunityLabels: OPPORTUNITY_LABELS,
      procTypeLabels: PROC_TYPE_LABELS,
      procStatusLabels: PROC_STATUS_LABELS,
      projectStatuses: PROJECT_STATUSES,
      alertTypes: ALERT_TYPES,
      sources: ALL_SOURCES.map((s) => ({ id: s.id, label: s.label, official: s.official })),
      map: settings.map,
      aiEnabled: settings.ai.provider === 'anthropic' && !!deps.secrets.ANTHROPIC_API_KEY,
    });
  });

  // --- Données ------------------------------------------------------------------
  app.get('/dashboard', reader, async (c) => ok(c, await dashboard(db)));

  app.get('/companies', reader, async (c) => {
    const f = SearchSchema.parse(c.req.query());
    return ok(c, await searchCompanies(db, f, (await getSettings(db)).sync.departments));
  });

  app.get('/companies/:id', reader, async (c) => {
    const d = await companyDetail(db, idParam(c));
    return d ? ok(c, d) : fail(c, 'Entreprise introuvable.', 404);
  });

  app.patch('/companies/:id', analyst, async (c) => {
    const id = idParam(c);
    const b = z.object({ website: z.string().url().max(300).refine((u) => /^https?:/i.test(u)).nullable().optional() }).parse(await c.req.json());
    const comp = await db.get<{ siren: string }>('SELECT siren FROM companies WHERE id = ?', [id]);
    if (!comp) return fail(c, 'Entreprise introuvable.', 404);
    if (b.website !== undefined) {
      if (b.website === null) await db.run('UPDATE companies SET website = NULL WHERE id = ?', [id]);
      else await upsertCompany(db, { siren: comp.siren, website: b.website }, { sourceId: 'saisie', status: 'declarative', confidence: 95, collectedAt: new Date().toISOString() });
      await queueAnalysis(db, id);
      await processAnalysisQueue(db, await getSettings(db), { maxMs: 3000 });
    }
    await audit(c, 'modification_entreprise', 'company', id, b);
    return ok(c, { ok: true });
  });

  app.get('/map', reader, async (c) => {
    const settings = await getSettings(db);
    const q = c.req.query();
    const hasFilter = Object.keys(q).some((k) => !['page', 'pageSize', 'sort'].includes(k));
    let ids: number[] | null = null;
    if (hasFilter) ids = (await searchCompanies(db, { ...SearchSchema.parse(q), page: 1, pageSize: 500, geolocated: true }, settings.sync.departments).then(async (first) => {
      const all = [...first.rows];
      for (let p = 2; all.length < Math.min(first.total, 20000); p++) {
        const r = await searchCompanies(db, { ...SearchSchema.parse(q), page: p, pageSize: 500, geolocated: true }, settings.sync.departments);
        if (!r.rows.length) break;
        all.push(...r.rows);
      }
      return all;
    })).map((r) => r.id);
    return ok(c, { points: await mapPoints(db, ids, settings.sync.departments) });
  });

  app.get('/compare', reader, async (c) => {
    const ids = z.string().parse(c.req.query('ids') ?? '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 6);
    const out = [];
    for (const id of ids) {
      const d = await companyDetail(db, id);
      if (d) out.push({ company: d.company, score: d.score, valuation: d.valuation, financials: d.financials, trends: d.trends, proceedings: d.proceedings, opportunity: d.opportunity, signals: d.signals });
    }
    return ok(c, { items: out });
  });

  app.get('/listings', reader, async (c) => {
    const offers = await db.all(
      `SELECT l.*, c.name AS company_name, c.siren, s.economic_score, s.risk_score, s.reliability_score FROM sale_listings l LEFT JOIN companies c ON c.id = l.company_id
       LEFT JOIN scoring_results s ON s.company_id = l.company_id WHERE l.is_offer = 1 ORDER BY COALESCE(l.published_at, l.collected_at) DESC LIMIT 500`,
    );
    const completed = await db.all(
      `SELECT l.*, c.name AS company_name, c.siren FROM sale_listings l LEFT JOIN companies c ON c.id = l.company_id WHERE l.is_offer = 0 ORDER BY l.published_at DESC LIMIT 200`,
    );
    return ok(c, { offers, completed });
  });

  app.patch('/listings/:id', analyst, async (c) => {
    const b = z.object({ status: z.enum(['active', 'retiree', 'realisee', 'inconnue']) }).parse(await c.req.json());
    const id = idParam(c);
    await db.run('UPDATE sale_listings SET status = ? WHERE id = ? AND is_offer = 1', [b.status, id]);
    const l = await db.get<{ company_id: number | null }>('SELECT company_id FROM sale_listings WHERE id = ?', [id]);
    if (l?.company_id) await queueAnalysis(db, l.company_id);
    await audit(c, 'annonce_statut', 'listing', id, b);
    return ok(c, { ok: true });
  });

  app.get('/proceedings', reader, async (c) => {
    const q = z.object({ status: z.string().max(40).optional(), type: z.string().max(40).optional(), scope: z.enum(['actives', 'cloturees', 'toutes']).default('actives') }).parse(c.req.query());
    const where: string[] = [];
    const p: string[] = [];
    if (q.scope === 'actives') where.push("lp.status != 'cloturee'");
    if (q.scope === 'cloturees') where.push("lp.status = 'cloturee'");
    if (q.status) (where.push('lp.status = ?'), p.push(q.status));
    if (q.type) (where.push('lp.type = ?'), p.push(q.type));
    const rows = await db.all(
      `SELECT lp.*, c.name, c.siren, c.commune_name, c.sector_id, c.headcount_band, s.economic_score, s.risk_score, s.reliability_score, m.revenue, m.last_year
       FROM legal_proceedings lp JOIN companies c ON c.id = lp.company_id LEFT JOIN scoring_results s ON s.company_id = c.id LEFT JOIN company_metrics m ON m.company_id = c.id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY COALESCE(lp.last_event_at, lp.opened_at) DESC LIMIT 1000`,
      p,
    );
    return ok(c, { rows });
  });

  app.get('/financials/:id', reader, async (c) => ok(c, { years: await loadFinancials(db, idParam(c)) }));

  // Scénarios de reprise (calcul à la demande, enregistrement facultatif dans un projet)
  const ScenarioInput = z.object({
    companyId: z.number().int().positive(),
    price: z.number().nonnegative().max(1e10).optional(),
    acquisitionFeesRate: z.number().min(0).max(0.5).optional(),
    initialInvestment: z.number().min(0).max(1e9).optional(),
    workingCapital: z.number().min(0).max(1e9).optional(),
    cashBuffer: z.number().min(0).max(1e9).optional(),
    debtShare: z.number().min(0).max(1).optional(),
    interestRate: z.number().min(0).max(0.3).optional(),
    loanYears: z.number().int().min(1).max(25).optional(),
    exitEbeMultiple: z.number().min(0).max(20).optional(),
    baseRevenue: z.number().min(0).max(1e10).optional(),
    baseEbe: z.number().min(-1e9).max(1e10).optional(),
    grossMarginRate: z.number().min(0).max(1).nullable().optional(),
    scenarios: z.array(z.object({ name: z.enum(['prudent', 'central', 'optimiste']), firstYearRevenueChange: z.number().min(-1).max(1), revenueGrowth: z.number().min(-0.5).max(1), marginDelta: z.number().min(-0.5).max(0.5), extraCosts: z.number().min(0).max(1e8), extraInvestment: z.number().min(0).max(1e9) })).optional(),
    save: z.object({ projectId: z.number().int().positive(), name: z.string().min(1).max(120) }).optional(),
  });
  app.post('/scenarios', reader, async (c) => {
    const b = ScenarioInput.parse(await c.req.json());
    const settings = await getSettings(db);
    const fin = await loadFinancials(db, b.companyId);
    const last = [...fin].reverse().find((y) => typeof y.revenue === 'number');
    const ebe = last ? ebeOf(last) : null;
    const baseRevenue = b.baseRevenue ?? last?.revenue ?? null;
    const baseEbe = b.baseEbe ?? ebe?.value ?? null;
    if (baseRevenue === null || baseEbe === null) {
      return ok(c, { available: false, reason: "Chiffre d'affaires et EBE (ou résultat d'exploitation + dotations) nécessaires. Saisissez-les manuellement à partir des documents du vendeur pour simuler.", base: { revenue: baseRevenue, ebe: baseEbe, year: last?.fiscalYear ?? null } });
    }
    const valuation = await db.get<{ central: number | null }>('SELECT central FROM valuations WHERE company_id = ?', [b.companyId]);
    const project = await db.get<{ asking_price: number | null }>('SELECT asking_price FROM acquisition_projects WHERE company_id = ?', [b.companyId]);
    const d = settings.deal;
    const price = b.price ?? project?.asking_price ?? valuation?.central ?? Math.max(0, baseEbe * 4);
    const deal = {
      baseRevenue, baseEbe, baseDepreciation: last?.depreciation ?? 0,
      grossMarginRate: b.grossMarginRate !== undefined ? b.grossMarginRate : last?.grossMargin && baseRevenue ? last.grossMargin / baseRevenue : null,
      price, acquisitionFeesRate: b.acquisitionFeesRate ?? d.acquisitionFeesRate, initialInvestment: b.initialInvestment ?? 0,
      workingCapital: b.workingCapital ?? baseRevenue * d.workingCapitalRate, cashBuffer: b.cashBuffer ?? (baseRevenue / 12) * d.cashBufferMonths * 0.3,
      debtShare: b.debtShare ?? d.debtShare, interestRate: b.interestRate ?? d.interestRate, loanYears: b.loanYears ?? d.loanYears, taxRate: d.taxRate, exitEbeMultiple: b.exitEbeMultiple ?? 4,
    };
    const defs = defaultScenarios();
    const params: ScenarioParams[] = b.scenarios ? b.scenarios.map((s) => ({ ...defs.find((x) => x.name === s.name)!, ...s, assumptions: [...defs.find((x) => x.name === s.name)!.assumptions.slice(0, 0), 'Hypothèses ajustées par l\'utilisateur'] })) : defs;
    const results = params.map((p) => runScenario(deal, p));
    const priceOrigin = b.price !== undefined ? 'saisi' : project?.asking_price ? 'prix demandé (Acquisition Manager)' : valuation?.central ? 'valeur centrale estimée' : '4 × EBE (hypothèse par défaut)';
    const payload = { available: true, deal, priceOrigin, base: { revenue: baseRevenue, ebe: baseEbe, year: last?.fiscalYear ?? null, ebeStatus: b.baseEbe !== undefined ? 'saisi' : ebe?.status }, results, disclaimer: 'Projections indicatives fondées sur des hypothèses : elles ne constituent ni une prévision ni une promesse de rendement.' };
    if (b.save) {
      const u = await requireUserFor(c, 'analyste');
      if (!u) return fail(c, 'Droits insuffisants pour enregistrer.', 403);
      await db.run('INSERT INTO financial_scenarios (company_id, project_id, name, params, results, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [b.companyId, b.save.projectId, b.save.name, JSON.stringify(deal), JSON.stringify(results.map((r) => ({ name: r.params.name, at3: r.at3, at5: r.at5, equityIrr: r.equityIrr, paybackYears: r.paybackYears, businessReturn: r.businessReturn, financing: r.financing }))), u.id, new Date().toISOString()]);
    }
    return ok(c, payload);
  });
  async function requireUserFor(c: Context<Env>, role: Role) {
    const u = c.get('user');
    return u && ROLE_RANK[u.role] >= ROLE_RANK[role] ? u : null;
  }

  // --- Alertes et recherches enregistrées ----------------------------------------
  app.get('/alerts', reader, async (c) => {
    const q = z.object({ unread: z.string().optional(), type: z.string().max(40).optional(), page: z.coerce.number().int().min(1).default(1) }).parse(c.req.query());
    return ok(c, await listAlerts(db, { unreadOnly: q.unread === '1', type: q.type, limit: 50, offset: (q.page - 1) * 50 }));
  });
  app.post('/alerts/read', reader, async (c) => {
    const b = z.object({ ids: z.array(z.number().int()).max(500).optional(), all: z.boolean().optional() }).parse(await c.req.json());
    const now = new Date().toISOString();
    if (b.all) await db.run('UPDATE alerts SET read_at = ? WHERE read_at IS NULL', [now]);
    else if (b.ids?.length) await db.run(`UPDATE alerts SET read_at = ? WHERE id IN (${b.ids.map(() => '?').join(',')})`, [now, ...b.ids]);
    return ok(c, { ok: true });
  });

  app.get('/searches', reader, async (c) => ok(c, { rows: await db.all('SELECT * FROM saved_searches WHERE user_id = ? ORDER BY created_at DESC', [c.get('user').id]) }));
  app.post('/searches', reader, async (c) => {
    const b = z.object({ name: z.string().trim().min(1).max(100), query: z.record(z.string(), z.unknown()), alert: z.boolean().default(false) }).parse(await c.req.json());
    const f = SearchSchema.parse(b.query);
    const r = await db.get<{ id: number }>('INSERT INTO saved_searches (user_id, name, query, alert_enabled, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id', [c.get('user').id, b.name, JSON.stringify(b.query), b.alert ? 1 : 0, new Date().toISOString()]);
    const { total } = await searchCompanies(db, { ...f, page: 1, pageSize: 1 }, (await getSettings(db)).sync.departments);
    await db.run('UPDATE saved_searches SET last_count = ? WHERE id = ?', [total, r!.id]);
    return ok(c, { id: r!.id });
  });
  app.patch('/searches/:id', reader, async (c) => {
    const b = z.object({ alert: z.boolean() }).parse(await c.req.json());
    await db.run('UPDATE saved_searches SET alert_enabled = ? WHERE id = ? AND user_id = ?', [b.alert ? 1 : 0, idParam(c), c.get('user').id]);
    return ok(c, { ok: true });
  });
  app.delete('/searches/:id', reader, async (c) => {
    await db.run('DELETE FROM saved_searches WHERE id = ? AND user_id = ?', [idParam(c), c.get('user').id]);
    return ok(c, { ok: true });
  });

  // --- RADAR AI -----------------------------------------------------------------
  app.post('/assistant', reader, async (c) => {
    const b = z.object({ question: z.string().trim().min(2).max(2000), companyIds: z.array(z.number().int().positive()).max(10).default([]) }).parse(await c.req.json());
    if (!(await hitRateLimit(db, `ai:${c.get('user').id}`, 30, 300))) return fail(c, 'Trop de questions en peu de temps. Patientez quelques minutes.', 429);
    const r = await ask(db, b.question, b.companyIds, deps.secrets.ANTHROPIC_API_KEY, deps.fetch as typeof fetch);
    if (r.mode === 'claude') await audit(c, 'assistant_modele_externe', undefined, undefined, { intent: r.intent });
    return ok(c, r);
  });

  // --- Acquisition Manager ------------------------------------------------------
  app.get('/projects', reader, async (c) => ok(c, { rows: await listProjects(db), reminders: await upcomingReminders(db) }));
  app.post('/projects', analyst, async (c) => {
    const b = z.object({ companyId: z.number().int().positive() }).parse(await c.req.json());
    const id = await ensureProject(db, b.companyId, c.get('user').id);
    await audit(c, 'projet_creation', 'project', id);
    return ok(c, { id });
  });
  app.get('/projects/:id', reader, async (c) => {
    const d = await projectDetail(db, idParam(c));
    return d ? ok(c, d) : fail(c, 'Projet introuvable.', 404);
  });
  app.patch('/projects/:id', analyst, async (c) => {
    const id = idParam(c);
    await updateProject(db, id, ProjectPatch.parse(await c.req.json()), c.get('user').id);
    await processAnalysisQueue(db, await getSettings(db), { maxMs: 3000 });
    await audit(c, 'projet_modification', 'project', id);
    return ok(c, { ok: true });
  });
  app.delete('/projects/:id', analyst, async (c) => {
    const id = idParam(c);
    const docs = await db.all<{ storage_key: string }>('SELECT storage_key FROM documents WHERE project_id = ?', [id]);
    for (const d of docs) await deps.storage.delete(d.storage_key);
    await db.run('DELETE FROM acquisition_projects WHERE id = ?', [id]);
    await audit(c, 'projet_suppression', 'project', id);
    return ok(c, { ok: true });
  });
  app.post('/projects/:id/notes', analyst, async (c) => {
    const id = idParam(c);
    const b = NoteInput.parse(await c.req.json());
    await db.run('INSERT INTO acquisition_notes (project_id, user_id, kind, content, due_at, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, c.get('user').id, b.kind, b.content, b.due_at ?? null, new Date().toISOString()]);
    await db.run('UPDATE acquisition_projects SET updated_at = ? WHERE id = ?', [new Date().toISOString(), id]);
    return ok(c, { ok: true });
  });
  app.patch('/notes/:id', analyst, async (c) => {
    const b = z.object({ done: z.boolean() }).parse(await c.req.json());
    await db.run('UPDATE acquisition_notes SET done_at = ? WHERE id = ?', [b.done ? new Date().toISOString() : null, idParam(c)]);
    return ok(c, { ok: true });
  });
  app.delete('/notes/:id', analyst, async (c) => {
    await db.run("DELETE FROM acquisition_notes WHERE id = ? AND kind != 'statut'", [idParam(c)]);
    return ok(c, { ok: true });
  });
  app.post('/projects/:id/contacts', analyst, async (c) => {
    const b = ContactInput.parse(await c.req.json());
    await db.run('INSERT INTO project_contacts (project_id, name, role, organisation, email, phone, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [idParam(c), b.name, b.role ?? null, b.organisation ?? null, b.email || null, b.phone ?? null, b.notes ?? null, new Date().toISOString()]);
    return ok(c, { ok: true });
  });
  app.delete('/contacts/:id', analyst, async (c) => {
    await db.run('DELETE FROM project_contacts WHERE id = ?', [idParam(c)]);
    return ok(c, { ok: true });
  });
  app.post('/projects/:id/documents', analyst, async (c) => {
    const id = idParam(c);
    if (!(await db.get('SELECT 1 FROM acquisition_projects WHERE id = ?', [id]))) return fail(c, 'Projet introuvable.', 404);
    const form = await c.req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string') return fail(c, 'Fichier manquant.');
    const ext = (file.name.split('.').pop() ?? '').toLowerCase();
    const type = ALLOWED_TYPES[ext];
    if (!type) return fail(c, `Type de fichier non accepté (${Object.keys(ALLOWED_TYPES).join(', ')}).`);
    if (file.size > MAX_FILE_BYTES) return fail(c, 'Fichier trop volumineux (20 Mo maximum).', 413);
    const key = `docs/${id}/${randomToken(16)}.${ext}`;
    await deps.storage.put(key, await file.arrayBuffer(), type);
    await db.run('INSERT INTO documents (project_id, filename, content_type, size, storage_key, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150), type, file.size, key, c.get('user').id, new Date().toISOString()]);
    await audit(c, 'document_ajout', 'project', id, { name: file.name });
    return ok(c, { ok: true });
  });
  app.get('/documents/:id', reader, async (c) => {
    const d = await db.get<{ filename: string; content_type: string; storage_key: string }>('SELECT filename, content_type, storage_key FROM documents WHERE id = ?', [idParam(c)]);
    if (!d) return fail(c, 'Document introuvable.', 404);
    const data = await deps.storage.get(d.storage_key);
    if (!data) return fail(c, 'Fichier introuvable dans le stockage.', 404);
    return new Response(data, { headers: { 'Content-Type': d.content_type, 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(d.filename)}`, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } });
  });
  app.delete('/documents/:id', analyst, async (c) => {
    const id = idParam(c);
    const d = await db.get<{ storage_key: string }>('SELECT storage_key FROM documents WHERE id = ?', [id]);
    if (d) await deps.storage.delete(d.storage_key);
    await db.run('DELETE FROM documents WHERE id = ?', [id]);
    await audit(c, 'document_suppression', 'document', id);
    return ok(c, { ok: true });
  });

  // --- Exports (réservés aux analystes, limités et journalisés) --------------------
  app.get('/export', analyst, async (c) => {
    if (!(await hitRateLimit(db, `export:${c.get('user').id}`, 20, 3600))) return fail(c, "Limite d'exports atteinte (20 par heure).", 429);
    const format = c.req.query('format') === 'xlsx' ? 'xlsx' : 'csv';
    const q = { ...c.req.query() };
    delete q.format;
    const f = SearchSchema.parse(q);
    const { headers, rows } = await exportRows(db, f, (await getSettings(db)).sync.departments);
    await audit(c, 'export', 'companies', undefined, { format, rows: rows.length, filters: q });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'xlsx') {
      return new Response(toXlsx('Entreprises', headers, rows).slice().buffer as ArrayBuffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="radar-entreprises-${stamp}.xlsx"`, 'Cache-Control': 'no-store' } });
    }
    return new Response(toCsv(headers, rows), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="radar-entreprises-${stamp}.csv"`, 'Cache-Control': 'no-store' } });
  });

  // --- Administration -----------------------------------------------------------
  app.get('/admin/sources', admin, async (c) => {
    const rows = await db.all<{ id: string; enabled: number; config: string; last_sync_at: string | null; last_success_at: string | null; last_status: string | null; last_error: string | null }>('SELECT * FROM sources');
    return ok(c, {
      sources: ALL_SOURCES.map((m) => {
        const r = rows.find((x) => x.id === m.id);
        const cfg = JSON.parse(r?.config ?? '{}') as Record<string, unknown>;
        return { ...m, syncable: CONNECTORS.some((x) => x.id === m.id), enabled: !!r?.enabled, config: cfg, secrets: Object.fromEntries(m.requiredSecrets.map((k) => [k, !!deps.secrets[k]])), last_sync_at: r?.last_sync_at, last_success_at: r?.last_success_at, last_status: r?.last_status, last_error: r?.last_error };
      }),
    });
  });
  app.patch('/admin/sources/:id', admin, async (c) => {
    const id = z.string().max(60).parse(c.req.param('id'));
    if (!sourceMeta(id)) return fail(c, 'Source inconnue.', 404);
    const b = z.object({ enabled: z.boolean().optional(), feeds: z.array(z.object({ url: z.string().url().max(500), label: z.string().max(100).optional() })).max(50).optional() }).parse(await c.req.json());
    if (b.enabled !== undefined) await db.run('UPDATE sources SET enabled = ?, updated_at = ? WHERE id = ?', [b.enabled ? 1 : 0, new Date().toISOString(), id]);
    if (b.feeds) {
      const row = await db.get<{ config: string }>('SELECT config FROM sources WHERE id = ?', [id]);
      await db.run('UPDATE sources SET config = ? WHERE id = ?', [JSON.stringify({ ...JSON.parse(row?.config ?? '{}'), feeds: b.feeds }), id]);
    }
    await audit(c, 'source_modification', 'source', id, b);
    return ok(c, { ok: true });
  });

  const syncEnv = () => ({ db, fetch: deps.fetch, secrets: deps.secrets });
  app.post('/admin/sync/start', admin, async (c) => {
    const b = z.object({ source: z.string().max(60).optional() }).parse(await c.req.json().catch(() => ({})));
    const r = await startRun(syncEnv(), 'manuel', b.source);
    await audit(c, 'veille_lancement', 'sync_run', r.runId, b);
    // Première étape immédiate (le reste avance via la tâche planifiée ou le bouton « Continuer »)
    const t = await tick(syncEnv(), { maxMs: 15_000, maxRequests: 35 });
    return ok(c, { ...r, tick: t });
  });
  app.post('/admin/sync/tick', admin, async (c) => ok(c, await tick(syncEnv(), { maxMs: 20_000, maxRequests: 40 })));
  app.post('/admin/sync/cancel', admin, async (c) => {
    const r = await cancelRun(db);
    await audit(c, 'veille_interruption');
    return ok(c, { cancelled: r });
  });
  app.get('/admin/sync/runs', admin, async (c) => {
    const runs = await db.all<Record<string, unknown>>('SELECT * FROM sync_runs ORDER BY id DESC LIMIT 50');
    const active = await activeRun(db);
    const progress = active ? await db.all("SELECT source_id, status, COUNT(*) AS n, SUM(fetched) AS fetched, SUM(created) AS created, SUM(updated) AS updated, SUM(errors) AS errors FROM sync_jobs WHERE run_id = ? GROUP BY source_id, status", [active.id]) : [];
    const queue = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM analysis_queue'))?.n ?? 0;
    return ok(c, { runs: runs.map((r) => ({ ...r, summary: r.summary ? JSON.parse(r.summary as string) : null })), active, progress, analysisQueue: queue });
  });
  app.get('/admin/sync/runs/:id', admin, async (c) => ok(c, { jobs: await db.all('SELECT * FROM sync_jobs WHERE run_id = ? ORDER BY source_id, id', [idParam(c)]) }));

  app.get('/admin/sectors', admin, async (c) => ok(c, { rows: await db.all('SELECT * FROM sectors ORDER BY sort'), builtin: SECTORS }));
  app.patch('/admin/sectors/:id', admin, async (c) => {
    const id = z.string().max(60).parse(c.req.param('id'));
    const b = z.object({ enabled: z.boolean().optional(), naf_codes: z.string().max(500).regex(/^(\s*\d{2}\.\d{2}[A-Z]\s*)?(,\s*\d{2}\.\d{2}[A-Z]\s*)*$/, 'Codes NAF au format 62.01Z séparés par des virgules').optional() }).parse(await c.req.json());
    if (b.enabled !== undefined) await db.run('UPDATE sectors SET enabled = ? WHERE id = ? OR parent_id = ?', [b.enabled ? 1 : 0, id, id]);
    if (b.naf_codes !== undefined) await db.run('UPDATE sectors SET naf_codes = ? WHERE id = ?', [b.naf_codes.replace(/\s/g, ''), id]);
    await audit(c, 'secteur_modification', 'sector', id, b);
    return ok(c, { ok: true });
  });

  app.get('/admin/settings', admin, async (c) => ok(c, { settings: await getSettings(db), defaults: DEFAULT_SETTINGS, secrets: { ANTHROPIC_API_KEY: !!deps.secrets.ANTHROPIC_API_KEY } }));
  app.put('/admin/settings/:key', admin, async (c) => {
    const key = z.enum(['scoringWeights', 'riskWeights', 'valuation', 'deal', 'alerts', 'retention', 'sync', 'ai', 'map']).parse(c.req.param('key'));
    const value = await c.req.json();
    if (key === 'sync') z.object({ departments: z.array(z.string().regex(/^(\d{2}|2A|2B|97\d)$/)).min(1).max(101) }).passthrough().parse(value);
    if (key === 'map') z.object({ tileUrl: z.string().regex(/^https:\/\/[^\s]+\{z\}[^\s]*\{x\}[^\s]*\{y\}/), attribution: z.string().min(3).max(300) }).parse(value);
    if (key === 'ai') z.object({ provider: z.enum(['local', 'anthropic']), model: z.string().regex(/^claude-[a-z0-9-]+$/), monthlyBudgetUsd: z.number().min(0).max(1000) }).passthrough().parse(value);
    await setSetting(db, key, value as AppSettings[typeof key]);
    if (key === 'scoringWeights' || key === 'riskWeights' || key === 'valuation') await queueAll(db);
    await audit(c, 'parametres', 'settings', key);
    return ok(c, { settings: await getSettings(db) });
  });
  app.post('/admin/reanalyze', admin, async (c) => {
    const n = await queueAll(db);
    const done = await processAnalysisQueue(db, await getSettings(db), { maxMs: 15_000 });
    await audit(c, 'recalcul', undefined, undefined, { queued: n });
    return ok(c, { queued: n, done, remaining: (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM analysis_queue'))?.n ?? 0 });
  });
  app.post('/admin/analysis/continue', admin, async (c) => {
    const done = await processAnalysisQueue(db, await getSettings(db), { maxMs: 20_000 });
    return ok(c, { done, remaining: (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM analysis_queue'))?.n ?? 0 });
  });

  app.get('/admin/users', admin, async (c) => ok(c, { rows: await db.all('SELECT id, email, name, role, disabled, failed_attempts, locked_until, last_login_at, created_at FROM users ORDER BY id') }));
  app.post('/admin/users', admin, async (c) => {
    const b = z.object({ email: z.string().max(200), name: z.string().min(1).max(100), password: z.string().max(200), role: z.enum(['admin', 'analyste', 'lecteur']) }).parse(await c.req.json());
    try {
      const id = await createUser(db, b);
      await audit(c, 'utilisateur_creation', 'user', id, { email: b.email, role: b.role });
      return ok(c, { id });
    } catch (e) {
      return fail(c, (e as Error).message);
    }
  });
  app.patch('/admin/users/:id', admin, async (c) => {
    const id = idParam(c);
    const b = z.object({ role: z.enum(['admin', 'analyste', 'lecteur']).optional(), disabled: z.boolean().optional(), unlock: z.boolean().optional() }).parse(await c.req.json());
    if (id === c.get('user').id && (b.disabled || (b.role && b.role !== 'admin'))) return fail(c, 'Vous ne pouvez pas retirer vos propres droits d\'administration.');
    if (b.role) await db.run('UPDATE users SET role = ? WHERE id = ?', [b.role, id]);
    if (b.disabled !== undefined) {
      await db.run('UPDATE users SET disabled = ? WHERE id = ?', [b.disabled ? 1 : 0, id]);
      if (b.disabled) await db.run('DELETE FROM sessions WHERE user_id = ?', [id]);
    }
    if (b.unlock) await db.run('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?', [id]);
    await audit(c, 'utilisateur_modification', 'user', id, b);
    return ok(c, { ok: true });
  });

  app.get('/admin/audit', admin, async (c) => {
    const page = z.coerce.number().int().min(1).default(1).parse(c.req.query('page') ?? 1);
    return ok(c, { rows: await db.all('SELECT a.*, u.email FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 100 OFFSET ?', [(page - 1) * 100]) });
  });

  app.get('/admin/import/template/:kind', admin, (c) => {
    const kind = z.enum(['entreprises', 'comptes', 'annonces', 'signaux']).parse(c.req.param('kind'));
    return new Response('﻿' + IMPORT_TEMPLATES[kind], { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="modele-${kind}.csv"` } });
  });
  app.post('/admin/import/:kind', admin, async (c) => {
    const kind = z.enum(['entreprises', 'comptes', 'annonces', 'signaux']).parse(c.req.param('kind')) as ImportKind;
    const text = await c.req.text();
    if (text.length > 10 * 1024 * 1024) return fail(c, 'Fichier trop volumineux (10 Mo maximum).', 413);
    try {
      const report = await importCsv(db, kind, text, c.get('user').id);
      await processAnalysisQueue(db, await getSettings(db), { maxMs: 10_000 });
      return ok(c, report);
    } catch (e) {
      return fail(c, (e as Error).message);
    }
  });

  app.get('/admin/backup', admin, async (c) => {
    await audit(c, 'sauvegarde');
    return new Response(JSON.stringify(await createBackup(db)), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="radar-sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`, 'Cache-Control': 'no-store' } });
  });
  app.post('/admin/restore', admin, async (c) => {
    const body = await c.req.json();
    try {
      const counts = await restoreBackup(db, body);
      return ok(c, { ok: true, counts });
    } catch (e) {
      return fail(c, (e as Error).message);
    }
  });

  app.get('/admin/rgpd', admin, async (c) =>
    ok(c, { register: PROCESSING_REGISTER, requests: await db.all('SELECT r.*, c.name AS company_name FROM data_requests r LEFT JOIN companies c ON c.id = r.company_id ORDER BY r.created_at DESC LIMIT 200'), suppression: await db.all('SELECT * FROM suppression_list ORDER BY created_at DESC LIMIT 500'), retention: (await getSettings(db)).retention }),
  );
  app.post('/admin/rgpd/requests', admin, async (c) => {
    const b = z.object({ kind: z.enum(['suppression', 'acces', 'rectification', 'opposition']), subject: z.string().min(2).max(300), siren: z.string().regex(/^\d{9}$/).optional(), notes: z.string().max(2000).optional() }).parse(await c.req.json());
    const comp = b.siren ? await db.get<{ id: number }>('SELECT id FROM companies WHERE siren = ?', [b.siren]) : undefined;
    const r = await db.get<{ id: number }>('INSERT INTO data_requests (kind, subject, company_id, notes, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id', [b.kind, b.subject, comp?.id ?? null, b.notes ?? null, new Date().toISOString()]);
    await audit(c, 'rgpd_demande', 'data_request', r!.id, { kind: b.kind });
    return ok(c, { id: r!.id });
  });
  app.post('/admin/rgpd/erase', admin, async (c) => {
    const b = z.object({ siren: z.string().regex(/^\d{9}$/), reason: z.string().min(3).max(500), requestId: z.number().int().optional() }).parse(await c.req.json());
    const erased = await eraseCompany(db, b.siren, b.reason);
    if (b.requestId) await db.run("UPDATE data_requests SET status = 'traitee', processed_at = ? WHERE id = ?", [new Date().toISOString(), b.requestId]);
    await audit(c, 'rgpd_effacement', 'siren', b.siren, { erased });
    return ok(c, { erased });
  });
  app.patch('/admin/rgpd/requests/:id', admin, async (c) => {
    const b = z.object({ status: z.enum(['recue', 'traitee', 'rejetee']), notes: z.string().max(2000).optional() }).parse(await c.req.json());
    await db.run('UPDATE data_requests SET status = ?, notes = COALESCE(?, notes), processed_at = ? WHERE id = ?', [b.status, b.notes ?? null, b.status === 'recue' ? null : new Date().toISOString(), idParam(c)]);
    return ok(c, { ok: true });
  });
  app.post('/admin/rgpd/purge', admin, async (c) => {
    const r = await purgeExpired(db);
    await audit(c, 'rgpd_purge', undefined, undefined, r);
    return ok(c, r);
  });

  app.notFound((c) => fail(c, 'Ressource inconnue.', 404));
  return app;
}

