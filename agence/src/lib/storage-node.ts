import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { FileStorage } from './storage';

/** Stockage disque (serveur Node). Le dossier doit être HORS du dossier public. */
export function diskStorage(dir: string): FileStorage {
  const root = resolve(dir);
  const pathOf = (key: string) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Clé de fichier invalide');
    return join(root, key);
  };
  return {
    async put(key, body, type) {
      await mkdir(root, { recursive: true });
      await writeFile(pathOf(key), body);
      await writeFile(pathOf(key) + '_type', type);
    },
    async get(key) {
      try {
        const [body, type] = await Promise.all([readFile(pathOf(key)), readFile(pathOf(key) + '_type', 'utf8')]);
        return { body: new Uint8Array(body), type };
      } catch {
        return null;
      }
    },
    async delete(key) {
      await rm(pathOf(key), { force: true });
      await rm(pathOf(key) + '_type', { force: true });
    },
  };
}
