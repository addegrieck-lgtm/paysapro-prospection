// Fiches Google (API officielle Google Places, « Text Search »), appelée par le relais : la clé GOOGLE_PLACES_KEY
// reste côté relais. Payant au-delà du quota gratuit mensuel de Google.
//
// Rapprochement prudent (rien n'est supposé) :
//   nom proche (≥ 0,7) ET même code postal / même commune / < 3 km → fiche retenue ;
//   plusieurs fiches équivalentes → rien n'est attribué ;
//   aucune fiche ne correspond → « aucune fiche Google trouvée » (constat daté, utile au score de l'agence).
import type { KeyValueCache } from '../../data/cache';
import type { Prospect } from '../../domain/types';
import { normText } from '../../domain/normalize';
import type { FetchLike } from '../http';
import { RelayService, type RelayReply } from '../relayService';
import { nameSimilarity } from './RechercheEntreprisesProvider';
import { distanceKm } from './OpenStreetMapProvider';

export interface GooglePlace {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviews: number | null;
  mapsUrl: string | null;
  /** OPERATIONAL, CLOSED_TEMPORARILY, CLOSED_PERMANENTLY */
  status: string | null;
  category: string | null;
  lat: number | null;
  lon: number | null;
}

export type PlaceTarget = Pick<Prospect, 'name' | 'tradeName' | 'city' | 'postalCode'> & Partial<Pick<Prospect, 'address' | 'latitude' | 'longitude'>>;

export interface PlaceMatch {
  place: GooglePlace;
  /** Éléments concordants (name, postalCode, city, nearby) */
  matched: string[];
}

/** Rapprochement d'une entreprise avec les fiches trouvées (fonction pure). undefined = ambigu. */
export function matchGooglePlace(places: GooglePlace[], p: PlaceTarget): PlaceMatch | null | undefined {
  const scored = places
    .map((x) => {
      const sim = Math.max(nameSimilarity(x.name, p.name), p.tradeName ? nameSimilarity(x.name, p.tradeName) : 0);
      if (sim < 0.7) return null;
      const address = normText(x.address);
      const matched = ['name'];
      if (p.postalCode && (x.address ?? '').includes(p.postalCode)) matched.push('postalCode');
      if (p.city && address.includes(normText(p.city))) matched.push('city');
      if (x.lat !== null && x.lon !== null && p.latitude != null && p.longitude != null && distanceKm({ lat: x.lat, lon: x.lon }, { lat: p.latitude, lon: p.longitude }) <= 3) matched.push('nearby');
      return matched.length > 1 ? { place: x, matched, sim } : null;
    })
    .filter((v): v is PlaceMatch & { sim: number } => !!v)
    .sort((a, b) => b.sim - a.sim);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0]!.sim === scored[1]!.sim) return undefined;
  const { place, matched } = scored[0]!;
  return { place, matched };
}

export class GooglePlacesProvider {
  readonly id = 'google_places' as const;
  readonly label = 'Fiches Google (Google Places, via le relais)';
  readonly description = 'Note, nombre d’avis, site et téléphone de la fiche Google. Clé GOOGLE_PLACES_KEY détenue par le relais (voir worker/README.md) ; payant au-delà du quota gratuit de Google.';
  readonly free = false;
  readonly service: RelayService;
  private o: { cache?: KeyValueCache | null; cacheDays?: number };

  constructor(proxyUrl = '', o: { fetchImpl?: FetchLike; cache?: KeyValueCache | null; cacheDays?: number } = {}) {
    this.service = new RelayService(proxyUrl, '/places', { fetchImpl: o.fetchImpl, perSecond: 2 });
    this.o = o;
  }

  get enabled(): boolean {
    return this.service.enabled;
  }

  /** Recherche « nom + code postal + commune » (réponse mise en cache). */
  async search(p: PlaceTarget, signal?: AbortSignal): Promise<GooglePlace[]> {
    const q = [p.tradeName || p.name, p.postalCode, p.city].filter(Boolean).join(' ');
    const key = `places:${normText(q)}`;
    const cached = this.o.cache ? ((await this.o.cache.get(key, this.o.cacheDays ?? 30)) as GooglePlace[] | undefined) : undefined;
    if (cached) return cached;
    const r = await this.service.call<RelayReply & { places?: GooglePlace[] }>({ q }, signal);
    const places = r.places ?? [];
    if (this.o.cache) await this.o.cache.set(key, places);
    return places;
  }

  /** Fiche Google de l'entreprise : correspondance, null (aucune fiche) ou undefined (ambigu). */
  async find(p: PlaceTarget, signal?: AbortSignal): Promise<PlaceMatch | null | undefined> {
    return matchGooglePlace(await this.search(p, signal), p);
  }
}

/** Instance inactive (aucun relais) : affichage dans les paramètres. */
export const googlePlacesProvider = new GooglePlacesProvider();
