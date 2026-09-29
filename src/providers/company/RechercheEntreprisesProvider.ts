// RechercheEntreprisesProvider — API publique « Recherche d'entreprises » (recherche-entreprises.api.gouv.fr).
//
// Données officielles (répertoire SIRENE de l'INSEE + RNE), gratuites, SANS clé, appelables depuis le navigateur.
// Fournit : identité, SIREN, SIRET, NAF, adresse, statut actif/fermé, siège, date de création, tranche d'effectif,
// catégorie d'entreprise, nombre d'établissements. Ne fournit PAS : téléphone, e-mail, site, réseaux, avis.
// Limites : 25 résultats par page, 10 000 par requête, ~7 requêtes/s (nous en faisons 4 par défaut).
// Diffusion partielle (personne ayant demandé à ne pas figurer) : la fiche est ignorée.
// Les dirigeants ne sont jamais conservés (minimisation RGPD).
import type { Company, CompanyDataProvider, EnrichOptions, EnrichOutcome, EnrichTarget, Establishment, SearchParams, SearchResult } from './CompanyDataProvider';
import type { ProspectInput } from '../../domain/prospect';
import type { KeyValueCache } from '../../data/cache';
import { ENRICHMENT_CONFIG } from '../../config';
import { fetchJson, type FetchJsonOptions } from '../http';
import { departmentFromPostalCode } from '../../domain/geo';
import { NAF_LABELS } from '../../domain/referentials';
import { clean, normName, normPostalCode, normSiren, normSiret, normText, titleCase } from '../../domain/normalize';
import { annuaireEntreprisesUrl } from '../../domain/links';

// ─── Format de réponse de l'API (champs utilisés uniquement) ───

export interface ApiEtablissement {
  siret: string;
  activite_principale: string | null;
  adresse: string | null;
  code_postal: string | null;
  commune: string | null;
  libelle_commune: string | null;
  region: string | null;
  date_creation: string | null;
  etat_administratif: string | null;
  est_siege: boolean;
  tranche_effectif_salarie: string | null;
  caractere_employeur?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  nom_commercial?: string | null;
  liste_enseignes?: string[] | null;
  statut_diffusion_etablissement?: string | null;
}

export interface ApiUniteLegale {
  siren: string;
  nom_complet: string | null;
  nom_raison_sociale: string | null;
  sigle?: string | null;
  nature_juridique: string | null;
  date_creation: string | null;
  etat_administratif: string | null;
  statut_diffusion?: string | null;
  tranche_effectif_salarie: string | null;
  categorie_entreprise?: string | null;
  nombre_etablissements_ouverts?: number | null;
  activite_principale?: string | null;
  siege: ApiEtablissement;
  matching_etablissements: ApiEtablissement[];
  complements?: { est_entrepreneur_individuel?: boolean | null } | null;
}

export interface ApiSearchResponse {
  results: ApiUniteLegale[];
  total_results: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export const LEGAL_FORMS: Record<string, string> = {
  '1000': 'Entrepreneur individuel',
  '5410': 'SARL nationale',
  '5498': 'EURL',
  '5499': 'SARL',
  '5710': 'SAS',
  '5720': 'SASU',
  '5599': 'SA',
  '6540': 'SCI',
  '5202': 'SNC',
  '6533': 'GAEC',
  '6598': 'EARL',
};

const band = (b: string | null | undefined) => (b && b !== 'NN' ? b : null);

function streetOnly(e: ApiEtablissement): string | null {
  const full = clean(e.adresse);
  if (!full) return null;
  const suffix = [e.code_postal, e.libelle_commune].filter(Boolean).join(' ');
  return clean(suffix && full.toUpperCase().endsWith(suffix.toUpperCase()) ? full.slice(0, -suffix.length) : full);
}

export function toEstablishment(u: ApiUniteLegale, e: ApiEtablissement): Establishment {
  const enseigne = e.liste_enseignes?.[0] ?? e.nom_commercial ?? null;
  return {
    siret: e.siret,
    siren: u.siren,
    isHeadOffice: !!e.est_siege,
    active: e.etat_administratif === 'A',
    nafCode: e.activite_principale ?? null,
    address: streetOnly(e),
    postalCode: e.code_postal ?? null,
    city: e.libelle_commune ? titleCase(e.libelle_commune) : null,
    department: departmentFromPostalCode(e.code_postal) ?? departmentFromPostalCode(e.commune),
    region: e.region ?? null,
    creationDate: e.date_creation ?? null,
    headcountBand: band(e.tranche_effectif_salarie),
    tradeName: enseigne ? titleCase(enseigne) : null,
    employer: e.caractere_employeur === 'O' ? true : e.caractere_employeur === 'N' ? false : null,
    latitude: e.latitude ? Number(e.latitude) || null : null,
    longitude: e.longitude ? Number(e.longitude) || null : null,
    diffusible: (e.statut_diffusion_etablissement ?? 'O') === 'O',
  };
}

export function toCompany(u: ApiUniteLegale): Company {
  return {
    siren: u.siren,
    name: titleCase(u.nom_raison_sociale ?? u.nom_complet ?? ''),
    legalForm: u.nature_juridique ? (LEGAL_FORMS[u.nature_juridique] ?? null) : null,
    individual: u.complements?.est_entrepreneur_individuel ?? u.nature_juridique === '1000',
    active: u.etat_administratif === 'A',
    creationDate: u.date_creation ?? null,
    headcountBand: band(u.tranche_effectif_salarie),
    category: u.categorie_entreprise ?? null,
    openEstablishments: u.nombre_etablissements_ouverts ?? null,
    nafCode: u.activite_principale ?? u.siege?.activite_principale ?? null,
    diffusible: !u.statut_diffusion || u.statut_diffusion === 'O',
    headOffice: u.siege?.siret ? toEstablishment(u, u.siege) : null,
    matching: (u.matching_etablissements ?? []).filter((e) => e?.siret).map((e) => toEstablishment(u, e)),
  };
}

/** Fiche prospect à partir d'une entreprise et (si connu) de l'établissement précis. Fonction pure. */
export function companyToInput(c: Company, e: Establishment | null): ProspectInput {
  const est = e ?? c.headOffice;
  const naf = est?.nafCode ?? c.nafCode;
  return {
    name: c.name,
    tradeName: est?.tradeName ?? null,
    siren: c.siren,
    siret: est?.siret ?? null,
    nafCode: naf,
    activity: naf ? (NAF_LABELS[naf] ?? null) : null,
    legalForm: c.legalForm,
    individual: c.individual,
    active: est ? est.active : c.active,
    creationDate: est?.creationDate ?? c.creationDate,
    headcountBand: est?.headcountBand ?? c.headcountBand,
    address: est?.address ?? null,
    postalCode: est?.postalCode ?? null,
    city: est?.city ?? null,
    department: est?.department ?? null,
    region: est?.region ?? null,
    isHeadOffice: est ? est.isHeadOffice : null,
    companyCategory: c.category,
    openEstablishments: c.openEstablishments,
    employer: est?.employer ?? null,
    latitude: est?.latitude ?? null,
    longitude: est?.longitude ?? null,
    sourceUrl: annuaireEntreprisesUrl(c.siren),
  };
}

/** Similarité de noms (0 à 1) : mots communs après normalisation (accents, formes juridiques). */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normName(a).split(' ').filter((w) => w.length > 1));
  const tb = new Set(normName(b).split(' ').filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter((w) => tb.has(w)).length;
  return inter / Math.max(ta.size, tb.size);
}

export interface RechercheEntreprisesOptions extends Pick<FetchJsonOptions, 'fetchImpl' | 'limiter' | 'backoff' | 'wait' | 'retries' | 'timeoutMs'> {
  baseUrl?: string;
  cache?: KeyValueCache | null;
  cacheDays?: number;
}

export class RechercheEntreprisesProvider implements CompanyDataProvider {
  readonly id = 'recherche-entreprises';
  readonly label = 'API Recherche d’entreprises (données publiques SIRENE)';
  readonly free = true;
  private o: RechercheEntreprisesOptions;
  private baseUrl: string;

  constructor(o: RechercheEntreprisesOptions = {}) {
    this.o = o;
    this.baseUrl = (o.baseUrl ?? ENRICHMENT_CONFIG.apiUrl).replace(/\/$/, '');
  }

  private get cacheDays() {
    return this.o.cacheDays ?? ENRICHMENT_CONFIG.cacheDays;
  }

  buildUrl(p: Record<string, string | undefined>): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v) params.set(k, v);
    return `${this.baseUrl}/search?${params.toString()}`;
  }

  /** Appel brut (avec cache facultatif). `cacheKey` null = pas de cache. */
  async raw(url: string, opts: { signal?: AbortSignal; cacheKey?: string | null; maxAgeDays?: number; force?: boolean } = {}): Promise<{ data: ApiSearchResponse | null; fromCache: boolean }> {
    const key = opts.cacheKey === undefined ? url : opts.cacheKey;
    const cache = this.o.cache;
    if (cache && key && !opts.force) {
      const hit = (await cache.get(key, opts.maxAgeDays ?? this.cacheDays)) as ApiSearchResponse | undefined;
      if (hit) return { data: hit, fromCache: true };
    }
    const data = await fetchJson<ApiSearchResponse>(url, { ...this.o, signal: opts.signal });
    if (data && 'erreur' in (data as object)) return { data: null, fromCache: false };
    if (cache && key && data) await cache.set(key, data);
    return { data, fromCache: false };
  }

  async search(p: SearchParams, signal?: AbortSignal): Promise<SearchResult> {
    const q = p.q ?? p.siret ?? p.siren ?? p.name;
    const cp = normPostalCode(p.postalCode);
    const url = this.buildUrl({
      q: q?.trim() || undefined,
      activite_principale: p.nafCodes?.join(','),
      code_postal: cp ?? undefined,
      departement: cp ? undefined : p.department,
      region: cp || p.department ? undefined : p.region,
      etat_administratif: p.activeOnly ? 'A' : undefined,
      page: String(p.page ?? 1),
      per_page: String(Math.min(25, p.perPage ?? 25)),
    });
    const { data } = await this.raw(url, { signal, cacheKey: null });
    if (!data) return { companies: [], total: 0, pages: 0 };
    let companies = data.results.map(toCompany).filter((c) => c.diffusible);
    if (p.commune) {
      const commune = normText(p.commune);
      companies = companies.filter((c) => [c.headOffice, ...c.matching].some((e) => e && normText(e.city).includes(commune)));
    }
    return { companies, total: data.total_results, pages: data.total_pages };
  }

  private async lookupSiren(siren: string, opts: EnrichOptions) {
    const { data, fromCache } = await this.raw(this.buildUrl({ q: siren }), { signal: opts.signal, cacheKey: `siren:${siren}`, force: opts.force });
    const u = data?.results.find((r) => r.siren === siren);
    return { company: u ? toCompany(u) : null, fromCache };
  }

  private async lookupSiret(siret: string, opts: EnrichOptions) {
    const { data, fromCache } = await this.raw(this.buildUrl({ q: siret }), { signal: opts.signal, cacheKey: `siret:${siret}`, force: opts.force });
    const u = data?.results.find((r) => r.siren === siret.slice(0, 9));
    if (!u) return { found: null, fromCache };
    const company = toCompany(u);
    const establishment = [...company.matching, company.headOffice].find((e) => e?.siret === siret) ?? null;
    return { found: establishment ? { company, establishment } : null, fromCache };
  }

  async getBySiren(siren: string, opts: EnrichOptions = {}): Promise<Company | null> {
    const s = normSiren(siren);
    return s ? (await this.lookupSiren(s, opts)).company : null;
  }

  async getBySiret(siret: string, opts: EnrichOptions = {}): Promise<{ company: Company; establishment: Establishment } | null> {
    const s = normSiret(siret);
    return s ? (await this.lookupSiret(s, opts)).found : null;
  }
  /**
   * Retrouve l'entreprise d'un prospect : SIRET (établissement exact), sinon SIREN (siège),
   * sinon nom + code postal (accepté seulement si une seule entreprise correspond clairement).
   */
  async enrich(t: EnrichTarget, opts: EnrichOptions = {}): Promise<EnrichOutcome> {
    const siret = normSiret(t.siret);
    const siren = normSiren(t.siren) ?? siret?.slice(0, 9) ?? null;
    const restricted = 'Diffusion restreinte : l’entreprise a demandé à ne pas figurer dans les données publiques.';
    if (siret) {
      const { found: r, fromCache } = await this.lookupSiret(siret, opts);
      if (r) {
        if (!r.company.diffusible || !r.establishment.diffusible) return { status: 'not_found', reason: restricted, fromCache };
        return { status: 'found', input: companyToInput(r.company, r.establishment), company: r.company, establishment: r.establishment, matchedBy: 'siret', confidence: 'high', fromCache };
      }
    }
    if (siren) {
      const { company: c, fromCache } = await this.lookupSiren(siren, opts);
      if (c) {
        if (!c.diffusible) return { status: 'not_found', reason: restricted, fromCache };
        // SIREN seul : l'établissement retenu est le siège (le SIRET précis n'est pas connu)
        return { status: 'found', input: companyToInput(c, c.headOffice), company: c, establishment: c.headOffice, matchedBy: 'siren', confidence: siret ? 'medium' : 'high', fromCache };
      }
      return { status: 'not_found', reason: 'Aucune entreprise ne correspond à ce SIREN / SIRET dans les données publiques.', fromCache };
    }
    const name = t.tradeName ?? t.name;
    if (!name?.trim()) return { status: 'not_found', reason: 'Ni SIREN, ni SIRET, ni nom : impossible de rechercher l’entreprise.', fromCache: false };
    const cp = normPostalCode(t.postalCode);
    const res = await this.search({ q: name, postalCode: cp ?? undefined, department: cp ? undefined : (departmentFromPostalCode(t.postalCode) ?? undefined), commune: cp ? undefined : (t.city ?? undefined), perPage: 10 }, opts.signal);
    const scored = res.companies
      .map((c) => {
        const names = [c.name, ...[c.headOffice, ...c.matching].map((e) => e?.tradeName ?? '')].filter(Boolean);
        const sim = Math.max(...names.flatMap((n) => [nameSimilarity(n, t.name), t.tradeName ? nameSimilarity(n, t.tradeName) : 0]));
        const est = [...c.matching, c.headOffice].find((e) => e && ((cp && e.postalCode === cp) || (t.city && normText(e.city) === normText(t.city)))) ?? null;
        return { c, sim, est };
      })
      .filter((x) => x.sim >= 0.6)
      .sort((a, b) => b.sim - a.sim);
    if (!scored.length) return { status: 'not_found', reason: 'Aucune entreprise correspondante trouvée par nom et localisation. Renseignez le SIREN pour un résultat certain.', fromCache: false };
    const exact = scored.filter((x) => x.sim === 1 && x.est);
    const pick = exact.length === 1 ? exact[0]! : scored.length === 1 && scored[0]!.est ? scored[0]! : null;
    if (!pick) return { status: 'ambiguous', candidates: scored.slice(0, 5).map((x) => x.c), fromCache: false };
    return { status: 'found', input: companyToInput(pick.c, pick.est), company: pick.c, establishment: pick.est, matchedBy: 'name', confidence: pick.sim === 1 ? 'medium' : 'low', fromCache: false };
  }
}
