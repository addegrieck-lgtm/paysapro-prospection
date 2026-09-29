// EnrichmentOrchestrator (EnrichmentEngine) : enrichissement complet d'une entreprise, piloté par l'apprentissage.
//
//   Entreprise
//    ↓ 1. Identification            données officielles (SIRENE) → identité de référence (domain/identity.ts)
//    ↓ 2. Champs manquants          téléphone / e-mail / site déjà assez sûrs ? (seuils LEARNING_CONFIG.stop)
//    ↓ 3. Boucle adaptative         tant qu'il manque quelque chose ET que le budget du mode le permet :
//         • stratégies possibles (catalogue domain/strategies.ts, prérequis, mode) ;
//         • choix : meilleure valeur attendue d'après les statistiques réelles (80 %) ou exploration (20 %) ;
//         • exécution : annuaire public, site connu, exploration approfondie, découverte du site (domaines
//           plausibles vérifiés par leur contenu), recherche web si un fournisseur autorisé est configuré ;
//         • une source en panne n'arrête jamais l'enrichissement (résultat « partiel ») ;
//    ↓ 4. Vérification              normalisation, recoupement, faux positifs, confiance, numéros partagés,
//                                   données qui ont disparu de leur page (« ancienne »)
//    ↓ 5. Enregistrement            fusion sans jamais écraser une saisie manuelle, historique, score, CRM
//    ↓ 6. Apprentissage             statistiques par stratégie × champ × segment, trace de chaque stratégie
//
// Rien n'est jamais inventé : ni numéro, ni e-mail, ni site. Un domaine « deviné » n'est qu'une piste, retenue
// uniquement si le site correspond à l'entreprise.
import type { CompanyEmail, CompanyPhone, CompanyWebsite, ContactEvidence, ContactField, EnrichmentAttempt, EnrichmentFound, EnrichmentMode, Prospect, StrategyId } from '../domain/types';
import type { ContactSet, ProspectsApi } from './repository';
import type { Company, CompanyDataProvider } from '../providers/company/CompanyDataProvider';
import type { OpenStreetMapProvider } from '../providers/company/OpenStreetMapProvider';
import type { SiteAnalysis, WebsiteProvider } from '../providers/company/WebsiteProvider';
import { analyzeResult, type WebSearchProvider } from '../providers/search/WebSearchProvider';
import { newEmail, newPhone, newWebsite } from '../domain/contactSync';
import { applyStatus, mergeProspect } from '../domain/prospect';
import { domainCandidates, domainOf } from '../domain/webContacts';
import { normName } from '../domain/normalize';
import { buildQuery, STRATEGIES, type StrategyDef } from '../domain/strategies';
import { chooseStrategy, LEARNING_CONFIG, MODE_BUDGETS, MODE_LABEL, sectorOf, segmentOf, type RunOutcome } from '../domain/learning';
import { ProviderError } from '../providers/http';
import { ENRICHMENT_CONFIG } from '../config';

export interface EngineProviders {
  official: CompanyDataProvider;
  directory?: OpenStreetMapProvider | null;
  website?: WebsiteProvider | null;
  /** Recherche web autorisée (facultative) : aucune par défaut */
  search?: WebSearchProvider | null;
}

/** Étapes affichées en temps réel (§63) */
export type EnrichStage = 'identity' | 'directory' | 'website_search' | 'web_search' | 'crawling' | 'verifying' | 'saving' | 'done';

export const STAGE_LABEL: Record<EnrichStage, string> = {
  identity: 'Identification',
  directory: 'Sources publiques',
  website_search: 'Recherche du site',
  web_search: 'Recherche web',
  crawling: 'Analyse du site (téléphone, e-mail)',
  verifying: 'Vérification',
  saving: 'Enregistrement',
  done: 'Terminé',
};

const STAGE_OF_KIND: Record<StrategyDef['kind'], EnrichStage> = { directory: 'directory', discovery: 'website_search', web_search: 'web_search', site: 'crawling' };

export interface EngineOptions {
  force?: boolean;
  /** Ancien mode « Maximiser les téléphones » (= mode « max ») */
  maxPhones?: boolean;
  mode?: EnrichmentMode;
  signal?: AbortSignal;
  /** Progression en temps réel : étape en cours + libellé de la stratégie */
  onProgress?: (stage: EnrichStage, detail?: string) => void;
  /** Hasard (exploration) — injectable pour des tests reproductibles */
  rng?: () => number;
}

export interface EngineResult {
  prospect: Prospect | null;
  outcome: 'enriched' | 'partial' | 'no_change' | 'not_found' | 'ambiguous' | 'failed' | 'skipped';
  found: EnrichmentFound;
  steps: string[];
  details: string[];
  error: string | null;
  /** Recherche par nom ambiguë : entreprises possibles (à choisir par l'utilisateur) */
  candidates?: Company[];
  mode?: EnrichmentMode;
  /** Stratégies exécutées, dans l'ordre */
  strategies?: StrategyId[];
  /** Pourquoi la recherche s'est arrêtée */
  stoppedBy?: 'complete' | 'budget' | 'exhausted' | 'fresh';
}

const emptyFound = (): EnrichmentFound => ({ phones: 0, verifiedPhones: 0, emails: 0, websites: 0, bySource: {} });
const KIND_OF: Record<ContactField, 'phones' | 'emails' | 'websites'> = { phone: 'phones', email: 'emails', website: 'websites' };

type Found = { phones: CompanyPhone[]; emails: CompanyEmail[]; websites: CompanyWebsite[] };

export class EnrichmentEngine {
  private api: ProspectsApi;
  private p: EngineProviders;

  constructor(api: ProspectsApi, providers: EngineProviders) {
    this.api = api;
    this.p = providers;
  }

  get providers(): EngineProviders {
    return this.p;
  }

  private fresh(at: string | null): boolean {
    return !!at && Date.now() - new Date(at).getTime() < ENRICHMENT_CONFIG.cacheDays * 86_400_000;
  }

  async enrichCompany(prospectId: string, o: EngineOptions = {}): Promise<EngineResult> {
    const started = Date.now();
    const startedAt = new Date().toISOString();
    const progress = (s: EnrichStage, d?: string) => o.onProgress?.(s, d);
    const settings = await this.api.getSettings();
    const enabled = settings.providers;
    const mode: EnrichmentMode = o.mode ?? (o.maxPhones ? 'max' : 'normal');
    const steps: string[] = [];
    const details: string[] = [];
    const found = emptyFound();
    let adminOutcome: EngineResult['outcome'] = 'skipped';
    let error: string | null = null;
    let candidates: Company[] | undefined;

    // 1. Identification (données officielles)
    progress('identity');
    if (enabled.official) {
      const r = await this.api.enrichProspect(prospectId, this.p.official, { force: o.force, signal: o.signal });
      steps.push(r.skipped ? 'Administratif (récent, conservé)' : 'Administratif');
      if (r.error) error = r.error;
      if (r.application) {
        adminOutcome = r.application.outcome === 'failed' ? 'failed' : r.application.outcome;
        details.push(...r.application.details);
      }
      if (r.outcome?.status === 'ambiguous') candidates = r.outcome.candidates;
    }

    let p = await this.api.getProspect(prospectId);
    if (!p) throw new Error('Prospect introuvable.');
    if (p.demo || p.anonymized) return { prospect: p, outcome: 'skipped', found, steps, details, error, mode };

    if (this.fresh(p.contactsCheckedAt) && !o.force && mode !== 'max') {
      steps.push('Coordonnées (récentes, conservées)');
      progress('done');
      return { prospect: p, outcome: adminOutcome === 'skipped' ? 'no_change' : adminOutcome, found, steps, details, error, mode, strategies: [], stoppedBy: 'fresh' };
    }

    // 2–3. Boucle adaptative
    const now = new Date().toISOString();
    const company = p;
    const current = await this.api.contactsFor(p.id);
    const stats = await this.api.strategyStats();
    const seg = segmentOf(p);
    const exploration = settings.exploration ?? LEARNING_CONFIG.exploration;
    const budget = { ...MODE_BUDGETS[mode] };
    const incoming: Found = { phones: [], emails: [], websites: [] };
    const socials: { facebook?: string; instagram?: string; linkedin?: string } = {};
    const ran = new Set<StrategyId>();
    const runs: RunOutcome[] = [];
    const attempts: Omit<EnrichmentAttempt, 'id' | 'workspaceId' | 'prospectId'>[] = [];
    /** Sites / domaines déjà essayés (jamais relus deux fois dans le même enrichissement) */
    const tried = new Set<string>();
    const keyOf = (u: string) => domainOf(u) ?? u;
    const analyzedPages = new Set<string>();
    const announced = new Set<string>();
    const siteCandidates: string[] = [p.website, ...current.websites.filter((w) => w.status !== 'rejected').map((w) => w.display)].filter((x): x is string => !!x);
    let verifiedSite: SiteAnalysis | null = null;
    let deepDone = false;
    let extended = false;
    let failures = 0;
    let requests = 0;
    const siteOn = enabled.website && !!this.p.website?.enabled;

    const known = (field: ContactField, value: string) => current[KIND_OF[field]].some((c) => c.value === value) || (incoming[KIND_OF[field]] as { value: string }[]).some((c) => c.value === value);

    // Champs encore à chercher : pas de coordonnée assez sûre (en mode « Maximum contact », téléphones et
    // e-mails restent recherchés tant que le budget le permet : plusieurs numéros pertinents)
    const missing = (): ContactField[] => {
      const out: ContactField[] = [];
      const best = (list: { confidence: number; manual: boolean; status: string; currency?: string }[]) =>
        Math.max(0, ...list.filter((c) => c.status !== 'rejected' && c.currency !== 'historical').map((c) => (c.manual ? 100 : c.confidence)));
      const phones = [...current.phones, ...incoming.phones].filter((c) => c.type !== 'fax');
      if (mode === 'max' || best(phones) < LEARNING_CONFIG.stop.phone) out.push('phone');
      if (mode === 'max' || best([...current.emails, ...incoming.emails]) < LEARNING_CONFIG.stop.email) out.push('email');
      const siteKnown = verifiedSite || [...current.websites, ...incoming.websites].some((w) => w.status !== 'rejected' && (w.manual || (w.verified && w.confidence >= LEARNING_CONFIG.stop.website)));
      if (!siteKnown) out.push('website');
      return out;
    };

    const available = (def: StrategyDef, need: ContactField[]): boolean => {
      if (ran.has(def.id) || !def.modes.includes(mode) || !def.fields.some((f) => need.includes(f))) return false;
      if (def.kind === 'directory') return enabled.directory && !!this.p.directory && (this.p.directory.available || !!this.p.directory.loadedFrom);
      if (def.kind === 'site') {
        if (!siteOn) return false;
        if (def.requires === 'known_site') return siteCandidates.some((u) => !tried.has(keyOf(u)));
        return !!verifiedSite && !deepDone;
      }
      // Découverte du site et recherche web : seulement tant qu'aucun site n'est confirmé, et après avoir lu le site connu
      if (verifiedSite || !need.includes('website')) return false;
      if (siteOn && siteCandidates.some((u) => !tried.has(keyOf(u)))) return false;
      if (def.kind === 'web_search') return !!this.p.search?.enabled && siteOn && !!buildQuery(def, company);
      if (!siteOn || !enabled.websiteDiscovery) return false;
      if (def.requires === 'trade_name') return !!company.tradeName && normName(company.tradeName) !== normName(company.name) && this.domains(def, company).length > 0;
      if (def.requires === 'landscape') return sectorOf(company.nafCode) === 'paysage' && this.domains(def, company).length > 0;
      return this.domains(def, company).length > 0;
    };

    // Ajoute les coordonnées d'une analyse de site (provenance complète : page, stratégie, concordances)
    const collect = (a: SiteAnalysis, strategy: StrategyId, produced: RunOutcome['produced']) => {
      tried.add(keyOf(a.url));
      a.pages.forEach((u) => analyzedPages.add(u));
      analyzedPages.add(a.url);
      if (a.verified && (!verifiedSite || a.matchScore > verifiedSite.matchScore)) verifiedSite = a;
      const matched = [
        ...(a.identity.siret ? ['siret'] : a.identity.siren ? ['siren'] : []),
        ...(a.identity.name ? ['name'] : []),
        ...(a.identity.city ? ['city'] : []),
        ...(a.identity.postalCode ? ['postalCode'] : []),
        ...(a.identity.street ? ['address'] : []),
        ...(a.verified ? ['website_verified'] : []),
      ];
      const provider = a.verified ? 'Site officiel' : 'Site web (non vérifié)';
      const add = <T extends CompanyPhone | CompanyEmail | CompanyWebsite>(field: ContactField, c: T | null) => {
        if (!c) return;
        c.evidence = c.evidence.map((e) => ({ ...e, strategy, score: c.confidence }));
        if (!known(field, c.value)) (produced[field] ??= []).push(c.confidence);
        (incoming[KIND_OF[field]] as T[]).push(c);
      };
      const site = newWebsite(company, a.url, { kind: 'website', provider, url: a.url, at: now, matched }, now, a.verified);
      if (site) site.matchScore = a.matchScore;
      add('website', site);
      for (const ph of a.phones) {
        const m = [...matched, ...(ph.fromTelLink ? ['tel_link'] : []), ...(ph.callContext ? ['call_context'] : [])];
        add('phone', newPhone(company, ph.e164, { kind: 'website', provider, url: ph.pageUrl, at: now, matched: m }, now, ph.fax));
      }
      for (const em of a.emails) {
        // Un e-mail nominatif est une donnée personnelle : il n'est retenu que s'il vient d'un lien « mailto: » du site vérifié
        if (em.kind === 'nominative' && !(a.verified && em.fromMailto)) continue;
        const c = newEmail(company, em.email, { kind: 'website', provider, url: em.pageUrl, at: now, matched }, now);
        add('email', c ? { ...c, kind: em.kind } : null);
      }
      if (a.verified) for (const k of ['facebook', 'instagram', 'linkedin'] as const) if (a.socials[k]) socials[k] ??= a.socials[k]!;
      if (!announced.has(keyOf(a.url))) {
        announced.add(keyOf(a.url));
        if (a.verified) details.push(`✓ Site ${domainOf(a.url)} — correspondance ${a.matchScore} % (${a.matchReasons.join(', ')})`);
        else details.push(`⚠ Site ${domainOf(a.url)} : correspondance insuffisante (${a.matchScore} %) — coordonnées « à vérifier »`);
      }
      if (a.ignoredThirdParty) details.push(`ℹ ${a.ignoredThirdParty} coordonnée(s) de tiers écartée(s) (hébergeur, webmaster, agence web, transporteur…)`);
      if (a.ignoredListed) details.push(`ℹ ${a.ignoredListed} numéro(s) / e-mail(s) d'autres agences écartés (page listant plusieurs contacts)`);
    };

    // Exécution d'une stratégie → requête / cible (traçabilité)
    const execute = async (def: StrategyDef, produced: RunOutcome['produced']): Promise<{ query: string; results: number }> => {
      const web = this.p.website;
      if (def.kind === 'directory') {
        const m = await this.p.directory!.match(company, o.signal);
        if (!m) return { query: 'OpenStreetMap (instantané)', results: 0 };
        const e: ContactEvidence = { kind: 'directory', provider: 'OpenStreetMap', url: m.place.url, at: now, matched: m.matched, strategy: def.id };
        const add = <T extends CompanyPhone | CompanyEmail | CompanyWebsite>(field: ContactField, c: T | null) => {
          if (!c) return;
          c.evidence = c.evidence.map((x) => ({ ...x, score: c.confidence }));
          if (!known(field, c.value)) (produced[field] ??= []).push(c.confidence);
          (incoming[KIND_OF[field]] as T[]).push(c);
        };
        m.place.phones.forEach((ph) => add('phone', newPhone(company, ph, e, now)));
        if (m.place.email) add('email', newEmail(company, m.place.email, e, now));
        if (m.place.website) {
          add('website', newWebsite(company, m.place.website, e, now, false));
          siteCandidates.push(m.place.website);
        }
        if (m.place.facebook) socials.facebook = m.place.facebook;
        if (m.place.instagram) socials.instagram = m.place.instagram;
        details.push(`✓ Trouvée dans OpenStreetMap (${m.sure ? 'même SIRET' : 'nom et localisation concordants'})`);
        return { query: 'OpenStreetMap (instantané)', results: 1 };
      }
      if (def.id === 'site_known') {
        const url = siteCandidates.find((u) => !tried.has(keyOf(u)))!;
        tried.add(keyOf(url)); // « essayé » même en cas d'échec : jamais relu dans ce même enrichissement
        const a = await web!.analyze(url, company, { signal: o.signal, fresh: o.force });
        if (a) collect(a, def.id, produced);
        return { query: url, results: a ? a.pages.length : 0 };
      }
      if (def.id === 'site_deep') {
        const site = verifiedSite!;
        deepDone = true;
        const a = await web!.analyze(site.url, company, { signal: o.signal, fresh: o.force, deep: true, skip: [site.url, ...site.pages] });
        if (a) collect({ ...a, verified: a.verified || site.verified, matchScore: Math.max(a.matchScore, site.matchScore), matchReasons: site.matchReasons }, def.id, produced);
        return { query: `${site.url} (exploration approfondie)`, results: a ? a.pages.length : 0 };
      }
      if (def.kind === 'web_search') {
        const q = buildQuery(def, company)!;
        requests++;
        const results = (await this.p.search!.search(q, { signal: o.signal, count: 10 })).map((r) => analyzeResult(r, company));
        const official = results.filter((r) => r.isPotentialOfficialSite && r.domain && !tried.has(r.domain)).sort((a, b) => b.relevance - a.relevance);
        for (const r of official.slice(0, 3)) {
          tried.add(r.domain!);
          const a = await web!.analyze(`https://${r.domain}`, company, { signal: o.signal }).catch((e) => {
            if (e instanceof ProviderError && e.kind === 'aborted') throw e;
            return null;
          });
          if (a) {
            collect(a, def.id, produced);
            if (a.verified) break;
          }
        }
        return { query: q, results: results.length };
      }
      // Découverte du site par domaines plausibles (vérifiés par leur contenu)
      const domains = this.domains(def, company).filter((d) => !tried.has(d));
      domains.forEach((d) => tried.add(d));
      const a = await web!.discover(company, domains, { signal: o.signal });
      if (a) collect(a, def.id, produced);
      return { query: domains.join(', '), results: a ? 1 : 0 };
    };

    // Réenrichir (§85) : le site connu est toujours relu pour vérifier les données existantes et voir les changements
    const siteKnownDef = STRATEGIES.find((d) => d.id === 'site_known')!;
    let revalidate = !!o.force && available(siteKnownDef, ['phone', 'email']);
    for (;;) {
      if (o.signal?.aborted) throw new ProviderError('aborted', 'Annulé');
      const need = missing();
      if (!need.length && !revalidate) break;
      const spent = { strategies: runs.length, requests, ms: Date.now() - started };
      if (spent.strategies >= budget.maxStrategies || spent.requests >= budget.maxRequests || spent.ms >= budget.maxMs) {
        // Entreprise difficile (rien trouvé) : une rallonge de 50 %, sauf en mode Rapide
        const nothing = !incoming.phones.length && !incoming.emails.length && !incoming.websites.length;
        if (!extended && nothing && mode !== 'fast') {
          extended = true;
          budget.maxStrategies = Math.ceil(budget.maxStrategies * 1.5);
          budget.maxRequests = Math.ceil(budget.maxRequests * 1.5);
          budget.maxMs = Math.ceil(budget.maxMs * 1.5);
          details.push('ℹ Entreprise difficile : budget de recherche augmenté de 50 %');
          continue;
        }
        break;
      }
      const choice = revalidate
        ? { def: siteKnownDef, explored: false, expectedValue: 0 }
        : chooseStrategy(
            STRATEGIES.filter((d) => available(d, need)),
            need,
            stats,
            seg,
            o.rng,
            exploration,
          );
      revalidate = false;
      if (!choice) break;
      const def = choice.def;
      ran.add(def.id);
      progress(STAGE_OF_KIND[def.kind], def.label);
      const t0 = Date.now();
      const before = this.p.website?.requestCount ?? 0;
      const produced: RunOutcome['produced'] = {};
      let query = def.label;
      let results = 0;
      let runError: string | null = null;
      try {
        const r = await execute(def, produced);
        query = r.query;
        results = r.results;
        steps.push(def.label);
      } catch (e) {
        if (e instanceof ProviderError && e.kind === 'aborted') throw e;
        console.warn(`[${def.label}]`, e);
        runError = e instanceof Error ? e.message : String(e);
        failures++;
        steps.push(`${def.label} : indisponible`);
      }
      const used = (this.p.website?.requestCount ?? 0) - before;
      requests += used;
      const targeted = def.fields.filter((f) => need.includes(f));
      const ms = Date.now() - t0;
      runs.push({ strategyId: def.id, targeted, produced, requests: used, ms });
      attempts.push({
        strategyId: def.id,
        provider: def.source,
        query,
        mode,
        explored: choice.explored,
        expectedValue: Math.round(choice.expectedValue * 1000) / 1000,
        targeted,
        timestamp: new Date(t0).toISOString(),
        resultCount: results,
        phonesFound: produced.phone?.length ?? 0,
        emailsFound: produced.email?.length ?? 0,
        websitesFound: produced.website?.length ?? 0,
        verified: Object.values(produced).flat().filter((c) => c >= 80).length,
        requests: used,
        executionMs: ms,
        error: runError,
      });
    }
    const stillMissing = missing();
    const stoppedBy: EngineResult['stoppedBy'] = !stillMissing.length ? 'complete' : runs.length && STRATEGIES.some((d) => available(d, stillMissing)) ? 'budget' : 'exhausted';

    // 4. Vérification : une donnée qui n'apparaît plus sur la page où elle avait été trouvée devient « ancienne »
    progress('verifying');
    const seen = new Set([...incoming.phones, ...incoming.emails].map((c) => c.value));
    const historical = [...current.phones, ...current.emails].filter((c) => {
      if (c.manual || c.status === 'rejected' || c.currency === 'historical' || seen.has(c.value)) return false;
      // Uniquement si TOUTES ses sources consultables sont des pages relues à l'instant (jamais une donnée
      // officielle, importée ou saisie, jamais une donnée vue ailleurs, ex. OpenStreetMap)
      if (c.evidence.some((e) => e.kind === 'manual' || e.kind === 'official' || e.kind === 'import')) return false;
      const sourced = c.evidence.filter((e) => e.url);
      return sourced.length > 0 && sourced.every((e) => e.kind === 'website' && analyzedPages.has(e.url!));
    });
    await this.api.refreshContactFreshness(p.id, now, historical.map((c) => c.id));
    if (historical.length) details.push(`ℹ ${historical.length} coordonnée(s) absente(s) de leur page d'origine : marquée(s) « ancienne(s) » (conservée(s), confiance réduite)`);

    // 5. Fusion (normalisation, recoupement, numéros partagés, jamais d'écrasement d'une saisie manuelle)
    progress('saving');
    const before = await this.api.contactsFor(p.id);
    const merge: ContactSet = { phones: incoming.phones, emails: incoming.emails, websites: incoming.websites };
    const { prospect: merged, contacts, created } = await this.api.mergeContacts(p, merge, now);
    p = merged;
    steps.push('Normalisation et vérification des coordonnées');
    const bySourceOf = (c: CompanyPhone | CompanyEmail | CompanyWebsite) => c.evidence[0]?.provider ?? 'Autre';
    const count = (source: string) => (found.bySource[source] = (found.bySource[source] ?? 0) + 1);
    for (const c of [...created.phones, ...created.emails, ...created.websites]) count(bySourceOf(c));
    found.phones = contacts.phones.filter((c) => c.status !== 'rejected').length - before.phones.filter((c) => c.status !== 'rejected').length;
    found.verifiedPhones = contacts.phones.filter((c) => c.status === 'verified').length - before.phones.filter((c) => c.status === 'verified').length;
    found.emails = created.emails.length;
    found.websites = created.websites.length;
    for (const c of created.phones) details.push(`📞 ${c.display} — confiance ${c.confidence} % (${bySourceOf(c)})${c.shared ? ' ⚠ numéro partagé' : ''}`);
    for (const c of created.emails) details.push(`✉ ${c.display} — confiance ${c.confidence} % (${bySourceOf(c)})`);
    for (const c of created.websites) details.push(`🌐 ${c.display} (${bySourceOf(c)})`);
    details.push(
      `ℹ Mode ${MODE_LABEL[mode]} : ${runs.length} stratégie(s), ${requests} requête(s)${attempts.some((a) => a.explored) ? ' (dont exploration)' : ''} — ${
        stoppedBy === 'complete' ? 'coordonnées trouvées, recherche arrêtée' : stoppedBy === 'budget' ? 'budget atteint' : 'toutes les pistes disponibles ont été essayées'
      }`,
    );

    // Réseaux sociaux : uniquement les URL réellement trouvées, sans écraser une saisie manuelle
    if (Object.keys(socials).length) {
      p = mergeProspect(p, socials, 'fill', now, { type: 'web', provider: 'Présence web publique', at: now, confidence: 'medium' }).prospect;
    }

    // Score (recalculé par finalize) + CRM automatique si activé
    if (settings.autoQualify && p.active && p.phoneStatus === 'verified' && !p.doNotContact && (p.status === 'new' || p.status === 'to_qualify')) {
      p = { ...applyStatus(p, 'to_contact', now), qualifiedAt: now };
      details.push('📇 Ajouté au CRM (À contacter) : entreprise active avec un téléphone vérifié');
    }
    p = { ...p, contactsCheckedAt: now };
    steps.push('Score');

    // 6. Apprentissage, historique et journal
    await this.api.recordLearning(p, runs, attempts);
    const anything = found.phones || found.emails || found.websites;
    const allFailed = runs.length > 0 && failures === runs.length;
    const summary = anything ? `Coordonnées : ${found.phones} téléphone(s), ${found.emails} e-mail(s), ${found.websites} site(s)` : allFailed ? 'Sources indisponibles : enrichissement partiel, à relancer' : 'Recherche de coordonnées : aucune nouvelle donnée publique trouvée';
    await this.api.saveEngineResult(p, summary, details, {
      provider: 'moteur',
      status: anything ? 'enriched' : allFailed ? 'partial' : adminOutcome === 'not_found' || adminOutcome === 'ambiguous' ? adminOutcome : 'no_change',
      startedAt,
      fieldsUpdated: [...(found.phones ? ['phone'] : []), ...(found.emails ? ['email'] : []), ...(found.websites ? ['website'] : [])],
      fieldsConfirmed: [],
      fromCache: false,
      error: error ?? (allFailed ? 'Toutes les sources ont échoué' : null),
      durationMs: Date.now() - started,
      found,
      steps,
      mode,
      strategies: runs.map((r) => r.strategyId),
      requests,
      stoppedBy,
    });
    progress('done');
    const outcome: EngineResult['outcome'] = anything ? (p.enrichmentStatus === 'partial' ? 'partial' : 'enriched') : allFailed ? 'partial' : adminOutcome === 'skipped' ? 'no_change' : adminOutcome;
    return { prospect: p, outcome, found, steps, details, error, candidates, mode, strategies: runs.map((r) => r.strategyId), stoppedBy };
  }

  private domains(def: StrategyDef, c: Prospect): string[] {
    const kind = def.id === 'domain_trade' ? 'trade' : def.id === 'domain_name_city' ? 'name_city' : def.id === 'domain_activity' ? 'activity' : 'name';
    return domainCandidates(kind, c);
  }
}
