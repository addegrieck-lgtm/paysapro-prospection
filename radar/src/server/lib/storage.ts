/** Stockage privé des documents de l'Acquisition Manager : disque (Node), KV ou R2 (Cloudflare). */
export interface FileStorage {
  put(key: string, data: ArrayBuffer, contentType: string): Promise<void>;
  get(key: string): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
}

export interface KVLike {
  put(key: string, value: ArrayBuffer, options?: { metadata?: unknown }): Promise<void>;
  get(key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  delete(key: string): Promise<void>;
}

export interface R2Like {
  put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  delete(key: string): Promise<void>;
}

export const kvStorage = (kv: KVLike): FileStorage => ({
  put: (k, d, t) => kv.put(k, d, { metadata: { contentType: t } }),
  get: (k) => kv.get(k, 'arrayBuffer'),
  delete: (k) => kv.delete(k),
});

export const r2Storage = (r2: R2Like): FileStorage => ({
  put: async (k, d, t) => void (await r2.put(k, d, { httpMetadata: { contentType: t } })),
  get: async (k) => (await (await r2.get(k))?.arrayBuffer()) ?? null,
  delete: (k) => r2.delete(k),
});

export const memoryStorage = (): FileStorage => {
  const m = new Map<string, ArrayBuffer>();
  return { put: async (k, d) => void m.set(k, d), get: async (k) => m.get(k) ?? null, delete: async (k) => void m.delete(k) };
};

/** Types de fichiers acceptés (documents professionnels) et taille maximale (KV : 25 Mo par valeur). */
export const ALLOWED_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  csv: 'text/csv',
  txt: 'text/plain',
};
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
