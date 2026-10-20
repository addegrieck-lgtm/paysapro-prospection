/**
 * Création (ou réinitialisation du mot de passe) d'un compte administrateur — serveur Node.
 *   npm run admin:create
 * Les informations sont demandées de façon interactive (le mot de passe n'apparaît pas dans l'historique du terminal).
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { openNodeDb } from '../src/db/sqlite-node';
import { migrate } from '../src/db/migrations';
import { seedIfEmpty } from '../src/db/seed';
import { hashPassword, passwordProblem } from '../src/lib/crypto';

const dbPath = resolve(process.env.DATABASE_PATH ?? './data/agence.db');
mkdirSync(dirname(dbPath), { recursive: true });
const db = openNodeDb(dbPath);
await migrate(db);
await seedIfEmpty(db);

const rl = createInterface({ input: stdin, output: stdout });
const name = (await rl.question('Nom : ')).trim();
const email = (await rl.question('E-mail : ')).trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? (await rl.question('Mot de passe (12 caractères min., lettres et chiffres) : '));
rl.close();

if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Nom ou e-mail invalide.');
  process.exit(1);
}
const problem = passwordProblem(password);
if (problem) {
  console.error(problem);
  process.exit(1);
}
const hash = await hashPassword(password);
const existing = await db.get<{ id: number }>('SELECT id FROM admin_users WHERE email = ?', [email]);
if (existing) {
  await db.run('UPDATE admin_users SET name = ?, password_hash = ? WHERE id = ?', [name, hash, existing.id]);
  await db.run('DELETE FROM sessions WHERE user_id = ?', [existing.id]);
  console.log(`Mot de passe réinitialisé pour ${email} (sessions fermées).`);
} else {
  await db.run('INSERT INTO admin_users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)', [email, name, hash, new Date().toISOString()]);
  console.log(`Compte administrateur créé : ${email}`);
}
