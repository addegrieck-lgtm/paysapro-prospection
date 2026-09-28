// Utilitaires numériques : aucun NaN / Infinity ne doit jamais atteindre l'interface.

/** Nombre fini ou null. Accepte « 12,5 », « 12.5 », « 1 200 ». */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const cleaned = input.replace(/\s/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  if (!/^-?\d*\.?\d*$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Valeur sûre : remplace null / NaN / Infinity par un repli. */
export function safe(value: number | null | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Arrondi à n décimales, sans erreur de flottant (1.005 → 1.01). */
export function round(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON * Math.sign(value)) * factor) / factor;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const moneyFmt = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const moneyFmtRounded = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** 2899 → « 2 899,00 € » ; jamais « NaN € ». */
export function formatMoney(value: number | null | undefined, rounded = false): string {
  return (rounded ? moneyFmtRounded : moneyFmt).format(safe(value));
}

/** 103.68 → « 103,68 » ; 96 → « 96 ». */
export function formatNumber(value: number | null | undefined, maxDecimals = 2): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: maxDecimals }).format(safe(value));
}

export function formatPercent(value: number | null | undefined): string {
  return `${formatNumber(value, 2)} %`;
}

/** Valeur d'un champ texte à partir d'un nombre (null → chaîne vide). */
export function toInput(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value).replace('.', ',') : '';
}
