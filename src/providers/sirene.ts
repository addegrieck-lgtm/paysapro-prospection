// SireneProvider : import des paysagistes depuis la base SIRENE (INSEE), gratuitement.
//
// Source : API publique « Recherche d'entreprises » de l'État (recherche-entreprises.api.gouv.fr),
// sans clé, sans compte, CORS ouvert. Limites respectées :
//  • 25 résultats par page, 10 000 résultats maximum par requête → découpage par département ;
//  • ~7 requêtes/seconde autorisées → nous restons à 4 par seconde, avec reprise sur erreur 429 ;
//  • réponses mises en cache 7 jours (pas de requête inutile).
// Données retenues : établissements ACTIFS, du code NAF ciblé, situés dans le département, et dont
// la diffusion est publique (statut « O »). Aucune donnée sur les dirigeants n'est conservée.
import type { DataProvider } from './data';
import type { ProspectInput } from '../domain/prospect';
import type { CacheEntry, DB } from '../data/db';
import { departmentFromPostalCode } from '../domain/geo';
import { NAF_LABELS } from '../domain/referentials';
import { clean, titleCase } from '../domain/normalize';
import { annuaireEntreprisesUrl } from '../domain/links';

const env = import.meta.env ?? {};
export const SIRENE_API = (env.VITE_SIRENE_API_URL || 'https://recherche-entreprises.api.gouv.fr').replace(/\/$/, '');

// ─── Format de réponse (champs utilisés uniquement) ───

export interface SireneEtablissement {
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
  nom_commercial?: string | null;
  liste_enseignes?: string[] | null;
  statut_diffusion_etablissement?: string | null;
}

export interface SireneUniteLegale {
  siren: string;
  nom_complet: string | null;
  nom_raison_sociale: string | null;
  sigle?: string | null;
  nature_juridique: string | null;
  date_creation: string | null;
  etat_administratif: string | null;
  statut_diffusion?: string | null;
  tranche_effectif_salarie: string | null;
  siege: SireneEtablissement;
  matching_etablissements: SireneEtablissement[];
  complements?: { est_entrepreneur_individuel?: boolean | null } | null;
}

export interface SireneSearchResponse {
  results: SireneUniteLegale[];
  total_results: number;
  page: number;
  per_page: number;
  total_pages: number;
}

const LEGAL_FORMS: Record<string, string> = {
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

function establishmentDept(e: SireneEtablissement): string | null {
  return departmentFromPostalCode(e.code_postal) ?? (e.commune ? departmentFromPostalCode(`${e.commune}`) : null);
}

function streetOnly(e: SireneEtablissement): string | null {
  const full = clean(e.adresse);
  if (!full) return null;
  const suffix = [e.code_postal, e.libelle_commune].filter(Boolean).join(' ');
  return clean(suffix && full.toUpperCase().endsWith(suffix.toUpperCase()) ? full.slice(0, -suffix.length) : full);
}

export interface SireneMapOptions {
  department: string;
  nafCodes: string[];
  excludeIndividuals: boolean;
}

/** Convertit une entreprise SIRENE en fiches prospect (un établissement actif = une fiche). Fonction pure. */
export function sireneToInputs(u: SireneUniteLegale, o: SireneMapOptions): ProspectInput[] {
  const individual = u.complements?.est_entrepreneur_individuel ?? u.nature_juridique === '1000';
  if (o.excludeIndividuals && individual) return [];
  if (u.statut_diffusion && u.statut_diffusion !== 'O') return []; // diffusion partielle : on respecte le choix de la personne
  const candidates = u.matching_etablissements?.length ? u.matching_etablissements : [u.siege];
  const seen = new Set<string>();
  return candidates
    .filter((e) => {
      if (!e?.siret || seen.has(e.siret)) return false;
      seen.add(e.siret);
      return (
        e.etat_administratif === 'A' &&
        (e.statut_diffusion_etablissement ?? 'O') === 'O' &&
        o.nafCodes.includes(e.activite_principale ?? '') &&
        establishmentDept(e) === o.department
      );
    })
    .map((e) => {
      const name = titleCase(u.nom_raison_sociale ?? u.nom_complet ?? '');
      const enseigne = e.liste_enseignes?.[0] ?? e.nom_commercial ?? null;
      const band = e.tranche_effectif_salarie && e.tranche_effectif_salarie !== 'NN' ? e.tranche_effectif_salarie : null;
      const naf = e.activite_principale ?? null;
      const input: ProspectInput = {
        name,
        tradeName: enseigne ? titleCase(enseigne) : null,
        siren: u.siren,
        siret: e.siret,
        nafCode: naf,
        activity: naf ? (NAF_LABELS[naf] ?? null) : null,
        legalForm: u.nature_juridique ? (LEGAL_FORMS[u.nature_juridique] ?? null) : null,
        individual,
        active: true,
        creationDate: e.date_creation ?? u.date_creation ?? null,
        headcountBand: band,
        address: streetOnly(e),
        postalCode: e.code_postal ?? null,
        city: e.libelle_commune ? titleCase(e.libelle_commune) : null,
        department: establishmentDept(e),
        region: e.region ?? null,
        sourceUrl: annuaireEntreprisesUrl(u.siren),
      };
      return input;
    });
}

// ─── Client HTTP (avec cache et limitation de débit) ───

type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface SireneRunOptions {
  departments: string[];
  nafCodes: string[];
  excludeIndividuals: boolean;
  /** Réutilise les réponses de moins de N jours (défaut 7) */
  cacheDays?: number;
  signal?: AbortSignal;
  onProgress?: (p: { department: string; deptIndex: number; deptTotal: number; page: number; pages: number; found: number }) => void;
  /** Reçoit les fiches au fil de l'eau (import par lots) */
  onBatch: (inputs: ProspectInput[], department: string) => Promise<void>;
}

export class SireneProvider implements DataProvider {
  readonly id = 'sirene' as const;
  readonly label = 'SIRENE (INSEE) — API publique';
  readonly description = 'Entreprises actives du code NAF ciblé, département par département. Gratuit, sans clé. Pas de téléphone ni d’e-mail dans SIRENE.';
  readonly enabled = true;
  readonly free = true;
  private fetchImpl: FetchLike;
  private db: DB | null;
  private minDelayMs: number;
  private lastCall = 0;

  constructor(opts: { fetchImpl?: FetchLike; db?: DB | null; minDelayMs?: number } = {}) {
    this.fetchImpl = opts.fetchImpl ?? ((url) => fetch(url));
    this.db = opts.db ?? null;
    this.minDelayMs = opts.minDelayMs ?? 250;
  }

  searchUrl(department: string, naf: string, page: number): string {
    const p = new URLSearchParams({ activite_principale: naf, departement: department, etat_administratif: 'A', per_page: '25', page: String(page) });
    return `${SIRENE_API}/search?${p.toString()}`;
  }

  private async throttle() {
    const wait = this.lastCall + this.minDelayMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();
  }

  async fetchPage(url: string, cacheDays: number, signal?: AbortSignal): Promise<SireneSearchResponse> {
    const cached = this.db ? await this.db.get('data_cache', url) : undefined;
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < cacheDays * 86_400_000) return cached.data as SireneSearchResponse;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (signal?.aborted) throw new DOMException('Import interrompu', 'AbortError');
      await this.throttle();
      const res = await this.fetchImpl(url);
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`SIRENE a répondu ${res.status}`);
      const data = (await res.json()) as SireneSearchResponse;
      if (this.db) await this.db.put('data_cache', { key: url, data, fetchedAt: new Date().toISOString() } satisfies CacheEntry);
      return data;
    }
    throw new Error('SIRENE ne répond pas (trop de requêtes). Réessayez dans quelques minutes : l’import reprendra grâce au cache.');
  }

  /** Parcourt les départements demandés et transmet les fiches par lots. Retourne le nombre de fiches trouvées. */
  async run(o: SireneRunOptions): Promise<number> {
    let found = 0;
    for (const [i, department] of o.departments.entries()) {
      for (const naf of o.nafCodes) {
        let page = 1;
        let pages: number;
        do {
          if (o.signal?.aborted) return found;
          const data = await this.fetchPage(this.searchUrl(department, naf, page), o.cacheDays ?? 7, o.signal);
          pages = Math.min(data.total_pages || 1, 400); // 400 × 25 = 10 000 (plafond de l'API)
          const inputs = data.results.flatMap((u) => sireneToInputs(u, { department, nafCodes: o.nafCodes, excludeIndividuals: o.excludeIndividuals }));
          found += inputs.length;
          if (inputs.length) await o.onBatch(inputs, department);
          o.onProgress?.({ department, deptIndex: i, deptTotal: o.departments.length, page, pages, found });
          page++;
        } while (page <= pages);
      }
      if (this.db) await this.db.put('data_cache', { key: `sirene-dept:${department}`, data: { nafCodes: o.nafCodes }, fetchedAt: new Date().toISOString() });
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
