/**
 * Veille complète en ligne de commande (base locale, sans limite d'invocation) :
 *   npm run sync                 toutes les sources activées
 *   npm run sync -- bodacc       une seule source
 * Affiche le rapport d'exécution (sources interrogées, nouveautés, erreurs).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openNodeDb } from '../src/server/db/sqlite-node';
import { prepareDatabase } from '../src/server/db/bootstrap';
import { runToCompletion } from '../src/server/services/sync';

if (existsSync('.env')) process.loadEnvFile('.env');
const env = process.env;
const path = resolve(env.DATABASE_PATH ?? './data/radar.db');
mkdirSync(dirname(path), { recursive: true });
const db = openNodeDb(path);
await prepareDatabase(db);
const only = process.argv[2];
const secrets = { INSEE_API_KEY: env.INSEE_API_KEY, INPI_USERNAME: env.INPI_USERNAME, INPI_PASSWORD: env.INPI_PASSWORD, PAPPERS_API_TOKEN: env.PAPPERS_API_TOKEN, ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY };
const runId = await runToCompletion({ db, fetch: (i, init) => fetch(i, init), secrets }, 'cli', only, (m) => console.log(m));
const run = await db.get<{ status: string; summary: string }>('SELECT status, summary FROM sync_runs WHERE id = ?', [runId]);
console.log(`\nVeille n° ${runId} : ${run?.status === 'success' ? 'complète' : run?.status === 'partial' ? 'PARTIELLE (certaines sources n\'ont pas pu être interrogées)' : 'EN ERREUR'}`);
for (const [src, s] of Object.entries(JSON.parse(run?.summary ?? '{}') as Record<string, { status: string; fetched: number; created: number; updated: number; errors: number; problems: string[] }>)) {
  console.log(`- ${src} : ${s.status} — ${s.fetched} lus, ${s.created} nouveaux, ${s.updated} modifiés, ${s.errors} erreur(s)${s.problems.length ? `\n    ${s.problems.join('\n    ')}` : ''}`);
}
