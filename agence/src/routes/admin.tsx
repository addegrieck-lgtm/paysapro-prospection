import { Hono } from 'hono';
import type { AppEnv } from '../app/context';
import { requireAdmin } from '../app/security';
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
for (const r of [logoutRoutes, dashboardRoutes, statsRoutes, crmRoutes, briefRoutes, quoteRoutes, orderRoutes, projectRoutes, invoiceRoutes, subscriptionRoutes, catalogRoutes, contentRoutes, settingsRoutes]) secured.route('/', r);
adminRoutes.route('/', secured);
