// Paramètres → Sauvegarde automatique en ligne (chiffrée avec une phrase secrète connue de vous seul).
import { useState } from 'react';
import { CloudUpload, CloudDownload, ShieldCheck } from 'lucide-react';
import { Card, CardTitle, Badge } from './ui/Card';
import { Button } from './ui/Button';
import { Alert, ConfirmDialog, Dialog } from './ui/Feedback';
import { TextField } from './ui/Form';
import { formatDateTime, nf, useAction } from './common';
import { useApp, useCan } from '../app/context';
import { CloudBackup, MIN_PASSPHRASE, backupNow, deriveBackupKey, lastBackup, rememberBackup, rememberBackupKey, storedBackupKey, type BackupKey, type BackupMeta } from '../data/cloudBackup';
import type { ProspectsApi } from '../data/repository';

type Backup = Awaited<ReturnType<ProspectsApi['exportBackup']>>;

export function CloudBackupCard() {
  const { api, reloadSettings } = useApp();
  const run = useAction();
  const canRestore = useCan('prospecting.import');
  const cloud = new CloudBackup();
  const [key, setKey] = useState<BackupKey | null>(storedBackupKey);
  const [meta, setMeta] = useState<BackupMeta | null>(lastBackup);
  const [phrase, setPhrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  /** Sauvegarde déjà présente en ligne pour cette phrase (autre appareil) : restaurer ou remplacer ? */
  const [existing, setExisting] = useState<{ key: BackupKey; data: Backup; savedAt: string | null } | null>(null);
  const [restore, setRestore] = useState(false);
  const [off, setOff] = useState(false);

  const save = async (k: BackupKey) => {
    setBusy(true);
    const m = await run(() => backupNow(api, k, cloud), 'Sauvegarde en ligne effectuée');
    setBusy(false);
    if (m) setMeta(m);
    return !!m;
  };

  const doRestore = async (data: Backup) => {
    setBusy(true);
    await run(async () => {
      await api.restoreBackup(data);
      await reloadSettings();
    }, 'Sauvegarde restaurée');
    setBusy(false);
  };

  const activate = async () => {
    setBusy(true);
    const k = await run(() => deriveBackupKey(phrase));
    if (!k) return setBusy(false);
    // Une sauvegarde existe-t-elle déjà pour cette phrase ? (sinon on risquerait de l'écraser avec un appareil vide)
    let found: { data: Backup; savedAt: string | null } | null = null;
    try {
      found = await cloud.download<Backup>(k);
    } catch (e) {
      if (!(e instanceof Error) || !/Aucune sauvegarde/.test(e.message)) {
        setBusy(false);
        await run(() => Promise.reject(e));
        return;
      }
    }
    setBusy(false);
    if (found) return setExisting({ key: k, ...found });
    rememberBackupKey(k);
    setKey(k);
    setPhrase('');
    setConfirm('');
    await save(k);
  };

  const keep = (k: BackupKey) => {
    rememberBackupKey(k);
    setKey(k);
    setPhrase('');
    setConfirm('');
    setExisting(null);
  };

  if (!cloud.available)
    return (
      <Card>
        <CardTitle icon={<ShieldCheck className="h-5 w-5" />}>Sauvegarde en ligne</CardTitle>
        <p className="text-sm text-muted">Indisponible : le relais web n'est pas configuré (voir worker/README.md).</p>
      </Card>
    );

  return (
    <Card>
      <CardTitle icon={<ShieldCheck className="h-5 w-5" />} action={<Badge tone={key ? 'success' : 'neutral'}>{key ? 'Activée' : 'Désactivée'}</Badge>}>
        Sauvegarde automatique en ligne
      </CardTitle>
      {key ? (
        <div className="space-y-3">
          <p className="text-sm">
            {meta ? (
              <>
                Dernière sauvegarde : <strong>{formatDateTime(meta.savedAt)}</strong> — {nf.format(meta.prospects)} prospect{meta.prospects > 1 ? 's' : ''}, {nf.format(Math.max(1, Math.round(meta.size / 1024)))} Ko chiffrés.
              </>
            ) : (
              'Aucune sauvegarde envoyée depuis cet appareil pour le moment.'
            )}
          </p>
          <p className="text-sm text-muted">Une sauvegarde est envoyée automatiquement une fois par jour à l'ouverture de l'application. Elle remplace la précédente.</p>
          <div className="flex flex-wrap gap-2">
            <Button icon={<CloudUpload className="h-5 w-5" />} disabled={busy} onClick={() => save(key)}>
              Sauvegarder maintenant
            </Button>
            {canRestore && (
              <Button variant="secondary" icon={<CloudDownload className="h-5 w-5" />} disabled={busy} onClick={() => setRestore(true)}>
                Restaurer la sauvegarde en ligne
              </Button>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => setOff(true)}>
              Désactiver sur cet appareil
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Vos prospects, notes, relances et réglages sont copiés une fois par jour sur votre relais Cloudflare, chiffrés avec une phrase secrète que vous seul connaissez. En cas de panne ou de changement d'appareil, saisissez la même phrase pour tout
            récupérer.
          </p>
          <Alert tone="warning" title="Notez votre phrase secrète">
            Elle n'est enregistrée nulle part en clair et ne peut pas être réinitialisée : sans elle, la sauvegarde est définitivement illisible.
          </Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Phrase secrète" type="password" autoComplete="new-password" value={phrase} onChange={setPhrase} hint={`Au moins ${MIN_PASSPHRASE} caractères (plusieurs mots, par exemple).`} />
            <TextField label="Confirmez la phrase" type="password" autoComplete="new-password" value={confirm} onChange={setConfirm} error={confirm && confirm !== phrase ? 'Les deux phrases sont différentes.' : null} />
          </div>
          <Button icon={<CloudUpload className="h-5 w-5" />} disabled={busy || phrase.trim().length < MIN_PASSPHRASE || phrase !== confirm} onClick={activate}>
            {busy ? 'Vérification…' : 'Activer la sauvegarde en ligne'}
          </Button>
          <p className="text-xs text-muted">Déjà activée sur un autre appareil ? Saisissez la même phrase : l'application vous proposera de restaurer.</p>
        </div>
      )}

      <Dialog
        open={!!existing}
        onClose={() => setExisting(null)}
        title="Une sauvegarde existe déjà"
        footer={
          <>
            <Button variant="secondary" onClick={() => setExisting(null)}>
              Annuler
            </Button>
            <Button variant="secondary" onClick={() => keep(existing!.key)}>
              Garder les données de cet appareil
            </Button>
            <Button
              onClick={async () => {
                const e = existing!;
                keep(e.key);
                await doRestore(e.data);
                const m = { savedAt: e.savedAt ?? new Date().toISOString(), size: 0, prospects: e.data.prospects.length };
                rememberBackup(m);
                setMeta(m);
              }}
            >
              Restaurer sur cet appareil
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-muted">
          <p>
            Une sauvegarde en ligne correspond à cette phrase : <strong className="text-ink">{nf.format(existing?.data.prospects.length ?? 0)} prospect(s)</strong>
            {existing?.savedAt ? `, enregistrée le ${formatDateTime(existing.savedAt)}` : ''}.
          </p>
          <p>« Restaurer » remplace les données de cet appareil par cette sauvegarde.</p>
          <p>« Garder les données de cet appareil » active la sauvegarde : la copie en ligne sera remplacée par les données de cet appareil à la prochaine sauvegarde.</p>
        </div>
      </Dialog>
      <ConfirmDialog
        open={restore}
        title="Restaurer la sauvegarde en ligne ?"
        message="Toutes les données de cet appareil seront remplacées par la dernière sauvegarde en ligne."
        confirmLabel="Restaurer"
        danger
        onClose={() => setRestore(false)}
        onConfirm={async () => {
          setRestore(false);
          setBusy(true);
          const found = await run(() => cloud.download<Backup>(key!));
          setBusy(false);
          if (found) await doRestore(found.data);
        }}
      />
      <ConfirmDialog
        open={off}
        title="Désactiver la sauvegarde en ligne ?"
        message="Cet appareil n'enverra plus de sauvegarde. La dernière sauvegarde en ligne est conservée et reste récupérable avec votre phrase secrète."
        confirmLabel="Désactiver"
        onClose={() => setOff(false)}
        onConfirm={() => {
          rememberBackupKey(null);
          setKey(null);
          setMeta(null);
          setOff(false);
        }}
      />
    </Card>
  );
}
