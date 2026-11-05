/**
 * Création d'un compte en ligne de commande (base locale) :
 *   npm run user:create -- email@exemple.fr "Nom Prénom" admin
 * Le mot de passe est demandé de façon interactive (jamais passé en argument ni enregistré dans l'historique).
 */
import { createInterface } from 'node:readline/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openNodeDb } from '../src/server/db/sqlite-node';
import { prepareDatabase } from '../src/server/db/bootstrap';
import { createUser, type Role } from '../src/server/services/auth';

if (existsSync('.env')) process.loadEnvFile('.env');
const [email, name, role = 'admin'] = process.argv.slice(2);
if (!email || !name || !['admin', 'analyste', 'lecteur'].includes(role)) {
  console.error('Usage : npm run user:create -- <email> "<nom>" [admin|analyste|lecteur]');
  process.exit(1);
}
const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Mot de passe (12 caractères minimum, lettres et chiffres) : ');
rl.close();
const path = resolve(process.env.DATABASE_PATH ?? './data/radar.db');
mkdirSync(dirname(path), { recursive: true });
const db = openNodeDb(path);
await prepareDatabase(db);
try {
  const id = await createUser(db, { email, name, password, role: role as Role });
  console.log(`Compte créé (id ${id}, rôle ${role}).`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
