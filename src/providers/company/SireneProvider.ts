// SireneProvider : import massif des paysagistes depuis les données SIRENE, gratuitement.
//
// S'appuie sur RechercheEntreprisesProvider (même API publique, même limiteur de débit).
// Découpage par département ou par code postal (plafond de 10 000 résultats par requête), pages de 25,
// réponses mises en cache 7 jours : un import interrompu reprend sans tout re-télécharger.
// Filtres : NAF, département / région (→ départements), code postal, commune, actives uniquement,
// sièges uniquement, tranche d'effectif minimale, date de création, exclusion des entrepreneurs individuels.
import type { ProspectInput } from '../../domain/prospect';
import type { DB } from '../../data/db';
import { dbCache } from '../../data/cache';
import { RateLimiter, type FetchLike } from '../http';
import { HEADCOUNT_BANDS } from '../../domain/referentials';
import { normText } from '../../domain/normalize';
import { RechercheEntreprisesProvider, companyToInput, toCompany, type ApiSearchResponse, type ApiUniteLegale } from './RechercheEntreprisesProvider';

export type { ApiSearchResponse as SireneSearchResponse, ApiUniteLegale as SireneUniteLegale };

export interface SireneMapOptions {
  /** Département attendu (établissements situés ailleurs ignorés) */
  department?: string;
  postalCode?: string;
  commune?: string;
  nafCodes: string[];
  excludeIndividuals: boolean;
  /** Défaut : true */
  activeOnly?: boolean;
  headOfficeOnly?: boolean;
  /** Tranche d'effectif INSEE minimale (« 01 » = au moins 1 salarié) */
  minHeadcountBand?: string | null;
  createdAfter?: string | null;
  createdBefore?: string | null;
}

/** Convertit une entreprise de l'API en fiches prospect (un établissement retenu = une fiche). Fonction pure. */
export function sireneToInputs(u: ApiUniteLegale, o: SireneMapOptions): ProspectInput[] {
  const c = toCompany(u);
  if (!c.diffusible) return []; // diffusion partielle : on respecte le choix de la personne
  if (o.excludeIndividuals && c.individual) return [];
  const minBand = o.minHeadcountBand ? (HEADCOUNT_BANDS[o.minHeadcountBand]?.[1] ?? 0) : null;
  const commune = o.commune ? normText(o.commune) : null;
  const candidates = c.matching.length ? c.matching : c.headOffice ? [c.headOffice] : [];
  const seen = new Set<string>();
  return candidates
    .filter((e) => {
      if (seen.has(e.siret)) return false;
      seen.add(e.siret);
      if (!e.diffusible || !o.nafCodes.includes(e.nafCode ?? '')) return false;
      if ((o.activeOnly ?? true) && !e.active) return false;
      if (o.department && e.department !== o.department) return false;
      if (o.postalCode && e.postalCode !== o.postalCode) return false;
      if (commune && !normText(e.city).includes(commune)) return false;
      if (o.headOfficeOnly && !e.isHeadOffice) return false;
      if (minBand !== null) {
        const b = e.headcountBand ?? c.headcountBand;
        if (!b || (HEADCOUNT_BANDS[b]?.[1] ?? -1) < minBand) return false;
      }
      const created = e.creationDate ?? c.creationDate;
      if (o.createdAfter && (!created || created < o.createdAfter)) return false;
      if (o.createdBefore && (!created || created > o.createdBefore)) return false;
      return true;
    })
    .map((e) => companyToInput(c, e));
}

export interface SireneRunOptions extends Omit<SireneMapOptions, 'department' | 'postalCode'> {
  departments: string[];
  /** Si renseigné : recherche par code postal (plus précis) au lieu des départements */
  postalCodes?: string[];
  cacheDays?: number;
  signal?: AbortSignal;
  onProgress?: (p: { department: string; deptIndex: number; deptTotal: number; page: number; pages: number; found: number }) => void;
  /** Reçoit les fiches au fil de l'eau (import par lots) */
  onBatch: (inputs: ProspectInput[], scope: string) => Promise<void>;
}

export class SireneProvider {
  readonly id = 'sirene' as const;
  readonly label = 'SIRENE (INSEE) — import officiel';
  readonly description = 'Entreprises du code NAF ciblé, par département, région ou code postal. Gratuit, sans clé. Pas de téléphone ni d’e-mail dans SIRENE.';
  readonly enabled = true;
  readonly free = true;
  readonly api: RechercheEntreprisesProvider;
  private db: DB | null;

  constructor(opts: { fetchImpl?: FetchLike; db?: DB | null; minDelayMs?: number; wait?: (ms: number) => Promise<void> } = {}) {
    this.db = opts.db ?? null;
    this.api = new RechercheEntreprisesProvider({
      fetchImpl: opts.fetchImpl,
      cache: this.db ? dbCache(this.db, 'data_cache') : null,
      cacheDays: 7,
      limiter: opts.minDelayMs !== undefined ? new RateLimiter(opts.minDelayMs > 0 ? 1000 / opts.minDelayMs : 0) : undefined,
      wait: opts.wait,
    });
  }

  searchUrl(scope: { department?: string; postalCode?: string }, naf: string, page: number, activeOnly = true): string {
    return this.api.buildUrl({
      activite_principale: naf,
      departement: scope.postalCode ? undefined : scope.department,
      code_postal: scope.postalCode,
      etat_administratif: activeOnly ? 'A' : undefined,
      per_page: '25',
      page: String(page),
    });
  }

  async fetchPage(url: string, cacheDays: number, signal?: AbortSignal): Promise<ApiSearchResponse> {
    const { data } = await this.api.raw(url, { signal, maxAgeDays: cacheDays });
    return data ?? { results: [], total_results: 0, page: 1, per_page: 25, total_pages: 0 };
  }

  /** Parcourt les zones demandées et transmet les fiches par lots. Retourne le nombre de fiches trouvées. */
  async run(o: SireneRunOptions): Promise<number> {
    let found = 0;
    const scopes = o.postalCodes?.length ? o.postalCodes.map((postalCode) => ({ postalCode, label: postalCode })) : o.departments.map((department) => ({ department, label: department }));
    for (const [i, scope] of scopes.entries()) {
      for (const naf of o.nafCodes) {
        let page = 1;
        let pages: number;
        do {
          if (o.signal?.aborted) return found;
          const data = await this.fetchPage(this.searchUrl(scope, naf, page, o.activeOnly ?? true), o.cacheDays ?? 7, o.signal);
          pages = Math.min(data.total_pages || 1, 400); // 400 × 25 = 10 000 (plafond de l'API)
          const inputs = data.results.flatMap((u) => sireneToInputs(u, { ...o, department: 'department' in scope ? scope.department : undefined, postalCode: 'postalCode' in scope ? scope.postalCode : undefined }));
          found += inputs.length;
          if (inputs.length) await o.onBatch(inputs, scope.label);
          o.onProgress?.({ department: scope.label, deptIndex: i, deptTotal: scopes.length, page, pages, found });
          page++;
        } while (page <= pages);
      }
      if (this.db && 'department' in scope && scope.department) await this.db.put('data_cache', { key: `sirene-dept:${scope.department}`, data: { nafCodes: o.nafCodes }, fetchedAt: new Date().toISOString() });
    }
    return found;
  }

  /** Date du dernier import complet par département (pour l'affichage « déjà importé »). */
  async lastImports(): Promise<Record<string, string>> {
    if (!this.db) return {};
    const all = await this.db.getAll('data_cache');
    return Object.fromEntries(all.filter((c) => c.key.startsWith('sirene-dept:')).map((c) => [c.key.slice('sirene-dept:'.length), c.fetchedAt]));
  }
}
