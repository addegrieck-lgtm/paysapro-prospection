// OpenStreetMapProvider (PublicDirectoryProvider) : annuaire public ouvert, gratuit, sans clé.
//
// Source : OpenStreetMap via l'API Overpass (données © les contributeurs OpenStreetMap, licence ODbL —
// attribution obligatoire, affichée dans l'application). Mesuré le 29/09/2026 : ~1 180 entreprises du paysage
// en France, dont ~520 avec un téléphone, ~425 avec un site et ~320 avec un SIRET.
//
// Fonctionnement économe et robuste :
//   1. cache local (30 jours) ;
//   2. instantané livré avec l'application (public/data/osm-paysagistes.json, « npm run osm:update ») ;
//   3. en dernier recours, UNE requête Overpass pour toute la France (serveur souvent saturé : en cas d'échec,
//      la source est mise en pause 15 minutes pour ne jamais bloquer la file d'enrichissement).
// Puis rapprochement LOCAL avec chaque prospect (aucune requête par entreprise). Rapprochement :
//   SIRET (ou SIREN) identique → sûr ;
//   sinon nom très proche ET (même code postal, même ville ou < 3 km) → probable ;
//   plusieurs correspondances équivalentes → rien n'est attribué (jamais de devinette).
import type { KeyValueCache } from '../../data/cache';
import type { Prospect } from '../../domain/types';
import { fetchJson, ProviderError, RateLimiter, type FetchLike } from '../http';

const DEFAULT_SNAPSHOT = `${import.meta.env?.BASE_URL ?? './'}data/osm-paysagistes.json`;

export interface OsmOptions {
  fetchImpl?: FetchLike;
  cache?: KeyValueCache | null;
  cacheDays?: number;
  limiter?: RateLimiter;
  url?: string;
  /** Instantané livré avec l'application ; null = désactivé */
  snapshotUrl?: string | null;
}
import { nameSimilarity } from './RechercheEntreprisesProvider';
import { normPostalCode, normSiret, normText } from '../../domain/normalize';
import { toE164 } from '../../domain/phone';

export const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
export const OSM_ATTRIBUTION = '© les contributeurs OpenStreetMap (ODbL)';

/** Requête : artisans paysagistes / jardiniers et entreprises dont le nom évoque le paysage, en France. */
export const OVERPASS_QUERY = `[out:json][timeout:180];
area["ISO3166-1"="FR"][admin_level=2]->.fr;
(
  nwr["craft"~"^(gardener|landscaper)$"](area.fr);
  nwr["name"~"paysag|espaces? verts",i]["craft"](area.fr);
  nwr["name"~"paysag|espaces? verts",i]["office"](area.fr);
  nwr["name"~"paysag|espaces? verts",i]["shop"](area.fr);
);
out tags center;`;

export interface OsmPlace {
  id: string;
  url: string;
  name: string;
  normName: string;
  phones: string[];
  email: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  siret: string | null;
  postcode: string | null;
  city: string | null;
  street: string | null;
  lat: number | null;
  lon: number | null;
}

export interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpass(data: { elements?: OverpassElement[] }): OsmPlace[] {
  return (data.elements ?? [])
    .filter((e) => e.tags?.name)
    .map((e) => {
      const t = e.tags!;
      const phones = [t.phone, t['contact:phone'], t['contact:mobile'], t.mobile]
        .filter(Boolean)
        .flatMap((v) => v!.split(/[;,]/))
        .map((v) => v.trim())
        .filter((v) => !!toE164(v));
      return {
        id: `${e.type}/${e.id}`,
        url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
        name: t.name!,
        normName: normText(t.name),
        phones: Array.from(new Set(phones)),
        email: t.email ?? t['contact:email'] ?? null,
        website: t.website ?? t['contact:website'] ?? t.url ?? null,
        facebook: t['contact:facebook'] ?? null,
        instagram: t['contact:instagram'] ?? null,
        siret: normSiret(t['ref:FR:SIRET']),
        postcode: normPostalCode(t['addr:postcode']),
        city: t['addr:city'] ?? null,
        street: [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ') || null,
        lat: e.lat ?? e.center?.lat ?? null,
        lon: e.lon ?? e.center?.lon ?? null,
      };
    });
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export interface OsmMatch {
  place: OsmPlace;
  /** Éléments concordants (siret, siren, name, city, postalCode, address) */
  matched: string[];
  sure: boolean;
}

type Target = Pick<Prospect, 'name' | 'tradeName' | 'siret' | 'siren' | 'postalCode' | 'city' | 'address' | 'latitude' | 'longitude'>;

/** Rapprochement d'un prospect avec les lieux OpenStreetMap (fonction pure). */
export function matchPlace(places: OsmPlace[], p: Target): OsmMatch | null {
  const bySiret = p.siret ? places.filter((x) => x.siret === p.siret) : [];
  const bySiren = !bySiret.length && p.siren ? places.filter((x) => x.siret?.startsWith(p.siren!)) : [];
  const describe = (x: OsmPlace, base: string[]): string[] => {
    const m = [...base];
    const sim = Math.max(nameSimilarity(x.name, p.name), p.tradeName ? nameSimilarity(x.name, p.tradeName) : 0);
    if (sim >= 0.75) m.push('name');
    if (x.postcode && x.postcode === p.postalCode) m.push('postalCode');
    if (x.city && p.city && normText(x.city) === normText(p.city)) m.push('city');
    if (x.street && p.address && normText(p.address).includes(normText(x.street))) m.push('address');
    return m;
  };
  if (bySiret.length === 1) return { place: bySiret[0]!, matched: describe(bySiret[0]!, ['siret']), sure: true };
  if (bySiren.length === 1) return { place: bySiren[0]!, matched: describe(bySiren[0]!, ['siren']), sure: true };
  const scored = places
    .map((x) => {
      const sim = Math.max(nameSimilarity(x.name, p.name), p.tradeName ? nameSimilarity(x.name, p.tradeName) : 0);
      if (sim < 0.75) return null;
      // Deux SIRET connus et différents : entreprises distinctes
      if (x.siret && p.siret && x.siret.slice(0, 9) !== p.siret.slice(0, 9)) return null;
      const near = x.lat !== null && x.lon !== null && p.latitude !== null && p.longitude !== null && distanceKm({ lat: x.lat, lon: x.lon }, { lat: p.latitude, lon: p.longitude }) <= 3;
      const samePlace = (x.postcode && x.postcode === p.postalCode) || (x.city && p.city && normText(x.city) === normText(p.city)) || near;
      if (!samePlace) return null;
      return { x, sim, near };
    })
    .filter((v): v is { x: OsmPlace; sim: number; near: boolean } => !!v)
    .sort((a, b) => b.sim - a.sim);
  if (!scored.length) return null;
  if (scored.length > 1 && scored[0]!.sim === scored[1]!.sim) return null; // ambigu : on n'attribue rien
  const best = scored[0]!;
  const matched = describe(best.x, []);
  if (best.near && !matched.includes('city') && !matched.includes('postalCode')) matched.push('city');
  return { place: best.x, matched, sure: false };
}

export class OpenStreetMapProvider {
  readonly id = 'openstreetmap';
  readonly label = 'OpenStreetMap (annuaire public ouvert)';
  readonly free = true;
  private places: OsmPlace[] | null = null;
  private loading: Promise<OsmPlace[]> | null = null;
  private o: OsmOptions;
  /** Source indisponible jusqu'à cette date (échec du serveur Overpass) */
  private unavailableUntil = 0;
  loadedFrom: 'cache' | 'snapshot' | 'overpass' | null = null;

  constructor(o: OsmOptions = {}) {
    this.o = o;
  }

  get available(): boolean {
    return Date.now() >= this.unavailableUntil;
  }

  /** Charge (une fois, puis cache) les lieux OpenStreetMap du paysage en France. */
  async load(signal?: AbortSignal, force = false): Promise<OsmPlace[]> {
    if (this.places && !force) return this.places;
    if (!this.loading || force) {
      this.loading = (async () => {
        const key = 'osm:landscapers:fr';
        const cached = !force && this.o.cache ? ((await this.o.cache.get(key, this.o.cacheDays ?? 30)) as OsmPlace[] | undefined) : undefined;
        if (cached) {
          this.loadedFrom = 'cache';
          return cached;
        }
        const save = async (places: OsmPlace[]) => {
          if (this.o.cache) await this.o.cache.set(key, places);
          return places;
        };
        // Instantané livré avec l'application (même origine : rapide, disponible hors-ligne)
        if (this.o.snapshotUrl !== null && !force) {
          const snapshot = await fetchJson<{ elements?: OverpassElement[] }>(this.o.snapshotUrl ?? DEFAULT_SNAPSHOT, {
            fetchImpl: this.o.fetchImpl,
            limiter: new RateLimiter(0),
            retries: 0,
            timeoutMs: 20_000,
            signal,
          }).catch(() => null);
          if (snapshot?.elements?.length) {
            this.loadedFrom = 'snapshot';
            return save(parseOverpass(snapshot));
          }
        }
        if (!this.available) throw new ProviderError('unavailable', 'Overpass en pause après un échec');
        try {
          const url = `${this.o.url ?? OVERPASS_URL}?data=${encodeURIComponent(OVERPASS_QUERY)}`;
          const data = await fetchJson<{ elements?: OverpassElement[] }>(url, {
            fetchImpl: this.o.fetchImpl,
            limiter: this.o.limiter ?? new RateLimiter(0.2),
            timeoutMs: 30_000,
            retries: 0,
            signal,
          });
          this.loadedFrom = 'overpass';
          return save(parseOverpass(data ?? {}));
        } catch (e) {
          if (!(e instanceof ProviderError && e.kind === 'aborted')) this.unavailableUntil = Date.now() + 15 * 60_000;
          throw e;
        }
      })();
    }
    try {
      this.places = await this.loading;
      return this.places;
    } finally {
      this.loading = null;
    }
  }

  async match(p: Target, signal?: AbortSignal): Promise<OsmMatch | null> {
    if (!this.places && !this.available) return null; // source en pause : on n'attend pas
    return matchPlace(await this.load(signal), p);
  }
}
