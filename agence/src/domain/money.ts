/** Montants manipulés en CENTIMES (entiers) pour éviter toute erreur d'arrondi flottant. */

const fmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const fmtRound = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });

/** 69000 → « 690,00 € » ; sans décimales si `round` et montant entier. Espaces insécables normalisés. */
export function formatEuros(cents: number, round = false): string {
  const s = round && cents % 100 === 0 ? fmtRound.format(cents / 100) : fmt.format(cents / 100);
  return s.replace(/ /g, ' ');
}

/** « 1 190,50 », « 1190.5 », « 69 € » → centimes. Retourne null si vide ou invalide. */
export function parseEuros(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input).replace(/[€\s  ]/g, '').replace(/HT|TTC/gi, '').replace(',', '.');
  if (!s) return null;
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

/** Centimes → valeur pour un champ de formulaire (« 690,00 »). */
export function centsToInput(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/** TVA d'un montant HT, arrondie au centime (arrondi commercial). */
export function vatOf(htCents: number, ratePercent: number): number {
  return Math.round((htCents * ratePercent) / 100);
}

export function ttcOf(htCents: number, ratePercent: number): number {
  return htCents + vatOf(htCents, ratePercent);
}

export interface LineLike {
  quantity: number;
  unit_price_ht: number;
  vat_rate: number;
}

export interface Totals {
  ht: number;
  vat: number;
  ttc: number;
  /** Détail par taux de TVA (base HT et TVA), comme l'exige une facture multi-taux. */
  byRate: { rate: number; base: number; vat: number }[];
}

export function lineTotal(l: Pick<LineLike, 'quantity' | 'unit_price_ht'>): number {
  return Math.round(l.quantity * l.unit_price_ht);
}

/**
 * Totaux d'un document. TVA calculée sur la base HT cumulée par taux (méthode usuelle des factures).
 * En franchise en base de TVA (art. 293 B du CGI), aucune TVA n'est facturée.
 */
export function computeTotals(lines: LineLike[], vatMode: 'normal' | 'franchise'): Totals {
  const bases = new Map<number, number>();
  for (const l of lines) {
    const rate = vatMode === 'franchise' ? 0 : l.vat_rate;
    bases.set(rate, (bases.get(rate) ?? 0) + lineTotal(l));
  }
  const byRate = [...bases.entries()].sort((a, b) => a[0] - b[0]).map(([rate, base]) => ({ rate, base, vat: vatOf(base, rate) }));
  const ht = byRate.reduce((s, r) => s + r.base, 0);
  const vat = byRate.reduce((s, r) => s + r.vat, 0);
  return { ht, vat, ttc: ht + vat, byRate };
}
