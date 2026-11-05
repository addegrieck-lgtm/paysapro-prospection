/**
 * RADAR AI — assistant d'analyse.
 *
 * Mode local (par défaut, gratuit) : reconnaissance d'intentions en français, requêtes sur la base, calculs
 * déterministes (scores, valorisation, scénarios), réponse structurée avec sources et incertitudes.
 * Mode Claude (facultatif) : la réponse locale ET les données utilisées sont transmises au modèle, qui ne fait que
 * synthétiser / reformuler ; consigne stricte de n'utiliser que ces données. Plafond de dépense mensuel.
 *
 * L'assistant n'invente jamais d'entreprise, de compte, d'annonce, de dirigeant ou de prix : tout chiffre affiché
 * provient de la base ou d'un calcul documenté sur ces données.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { Db } from '../db/types';
import { SECTORS, SECTOR_BY_ID } from '../domain/sectors';
import { analyzeTrends, ebeOf } from '../domain/financial';
import { defaultScenarios, runScenario } from '../domain/scenarios';
import { analyzeDistress, BEFORE_SIGNING, SELLER_REQUESTS } from '../domain/distress';
import { OPPORTUNITY_LABELS, type OpportunityType } from '../domain/opportunities';
import { PROC_STATUS_LABELS, PROC_TYPE_LABELS, type ProcStatus, type ProcType } from '../domain/proceedings';
import { headcountMid } from '../domain/scoring';
import { loadFinancials } from './analysis';
import { searchCompanies, SearchSchema, type SearchQuery, type SearchRow } from './search';
import { getKv, getSettings, setKv, type AppSettings } from './settings';

export interface AssistantAnswer {
  intent: string;
  answer: string; // Markdown
  companies: { id: number; siren: string; name: string; detail: string }[];
  sources: string[];
  uncertainties: string[];
  mode: 'local' | 'claude';
  aiNote?: string;
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const eur = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? `${Math.round(v).toLocaleString('fr-FR')} €` : 'n.d.');
const score = (v: number | null | undefined) => (v === null || v === undefined ? 'données insuffisantes' : `${v}/100`);

function detectSectors(q: string): string[] {
  const t = fold(q);
  const out = new Set<string>();
  for (const s of SECTORS) {
    const label = fold(s.label);
    const stem = label.replace(/s\b/g, '');
    if (t.includes(label) || t.includes(stem) || s.keywords.some((k) => k.length > 4 && t.includes(fold(k)))) out.add(s.id);
  }
  // Un groupe et ses sous-secteurs : le groupe suffit
  return [...out];
}

async function detectCommunes(db: Db, q: string, departments: string[]): Promise<{ code: string; name: string }[]> {
  const t = ` ${fold(q).replace(/[^a-z0-9]+/g, ' ')} `;
  const rows = await db.all<{ code_insee: string; name: string }>(`SELECT code_insee, name FROM communes WHERE department IN (${departments.map(() => '?').join(',')})`, departments);
  return rows.filter((r) => r.name.length >= 3 && t.includes(` ${fold(r.name).replace(/[^a-z0-9]+/g, ' ')} `)).map((r) => ({ code: r.code_insee, name: r.name }));
}

async function resolveCompanies(db: Db, q: string, ids: number[]): Promise<{ id: number; siren: string; name: string }[]> {
  const out = new Map<number, { id: number; siren: string; name: string }>();
  for (const id of ids.slice(0, 10)) {
    const c = await db.get<{ id: number; siren: string; name: string }>('SELECT id, siren, name FROM companies WHERE id = ?', [id]);
    if (c) out.set(c.id, c);
  }
  for (const m of q.match(/\b\d{3}\s?\d{3}\s?\d{3}\b/g) ?? []) {
    const c = await db.get<{ id: number; siren: string; name: string }>('SELECT id, siren, name FROM companies WHERE siren = ?', [m.replace(/\s/g, '')]);
    if (c) out.set(c.id, c);
  }
  for (const m of q.match(/[«"“]([^»"”]{3,80})[»"”]/g) ?? []) {
    const name = m.slice(1, -1).trim();
    const c = await db.get<{ id: number; siren: string; name: string }>('SELECT id, siren, name FROM companies WHERE name LIKE ? OR trade_name LIKE ? ORDER BY length(name) LIMIT 1', [`%${name}%`, `%${name}%`]);
    if (c) out.set(c.id, c);
  }
  return [...out.values()];
}

function listLine(r: SearchRow): string {
  const sector = r.sector_id ? SECTOR_BY_ID.get(r.sector_id)?.label : null;
  const fin = r.revenue !== null ? `CA ${eur(r.revenue)} (${r.last_year})${r.net_income !== null ? `, résultat ${eur(r.net_income)}` : ''}` : 'aucun compte publié';
  return `**${r.name}** (SIREN ${r.siren}) — ${[r.commune_name, sector].filter(Boolean).join(', ')} · ${r.primary_type ? OPPORTUNITY_LABELS[r.primary_type as OpportunityType] : 'pas de signal'} · score ${score(r.economic_score)}, risque ${r.risk_score ?? 'n.d.'}/100, fiabilité ${r.reliability_score ?? 'n.d.'}/100 · ${fin}`;
}

async function companyDossier(db: Db, id: number, settings: AppSettings) {
  const c = await db.get<Record<string, string | number | null>>('SELECT * FROM companies WHERE id = ?', [id]);
  const s = await db.get<{ economic_score: number | null; risk_score: number; reliability_score: number; data_status: string; detail: string }>('SELECT * FROM scoring_results WHERE company_id = ?', [id]);
  const v = await db.get<{ low: number | null; central: number | null; high: number | null; detail: string }>('SELECT * FROM valuations WHERE company_id = ?', [id]);
  const procs = await db.all<{ type: ProcType; status: ProcStatus; opened_at: string | null; tribunal: string | null; administrator: string | null; url: string | null }>('SELECT type, status, opened_at, tribunal, administrator, url FROM legal_proceedings WHERE company_id = ? ORDER BY opened_at', [id]);
  const fin = await loadFinancials(db, id);
  const signals = await db.all<{ signal_type: string; evidence: string; evidence_url: string | null; source_id: string }>('SELECT signal_type, evidence, evidence_url, source_id FROM transmission_signals WHERE company_id = ?', [id]);
  const opp = await db.get<{ primary_type: string; reasons: string }>('SELECT primary_type, reasons FROM acquisition_opportunities WHERE company_id = ?', [id]);
  const project = await db.get<{ asking_price: number | null; status: string }>('SELECT asking_price, status FROM acquisition_projects WHERE company_id = ?', [id]);
  return { c: c!, s, v, procs, fin, signals, opp, project, settings };
}

type Dossier = Awaited<ReturnType<typeof companyDossier>>;

/** Prix maximal finançable : plus haut prix pour lequel le scénario central couvre la dette (couverture ≥ 1,25). */
export function maxFinanceablePrice(revenue: number, ebe: number, depreciation: number, settings: AppSettings): number | null {
  if (ebe <= 0 || revenue <= 0) return null;
  const central = defaultScenarios()[1]!;
  const ok = (price: number) => {
    const r = runScenario(
      { baseRevenue: revenue, baseEbe: ebe, baseDepreciation: depreciation, price, acquisitionFeesRate: settings.deal.acquisitionFeesRate, initialInvestment: 0, workingCapital: revenue * settings.deal.workingCapitalRate, cashBuffer: (revenue / 12) * settings.deal.cashBufferMonths * 0.3, debtShare: settings.deal.debtShare, interestRate: settings.deal.interestRate, loanYears: settings.deal.loanYears, taxRate: settings.deal.taxRate, exitEbeMultiple: 4 },
      central,
    );
    return Math.min(...r.years.map((y) => y.dscr ?? Infinity)) >= 1.25;
  };
  if (!ok(1000)) return null;
  let lo = 1000;
  let hi = ebe * 20;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo / 1000) * 1000;
}

function dossierText(d: Dossier, focus: 'complet' | 'risques' | 'prix'): { text: string; uncertainties: string[] } {
  const c = d.c;
  const unc: string[] = [];
  const lines: string[] = [`### ${c.name} — SIREN ${c.siren}`];
  const sector = c.sector_id ? SECTOR_BY_ID.get(c.sector_id as string)?.label : null;
  if (focus === 'complet') {
    lines.push(`${[c.legal_form_label, sector, c.commune_name, c.creation_date ? `créée le ${c.creation_date}` : null].filter(Boolean).join(' · ')}`);
    if (d.opp) lines.push(`**Situation radar** : ${OPPORTUNITY_LABELS[d.opp.primary_type as OpportunityType]}${d.opp.primary_type === 'cachee' ? ' — piste de prospection, l\'entreprise n\'est PAS déclarée à vendre.' : ''}`);
  }
  if (d.s) lines.push(`**Scores** : économique ${score(d.s.economic_score)}, risque ${d.s.risk_score}/100, fiabilité des données ${d.s.reliability_score}/100 (${d.s.data_status}).`);
  if (d.s?.data_status !== 'suffisant') unc.push('Données partielles ou insuffisantes : les scores et estimations sont fragiles.');
  const last = d.fin[d.fin.length - 1];
  if (focus !== 'risques') {
    if (d.fin.length) {
      lines.push(`**Comptes publiés** : ${d.fin.map((y) => `${y.fiscalYear} : CA ${eur(y.revenue)}, résultat net ${eur(y.netIncome)}${ebeOf(y).value !== null ? `, EBE ${eur(ebeOf(y).value)}` : ''}`).join(' ; ')}`);
      const t = analyzeTrends(d.fin);
      lines.push(`**Tendances** : ${t.summary}`);
    } else {
      lines.push('**Comptes** : aucun compte publié dans les sources consultées (comptes confidentiels ou non déposés). Aucune analyse financière possible sans les liasses du vendeur.');
      unc.push('Aucune donnée financière : ne pas conclure sur la rentabilité.');
    }
    if (d.v && d.v.central !== null) {
      lines.push(`**Valorisation indicative** : ${eur(d.v.low)} – ${eur(d.v.central)} – ${eur(d.v.high)} (bas / central / haut, hypothèses paramétrables, pas une référence officielle).`);
    } else lines.push('**Valorisation** : non calculable avec les données disponibles.');
  }
  if (focus === 'prix') {
    const ebe = last ? ebeOf(last).value : null;
    if (last && typeof last.revenue === 'number' && ebe !== null) {
      const max = maxFinanceablePrice(last.revenue, ebe, last.depreciation ?? 0, d.settings);
      lines.push(
        max
          ? `**Prix maximal finançable (scénario central)** : environ ${eur(max)}. Hypothèses : ${Math.round(d.settings.deal.debtShare * 100)} % de dette sur ${d.settings.deal.loanYears} ans à ${(d.settings.deal.interestRate * 100).toFixed(1)} %, frais ${Math.round(d.settings.deal.acquisitionFeesRate * 100)} %, couverture du service de la dette ≥ 1,25 chaque année, scénario central (CA −5 % l'année 1 puis +2 %/an).`
          : "**Prix maximal finançable** : l'EBE publié ne permet pas de couvrir une dette d'acquisition selon les hypothèses retenues.",
      );
      if (d.project?.asking_price) lines.push(`Prix demandé saisi : ${eur(d.project.asking_price)}.`);
      unc.push('Le prix raisonnable dépend de l\'EBE retraité (rémunération du dirigeant, éléments exceptionnels), à obtenir auprès du vendeur.');
    } else {
      lines.push('**Prix** : impossible d\'estimer un prix maximal sans chiffre d\'affaires et EBE (ou résultat d\'exploitation et dotations).');
      unc.push('Prix non estimable faute de données.');
    }
  }
  if (focus !== 'prix') {
    if (d.procs.length) {
      lines.push(`**Procédures (BODACC)** : ${d.procs.map((p) => `${PROC_TYPE_LABELS[p.type]} — ${PROC_STATUS_LABELS[p.status]}${p.opened_at ? ` (ouverte le ${p.opened_at}${p.tribunal ? `, ${p.tribunal}` : ''})` : ''}${p.administrator ? ` ; texte publié : ${p.administrator}` : ''}`).join(' ; ')}`);
    } else lines.push('**Procédures** : aucune procédure collective connue au BODACC.');
    if (d.signals.length) lines.push(`**Signaux publics** : ${d.signals.map((s) => `« ${s.evidence.slice(0, 160)} » (${s.source_id}${s.evidence_url ? `, ${s.evidence_url}` : ''})`).join(' ; ')}`);
    if (d.s) {
      const det = JSON.parse(d.s.detail) as { risk: { label: string; value: number | null; explanation: string; basis: string }[] };
      const risks = det.risk.filter((r) => (r.value ?? 0) >= 0.5).map((r) => `${r.label} : ${r.explanation}${r.basis === 'inconnu' ? ' (non documenté)' : ''}`);
      if (risks.length) lines.push(`**Principaux risques** : ${risks.join(' ; ')}`);
    }
    const active = d.procs.find((p) => p.status !== 'cloturee');
    if (active || focus === 'risques') {
      const a = analyzeDistress(active ? { type: active.type, status: active.status } : null, { isIndividual: c.is_individual === 1, headcount: headcountMid(c.headcount_band as string | null) });
      if (active) lines.push(`**Modes de reprise** : ${a.modes.map((m) => `${m.label} (${m.applicability === 'possible' ? 'possible' : m.applicability === 'a_verifier' ? 'à vérifier' : 'peu probable'})`).join(', ')}. ${a.disclaimer}`);
    }
  }
  return { text: lines.join('\n\n'), uncertainties: unc };
}

export async function askLocal(db: Db, question: string, contextIds: number[] = []): Promise<AssistantAnswer> {
  const settings = await getSettings(db);
  const deps = settings.sync.departments;
  const t = fold(question);
  const total = (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM companies'))?.n ?? 0;
  const base: Pick<AssistantAnswer, 'mode' | 'sources' | 'uncertainties'> = { mode: 'local', sources: [], uncertainties: [] };
  if (!total) {
    return { ...base, intent: 'vide', answer: "La base ne contient encore aucune entreprise : lancez une synchronisation (Administration → Synchronisations) pour importer les données officielles. Je ne peux pas répondre sans données réelles.", companies: [] };
  }
  const lastRun = await db.get<{ status: string; finished_at: string | null }>("SELECT status, finished_at FROM sync_runs WHERE status != 'running' ORDER BY id DESC LIMIT 1");
  if (!lastRun || lastRun.status !== 'success') base.uncertainties.push(lastRun ? `La dernière veille (${lastRun.finished_at?.slice(0, 10)}) est ${lastRun.status === 'partial' ? 'partielle : certaines sources n\'ont pas pu être interrogées' : 'en erreur'} — les résultats peuvent être incomplets.` : 'Aucune veille complète n\'a encore été exécutée.');
  const companies = await resolveCompanies(db, question, contextIds);
  const sectors = detectSectors(question);
  const communes = await detectCommunes(db, question, deps);
  const n = Math.min(Number(t.match(/\b(\d{1,2})\b/)?.[1] ?? 10), 50) || 10;

  // Questions générales sans entreprise
  if (/demander au vendeur|informations? (dois|a) demander|que demander/.test(t)) {
    return { ...base, intent: 'questions_vendeur', answer: `**Informations à demander au vendeur**\n\n${SELLER_REQUESTS.map((x) => `- ${x}`).join('\n')}`, companies: [], sources: ['Checklist de due diligence intégrée'] };
  }
  if (/avant de signer|verifier avant|due diligence|checklist/.test(t) && !companies.length) {
    return { ...base, intent: 'avant_signature', answer: `**Points à vérifier avant de signer**\n\n${BEFORE_SIGNING.map((x) => `- ${x}`).join('\n')}\n\nPour une entreprise en procédure collective, ouvrez sa fiche : la checklist juridique spécifique s'affiche dans l'onglet « Reprise en difficulté ».`, companies: [], sources: ['Checklist de due diligence intégrée'] };
  }
  if (/quel secteur|secteur le plus|secteurs? (les )?plus interessant/.test(t)) {
    const rows = await db.all<{ sector_id: string; n: number; scored: number; avg_eco: number | null; avg_risk: number | null; opps: number }>(
      `SELECT c.sector_id, COUNT(*) AS n, SUM(CASE WHEN s.economic_score IS NOT NULL THEN 1 ELSE 0 END) AS scored, AVG(s.economic_score) AS avg_eco, AVG(s.risk_score) AS avg_risk,
       SUM(CASE WHEN o.company_id IS NOT NULL THEN 1 ELSE 0 END) AS opps
       FROM companies c LEFT JOIN scoring_results s ON s.company_id = c.id LEFT JOIN acquisition_opportunities o ON o.company_id = c.id
       WHERE c.sector_id IS NOT NULL GROUP BY c.sector_id HAVING scored >= 3 ORDER BY avg_eco DESC LIMIT 10`,
    );
    if (!rows.length) return { ...base, intent: 'secteurs', answer: 'Pas assez d\'entreprises notées par secteur (3 minimum) pour comparer les secteurs.', companies: [] };
    return {
      ...base,
      intent: 'secteurs',
      answer: `**Secteurs classés par score économique moyen** (entreprises disposant d'une note)\n\n| Secteur | Entreprises | Notées | Score moyen | Risque moyen | Opportunités |\n|---|---|---|---|---|---|\n${rows.map((r) => `| ${SECTOR_BY_ID.get(r.sector_id)?.label ?? r.sector_id} | ${r.n} | ${r.scored} | ${Math.round(r.avg_eco ?? 0)} | ${Math.round(r.avg_risk ?? 0)} | ${r.opps} |`).join('\n')}`,
      companies: [],
      sources: ['Scores calculés par l\'outil à partir des données officielles'],
      uncertainties: [...base.uncertainties, 'Moyennes sur les seules entreprises notées : un secteur où peu de comptes sont publiés est sous-représenté.'],
    };
  }

  // Questions portant sur des entreprises précises
  if (companies.length >= 2 && /compar/.test(t)) {
    const rows: string[] = [];
    const out: AssistantAnswer['companies'] = [];
    for (const c of companies.slice(0, 5)) {
      const d = await companyDossier(db, c.id, settings);
      const last = d.fin[d.fin.length - 1];
      rows.push(`| ${c.name} | ${score(d.s?.economic_score)} | ${d.s?.risk_score ?? 'n.d.'} | ${d.s?.reliability_score ?? 'n.d.'} | ${last ? `${eur(last.revenue)} (${last.fiscalYear})` : 'n.d.'} | ${last ? eur(last.netIncome) : 'n.d.'} | ${d.v?.central ? eur(d.v.central) : 'n.d.'} | ${d.procs.some((p) => p.status !== 'cloturee') ? 'oui' : 'non'} |`);
      out.push({ ...c, detail: 'comparée' });
    }
    return { ...base, intent: 'comparaison', answer: `**Comparaison**\n\n| Entreprise | Score éco. | Risque | Fiabilité | CA | Résultat net | Valeur centrale | Procédure |\n|---|---|---|---|---|---|---|---|\n${rows.join('\n')}`, companies: out, sources: ['Comptes publiés', 'BODACC', 'Calculs de l\'outil'] };
  }
  if (companies.length >= 1) {
    const focus = /prix|combien|maximum|valeur|valoris/.test(t) ? 'prix' : /risque/.test(t) ? 'risques' : 'complet';
    const parts: string[] = [];
    const unc: string[] = [];
    for (const c of companies.slice(0, 3)) {
      const d = await companyDossier(db, c.id, settings);
      const r = dossierText(d, focus);
      parts.push(r.text);
      unc.push(...r.uncertainties);
    }
    if (/avant de signer|verifier|due diligence/.test(t)) parts.push(`**Avant de signer** :\n${BEFORE_SIGNING.map((x) => `- ${x}`).join('\n')}`);
    return { ...base, intent: `entreprise_${focus}`, answer: parts.join('\n\n---\n\n'), companies: companies.map((c) => ({ ...c, detail: focus })), sources: ['Annuaire des entreprises (SIRENE/RNE)', 'BODACC', 'Comptes publiés', 'Calculs de l\'outil'], uncertainties: [...base.uncertainties, ...unc] };
  }

  // Recherches de listes
  const f: SearchQuery = SearchSchema.parse({ pageSize: n, sort: 'score' });
  const criteria: string[] = [];
  if (sectors.length) {
    f.sectors = sectors;
    criteria.push(`secteur : ${sectors.map((s) => SECTOR_BY_ID.get(s)?.label).join(', ')}`);
  }
  if (communes.length) {
    f.communes = communes.map((c) => c.code);
    criteria.push(`commune : ${communes.map((c) => c.name).join(', ')}`);
  }
  if (/liquidation/.test(t)) (f.procedureTypes = ['liquidation']), (f.activeProcedure = true), criteria.push('liquidation en cours');
  else if (/redressement/.test(t)) (f.procedureTypes = ['redressement']), (f.activeProcedure = true), criteria.push('redressement en cours');
  else if (/sauvegarde/.test(t)) (f.procedureTypes = ['sauvegarde']), (f.activeProcedure = true), criteria.push('sauvegarde en cours');
  else if (/procedure|difficulte/.test(t)) (f.activeProcedure = true), criteria.push('procédure collective en cours');
  if (/a vendre|en vente|cession/.test(t)) (f.opportunityTypes = ['a_vendre']), criteria.push('annonce de cession active');
  else if (/transmission|retraite|successeur|repreneur/.test(t)) (f.opportunityTypes = ['transmission']), (f.sort = 'transmission'), criteria.push('signal public de transmission');
  else if (/cache|piste|prospect/.test(t)) (f.opportunityTypes = ['cachee']), criteria.push('pistes de prospection (non déclarées à vendre)');
  else if (/opportunit|reprendre|interessant|meilleur|top/.test(t) && !f.activeProcedure) f.opportunityTypes = ['a_vendre', 'procedure', 'transmission', 'cachee'];
  const ratio = /rentabilite.{0,10}risque|rapport.{0,20}risque/.test(t);
  if (ratio) {
    f.dataStatus = ['suffisant', 'partiel'];
    f.pageSize = 200;
  }
  const res = await searchCompanies(db, f, deps);
  let rows = res.rows;
  if (ratio) {
    rows = rows.filter((r) => r.economic_score !== null && r.risk_score !== null).sort((a, b) => b.economic_score! / Math.max(b.risk_score!, 10) - a.economic_score! / Math.max(a.risk_score!, 10)).slice(0, n);
    criteria.push('classement par score économique / score de risque');
  }
  if (!rows.length) {
    return { ...base, intent: 'recherche', answer: `Aucune entreprise ne correspond${criteria.length ? ` (${criteria.join(' ; ')})` : ''} dans les données actuellement synchronisées. Cela ne signifie pas qu'il n'en existe pas : vérifiez que les sources concernées sont activées et à jour.`, companies: [] };
  }
  const unscored = rows.filter((r) => r.economic_score === null).length;
  return {
    ...base,
    intent: 'recherche',
    answer: `**${rows.length} entreprise(s)${res.total > rows.length && !ratio ? ` sur ${res.total}` : ''}**${criteria.length ? ` — ${criteria.join(' ; ')}` : ''}, classées par ${ratio ? 'rapport rentabilité / risque' : f.sort === 'transmission' ? 'indice de transmission' : 'score économique'} :\n\n${rows.map((r, i) => `${i + 1}. ${listLine(r)}`).join('\n')}`,
    companies: rows.map((r) => ({ id: r.id, siren: r.siren, name: r.name, detail: r.primary_type ?? '' })),
    sources: ['Annuaire des entreprises (SIRENE/RNE)', 'BODACC', 'Scores calculés par l\'outil'],
    uncertainties: [...base.uncertainties, ...(unscored ? [`${unscored} entreprise(s) sans note économique faute de comptes publiés : leur place dans le classement n'est pas significative.`] : []), 'Les pistes de prospection ne sont pas des entreprises à vendre : aucune intention de cession n\'est supposée.'],
  };
}

// --- Modèle externe facultatif ------------------------------------------------------------------
/** Tarifs publics par million de tokens (USD) utilisés pour le suivi du budget. */
const PRICES: Record<string, { input: number; output: number }> = {
  'claude-opus-5-5': { input: 4, output: 20 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5 },
};

const SYSTEM_PROMPT = `Tu es RADAR AI, assistant d'analyse d'acquisitions d'entreprises en Normandie.
Tu reçois une question, une réponse préparée par le moteur local et les données exactes sur lesquelles elle repose.
Rédige une réponse claire en français, structurée en Markdown, en t'appuyant EXCLUSIVEMENT sur ces données :
n'ajoute aucune entreprise, aucun chiffre, aucun dirigeant, aucune annonce ni aucun prix qui n'y figure pas.
Ne suppose jamais les intentions, l'âge, la santé ou la situation personnelle d'un dirigeant.
Une « piste de prospection » n'est pas une entreprise à vendre : ne la présente jamais comme disponible.
Signale explicitement les incertitudes et les données manquantes. Aucune promesse de rendement.`;

export async function ask(db: Db, question: string, contextIds: number[], apiKey: string | undefined, fetchImpl?: typeof fetch): Promise<AssistantAnswer> {
  const local = await askLocal(db, question, contextIds);
  const settings = await getSettings(db);
  if (settings.ai.provider !== 'anthropic' || !apiKey || local.intent === 'vide') return local;
  const month = new Date().toISOString().slice(0, 7);
  const spent = Number((await getKv(db, `ai:${month}`)) ?? 0);
  if (spent >= settings.ai.monthlyBudgetUsd) return { ...local, aiNote: `Budget mensuel du modèle externe atteint (${spent.toFixed(2)} $ / ${settings.ai.monthlyBudgetUsd} $) : réponse du moteur local.` };
  const data = JSON.stringify({ question, reponse_locale: local.answer, sources: local.sources, incertitudes: local.uncertainties }).slice(0, 60_000);
  const payload = settings.ai.sendCompanyNames ? data : data.replace(/\*\*[^*]+\*\*/g, '**[entreprise]**');
  try {
    const client = new Anthropic({ apiKey, fetch: fetchImpl, maxRetries: 2 });
    const response = await client.beta.messages.create({
      model: settings.ai.model,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Données (JSON) :\n${payload}` }],
    });
    const price = PRICES[settings.ai.model] ?? PRICES['claude-opus-5-5']!;
    const cost = (response.usage.input_tokens * price.input + response.usage.output_tokens * price.output) / 1_000_000;
    await setKv(db, `ai:${month}`, String(spent + cost));
    if (response.stop_reason === 'refusal') return { ...local, aiNote: 'Le modèle externe a décliné la demande : réponse du moteur local.' };
    const text = response.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    if (!text) return { ...local, aiNote: 'Réponse vide du modèle externe : réponse du moteur local.' };
    return { ...local, answer: text, mode: 'claude', aiNote: `Synthèse rédigée par ${response.model} à partir des seules données affichées (coût estimé ${cost.toFixed(4)} $).` };
  } catch (e) {
    const msg = e instanceof Anthropic.AuthenticationError ? 'clé ANTHROPIC_API_KEY invalide' : e instanceof Anthropic.RateLimitError ? 'limite de débit atteinte' : e instanceof Anthropic.APIError ? `erreur ${e.status}` : 'service injoignable';
    return { ...local, aiNote: `Modèle externe indisponible (${msg}) : réponse du moteur local.` };
  }
}
