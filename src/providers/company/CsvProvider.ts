// CsvProvider : fichiers CSV (export SIRENE, vos listes, enrichissement commercial), colonnes détectées automatiquement.
import type { ImportLine } from '../../data/repository';
import { parseCsv, type ParsedCsv } from '../../domain/csv';
import { autoDetectMapping, mapRow, type Mapping } from '../../domain/mapping';

export class CsvProvider {
  readonly id = 'csv' as const;
  readonly label = 'Fichier CSV';
  readonly description = 'Import de fichiers CSV (UTF-8, séparateur « , » ou « ; »), colonnes détectées automatiquement et corrigeables.';
  readonly enabled = true;
  readonly free = true;

  parse(text: string): ParsedCsv & { mapping: Mapping } {
    const parsed = parseCsv(text);
    return { ...parsed, mapping: autoDetectMapping(parsed.headers) };
  }

  toLines(parsed: ParsedCsv, mapping: Mapping, requireName = true): ImportLine[] {
    // ligne 1 = en-têtes : la première donnée est la ligne 2 du fichier
    return parsed.rows.map((values, i) => ({ line: i + 2, ...mapRow(values, mapping, requireName) }));
  }
}

export const csvProvider = new CsvProvider();
