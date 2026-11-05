/**
 * INSEE — API Sirene 3.11 (portail des API de l'INSEE). Clé gratuite obligatoire.
 * Complète la découverte de l'API Recherche d'entreprises : établissements actifs d'un code NAF dans un département,
 * pagination par curseur (pas de plafond de 10 000 résultats), mise à jour quotidienne.
 *
 * Les unités en diffusion partielle (statutDiffusion « P », personnes ayant demandé la non-diffusion) sont ignorées.
 */
import { trackedNafCodes, legalFormLabel } from '../domain/sectors';
import { lambert93ToWgs84 } from '../lib/geo';
import { establishmentStmt, recordSource, upsertCompany } from '../services/companies';
import { emptyChunk, type ChunkResult, type Connector } from './types';

export const SIRENE_BASE = 'https://api.insee.fr/api-sirene/3.11';

export interface SireneEtab {
  siren: string;
  siret: string;
  statutDiffusionEtablissement?: string;
  dateCreationEtablissement?: string | null;
  trancheEffectifsEtablissement?: string | null;
  etablissementSiege?: boolean;
  nombrePeriodesEtablissement?: number;
  uniteLegale?: {
    statutDiffusionUniteLegale?: string;
    etatAdministratifUniteLegale?: string | null;
    dateCreationUniteLegale?: string | null;
    categorieJuridiqueUniteLegale?: string | null;
    denominationUniteLegale?: string | null;
    nomUniteLegale?: string | null;
    prenom1UniteLegale?: string | null;
    sigleUniteLegale?: string | null;
    activitePrincipaleUniteLegale?: string | null;
    trancheEffectifsUniteLegale?: string | null;
    anneeEffectifsUniteLegale?: string | null;
    categorieEntreprise?: string | null;
  };
  adresseEtablissement?: {
    numeroVoieEtablissement?: string | null;
    indiceRepetitionEtablissement?: string | null;
    typeVoieEtablissement?: string | null;
    libelleVoieEtablissement?: string | null;
    codePostalEtablissement?: string | null;
    libelleCommuneEtablissement?: string | null;
    codeCommuneEtablissement?: string | null;
    coordonneeLambertAbscisseEtablissement?: string | null;
    coordonneeLambertOrdonneeEtablissement?: string | null;
  };
  periodesEtablissement?: { dateFin?: string | null; etatAdministratifEtablissement?: string | null; activitePrincipaleEtablissement?: string | null; enseigne1Etablissement?: string | null; denominationUsuelleEtablissement?: string | null }[];
}

interface SireneResponse {
  header: { statut: number; message?: string; total: number; debut: number; nombre: number; curseur?: string; curseurSuivant?: string };
  etablissements: SireneEtab[];
}

const TYPE_VOIE: Record<string, string> = { RUE: 'rue', AV: 'avenue', BD: 'boulevard', PL: 'place', CHE: 'chemin', RTE: 'route', ALL: 'allée', IMP: 'impasse', QUAI: 'quai', ZA: 'ZA', ZI: 'ZI', LD: 'lieu-dit' };

export function sireneAddress(a: SireneEtab['adresseEtablissement']): string | null {
  if (!a) return null;
  const voie = [a.numeroVoieEtablissement, a.indiceRepetitionEtablissement, a.typeVoieEtablissement ? (TYPE_VOIE[a.typeVoieEtablissement] ?? a.typeVoieEtablissement) : null, a.libelleVoieEtablissement].filter(Boolean).join(' ');
  return [voie, [a.codePostalEtablissement, a.libelleCommuneEtablissement].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null;
}

export function sireneCoords(a: SireneEtab['adresseEtablissement']): { lat: number; lon: number } | null {
  const x = Number(a?.coordonneeLambertAbscisseEtablissement);
  const y = Number(a?.coordonneeLambertOrdonneeEtablissement);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x <= 0 || y <= 0) return null;
  return lambert93ToWgs84(x, y);
}

export async function ingestSirene(db: Parameters<typeof upsertCompany>[0], e: SireneEtab, at: string): Promise<{ created: boolean; updated: boolean } | null> {
  const u = e.uniteLegale ?? {};
  if (e.statutDiffusionEtablissement === 'P' || u.statutDiffusionUniteLegale === 'P') return null;
  const current = e.periodesEtablissement?.find((p) => !p.dateFin) ?? e.periodesEtablissement?.[0];
  const coords = sireneCoords(e.adresseEtablissement);
  const name = u.denominationUniteLegale || [u.prenom1UniteLegale, u.nomUniteLegale].filter(Boolean).join(' ') || undefined;
  const url = `https://annuaire-entreprises.data.gouv.fr/etablissement/${e.siret}`;
  const isSiege = !!e.etablissementSiege;
  const a = e.adresseEtablissement ?? {};
  const res = await upsertCompany(
    db,
    {
      siren: e.siren,
      name,
      acronym: u.sigleUniteLegale ?? undefined,
      legal_form_code: u.categorieJuridiqueUniteLegale ?? undefined,
      legal_form_label: legalFormLabel(u.categorieJuridiqueUniteLegale) ?? undefined,
      naf_code: u.activitePrincipaleUniteLegale ?? undefined,
      creation_date: u.dateCreationUniteLegale ?? undefined,
      admin_status: u.etatAdministratifUniteLegale ?? undefined,
      is_individual: u.categorieJuridiqueUniteLegale ? (u.categorieJuridiqueUniteLegale === '1000' ? 1 : 0) : undefined,
      category: u.categorieEntreprise ?? undefined,
      headcount_band: u.trancheEffectifsUniteLegale ?? undefined,
      headcount_year: u.anneeEffectifsUniteLegale ?? undefined,
      ...(isSiege
        ? {
            siege_siret: e.siret,
            address: sireneAddress(a) ?? undefined,
            postal_code: a.codePostalEtablissement ?? undefined,
            commune_code: a.codeCommuneEtablissement ?? undefined,
            commune_name: a.libelleCommuneEtablissement ?? undefined,
            lat: coords?.lat,
            lon: coords?.lon,
            geo_precision: coords ? 'adresse' : undefined,
            trade_name: current?.enseigne1Etablissement || current?.denominationUsuelleEtablissement || undefined,
          }
        : {}),
    },
    { sourceId: 'insee-sirene', status: 'officielle', confidence: 90, collectedAt: at, url, identityCheck: true },
  );
  if (!res) return null;
  await db.batch([
    establishmentStmt(
      res.id,
      {
        siret: e.siret,
        is_siege: isSiege ? 1 : 0,
        name: current?.enseigne1Etablissement || current?.denominationUsuelleEtablissement || null,
        address: sireneAddress(a),
        postal_code: a.codePostalEtablissement ?? null,
        commune_code: a.codeCommuneEtablissement ?? null,
        commune_name: a.libelleCommuneEtablissement ?? null,
        naf_code: current?.activitePrincipaleEtablissement ?? null,
        admin_status: current?.etatAdministratifEtablissement ?? null,
        creation_date: e.dateCreationEtablissement ?? null,
        headcount_band: e.trancheEffectifsEtablissement ?? null,
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
      },
      'insee-sirene',
      at,
    ),
  ]);
  await recordSource(db, { sourceId: 'insee-sirene', externalId: e.siret, entityType: 'establishment', companyId: res.id, siren: e.siren, url, payload: e });
  return { created: res.created, updated: res.changed.length > 0 };
}

export const inseeSirene: Connector = {
  id: 'insee-sirene',
  label: 'INSEE — API Sirene',
  description: "Répertoire officiel des entreprises et établissements. Complète la découverte (pas de plafond de résultats, coordonnées des établissements).",
  official: true,
  requiredSecrets: ['INSEE_API_KEY'],
  defaultEnabled: false,
  provides: ['Unités légales et établissements actifs', 'Adresses et coordonnées (Lambert 93 converties)', 'Effectifs, enseignes, historique d\'activité'],
  license: 'Licence Ouverte Etalab 2.0 — respect obligatoire du statut de diffusion des personnes physiques',
  termsUrl: 'https://portail-api.insee.fr/',
  docsUrl: 'https://portail-api.insee.fr/catalog/api/2ba0e549-5587-3ef1-9082-99cd865de66f/doc',
  quotas: '30 requêtes par minute ; 1 000 résultats par page (pagination par curseur)',
  keyProcedure:
    "1. Créer un compte sur https://portail-api.insee.fr/ ; 2. Créer une application (mode « simple ») ; 3. Souscrire à l'API Sirene (plan public, gratuit) ; 4. Copier la clé d'API et la définir comme secret INSEE_API_KEY (npx wrangler secret put INSEE_API_KEY, ou .env en local).",
  limitations: ['Pas de données financières.', 'Les personnes physiques en diffusion partielle sont ignorées.'],
  async planTasks(ctx) {
    const codes = trackedNafCodes();
    return ctx.departments.flatMap((d) => codes.map((c) => `naf:${c}:${d}`));
  },
  async runChunk(ctx, task, cursor): Promise<ChunkResult> {
    const m = task.match(/^naf:(\d{2}\.\d{2}[A-Z]):(\w{2,3})$/);
    if (!m) return { ...emptyChunk(), errors: [`Tâche inconnue : ${task}`] };
    const [, naf, dep] = m;
    const http = ctx.http({ minIntervalMs: 2100 }); // 30 requêtes / minute
    const curseur = (cursor as { curseur?: string } | null)?.curseur ?? '*';
    const q = `codeCommuneEtablissement:${dep}* AND periode(activitePrincipaleEtablissement:${naf} AND etatAdministratifEtablissement:A)`;
    const url = `${SIRENE_BASE}/siret?q=${encodeURIComponent(q)}&nombre=1000&curseur=${encodeURIComponent(curseur)}`;
    const res = await http.request(url, { headers: { 'X-INSEE-Api-Key-Integration': ctx.secrets.INSEE_API_KEY ?? '' } });
    if (res.status === 404) return { ...emptyChunk() }; // aucun établissement pour ce code
    if (!res.ok) throw new Error(`INSEE : HTTP ${res.status}${res.status === 401 || res.status === 403 ? ' (clé INSEE_API_KEY invalide ou non souscrite à l\'API Sirene)' : ''}`);
    const data = (await res.json()) as SireneResponse;
    const at = ctx.now().toISOString();
    const out: ChunkResult = { ...emptyChunk(null, false), fetched: data.etablissements.length };
    for (const e of data.etablissements) {
      try {
        const r = await ingestSirene(ctx.db, e, at);
        if (r?.created) out.created++;
        else if (r?.updated) out.updated++;
      } catch (err) {
        out.errors.push(`SIRET ${e.siret} : ${(err as Error).message}`);
      }
    }
    const next = data.header.curseurSuivant;
    out.done = !next || next === data.header.curseur || data.etablissements.length === 0;
    out.cursor = out.done ? null : { curseur: next };
    return out;
  },
};
