/**
 * Marges — définitions (ne jamais les confondre) :
 *  • Marge brute estimée = prix de vente HT − coûts directs HT
 *  • Taux de marge (sur coûts directs) = marge brute / coûts directs HT × 100   (si coûts > 0)
 *  • Taux de marque = marge brute / prix de vente HT × 100                     (si prix > 0)
 * Les frais généraux, cotisations sociales et impôts ne sont PAS inclus.
 */
export interface DirectCosts {
  production: number;
  supplier: number;
  shipping: number;
  external: number;
  /** Temps de travail valorisé (heures × coût horaire interne). 0 si non valorisé. */
  labour: number;
}

export interface MarginResult {
  directCosts: number;
  grossMargin: number;
  /** Taux de marge sur coûts directs, en %. null si coûts directs ≤ 0. */
  marginRate: number | null;
  /** Taux de marque, en %. null si prix de vente ≤ 0. */
  markRate: number | null;
}

export function sumCosts(c: DirectCosts): number {
  return c.production + c.supplier + c.shipping + c.external + c.labour;
}

export function computeMargin(priceHt: number, costs: DirectCosts | number): MarginResult {
  const directCosts = typeof costs === 'number' ? costs : sumCosts(costs);
  const grossMargin = priceHt - directCosts;
  return {
    directCosts,
    grossMargin,
    marginRate: directCosts > 0 ? round1((grossMargin / directCosts) * 100) : null,
    markRate: priceHt > 0 ? round1((grossMargin / priceHt) * 100) : null,
  };
}

/** Temps de travail valorisé en centimes. */
export function labourCost(hours: number, hourlyCostCents: number): number {
  return Math.round(hours * hourlyCostCents);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
