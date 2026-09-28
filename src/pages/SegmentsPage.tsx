import { useState } from 'react';
import { Link } from 'react-router';
import { Filter, Pencil, Plus, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { ConfirmDialog, EmptyState } from '../components/ui/Feedback';
import { SidePanel } from '../components/ui/Extras';
import { TextArea, TextField } from '../components/ui/Form';
import { IconButton } from '../components/ui/Button';
import { FilterPanel } from '../components/FilterPanel';
import { formatDateShort, nf, useAction } from '../components/common';
import { useApp, useCan, useQuery } from '../app/context';
import { describeFilter } from '../domain/filters';
import type { ProspectFilter, Segment } from '../domain/types';

/** Suggestions prêtes à l'emploi (créées en un clic, modifiables ensuite). */
const SUGGESTIONS: { name: string; description: string; filter: ProspectFilter }[] = [
  { name: 'Paysagistes prioritaires', description: 'Score ≥ 80', filter: { scoreMin: 80 } },
  { name: 'Sans site internet', description: 'Site absent', filter: { hasWebsite: 'no' } },
  { name: 'Grosses structures', description: 'Effectif ≥ 5', filter: { headcountMin: 5 } },
  { name: 'Très visibles sur Google', description: 'Plus de 50 avis', filter: { reviewsMin: 50 } },
  { name: 'Entreprises avec téléphone', description: 'Téléphone disponible', filter: { hasPhone: 'yes' } },
  { name: 'Entreprises sans e-mail', description: 'E-mail à trouver', filter: { hasEmail: 'no' } },
  { name: 'Paysagistes Normandie', description: 'Région Normandie', filter: { regions: ['28'] } },
  { name: 'Seine-Maritime', description: 'Département 76', filter: { departments: ['76'] } },
  { name: 'À relancer', description: "Prochaine relance ≤ aujourd'hui", filter: { followUpDue: true } },
];

export function SegmentsPage() {
  const { api } = useApp();
  const run = useAction();
  const canEdit = useCan('prospecting.edit');
  const { data } = useQuery(async (a) => {
    const segs = await a.listSegments();
    return Promise.all(segs.map(async (s) => ({ ...s, count: await a.countMatching(s.filter) })));
  }, []);
  const [editing, setEditing] = useState<Partial<Segment> | null>(null);
  const [remove, setRemove] = useState<Segment | null>(null);
  const existing = new Set(data?.map((s) => s.name));

  return (
    <>
      <PageHeader
        title="Segments"
        subtitle="Groupes dynamiques : leur contenu se met à jour automatiquement."
        actions={canEdit && <Button size="sm" icon={<Plus className="h-5 w-5" />} onClick={() => setEditing({ name: '', description: '', filter: {} })}>Nouveau</Button>}
      />
      {data && data.length === 0 && (
        <EmptyState icon={<Filter className="h-7 w-7" />} title="Aucun segment">
          Créez-en un ou partez d'une suggestion ci-dessous. Vous pouvez aussi enregistrer les filtres de la liste des prospects.
        </EmptyState>
      )}
      <ul className="grid gap-3 md:grid-cols-2">
        {data?.map((s) => (
          <li key={s.id}>
            <Card className="h-full">
              <div className="flex items-start gap-2">
                <Link to={`/prospects?segment=${s.id}`} className="min-w-0 flex-1">
                  <h2 className="font-semibold text-ink hover:text-brand">{s.name}</h2>
                  {s.description && <p className="text-sm text-muted">{s.description}</p>}
                  <p className="mt-2 text-sm">{describeFilter(s.filter)}</p>
                  <p className="mt-2 text-xs text-muted">
                    <strong className="text-base text-ink tabular-nums">{nf.format(s.count)}</strong> prospect(s) · créé le {formatDateShort(s.createdAt)}
                  </p>
                </Link>
                {canEdit && (
                  <div className="flex">
                    <IconButton label="Modifier" onClick={() => setEditing(s)}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label="Supprimer" onClick={() => setRemove(s)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      {canEdit && (
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Suggestions</h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.filter((s) => !existing.has(s.name)).map((s) => (
              <Button key={s.name} size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => run(() => api.saveSegment(s), `Segment « ${s.name} » créé`)}>
                {s.name}
              </Button>
            ))}
          </div>
        </section>
      )}

      {editing && <SegmentEditor segment={editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={!!remove}
        title="Supprimer ce segment ?"
        message="Les prospects ne sont pas supprimés, seulement le regroupement."
        confirmLabel="Supprimer"
        danger
        onClose={() => setRemove(null)}
        onConfirm={async () => {
          if (remove) await run(() => api.deleteSegment(remove.id), 'Segment supprimé');
          setRemove(null);
        }}
      />
    </>
  );
}

function SegmentEditor({ segment, onClose }: { segment: Partial<Segment>; onClose: () => void }) {
  const { api } = useApp();
  const run = useAction();
  const [name, setName] = useState(segment.name ?? '');
  const [description, setDescription] = useState(segment.description ?? '');
  const [filter, setFilter] = useState<ProspectFilter>(segment.filter ?? {});
  const { data: count } = useQuery((a) => a.countMatching(filter), [filter]);
  return (
    <SidePanel
      open
      onClose={onClose}
      title={segment.id ? 'Modifier le segment' : 'Nouveau segment'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button
            block
            disabled={!name.trim()}
            onClick={async () => {
              if (await run(() => api.saveSegment({ id: segment.id, name, description, filter }), 'Segment enregistré')) onClose();
            }}
          >
            Enregistrer ({count !== undefined ? nf.format(count) : '…'} prospects)
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <TextField label="Nom" value={name} onChange={setName} />
        <TextArea label="Description" value={description} onChange={setDescription} rows={2} />
        <FilterPanel value={filter} onChange={setFilter} />
      </div>
    </SidePanel>
  );
}
