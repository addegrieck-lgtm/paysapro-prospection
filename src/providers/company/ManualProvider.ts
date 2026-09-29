// ManualProvider : saisie manuelle et aide à la recherche web (liens construits, aucun scraping).
import type { Prospect } from '../../domain/types';
import { webSearchLinks } from '../../domain/links';

export class ManualProvider {
  readonly id = 'manual' as const;
  readonly label = 'Saisie manuelle et recherche web';
  readonly description = 'Complétez une fiche à la main après une recherche web (Google, Maps, PagesJaunes…) ouverte depuis la fiche.';
  readonly enabled = true;
  readonly free = true;

  searchLinks(p: Pick<Prospect, 'name' | 'tradeName' | 'city' | 'phone' | 'siret' | 'siren'>) {
    return webSearchLinks(p);
  }
}

export const manualProvider = new ManualProvider();
