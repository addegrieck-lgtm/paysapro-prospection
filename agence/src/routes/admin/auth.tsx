import { Hono } from 'hono';
import type { AppEnv, Ctx } from '../../app/context';
import { allowRate, createSession, destroySession } from '../../app/security';
import { hashPassword, passwordProblem, safeEqual, verifyPassword } from '../../lib/crypto';
import { LoginShell } from '../../web/admin/ui';
import { audit } from '../../repo/settings';
import { hitRateLimit } from '../../lib/ratelimit';
import { sha256Hex } from '../../lib/crypto';

export const authRoutes = new Hono<AppEnv>();

const safeNext = (n: string | undefined) => (n && /^\/admin(\/[\w\-/]*)?$/.test(n) ? n : '/admin');

function LoginForm({ error, next, email, noUser }: { error?: string; next: string; email?: string; noUser?: boolean }) {
  return (
    <LoginShell title="Connexion — Administration">
      <h1>Administration</h1>
      {noUser && (
        <div class="alert alert-warning">
          Aucun compte administrateur n’existe encore. Créez-le via la page <a href="/admin/installation">d’installation</a> (jeton ADMIN_SETUP_TOKEN requis) ou
          la commande <code>npm run admin:create</code>.
        </div>
      )}
      {error && <div class="alert alert-error">{error}</div>}
      <form method="post" action="/admin/connexion">
        <input type="hidden" name="suite" value={next} />
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" autocomplete="username" required value={email ?? ''} />
        </div>
        <div class="field">
          <label for="password">Mot de passe</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required />
        </div>
        <button type="submit" class="btn btn-primary">Se connecter</button>
      </form>
      <p class="small muted">
        <a href="/">← Retour au site</a>
      </p>
    </LoginShell>
  );
}

authRoutes.get('/connexion', async (c) => {
  if (c.get('user')) return c.redirect('/admin');
  const count = await c.get('deps').db.get<{ n: number }>('SELECT COUNT(*) AS n FROM admin_users');
  return c.html(<LoginForm next={safeNext(c.req.query('suite'))} noUser={!count?.n} />);
});

authRoutes.post('/connexion', async (c) => {
  const body = await c.req.parseBody();
  const email = String(body.email ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const next = safeNext(String(body.suite ?? ''));
  const { db } = c.get('deps');
  // Limitation : 10 essais / 15 min par adresse IP et 5 par compte.
  const ipOk = await allowRate(c, 'login', 10, 900);
  const accOk = await hitRateLimit(db, `login-acc:${(await sha256Hex(email)).slice(0, 24)}`, 5, 900);
  if (!ipOk || !accOk) return c.html(<LoginForm error="Trop de tentatives. Réessayez dans 15 minutes." next={next} email={email} />, 429);
  const user = await db.get<{ id: number; password_hash: string }>('SELECT id, password_hash FROM admin_users WHERE email = ?', [email]);
  // Vérification effectuée même si le compte n'existe pas (temps de réponse homogène).
  const ok = await verifyPassword(password, user?.password_hash ?? 'pbkdf2$100000$00000000000000000000000000000000$00');
  if (!user || !ok) return c.html(<LoginForm error="E-mail ou mot de passe incorrect." next={next} email={email} />, 401);
  await createSession(c, user.id);
  await db.run('UPDATE admin_users SET last_login_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);
  await audit(db, user.id, 'connexion');
  return c.redirect(next, 303);
});

function SetupForm({ error }: { error?: string }) {
  return (
    <LoginShell title="Installation — Administration">
      <h1>Créer le compte administrateur</h1>
      <p class="muted small">Cette page n’est disponible que tant qu’aucun compte n’existe, et exige le jeton défini dans la variable ADMIN_SETUP_TOKEN.</p>
      {error && <div class="alert alert-error">{error}</div>}
      <form method="post" action="/admin/installation">
        <div class="field">
          <label for="token">Jeton d’installation</label>
          <input id="token" name="token" type="password" required autocomplete="off" />
        </div>
        <div class="field">
          <label for="name">Votre nom</label>
          <input id="name" name="name" required maxlength={80} autocomplete="name" />
        </div>
        <div class="field">
          <label for="email">E-mail</label>
          <input id="email" name="email" type="email" required autocomplete="username" />
        </div>
        <div class="field">
          <label for="password">Mot de passe (12 caractères minimum, lettres et chiffres)</label>
          <input id="password" name="password" type="password" required minlength={12} autocomplete="new-password" />
        </div>
        <div class="field">
          <label for="password2">Confirmation</label>
          <input id="password2" name="password2" type="password" required minlength={12} autocomplete="new-password" />
        </div>
        <button type="submit" class="btn btn-primary">Créer le compte</button>
      </form>
    </LoginShell>
  );
}

async function setupAvailable(c: Ctx) {
  const { db, config } = c.get('deps');
  if (!config.setupToken) return false;
  const n = await db.get<{ n: number }>('SELECT COUNT(*) AS n FROM admin_users');
  return !n?.n;
}

authRoutes.get('/installation', async (c) => {
  if (!(await setupAvailable(c))) return c.notFound();
  return c.html(<SetupForm />);
});

authRoutes.post('/installation', async (c) => {
  if (!(await setupAvailable(c))) return c.notFound();
  if (!(await allowRate(c, 'setup', 5, 900))) return c.html(<SetupForm error="Trop de tentatives." />, 429);
  const b = await c.req.parseBody();
  const token = String(b.token ?? '');
  if (!safeEqual(token, c.get('deps').config.setupToken)) return c.html(<SetupForm error="Jeton d’installation incorrect." />, 403);
  const name = String(b.name ?? '').trim();
  const email = String(b.email ?? '').trim().toLowerCase();
  const pw = String(b.password ?? '');
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.html(<SetupForm error="Nom ou e-mail invalide." />, 422);
  const problem = passwordProblem(pw) ?? (pw !== String(b.password2 ?? '') ? 'Les mots de passe ne correspondent pas.' : null);
  if (problem) return c.html(<SetupForm error={problem} />, 422);
  const { db } = c.get('deps');
  const r = await db.run('INSERT INTO admin_users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)', [email, name, await hashPassword(pw), new Date().toISOString()]);
  await audit(db, r.lastId, 'creation-compte-admin');
  await createSession(c, r.lastId);
  return c.redirect('/admin?ok=created', 303);
});

export const logoutRoutes = new Hono<AppEnv>();
logoutRoutes.post('/deconnexion', async (c) => {
  await audit(c.get('deps').db, c.get('user')?.id ?? null, 'deconnexion');
  await destroySession(c);
  return c.redirect('/admin/connexion', 303);
});
