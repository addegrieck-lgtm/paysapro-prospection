// Sauvegarde automatique en ligne, chiffrée de bout en bout.
//
//   phrase secrète ──PBKDF2──▶ clé AES-256 (chiffrement) + identifiant (adresse de la sauvegarde sur le relais)
//
// La sauvegarde (même contenu que « Sauvegarder (JSON) ») est compressée puis chiffrée DANS LE NAVIGATEUR. Le relais
// Cloudflare ne stocke que des octets illisibles : sans la phrase secrète, personne — pas même l'hébergeur — ne
// peut lire vos prospects. Contrepartie : une phrase perdue rend la sauvegarde irrécupérable.
// Sur l'appareil, seule la clé dérivée est conservée (jamais la phrase elle-même).
import { ENRICHMENT_CONFIG } from '../config';
import type { ProspectsApi } from './repository';

const SALT = 'paysapro-prospection/sauvegarde/v1';
const ITERATIONS = 310_000;
const KEY_STORE = 'paysapro.backup.key';
const META_STORE = 'paysapro.backup.meta';
export const MIN_PASSPHRASE = 12;
/** Une sauvegarde automatique au plus toutes les 24 h */
export const AUTO_INTERVAL_MS = 24 * 3600_000;

export interface BackupKey {
  /** 32 octets : clé AES-256-GCM */
  key: Uint8Array;
  /** 64 caractères hexadécimaux : adresse de la sauvegarde */
  id: string;
}

export interface BackupMeta {
  savedAt: string;
  size: number;
  prospects: number;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => new Uint8Array((s.match(/../g) ?? []).map((x) => parseInt(x, 16)));

export async function deriveBackupKey(passphrase: string): Promise<BackupKey> {
  const phrase = passphrase.normalize('NFKC').trim();
  if (phrase.length < MIN_PASSPHRASE) throw new Error(`La phrase secrète doit contenir au moins ${MIN_PASSPHRASE} caractères.`);
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(phrase), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(SALT), iterations: ITERATIONS }, material, 512));
  return { key: bits.slice(0, 32), id: hex(bits.slice(32)) };
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

const aes = (k: BackupKey, usage: KeyUsage) => crypto.subtle.importKey('raw', k.key as BufferSource, 'AES-GCM', false, [usage]);

/** JSON → gzip → AES-256-GCM. Format : 12 octets de vecteur d'initialisation puis le texte chiffré. */
export async function encryptBackup(data: unknown, k: BackupKey): Promise<Uint8Array> {
  const plain = await pipe(new TextEncoder().encode(JSON.stringify(data)), new CompressionStream('gzip'));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aes(k, 'encrypt'), plain as BufferSource));
  const out = new Uint8Array(12 + cipher.length);
  out.set(iv);
  out.set(cipher, 12);
  return out;
}

export async function decryptBackup<T = unknown>(bytes: Uint8Array, k: BackupKey): Promise<T> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await aes(k, 'decrypt'), bytes.slice(12));
  } catch {
    throw new Error('Phrase secrète incorrecte ou sauvegarde endommagée.');
  }
  return JSON.parse(new TextDecoder().decode(await pipe(new Uint8Array(plain), new DecompressionStream('gzip')))) as T;
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class CloudBackup {
  private base: string;
  private fetchImpl: FetchLike;

  constructor(base: string = ENRICHMENT_CONFIG.webProxyUrl, fetchImpl: FetchLike = (u, i) => fetch(u, i)) {
    this.base = base.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  /** Le relais (qui héberge les sauvegardes) est-il configuré ? */
  get available(): boolean {
    return !!this.base;
  }

  private async fail(res: Response): Promise<never> {
    let message = `Relais indisponible (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // réponse non JSON : message générique
    }
    throw new Error(message);
  }

  async upload(data: unknown, k: BackupKey): Promise<{ savedAt: string; size: number }> {
    if (!this.available) throw new Error('Relais non configuré : la sauvegarde en ligne est indisponible.');
    const body = await encryptBackup(data, k);
    const res = await this.fetchImpl(`${this.base}/backup/${k.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/octet-stream' }, body: body as BodyInit });
    if (!res.ok) return this.fail(res);
    return (await res.json()) as { savedAt: string; size: number };
  }

  async download<T = unknown>(k: BackupKey): Promise<{ data: T; savedAt: string | null }> {
    if (!this.available) throw new Error('Relais non configuré : la sauvegarde en ligne est indisponible.');
    const res = await this.fetchImpl(`${this.base}/backup/${k.id}`, { method: 'GET' });
    if (!res.ok) return this.fail(res);
    return { data: await decryptBackup<T>(new Uint8Array(await res.arrayBuffer()), k), savedAt: res.headers.get('X-Saved-At') || null };
  }
}

// ─────────────── Mémoire de l'appareil (clé dérivée + date de la dernière sauvegarde) ───────────────

export function storedBackupKey(): BackupKey | null {
  try {
    const raw = localStorage.getItem(KEY_STORE);
    if (!raw) return null;
    const v = JSON.parse(raw) as { key: string; id: string };
    return /^[0-9a-f]{64}$/.test(v.key) && /^[0-9a-f]{64}$/.test(v.id) ? { key: unhex(v.key), id: v.id } : null;
  } catch {
    return null;
  }
}

export function rememberBackupKey(k: BackupKey | null): void {
  try {
    if (k) localStorage.setItem(KEY_STORE, JSON.stringify({ key: hex(k.key), id: k.id }));
    else {
      localStorage.removeItem(KEY_STORE);
      localStorage.removeItem(META_STORE);
    }
  } catch {
    // stockage indisponible (navigation privée) : la sauvegarde automatique reste inactive
  }
}

export function lastBackup(): BackupMeta | null {
  try {
    const raw = localStorage.getItem(META_STORE);
    return raw ? (JSON.parse(raw) as BackupMeta) : null;
  } catch {
    return null;
  }
}

export function rememberBackup(meta: BackupMeta): void {
  try {
    localStorage.setItem(META_STORE, JSON.stringify(meta));
  } catch {
    // sans incidence : la prochaine ouverture refera une sauvegarde
  }
}

/** Une sauvegarde automatique est-elle due ? (activée, et dernière sauvegarde de plus de 24 h) */
export function autoBackupDue(now = Date.now()): boolean {
  if (!storedBackupKey()) return false;
  const last = lastBackup();
  return !last || now - new Date(last.savedAt).getTime() >= AUTO_INTERVAL_MS;
}

/** Envoie une sauvegarde complète et mémorise sa date. */
export async function backupNow(api: ProspectsApi, key: BackupKey, cloud = new CloudBackup()): Promise<BackupMeta> {
  const data = await api.exportBackup();
  const r = await cloud.upload(data, key);
  const meta = { savedAt: r.savedAt, size: r.size, prospects: data.prospects.length };
  rememberBackup(meta);
  return meta;
}

/**
 * Sauvegarde automatique : au plus une fois par 24 h, et jamais depuis un appareil vide
 * (pour ne pas écraser une bonne sauvegarde par une base sans prospect).
 */
export async function autoBackup(api: ProspectsApi, cloud = new CloudBackup(), now = Date.now()): Promise<BackupMeta | null> {
  const key = storedBackupKey();
  if (!key || !cloud.available || !autoBackupDue(now)) return null;
  if ((await api.allRows()).length === 0) return null;
  return backupNow(api, key, cloud);
}
