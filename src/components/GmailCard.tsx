// Paramètres → Envoi direct des e-mails depuis votre adresse Gmail (script Google personnel, gratuit, sans domaine).
import { useState } from 'react';
import { MailCheck, Send } from 'lucide-react';
import { Card, CardTitle, Badge } from './ui/Card';
import { Button } from './ui/Button';
import { Alert, ConfirmDialog } from './ui/Feedback';
import { TextField } from './ui/Form';
import { CopyButton, useAction } from './common';
import { AppsScriptEmailProvider, OPT_OUT_LINE, appsScriptCode, newSecret, saveGmailConfig, storedGmailConfig, validScriptUrl, type GmailConfig } from '../providers/gmail';

export function GmailCard() {
  const run = useAction();
  // Le code secret est créé dès l'ouverture pour que le script copié corresponde toujours à cet appareil
  const [config, setConfig] = useState<GmailConfig>(() => {
    const stored = storedGmailConfig();
    if (stored?.secret) return stored;
    const fresh = { url: '', secret: newSecret() };
    saveGmailConfig(fresh);
    return fresh;
  });
  const [url, setUrl] = useState(config.url);
  const [status, setStatus] = useState<{ from: string; remaining: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [off, setOff] = useState(false);
  const active = validScriptUrl(config.url);

  const connect = async () => {
    const next = { url: url.trim(), secret: config.secret };
    setBusy(true);
    const s = await run(() => new AppsScriptEmailProvider(next).ping(), 'Liaison avec Gmail vérifiée');
    setBusy(false);
    if (!s) return;
    saveGmailConfig(next);
    setConfig(next);
    setStatus(s);
  };

  const test = async () => {
    setBusy(true);
    const provider = new AppsScriptEmailProvider(config);
    await run(async () => {
      const s = await provider.ping();
      const r = await provider.send({
        to: s.from,
        subject: 'Test — Paysapro Prospection',
        text: `Ceci est un e-mail de test envoyé depuis Paysapro Prospection.\n\n${OPT_OUT_LINE}`,
        html: `<p style="font-family:Arial,sans-serif">Ceci est un e-mail de test envoyé depuis <b>Paysapro Prospection</b>.</p>`,
      });
      setStatus({ from: s.from, remaining: r.remaining });
    }, 'E-mail de test envoyé à votre propre adresse');
    setBusy(false);
  };

  return (
    <Card>
      <CardTitle icon={<MailCheck className="h-5 w-5" />} action={<Badge tone={active ? 'success' : 'neutral'}>{active ? 'Activé' : 'Désactivé'}</Badge>}>
        Envoi direct des e-mails (Gmail)
      </CardTitle>
      <p className="text-sm text-muted">
        Les e-mails de l'Assistant commercial partent de votre propre adresse Gmail, avec l'image et les boutons, sans nom de domaine. Un message à la fois, déclenché par vous. Google limite un compte Gmail gratuit à environ 100 destinataires par jour.
      </p>
      {active ? (
        <div className="mt-3 space-y-3">
          {status && (
            <p className="text-sm">
              Adresse d'envoi : <strong>{status.from || 'inconnue'}</strong>
              {status.remaining !== null && ` — ${status.remaining} envoi(s) encore possible(s) aujourd'hui`}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={async () => setStatus((await run(() => new AppsScriptEmailProvider(config).ping())) ?? status)}>
              Vérifier la liaison
            </Button>
            <Button icon={<Send className="h-5 w-5" />} disabled={busy} onClick={test}>
              M'envoyer un e-mail de test
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setOff(true)}>
              Désactiver sur cet appareil
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Ouvrez{' '}
              <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">
                Google Apps Script
              </a>{' '}
              avec le compte Gmail qui doit envoyer les e-mails.
            </li>
            <li>
              Effacez le contenu affiché, puis collez le script : <CopyButton text={appsScriptCode(config.secret)} label="Copier le script" className="ml-1 align-middle" />
            </li>
            <li>
              Cliquez sur <strong>Déployer → Nouveau déploiement</strong>, type <strong>Application Web</strong>, « Exécuter en tant que : <strong>Moi</strong> », « Qui a accès : <strong>Tout le monde</strong> », puis <strong>Déployer</strong> et autorisez l'accès
              demandé par Google.
            </li>
            <li>Copiez l'« URL de l'application Web » (elle se termine par /exec) et collez-la ci-dessous.</li>
          </ol>
          <TextField
            label="URL de l'application Web"
            type="url"
            placeholder="https://script.google.com/macros/s/…/exec"
            value={url}
            onChange={setUrl}
            error={url.trim() && !validScriptUrl(url) ? 'Adresse attendue : https://script.google.com/macros/s/…/exec' : null}
          />
          <Button disabled={busy || !validScriptUrl(url)} onClick={connect}>
            {busy ? 'Vérification…' : 'Vérifier et activer'}
          </Button>
          <Alert tone="info">
            Le script contient un code secret propre à cet appareil : seule cette application peut lui demander un envoi. L'adresse du script et ce code restent sur cet appareil. « Tout le monde » signifie seulement que l'adresse est joignable sans connexion
            Google ; sans le code, le script refuse toute demande.
          </Alert>
        </div>
      )}
      <ConfirmDialog
        open={off}
        title="Désactiver l'envoi direct ?"
        message="Cet appareil n'enverra plus d'e-mail directement. Pour couper totalement l'accès, supprimez aussi le déploiement dans Google Apps Script. Un nouveau code secret sera créé si vous réactivez l'envoi."
        confirmLabel="Désactiver"
        onClose={() => setOff(false)}
        onConfirm={() => {
          const fresh = { url: '', secret: newSecret() };
          saveGmailConfig(fresh);
          setConfig(fresh);
          setUrl('');
          setStatus(null);
          setOff(false);
        }}
      />
    </Card>
  );
}
