/**
 * Référentiel des communes (API Découpage administratif, geo.api.gouv.fr) — gratuit, sans clé.
 * Sert aux filtres par commune, à la recherche par rayon et au positionnement approximatif (centre de la commune)
 * des entreprises sans coordonnées précises, toujours signalé comme « approximation commune ».
 */
import type { Statement } from '../db/types';
import { emptyChunk, type Connector } from './types';

export const GEO_BASE = 'https://geo.api.gouv.fr';

interface GeoCommune {
  nom: string;
  code: string;
  codeDepartement?: string;
  codesPostaux?: string[];
  population?: number;
  centre?: { type: 'Point'; coordinates: [number, number] };
}

export const geoCommunes: Connector = {
  id: 'geo-communes',
  label: 'Référentiel des communes (geo.api.gouv.fr)',
  description: 'Liste officielle des communes des départements suivis, codes postaux, population et centre géographique.',
  official: true,
  requiredSecrets: [],
  defaultEnabled: true,
  provides: ['Communes, codes INSEE et postaux', 'Centre géographique (positionnement approximatif)', 'Population'],
  license: 'Licence Ouverte Etalab 2.0',
  termsUrl: 'https://www.data.gouv.fr/dataservices/api-decoupage-administratif-api-geo/',
  docsUrl: 'https://geo.api.gouv.fr/decoupage-administratif',
  quotas: '50 requêtes par seconde et par adresse IP',
  limitations: ['Le centre de commune n\'est qu\'une approximation de la localisation d\'une entreprise.'],
  async planTasks(ctx) {
    return ctx.departments.map((d) => `dep:${d}`);
  },
  async runChunk(ctx, task) {
    const dep = task.replace(/^dep:/, '').replace(/[^0-9AB]/gi, '');
    const http = ctx.http({ minIntervalMs: 50 });
    const list = await http.json<GeoCommune[]>(`${GEO_BASE}/departements/${dep}/communes?fields=nom,code,codesPostaux,population,centre&format=json`);
    const at = ctx.now().toISOString();
    const existing = (await ctx.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM communes WHERE department = ?', [dep]))?.n ?? 0;
    const stmts: Statement[] = list.map((c) => ({
      sql: `INSERT INTO communes (code_insee, name, department, postal_codes, lat, lon, population, source_id, collected_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'geo-communes', ?)
            ON CONFLICT(code_insee) DO UPDATE SET name = excluded.name, department = excluded.department, postal_codes = excluded.postal_codes,
            lat = excluded.lat, lon = excluded.lon, population = excluded.population, collected_at = excluded.collected_at`,
      params: [c.code, c.nom, dep, (c.codesPostaux ?? []).join(','), c.centre?.coordinates[1] ?? null, c.centre?.coordinates[0] ?? null, c.population ?? null, at],
    }));
    for (let i = 0; i < stmts.length; i += 200) await ctx.db.batch(stmts.slice(i, i + 200));
    // Positionnement approximatif des entreprises sans coordonnées (centre de la commune du siège)
    await ctx.db.run(
      `UPDATE companies SET lat = (SELECT lat FROM communes WHERE code_insee = companies.commune_code), lon = (SELECT lon FROM communes WHERE code_insee = companies.commune_code), geo_precision = 'commune'
       WHERE lat IS NULL AND commune_code IN (SELECT code_insee FROM communes WHERE department = ? AND lat IS NOT NULL)`,
      [dep],
    );
    return { ...emptyChunk(), fetched: list.length, created: Math.max(0, list.length - existing), updated: Math.min(existing, list.length) };
  },
};
