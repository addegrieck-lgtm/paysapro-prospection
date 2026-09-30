// « Coller une fiche Google » : l'utilisateur copie LUI-MÊME le bloc d'une fiche Google (Maps ou recherche) et le
// colle dans la fiche prospect. L'application ne lit jamais Google : elle analyse uniquement le texte collé.
//
// Extraction : téléphones, site, e-mails, réseaux sociaux, lien Google Maps, note et nombre d'avis.
// Vérification : la fiche collée correspond-elle à l'entreprise (code postal, commune, nom) ? Un autre code postal
// signale probablement un homonyme : l'utilisateur est prévenu avant d'enregistrer.
import { extractPhones } from './phone';
import { extractEmails } from './webContacts';
import { normName, normText } from './normalize';

export interface GoogleCard {
  phones: { e164: string; mobile: boolean }[];
  websites: string[];
  emails: string[];
  facebook: string | null;
  instagram: string | null;
  googleUrl: string | null;
  rating: number | null;
  reviews: number | null;
}

export interface CardMatch {
  /** Le texte collé mentionne le code postal / la commune / le nom de l'entreprise */
  postalCode: boolean;
  city: boolean;
  name: boolean;
  /** Codes postaux présents dans le texte mais différents de celui de l'entreprise (homonyme probable) */
  otherPostalCodes: string[];
  verdict: 'match' | 'uncertain' | 'mismatch';
}

const SOCIAL_OR_GOOGLE = /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page|gstatic\.com|googleusercontent\.com|facebook\.com|fb\.com|instagram\.com|linkedin\.com|youtube\.com|tiktok\.com|x\.com|twitter\.com|pagesjaunes\.fr|waze\.com)$/i;
const TLD = '(?:fr|com|net|org|eu|pro|bzh|paris|site|info|biz|shop|online|io|co)';

export function parseGoogleCard(text: string): GoogleCard {
  const t = text.replace(/\u00a0|\u202f/g, ' ');
  const emails = extractEmails(t).map((e) => e.email);
  const emailDomains = new Set(emails.map((e) => e.split('@')[1]));
  const links = Array.from(t.matchAll(/https?:\/\/[^\s<>"')]+/gi), (m) => m[0].replace(/[.,;]+$/, ''));
  const hostOf = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  };
  const googleUrl = links.find((u) => /^(maps\.app\.goo\.gl|goo\.gl|g\.page)$|(^|\.)google\.[a-z.]+$/.test(hostOf(u) ?? '') && /maps|goo\.gl|g\.page/.test(u)) ?? null;
  const facebook = links.find((u) => /(^|\.)(facebook|fb)\.com$/.test(hostOf(u) ?? '')) ?? null;
  const instagram = links.find((u) => /(^|\.)instagram\.com$/.test(hostOf(u) ?? '')) ?? null;
  // Site : lien complet, ou domaine seul tel qu'affiché par Google (« clementpaysage76.fr »)
  const bare = Array.from(t.matchAll(new RegExp(`(?<![@\\w.-])((?:[a-z0-9-]+\\.)+${TLD})(?![\\w.-]*@)(?:\\/[^\\s]*)?\\b`, 'gi')), (m) => m[1]!.toLowerCase());
  const websites: string[] = [];
  for (const d of [...links.map(hostOf), ...bare]) {
    if (!d || SOCIAL_OR_GOOGLE.test(d) || emailDomains.has(d)) continue;
    const host = d.replace(/^www\./, '');
    if (!websites.includes(host)) websites.push(host);
  }
  // Note et avis : « 4,9 (27) », « 4,9 ★★★★★ 27 avis », « 4.9 · 27 avis »
  const r = t.match(/(?<![\d,.])([1-5][,.]\d)\s*(?:[★☆]+\s*)?(?:\(\s*(\d[\d ]*)\s*\)|[·•-]?\s*(\d[\d ]*)\s*avis)/i);
  return {
    phones: extractPhones(t)
      .filter((p) => !p.fax)
      .map((p) => ({ e164: p.e164, mobile: p.type === 'mobile' })),
    websites,
    emails,
    facebook,
    instagram,
    googleUrl,
    rating: r ? Number(r[1]!.replace(',', '.')) : null,
    reviews: r ? Number((r[2] ?? r[3] ?? '').replace(/\s/g, '')) || null : null,
  };
}

/** La fiche collée correspond-elle à l'entreprise ? (garde-fou contre les homonymes) */
export function matchCard(text: string, c: { name: string; tradeName?: string | null; postalCode: string | null; city: string | null }): CardMatch {
  const codes = [...new Set(Array.from(text.matchAll(/(?<!\d)(\d{5})(?!\d)/g), (m) => m[1]!))];
  const postalCode = !!c.postalCode && codes.includes(c.postalCode);
  const city = !!c.city && normText(text).includes(normText(c.city));
  const flat = normName(text);
  const name = [c.name, c.tradeName].some((n) => {
    const nn = normName(n ?? '');
    return nn.length >= 4 && flat.includes(nn);
  });
  const otherPostalCodes = codes.filter((x) => x !== c.postalCode);
  const verdict: CardMatch['verdict'] = otherPostalCodes.length && !postalCode ? 'mismatch' : (postalCode || city) && name ? 'match' : 'uncertain';
  return { postalCode, city, name, otherPostalCodes, verdict };
}
