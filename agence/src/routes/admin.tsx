import { Hono } from 'hono';
import type { AppEnv } from '../app/context';
import { setCookie } from 'hono/cookie';
import { requireAdmin } from '../app/security';
import { OWNER_COOKIE, OWNER_COOKIE_DAYS } from '../services/analytics';
import { authRoutes, logoutRoutes } from './admin/auth';
import { dashboardRoutes } from './admin/dashboard';
import { crmRoutes } from './admin/crm';
import { quoteRoutes } from './admin/quotes';
import { orderRoutes } from './admin/orders';
import { projectRoutes } from './admin/projects';
import { invoiceRoutes } from './admin/invoices';
import { catalogRoutes } from './admin/catalog';
import { contentRoutes } from './admin/content';
import { settingsRoutes } from './admin/settings';
import { statsRoutes } from './admin/stats';
import { briefRoutes } from './admin/briefs';
import { subscriptionRoutes } from './admin/subscriptions';

/** Administration : seules /connexion et /installation sont accessibles sans session. */
export const adminRoutes = new Hono<AppEnv>();
adminRoutes.route('/', authRoutes);

const secured = new Hono<AppEnv>();
secured.use('*', requireAdmin);
// Cet appareil est celui de l'exploitant : ses visites du site public ne seront plus comptées, même déconnecté.
secured.use('*', async (c, next) => {
  await next();
  setCookie(c, OWNER_COOKIE, '1', { path: '/', httpOnly: true, sameSite: 'Lax', secure: c.get('deps').config.production, maxAge: OWNER_COOKIE_DAYS * 86400 });
});
for (const r of [logoutRoutes, dashboardRoutes, statsRoutes, crmRoutes, briefRoutes, quoteRoutes, orderRoutes, projectRoutes, invoiceRoutes, subscriptionRoutes, catalogRoutes, contentRoutes, settingsRoutes]) secured.route('/', r);
adminRoutes.route('/', secured);
