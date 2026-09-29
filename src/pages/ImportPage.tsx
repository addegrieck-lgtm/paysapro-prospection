// Import : SIRENE (gratuit), CSV (4 étapes : fichier → analyse → correspondances → import), enrichissement, démo.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Building2, CheckCircle2, Copy, FileSpreadsheet, FlaskConical, Search, Sparkles, Upload } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { Card, CardTitle } from '../components/ui/Card';
import { Alert, useToast } from '../components/ui/Feedback';
import { Checkbox, Segmented, SelectField, TextField } from '../components/ui/Form';
import { QueueProgressCard } from '../components/enrichment';
import { companyToInput } from '../providers/company/RechercheEntreprisesProvider';
import type { Company } from '../providers/company/CompanyDataProvider';
import { HEADCOUNT_BANDS, NAF_CHOICES, NAF_LABELS } from '../domain/referentials';
import { nf, useAction, formatDateShort } from '../components/common';
import { useApp, useCan, useQuery } from '../app/context';
import { csvProvider } from '../providers/company/CsvProvider';
import { SireneProvider } from '../providers/company/SireneProvider';
import { DEPARTMENT_CODES, DEPARTMENTS, REGIONS } from '../domain/geo';
import { FIELDS, FIELD_LABEL, type FieldKey, type Mapping } from '../domain/mapping';
import { DedupeIndex } from '../domain/dedupe';
import { demoLines } from '../data/demo';
import type { ImportLine } from '../data/repository';
import type { ImportReport } from '../domain/types';
import type { ProspectInput } from '../domain/prospect';

type Tab = 'sirene' | 'search' | 'csv' | 'enrich' | 'demo';

export function ImportPage() {
  const canImport = useCan('prospecting.import');
  const [tab, setTab] = useState<Tab>('sirene');
  if (!canImport) return <Alert tone="warning">Votre rôle ne permet pas d'importer des prospects.</Alert>;
  return (
    <>
      <PageHeader title="Import & Enrichissement" subtitle="Constituez et complétez votre base de paysagistes, gratuitement." />
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <EnrichmentOverview />
        <DuplicatesOverview />
      </div>
      <h2 className="mb-3 text-lg font-semibold">Importer des entreprises</h2>
      <div className="mb-5 max-w-3xl overflow-x-auto">
        <Segmented<Tab>
          label="Type d'import"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'sirene', label: 'Officiel' },
            { value: 'search', label: 'Rechercher' },
            { value: 'csv', label: 'CSV' },
            { value: 'enrich', label: 'Compléter' },
            { value: 'demo', label: 'Démo' },
          ]}
        />
      </div>
      {tab === 'sirene' && <SireneImport />}
      {tab === 'search' && <CompanySearch />}
      {tab === 'csv' && <CsvImport mode="create" />}
      {tab === 'enrich' && <CsvImport mode="enrich" />}
      {tab === 'demo' && <DemoImport />}
      <ImportHistory />
    </>
  );
}

// ─────────────── Enrichissement (vue d'ensemble) ───────────────

function EnrichmentOverview() {
  const { queue } = useApp();
  const run = useAction();
  const canEdit = useCan('prospecting.edit');
  const { data } = useQuery(async (a) => {
    const rows = (await a.allRows()).filter((r) => !r.demo);
    const by = (s: string) => rows.filter((r) => r.enrichmentStatus === s);
    return { total: rows.length, enriched: by('enriched').length, partial: by('partial').length, failed: by('failed'), none: rows.filter((r) => r.enrichmentStatus === 'none') };
  }, []);
  if (!data) return null;
  return (
    <Card>
      <CardTitle icon={<Sparkles className="h-5 w-5" />}>Enrichissement</CardTitle>
      <p className="text-sm text-muted">
        Complète automatiquement chaque fiche avec les données publiques officielles (SIREN, SIRET, adresse, NAF, statut, effectif…) — gratuit, sans clé, jamais au détriment
        de vos saisies manuelles.
      </p>
      <ul className="my-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <Stat label="prospects réels" value={data.total} />
        <Stat label="enrichis" value={data.enriched} />
        <Stat label="partiels" value={data.partial} />
        <Stat label="non traités" value={data.none.length} />
      </ul>
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={!data.none.length} icon={<Sparkles className="h-5 w-5" />} onClick={() => run(() => queue.add(data.none.map((r) => r.id)), 'Enrichissement lancé')}>
            Enrichir les non traités ({nf.format(data.none.length)})
          </Button>
          {data.failed.length > 0 && (
            <Button variant="secondary" onClick={() => run(() => queue.add(data.failed.map((r) => r.id), true), 'Échecs relancés')}>
              Relancer les échecs ({nf.format(data.failed.length)})
            </Button>
          )}
        </div>
      )}
      <div className="mt-3 empty:hidden">
        <QueueProgressCard />
      </div>
    </Card>
  );
}

function DuplicatesOverview() {
  const { api } = useApp();
  const run = useAction();
  const toast = useToast();
  const { data: open = [] } = useQuery((a) => a.listDuplicates('open'), []);
  return (
    <Card>
      <CardTitle icon={<Copy className="h-5 w-5" />}>Doublons</CardTitle>
      <p className="text-sm text-muted">
        Détection par SIRET, SIREN, nom + adresse, nom + téléphone (fusion automatique à l'import), puis téléphone seul et nom + ville (à vérifier par vous).
      </p>
      <p className="my-3 text-2xl font-bold tabular-nums">
        {nf.format(open.length)} <span className="text-base font-normal text-muted">doublon(s) potentiel(s) à vérifier</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <ButtonLink to="/duplicates" variant={open.length ? 'primary' : 'secondary'}>
          Vérifier les doublons
        </ButtonLink>
        <Button
          variant="ghost"
          onClick={async () => {
            const n = await run(() => api.scanDuplicates());
            if (n !== undefined) toast(n ? `${nf.format(n)} nouveau(x) doublon(s) potentiel(s)` : 'Aucun nouveau doublon', 'info');
          }}
        >
          Analyser toute la base
        </Button>
      </div>
    </Card>
  );
}

// ─────────────── Recherche d'entreprises (API officielle) ───────────────

function CompanySearch() {
  const { api, companyProvider, settings } = useApp();
  const run = useAction();
  const [q, setQ] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [commune, setCommune] = useState('');
  const [naf, setNaf] = useState(settings.nafCodes[0] ?? '81.30Z');
  const [activeOnly, setActiveOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<{ companies: Company[]; total: number; pages: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const search = async (p = 1) => {
    setBusy(true);
    setReport(null);
    const digits = q.replace(/\s/g, '');
    const r = await run(() =>
      companyProvider.search({
        q: q.trim() || undefined,
        siren: /^\d{9}$/.test(digits) ? digits : undefined,
        siret: /^\d{14}$/.test(digits) ? digits : undefined,
        postalCode: postalCode || undefined,
        commune: commune || undefined,
        nafCodes: naf ? [naf] : undefined,
        activeOnly,
        page: p,
      }),
    );
    setBusy(false);
    if (r) {
      setResult(r);
      setPage(p);
      setSelected(new Set());
    }
  };

  const establishmentsOf = (c: Company) => {
    const list = c.matching.length ? c.matching : c.headOffice ? [c.headOffice] : [];
    return list.filter((e) => e.diffusible && (!activeOnly || e.active));
  };

  const add = async () => {
    if (!result) return;
    const inputs = result.companies.flatMap((c) => establishmentsOf(c).filter((e) => selected.has(e.siret)).map((e) => companyToInput(c, e)));
    const r = await run(() => api.importLines(inputs.map((input, i) => ({ line: i + 1, input, errors: [] })), { source: 'search', label: `Recherche « ${q || naf} »`, mode: 'create' }));
    if (r) setReport(r);
  };

  return (
    <Card>
      <CardTitle icon={<Search className="h-5 w-5" />}>Recherche d'entreprises (données publiques)</CardTitle>
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void search(1);
        }}
      >
        <TextField label="Nom, SIREN ou SIRET" value={q} onChange={setQ} placeholder="Ex. jardin, 123456789…" className="lg:col-span-2" />
        <TextField label="Code postal" value={postalCode} onChange={setPostalCode} inputMode="numeric" />
        <TextField label="Commune" value={commune} onChange={setCommune} />
        <SelectField label="Code NAF" value={naf} onChange={setNaf} options={[{ value: '', label: 'Tous' }, ...NAF_CHOICES.map((c) => ({ value: c, label: `${c} — ${NAF_LABELS[c]}` }))]} />
        <div className="self-end">
          <Checkbox checked={activeOnly} onChange={setActiveOnly}>
            Actives uniquement
          </Checkbox>
        </div>
        <div className="self-end lg:col-span-2">
          <Button type="submit" disabled={busy || (!q.trim() && !postalCode && !commune)} icon={<Search className="h-5 w-5" />}>
            {busy ? 'Recherche…' : 'Rechercher'}
          </Button>
        </div>
      </form>
      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted">
            {nf.format(result.total)} entreprise(s) · page {page} / {Math.max(1, result.pages)}
          </p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {result.companies.flatMap((c) =>
              establishmentsOf(c).map((e) => (
                <li key={e.siret}>
                  <label className="flex cursor-pointer items-start gap-3 p-3 hover:bg-surface-2">
                    <input
                      type="checkbox"
                      checked={selected.has(e.siret)}
                      onChange={() => {
                        const s = new Set(selected);
                        if (s.has(e.siret)) s.delete(e.siret);
                        else s.add(e.siret);
                        setSelected(s);
                      }}
                      className="mt-1 h-4 w-4 accent-[var(--brand)]"
                    />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold">
                        {e.tradeName ? `${e.tradeName} (${c.name})` : c.name}
                        {e.isHeadOffice && <span className="ml-2 text-xs font-normal text-muted">siège</span>}
                      </span>
                      <span className="text-muted">
                        SIRET {e.siret} · {[e.address, e.postalCode, e.city].filter(Boolean).join(' ')} · {e.nafCode ?? 'NAF inconnu'} · {e.active ? 'active' : 'fermée'}
                        {e.headcountBand && ` · ${HEADCOUNT_BANDS[e.headcountBand]?.[0] ?? ''}`}
                      </span>
                    </span>
                  </label>
                </li>
              )),
            )}
          </ul>
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={!selected.size} onClick={add}>
              Ajouter {selected.size ? nf.format(selected.size) : ''} au CRM
            </Button>
            <Button variant="ghost" disabled={page <= 1 || busy} onClick={() => search(page - 1)}>
              Page précédente
            </Button>
            <Button variant="ghost" disabled={page >= result.pages || busy} onClick={() => search(page + 1)}>
              Page suivante
            </Button>
          </div>
          {report && <ReportView r={report} />}
        </div>
      )}
    </Card>
  );
}

// ─────────────── Progression et rapport ───────────────

function Progress({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total ? Math.round((done / total) * 1000) / 10 : 0;
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <p className="font-semibold">Importation…</p>
      {label && <p className="text-sm text-muted">{label}</p>}
      <div className="h-3 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-sm tabular-nums text-muted">
        {nf.format(done)} / {nf.format(total)} · {String(pct).replace('.', ',')} %
      </p>
    </div>
  );
}

function ReportView({ r }: { r: ImportReport }) {
  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-lg font-semibold text-success">
        <CheckCircle2 className="h-6 w-6" aria-hidden /> Import terminé
      </p>
      <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
        <Stat label="ajoutés" value={r.added} />
        <Stat label="mis à jour / complétés" value={r.updated} />
        <Stat label="doublons" value={r.duplicates} />
        <Stat label="lignes invalides" value={r.invalid} />
        <Stat label="exclus (liste de suppression)" value={r.excluded} />
        {r.notFound > 0 && <Stat label="sans correspondance" value={r.notFound} />}
        {(r.candidates ?? 0) > 0 && <Stat label="doublons potentiels à vérifier" value={r.candidates ?? 0} />}
      </ul>
      {r.errors.length > 0 && (
        <details className="rounded-xl border border-line p-3 text-sm">
          <summary className="cursor-pointer font-medium">Détail des erreurs ({r.errors.length})</summary>
          <ul className="mt-2 max-h-60 space-y-1 overflow-y-auto text-muted">
            {r.errors.map((e, i) => (
              <li key={i}>
                Ligne {e.line} : {e.message}
              </li>
            ))}
          </ul>
        </details>
      )}
      <Link to="/prospects" className="inline-flex font-semibold text-brand hover:underline">
        Voir les prospects →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="rounded-xl bg-surface-2 p-3">
      <span className="block text-xl font-bold tabular-nums text-ink">{nf.format(value)}</span>
      <span className="text-muted">{label}</span>
    </li>
  );
}

// ─────────────── SIRENE ───────────────

function SireneImport() {
  const { api, settings } = useApp();
  const run = useAction();
  const provider = useMemo(() => new SireneProvider({ db: api.db }), [api]);
  const { data: last = {} } = useQuery(() => provider.lastImports(), []);
  const [selected, setSelected] = useState<string[]>(settings.targetDepartments);
  const [excludeIndividuals, setExcludeIndividuals] = useState(settings.excludeIndividuals);
  const [activeOnly, setActiveOnly] = useState(true);
  const [headOfficeOnly, setHeadOfficeOnly] = useState(false);
  const [minBand, setMinBand] = useState('');
  const [createdAfter, setCreatedAfter] = useState('');
  const [createdBefore, setCreatedBefore] = useState('');
  const [postalCodes, setPostalCodes] = useState('');
  const [commune, setCommune] = useState('');
  const [status, setStatus] = useState<{ label: string; done: number; total: number } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const abort = useRef<AbortController | null>(null);

  const start = async (departments: string[]) => {
    setReport(null);
    abort.current = new AbortController();
    const cps = postalCodes
      .split(/[\s,;]+/)
      .map((c) => c.trim())
      .filter((c) => /^\d{5}$/.test(c));
    const label = cps.length
      ? `SIRENE — CP ${cps.join(', ')}`
      : departments.length === DEPARTMENT_CODES.length
        ? 'SIRENE — toute la France'
        : `SIRENE — ${departments.length > 6 ? `${departments.length} départements` : departments.join(', ')}`;
    const total = { source: 'sirene' as const, label, total: 0, added: 0, updated: 0, duplicates: 0, invalid: 0, excluded: 0, notFound: 0, errors: [] as ImportReport['errors'], finishedAt: null };
    await run(async () => {
      await provider.run({
        departments,
        postalCodes: cps,
        commune: commune.trim() || undefined,
        activeOnly,
        headOfficeOnly,
        minHeadcountBand: minBand || null,
        createdAfter: createdAfter || null,
        createdBefore: createdBefore || null,
        nafCodes: settings.nafCodes.length ? settings.nafCodes : ['81.30Z'],
        excludeIndividuals,
        signal: abort.current!.signal,
        onProgress: (p) =>
          setStatus({
            label: `${DEPARTMENTS[p.department] ? `Département ${p.department} — ${DEPARTMENTS[p.department]![0]}` : `Code postal ${p.department}`} (page ${p.page}/${p.pages}) · ${nf.format(p.found)} établissements retenus`,
            done: p.deptIndex + p.page / Math.max(1, p.pages),
            total: p.deptTotal,
          }),
        onBatch: async (inputs: ProspectInput[], dept) => {
          const r = await api.importLines(
            inputs.map((input, i) => ({ line: i + 1, input, errors: [] })),
            { source: 'sirene', label: `SIRENE ${dept}`, mode: 'create', record: false },
          );
          for (const k of ['total', 'added', 'updated', 'duplicates', 'invalid', 'excluded'] as const) total[k] += r[k];
        },
      });
    });
    setStatus(null);
    if (total.total > 0 || !abort.current.signal.aborted) setReport(await api.saveImportReport(total));
  };

  const toggle = (d: string) => setSelected((l) => (l.includes(d) ? l.filter((x) => x !== d) : [...l, d]));

  return (
    <Card>
      <CardTitle icon={<Building2 className="h-5 w-5" />}>Importer les paysagistes français (SIRENE)</CardTitle>
      <div className="space-y-4 text-sm">
        <p className="text-muted">
          Source officielle et gratuite : l'API publique « Recherche d'entreprises » de l'État (données INSEE). Code NAF <strong>{settings.nafCodes.join(', ') || '81.30Z'}</strong>{' '}
          (modifiable dans Paramètres), établissements à diffusion publique. Aucune clé ni abonnement. Les fiches importées sont déjà « enrichies » administrativement.
        </p>
        <Alert tone="info" title="Ce que SIRENE ne contient pas">
          Ni téléphone, ni e-mail, ni site, ni avis. Ces fiches démarrent donc avec un score modéré : complétez-les avec « Rechercher sur le web » sur chaque fiche ou un fichier CSV (onglet
          Compléter).
        </Alert>
        <fieldset className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2 lg:grid-cols-3">
          <legend className="px-1 font-medium">Filtres</legend>
          <SelectField
            label="Région (sélectionne ses départements)"
            value=""
            onChange={(r) => r && setSelected(Array.from(new Set([...selected, ...DEPARTMENT_CODES.filter((d) => DEPARTMENTS[d]![1] === r)])))}
            options={[{ value: '', label: 'Ajouter une région…' }, ...Object.entries(REGIONS).map(([c, n]) => ({ value: c, label: n }))]}
          />
          <TextField label="Codes postaux (au lieu des départements)" value={postalCodes} onChange={setPostalCodes} placeholder="76000, 76100" hint="Séparés par des virgules." />
          <TextField label="Commune (filtre)" value={commune} onChange={setCommune} placeholder="Ex. Rouen" />
          <SelectField
            label="Tranche d'effectif minimale"
            value={minBand}
            onChange={setMinBand}
            options={[{ value: '', label: 'Toutes (y compris non renseignée)' }, ...Object.entries(HEADCOUNT_BANDS).slice(1, 8).map(([c, [l]]) => ({ value: c, label: `${l} et plus` }))]}
          />
          <TextField label="Créée après le" type="date" value={createdAfter} onChange={setCreatedAfter} />
          <TextField label="Créée avant le" type="date" value={createdBefore} onChange={setCreatedBefore} />
          <Checkbox checked={activeOnly} onChange={setActiveOnly}>
            Entreprises actives uniquement
          </Checkbox>
          <Checkbox checked={headOfficeOnly} onChange={setHeadOfficeOnly}>
            Sièges uniquement
          </Checkbox>
          <Checkbox checked={excludeIndividuals} onChange={setExcludeIndividuals}>
            Exclure les entrepreneurs individuels (personnes physiques)
          </Checkbox>
        </fieldset>

        {status ? (
          <div className="space-y-3">
            <Progress done={status.done} total={status.total} label={status.label} />
            <Button variant="secondary" onClick={() => abort.current?.abort()}>
              Interrompre (reprise possible grâce au cache)
            </Button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Upload className="h-5 w-5" />} disabled={!selected.length && !postalCodes.trim()} onClick={() => start(selected)}>
                Lancer l'import {postalCodes.trim() ? '(codes postaux)' : selected.length ? `(${selected.length} département(s))` : ''}
              </Button>
              <Button variant="secondary" onClick={() => start(DEPARTMENT_CODES)}>
                Importer toute la France ({DEPARTMENT_CODES.length} départements)
              </Button>
            </div>
            <p className="text-xs text-muted">Toute la France : plusieurs dizaines de milliers d'établissements, environ 10 à 20 minutes (4 requêtes par seconde pour respecter la source). Les pages déjà récupérées depuis moins de 7 jours sont relues depuis le cache.</p>
            <details className="rounded-xl border border-line p-3" open={selected.length === 0}>
              <summary className="cursor-pointer font-medium">Choisir les départements ({selected.length} sélectionné(s))</summary>
              <div className="mt-3 grid max-h-80 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                {DEPARTMENT_CODES.map((d) => (
                  <label key={d} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 hover:bg-surface-2">
                    <input type="checkbox" checked={selected.includes(d)} onChange={() => toggle(d)} className="h-4 w-4 accent-[var(--brand)]" />
                    <span className="tabular-nums">{d}</span> {DEPARTMENTS[d]![0]}
                    {last[d] && <span className="ml-auto text-xs text-success">✓ {formatDateShort(last[d])}</span>}
                  </label>
                ))}
              </div>
            </details>
          </>
        )}
        {report && <ReportView r={report} />}
      </div>
    </Card>
  );
}

// ─────────────── CSV (import et enrichissement) ───────────────

interface Analysis {
  fileName: string;
  headers: string[];
  rows: string[][];
  mapping: Mapping;
  delimiter: string;
}

function CsvImport({ mode }: { mode: 'create' | 'enrich' }) {
  const { api } = useApp();
  const run = useAction();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [a, setA] = useState<Analysis | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { data: rows = [] } = useQuery((x) => x.allRows(), []);

  const onFile = async (file: File) => {
    setError(null);
    setReport(null);
    if (file.size > 200 * 1024 * 1024) return setError('Fichier trop volumineux (200 Mo maximum). Découpez-le ou filtrez-le par département.');
    const text = await file.text();
    // Lecture découpée : la page reste réactive même avec un gros fichier
    await new Promise((r) => setTimeout(r, 0));
    const parsed = csvProvider.parse(text);
    if (!parsed.headers.length || !parsed.rows.length) return setError('Fichier vide ou illisible. Vérifiez qu’il s’agit bien d’un CSV UTF-8.');
    setA({ fileName: file.name, headers: parsed.headers, rows: parsed.rows, mapping: parsed.mapping, delimiter: parsed.delimiter === '\t' ? 'tabulation' : `« ${parsed.delimiter} »` });
    setStep(2);
  };

  const lines: ImportLine[] = useMemo(() => (a ? csvProvider.toLines({ headers: a.headers, rows: a.rows, delimiter: ';' }, a.mapping, mode === 'create') : []), [a, mode]);

  const analysis = useMemo(() => {
    if (!a) return null;
    const index = new DedupeIndex(rows.map((r) => ({ id: r.id, siret: r.siret, siren: r.siren, phone: r.phone, name: r.name, city: r.city, address: null })));
    let invalid = 0;
    let duplicates = 0;
    let warnings = 0;
    const inFile = new DedupeIndex();
    lines.forEach((l, i) => {
      if (!l.input) return invalid++;
      if (l.errors.length) warnings++;
      const keys = { siret: l.input.siret ?? null, siren: l.input.siren ?? null, phone: l.input.phone ?? null, name: l.input.name ?? '', city: l.input.city ?? null, address: l.input.address ?? null };
      if (index.find(keys) || inFile.find(keys)) duplicates++;
      inFile.add({ id: String(i), ...keys });
    });
    return { invalid, duplicates, warnings };
  }, [a, lines, rows]);

  const doImport = async () => {
    if (!a) return;
    setStep(4);
    setProgress({ done: 0, total: lines.length });
    const r = await run(() =>
      api.importLines(lines, {
        source: mode === 'create' ? 'csv' : 'enrichment',
        label: a.fileName,
        mode,
        onProgress: (done, total) => setProgress({ done, total }),
      }),
    );
    setProgress(null);
    if (r) setReport(r);
  };

  const setMapping = (i: number, key: FieldKey | null) => {
    if (!a) return;
    const m = a.mapping.map((x, j) => (j === i ? key : x === key && key ? null : x));
    setA({ ...a, mapping: m });
  };

  const hasKey = a ? (mode === 'create' ? a.mapping.includes('name') : a.mapping.some((k) => k === 'siren' || k === 'siret' || k === 'name')) : false;

  return (
    <Card>
      <CardTitle icon={mode === 'create' ? <FileSpreadsheet className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}>
        {mode === 'create' ? 'Importer un fichier CSV' : "Fichier d'enrichissement"}
      </CardTitle>
      <ol className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
        {['Fichier', 'Analyse', 'Correspondances', 'Import'].map((s, i) => (
          <li key={s} className={`rounded-full px-3 py-1 ${step === i + 1 ? 'bg-brand text-on-brand' : step > i + 1 ? 'bg-brand-soft text-brand' : 'bg-surface-2 text-muted'}`}>
            {i + 1}. {s}
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="space-y-3 text-sm">
          <p className="text-muted">
            {mode === 'create'
              ? 'CSV en UTF-8, séparateur « , » ou « ; ». Colonnes reconnues : nom, SIREN, SIRET, adresse, CP, ville, département, téléphone, e-mail, site, Google (URL, note, avis), effectif, NAF, activité…'
              : 'Complétez des prospects existants (retrouvés par SIRET, SIREN, téléphone ou nom + ville) avec e-mail, site, Google, réseaux sociaux… Aucune fiche n’est créée ; les valeurs fournies remplacent les anciennes, les cellules vides ne suppriment rien.'}
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-8 text-center hover:border-brand/50">
            <Upload className="h-8 w-8 text-brand" aria-hidden />
            <span className="font-semibold">Choisir un fichier CSV</span>
            <span className="text-muted">Il reste sur votre appareil : rien n'est envoyé.</span>
            <input type="file" accept=".csv,text/csv,.txt" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
          </label>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}

      {step === 2 && a && analysis && (
        <div className="space-y-4 text-sm">
          <p>
            <strong>{a.fileName}</strong> · séparateur {a.delimiter}
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="lignes" value={a.rows.length} />
            <Stat label="colonnes reconnues" value={a.mapping.filter(Boolean).length} />
            <Stat label="lignes invalides" value={analysis.invalid} />
            <Stat label={mode === 'create' ? 'doublons potentiels' : 'prospects retrouvés'} value={analysis.duplicates} />
          </ul>
          {analysis.warnings > 0 && <Alert tone="warning">{nf.format(analysis.warnings)} ligne(s) contiennent une valeur illisible (e-mail, téléphone…) : elle sera ignorée, jamais devinée.</Alert>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>
              Autre fichier
            </Button>
            <Button onClick={() => setStep(3)}>Vérifier les correspondances</Button>
          </div>
        </div>
      )}

      {step === 3 && a && (
        <div className="space-y-4 text-sm">
          <p className="text-muted">Vérifiez à quel champ correspond chaque colonne. « Ignorer » : la colonne n'est pas importée.</p>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full">
              <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Colonne du fichier</th>
                  <th className="px-3 py-2">Exemple</th>
                  <th className="px-3 py-2">Champ</th>
                </tr>
              </thead>
              <tbody>
                {a.headers.map((h, i) => (
                  <tr key={i} className="border-t border-line">
                    <td className="px-3 py-2 font-medium">{h || `Colonne ${i + 1}`}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2 text-muted">{a.rows.find((r) => r[i])?.[i] ?? '—'}</td>
                    <td className="px-3 py-2">
                      <select aria-label={`Champ pour la colonne ${h}`} value={a.mapping[i] ?? ''} onChange={(e) => setMapping(i, (e.target.value || null) as FieldKey | null)} className="min-h-10 w-full rounded-lg border border-line bg-surface px-2">
                        <option value="">Ignorer</option>
                        {FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!hasKey && <Alert tone="warning">{mode === 'create' ? `Associez une colonne au champ « ${FIELD_LABEL.name} ».` : 'Associez au moins une colonne SIREN, SIRET ou nom.'}</Alert>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>
              Retour
            </Button>
            <Button disabled={!hasKey} onClick={doImport}>
              {mode === 'create' ? `Importer ${nf.format(lines.length)} lignes` : `Enrichir (${nf.format(lines.length)} lignes)`}
            </Button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          {progress && <Progress done={progress.done} total={progress.total} />}
          {report && (
            <>
              <ReportView r={report} />
              <Button
                variant="secondary"
                onClick={() => {
                  setA(null);
                  setReport(null);
                  setStep(1);
                }}
              >
                Importer un autre fichier
              </Button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ─────────────── Démo ───────────────

function DemoImport() {
  const { api } = useApp();
  const run = useAction();
  const [report, setReport] = useState<ImportReport | null>(null);
  return (
    <Card>
      <CardTitle icon={<FlaskConical className="h-5 w-5" />}>Données de démonstration</CardTitle>
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          100 entreprises <strong>fictives</strong>, marquées « DONNÉE DE DÉMONSTRATION » (préfixe [DÉMO]) : sans SIREN, e-mails en example.com, téléphones des plages réservées à la fiction. Elles ne peuvent jamais être contactées.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              const r = await run(() => api.importLines(demoLines(100), { source: 'demo', label: 'Démonstration', mode: 'create' }));
              if (r) setReport(r);
            }}
          >
            Charger 100 prospects de démo
          </Button>
          <Button variant="danger" onClick={() => run(() => api.clearWorkspace(true), 'Données de démonstration supprimées')}>
            Supprimer les données de démo
          </Button>
        </div>
        {report && <ReportView r={report} />}
      </div>
    </Card>
  );
}

function ImportHistory() {
  const { data = [] } = useQuery((a) => a.listImports(), []);
  if (!data.length) return null;
  return (
    <Card className="mt-4">
      <CardTitle>Historique des imports</CardTitle>
      <ul className="divide-y divide-line text-sm">
        {data.slice(0, 15).map((r) => (
          <li key={r.id} className="flex flex-wrap justify-between gap-2 py-2">
            <span className="font-medium">{r.label}</span>
            <span className="text-muted">
              {formatDateShort(r.createdAt)} · {nf.format(r.added)} ajoutés · {nf.format(r.duplicates)} doublons · {nf.format(r.invalid)} invalides
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
