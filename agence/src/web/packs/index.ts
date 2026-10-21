/**
 * Registre des packs « Bien démarrer », dans l'ordre d'affichage.
 * Pour ajouter un métier : créer `src/web/packs/<metier>.ts` (type PackDef) puis l'ajouter ici.
 */
import type { PackDef } from './types';
import { restaurant } from './restaurant';
import { paysagiste } from './paysagiste';
import { coiffeur } from './coiffeur';
import { artisanBatiment } from './artisan-batiment';

export const PACKS: PackDef[] = [restaurant, paysagiste, coiffeur, artisanBatiment];

export const packBySlug = (slug: string | undefined) => PACKS.find((p) => p.slug === slug);

export type { PackDef } from './types';
