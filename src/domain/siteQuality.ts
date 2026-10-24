// Diagnostic d'un site d'entreprise : est-il à moderniser ? (critère « site faible » de l'agence Signe & Seine)
//
// Uniquement des signaux CONSTATÉS sur la page d'accueil lue par le relais, jamais une appréciation :
//   • pas de HTTPS (l'adresse finale reste en http://) ;
//   • pas adapté au téléphone (aucune balise <meta name="viewport">) ;
//   • mention de copyright ancienne (« © 2016 » : année la plus récente citée, 4 ans ou plus) ;
//   • technologie dépassée (Flash, balises <font>, mise en page en cadres) ;
//   • site gratuit sans nom de domaine propre (monsite.wixsite.com, *.e-monsite.com, *.jimdofree.com…).
// Le constructeur de site (Wix, Jimdo, WordPress…) est relevé pour information : ce n'est pas un défaut en soi.
import type { SiteQuality } from './types';

/** Sous-domaines d'hébergeurs gratuits : le site n'a pas son propre nom de domaine. */
const FREE_HOST = /\.(wixsite\.com|e-monsite\.com|jimdofree\.com|jimdosite\.com|webnode\.(fr|com)|site123\.me|wordpress\.com|blogspot\.com|over-blog\.com|free\.fr|business\.site|godaddysites\.com|weebly\.com|simplesite\.com|strikingly\.com|my\.canva\.site|carrd\.co)$/i;

const BUILDERS: [RegExp, string][] = [
  [/wix\.com|wixstatic\.com|_wixCIDX|X-Wix/i, 'Wix'],
  [/jimdo/i, 'Jimdo'],
  [/e-monsite/i, 'e-monsite'],
  [/webnode/i, 'Webnode'],
  [/site123/i, 'SITE123'],
  [/squarespace/i, 'Squarespace'],
  [/shopify/i, 'Shopify'],
  [/wp-content|wp-includes|name=["']generator["'][^>]*WordPress/i, 'WordPress'],
  [/name=["']generator["'][^>]*Joomla/i, 'Joomla'],
  [/weebly/i, 'Weebly'],
  [/godaddy/i, 'GoDaddy'],
];

/** Année de copyright la plus récente mentionnée (« © 2014 », « Copyright 2012-2019 », « &copy; 2018 »). */
export function copyrightYear(html: string, now = new Date()): number | null {
  const text = html.replace(/&copy;|&#169;|&#xa9;/gi, '©');
  const years: number[] = [];
  for (const m of text.matchAll(/(?:©|copyright)[^0-9<]{0,40}((?:19|20)\d{2})(?:\s*[-–/à]\s*((?:19|20)\d{2}))?/gi)) {
    years.push(Number(m[1]));
    if (m[2]) years.push(Number(m[2]));
  }
  const valid = years.filter((y) => y >= 1995 && y <= now.getFullYear());
  return valid.length ? Math.max(...valid) : null;
}

export function assessSite(html: string, finalUrl: string, now = new Date()): SiteQuality {
  let host = '';
  let https = false;
  try {
    const u = new URL(finalUrl);
    host = u.hostname.toLowerCase();
    https = u.protocol === 'https:';
  } catch {
    /* adresse illisible : signaux de page uniquement */
  }
  const mobile = /<meta[^>]+name\s*=\s*["']viewport["']/i.test(html);
  const year = copyrightYear(html, now);
  const builder = BUILDERS.find(([re]) => re.test(html) || re.test(host))?.[1] ?? null;
  const freeHost = FREE_HOST.test(host);
  const oldTech = /\.swf\b|<embed[^>]+flash|<font\b|<frameset\b/i.test(html);
  const reasons: string[] = [];
  if (!https) reasons.push('pas de HTTPS');
  if (!mobile) reasons.push('pas adapté au téléphone');
  if (year !== null && now.getFullYear() - year >= 4) reasons.push(`copyright ${year}`);
  if (oldTech) reasons.push('technologie dépassée');
  if (freeHost) reasons.push('site gratuit sans nom de domaine propre');
  return { checkedAt: now.toISOString(), https, mobile, copyrightYear: year, builder, freeHost, reasons, weak: reasons.length > 0 };
}
