import { vatOf } from './money';

/**
 * Calculateur d'impression.
 * Principe : un prix n'est affiché que pour une variante fournisseur EXACTE (tous les attributs + quantité),
 * vérifiée, non expirée et dont le prix de vente a été validé. Jamais d'interpolation entre deux quantités
 * ou deux finitions : sinon, « Sur devis ».
 * Le coût fournisseur ne sort JAMAIS de ce module vers le public : seule `publicEstimate` est exposée.
 */

export const ATTRS = ['format', 'orientation', 'paper', 'weight', 'finish', 'printing', 'extra', 'delivery'] as const;
export type Attr = (typeof ATTRS)[number];

export const ATTR_LABELS: Record<Attr | 'quantity', string> = {
  format: 'Format',
  orientation: 'Orientation',
  paper: 'Papier',
  weight: 'Grammage',
  finish: 'Finition',
  printing: 'Impression',
  extra: 'Option',
  delivery: 'Délai de livraison',
  quantity: 'Quantité',
};

/** Options proposées pour un produit (relevées chez le fournisseur, modifiables dans l'administration). */
export interface PrintOptions {
  format?: string[];
  orientation?: string[];
  paper?: string[];
  weight?: string[];
  finish?: string[];
  printing?: string[];
  extra?: string[];
  delivery?: string[];
  quantity: number[];
  /** Libellés propres au produit (ex. extra → « Coins », finish → « Couverture »). */
  labels?: Partial<Record<Attr, string>>;
  /** Attributs choisis par le client mais sans effet sur le prix (ex. orientation) : ignorés pour la recherche de prix. */
  nonPricing?: Attr[];
}

export type PrintConfig = Record<Attr, string> & { quantity: number };

export interface VariantRow {
  id: number;
  product_id: number;
  format: string;
  orientation: string;
  paper: string;
  weight: string;
  finish: string;
  printing: string;
  extra: string;
  delivery: string;
  quantity: number;
  supplier_price_ht: number | null;
  supplier_shipping_ht: number | null;
  supplier_other_fees_ht: number | null;
  status: string;
  verified_at: string | null;
  sale_print_ht: number | null;
  sale_shipping_ht: number | null;
  sale_other_ht: number | null;
  sale_validated_at: string | null;
  cost_at_validation: number | null;
  lead_time_days: number | null;
}

export function parseOptions(json: string | null | undefined): PrintOptions {
  try {
    const o = JSON.parse(json || '{}') as PrintOptions;
    return { ...o, quantity: Array.isArray(o.quantity) ? o.quantity.filter((n) => Number.isInteger(n) && n > 0) : [] };
  } catch {
    return { quantity: [] };
  }
}

/** Attributs effectivement utilisés par un produit (ceux qui ont au moins une valeur). */
export function activeAttrs(o: PrintOptions): Attr[] {
  return ATTRS.filter((a) => (o[a] as string[] | undefined)?.length);
}

export function attrLabel(a: Attr | 'quantity', o?: PrintOptions): string {
  return (a !== 'quantity' && o?.labels?.[a]) || ATTR_LABELS[a];
}

/**
 * Valide une configuration envoyée par le navigateur : chaque valeur doit appartenir aux options du produit.
 * Retourne la configuration normalisée, ou la liste des erreurs.
 */
export function validateConfig(o: PrintOptions, input: Record<string, unknown>): { ok: true; config: PrintConfig } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const config = { quantity: 0 } as PrintConfig;
  for (const a of ATTRS) {
    const allowed = (o[a] as string[] | undefined) ?? [];
    const v = typeof input[a] === 'string' ? (input[a] as string) : '';
    if (!allowed.length) {
      config[a] = '';
    } else if (allowed.includes(v)) {
      config[a] = v;
    } else {
      errors.push(`${attrLabel(a, o)} : choix indisponible.`);
    }
  }
  const q = Number(input.quantity);
  if (!o.quantity.includes(q)) errors.push('Quantité : choix indisponible.');
  config.quantity = q;
  return errors.length ? { ok: false, errors } : { ok: true, config };
}

/** Configuration servant à la tarification : les attributs non tarifants sont vidés. */
export function pricingKey(c: PrintConfig, o?: PrintOptions): PrintConfig {
  const k = { ...c };
  for (const a of o?.nonPricing ?? []) k[a] = '';
  return k;
}

/** Recherche STRICTE de la variante correspondant exactement à la configuration (aucune approximation). */
export function findExactVariant<V extends VariantRow>(variants: V[], c: PrintConfig, o?: PrintOptions): V | undefined {
  const k = pricingKey(c, o);
  return variants.find((v) => v.quantity === k.quantity && ATTRS.every((a) => v[a] === k[a]));
}

/** Total des coûts fournisseur HT d'une variante (null si le prix d'impression est inconnu). */
export function supplierTotal(v: Pick<VariantRow, 'supplier_price_ht' | 'supplier_shipping_ht' | 'supplier_other_fees_ht'>): number | null {
  if (v.supplier_price_ht == null) return null;
  return v.supplier_price_ht + (v.supplier_shipping_ht ?? 0) + (v.supplier_other_fees_ht ?? 0);
}

export function saleTotal(v: Pick<VariantRow, 'sale_print_ht' | 'sale_shipping_ht' | 'sale_other_ht'>): number | null {
  if (v.sale_print_ht == null) return null;
  return v.sale_print_ht + (v.sale_shipping_ht ?? 0) + (v.sale_other_ht ?? 0);
}

const DAY = 86_400_000;

/** Statut effectif : un prix « vérifié » dont la vérification dépasse la durée de validité est « expiré ». */
export function effectiveStatus(v: Pick<VariantRow, 'status' | 'verified_at'>, now: Date, validityDays: number): 'verifie' | 'a_verifier' | 'expire' {
  if (v.status === 'expire') return 'expire';
  if (v.status !== 'verifie' || !v.verified_at) return 'a_verifier';
  const age = now.getTime() - new Date(v.verified_at).getTime();
  return age > validityDays * DAY ? 'expire' : 'verifie';
}

/** Le coût fournisseur a changé depuis la validation du prix de vente : décision requise (le prix public n'est PAS modifié). */
export function costChangedSinceValidation(v: VariantRow): boolean {
  const total = supplierTotal(v);
  return v.sale_validated_at != null && v.cost_at_validation != null && total != null && total !== v.cost_at_validation;
}

/** Une variante peut-elle afficher un prix ferme au public ? */
export function isPublishable(v: VariantRow, now: Date, validityDays: number): boolean {
  return (
    effectiveStatus(v, now, validityDays) === 'verifie' &&
    v.supplier_price_ht != null &&
    v.sale_print_ht != null &&
    v.sale_validated_at != null &&
    !costChangedSinceValidation(v)
  );
}

/** Prix de vente suggéré (coefficient configurable). Simple suggestion : jamais appliqué automatiquement. */
export function suggestedSalePrice(supplierCents: number, markupPercent: number): number {
  return Math.ceil((supplierCents * (1 + markupPercent / 100)) / 100) * 100;
}

export type UnpricedReason = 'no_variant' | 'unverified' | 'expired' | 'no_sale_price' | 'cost_changed';

export const UNPRICED_LABELS: Record<UnpricedReason, string> = {
  no_variant: 'Cette combinaison n’a pas encore de tarif enregistré.',
  unverified: 'Le tarif de cette combinaison est en cours de vérification auprès de l’imprimeur.',
  expired: 'Le tarif de cette combinaison doit être revérifié auprès de l’imprimeur.',
  no_sale_price: 'Le tarif de cette combinaison est en cours de validation.',
  cost_changed: 'Le tarif de cette combinaison est en cours de mise à jour.',
};

/** Raison INTERNE de l'absence de prix (administration, tests). Ne jamais l'exposer telle quelle au public. */
export function unpricedReason(v: VariantRow | undefined, now: Date, validityDays: number): UnpricedReason | null {
  if (!v) return 'no_variant';
  const st = effectiveStatus(v, now, validityDays);
  if (st === 'expire') return 'expired';
  if (st !== 'verifie' || v.supplier_price_ht == null) return 'unverified';
  if (v.sale_print_ht == null || !v.sale_validated_at) return 'no_sale_price';
  if (costChangedSinceValidation(v)) return 'cost_changed';
  return null;
}

export interface DesignOffer {
  name: string;
  priceHt: number | null;
  priceMode: string;
}

/** Estimation PUBLIQUE : uniquement des prix de vente, jamais de coûts fournisseur ni de marge. */
export interface PublicEstimate {
  status: 'priced' | 'on_request';
  /** Raison publique volontairement générique (aucune information sur les coûts). */
  reason: 'no_variant' | 'pending' | null;
  message: string;
  design: { wanted: boolean; name: string; priceHt: number | null; fromPrice: boolean } | null;
  printHt: number | null;
  shippingHt: number | null;
  otherHt: number | null;
  totalHt: number | null;
  vatRate: number;
  vatMode: 'normal' | 'franchise';
  vat: number | null;
  totalTtc: number | null;
  leadTimeDays: number | null;
  alternatives: { config: PrintConfig; totalHt: number }[];
}

export function publicEstimate(args: {
  variants: VariantRow[];
  config: PrintConfig;
  options?: PrintOptions;
  wantDesign: boolean;
  design: DesignOffer | null;
  vatRate: number;
  vatMode: 'normal' | 'franchise';
  validityDays: number;
  now: Date;
}): PublicEstimate {
  const { variants, config, wantDesign, design, vatMode, validityDays, now } = args;
  const vatRate = vatMode === 'franchise' ? 0 : args.vatRate;
  const v = findExactVariant(variants, config, args.options);
  const reason = unpricedReason(v, now, validityDays);

  const designPart = wantDesign && design
    ? { wanted: true, name: design.name, priceHt: design.priceMode === 'quote' ? null : design.priceHt, fromPrice: design.priceMode === 'from' }
    : wantDesign
      ? { wanted: true, name: 'Création graphique', priceHt: null, fromPrice: false }
      : null;
  const designUnpriced = designPart != null && designPart.priceHt == null;

  const alternatives = reason
    ? variants
        .filter((x) => isPublishable(x, now, validityDays))
        .map((x) => ({ x, score: ATTRS.filter((a) => x[a] === config[a]).length + (x.quantity === config.quantity ? 1 : 0) }))
        .sort((a, b) => b.score - a.score || a.x.quantity - b.x.quantity)
        .slice(0, 3)
        .map(({ x }) => ({ config: { ...pickConfig(x), ...keepNonPricing(config, args.options) }, totalHt: saleTotal(x)! }))
    : [];

  if (reason || !v) {
    return {
      status: 'on_request',
      reason: reason === 'no_variant' || !reason ? 'no_variant' : 'pending',
      message: UNPRICED_LABELS[reason === 'no_variant' || !reason ? 'no_variant' : 'unverified'] + ' Nous vous envoyons un devis précis sous 48 h ouvrées.',
      design: designPart,
      printHt: null,
      shippingHt: null,
      otherHt: null,
      totalHt: null,
      vatRate,
      vatMode,
      vat: null,
      totalTtc: null,
      leadTimeDays: null,
      alternatives,
    };
  }

  const printHt = v.sale_print_ht!;
  const shippingHt = v.sale_shipping_ht ?? 0;
  const otherHt = v.sale_other_ht ?? 0;
  const designHt = designPart?.priceHt ?? 0;
  const totalHt = printHt + shippingHt + otherHt + designHt;
  const vat = vatOf(totalHt, vatRate);
  return {
    status: designUnpriced ? 'on_request' : 'priced',
    reason: null,
    message: designUnpriced
      ? 'Impression chiffrée ; la création graphique fera l’objet d’un devis.'
      : designPart?.fromPrice
        ? 'Estimation « à partir de » : le devis définitif sera validé avant envoi.'
        : 'Estimation indicative : le devis définitif sera validé avant envoi.',
    design: designPart,
    printHt,
    shippingHt,
    otherHt,
    totalHt: designUnpriced ? null : totalHt,
    vatRate,
    vatMode,
    vat: designUnpriced ? null : vat,
    totalTtc: designUnpriced ? null : totalHt + vat,
    leadTimeDays: v.lead_time_days,
    alternatives: [],
  };
}

function keepNonPricing(c: PrintConfig, o?: PrintOptions): Partial<PrintConfig> {
  const out: Partial<PrintConfig> = {};
  for (const a of o?.nonPricing ?? []) out[a] = c[a];
  return out;
}

export function pickConfig(v: Pick<VariantRow, Attr | 'quantity'>): PrintConfig {
  const c = { quantity: v.quantity } as PrintConfig;
  for (const a of ATTRS) c[a] = v[a];
  return c;
}

export function describeConfig(c: Partial<PrintConfig>, o?: PrintOptions): string {
  const parts: string[] = [];
  for (const a of ATTRS) if (c[a]) parts.push(`${attrLabel(a, o)} : ${c[a]}`);
  if (c.quantity) parts.push(`${c.quantity.toLocaleString('fr-FR')} exemplaires`);
  return parts.join(' · ');
}
