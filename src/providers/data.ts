// Sources de données : couche abstraite pour pouvoir changer de fournisseur sans réécrire le module.
//
//   DataProvider
//   ├── SireneProvider        (défaut : API publique gratuite recherche-entreprises.api.gouv.fr, sans clé)
//   ├── CsvProvider           (fichiers CSV : export SIRENE, annuaires, vos propres listes, enrichissement)
//   ├── ManualProvider        (saisie d'une fiche)
//   └── GooglePlacesProvider  (DÉSACTIVÉ : API payante, uniquement si vous le décidez plus tard)
import type { ImportLine } from '../data/repository';
import { parseCsv, type ParsedCsv } from '../domain/csv';
import { autoDetectMapping, mapRow, type Mapping } from '../domain/mapping';

export interface DataProvider {
  readonly id: 'sirene' | 'csv' | 'manual' | 'google_places';
  readonly label: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly free: boolean;
}

export class CsvProvider implements DataProvider {
  readonly id = 'csv' as const;
  readonly label = 'Fichier CSV';
  readonly description = 'Import de fichiers CSV (UTF-8, séparateur « , » ou « ; »), colonnes détectées automatiquement.';
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

export class ManualProvider implements DataProvider {
  readonly id = 'manual' as const;
  readonly label = 'Saisie manuelle';
  readonly description = 'Création ou enrichissement d’une fiche à la main (recherche Google manuelle, appel…).';
  readonly enabled = true;
  readonly free = true;
}

/** Préparé mais désactivé : Google Places est payant au-delà du quota gratuit et nécessite un proxy. */
export class GooglePlacesProvider implements DataProvider {
  readonly id = 'google_places' as const;
  readonly label = 'Google Places API';
  readonly description = 'Optionnel, payant, désactivé. Nécessiterait une clé détenue par un proxy serveur. Utilisez la recherche Google manuelle depuis chaque fiche.';
  readonly enabled = false;
  readonly free = false;
  async search(): Promise<never> {
    throw new Error('Google Places n’est pas activé (service payant optionnel).');
  }
}

export const csvProvider = new CsvProvider();
export const manualProvider = new ManualProvider();
export const googlePlacesProvider = new GooglePlacesProvider();
