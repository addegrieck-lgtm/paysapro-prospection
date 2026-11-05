/**
 * Authentification : mots de passe PBKDF2-SHA256 salés, sessions par jeton aléatoire (seul son hachage est stocké),
 * cookie HttpOnly / Secure / SameSite=Strict, verrouillage progressif après échecs, limitation par adresse IP.
 */
import type { Db } from '../db/types';
import { hashPassword, randomToken, sha256Hex, verifyPassword, passwordProblem } from '../lib/crypto';
import { hitRateLimit } from '../lib/ratelimit';

export type Role = 'admin' | 'analyste' | 'lecteur';
export interface SessionUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export const SESSION_COOKIE = 'nbr_session';
export const SESSION_DAYS = 14;
const MAX_FAILS = 5;

export { passwordProblem };

export async function createUser(db: Db, u: { email: string; name: string; password: string; role: Role }): Promise<number> {
  const problem = passwordProblem(u.password);
  if (problem) throw new Error(problem);
  const email = u.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail invalide.');
  if (await db.get('SELECT 1 FROM users WHERE email = ?', [email])) throw new Error('Un compte existe déjà avec cette adresse.');
  const r = await db.get<{ id: number }>('INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?) RETURNING id', [email, u.name.trim().slice(0, 100), await hashPassword(u.password), u.role]);
  return r!.id;
}

export async function userCount(db: Db): Promise<number> {
  return (await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM users'))?.n ?? 0;
}

export type LoginResult = { ok: true; token: string; user: SessionUser } | { ok: false; error: string; status: number };

export async function login(db: Db, email: string, password: string, ipHash: string, userAgent: string | null): Promise<LoginResult> {
  if (!(await hitRateLimit(db, `login:${ipHash}`, 10, 900))) return { ok: false, error: 'Trop de tentatives depuis cette connexion. Réessayez dans 15 minutes.', status: 429 };
  const u = await db.get<{ id: number; email: string; name: string; role: Role; password_hash: string; disabled: number; failed_attempts: number; locked_until: string | null }>(
    'SELECT id, email, name, role, password_hash, disabled, failed_attempts, locked_until FROM users WHERE email = ?',
    [email.trim().toLowerCase()],
  );
  const generic = { ok: false as const, error: 'Identifiants incorrects.', status: 401 };
  if (!u) {
    await hashPassword(password); // temps de réponse homogène
    return generic;
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) return { ok: false, error: 'Compte temporairement verrouillé après plusieurs échecs. Réessayez plus tard.', status: 423 };
  if (u.disabled) return generic;
  if (!(await verifyPassword(password, u.password_hash))) {
    const fails = u.failed_attempts + 1;
    const lock = fails >= MAX_FAILS ? new Date(Date.now() + Math.min(60, 2 ** (fails - MAX_FAILS) * 5) * 60_000).toISOString() : null;
    await db.run('UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?', [fails, lock, u.id]);
    await db.run("INSERT INTO audit_logs (user_id, action, details, ip_hash) VALUES (?, 'connexion_echec', ?, ?)", [u.id, `${fails} échec(s)`, ipHash]);
    return generic;
  }
  const token = randomToken(32);
  const now = new Date();
  await db.batch([
    { sql: 'INSERT INTO sessions (id, user_id, created_at, expires_at, ip_hash, user_agent) VALUES (?, ?, ?, ?, ?, ?)', params: [await sha256Hex(token), u.id, now.toISOString(), new Date(now.getTime() + SESSION_DAYS * 86400_000).toISOString(), ipHash, (userAgent ?? '').slice(0, 200)] },
    { sql: 'UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ? WHERE id = ?', params: [now.toISOString(), u.id] },
    { sql: "INSERT INTO audit_logs (user_id, action, ip_hash) VALUES (?, 'connexion', ?)", params: [u.id, ipHash] },
    { sql: 'DELETE FROM sessions WHERE expires_at < ?', params: [now.toISOString()] },
  ]);
  return { ok: true, token, user: { id: u.id, email: u.email, name: u.name, role: u.role } };
}

export async function sessionUser(db: Db, token: string | undefined): Promise<SessionUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;
  const row = await db.get<SessionUser & { expires_at: string; disabled: number }>(
    'SELECT u.id, u.email, u.name, u.role, u.disabled, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ?',
    [await sha256Hex(token)],
  );
  if (!row || row.disabled || new Date(row.expires_at) < new Date()) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function logout(db: Db, token: string | undefined): Promise<void> {
  if (token) await db.run('DELETE FROM sessions WHERE id = ?', [await sha256Hex(token)]);
}

export async function changePassword(db: Db, userId: number, current: string, next: string): Promise<void> {
  const u = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!u || !(await verifyPassword(current, u.password_hash))) throw new Error('Mot de passe actuel incorrect.');
  const problem = passwordProblem(next);
  if (problem) throw new Error(problem);
  await db.batch([
    { sql: 'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', params: [await hashPassword(next), new Date().toISOString(), userId] },
    { sql: 'DELETE FROM sessions WHERE user_id = ?', params: [userId] },
  ]);
}

export const ROLE_RANK: Record<Role, number> = { lecteur: 1, analyste: 2, admin: 3 };
