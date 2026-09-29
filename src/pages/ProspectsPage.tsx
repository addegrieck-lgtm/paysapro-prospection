import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AlarmClock, Download, Eye, Filter as FilterIcon, Flame, Globe, Mail, Phone, Plus, Save, Search, Sparkles, StickyNote, Users, X } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState, Dialog, useToast } from '../components/ui/Feedback';
import { Checkbox, TextField, TextArea } from '../components/ui/Form';
import { EnrichmentBadge, QueueProgressCard } from '../components/enrichment';
import { SidePanel, Skeleton } from '../components/ui/Extras';
import { FilterPanel } from '../components/FilterPanel';
import { DemoTag, Pagination, ScoreBadge, StatusBadge, formatDateShort, nf, useAction } from '../components/common';
import { MessageDialog, NoteDialog, TaskDialog } from '../components/dialogs';
import { useApp, useCan, useDebounced, useQuery } from '../app/context';
import { activeFilterCount, describeFilter, SORT_LABEL } from '../domain/filters';
import { googleSearchUrl, telUrl } from '../domain/links';
import { formatPhone } from '../domain/normalize';
import { DEFAULT_EXPORT_COLUMNS, EXPORT_COLUMNS, downloadText, exportProspectsCsv, stampedName } from '../data/export';
import type { Prospect, ProspectFilter, ProspectRow, ProspectStatus, SortKey } from '../domain/types';

const PAGE_SIZE = 50;

type RowAction = 'message' | 'note' | 'task';

export function ProspectsPage() {
  const { api, queue } = useApp();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const run = useAction();
  const toast = useToast();
  const canEdit = useCan('prospecting.edit');
  const [exportTarget, setExportTarget] = useState<{ ids: string[]; label: string } | null>(null);
  const canExport = useCan('prospecting.export');
  const canCreate = useCan('prospecting.create');
  const priorityView = params.get('view') === 'priority';
  const segmentId = params.get('segment');

  const [q, setQ] = useState('');
  const debouncedQ = useDebounced(q, 200);
  const [filter, setFilter] = useState<ProspectFilter>(() => {
    const status = params.get('status') as ProspectStatus | null;
    return status ? { statuses: [status] } : {};
  });
  const [sort, setSort] = useState<SortKey>('score');
  const [page, setPage] = useState(1);
  const [panel, setPanel] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saveSeg, setSaveSeg] = useState(false);
  const [action, setAction] = useState<{ kind: RowAction; prospect: Prospect } | null>(null);

  const { data: segment } = useQuery((a) => (segmentId ? a.getSegment(segmentId) : Promise.resolve(undefined)), [segmentId]);
  useEffect(() => {
    if (segment) setFilter(segment.filter);
  }, [segment]);

  const effective: ProspectFilter = useMemo(
    () => ({ ...filter, q: debouncedQ || undefined, ...(priorityView ? { scoreMin: Math.max(80, filter.scoreMin ?? 0) } : {}) }),
    [filter, debouncedQ, priorityView],
  );
  useEffect(() => setPage(1), [effective, sort]);

  const { data, loading } = useQuery((a) => a.listProspects({ filter: effective, sort, page, pageSize: PAGE_SIZE }), [effective, sort, page]);
  const count = activeFilterCount(filter);

  const openAction = async (kind: RowAction, id: string) => {
    const p = await api.getProspect(id);
    if (p) setAction({ kind, prospect: p });
  };

  const exportIds = (ids: string[], label: string) => setExportTarget({ ids, label });

  /** Enrichissement progressif via la file (respect des limites de l'API gratuite). */
  const enrichRows = async (ids: string[]) => {
    const n = await run(() => queue.add(ids, true));
    if (n !== undefined) toast(n ? `${nf.format(n)} prospect(s) ajouté(s) à la file d'enrichissement` : 'Déjà en cours d’enrichissement', n ? 'success' : 'info');
  };

  const allOnPage = data?.items.every((r) => selected.has(r.id)) && (data?.items.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title={priorityView ? '🔥 Mes prospects prioritaires' : segment ? segment.name : 'Prospects'}
        subtitle={data ? `${nf.format(data.total)} prospect${data.total > 1 ? 's' : ''}${segment ? ` · segment : ${describeFilter(segment.filter)}` : ''}` : ' '}
        actions={
          canCreate && (
            <ButtonLink to="/prospects/new" icon={<Plus className="h-5 w-5" />} size="sm">
              <span className="hidden sm:inline">Nouveau</span>
            </ButtonLink>
          )
        }
      />

      {/* Barre de recherche et outils */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-[1_1_16rem]">
          <span className="sr-only">Rechercher</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Entreprise, SIREN, SIRET, ville, CP, département, téléphone…"
            className="min-h-12 w-full rounded-xl border border-line bg-surface pl-11 pr-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
          />
        </label>
        <Button variant="secondary" onClick={() => setPanel(true)} icon={<FilterIcon className="h-5 w-5" />}>
          Filtres{count ? ` (${count})` : ''}
        </Button>
        <label className="flex-[0_1_14rem]">
          <span className="sr-only">Trier</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="min-h-12 w-full rounded-xl border border-line bg-surface px-3">
            {Object.entries(SORT_LABEL).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={priorityView ? 'primary' : 'soft'}
          icon={<Flame className="h-4 w-4" />}
          onClick={() => {
            const p = new URLSearchParams(params);
            if (priorityView) p.delete('view');
            else p.set('view', 'priority');
            setParams(p);
          }}
        >
          Mes prospects prioritaires
        </Button>
        <div className="flex gap-1" role="group" aria-label="Qualification">
          {[80, 60, 40, null].map((min) => (
            <button
              key={String(min)}
              type="button"
              aria-pressed={(filter.scoreMin ?? null) === min}
              onClick={() => setFilter({ ...filter, scoreMin: min })}
              className={`min-h-10 rounded-full border px-3 text-sm font-medium ${(filter.scoreMin ?? null) === min ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface hover:border-brand/50'}`}
            >
              {min === null ? 'Tous' : `Score ${min}+`}
            </button>
          ))}
        </div>
        {count > 0 && (
          <>
            <span className="text-sm text-muted">{describeFilter(filter)}</span>
            <Button size="sm" variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setFilter({})}>
              Effacer
            </Button>
            <Button size="sm" variant="ghost" icon={<Save className="h-4 w-4" />} onClick={() => setSaveSeg(true)}>
              Enregistrer comme segment
            </Button>
          </>
        )}
        {canExport && data && data.total > 0 && (
          <Button size="sm" variant="ghost" icon={<Download className="h-4 w-4" />} onClick={async () => exportIds(await api.matchingIds(effective, sort), 'filtres')} className="ml-auto">
            Exporter ({nf.format(data.total)})
          </Button>
        )}
      </div>

      <div className="mb-3 empty:hidden">
        <QueueProgressCard compact />
      </div>

      {/* Actions groupées */}
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand/30 bg-brand-soft p-2 pl-4 lg:top-2">
          <span className="font-semibold text-brand">{nf.format(selected.size)} sélectionné(s)</span>
          {data && selected.size < data.total && (
            <Button size="sm" variant="ghost" onClick={async () => setSelected(new Set(await api.matchingIds(effective, sort)))}>
              Tout sélectionner ({nf.format(data.total)})
            </Button>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={() => enrichRows([...selected])}>
                Enrichir la sélection
              </Button>
            )}
            {canExport && (
              <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => exportIds([...selected], 'selection')}>
                Exporter la sélection
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Désélectionner
            </Button>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : data && data.total === 0 ? (
        <EmptyState icon={<Users className="h-7 w-7" />} title={count || q || priorityView ? 'Aucun prospect ne correspond' : 'Aucun prospect pour le moment'} action={!count && !q && <ButtonLink to="/import">Importer des paysagistes</ButtonLink>}>
          {count || q || priorityView ? 'Modifiez la recherche ou les filtres.' : 'Importez les paysagistes depuis SIRENE, un fichier CSV, ou chargez les données de démonstration.'}
        </EmptyState>
      ) : (
        data && (
          <>
            {/* Tableau (tablette paysage et ordinateur) */}
            <div className="hidden overflow-x-auto rounded-2xl border border-line bg-surface shadow-card xl:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="w-10 px-3 py-2.5">
                      <input
                        type="checkbox"
                        aria-label="Sélectionner la page"
                        checked={!!allOnPage}
                        onChange={() => {
                          const next = new Set(selected);
                          data.items.forEach((r) => (allOnPage ? next.delete(r.id) : next.add(r.id)));
                          setSelected(next);
                        }}
                        className="h-4 w-4 accent-[var(--brand)]"
                      />
                    </th>
                    <th className="px-2 py-2.5">Score</th>
                    <th className="px-2 py-2.5">Entreprise</th>
                    <th className="px-2 py-2.5">Ville · Dép.</th>
                    <th className="hidden px-2 py-2.5 min-[1400px]:table-cell">NAF</th>
                    <th className="hidden px-2 py-2.5 2xl:table-cell">SIRET</th>
                    <th className="hidden px-2 py-2.5 min-[1400px]:table-cell">E-mail</th>
                    <th className="px-2 py-2.5">Téléphone</th>
                    <th className="px-2 py-2.5">Site</th>
                    <th className="px-2 py-2.5">Enrichissement</th>
                    <th className="px-2 py-2.5">Statut</th>
                    <th className="hidden px-2 py-2.5 2xl:table-cell">Relance</th>
                    <th className="px-2 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((r) => (
                    <tr key={r.id} className={`border-b border-line/70 last:border-0 hover:bg-surface-2/60 ${r.doNotContact ? 'opacity-60' : ''}`}>
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={`Sélectionner ${r.name}`}
                          checked={selected.has(r.id)}
                          onChange={() => {
                            const next = new Set(selected);
                            if (next.has(r.id)) next.delete(r.id);
                            else next.add(r.id);
                            setSelected(next);
                          }}
                          className="h-4 w-4 accent-[var(--brand)]"
                        />
                      </td>
                      <td className="px-2 py-2">
                        <ScoreBadge score={r.score} />
                      </td>
                      <td className="min-w-[13rem] max-w-[18rem] px-2 py-2">
                        <Link to={`/prospects/${r.id}`} className="font-semibold text-ink hover:text-brand">
                          {r.name}
                        </Link>{' '}
                        {r.demo && <DemoTag />}
                      </td>
                      <td className="px-2 py-2">
                        {r.city ?? <NA />}
                        {r.department && <span className="text-muted"> · {r.department}</span>}
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2 tabular-nums min-[1400px]:table-cell">{r.nafCode ?? <NA />}</td>
                      <td className="hidden whitespace-nowrap px-2 py-2 tabular-nums 2xl:table-cell">{r.siret ?? <NA />}</td>
                      <td className="hidden max-w-[11rem] truncate px-2 py-2 min-[1400px]:table-cell" title={r.email ?? undefined}>{r.email ?? <NA />}</td>
                      <td className="whitespace-nowrap px-2 py-2 tabular-nums">{r.phone ? formatPhone(r.phone) : <NA />}</td>
                      <td className="px-2 py-2">
                        {r.website ? (
                          <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">
                            Oui
                          </a>
                        ) : (
                          <NA />
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <EnrichmentBadge status={r.enrichmentStatus} short />
                      </td>
                      <td className="px-2 py-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="hidden whitespace-nowrap px-2 py-2 tabular-nums 2xl:table-cell">{formatDateShort(r.nextFollowUpAt)}</td>
                      <td className="px-2 py-1">
                        <RowActions row={r} onAction={openAction} onEnrich={enrichRows} onView={() => navigate(`/prospects/${r.id}`)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Cartes (téléphone) */}
            <ul className="grid gap-2 sm:grid-cols-2 sm:gap-3 xl:hidden">
              {data.items.map((r) => (
                <li key={r.id} className={`flex flex-col justify-between rounded-2xl border border-line bg-surface p-3 shadow-card ${r.doNotContact ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${r.name}`}
                      checked={selected.has(r.id)}
                      onChange={() => {
                        const next = new Set(selected);
                        if (next.has(r.id)) next.delete(r.id);
                        else next.add(r.id);
                        setSelected(next);
                      }}
                      className="mt-1 h-5 w-5 accent-[var(--brand)]"
                    />
                    <Link to={`/prospects/${r.id}`} className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-semibold leading-snug text-ink">
                          {r.name} {r.demo && <DemoTag />}
                        </span>
                        <ScoreBadge score={r.score} />
                      </div>
                      <div className="mt-0.5 text-sm text-muted">
                        {[r.city, r.department].filter(Boolean).join(' · ') || 'Localisation non disponible'}
                        {r.googleReviews !== null && ` · ${r.googleReviews} avis`}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {[r.phone ? '☎ Téléphone' : null, r.email ? '✉ E-mail' : null, r.website ? '🌐 Site' : null].filter(Boolean).join(' · ') || 'Coordonnées non disponibles'}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <StatusBadge status={r.status} />
                        <EnrichmentBadge status={r.enrichmentStatus} short />
                        {r.nextFollowUpAt && <span>Relance {formatDateShort(r.nextFollowUpAt)}</span>}
                      </div>
                    </Link>
                  </div>
                  <div className="mt-2 border-t border-line/70 pt-2">
                    <RowActions row={r} onAction={openAction} onEnrich={enrichRows} onView={() => navigate(`/prospects/${r.id}`)} spread />
                  </div>
                </li>
              ))}
            </ul>
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
          </>
        )
      )}

      <SidePanel
        open={panel}
        onClose={() => setPanel(false)}
        title="Filtres"
        footer={
          <>
            <Button variant="secondary" onClick={() => setFilter({})}>
              Réinitialiser
            </Button>
            <Button block onClick={() => setPanel(false)}>
              Voir {data ? nf.format(data.total) : ''} prospect(s)
            </Button>
          </>
        }
      >
        <FilterPanel value={filter} onChange={setFilter} />
      </SidePanel>

      <SaveSegmentDialog open={saveSeg} onClose={() => setSaveSeg(false)} filter={effective} />
      {exportTarget && <ExportDialog ids={exportTarget.ids} label={exportTarget.label} onClose={() => setExportTarget(null)} />}

      {action?.kind === 'message' && <MessageDialog open onClose={() => setAction(null)} prospect={action.prospect} />}
      {action?.kind === 'note' && <NoteDialog open onClose={() => setAction(null)} prospectId={action.prospect.id} />}
      {action?.kind === 'task' && <TaskDialog open onClose={() => setAction(null)} prospectId={action.prospect.id} />}
    </>
  );
}

function NA() {
  return <span className="text-muted/70" title="Non disponible">—</span>;
}

function RowActions({
  row,
  onAction,
  onEnrich,
  onView,
  spread,
}: {
  row: ProspectRow;
  onAction: (k: RowAction, id: string) => void;
  onEnrich: (ids: string[]) => void;
  onView: () => void;
  spread?: boolean;
}) {
  const tel = telUrl(row.phone);
  const blocked = row.doNotContact || row.demo;
  const cls = 'inline-flex h-9 w-9 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-brand disabled:opacity-30';
  const busy = row.enrichmentStatus === 'pending' || row.enrichmentStatus === 'processing';
  return (
    <div className={`flex items-center ${spread ? 'justify-between' : 'justify-end gap-0.5'}`}>
      {tel && !blocked ? (
        <a href={tel} className={cls} aria-label={`Appeler ${row.name}`} title="Appeler">
          <Phone className="h-[18px] w-[18px]" />
        </a>
      ) : (
        <button type="button" disabled className={cls} aria-label="Téléphone non disponible" title="Téléphone non disponible">
          <Phone className="h-[18px] w-[18px]" />
        </button>
      )}
      <button type="button" className={cls} disabled={blocked} onClick={() => onAction('message', row.id)} aria-label={`Préparer un message pour ${row.name}`} title="E-mail / message">
        <Mail className="h-[18px] w-[18px]" />
      </button>
      <button
        type="button"
        className={cls}
        disabled={row.demo || busy}
        onClick={() => onEnrich([row.id])}
        aria-label={`${row.enrichedAt ? 'Réenrichir' : 'Enrichir'} ${row.name}`}
        title={busy ? 'Enrichissement en cours' : row.enrichedAt ? 'Réenrichir' : 'Enrichir'}
      >
        <Sparkles className="h-[18px] w-[18px]" />
      </button>
      <a href={googleSearchUrl({ name: row.name, tradeName: null, city: row.city })} target="_blank" rel="noopener noreferrer" className={cls} aria-label={`Rechercher ${row.name} sur le web`} title="Rechercher sur le web">
        <Globe className="h-[18px] w-[18px]" />
      </a>
      <button type="button" className={cls} onClick={() => onAction('note', row.id)} aria-label={`Ajouter une note à ${row.name}`} title="Note">
        <StickyNote className="h-[18px] w-[18px]" />
      </button>
      <button type="button" className={cls} disabled={row.doNotContact} onClick={() => onAction('task', row.id)} aria-label={`Planifier une relance pour ${row.name}`} title="Relancer">
        <AlarmClock className="h-[18px] w-[18px]" />
      </button>
      <button type="button" className={cls} onClick={onView} aria-label={`Voir la fiche de ${row.name}`} title="Voir">
        <Eye className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}

const EXPORT_PREF = 'prospection-export-columns';

function loadColumns(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(EXPORT_PREF) ?? 'null') as unknown;
    if (Array.isArray(saved) && saved.length) return saved.filter((c): c is string => typeof c === 'string');
  } catch {
    /* préférence illisible : colonnes par défaut */
  }
  return DEFAULT_EXPORT_COLUMNS;
}

/** Export CSV (compatible Excel) avec choix des colonnes. */
function ExportDialog({ ids, label, onClose }: { ids: string[]; label: string; onClose: () => void }) {
  const { api } = useApp();
  const run = useAction();
  const [cols, setCols] = useState<string[]>(loadColumns);
  const all = EXPORT_COLUMNS.map(([h]) => h);
  const doExport = async () => {
    try {
      localStorage.setItem(EXPORT_PREF, JSON.stringify(cols));
    } catch {
      /* navigation privée : préférence non mémorisée */
    }
    const csv = await run(() => exportProspectsCsv(api, ids, cols));
    if (csv) {
      downloadText(csv, stampedName(`prospects-${label}`, 'csv'));
      onClose();
    }
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Exporter ${nf.format(ids.length)} prospect(s)`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button icon={<Download className="h-5 w-5" />} disabled={!cols.length} onClick={doExport}>
            Exporter en CSV (Excel)
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">Fichier CSV lisible directement par Excel (séparateur « ; », accents conservés). Choisissez les colonnes :</p>
      <div className="mb-2 flex gap-2">
        <Button size="sm" variant="ghost" onClick={() => setCols(all)}>
          Toutes
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCols(DEFAULT_EXPORT_COLUMNS)}>
          Par défaut
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCols([])}>
          Aucune
        </Button>
      </div>
      <div className="grid gap-x-4 sm:grid-cols-2">
        {all.map((c) => (
          <Checkbox key={c} checked={cols.includes(c)} onChange={(v) => setCols(v ? all.filter((x) => x === c || cols.includes(x)) : cols.filter((x) => x !== c))}>
            {c}
          </Checkbox>
        ))}
      </div>
    </Dialog>
  );
}

export function SaveSegmentDialog({ open, onClose, filter }: { open: boolean; onClose: () => void; filter: ProspectFilter }) {
  const { api } = useApp();
  const run = useAction();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enregistrer comme segment"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            disabled={!name.trim()}
            onClick={async () => {
              const s = await run(() => api.saveSegment({ name, description, filter }), 'Segment enregistré');
              if (s) {
                onClose();
                navigate('/segments');
              }
            }}
          >
            Enregistrer
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted">Critères : {describeFilter(filter)}. Le segment est dynamique : il se met à jour automatiquement.</p>
        <TextField label="Nom" value={name} onChange={setName} placeholder="Ex. Paysagistes prioritaires 76" />
        <TextArea label="Description" value={description} onChange={setDescription} rows={2} />
      </div>
    </Dialog>
  );
}
