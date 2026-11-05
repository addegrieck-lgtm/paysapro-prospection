/**
 * Analyse d'une entreprise : fusion des exercices multi-sources, indicateurs, valorisation, scores, radars, alertes.
 * Déclenchée pour chaque entreprise modifiée (file analysis_queue) et lors d'un recalcul complet.
 */
import type { Db } from '../db/types';
import { ebeOf, type FinancialYear } from '../domain/financial';
import { detectOpportunities } from '../domain/opportunities';
import type { ProcStatus, ProcType } from '../domain/proceedings';
import { computeScores, headcountMid, WEIGHTS_VERSION } from '../domain/scoring';
import { valuate } from '../domain/valuation';
import { raiseAlert } from './alerts';
import type { AppSettings } from './settings';

const FIELDS: [keyof FinancialYear, string][] = [
  ['months', 'months'], ['revenue', 'revenue'], ['grossMargin', 'gross_margin'], ['valueAdded', 'value_added'], ['ebe', 'ebe'], ['ebitda', 'ebitda'],
  ['operatingIncome', 'operating_income'], ['netIncome', 'net_income'], ['payroll', 'payroll'], ['depreciation', 'depreciation'], ['equity', 'equity'],
  ['totalDebt', 'total_debt'], ['totalLiabilities', 'total_liabilities'], ['cash', 'cash'], ['fixedAssets', 'fixed_assets'], ['inventory', 'inventory'],
  ['receivables', 'receivables'], ['payables', 'payables'], ['totalAssets', 'total_assets'], ['headcount', 'headcount'],
];

export interface MergedYear extends FinancialYear {
  closingDate: string | null;
  sources: string[];
  fieldSources: Record<string, { source: string; status: string; confidence: number; collectedAt: string; url: string | null }>;
}

/** Fusionne les exercices de plusieurs sources : pour chaque champ, la valeur de la source la plus fiable. */
export async function loadFinancials(db: Db, companyId: number): Promise<MergedYear[]> {
  const rows = await db.all<Record<string, string | number | null>>('SELECT * FROM company_financials WHERE company_id = ? ORDER BY fiscal_year, confidence DESC, collected_at DESC', [companyId]);
  const byYear = new Map<number, MergedYear>();
  for (const r of rows) {
    const fy = r.fiscal_year as number;
    let y = byYear.get(fy);
    if (!y) {
      y = { fiscalYear: fy, closingDate: (r.closing_date as string) ?? null, sources: [], fieldSources: {} };
      byYear.set(fy, y);
    }
    if (!y.sources.includes(r.source_id as string)) y.sources.push(r.source_id as string);
    for (const [k, col] of FIELDS) {
      const v = r[col];
      if (typeof v === 'number' && (y as unknown as Record<string, unknown>)[k] === undefined) {
        (y as unknown as Record<string, unknown>)[k] = v;
        y.fieldSources[k] = { source: r.source_id as string, status: r.status as string, confidence: r.confidence as number, collectedAt: r.collected_at as string, url: (r.url as string) ?? null };
      }
    }
  }
  return [...byYear.values()].sort((a, b) => a.fiscalYear - b.fiscalYear);
}

export async function analyzeCompany(db: Db, id: number, settings: AppSettings, runId: number | null = null) {
  const c = await db.get<Record<string, string | number | null>>('SELECT * FROM companies WHERE id = ?', [id]);
  if (!c) return null;
  const fin = await loadFinancials(db, id);
  const procs = await db.all<{ type: ProcType; status: ProcStatus; closed_at: string | null }>('SELECT type, status, closed_at FROM legal_proceedings WHERE company_id = ?', [id]);
  const listings = await db.all<{ kind: string; title: string; source_id: string; asking_price: number | null }>(
    `SELECT kind, title, source_id, asking_price FROM sale_listings WHERE company_id = ? AND is_offer = 1 AND status = 'active' AND COALESCE(published_at, collected_at) > ?`,
    [id, new Date(Date.now() - 365 * 86400_000).toISOString().slice(0, 10)],
  );
  const signals = await db.all<{ signal_type: string; strength: number; evidence: string; evidence_url: string | null; source_id: string }>('SELECT signal_type, strength, evidence, evidence_url, source_id FROM transmission_signals WHERE company_id = ?', [id]);
  const project = await db.get<{ asking_price: number | null }>('SELECT asking_price FROM acquisition_projects WHERE company_id = ?', [id]);
  const prov = await db.get<{ total: number; official: number }>("SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'officielle' THEN 1 ELSE 0 END) AS official FROM company_field_sources WHERE company_id = ?", [id]);
  const prevScore = await db.get<{ economic_score: number | null }>('SELECT economic_score FROM scoring_results WHERE company_id = ?', [id]);

  const sectorId = (c.sector_id as string) ?? null;
  const hc = headcountMid((c.headcount_band as string) ?? null);
  const active = procs.filter((p) => p.status !== 'cloturee');
  const val = valuate(fin, { sectorId, headcount: hc, activeProceeding: active.length > 0 }, settings.valuation);
  const askingPrice = project?.asking_price ?? listings.find((l) => l.asking_price)?.asking_price ?? null;
  const scores = computeScores(
    {
      sectorId,
      creationDate: (c.creation_date as string) ?? null,
      headcountBand: (c.headcount_band as string) ?? null,
      isIndividual: c.is_individual === null ? null : c.is_individual === 1,
      adminStatus: (c.admin_status as string) ?? null,
      establishments: (c.establishments_count as number) ?? null,
      openEstablishments: (c.open_establishments_count as number) ?? null,
      financials: fin,
      proceedings: procs.map((p) => ({ type: p.type, status: p.status, closedAt: p.closed_at })),
      askingPrice,
      valuationCentral: val.central,
      identityCheckedAt: (c.identity_checked_at as string) ?? null,
      hasGeo: c.lat !== null && c.lon !== null,
      hasWebsite: c.website ? true : null,
      officialFieldShare: prov?.total ? (prov.official ?? 0) / prov.total : null,
      signalsCount: signals.length,
    },
    settings.scoringWeights,
    settings.riskWeights,
  );
  const lastNet = [...fin].reverse().find((y) => typeof y.netIncome === 'number')?.netIncome ?? null;
  const opp = detectOpportunities({
    sectorId,
    creationDate: (c.creation_date as string) ?? null,
    headcountBand: (c.headcount_band as string) ?? null,
    adminStatus: (c.admin_status as string) ?? null,
    establishments: (c.establishments_count as number) ?? null,
    openEstablishments: (c.open_establishments_count as number) ?? null,
    hasWebsite: c.website ? true : null,
    activeListings: listings.map((l) => ({ kind: l.kind, title: l.title, source: l.source_id })),
    proceedings: procs.map((p) => ({ type: p.type, status: p.status })),
    signals: signals.map((s) => ({ type: s.signal_type, strength: s.strength, evidence: s.evidence, url: s.evidence_url, source: s.source_id })),
    lastNetIncome: lastNet,
  });

  const now = new Date().toISOString();
  const lastFin = fin[fin.length - 1];
  const lastWith = (k: keyof FinancialYear) => [...fin].reverse().find((y) => typeof y[k] === 'number');
  const revY = lastWith('revenue');
  const firstRev = fin.find((y) => typeof y.revenue === 'number' && y.revenue > 0);
  const cagrVal = revY && firstRev && revY.fiscalYear > firstRev.fiscalYear && (revY.revenue ?? 0) > 0 ? Math.pow(revY.revenue! / firstRev.revenue!, 1 / (revY.fiscalYear - firstRev.fiscalYear)) - 1 : null;
  const lastEbe = [...fin].reverse().map((y) => ebeOf(y).value).find((v) => v !== null) ?? null;
  const version = WEIGHTS_VERSION(settings.scoringWeights, settings.riskWeights);
  const stmts = [
    {
      sql: `INSERT INTO company_metrics (company_id, last_year, revenue, net_income, ebe, revenue_cagr, years_count, has_active_proceeding, signals_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(company_id) DO UPDATE SET last_year = excluded.last_year, revenue = excluded.revenue, net_income = excluded.net_income, ebe = excluded.ebe,
            revenue_cagr = excluded.revenue_cagr, years_count = excluded.years_count, has_active_proceeding = excluded.has_active_proceeding, signals_count = excluded.signals_count`,
      params: [id, lastFin?.fiscalYear ?? null, revY?.revenue ?? null, lastWith('netIncome')?.netIncome ?? null, lastEbe, cagrVal, fin.length, active.length ? 1 : 0, signals.length],
    },
    {
      sql: `INSERT INTO scoring_results (company_id, economic_score, risk_score, reliability_score, data_status, detail, weights_version, computed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(company_id) DO UPDATE SET economic_score = excluded.economic_score, risk_score = excluded.risk_score, reliability_score = excluded.reliability_score,
            data_status = excluded.data_status, detail = excluded.detail, weights_version = excluded.weights_version, computed_at = excluded.computed_at`,
      params: [id, scores.economic, scores.risk, scores.reliability, scores.dataStatus, JSON.stringify({ coverage: scores.economicCoverage, economic: scores.economicComponents, risk: scores.riskComponents, reliability: scores.reliabilityComponents, summary: scores.summary }), version, now],
    },
    {
      sql: `INSERT INTO valuations (company_id, low, central, high, detail, computed_at) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(company_id) DO UPDATE SET low = excluded.low, central = excluded.central, high = excluded.high, detail = excluded.detail, computed_at = excluded.computed_at`,
      params: [id, val.low, val.central, val.high, JSON.stringify(val), now],
    },
    opp.primary
      ? {
          sql: `INSERT INTO acquisition_opportunities (company_id, types, primary_type, reasons, transmission_index, first_detected_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(company_id) DO UPDATE SET types = excluded.types, primary_type = excluded.primary_type, reasons = excluded.reasons,
                transmission_index = excluded.transmission_index, updated_at = excluded.updated_at`,
          params: [id, JSON.stringify(opp.types), opp.primary, JSON.stringify(opp.reasons), opp.transmissionIndex, now, now],
        }
      : { sql: 'DELETE FROM acquisition_opportunities WHERE company_id = ?', params: [id] },
  ];
  await db.batch(stmts);

  // Alertes
  const name = c.name as string;
  if (scores.economic !== null && scores.economic >= settings.alerts.highScoreThreshold && scores.reliability >= settings.alerts.minReliability && (prevScore?.economic_score ?? -1) < settings.alerts.highScoreThreshold) {
    await raiseAlert(db, { type: 'score_eleve', severity: 'positif', companyId: id, title: `Score économique élevé (${scores.economic}/100) : ${name}`, message: scores.summary, dedupeKey: `score:${id}:${version}`, runId }, settings);
  }
  const withRev = fin.filter((y) => typeof y.revenue === 'number' && y.revenue > 0);
  const lastY = withRev[withRev.length - 1];
  const prevY = withRev[withRev.length - 2];
  if (lastY && prevY && lastY.fiscalYear - prevY.fiscalYear === 1) {
    const firstSeen = new Date(c.first_seen_at as string).getTime();
    const discovered = Math.max(...Object.values(lastY.fieldSources).map((f) => new Date(f.collectedAt).getTime()));
    if (discovered - firstSeen > 86400_000) {
      const change = (lastY.revenue! - prevY.revenue!) / prevY.revenue!;
      const netFlip = typeof lastY.netIncome === 'number' && typeof prevY.netIncome === 'number' && Math.sign(lastY.netIncome) !== Math.sign(prevY.netIncome);
      if (Math.abs(change) >= settings.alerts.financialChangeThreshold || netFlip) {
        const better = change > 0 && (!netFlip || (lastY.netIncome ?? 0) > 0);
        await raiseAlert(
          db,
          {
            type: better ? 'amelioration_financiere' : 'degradation_financiere',
            severity: better ? 'positif' : 'attention',
            companyId: id,
            title: `${better ? 'Amélioration' : 'Dégradation'} financière ${lastY.fiscalYear} : ${name}`,
            message: `CA ${(change * 100).toFixed(0)} % vs ${prevY.fiscalYear}${netFlip ? `, résultat net ${lastY.netIncome! >= 0 ? 'redevenu positif' : 'devenu négatif'}` : ''} (comptes publiés)`,
            dedupeKey: `fin:${id}:${lastY.fiscalYear}`,
            runId,
          },
          settings,
        );
      }
    }
  }
  return { scores, valuation: val, opportunities: opp, financials: fin };
}

/** Traite la file des entreprises à réanalyser, dans la limite de temps fixée. Retourne le nombre traité. */
export async function processAnalysisQueue(db: Db, settings: AppSettings, opts: { maxMs?: number; runId?: number | null; batch?: number } = {}): Promise<number> {
  const t0 = Date.now();
  let n = 0;
  for (;;) {
    if (Date.now() - t0 > (opts.maxMs ?? 10_000)) break;
    const ids = await db.all<{ company_id: number }>('SELECT company_id FROM analysis_queue ORDER BY queued_at LIMIT ?', [opts.batch ?? 25]);
    if (!ids.length) break;
    for (const { company_id } of ids) {
      try {
        await analyzeCompany(db, company_id, settings, opts.runId ?? null);
      } catch (e) {
        await db.run("INSERT INTO audit_logs (action, entity_type, entity_id, details) VALUES ('analyse_erreur', 'company', ?, ?)", [String(company_id), (e as Error).message.slice(0, 500)]);
      }
      await db.run('DELETE FROM analysis_queue WHERE company_id = ?', [company_id]);
      n++;
      if (Date.now() - t0 > (opts.maxMs ?? 10_000)) break;
    }
  }
  return n;
}

export async function queueAll(db: Db): Promise<number> {
  const r = await db.run('INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) SELECT id, ? FROM companies', [new Date().toISOString()]);
  return r.changes;
}
