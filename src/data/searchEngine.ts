// ProspectingSearchEngine : « Je cherche → Paysapro travaille → mes prospects arrivent dans mon CRM ».
//
//   SearchEngine → CompanyDiscoveryProvider (SIRENE / Recherche d'entreprises) → CompanyNormalizer (companyToInput)
//     → DuplicateDetector (importLines : SIRET > SIREN > nom + adresse > nom + ville + téléphone) → EnrichmentQueue
//
// Source : données publiques françaises (SIRENE via l'API Recherche d'entreprises), gratuites, sans clé.
import type { ProspectsApi } from './repository';
import type { EnrichmentQueue } from './enrichmentQueue';
import type { ImportReport } from '../domain/types';
import type { ProspectInput } from '../domain/prospect';
import { SireneProvider } from '../providers/company/SireneProvider';
import { companyToInput, type RechercheEntreprisesProvider } from '../providers/company/RechercheEntreprisesProvider';
import { DEPARTMENT_CODES, DEPARTMENTS, departmentFromPostalCode } from '../domain/geo';
import { bandsOf } from '../domain/headcount';
import { normText } from '../domain/normalize';

export type ZoneKind = 'france' | 'region' | 'department' | 'postalCode' | 'city';

export interface SearchRequest {
  /** « landscaper » = paysagistes (NAF 81.30Z), « naf » = codes choisis, « free » = recherche libre (nom, mots-clés) */
  activity: { mode: 'landscaper' | 'naf' | 'free'; nafCodes: string[]; q?: string };
  zone: { kind: ZoneKind; value?: string; department?: string };
  activeOnly: boolean;
  relevantOnly: boolean;
  establishmentType: 'all' | 'head' | 'secondary';
  headcountBuckets: string[];
  createdAfter?: string | null;
  createdBefore?: string | null;
  excludeIndividuals: boolean;
  /** Enrichir automatiquement les entreprises trouvées (téléphones, e-mails, sites) */
  enrichAfter: boolean;
  maxPhones: boolean;
}

export interface SearchProgress {
  phase: 'discovery' | 'done';
  label: string;
  done: number;
  total: number;
  found: number;
}

export interface SearchOutcome {
  report: ImportReport;
  prospectIds: string[];
  enqueued: number;
}

export const LANDSCAPER_NAF = ['81.30Z'];

export function departmentsOf(zone: SearchRequest['zone']): string[] {
  if (zone.kind === 'france') return DEPARTMENT_CODES;
  if (zone.kind === 'region') return DEPARTMENT_CODES.filter((d) => DEPARTMENTS[d]![1] === zone.value);
  if (zone.kind === 'department') return zone.value ? [zone.value] : [];
  if (zone.kind === 'city') return zone.department ? [zone.department] : [];
  const d = departmentFromPostalCode(zone.value);
  return d ? [d] : [];
}

export function zoneLabel(zone: SearchRequest['zone']): string {
  if (zone.kind === 'france') return 'France entière';
  if (zone.kind === 'postalCode') return `CP ${zone.value}`;
  if (zone.kind === 'city') return zone.value ?? '';
  if (zone.kind === 'region') return `région ${zone.value}`;
  return `${DEPARTMENTS[zone.value ?? '']?.[0] ?? ''} (${zone.value})`;
}

export class ProspectingSearchEngine {
  private api: ProspectsApi;
  private sirene: SireneProvider;
  private official: RechercheEntreprisesProvider;
  private queue: EnrichmentQueue | null;

  constructor(api: ProspectsApi, official: RechercheEntreprisesProvider, queue: EnrichmentQueue | null, sirene?: SireneProvider) {
    this.api = api;
    this.official = official;
    this.queue = queue;
    this.sirene = sirene ?? new SireneProvider({ db: api.db });
  }

  async run(req: SearchRequest, onProgress?: (p: SearchProgress) => void, signal?: AbortSignal): Promise<SearchOutcome> {
    const nafCodes = req.activity.mode === 'landscaper' ? LANDSCAPER_NAF : req.activity.nafCodes.length ? req.activity.nafCodes : LANDSCAPER_NAF;
    const ids = new Set<string>();
    const label = `Recherche — ${req.activity.mode === 'free' ? `« ${req.activity.q} »` : nafCodes.join(', ')} — ${zoneLabel(req.zone)}`;
    const total = {
      source: (req.activity.mode === 'free' ? 'search' : 'sirene') as ImportReport['source'],
      label,
      total: 0,
      added: 0,
      updated: 0,
      duplicates: 0,
      invalid: 0,
      excluded: 0,
      notFound: 0,
      candidates: 0,
      errors: [] as ImportReport['errors'],
      finishedAt: null,
    };
    const importBatch = async (inputs: ProspectInput[], scope: string) => {
      const r = await this.api.importLines(
        inputs.map((input, i) => ({ line: i + 1, input, errors: [] })),
        { source: total.source, label: `${label} (${scope})`, mode: 'create', record: false, onWritten: (w) => w.forEach((id) => ids.add(id)) },
      );
      for (const k of ['total', 'added', 'updated', 'duplicates', 'invalid', 'excluded'] as const) total[k] += r[k];
      total.candidates += r.candidates ?? 0;
    };
    const commune = req.zone.kind === 'city' ? req.zone.value : undefined;

    if (req.activity.mode === 'free') {
      // Recherche libre (nom, mots-clés) : pages de 25, 20 pages maximum par zone (500 entreprises)
      const deps: (string | undefined)[] = req.zone.kind === 'france' ? [undefined] : departmentsOf(req.zone);
      for (const [i, dep] of deps.entries()) {
        for (let page = 1; page <= 20; page++) {
          if (signal?.aborted) break;
          const res = await this.official.search(
            {
              q: req.activity.q,
              nafCodes: req.activity.nafCodes.length ? req.activity.nafCodes : undefined,
              department: dep,
              postalCode: req.zone.kind === 'postalCode' ? req.zone.value : undefined,
              activeOnly: req.activeOnly,
              page,
            },
            signal,
          );
          const inputs = res.companies
            .filter((c) => !(req.excludeIndividuals && c.individual))
            .flatMap((c) =>
              (c.matching.length ? c.matching : c.headOffice ? [c.headOffice] : [])
                .filter((e) => e.diffusible && (!req.activeOnly || e.active) && (!commune || normText(e.city).includes(normText(commune))))
                .map((e) => companyToInput(c, e)),
            );
          if (inputs.length) await importBatch(inputs, dep ?? 'France');
          const pages = Math.min(20, res.pages || 1);
          onProgress?.({ phase: 'discovery', label: `Recherche « ${req.activity.q} » — page ${page}/${pages}`, done: i + page / pages, total: deps.length, found: ids.size });
          if (page >= res.pages) break;
        }
      }
    } else {
      await this.sirene.run({
        activeOnly: req.activeOnly,
        relevantOnly: req.relevantOnly,
        establishmentType: req.establishmentType,
        headcountBands: bandsOf(req.headcountBuckets),
        createdAfter: req.createdAfter ?? null,
        createdBefore: req.createdBefore ?? null,
        excludeIndividuals: req.excludeIndividuals,
        commune,
        departments: departmentsOf(req.zone),
        postalCodes: req.zone.kind === 'postalCode' && req.zone.value ? [req.zone.value] : undefined,
        nafCodes,
        signal,
        onProgress: (p) =>
          onProgress?.({
            phase: 'discovery',
            label: `${DEPARTMENTS[p.department] ? `${DEPARTMENTS[p.department]![0]} (${p.department})` : p.department} — page ${p.page}/${p.pages}`,
            done: p.deptIndex + p.page / Math.max(1, p.pages),
            total: p.deptTotal,
            found: p.found,
          }),
        onBatch: importBatch,
      });
    }

    const report = await this.api.saveImportReport(total);
    const prospectIds = Array.from(ids);
    const enqueued = req.enrichAfter && this.queue && prospectIds.length ? await this.queue.add(prospectIds, false, req.maxPhones) : 0;
    onProgress?.({ phase: 'done', label: 'Terminé', done: 1, total: 1, found: prospectIds.length });
    return { report, prospectIds, enqueued };
  }
}
