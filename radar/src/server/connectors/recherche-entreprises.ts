/**
 * API Recherche d'entreprises (DINUM / annuaire-entreprises.data.gouv.fr) — gratuite, sans clé.
 * Agrège SIRENE (INSEE), RNE (INPI) et les comptes annuels publiés (chiffre d'affaires, résultat net).
 *
 * Tâches :
 *  - naf:<code>:<département>  découverte des entreprises actives d'un code NAF dans un département (25 par page)
 *  - enrich                    vérification / mise à jour de l'identité des entreprises connues par un autre canal
 *                              (ex. BODACC) ou dont l'identité date de plus de N jours
 *
 * Protection des données : l'année et la date de naissance des dirigeants, fournies par l'API, ne sont PAS conservées
 * (aucune déduction d'âge n'est faite par l'outil).
 */
import { trackedNafCodes } from '../domain/sectors';
import { legalFormLabel } from '../domain/sectors';
import type { SqlValue, Statement } from '../db/types';
import { directorsStmts, establishmentStmt, financialStmt, recordSource, upsertCompany, type DirectorInput, type Provenance } from '../services/companies';
import { emptyChunk, type ChunkResult, type Connector, type ConnectorContext } from './types';

export const RE_BASE = 'https://recherche-entreprises.api.gouv.fr';
const PER_PAGE = 25;
const MAX_PAGES = 400; // l'API plafonne à 10 000 résultats par requête

interface ReEtab {
  siret: string;
  adresse?: string | null;
  code_postal?: string | null;
  commune?: string | null;
  libelle_commune?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  est_siege?: boolean;
  etat_administratif?: string | null;
  activite_principale?: string | null;
  date_creation?: string | null;
  tranche_effectif_salarie?: string | null;
  liste_enseignes?: string[] | null;
  nom_commercial?: string | null;
}

export interface ReResult {
  siren: string;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  sigle?: string | null;
  activite_principale?: string | null;
  categorie_entreprise?: string | null;
  date_creation?: string | null;
  etat_administratif?: string | null;
  nature_juridique?: string | null;
  tranche_effectif_salarie?: string | null;
  annee_tranche_effectif_salarie?: string | null;
  nombre_etablissements?: number | null;
  nombre_etablissements_ouverts?: number | null;
  siege?: ReEtab | null;
  matching_etablissements?: ReEtab[] | null;
  dirigeants?: { type_dirigeant?: string; nom?: string | null; prenoms?: string | null; qualite?: string | null; siren?: string | null; denomination?: string | null }[] | null;
  finances?: Record<string, { ca?: number | null; resultat_net?: number | null }> | null;
  complements?: { est_entrepreneur_individuel?: boolean | null } | null;
}

interface ReResponse {
  results: ReResult[];
  total_results: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const toNum = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** Enregistre un résultat de l'API (entreprise, siège, établissements du périmètre, dirigeants, finances). */
export async function ingestReResult(ctx: Pick<ConnectorContext, 'db' | 'departments'>, r: ReResult, at: string, sourceId = 'recherche-entreprises'): Promise<{ created: boolean; updated: boolean } | null> {
  const s = r.siege ?? null;
  const lat = toNum(s?.latitude);
  const lon = toNum(s?.longitude);
  const url = `https://annuaire-entreprises.data.gouv.fr/entreprise/${r.siren}`;
  const prov: Provenance = { sourceId, status: 'officielle', confidence: 85, collectedAt: at, url, identityCheck: true };
  const enseigne = s?.nom_commercial || s?.liste_enseignes?.[0] || null;
  const res = await upsertCompany(
    ctx.db,
    {
      siren: r.siren,
      name: r.nom_raison_sociale || r.nom_complet || undefined,
      trade_name: enseigne ?? undefined,
      acronym: r.sigle ?? undefined,
      legal_form_code: r.nature_juridique ?? undefined,
      legal_form_label: legalFormLabel(r.nature_juridique) ?? undefined,
      naf_code: r.activite_principale ?? undefined,
      creation_date: r.date_creation ?? undefined,
      admin_status: r.etat_administratif ?? undefined,
      is_individual: r.complements?.est_entrepreneur_individuel === undefined || r.complements?.est_entrepreneur_individuel === null ? undefined : r.complements.est_entrepreneur_individuel ? 1 : 0,
      category: r.categorie_entreprise ?? undefined,
      headcount_band: r.tranche_effectif_salarie ?? undefined,
      headcount_year: r.annee_tranche_effectif_salarie ?? undefined,
      siege_siret: s?.siret ?? undefined,
      address: s?.adresse ?? undefined,
      postal_code: s?.code_postal ?? undefined,
      commune_code: s?.commune ?? undefined,
      commune_name: s?.libelle_commune ?? undefined,
      lat: lat ?? undefined,
      lon: lon ?? undefined,
      geo_precision: lat !== null && lon !== null ? 'adresse' : undefined,
      establishments_count: r.nombre_etablissements ?? undefined,
      open_establishments_count: r.nombre_etablissements_ouverts ?? undefined,
    },
    prov,
  );
  if (!res) return null;
  const stmts: Statement[] = [];
  const etabs = new Map<string, ReEtab & { est_siege?: boolean }>();
  if (s?.siret) etabs.set(s.siret, { ...s, est_siege: true });
  for (const e of r.matching_etablissements ?? []) {
    if (!e.siret) continue;
    const dep = (e.code_postal ?? '').slice(0, 2);
    if (e.est_siege || ctx.departments.includes(dep)) etabs.set(e.siret, { ...etabs.get(e.siret), ...e });
  }
  for (const e of etabs.values()) {
    stmts.push(
      establishmentStmt(
        res.id,
        {
          siret: e.siret,
          is_siege: e.est_siege ? 1 : 0,
          name: e.nom_commercial || e.liste_enseignes?.[0] || null,
          address: e.adresse ?? null,
          postal_code: e.code_postal ?? null,
          commune_code: e.commune ?? null,
          commune_name: e.libelle_commune ?? null,
          naf_code: e.activite_principale ?? null,
          admin_status: e.etat_administratif ?? null,
          creation_date: e.date_creation ?? null,
          headcount_band: e.tranche_effectif_salarie ?? null,
          lat: toNum(e.latitude),
          lon: toNum(e.longitude),
        },
        sourceId,
        at,
      ),
      { sql: 'INSERT OR IGNORE INTO company_identifiers (company_id, type, value, source_id, collected_at) VALUES (?, ?, ?, ?, ?)', params: [res.id, 'siret', e.siret, sourceId, at] },
    );
  }
  if (r.dirigeants) {
    const list: DirectorInput[] = r.dirigeants
      .map((d): DirectorInput | null =>
        d.type_dirigeant === 'personne morale'
          ? d.denomination
            ? { kind: 'personne_morale', name: d.denomination, role: d.qualite ?? null, directorSiren: d.siren ?? null }
            : null
          : d.nom
            ? { kind: 'personne_physique', name: d.nom, firstNames: d.prenoms ?? null, role: d.qualite ?? null }
            : null,
      )
      .filter((d): d is DirectorInput => d !== null);
    stmts.push(...directorsStmts(res.id, list, sourceId, at));
  }
  for (const [year, f] of Object.entries(r.finances ?? {})) {
    const fy = Number(year);
    if (!Number.isInteger(fy)) continue;
    stmts.push(financialStmt(res.id, { fiscalYear: fy, revenue: toNum(f.ca), netIncome: toNum(f.resultat_net) }, { ...prov, url: `${url}#finances`, confidence: 80 }));
  }
  if (stmts.length) {
    stmts.push({ sql: 'INSERT OR IGNORE INTO analysis_queue (company_id, queued_at) VALUES (?, ?)', params: [res.id, at] as SqlValue[] });
    await ctx.db.batch(stmts);
  }
  await recordSource(ctx.db, { sourceId, externalId: r.siren, entityType: 'company', companyId: res.id, siren: r.siren, url, payload: { ...r, dirigeants: undefined } });
  return { created: res.created, updated: !res.created && res.changed.length > 0 };
}

export const rechercheEntreprises: Connector = {
  id: 'recherche-entreprises',
  label: "API Recherche d'entreprises (SIRENE + RNE)",
  description: "Annuaire officiel des entreprises : identité, établissements, effectifs, dirigeants, chiffre d'affaires et résultat publiés. Source principale de découverte, sans clé.",
  official: true,
  requiredSecrets: [],
  defaultEnabled: true,
  provides: ['Identité (SIREN, SIRET, NAF, forme juridique, création)', 'Établissements et géolocalisation (Base Adresse Nationale)', 'Tranche d\'effectif', 'Dirigeants (nom, qualité)', "Chiffre d'affaires et résultat net publiés"],
  license: 'Licence Ouverte Etalab 2.0 (données SIRENE / RNE) — réutilisation libre avec mention de la source',
  termsUrl: 'https://www.data.gouv.fr/dataservices/api-recherche-dentreprises/',
  docsUrl: 'https://recherche-entreprises.api.gouv.fr/docs/',
  quotas: '7 requêtes par seconde ; 25 résultats par page ; 10 000 résultats maximum par recherche',
  limitations: [
    "Seules les données des entreprises en diffusion publique sont renvoyées (les personnes ayant demandé la non-diffusion sont exclues).",
    "Les finances se limitent au chiffre d'affaires et au résultat net des comptes publiés (pas de comptes confidentiels).",
    'Recherche plafonnée à 10 000 résultats : les codes NAF très fournis sont découpés par département.',
  ],
  async planTasks(ctx) {
    const enabled = new Set((await ctx.db.all<{ id: string }>('SELECT id FROM sectors WHERE enabled = 1')).map((r) => r.id));
    const extra = (await ctx.db.all<{ naf_codes: string }>('SELECT naf_codes FROM sectors WHERE enabled = 1')).flatMap((r) => r.naf_codes.split(',').map((x) => x.trim()).filter(Boolean));
    const codes = [...new Set([...trackedNafCodes(enabled.size ? enabled : undefined), ...extra])].sort();
    return [...ctx.departments.flatMap((d) => codes.map((c) => `naf:${c}:${d}`)), 'enrich'];
  },
  async runChunk(ctx, task, cursor): Promise<ChunkResult> {
    const http = ctx.http({ minIntervalMs: 160 });
    const at = ctx.now().toISOString();
    if (task === 'enrich') {
      const days = ctx.settings.sync.identityRefreshDays;
      const limit = ctx.settings.sync.enrichPerTick;
      const lastId = (cursor as { lastId?: number } | null)?.lastId ?? 0;
      const rows = await ctx.db.all<{ id: number; siren: string }>(
        `SELECT id, siren FROM companies WHERE id > ? AND (identity_checked_at IS NULL OR identity_checked_at < ?) ORDER BY id LIMIT ?`,
        [lastId, new Date(ctx.now().getTime() - days * 86400_000).toISOString(), limit],
      );
      const out: ChunkResult = { ...emptyChunk({ lastId }, rows.length < limit), fetched: 0 };
      for (const row of rows) {
        out.cursor = { lastId: row.id };
        try {
          const data = await http.json<ReResponse>(`${RE_BASE}/search?q=${row.siren}&per_page=1&page=1`);
          out.fetched++;
          const hit = data.results.find((x) => x.siren === row.siren);
          if (!hit) {
            out.errors.push(`SIREN ${row.siren} introuvable dans l'annuaire (non diffusible ou radié)`);
            await ctx.db.run('UPDATE companies SET identity_checked_at = ? WHERE id = ?', [at, row.id]);
            continue;
          }
          const r = await ingestReResult(ctx, hit, at);
          if (r?.updated) out.updated++;
        } catch (e) {
          if ((e as Error).name === 'BudgetExhausted') {
            out.cursor = { lastId: rows[rows.indexOf(row) - 1]?.id ?? lastId };
            out.done = false;
            return out; // reprise à cette entreprise à la prochaine étape
          }
          out.errors.push(`SIREN ${row.siren} : ${(e as Error).message}`);
        }
      }
      return out;
    }
    const m = task.match(/^naf:(\d{2}\.\d{2}[A-Z]):(\w{2,3})$/);
    if (!m) return { ...emptyChunk(), errors: [`Tâche inconnue : ${task}`] };
    const [, naf, dep] = m;
    let page = (cursor as { page?: number } | null)?.page ?? 1;
    const out: ChunkResult = { ...emptyChunk({ page }, false) };
    for (let i = 0; i < 4; i++) {
      const url = `${RE_BASE}/search?activite_principale=${encodeURIComponent(naf!)}&departement=${dep}&etat_administratif=A&per_page=${PER_PAGE}&page=${page}`;
      let data: ReResponse;
      try {
        data = await http.json<ReResponse>(url);
      } catch (e) {
        if ((e as Error).name === 'BudgetExhausted' && i > 0) return out; // progression conservée (curseur = page suivante)
        throw e;
      }
      out.fetched += data.results.length;
      for (const r of data.results) {
        try {
          const res = await ingestReResult(ctx, r, at);
          if (res?.created) out.created++;
          else if (res?.updated) out.updated++;
        } catch (e) {
          out.errors.push(`SIREN ${r.siren} : ${(e as Error).message}`);
        }
      }
      const last = page >= Math.min(data.total_pages || 0, MAX_PAGES) || data.results.length === 0;
      if (data.total_results > MAX_PAGES * PER_PAGE && page === 1) out.errors.push(`${data.total_results} résultats pour ${naf} (${dep}) : seuls les 10 000 premiers sont accessibles par cette API.`);
      page++;
      out.cursor = { page };
      if (last) {
        out.done = true;
        break;
      }
    }
    return out;
  },
};
