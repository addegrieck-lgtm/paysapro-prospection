import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { openProspectingDB } from '../src/data/db';
import { ProspectsApi } from '../src/data/repository';
import { CloudBackup, autoBackup, autoBackupDue, backupNow, decryptBackup, deriveBackupKey, encryptBackup, lastBackup, rememberBackupKey, storedBackupKey } from '../src/data/cloudBackup';
import { handle, type BackupStore } from '../worker/web-proxy.js';

/** Stockage Cloudflare KV simulé en mémoire */
function fakeKv() {
  const map = new Map<string, { value: ArrayBuffer; metadata: { savedAt?: string; size?: number } | null }>();
  const store: BackupStore = {
    async put(key, value, options) {
      map.set(key, { value, metadata: (options?.metadata as { savedAt?: string; size?: number }) ?? null });
    },
    async getWithMetadata(key) {
      return map.get(key) ?? { value: null, metadata: null };
    },
  };
  return { map, store };
}

const ORIGIN = 'https://addegrieck-lgtm.github.io';
/** Relais réel (worker/web-proxy.js) branché sur le stockage simulé */
function relay(kv = fakeKv(), origin = ORIGIN) {
  const cloud = new CloudBackup('https://relais.test', (url, init) => handle(new Request(url, { ...init, headers: { ...(init?.headers as Record<string, string>), Origin: origin } }), { ALLOWED_ORIGINS: ORIGIN, BACKUPS: kv.store }));
  return { cloud, kv };
}

let n = 0;
async function setup() {
  const db = await openProspectingDB(`backup-${++n}-${Date.now()}`);
  return new ProspectsApi(db, { workspaceId: 'w1', user: 'Adrien', role: 'owner' });
}

const memory = new Map<string, string>();
beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => void memory.set(k, v), removeItem: (k: string) => void memory.delete(k) },
  });
});

describe('Chiffrement de la sauvegarde', () => {
  it('même phrase → même clé et même adresse ; phrase différente → tout diffère', async () => {
    const a = await deriveBackupKey('mon jardin secret 2026');
    const b = await deriveBackupKey('  mon jardin secret 2026 ');
    const c = await deriveBackupKey('mon jardin secret 2027');
    expect(a.id).toMatch(/^[0-9a-f]{64}$/);
    expect(b.id).toBe(a.id);
    expect(c.id).not.toBe(a.id);
    await expect(deriveBackupKey('trop court')).rejects.toThrow(/au moins 12/);
  });

  it('aller-retour ; contenu illisible sans la phrase ; mauvaise phrase refusée', async () => {
    const key = await deriveBackupKey('mon jardin secret 2026');
    const data = { app: 'paysapro-prospection', prospects: [{ name: 'Clément Paysage', phone: '0675887774' }] };
    const bytes = await encryptBackup(data, key);
    expect(new TextDecoder().decode(bytes)).not.toContain('Paysage');
    expect(new TextDecoder().decode(bytes)).not.toContain('0675887774');
    expect(await decryptBackup(bytes, key)).toEqual(data);
    await expect(decryptBackup(bytes, await deriveBackupKey('une autre phrase secrète'))).rejects.toThrow(/Phrase secrète incorrecte/);
    // Deux chiffrements du même contenu donnent des octets différents (vecteur aléatoire)
    expect(Buffer.from(await encryptBackup(data, key)).equals(Buffer.from(bytes))).toBe(false);
  });
});

describe('Relais : stockage des sauvegardes', () => {
  it('refuse une origine inconnue, un identifiant invalide, un contenu vide ; 501 sans stockage configuré', async () => {
    const kv = fakeKv();
    const env = { ALLOWED_ORIGINS: ORIGIN, BACKUPS: kv.store };
    const id = 'a'.repeat(64);
    const put = (path: string, origin: string, body: BodyInit, e: Parameters<typeof handle>[1] = env) => handle(new Request(`https://relais.test${path}`, { method: 'PUT', headers: { Origin: origin }, body }), e);
    expect((await put(`/backup/${id}`, 'https://pirate.test', new Uint8Array(64))).status).toBe(403);
    expect((await put('/backup/court', ORIGIN, new Uint8Array(64))).status).toBe(400);
    expect((await put(`/backup/${id}`, ORIGIN, new Uint8Array(4))).status).toBe(400);
    expect((await put(`/backup/${id}`, ORIGIN, new Uint8Array(64), { ALLOWED_ORIGINS: ORIGIN })).status).toBe(501);
    expect(kv.map.size).toBe(0);
    expect((await put(`/backup/${id}`, ORIGIN, new Uint8Array(64))).status).toBe(200);
    expect((await handle(new Request(`https://relais.test/backup/${'b'.repeat(64)}`, { headers: { Origin: ORIGIN } }), env)).status).toBe(404);
    // La lecture des sites d'entreprise continue de fonctionner comme avant
    expect((await handle(new Request('https://relais.test/?url=https://www.google.com/', { headers: { Origin: ORIGIN } }), env)).status).toBe(200);
    expect((await handle(new Request('https://relais.test/?url=x', { method: 'PUT', headers: { Origin: ORIGIN } }), env)).status).toBe(405);
  });
});

describe('Sauvegarde et restauration', () => {
  it('sauvegarde chiffrée puis restauration sur un autre appareil avec la même phrase', async () => {
    const { cloud, kv } = relay();
    const a = await setup();
    const p = await a.createProspect({ name: 'Clément Paysage', city: 'Dieppe', phone: '0675887774' });
    await a.addNote(p.id, 'Rappeler après 17 h');
    await a.saveSalesConfig({ ...(await import('../src/domain/sales')).defaultSalesConfig(), productName: 'Paysapro AI (test)' });
    const key = await deriveBackupKey('mon jardin secret 2026');
    const meta = await backupNow(a, key, cloud);
    expect(meta.prospects).toBe(1);
    expect(lastBackup()).toMatchObject({ prospects: 1 });
    const stored = [...kv.map.values()][0]!;
    expect(new TextDecoder().decode(stored.value)).not.toContain('Dieppe');

    const b = await setup();
    const found = await cloud.download<Parameters<ProspectsApi['restoreBackup']>[0]>(await deriveBackupKey('mon jardin secret 2026'));
    expect(found.savedAt).toBe(meta.savedAt);
    await b.restoreBackup(found.data);
    const rows = await b.allRows();
    expect(rows.map((r) => r.name)).toEqual(['Clément Paysage']);
    expect((await b.notesFor(rows[0]!.id))[0]!.text).toBe('Rappeler après 17 h');
    expect((await b.getSettings()).sales?.productName).toBe('Paysapro AI (test)');
    await expect(cloud.download(await deriveBackupKey('une autre phrase secrète'))).rejects.toThrow(/Aucune sauvegarde/);
  });

  it('automatique : une fois par 24 h, jamais depuis un appareil vide, inactive sans phrase', async () => {
    const { cloud, kv } = relay();
    const api = await setup();
    expect(await autoBackup(api, cloud)).toBeNull(); // pas activée
    rememberBackupKey(await deriveBackupKey('mon jardin secret 2026'));
    expect(storedBackupKey()!.id).toMatch(/^[0-9a-f]{64}$/);
    expect(memory.get('paysapro.backup.key')).not.toContain('jardin'); // la phrase n'est jamais conservée
    expect(autoBackupDue()).toBe(true);
    expect(await autoBackup(api, cloud)).toBeNull(); // appareil vide : on n'écrase rien
    expect(kv.map.size).toBe(0);
    await api.createProspect({ name: 'Jardins du Nord' });
    expect((await autoBackup(api, cloud))!.prospects).toBe(1);
    expect(await autoBackup(api, cloud)).toBeNull(); // déjà faite aujourd'hui
    expect((await autoBackup(api, cloud, Date.now() + 25 * 3600_000))!.prospects).toBe(1);
    rememberBackupKey(null);
    expect(storedBackupKey()).toBeNull();
    expect(lastBackup()).toBeNull();
  });

  it('relais non configuré : message clair', async () => {
    const off = new CloudBackup('');
    expect(off.available).toBe(false);
    await expect(off.upload({}, await deriveBackupKey('mon jardin secret 2026'))).rejects.toThrow(/Relais non configuré/);
  });
});
