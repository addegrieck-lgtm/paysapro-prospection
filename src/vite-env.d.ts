/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SAAS_NAME?: string;
  readonly VITE_AI_ENDPOINT?: string;
  readonly VITE_SIRENE_API_URL?: string;
  readonly VITE_RECHERCHE_ENTREPRISES_API_URL?: string;
  readonly VITE_ENRICHMENT_CACHE_DAYS?: string;
  readonly VITE_ENRICHMENT_BATCH_SIZE?: string;
  readonly VITE_ENRICHMENT_RATE_LIMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
