// Normalisation des données saisies ou importées (comparaison, déduplication, affichage).

export function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const LEGAL_FORMS = /\b(sarl|sas|sasu|eurl|sa|sci|snc|ei|eirl|scop|earl|gaec|ets|etablissements?|entreprise|societe|ste)\b/g;

/** Nom comparable : minuscules, sans accents, sans forme juridique ni ponctuation. */
export function normName(s: string | null | undefined): string {
  return stripAccents(s ?? '')
    .toLowerCase()
    .replace(/&/g, ' et ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(LEGAL_FORMS, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normText(s: string | null | undefined): string {
  return stripAccents(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Téléphone français au format « 0612345678 » ; null si ce n'est pas un numéro exploitable. */
export function normPhone(s: string | null | undefined): string | null {
  let d = (s ?? '').replace(/[^\d+]/g, '');
  if (!d) return null;
  if (d.startsWith('+330')) d = `0${d.slice(4)}`; // « +33 (0)2 35… »
  else if (d.startsWith('+33')) d = `0${d.slice(3)}`;
  else if (d.startsWith('0033')) d = `0${d.slice(4)}`;
  else if (d.startsWith('33') && d.length === 11) d = `0${d.slice(2)}`;
  d = d.replace(/\+/g, '');
  if (d.length === 9 && !d.startsWith('0')) d = `0${d}`;
  return /^0\d{9}$/.test(d) ? d : null;
}

/** « 0612345678 » → « 06 12 34 56 78 » */
export function formatPhone(s: string | null | undefined): string {
  const n = normPhone(s);
  return n ? n.replace(/(\d{2})(?=\d)/g, '$1 ') : (s ?? '');
}

export function normEmail(s: string | null | undefined): string | null {
  const e = (s ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : null;
}

export function normUrl(s: string | null | undefined): string | null {
  const u = (s ?? '').trim();
  if (!u || /^non\b|^n\/?a$|^-$/i.test(u)) return null;
  const withProto = /^https?:\/\//i.test(u) ? u : `https://${u}`;
  try {
    const url = new URL(withProto);
    return url.hostname.includes('.') ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

export function normSiren(s: string | null | undefined): string | null {
  const d = (s ?? '').replace(/\D/g, '');
  return d.length === 9 ? d : null;
}

export function normSiret(s: string | null | undefined): string | null {
  const d = (s ?? '').replace(/\D/g, '');
  return d.length === 14 ? d : null;
}

export function normPostalCode(s: string | null | undefined): string | null {
  const d = (s ?? '').replace(/\s/g, '');
  if (/^\d{5}$/.test(d)) return d;
  if (/^\d{4}$/.test(d)) return `0${d}`; // Excel supprime le zéro initial (« 1000 » → « 01000 »)
  return null;
}

/** Nombre tolérant (« 4,7 », « 87 avis ») ; null si absent. */
export function normNumber(s: string | number | null | undefined): number | null {
  if (typeof s === 'number') return Number.isFinite(s) ? s : null;
  const m = /-?\d+(?:[.,]\d+)?/.exec((s ?? '').replace(/\s/g, ''));
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Chaîne nettoyée ou null (jamais de chaîne vide stockée). */
export function clean(s: string | null | undefined): string | null {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  return t ? t : null;
}

/** Date AAAA-MM-JJ à partir de « 2015-03-01 », « 01/03/2015 » ; null sinon. */
export function normDate(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return null;
}

/** Titre lisible à partir d'un nom SIRENE en majuscules (« JARDINS DE L'EURE » → « Jardins de l'Eure »). */
export function titleCase(s: string | null | undefined): string {
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'en', 'au', 'aux', 'sur', 'sous', 'à', 'l', 'd']);
  const t = (s ?? '').trim();
  if (!t || t !== t.toUpperCase()) return t;
  return t
    .toLowerCase()
    .split(/(\s+|-|')/)
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join('')
    .replace(/\b(Sarl|Sas|Sasu|Eurl|Sci|Earl)\b/g, (x) => x.toUpperCase());
}
