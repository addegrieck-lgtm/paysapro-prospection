// Extraction des e-mails, réseaux sociaux et liens utiles d'une page web (fonctions pures).
// Seules les valeurs RÉELLEMENT présentes dans la page sont retournées : aucun e-mail n'est construit.
import { normName, normText, stripAccents } from './normalize';
import { htmlContext, plainText, textContext, type ItemContext } from './phone';

const GENERIC_LOCAL = /^(contact|bonjour|hello|info|infos|accueil|direction|commercial|devis|secretariat|administration|admin|sav|service|paysage|jardin|entreprise|office)\b/;
const JUNK_EMAIL = /\.(png|jpe?g|gif|webp|svg)$|@(example\.|sentry|wixpress|domain\.|email\.com$|exemple\.)|^(nom|prenom|votre|your|name)@/i;

export interface ExtractedEmail {
  email: string;
  kind: 'generic' | 'nominative' | 'unknown';
  fromMailto: boolean;
  /** Texte autour de l'adresse (rattachement à une agence précise) */
  context: ItemContext;
}

export function classifyEmail(email: string): ExtractedEmail['kind'] {
  const local = email.split('@')[0] ?? '';
  if (GENERIC_LOCAL.test(local)) return 'generic';
  if (/^[a-z]+[._-][a-z]+$/.test(local)) return 'nominative';
  return 'unknown';
}

/** E-mails présents dans la page (liens mailto: et texte), dédoublonnés, déchets exclus. */
export function extractEmails(html: string): ExtractedEmail[] {
  const found = new Map<string, ExtractedEmail>();
  const add = (raw: string, fromMailto: boolean, context: ItemContext) => {
    let email: string;
    try {
      email = decodeURIComponent(raw).trim().toLowerCase().replace(/^mailto:/, '').split('?')[0]!;
    } catch {
      return;
    }
    if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email) || JUNK_EMAIL.test(email)) return;
    if (!found.has(email)) found.set(email, { email, kind: classifyEmail(email), fromMailto, context });
  };
  for (const m of html.matchAll(/href\s*=\s*["']mailto:([^"']+)["']/gi)) add(m[1]!, true, htmlContext(html, m.index ?? 0));
  // Scripts conservés : les données structurées (JSON-LD) contiennent souvent l'e-mail officiel
  const text = plainText(html, true).replace(/[^\S\n]*(\[at\]|\(at\)| arobase )[^\S\n]*/gi, '@');
  // (?<![\w.%+-]) : jamais un morceau d'adresse (« u00e9@… » issu d'un texte encodé)
  for (const m of text.matchAll(/(?<![\w.%+\\-])[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) {
    const i = m.index ?? 0;
    add(m[0], false, textContext(text, i));
  }
  return Array.from(found.values());
}

export interface SocialLinks {
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
}

/** Profils sociaux liés depuis la page (pages de partage et liens génériques exclus). */
export function extractSocialLinks(html: string): SocialLinks {
  const hrefs = Array.from(html.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)["']/gi), (m) => m[1]!);
  const pick = (re: RegExp, exclude: RegExp) => hrefs.find((h) => re.test(h) && !exclude.test(h))?.replace(/\/$/, '') ?? null;
  return {
    facebook: pick(/^https?:\/\/(www\.|m\.)?facebook\.com\/[^/?#]+/i, /sharer|share\.php|\/plugins\/|dialog|facebook\.com\/?$|\/tr\?/i),
    instagram: pick(/^https?:\/\/(www\.)?instagram\.com\/[^/?#]+/i, /\/p\/|\/explore\//i),
    linkedin: pick(/^https?:\/\/([a-z]+\.)?linkedin\.com\/(company|in)\/[^/?#]+/i, /shareArticle|share-offsite/i),
  };
}

/** Liens internes susceptibles de contenir les coordonnées (contact, mentions légales). */
export function contactPageLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const base = new URL(baseUrl);
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1]!;
    const label = stripAccents(m[2]!.replace(/<[^>]+>/g, ' ')).toLowerCase();
    const target = `${href} ${label}`.toLowerCase();
    if (!/contact|mentions|legal|a-propos|qui-sommes|coordonn|nous-trouver|devis/.test(stripAccents(target))) continue;
    try {
      const u = new URL(href, base);
      if (u.hostname.replace(/^www\./, '') !== base.hostname.replace(/^www\./, '')) continue;
      u.hash = '';
      if (!out.includes(u.toString())) out.push(u.toString());
    } catch {
      /* lien illisible */
    }
  }
  return out.slice(0, 4);
}

export interface PageIdentity {
  siren: boolean;
  siret: boolean;
  name: boolean;
  city: boolean;
  postalCode: boolean;
  /** Rue de l'adresse (sans le numéro) */
  street: boolean;
  /** Activité concordante (paysage, jardin, élagage… ou mots de l'activité déclarée) */
  activity: boolean;
}

export const EMPTY_IDENTITY: PageIdentity = { siren: false, siret: false, name: false, city: false, postalCode: false, street: false, activity: false };

const LANDSCAPE_WORDS = /paysag|jardin|espaces? verts|elag|arbori|amenagement (exterieur|paysager|de jardin)|gazon|engazonnement|haies?\b|tonte|debroussaill|arrosage|clotures?|terrasses?/;
const GENERIC_WORDS = new Set(['services', 'service', 'entreprise', 'activites', 'activite', 'travaux', 'autres', 'societe', 'commerce', 'installation']);

export type PageCompany = {
  siren: string | null;
  siret: string | null;
  name: string;
  tradeName?: string | null;
  city: string | null;
  postalCode: string | null;
  address?: string | null;
  activity?: string | null;
  nafCode?: string | null;
};

/** Rue normalisée d'une adresse (« 12 bis rue des Lilas » → « rue des lilas »), null si trop courte. */
export function streetOf(address: string | null | undefined): string | null {
  const s = normText(address).replace(/^\d+\s*(bis|ter|b)?\s*/, '').trim();
  return s.length >= 8 ? s : null;
}

/** Ce qui, dans la page, correspond à l'entreprise (vérification d'un site). */
export function pageMentions(html: string, c: PageCompany): PageIdentity {
  const text = html.replace(/<[^>]+>/g, ' ');
  const digits = text.replace(/[\s.]/g, '');
  const norm = normText(text);
  const nameOk = [c.name, c.tradeName].filter(Boolean).some((n) => {
    const nn = normName(n!);
    return nn.length >= 4 && normName(text).includes(nn);
  });
  const street = streetOf(c.address);
  const landscape = c.nafCode === '81.30Z' || /paysag|jardin|espaces verts/.test(normText(c.activity));
  const activityWords = normText(c.activity)
    .split(' ')
    .filter((w) => w.length >= 7 && !GENERIC_WORDS.has(w));
  return {
    siren: !!c.siren && digits.includes(c.siren),
    siret: !!c.siret && digits.includes(c.siret),
    name: nameOk,
    city: !!c.city && norm.includes(normText(c.city)),
    postalCode: !!c.postalCode && text.includes(c.postalCode),
    street: !!street && norm.includes(street),
    activity: landscape ? LANDSCAPE_WORDS.test(norm) : activityWords.some((w) => norm.includes(w)),
  };
}

/**
 * Contexte d'appel : « Appelez-nous », « Tél : », « Devis gratuit »… juste avant le numéro.
 * Un numéro présenté ainsi est très probablement celui de l'entreprise (+5 à la confiance).
 */
export function isCallContext(ctx: ItemContext): boolean {
  let before = ctx.text.slice(Math.max(0, ctx.at - 60), ctx.at);
  before = before.slice(before.lastIndexOf('\n') + 1);
  return /appel|t[ée]l[ée]phone|t[ée]l\b|t[ée]l\.|tel\s*:|portable|mobile|joindre|contact|devis|standard|accueil|bureau|📞|☎/i.test(before);
}

/**
 * Distance (en caractères) entre un numéro / un e-mail et la mention la plus proche de la commune ou du code
 * postal de l'établissement dans le texte voisin ; Infinity si aucune mention.
 */
export function placeDistance(ctx: ItemContext, c: { city: string | null; postalCode: string | null }): number {
  // Normalisation qui conserve (presque) les positions : minuscules, accents retirés, ponctuation → espace
  const flat = (s: string) => stripAccents(s).toLowerCase().replace(/[^a-z0-9]/g, ' ');
  const text = flat(ctx.text);
  const needles = [c.postalCode, c.city ? flat(c.city).replace(/\s+/g, ' ').trim() : null].filter((n): n is string => !!n && n.length >= 3);
  let best = Infinity;
  for (const n of needles) {
    for (let i = text.indexOf(n); i >= 0; i = text.indexOf(n, i + 1)) {
      const d = i + n.length <= ctx.at ? ctx.at - (i + n.length) : Math.max(0, i - ctx.at);
      best = Math.min(best, d);
    }
  }
  return best;
}

/**
 * Page listant plusieurs agences : ne garde que les éléments les PLUS PROCHES d'une mention de la commune / du
 * code postal de l'établissement (les autres appartiennent à d'autres agences).
 */
export function nearestToPlace<T extends { context: ItemContext }>(items: T[], c: { city: string | null; postalCode: string | null }, maxDistance = 250): T[] {
  const d = items.map((it) => placeDistance(it.context, c));
  const min = Math.min(...d);
  if (!Number.isFinite(min) || min > maxDistance) return [];
  return items.filter((_, i) => d[i]! <= min + 20);
}

// Mentions légales : hébergeur, webmaster, agence… Leurs coordonnées ne sont pas celles de l'entreprise.
const THIRD_PARTY = /h[ée]berg|webmaster|transporteur|fournisseur|revendeur|distributeur|partenaire|urgence|samu|pompiers|gendarmerie|mairie|r[ée]alis[ée]e? par|r[ée]alisation|conception|concepteur|cr[ée]ation (du|de ce) site|cr[ée]{1,2}e? par|d[ée]velopp[ée]e? par|agence (web|digitale|de communication)|prestataire|hosting|host(ed)? by|designed by|powered by/i;
// Intitulés désignant l'entreprise elle-même (éditeur du site, siège…)
const OWN = /[ée]diteur|propri[ée]taire|directeur de (la )?publication|responsable de (la )?publication|si[èe]ge|raison sociale|siren|siret|nous contacter|contactez-nous/i;

/**
 * Le numéro / l'e-mail est-il présenté comme celui d'un tiers (hébergeur, webmaster, agence web…) ?
 * Dans le même bloc de texte, c'est le DERNIER intitulé qui précède la coordonnée qui compte :
 * « Hébergeur : O2 Switch – Tél : 04… » → tiers ; « Hébergeur : OVH. Éditeur : Jardins X – Tél : 05… » → entreprise.
 */
export function isThirdPartyContact(ctx: ItemContext, names: (string | null | undefined)[] = []): boolean {
  // Le bloc de la coordonnée : sa ligne et jusqu'à 3 lignes au-dessus (nom, adresse de l'hébergeur…), sans jamais
  // remonter au-delà d'une autre coordonnée (elle appartient à un autre intitulé)
  const lines = ctx.text.slice(Math.max(0, ctx.at - 240), ctx.at).split('\n');
  const kept = [lines.pop() ?? ''];
  while (lines.length && kept.length < 4) {
    const l = lines.pop()!;
    if (ITEM_IN_TEXT.test(l)) break;
    kept.unshift(l);
  }
  const before = kept.join('\n');
  const last = (re: RegExp) => Math.max(-1, ...Array.from(before.matchAll(new RegExp(re.source, 'gi')), (m) => m.index ?? 0));
  const third = last(THIRD_PARTY);
  if (third < 0 || third < last(OWN)) return false;
  // Le nom de l'entreprise APRÈS l'intitulé du tiers : c'est à nouveau l'entreprise (« Hébergeur : OVH \n Jardins X – Tél »)
  const after = normName(before.slice(third));
  return !names.some((n) => {
    const nn = normName(n ?? '');
    return nn.length >= 4 && after.includes(nn);
  });
}

// Une autre coordonnée (numéro ou e-mail) dans une ligne : limite du bloc
const ITEM_IN_TEXT = /(?:(?:\+|00)33\s?(?:\(0\)\s?)?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

const WEBMAIL = /@(gmail|googlemail|hotmail|outlook|live|msn|yahoo|ymail|icloud|me|orange|wanadoo|free|sfr|neuf|laposte|bbox|numericable|aol|gmx|protonmail|proton)\.[a-z.]+$/i;

/**
 * Un e-mail trouvé sur le site appartient-il plausiblement à l'entreprise ? Oui s'il utilise le domaine du site,
 * une messagerie grand public (gmail, orange…) ou un domaine contenant son nom. Sinon (adresse d'un thème,
 * d'un fournisseur, d'un partenaire…), il est écarté.
 */
export function emailBelongsTo(email: string, siteUrl: string, names: (string | null | undefined)[]): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  const site = domainOf(siteUrl);
  if (site && (domain === site || domain.endsWith(`.${site}`) || site.endsWith(`.${domain}`))) return true;
  if (WEBMAIL.test(email)) return true;
  const flatDomain = domain.replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]/g, ''); // extension (.fr, .com) exclue
  return names.some((n) => {
    const tokens = normName(n ?? '').split(' ').filter((t) => t.length >= 4);
    return tokens.some((t) => flatDomain.includes(t));
  });
}

/** Au-delà de ce nombre de numéros (ou d'e-mails) sur une page, c'est une liste d'agences / de contacts. */
export const LIST_PAGE_THRESHOLD = 3;

/** Domaine normalisé (« https://www.jardins-val.fr/contact » → « jardins-val.fr »). */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/** Domaines plausibles construits à partir du nom (VÉRIFIÉS ensuite par le contenu de la page, jamais utilisés tels quels). */
const STOP_WORDS = ['de', 'du', 'des', 'la', 'le', 'les', 'et', 'l', 'd'];

function nameWords(n: string | null | undefined): string[] {
  return normName(n ?? '')
    .split(' ')
    .filter((w) => w.length > 1 && !STOP_WORDS.includes(w));
}

/** Variantes « mot-mot » et « motmot » en .fr et .com (jamais une adresse inventée : chaque domaine est ensuite VÉRIFIÉ). */
function variants(words: string[], tlds = ['fr', 'com']): string[] {
  if (!words.length || words.join('').length < 5) return [];
  const out: string[] = [];
  for (const tld of tlds) for (const d of [`${words.join('-')}.${tld}`, `${words.join('')}.${tld}`]) if (!out.includes(d)) out.push(d);
  return out;
}

/**
 * Domaines plausibles par stratégie (« domain_name », « domain_trade », « domain_name_city », « domain_activity »).
 * Ce ne sont que des PISTES : un domaine n'est retenu que si le contenu du site correspond à l'entreprise.
 */
export function domainCandidates(kind: 'name' | 'trade' | 'name_city' | 'activity', c: { name: string; tradeName?: string | null; city?: string | null }): string[] {
  const base = nameWords(c.tradeName || c.name);
  if (kind === 'name') return variants(nameWords(c.name)).slice(0, 4);
  if (kind === 'trade') return c.tradeName ? variants(nameWords(c.tradeName)).slice(0, 4) : [];
  if (kind === 'name_city') {
    const city = nameWords(c.city);
    return city.length ? variants([...base, ...city], ['fr']).slice(0, 2) : [];
  }
  // Activité (paysage) : « martin-paysage.fr », « jardins-martin.fr »…
  if (!base.length || base.some((w) => /paysag|jardin/.test(w))) return [];
  const joined = base.join('-');
  return [`${joined}-paysage.fr`, `${joined}-paysagiste.fr`, `jardins-${joined}.fr`, `${joined}-espaces-verts.fr`];
}

export function candidateDomains(name: string, tradeName?: string | null): string[] {
  const out: string[] = [];
  for (const n of [tradeName, name].filter(Boolean) as string[]) {
    const words = normName(n).split(' ').filter((w) => w.length > 1 && !['de', 'du', 'des', 'la', 'le', 'les', 'et'].includes(w));
    if (!words.length || words.join('').length < 5) continue;
    const joined = words.join('');
    const dashed = words.join('-');
    for (const d of [`${dashed}.fr`, `${joined}.fr`, `${dashed}.com`, `${joined}.com`]) if (!out.includes(d)) out.push(d);
  }
  return out.slice(0, 6);
}
