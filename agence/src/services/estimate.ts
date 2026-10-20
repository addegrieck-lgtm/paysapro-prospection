import type { Db } from '../db/types';
import type { Settings } from '../domain/settings';
import type { ProductRow } from '../repo/types';
import { parseOptions, publicEstimate, validateConfig, type PrintConfig, type PublicEstimate } from '../domain/print';
import { serviceBySlug, variantsOf } from '../repo/catalog';

/**
 * Estimation calculée CÔTÉ SERVEUR à partir de la configuration validée.
 * Le résultat ne contient que des prix de vente (jamais de coût fournisseur).
 */
export async function estimateFor(
  db: Db,
  s: Settings,
  product: ProductRow,
  input: Record<string, unknown>,
  wantDesign: boolean,
  now = new Date(),
): Promise<{ ok: true; config: PrintConfig; estimate: PublicEstimate } | { ok: false; errors: string[] }> {
  const options = parseOptions(product.options);
  const v = validateConfig(options, input);
  if (!v.ok) return v;
  const design = product.design_service_slug ? await serviceBySlug(db, product.design_service_slug) : undefined;
  const estimate = publicEstimate({
    variants: await variantsOf(db, product.id),
    config: v.config,
    options,
    wantDesign,
    design: design ? { name: design.name, priceHt: design.price_ht, priceMode: design.price_mode } : null,
    vatRate: s.vatRate,
    vatMode: s.vatMode,
    validityDays: s.supplierPriceValidityDays,
    now,
  });
  return { ok: true, config: v.config, estimate };
}
