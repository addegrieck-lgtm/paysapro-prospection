// Permissions (RBAC) et quotas.
//
// Aujourd'hui un seul utilisateur (le propriétaire) : tout est autorisé. Le modèle est prêt pour
// des comptes « Sales » ou « Viewer » et pour des plans payants, sans rien bloquer pendant la bêta.
import type { Role } from './types';

export type Permission =
  | 'prospecting.view'
  | 'prospecting.create'
  | 'prospecting.edit'
  | 'prospecting.delete'
  | 'prospecting.import'
  | 'prospecting.export'
  | 'prospecting.campaign';

const ALL: Permission[] = [
  'prospecting.view',
  'prospecting.create',
  'prospecting.edit',
  'prospecting.delete',
  'prospecting.import',
  'prospecting.export',
  'prospecting.campaign',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ALL,
  admin: ALL,
  sales: ['prospecting.view', 'prospecting.create', 'prospecting.edit', 'prospecting.export', 'prospecting.campaign'],
  viewer: ['prospecting.view'],
};

export const ROLE_LABEL: Record<Role, string> = { owner: 'Propriétaire', admin: 'Administrateur', sales: 'Commercial', viewer: 'Lecture seule' };

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export class PermissionError extends Error {
  constructor(permission: Permission) {
    super(`Action non autorisée pour votre rôle (${permission}).`);
    this.name = 'PermissionError';
  }
}

export function assertCan(role: Role, permission: Permission): void {
  if (!can(role, permission)) throw new PermissionError(permission);
}

// ─── Quotas (architecture prête, rien n'est bloqué pendant la bêta) ───

export type PlanId = 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';

export interface Quotas {
  prospects_limit: number;
  exports_limit: number;
  ai_generations_limit: number;
  campaign_limit: number;
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLAN_QUOTAS: Record<PlanId, Quotas> = {
  FREE: { prospects_limit: 100, exports_limit: 5, ai_generations_limit: 20, campaign_limit: 1 },
  PRO: { prospects_limit: 5_000, exports_limit: 100, ai_generations_limit: 500, campaign_limit: 20 },
  BUSINESS: { prospects_limit: 20_000, exports_limit: 1_000, ai_generations_limit: 5_000, campaign_limit: 200 },
  ENTERPRISE: { prospects_limit: UNLIMITED, exports_limit: UNLIMITED, ai_generations_limit: UNLIMITED, campaign_limit: UNLIMITED },
};

/** Usage interne du propriétaire : illimité. */
export const CURRENT_PLAN: PlanId = 'ENTERPRISE';

export function quotaAllows(quota: keyof Quotas, used: number, plan: PlanId = CURRENT_PLAN): boolean {
  return used < PLAN_QUOTAS[plan][quota];
}
