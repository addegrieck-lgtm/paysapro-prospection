/**
 * Mesure d'audience interne, sans cookie ni service tiers : classement de la provenance des visites, type d'appareil,
 * filtrage des robots. Fonctions pures (testées dans tests/domain.test.ts).
 */

export type Medium = 'direct' | 'recherche' | 'reseaux' | 'site' | 'campagne' | 'publicite';

export const MEDIUM_LABELS: Record<Medium, string> = {
  direct: 'Accès direct',
  recherche: 'Moteur de recherche',
  reseaux: 'Réseau social',
  site: 'Autre site',
  campagne: 'Campagne (lien suivi)',
  publicite: 'Publicité',
};

// Hôte (sans « www. ») → nom affiché. Recherche par suffixe : « google.fr » et « news.google.com » → Google.
const SEARCH: [RegExp, string][] = [
  [/(^|\.)google\.[a-z.]+$/, 'Google'],
  [/(^|\.)bing\.com$/, 'Bing'],
  [/(^|\.)duckduckgo\.com$/, 'DuckDuckGo'],
  [/(^|\.)qwant\.com$/, 'Qwant'],
  [/(^|\.)ecosia\.org$/, 'Ecosia'],
  [/(^|\.)yahoo\.[a-z.]+$/, 'Yahoo'],
  [/(^|\.)yandex\.[a-z.]+$/, 'Yandex'],
  [/(^|\.)startpage\.com$/, 'Startpage'],
  [/(^|\.)lilo\.org$/, 'Lilo'],
  [/(^|\.)brave\.com$/, 'Brave Search'],
  [/(^|\.)(chatgpt\.com|openai\.com)$/, 'ChatGPT'],
  [/(^|\.)perplexity\.ai$/, 'Perplexity'],
];
const SOCIAL: [RegExp, string][] = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, 'Facebook'],
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'LinkedIn'],
  [/(^|\.)(t\.co|twitter\.com|x\.com)$/, 'X (Twitter)'],
  [/(^|\.)(pinterest\.[a-z.]+|pin\.it)$/, 'Pinterest'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'YouTube'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)whatsapp\.com$/, 'WhatsApp'],
  [/(^|\.)snapchat\.com$/, 'Snapchat'],
];

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};

const clean = (v: string | null | undefined, max = 60) => (v ?? '').trim().slice(0, max);

export interface Origin {
  medium: Medium;
  source: string;
  campaign: string;
  /** Hôte du site d'origine (sans chemin ni paramètres), vide si accès direct ou interne. */
  referrer: string;
  /** false : navigation à l'intérieur du site (page vue sans nouvelle visite). */
  entry: boolean;
}

/**
 * Provenance d'une page vue. ownHosts : hôtes du site (requête, domaine principal) — un lien venant de l'un d'eux est une
 * navigation interne. Les paramètres utm_* priment (liens suivis : fiche Google, flyers avec QR code, e-mails…).
 */
export function classifyOrigin(referer: string | undefined, query: URLSearchParams, ownHosts: string[]): Origin {
  const own = new Set(ownHosts.map((h) => h.toLowerCase().replace(/^www\./, '')));
  const refHost = referer ? hostOf(referer) : '';
  const internal = !!refHost && own.has(refHost);
  const utmSource = clean(query.get('utm_source'));
  const campaign = clean(query.get('utm_campaign'));
  if (utmSource) {
    const paid = /^(cpc|ppc|paid|ads?|display)$/i.test(clean(query.get('utm_medium')));
    return { medium: paid ? 'publicite' : 'campagne', source: utmSource.toLowerCase(), campaign, referrer: internal ? '' : refHost, entry: !internal };
  }
  if (internal) return { medium: 'direct', source: '', campaign: '', referrer: '', entry: false };
  if (query.has('gclid') || query.has('gbraid') || query.has('wbraid')) return { medium: 'publicite', source: 'Google Ads', campaign, referrer: refHost, entry: true };
  if (query.has('msclkid')) return { medium: 'publicite', source: 'Microsoft Ads', campaign, referrer: refHost, entry: true };
  if (!refHost) return { medium: 'direct', source: 'Accès direct', campaign: '', referrer: '', entry: true };
  const search = SEARCH.find(([re]) => re.test(refHost));
  if (search) return { medium: 'recherche', source: search[1], campaign: '', referrer: refHost, entry: true };
  const social = SOCIAL.find(([re]) => re.test(refHost));
  if (social) return { medium: 'reseaux', source: social[1], campaign: '', referrer: refHost, entry: true };
  return { medium: 'site', source: refHost.slice(0, 60), campaign: '', referrer: refHost.slice(0, 60), entry: true };
}

export type Device = 'mobile' | 'tablette' | 'ordinateur';
export const DEVICE_LABELS: Record<Device, string> = { mobile: 'Téléphone', tablette: 'Tablette', ordinateur: 'Ordinateur' };

export function deviceOf(ua: string): Device {
  if (/iPad|Tablet|PlayBook|Silk|Kindle|Android(?!.*Mobile)/i.test(ua)) return 'tablette';
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(ua)) return 'mobile';
  return 'ordinateur';
}

/** Robots, aperçus de liens et outils automatiques : jamais comptés. */
export function isBot(ua: string): boolean {
  if (!ua || ua.length < 20) return true;
  return /bot|crawl|spider|slurp|scrap|fetch|preview|facebookexternalhit|embedly|headless|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|curl|wget|python|java\/|go-http|okhttp|axios|node-fetch|httpclient|libwww|playwright|puppeteer|phantom|selenium/i.test(ua);
}

/**
 * Réseaux d'hébergement (centres de données), par numéro de réseau (ASN, fourni gratuitement par Cloudflare) :
 * une page demandée depuis l'un d'eux vient d'un serveur (robot déguisé en navigateur, scanner, outil SEO, IA),
 * pas d'une personne. Les réseaux par lesquels passent de vrais internautes (Cloudflare et Akamai pour le relais
 * privé d'Apple, fournisseurs de VPN grand public) ne sont volontairement PAS dans la liste.
 */
export const HOSTING_ASNS: ReadonlySet<number> = new Set([
  16509, 14618, 8987, // Amazon (AWS)
  15169, 396982, 19527, // Google, Google Cloud
  8075, 8068, // Microsoft (Azure)
  31898, // Oracle Cloud
  14061, // DigitalOcean
  16276, // OVH (hébergement)
  24940, 213230, // Hetzner
  63949, // Linode (Akamai Connected Cloud)
  20473, // Vultr
  51167, // Contabo
  12876, // Scaleway
  45102, 37963, // Alibaba Cloud
  132203, 45090, // Tencent Cloud
  60781, 16265, 28753, // Leaseweb
  47583, // Hostinger
  8560, // IONOS
  40676, // Psychz
  36352, // ColoCrossing
  62567, // DigitalOcean (ancien)
  135377, // UCloud
  212238, // Datacamp
  202425, // IP Volume
]);

export function isHostingNetwork(asn: number | null | undefined): boolean {
  return typeof asn === 'number' && HOSTING_ASNS.has(asn);
}

/** Pages mesurées : pages publiques uniquement (ni administration, ni espace client, ni API, ni fichiers techniques). */
export function isTrackedPath(path: string): boolean {
  return !/^\/(admin|client|api|assets)(\/|$)/.test(path) && !/\.(xml|txt|ico|svg|png|jpe?g|webp|js|css|map|json|woff2?)$/i.test(path);
}

/** Durée de conservation des mesures détaillées (recommandation CNIL : 25 mois maximum ; ici 13 mois). */
export const ANALYTICS_RETENTION_DAYS = 395;
