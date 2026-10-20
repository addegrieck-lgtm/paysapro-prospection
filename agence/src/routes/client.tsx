import { Hono } from 'hono';
import type { AppEnv } from '../app/context';
export const clientRoutes = new Hono<AppEnv>();
