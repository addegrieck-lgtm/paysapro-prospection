/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SAAS_NAME?: string;
  readonly VITE_AI_ENDPOINT?: string;
  readonly VITE_SIRENE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
