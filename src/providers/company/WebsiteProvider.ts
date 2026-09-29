// WebsiteProvider / WebsiteCrawler / ContactPageDetector : coordonnées publiées par l'entreprise sur SON site.
//
// Le navigateur ne peut pas lire directement un autre site (sécurité CORS) : ce fournisseur passe par un
// petit relais GRATUIT que vous déployez (Cloudflare Worker, voir worker/README.md). Sans relais configuré
// (VITE_WEB_PROXY_URL vide), il est simplement désactivé et le reste fonctionne.
//
// Règles du relais : lecture de pages HTML publiques uniquement, robots.txt respecté, 1 requête/s,
// annuaires, moteurs de recherche et réseaux sociaux refusés (leurs conditions l'interdisent).
//
// Exploration (nombre de pages limité) :
//   • standard  : accueil + jusqu'à 3 pages contact / mentions légales (détectées par l'adresse ET le libellé du lien) ;
//   • approfondie : + plan du site (sitemap.xml) et pages devis, à propos, entreprise, services… (jusqu'à 6 de plus).
// Un site n'est retenu que si son SCORE DE CORRESPONDANCE avec l'entreprise atteint le seuil « probable »
// (domain/identity.ts : SIREN, nom, commune, rue, activité, numéro connu…). Rien n'est jamais supposé.
import type { KeyValueCache } from '../../data/cache';
import type { Prospect } from '../../domain/types';
import { fetchJson, ProviderError, RateLimiter, type FetchLike } from '../http';
import {
  candidateDomains,
  contactPageLinks,
  EMPTY_IDENTITY,
  emailBelongsTo,
  extractEmails,
  extractSocialLinks,
  isCallContext,
  isThirdPartyContact,
  LIST_PAGE_THRESHOLD,
  nearestToPlace,
  pageMentions,
  type ExtractedEmail,
  type PageIdentity,
  type SocialLinks,
} from '../../domain/webContacts';
import { extractPhones, toE164, type ExtractedPhone } from '../../domain/phone';
import { domainMatchesName, websiteMatchScore, type SiteSignals } from '../../domain/identity';

export interface ProxyPage {
  ok: boolean;
  status: number;
  url: string;
  html: string;
  error?: string;
}

export interface SiteAnalysis {
  url: string;
  /** Score de correspondance ≥ seuil « probable » */
  verified: boolean;
  /** Score de correspondance du site avec l'entreprise (0–100) et ses raisons */
  matchScore: number;
  matchReasons: string[];
  identity: PageIdentity;
  pages: string[];
  /** listed : numéro tiré d'une page listant plusieurs agences ; callContext : présenté comme numéro à appeler */
  phones: (ExtractedPhone & { pageUrl: string; listed: boolean; callContext: boolean })[];
  emails: (ExtractedEmail & { pageUrl: string })[];
  socials: SocialLinks;
  /** Numéros / e-mails écartés : listés pour d'autres agences sur une page de plusieurs contacts */
  ignoredListed: number;
  /** Coordonnées de tiers écartées (hébergeur, webmaster, agence web, transporteur, adresse d'un thème…) */
  ignoredThirdParty: number;
}

export type SiteCompany = Pick<Prospect, 'name' | 'tradeName' | 'siren' | 'siret' | 'city' | 'postalCode'> & Partial<Pick<Prospect, 'address' | 'activity' | 'nafCode' | 'phone'>>;

export interface AnalyzeOptions {
  signal?: AbortSignal;
  /** Exploration approfondie (plan du site, pages devis / à propos / services) */
  deep?: boolean;
  /** Ignore le cache des pages (réenrichissement) */
  fresh?: boolean;
  /** Pages déjà analysées (non relues en exploration approfondie) */
  skip?: string[];
}

/** Compatibilité : un site est-il vérifié d'après ses seules mentions ? (score ≥ « probable ») */
export function isVerifiedSite(id: PageIdentity): boolean {
  return websiteMatchScore({ ...id, domainMatchesName: false, knownPhone: false, legalPage: false }).accepted;
}

const DEEP_LINK = /devis|a-propos|apropos|qui-sommes|entreprise|societe|equipe|services?|prestations?|realisations|zone|intervention|nous-trouver|coordonn/;
const same = (x: string) => x.replace(/[#?].*$/, '').replace(/\/$/, '');

export class WebsiteProvider {
  readonly id = 'website';
  readonly label = 'Site officiel de l’entreprise (via votre relais gratuit)';
  readonly free = true;
  readonly enabled: boolean;
  private proxyUrl: string;
  private o: { fetchImpl?: FetchLike; cache?: KeyValueCache | null; cacheDays?: number; limiter?: RateLimiter };
  private limiter: RateLimiter;
  /** Requêtes réellement envoyées au relais (hors cache) : sert au budget de recherche */
  requestCount = 0;

  constructor(proxyUrl: string, o: { fetchImpl?: FetchLike; cache?: KeyValueCache | null; cacheDays?: number; limiter?: RateLimiter } = {}) {
    this.proxyUrl = proxyUrl.replace(/\/$/, '');
    this.enabled = !!this.proxyUrl;
    this.o = o;
    this.limiter = o.limiter ?? new RateLimiter(1);
  }

  /** Lecture d'une page via le relais (cache 30 jours). null si la page n'existe pas / n'est pas lisible. */
  async fetchPage(url: string, signal?: AbortSignal, fresh = false): Promise<ProxyPage | null> {
    if (!this.enabled) throw new ProviderError('invalid', 'Relais web non configuré');
    const key = `page:${url}`;
    const cached = this.o.cache && !fresh ? ((await this.o.cache.get(key, this.o.cacheDays ?? 30)) as ProxyPage | undefined) : undefined;
    if (cached) return cached.ok ? cached : null;
    this.requestCount++;
    const page = await fetchJson<ProxyPage>(`${this.proxyUrl}/?url=${encodeURIComponent(url)}`, {
      fetchImpl: this.o.fetchImpl,
      limiter: this.limiter,
      retries: 1,
      timeoutMs: 20_000,
      signal,
    });
    const result = page ?? { ok: false, status: 404, url, html: '' };
    if (this.o.cache) await this.o.cache.set(key, result.ok ? result : { ...result, html: '' });
    return result.ok ? result : null;
  }

  /** Pages supplémentaires de l'exploration approfondie : plan du site + liens internes pertinents. */
  private async deepLinks(home: ProxyPage, seen: Set<string>, o: AnalyzeOptions): Promise<string[]> {
    const base = new URL(home.url);
    const host = base.hostname.replace(/^www\./, '');
    const out: string[] = [];
    const push = (href: string) => {
      try {
        const u = new URL(href, base);
        u.hash = '';
        if (u.hostname.replace(/^www\./, '') !== host || seen.has(same(u.toString())) || /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xml)$/i.test(u.pathname)) return;
        if (!out.some((x) => same(x) === same(u.toString()))) out.push(u.toString());
      } catch {
        /* lien illisible */
      }
    };
    for (const m of home.html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
      const target = `${m[1]} ${m[2]!.replace(/<[^>]+>/g, ' ')}`.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      if (DEEP_LINK.test(target)) push(m[1]!);
    }
    // Plan du site : pages dont l'adresse évoque le contact, l'entreprise, les devis…
    const sitemap = await this.fetchPage(`${base.origin}/sitemap.xml`, o.signal, o.fresh).catch(() => null);
    if (sitemap) for (const m of sitemap.html.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)) if (/contact|mention|legal|devis|propos|entreprise|societe|coordonn/i.test(m[1]!)) push(m[1]!);
    return out.slice(0, 6);
  }

  /** Analyse : accueil + pages contact / mentions légales (+ exploration approfondie si demandée). */
  async analyze(siteUrl: string, c: SiteCompany, opts: AnalyzeOptions | AbortSignal = {}): Promise<SiteAnalysis | null> {
    const o: AnalyzeOptions = opts instanceof AbortSignal ? { signal: opts } : opts;
    const home = await this.fetchPage(siteUrl, o.signal, o.fresh);
    if (!home) return null;
    const seen = new Set([same(home.url), same(siteUrl), ...(o.skip ?? []).map(same)]);
    const pages: ProxyPage[] = o.skip?.some((s) => same(s) === same(home.url)) && o.deep ? [] : [home];
    const toRead = contactPageLinks(home.html, home.url)
      .filter((l) => !seen.has(same(l)))
      .slice(0, 3);
    toRead.forEach((l) => seen.add(same(l)));
    if (o.deep) {
      for (const l of await this.deepLinks(home, seen, o)) {
        toRead.push(l);
        seen.add(same(l));
      }
    }
    for (const link of toRead) {
      const pg = await this.fetchPage(link, o.signal, o.fresh).catch((e) => {
        if (e instanceof ProviderError && e.kind === 'aborted') throw e;
        return null;
      });
      if (pg) pages.push(pg);
    }
    const identity: PageIdentity = { ...EMPTY_IDENTITY };
    const phones: SiteAnalysis['phones'] = [];
    const emails: SiteAnalysis['emails'] = [];
    let socials: SocialLinks = { facebook: null, instagram: null, linkedin: null };
    let ignoredListed = 0;
    const ignored = new Set<string>();
    const thirdParty = new Set<string>();
    // L'identité se lit sur toutes les pages, y compris l'accueil déjà analysé
    for (const pg of [home, ...pages.filter((x) => x !== home)]) {
      const id = pageMentions(pg.html, c);
      for (const k of Object.keys(identity) as (keyof PageIdentity)[]) identity[k] ||= id[k];
    }
    for (const pg of pages) {
      // Page listant plusieurs agences / contacts (groupe, réseau) : seuls les numéros et e-mails placés à côté
      // de la commune ou du code postal de CET établissement sont retenus. Les autres appartiennent à d'autres agences.
      // Coordonnées d'un tiers (hébergeur, webmaster, agence web, transporteur…) ou adresse sans lien avec l'entreprise : écartées
      const names = [c.name, c.tradeName];
      const pagePhones = extractPhones(pg.html).filter((ph) => !(isThirdPartyContact(ph.context, names) && thirdParty.add(ph.e164)));
      const phoneList = pagePhones.length > LIST_PAGE_THRESHOLD;
      const localPhones = new Set(phoneList ? nearestToPlace(pagePhones, c).map((p) => p.e164) : []);
      for (const ph of pagePhones) {
        if (phones.some((x) => x.e164 === ph.e164)) continue;
        if (phoneList && !localPhones.has(ph.e164)) {
          ignored.add(ph.e164);
          continue;
        }
        phones.push({ ...ph, pageUrl: pg.url, listed: phoneList, callContext: isCallContext(ph.context) });
      }
      const pageEmails = extractEmails(pg.html).filter(
        (em) => !((isThirdPartyContact(em.context, names) || !emailBelongsTo(em.email, home.url, [c.name, c.tradeName])) && thirdParty.add(em.email)),
      );
      const emailList = pageEmails.length > LIST_PAGE_THRESHOLD;
      const localEmails = new Set(emailList ? nearestToPlace(pageEmails, c).map((e) => e.email) : []);
      for (const em of pageEmails) {
        if (emails.some((x) => x.email === em.email)) continue;
        if (emailList && !localEmails.has(em.email)) {
          ignored.add(em.email);
          continue;
        }
        emails.push({ ...em, pageUrl: pg.url });
      }
      const s = extractSocialLinks(pg.html);
      socials = { facebook: socials.facebook ?? s.facebook, instagram: socials.instagram ?? s.instagram, linkedin: socials.linkedin ?? s.linkedin };
    }
    const kept = (v: string) => phones.some((x) => x.e164 === v) || emails.some((x) => x.email === v);
    for (const v of ignored) if (!kept(v)) ignoredListed++;
    const ignoredThirdParty = [...thirdParty].filter((v) => !kept(v)).length;
    const known = toE164(c.phone);
    const signals: SiteSignals = {
      ...identity,
      domainMatchesName: domainMatchesName(home.url, [c.name, c.tradeName]),
      knownPhone: !!known && phones.some((p) => p.e164 === known),
      legalPage: [home, ...pages].some((pg) => /mention|legal/i.test(pg.url)),
    };
    const match = websiteMatchScore(signals);
    return {
      url: home.url,
      verified: match.accepted,
      matchScore: match.score,
      matchReasons: match.reasons,
      identity,
      pages: pages.map((p) => p.url),
      phones,
      emails,
      socials,
      ignoredListed,
      ignoredThirdParty,
    };
  }

  /**
   * WebsiteDiscoveryEngine : teste une liste de domaines plausibles ; le premier dont le contenu correspond à
   * l'entreprise (score ≥ « probable ») est retenu. Renvoie aussi les domaines testés (traçabilité).
   */
  async discover(c: SiteCompany, domains: string[] = candidateDomains(c.name, c.tradeName), o: AnalyzeOptions = {}): Promise<SiteAnalysis | null> {
    for (const domain of domains) {
      const a = await this.analyze(`https://${domain}`, c, o).catch((e) => {
        if (e instanceof ProviderError && e.kind === 'aborted') throw e;
        return null;
      });
      if (a?.verified) return a;
    }
    return null;
  }
}
