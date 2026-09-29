// Configuration de l'enrichissement (variables d'environnement facultatives, voir .env.example).
const env = import.meta.env ?? {};

function num(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export const ENRICHMENT_CONFIG = {
  /** API publique « Recherche d'entreprises » (données SIRENE / INSEE), gratuite et sans clé */
  apiUrl: (env.VITE_RECHERCHE_ENTREPRISES_API_URL || env.VITE_SIRENE_API_URL || 'https://recherche-entreprises.api.gouv.fr').replace(/\/$/, ''),
  /** Un prospect enrichi depuis moins de N jours n'est pas réinterrogé (sauf « Forcer ») */
  cacheDays: num(env.VITE_ENRICHMENT_CACHE_DAYS, 30, 0, 365),
  /** Nombre de prospects lus en base par lot pendant un enrichissement de masse */
  batchSize: num(env.VITE_ENRICHMENT_BATCH_SIZE, 50, 1, 500),
  /** Requêtes par seconde vers l'API (limite officielle ≈ 7/s : 4 par défaut pour garder de la marge) */
  rateLimitPerSecond: num(env.VITE_ENRICHMENT_RATE_LIMIT, 4, 0.2, 7),
  /** Relais web gratuit (Cloudflare Worker, voir worker/README.md) ; vide = lecture des sites désactivée */
  webProxyUrl: (env.VITE_WEB_PROXY_URL || '').replace(/\/$/, ''),
};
