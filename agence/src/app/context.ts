import type { Context } from 'hono';
import type { Db } from '../db/types';
import type { FileStorage } from '../lib/storage';
import type { Mailer } from '../lib/mail';
import type { Settings } from '../domain/settings';

export interface AppConfig {
  /** Secret serveur (≥ 32 caractères) : signature des jetons de formulaire. Variable APP_SECRET. */
  appSecret: string;
  /** Production : cookies « Secure », HSTS. */
  production: boolean;
  /** Jeton à usage unique pour créer le premier compte administrateur (ADMIN_SETUP_TOKEN). Vide = désactivé. */
  setupToken: string;
}

export interface Deps {
  db: Db;
  storage: FileStorage;
  mailer: Mailer;
  config: AppConfig;
  /** Adresse IP du client (utilisée uniquement sous forme hachée, pour la limitation de débit). */
  clientIp: (c: Context) => string;
  now?: () => Date;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
}

export type AppEnv = {
  Variables: {
    deps: Deps;
    settings: Settings;
    user: AdminUser | null;
    csrf: string;
  };
};

export type Ctx = Context<AppEnv>;
