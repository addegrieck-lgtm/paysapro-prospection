// PhoneNormalizer : normalisation, type et extraction des numéros de téléphone (France en priorité).
//
//   « 02 35 12 34 56 », « +33 2 35 12 34 56 », « 0235123456 », « +33 (0)2 35… » → « +33235123456 »
// Un numéro n'est jamais « deviné » : seules les suites de chiffres ayant la forme exacte d'un numéro
// français (ou international explicite « +XX ») sont retenues.
import type { PhoneType } from './types';

/** Format interne E.164 (« +33235123456 ») ; null si ce n'est pas un numéro exploitable. */
export function toE164(input: string | null | undefined): string | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;
  let d = raw.replace(/\(0\)/g, '').replace(/[^\d+]/g, '');
  if (d.startsWith('00')) d = `+${d.slice(2)}`;
  if (d.startsWith('+33')) {
    const rest = d.slice(3).replace(/^0/, '');
    return /^[1-9]\d{8}$/.test(rest) ? `+33${rest}` : null;
  }
  if (d.startsWith('+')) return /^\+[1-9]\d{7,14}$/.test(d) ? d : null;
  if (/^0[1-9]\d{8}$/.test(d)) return `+33${d.slice(1)}`;
  if (/^[1-9]\d{8}$/.test(d)) return `+33${d}`; // « 235123456 » (zéro perdu par Excel)
  if (/^33[1-9]\d{8}$/.test(d)) return `+${d}`;
  return null;
}

/** Numéro national lisible : « 02 35 12 34 56 » (ou l'international tel quel). */
export function displayPhone(e164: string): string {
  if (e164.startsWith('+33') && e164.length === 12) return `0${e164.slice(3)}`.replace(/(\d{2})(?=\d)/g, '$1 ');
  return e164;
}

/** Numéro national compact (« 0235123456 »), format historique du champ `phone`. */
export function nationalPhone(e164: string): string {
  return e164.startsWith('+33') ? `0${e164.slice(3)}` : e164;
}

export function phoneType(e164: string): PhoneType {
  if (!e164.startsWith('+33')) return 'unknown';
  const first = e164[3];
  if (first === '6' || first === '7') return 'mobile';
  if (first && '12345'.includes(first)) return 'landline';
  if (first === '9') return 'landline'; // box / VoIP
  return 'unknown';
}

/** Numéros spéciaux (08…) : utiles mais souvent surtaxés / plateformes. */
export function isSpecialNumber(e164: string): boolean {
  return e164.startsWith('+338');
}

export function samePhone(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = toE164(a);
  return !!x && x === toE164(b);
}

export interface ExtractedPhone {
  e164: string;
  type: PhoneType;
  /** true si le numéro est explicitement indiqué comme fax dans le texte voisin */
  fax: boolean;
  /** Numéro trouvé dans un lien « tel: » (plus fiable qu'un nombre dans le texte) */
  fromTelLink: boolean;
  /** Texte autour du numéro (≈ 150 caractères de part et d'autre) : sert à le rattacher à une agence précise */
  context: ItemContext;
}

/** Texte entourant un numéro / un e-mail ; at = position de l'élément dans ce texte */
export interface ItemContext {
  text: string;
  at: number;
}

/** « é » (texte JSON intégré au HTML) → « é » */
export function decodeJsonEscapes(s: string): string {
  return s.replace(/\\u([0-9a-f]{4})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
}

/**
 * Texte brut d'une page (sans balises ni styles ; scripts retirés sauf keepScripts). Chaque bloc (paragraphe,
 * ligne, cellule…) est séparé par un retour à la ligne : il sert à savoir à quel intitulé appartient un numéro.
 */
export function plainText(html: string, keepScripts = false): string {
  let s = decodeJsonEscapes(html).replace(/<style[\s\S]*?<\/style>/gi, ' ');
  if (!keepScripts) s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  return s
    .replace(/<\/(p|div|li|tr|td|h[1-6]|section|article|header|footer|address|ul|ol|table)>|<br\s*\/?>|<hr\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ ?\n\s*/g, '\n');
}

/** Texte autour d'un élément du HTML brut (lien tel: / mailto:). */
export function htmlContext(html: string, index: number, radius = 150): ItemContext {
  // (balise coupée en bordure d'extrait retirée)
  const before = plainText(html.slice(Math.max(0, index - radius * 4), index).replace(/<[^>]*$/, '')).slice(-radius);
  const after = plainText(html.slice(index, index + radius * 4).replace(/^[^<]*>/, '')).slice(0, radius);
  return { text: before + after, at: before.length };
}

/** Contexte d'un élément trouvé dans un texte brut */
export function textContext(text: string, index: number, radius = 150): ItemContext {
  const start = Math.max(0, index - radius);
  return { text: text.slice(start, index + radius), at: index - start };
}

// Numéros français : 0X XX XX XX XX (séparateurs espace . - ou rien), +33 X…, +33 (0)X…
const FR_PHONE = /(?<![\d+])(?:(?:\+|00)33\s?(?:\(0\)\s?)?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}(?!\d)/g;

/** Extrait les numéros d'un texte ou d'un HTML (liens tel: compris), sans doublon. */
export function extractPhones(textOrHtml: string): ExtractedPhone[] {
  const found = new Map<string, ExtractedPhone>();
  for (const m of textOrHtml.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)) {
    const e = toE164(decodeURIComponent(m[1]!));
    if (e && !found.has(e)) found.set(e, { e164: e, type: phoneType(e), fax: false, fromTelLink: true, context: htmlContext(textOrHtml, m.index ?? 0) });
  }
  const text = plainText(textOrHtml);
  for (const m of text.matchAll(FR_PHONE)) {
    const e = toE164(m[0]);
    if (!e) continue;
    const i = m.index ?? 0;
    const before = text.slice(Math.max(0, i - 25), i).toLowerCase();
    const fax = /fax|télécopie|telecopie/.test(before);
    const prev = found.get(e);
    if (prev) {
      if (fax && !prev.fromTelLink) prev.fax = true;
      continue;
    }
    found.set(e, { e164: e, type: fax ? 'fax' : phoneType(e), fax, fromTelLink: false, context: textContext(text, i) });
  }
  return Array.from(found.values());
}
