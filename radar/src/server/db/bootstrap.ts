import type { Db } from './types';
import { migrate } from './migrations';
import { SECTORS } from '../domain/sectors';
import { ALL_SOURCES } from '../connectors/registry';

/**
 * Prépare la base : migrations, référentiel des secteurs, déclaration des sources.
 * N'insère AUCUNE entreprise : les données proviennent exclusivement des connecteurs et des imports.
 * Les réglages modifiés par l'utilisateur (secteurs activés, sources activées, codes NAF ajoutés) sont conservés.
 */
export async function prepareDatabase(db: Db): Promise<void> {
  await migrate(db);
  await db.batch(
    SECTORS.map((s, i) => ({
      sql: `INSERT INTO sectors (id, parent_id, label, priority, naf_codes, keywords, enabled, sort) VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            ON CONFLICT(id) DO UPDATE SET parent_id = excluded.parent_id, label = excluded.label, priority = excluded.priority, sort = excluded.sort`,
      params: [s.id, s.parent, s.label, s.priority, '', s.keywords.join(','), i],
    })),
  );
  await db.batch(
    ALL_SOURCES.map((s) => ({
      sql: 'INSERT INTO sources (id, label, enabled) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET label = excluded.label',
      params: [s.id, s.label, s.defaultEnabled ? 1 : 0],
    })),
  );
}
