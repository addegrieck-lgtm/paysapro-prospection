import { Hono } from 'hono';
import type { AppEnv } from '../app/context';
export const adminRoutes = new Hono<AppEnv>();
