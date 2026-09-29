// WebsiteProvider / WebsiteDiscoveryEngine : coordonnées publiées par l'entreprise sur SON site.
//
// Le navigateur ne peut pas lire directement un autre site (sécurité CORS) : ce fournisseur passe par un
// petit relais GRATUIT que vous déployez (Cloudflare Worker, voir worker/README.md). Sans relais configuré
// (VITE_WEB_PROXY_URL vide), il est simplement désactivé et le reste fonctionne.
//
// Règles du relais : lecture de pages HTML publiques uniquement, robots.txt respecté, 1 requête/s,
// annuaires, moteurs de recherche et réseaux sociaux refusés (leurs conditions l'interdisent).
//
// Recherche du site officiel (si aucun site connu) : quelques domaines plausibles construits à partir du nom
// (« jardins-du-val.fr »…) sont testés ; un domaine n'est retenu QUE si la page mentionne le SIREN / SIRET
// de l'entreprise, ou son nom ET sa commune / son code postal. Rien n'est jamais supposé.
import type { KeyValueCache } from '../../data/cache';
import type { Prospect } from '../../domain/types';
import { fetchJson, ProviderError, RateLimiter, type FetchLike } from '../http';
import { candidateDomains, contactPageLinks, extractEmails, extractSocialLinks, emailBelongsTo, isThirdPartyContact, LIST_PAGE_THRESHOLD, nearestToPlace, pageMentions, type ExtractedEmail, type PageIdentity, type SocialLinks } from '../../domain/webContacts';
import { extractPhones, type ExtractedPhone } from '../../domain/phone';

export interface ProxyPage {
  ok: boolean;
  status: number;
  url: string;
  html: string;
  error?: string;
}

export interface SiteAnalysis {
  url: string;
  verified: boolean;
  identity: PageIdentity;
  pages: string[];
  /** listed : numéro tiré d'une page listant plusieurs agences (rattaché par la commune / le code postal voisin) */
  phones: (ExtractedPhone & { pageUrl: string; listed: boolean })[];
  emails: (ExtractedEmail & { pageUrl: string })[];
  socials: SocialLinks;
  /** Numéros / e-mails écartés : listés pour d'autres agences sur une page de plusieurs contacts */
  ignoredListed: number;
  /** Coordonnées de tiers écartées (hébergeur, webmaster, agence web, adresse d'un thème…) */
  ignoredThirdParty: number;
}

type Company = Pick<Prospect, 'name' | 'tradeName' | 'siren' | 'siret' | 'city' | 'postalCode'>;

export function isVerifiedSite(id: PageIdentity): boolean {
  return id.siren || id.siret || (id.name && (id.city || id.postalCode));
}

export class WebsiteProvider {
  readonly id = 'website';
  readonly label = 'Site officiel de l’entreprise (via votre relais gratuit)';
  readonly free = true;
  readonly enabled: boolean;
  private proxyUrl: string;
  private o: { fetchImpl?: FetchLike; cache?: KeyValueCache | null; cacheDays?: number; limiter?: RateLimiter };
  private limiter: RateLimiter;

  constructor(proxyUrl: string, o: { fetchImpl?: FetchLike; cache?: KeyValueCache | null; cacheDays?: number; limiter?: RateLimiter } = {}) {
    this.proxyUrl = proxyUrl.replace(/\/$/, '');
    this.enabled = !!this.proxyUrl;
    this.o = o;
    this.limiter = o.limiter ?? new RateLimiter(1);
  }

  /** Lecture d'une page via le relais (cache 30 jours). null si la page n'existe pas / n'est pas lisible. */
  async fetchPage(url: string, signal?: AbortSignal): Promise<ProxyPage | null> {
    if (!this.enabled) throw new ProviderError('invalid', 'Relais web non configuré');
    const key = `page:${url}`;
    const cached = this.o.cache ? ((await this.o.cache.get(key, this.o.cacheDays ?? 30)) as ProxyPage | undefined) : undefined;
    if (cached) return cached.ok ? cached : null;
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

  /** Analyse l'accueil + jusqu'à 3 pages contact / mentions légales. */
  async analyze(siteUrl: string, c: Company, signal?: AbortSignal): Promise<SiteAnalysis | null> {
    const home = await this.fetchPage(siteUrl, signal);
    if (!home) return null;
    const pages = [home];
    const same = (x: string) => x.replace(/[#?].*$/, '').replace(/\/$/, '');
    for (const link of contactPageLinks(home.html, home.url).filter((l) => same(l) !== same(home.url) && same(l) !== same(siteUrl)).slice(0, 3)) {
      const pg = await this.fetchPage(link, signal).catch(() => null);
      if (pg) pages.push(pg);
    }
    const identity: PageIdentity = { siren: false, siret: false, name: false, city: false, postalCode: false };
    const phones: SiteAnalysis['phones'] = [];
    const emails: SiteAnalysis['emails'] = [];
    let socials: SocialLinks = { facebook: null, instagram: null, linkedin: null };
    let ignoredListed = 0;
    const ignored = new Set<string>();
    const thirdParty = new Set<string>();
    for (const pg of pages) {
      const id = pageMentions(pg.html, c);
      for (const k of Object.keys(identity) as (keyof PageIdentity)[]) identity[k] ||= id[k];
      // Page listant plusieurs agences / contacts (groupe, réseau) : seuls les numéros et e-mails placés à côté
      // de la commune ou du code postal de CET établissement sont retenus. Les autres appartiennent à d'autres agences.
      // Coordonnées d'un tiers (hébergeur, webmaster, agence web…) ou adresse sans lien avec l'entreprise : écartées
      const pagePhones = extractPhones(pg.html).filter((ph) => !(isThirdPartyContact(ph.context) && thirdParty.add(ph.e164)));
      const phoneList = pagePhones.length > LIST_PAGE_THRESHOLD;
      const localPhones = new Set(phoneList ? nearestToPlace(pagePhones, c).map((p) => p.e164) : []);
      for (const ph of pagePhones) {
        if (phones.some((x) => x.e164 === ph.e164)) continue;
        if (phoneList && !localPhones.has(ph.e164)) {
          ignored.add(ph.e164);
          continue;
        }
        phones.push({ ...ph, pageUrl: pg.url, listed: phoneList });
      }
      const pageEmails = extractEmails(pg.html).filter(
        (em) => !((isThirdPartyContact(em.context) || !emailBelongsTo(em.email, home.url, [c.name, c.tradeName])) && thirdParty.add(em.email)),
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
    return { url: home.url, verified: isVerifiedSite(identity), identity, pages: pages.map((p) => p.url), phones, emails, socials, ignoredListed, ignoredThirdParty };
  }

  /** Recherche du site officiel par domaines plausibles, validés par le contenu (jamais supposés). */
  async discover(c: Company, signal?: AbortSignal): Promise<SiteAnalysis | null> {
    for (const domain of candidateDomains(c.name, c.tradeName)) {
      const a = await this.analyze(`https://${domain}`, c, signal).catch((e) => {
        if (e instanceof ProviderError && e.kind === 'aborted') throw e;
        return null;
      });
      if (a?.verified) return a;
    }
    return null;
  }
}
