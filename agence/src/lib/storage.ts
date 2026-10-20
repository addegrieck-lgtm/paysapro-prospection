/** Stockage des fichiers privés (pièces jointes, BAT). Jamais servis publiquement en direct. */
export interface StoredFile {
  body: Uint8Array;
  type: string;
}

export interface FileStorage {
  put(key: string, body: Uint8Array, type: string): Promise<void>;
  get(key: string): Promise<StoredFile | null>;
  delete(key: string): Promise<void>;
}

/** Stockage en mémoire (tests). */
export function memoryStorage(): FileStorage {
  const m = new Map<string, StoredFile>();
  return {
    async put(key, body, type) {
      m.set(key, { body, type });
    },
    async get(key) {
      return m.get(key) ?? null;
    },
    async delete(key) {
      m.delete(key);
    },
  };
}

export const ALLOWED_UPLOADS = {
  'application/pdf': { ext: 'pdf', label: 'PDF' },
  'image/png': { ext: 'png', label: 'PNG' },
  'image/jpeg': { ext: 'jpg', label: 'JPEG' },
  'image/webp': { ext: 'webp', label: 'WebP' },
} as const;

export type AllowedType = keyof typeof ALLOWED_UPLOADS;

/** Détermine le type RÉEL d'un fichier d'après sa signature (on ne fait pas confiance au type déclaré). */
export function sniffType(b: Uint8Array): AllowedType | null {
  const s = (i: number, n: number) => String.fromCharCode(...b.slice(i, i + n));
  if (b.length >= 5 && s(0, 5) === '%PDF-') return 'application/pdf';
  if (b.length >= 8 && b[0] === 0x89 && s(1, 3) === 'PNG') return 'image/png';
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 12 && s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'image/webp';
  return null;
}

/** Nom de fichier affichable sans risque (pas de chemin, pas de caractères de contrôle). */
export function safeFileName(name: string, type: AllowedType): string {
  const base = name.split(/[\\/]/).pop() ?? 'fichier';
  const clean = base.normalize('NFKC').replace(/[^\p{L}\p{N} ._()-]/gu, '_').replace(/\.+$/, '').slice(0, 100) || 'fichier';
  const ext = ALLOWED_UPLOADS[type].ext;
  return clean.toLowerCase().endsWith(`.${ext}`) ? clean : `${clean}.${ext}`;
}

export const UPLOAD_LIMITS = { maxFiles: 5, maxFileBytes: 10 * 1024 * 1024, maxTotalBytes: 25 * 1024 * 1024 };
