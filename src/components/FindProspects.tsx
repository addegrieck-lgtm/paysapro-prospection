// Bloc principal « 🔎 Trouver des prospects » : un minimum de réglages, les options avancées sont repliées.
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { Rocket, Search } from 'lucide-react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Alert, ConfirmDialog } from './ui/Feedback';
import { Checkbox, Chip, SelectField, TextField } from './ui/Form';
import { nf, useAction } from './common';
import { QueueProgressCard } from './enrichment';
import { useApp, useCan } from '../app/context';
import { DEPARTMENT_CODES, DEPARTMENTS, REGIONS } from '../domain/geo';
import { NAF_CHOICES, NAF_LABELS } from '../domain/referentials';
import { HEADCOUNT_BUCKETS } from '../domain/headcount';
import { ProspectingSearchEngine, departmentsOf, type SearchOutcome, type SearchProgress, type SearchRequest, type ZoneKind } from '../data/searchEngine';
import { RechercheEntreprisesProvider } from '../providers/company/RechercheEntreprisesProvider';

type Activity = 'landscaper' | 'naf' | 'free';

export function FindProspects() {
  const { api, companyProvider, queue, settings } = useApp();
  const run = useAction();
  const canImport = useCan('prospecting.import');
  const [activity, setActivity] = useState<Activity>('landscaper');
  const [naf, setNaf] = useState(settings.nafCodes[0] ?? '81.30Z');
  const [q, setQ] = useState('');
  const [zone, setZone] = useState<ZoneKind>(settings.targetDepartments.length ? 'department' : 'france');
  const [region, setRegion] = useState('28');
  const [department, setDepartment] = useState(settings.targetDepartments[0] ?? '76');
  const [postalCode, setPostalCode] = useState('');
  const [city, setCity] = useState('');
  const [activeOnly, setActiveOnly] = useState(true);
  const [relevantOnly, setRelevantOnly] = useState(true);
  const [establishmentType, setEstablishmentType] = useState<'all' | 'head' | 'secondary'>('all');
  const [buckets, setBuckets] = useState<string[]>([]);
  const [createdAfter, setCreatedAfter] = useState('');
  const [excludeIndividuals, setExcludeIndividuals] = useState(settings.excludeIndividuals);
  const [enrichAfter, setEnrichAfter] = useState(true);
  const [maxPhones, setMaxPhones] = useState(true);
  const [progress, setProgress] = useState<SearchProgress | null>(null);
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [confirmBig, setConfirmBig] = useState(false);
  const running = useRef(false);
  const engine = useMemo(() => new ProspectingSearchEngine(api, companyProvider as RechercheEntreprisesProvider, queue), [api, companyProvider, queue]);

  const request: SearchRequest = {
    activity: { mode: activity, nafCodes: activity === 'naf' ? [naf] : [], q: q.trim() || undefined },
    zone: {
      kind: zone,
      value: zone === 'region' ? region : zone === 'department' ? department : zone === 'postalCode' ? postalCode.trim() : zone === 'city' ? city.trim() : undefined,
      department: zone === 'city' ? department : undefined,
    },
    activeOnly,
    relevantOnly,
    establishmentType,
    headcountBuckets: buckets,
    createdAfter: createdAfter || null,
    excludeIndividuals,
    enrichAfter,
    maxPhones,
  };
  const deps = departmentsOf(request.zone);
  const invalid = (activity === 'free' && !q.trim()) || (zone === 'postalCode' && !/^\d{5}$/.test(postalCode.trim())) || (zone === 'city' && !city.trim()) || (activity !== 'free' && !deps.length);

  /** Recherche large (plusieurs départements) : confirmation obligatoire, jamais de lancement massif par erreur. */
  const massive = activity !== 'free' && deps.length > 1;
  const launch = async () => {
    if (running.current) return; // un seul lancement à la fois
    running.current = true;
    setConfirmBig(false);
    setOutcome(null);
    abort.current = new AbortController();
    const r = await run(() => engine.run(request, setProgress, abort.current!.signal));
    setProgress(null);
    running.current = false;
    if (r) setOutcome(r);
  };

  if (!canImport) return null;

  return (
    <Card>
      <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
        <Search className="h-5 w-5 text-brand" aria-hidden /> Trouver des prospects
      </h2>
      <p className="mb-4 text-sm text-muted">Données publiques officielles (SIRENE), puis recherche automatique des coordonnées professionnelles disponibles.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Activité"
          value={activity}
          onChange={(v) => setActivity(v as Activity)}
          options={[
            { value: 'landscaper', label: 'Paysagiste (aménagement paysager, 81.30Z)' },
            { value: 'naf', label: 'Code NAF…' },
            { value: 'free', label: 'Recherche libre (nom, mot-clé)' },
          ]}
        />
        {activity === 'naf' && <SelectField label="Code NAF" value={naf} onChange={setNaf} options={NAF_CHOICES.map((c) => ({ value: c, label: `${c} — ${NAF_LABELS[c]}` }))} />}
        {activity === 'free' && <TextField label="Mots-clés" value={q} onChange={setQ} placeholder="Ex. jardins, élagage…" />}
        <SelectField
          label="Zone"
          value={zone}
          onChange={(v) => setZone(v as ZoneKind)}
          options={[
            { value: 'france', label: 'France entière' },
            { value: 'region', label: 'Région' },
            { value: 'department', label: 'Département' },
            { value: 'postalCode', label: 'Code postal' },
            { value: 'city', label: 'Ville' },
          ]}
        />
        {zone === 'region' && <SelectField label="Région" value={region} onChange={setRegion} options={Object.entries(REGIONS).map(([c, n]) => ({ value: c, label: n }))} />}
        {(zone === 'department' || zone === 'city') && (
          <SelectField label="Département" value={department} onChange={setDepartment} options={DEPARTMENT_CODES.map((d) => ({ value: d, label: `${d} — ${DEPARTMENTS[d]![0]}` }))} />
        )}
        {zone === 'postalCode' && <TextField label="Code postal" value={postalCode} onChange={setPostalCode} inputMode="numeric" placeholder="76000" />}
        {zone === 'city' && <TextField label="Ville" value={city} onChange={setCity} placeholder="Rouen" />}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6">
        <Checkbox checked={activeOnly} onChange={setActiveOnly}>
          Entreprises actives
        </Checkbox>
        <Checkbox checked={relevantOnly} onChange={setRelevantOnly}>
          Établissements pertinents
        </Checkbox>
        <Checkbox checked={enrichAfter} onChange={setEnrichAfter}>
          Enrichir automatiquement (téléphones, e-mails, sites)
        </Checkbox>
      </div>

      <details className="mt-2 rounded-xl border border-line p-3 text-sm">
        <summary className="cursor-pointer font-medium">Filtres avancés</summary>
        <div className="mt-3 space-y-3">
          <div>
            <p className="mb-1.5 font-medium">Effectif (tranches INSEE)</p>
            <div className="flex flex-wrap gap-2">
              {HEADCOUNT_BUCKETS.map((b) => (
                <Chip key={b.id} selected={buckets.includes(b.id)} onClick={() => setBuckets(buckets.includes(b.id) ? buckets.filter((x) => x !== b.id) : [...buckets, b.id])}>
                  {b.label}
                </Chip>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted">Beaucoup de petites entreprises n'ont pas d'effectif renseigné : filtrer par effectif les exclut.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectField
              label="Type d'établissement"
              value={establishmentType}
              onChange={(v) => setEstablishmentType(v as typeof establishmentType)}
              options={[
                { value: 'all', label: 'Tous' },
                { value: 'head', label: 'Sièges uniquement' },
                { value: 'secondary', label: 'Établissements secondaires' },
              ]}
            />
            <TextField label="Créée après le" type="date" value={createdAfter} onChange={setCreatedAfter} />
            <div className="self-end">
              <Checkbox checked={excludeIndividuals} onChange={setExcludeIndividuals}>
                Exclure les entrepreneurs individuels
              </Checkbox>
            </div>
          </div>
          <Checkbox checked={maxPhones} onChange={setMaxPhones}>
            📞 Maximiser les téléphones (toutes les sources configurées, même pour les fiches déjà enrichies)
          </Checkbox>
        </div>
      </details>

      {progress ? (
        <div className="mt-4 space-y-2" role="status" aria-live="polite">
          <p className="font-semibold">Recherche des entreprises…</p>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} />
          </div>
          <p className="text-sm text-muted">
            {progress.label} · {nf.format(progress.found)} entreprise(s) retenue(s)
          </p>
          <Button size="sm" variant="secondary" onClick={() => abort.current?.abort()}>
            Interrompre
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="lg" icon={<Rocket className="h-5 w-5" />} disabled={invalid} onClick={() => (massive ? setConfirmBig(true) : launch())}>
            Lancer la recherche
          </Button>
          <span className="text-sm text-muted">
            {activity !== 'free' && deps.length > 1 && `${deps.length} départements · `}
            {zone === 'france' && 'toute la France : environ 10 à 20 minutes de recherche, puis enrichissement progressif'}
          </span>
        </div>
      )}

      {outcome && (
        <div className="mt-4 space-y-3">
          <Alert tone="success" title="Entreprises trouvées">
            {nf.format(outcome.report.added)} nouvelle(s), {nf.format(outcome.report.duplicates)} déjà présente(s) (dédoublonnées)
            {(outcome.report.candidates ?? 0) > 0 && (
              <>
                , {nf.format(outcome.report.candidates ?? 0)} <Link to="/duplicates" className="font-semibold underline">doublon(s) potentiel(s) à vérifier</Link>
              </>
            )}
            .{' '}
            {outcome.enqueued > 0 ? `${nf.format(outcome.enqueued)} entreprise(s) en cours d'enrichissement.` : ''}{' '}
            <Link to="/prospects" className="font-semibold underline">
              Voir les prospects
            </Link>
          </Alert>
        </div>
      )}
      <div className="mt-3 empty:hidden">
        <QueueProgressCard />
      </div>
      <ConfirmDialog
        open={confirmBig}
        title="Lancer une recherche large ?"
        message={
          <>
            <p>
              La recherche va parcourir <strong>{deps.length} départements</strong>
              {zone === 'france' ? ' (toute la France : plusieurs dizaines de milliers d’entreprises, 10 à 20 minutes)' : ' (plusieurs milliers d’entreprises possibles)'}.
            </p>
            {enrichAfter && <p>Chaque entreprise trouvée sera ensuite enrichie progressivement (plusieurs secondes par entreprise, en arrière-plan).</p>}
            <p>Conseil : testez d'abord sur un code postal ou un département.</p>
          </>
        }
        confirmLabel="Lancer la recherche"
        onClose={() => setConfirmBig(false)}
        onConfirm={() => void launch()}
      />
    </Card>
  );
}
