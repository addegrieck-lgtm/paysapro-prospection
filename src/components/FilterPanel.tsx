// Panneau de filtres (base de prospects, segments).
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Chip, Checkbox, NumberField, SelectField, TextField, Segmented } from './ui/Form';
import type { EnrichmentStatus, Presence, ProspectFilter, ProspectStatus, ServiceTag } from '../domain/types';
import { ENRICHMENT_LABEL } from '../domain/enrichment';
import { HEADCOUNT_BUCKETS } from '../domain/headcount';
import { DEPARTMENT_CODES, DEPARTMENTS, REGIONS } from '../domain/geo';
import { SERVICES, STATUSES } from '../domain/referentials';

function toggle<T>(list: T[] | undefined, v: T): T[] {
  const l = list ?? [];
  return l.includes(v) ? l.filter((x) => x !== v) : [...l, v];
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2 border-b border-line pb-4 last:border-0">
      <legend className="mb-2 text-sm font-semibold text-ink">{title}</legend>
      {children}
    </fieldset>
  );
}

const PRESENCE: { value: Presence; label: string }[] = [
  { value: 'any', label: 'Peu importe' },
  { value: 'yes', label: 'Avec' },
  { value: 'no', label: 'Sans' },
];

export function FilterPanel({ value, onChange }: { value: ProspectFilter; onChange: (f: ProspectFilter) => void }) {
  const set = (patch: Partial<ProspectFilter>) => onChange({ ...value, ...patch });
  const deptOptions = [{ value: '', label: 'Ajouter un département…' }, ...DEPARTMENT_CODES.filter((c) => !value.departments?.includes(c)).map((c) => ({ value: c, label: `${c} — ${DEPARTMENTS[c]![0]}` }))];
  const regionOptions = [{ value: '', label: 'Ajouter une région…' }, ...Object.entries(REGIONS).filter(([c]) => !value.regions?.includes(c)).map(([c, n]) => ({ value: c, label: n }))];

  return (
    <div className="space-y-4">
      <Group title="Localisation">
        <SelectField label="Région" value="" onChange={(v) => v && set({ regions: [...(value.regions ?? []), v] })} options={regionOptions} />
        <SelectField label="Département" value="" onChange={(v) => v && set({ departments: [...(value.departments ?? []), v] })} options={deptOptions} />
        <div className="flex flex-wrap gap-1.5">
          {value.regions?.map((r) => (
            <RemovableTag key={r} onRemove={() => set({ regions: toggle(value.regions, r) })}>
              {REGIONS[r] ?? r}
            </RemovableTag>
          ))}
          {value.departments?.map((d) => (
            <RemovableTag key={d} onRemove={() => set({ departments: toggle(value.departments, d) })}>
              {d} — {DEPARTMENTS[d]?.[0] ?? d}
            </RemovableTag>
          ))}
        </div>
        <TextField label="Commune" value={value.city ?? ''} onChange={(v) => set({ city: v || undefined })} placeholder="Ex. Rouen" />
      </Group>

      <Group title="Score et visibilité">
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Score minimum" value={value.scoreMin ?? null} onChange={(v) => set({ scoreMin: v })} max={100} />
          <NumberField label="Score maximum" value={value.scoreMax ?? null} onChange={(v) => set({ scoreMax: v })} max={100} />
          <NumberField label="Note Google min." value={value.ratingMin ?? null} onChange={(v) => set({ ratingMin: v })} max={5} />
          <NumberField label="Avis Google min." value={value.reviewsMin ?? null} onChange={(v) => set({ reviewsMin: v })} />
          <NumberField label="Effectif min." value={value.headcountMin ?? null} onChange={(v) => set({ headcountMin: v })} />
        </div>
      </Group>

      <Group title="Coordonnées et présence en ligne">
        {(
          [
            ['hasPhone', 'Téléphone'],
            ['hasEmail', 'E-mail'],
            ['hasWebsite', 'Site internet'],
            ['hasGoogle', 'Présence Google'],
            ['hasSocial', 'Réseaux sociaux'],
            ['active', 'Entreprise active'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="grid items-center gap-2 sm:grid-cols-[8rem_1fr]">
            <span className="text-sm text-muted">{label}</span>
            <Segmented label={label} value={value[key] ?? 'any'} onChange={(v) => set({ [key]: v })} options={PRESENCE} />
          </div>
        ))}
      </Group>

      <Group title="Téléphone">
        <div className="flex flex-wrap gap-2">
          <Chip selected={value.hasPhone === 'yes' && !value.phoneStatus?.length} onClick={() => set({ hasPhone: value.hasPhone === 'yes' && !value.phoneStatus?.length ? 'any' : 'yes', phoneStatus: undefined })}>
            📞 Téléphone trouvé
          </Chip>
          <Chip selected={value.hasPhone === 'no'} onClick={() => set({ hasPhone: value.hasPhone === 'no' ? 'any' : 'no', phoneStatus: undefined })}>
            Téléphone non trouvé
          </Chip>
          {(['verified', 'to_verify', 'unverified'] as const).map((s) => (
            <Chip key={s} selected={!!value.phoneStatus?.includes(s)} onClick={() => set({ phoneStatus: toggle(value.phoneStatus, s), hasPhone: 'any' })}>
              {{ verified: '🟢 Vérifié', to_verify: '🟠 À vérifier', unverified: '⚪ Non vérifié' }[s]}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Effectif (tranches INSEE)">
        <div className="flex flex-wrap gap-2">
          {HEADCOUNT_BUCKETS.map((b) => {
            const on = b.bands.every((x) => value.headcountBands?.includes(x));
            return (
              <Chip key={b.id} selected={on} onClick={() => set({ headcountBands: on ? (value.headcountBands ?? []).filter((x) => !b.bands.includes(x)) : [...(value.headcountBands ?? []), ...b.bands] })}>
                {b.label}
              </Chip>
            );
          })}
        </div>
      </Group>

      <Group title="Enrichissement">
        <div className="flex flex-wrap gap-2">
          {(['none', 'enriched', 'partial', 'failed'] as const).map((s) => (
            <Chip key={s} selected={!!value.enrichment?.includes(s)} onClick={() => set({ enrichment: toggle<EnrichmentStatus>(value.enrichment, s) })}>
              {ENRICHMENT_LABEL[s]}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Statut">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <Chip key={s.id} selected={!!value.statuses?.includes(s.id)} onClick={() => set({ statuses: toggle<ProspectStatus>(value.statuses, s.id) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Activité">
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <Chip key={s.id} selected={!!value.services?.includes(s.id)} onClick={() => set({ services: toggle<ServiceTag>(value.services, s.id) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Group>

      <Group title="Dates">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Créée après le" type="date" value={value.createdAfter ?? ''} onChange={(v) => set({ createdAfter: v || null })} />
          <TextField label="Créée avant le" type="date" value={value.createdBefore ?? ''} onChange={(v) => set({ createdBefore: v || null })} />
          <TextField label="Dernier contact après" type="date" value={value.lastContactAfter ?? ''} onChange={(v) => set({ lastContactAfter: v || null })} />
          <TextField label="Dernier contact avant" type="date" value={value.lastContactBefore ?? ''} onChange={(v) => set({ lastContactBefore: v || null })} />
        </div>
        <Checkbox checked={!!value.followUpDue} onChange={(v) => set({ followUpDue: v || undefined })}>
          Relance prévue aujourd'hui ou en retard
        </Checkbox>
        <Checkbox checked={!!value.neverContacted} onChange={(v) => set({ neverContacted: v || undefined })}>
          Jamais contacté
        </Checkbox>
      </Group>

      <Group title="Autres">
        <Checkbox checked={!!value.includeDoNotContact} onChange={(v) => set({ includeDoNotContact: v || undefined })}>
          Afficher aussi les prospects « Ne plus contacter »
        </Checkbox>
        <div className="grid items-center gap-2 sm:grid-cols-[8rem_1fr]">
          <span className="text-sm text-muted">Données de démo</span>
          <Segmented label="Données de démonstration" value={value.demo ?? 'any'} onChange={(v) => set({ demo: v })} options={[{ value: 'any', label: 'Toutes' }, { value: 'no', label: 'Réelles' }, { value: 'yes', label: 'Démo' }]} />
        </div>
      </Group>
    </div>
  );
}

function RemovableTag({ children, onRemove }: { children: ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft py-1 pl-3 pr-1 text-sm font-medium text-brand">
      {children}
      <button type="button" onClick={onRemove} aria-label="Retirer" className="rounded-full p-1 hover:bg-brand/10">
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
