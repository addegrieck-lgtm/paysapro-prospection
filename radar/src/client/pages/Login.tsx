import { useState, type FormEvent } from 'react';
import { api } from '../api';
import { Button, ErrorBox, Field, inputCls, Notice } from '../components/ui';

export default function LoginPage({ setupRequired, setupTokenConfigured, onDone }: { setupRequired: boolean; setupTokenConfigured: boolean; onDone: () => void }) {
  const [form, setForm] = useState({ email: '', password: '', name: '', token: '' });
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (setupRequired) await api.post('/auth/setup', form);
      else await api.post('/auth/login', { email: form.email, password: form.password });
      onDone();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(57,135,229,0.12),transparent_60%)] p-4">
      <form onSubmit={submit} className="fade-in w-full max-w-sm space-y-4 rounded-2xl border border-ink-700 bg-ink-800/90 p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" className="h-9 w-9" />
          <div>
            <div className="text-sm font-semibold tracking-wide">NORMANDIE BUSINESS RADAR</div>
            <div className="text-xs text-fog-400">{setupRequired ? 'Installation : création du compte administrateur' : 'Connexion'}</div>
          </div>
        </div>
        {setupRequired && !setupTokenConfigured && <Notice tone="warn">Aucun jeton d'installation n'est configuré. Définissez le secret SETUP_TOKEN (16 caractères minimum) puis rechargez la page — voir docs/DEPLOIEMENT.md.</Notice>}
        {setupRequired && (
          <>
            <Field label="Jeton d'installation (secret SETUP_TOKEN)">
              <input className={inputCls} value={form.token} onChange={set('token')} required autoComplete="off" />
            </Field>
            <Field label="Nom">
              <input className={inputCls} value={form.name} onChange={set('name')} required autoComplete="name" />
            </Field>
          </>
        )}
        <Field label="Adresse e-mail">
          <input className={inputCls} type="email" value={form.email} onChange={set('email')} required autoComplete="username" />
        </Field>
        <Field label="Mot de passe" hint={setupRequired ? '12 caractères minimum, lettres et chiffres.' : undefined}>
          <input className={inputCls} type="password" value={form.password} onChange={set('password')} required autoComplete={setupRequired ? 'new-password' : 'current-password'} />
        </Field>
        <ErrorBox error={error} />
        <Button variant="primary" className="w-full" busy={busy} type="submit">
          {setupRequired ? 'Créer le compte et se connecter' : 'Se connecter'}
        </Button>
      </form>
    </div>
  );
}
