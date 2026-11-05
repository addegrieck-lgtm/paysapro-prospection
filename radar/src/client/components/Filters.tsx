import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useApp } from '../App';
import { Button, cx, inputCls } from './ui';

/** Filtres de recherche conservés dans l'URL (partageables, conservés au retour arrière). */
export function useFilters(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams();
  const values: Record<string, string> = { ...defaults };
  params.forEach((v, k) => (values[k] = v));
  const set = (patch: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === '') next.delete(k);
      else next.set(k, v);
    }
    if (!('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  const reset = () => setParams(new URLSearchParams(), { replace: true });
  return { values, set, reset };
}

function Multi({ label, value, options, onChange }: { label: string; value: string; options: { id: string; label: string; group?: string }[]; onChange: (v: string) => void }) {
  const selected = new Set(value ? value.split(',') : []);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className={cx(inputCls, 'flex items-center justify-between text-left')}>
        <span className={cx('truncate', !selected.size && 'text-fog-500')}>{selected.size ? `${label} (${selected.size})` : label}</span>
        <span className="text-fog-500">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute z-40 mt-1 max-h-72 w-72 overflow-y-auto rounded-lg border border-ink-600 bg-ink-850 p-1 shadow-xl">
            {options.map((o) => (
              <label key={o.id} className={cx('flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-ink-750', o.group === 'group' && 'mt-1 font-semibold text-fog-100')}>
                <input
                  type="checkbox"
                  checked={selected.has(o.id)}
                  onChange={(e) => {
                    const s = new Set(selected);
                    if (e.target.checked) s.add(o.id);
                    else s.delete(o.id);
                    onChange([...s].join(','));
                  }}
                />
                {o.label}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Debounced({ value, onChange, placeholder, type = 'text', className }: { value: string; onChange: (v: string) => void; placeholder: string; type?: string; className?: string }) {
  const [v, setV] = useState(value);
  useEffect(() => {
    setV(value);
  }, [value]);
  useEffect(() => {
    if (v === value) return;
    const t = setTimeout(() => onChange(v), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return <input className={cx(inputCls, className)} value={v} onChange={(e) => setV(e.target.value)} placeholder={placeholder} type={type} aria-label={placeholder} />;
}

const TRI = (v: string | undefined) => (v === 'true' ? 'true' : v === 'false' ? 'false' : '');

export function FilterPanel({ f, hide = [] }: { f: ReturnType<typeof useFilters>; hide?: string[] }) {
  const { meta } = useApp();
  const [more, setMore] = useState(false);
  const v = f.values;
  const sectorOptions = meta.sectors.map((s) => ({ id: s.id, label: s.parent_id ? `  ${s.label}` : s.label, group: s.parent_id ? undefined : 'group' }));
  const communeOptions = meta.communes.map((c) => ({ id: c.code_insee, label: c.name }));
  const show = (k: string) => !hide.includes(k);
  const activeCount = Object.keys(v).filter((k) => !['page', 'sort', 'onglet'].includes(k)).length;
  return (
    <div className="mb-4 space-y-2 rounded-xl border border-ink-700 bg-ink-850/60 p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <Debounced className="lg:col-span-2" value={v.q ?? ''} onChange={(q) => f.set({ q })} placeholder="Nom, enseigne, SIREN ou SIRET…" />
        {show('sectors') && <Multi label="Secteurs" value={v.sectors ?? ''} options={sectorOptions} onChange={(sectors) => f.set({ sectors })} />}
        {show('communes') && <Multi label={communeOptions.length ? 'Communes' : 'Communes (référentiel non synchronisé)'} value={v.communes ?? ''} options={communeOptions} onChange={(communes) => f.set({ communes })} />}
        {show('opportunityTypes') && (
          <Multi label="Opportunité" value={v.opportunityTypes ?? ''} options={Object.entries(meta.opportunityLabels).map(([id, label]) => ({ id, label }))} onChange={(opportunityTypes) => f.set({ opportunityTypes })} />
        )}
        <select className={inputCls} value={v.sort ?? 'score'} onChange={(e) => f.set({ sort: e.target.value })} aria-label="Tri">
          <option value="score">Tri : score économique</option>
          <option value="risque">Tri : risque croissant</option>
          <option value="fiabilite">Tri : fiabilité</option>
          <option value="transmission">Tri : indice de transmission</option>
          <option value="ca">Tri : chiffre d'affaires</option>
          <option value="resultat">Tri : résultat net</option>
          <option value="anciennete">Tri : ancienneté</option>
          <option value="recent">Tri : découverte récente</option>
          <option value="nom">Tri : nom</option>
          {v.radiusKm && <option value="distance">Tri : distance</option>}
        </select>
      </div>
      {more && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <Debounced value={v.naf ?? ''} onChange={(naf) => f.set({ naf })} placeholder="Codes NAF (ex. 43.2, 81.30Z)" />
          <Multi label="Effectif" value={v.headcountBands ?? ''} options={Object.entries(meta.headcountBands).map(([id, b]) => ({ id, label: b.label }))} onChange={(headcountBands) => f.set({ headcountBands })} />
          <Multi label="Forme juridique" value={v.legalForms ?? ''} options={Object.entries(meta.legalForms).map(([id, label]) => ({ id, label }))} onChange={(legalForms) => f.set({ legalForms })} />
          {show('procedure') && <Multi label="Procédure" value={v.procedureTypes ?? ''} options={Object.entries(meta.procTypeLabels).map(([id, label]) => ({ id, label }))} onChange={(procedureTypes) => f.set({ procedureTypes })} />}
          {show('procedure') && (
            <select className={inputCls} value={TRI(v.activeProcedure)} onChange={(e) => f.set({ activeProcedure: e.target.value })} aria-label="Procédure en cours">
              <option value="">Procédure : indifférent</option>
              <option value="true">Procédure en cours</option>
              <option value="false">Sans procédure en cours</option>
            </select>
          )}
          <select className={inputCls} value={v.acquisitionType ?? ''} onChange={(e) => f.set({ acquisitionType: e.target.value })} aria-label="Type d'acquisition">
            <option value="">Type d'acquisition : tous</option>
            <option value="titres">Rachat de titres envisageable</option>
            <option value="fonds">Rachat de fonds</option>
            <option value="actifs">Rachat d'actifs (liquidation)</option>
          </select>
          <Debounced type="number" value={v.revenueMin ?? ''} onChange={(revenueMin) => f.set({ revenueMin })} placeholder="CA minimum (€)" />
          <Debounced type="number" value={v.revenueMax ?? ''} onChange={(revenueMax) => f.set({ revenueMax })} placeholder="CA maximum (€)" />
          <Debounced type="number" value={v.netIncomeMin ?? ''} onChange={(netIncomeMin) => f.set({ netIncomeMin })} placeholder="Résultat net min. (€)" />
          <Debounced type="number" value={v.ebeMin ?? ''} onChange={(ebeMin) => f.set({ ebeMin })} placeholder="EBE minimum (€)" />
          <Debounced type="number" value={v.ageMin ?? ''} onChange={(ageMin) => f.set({ ageMin })} placeholder="Ancienneté min. (ans)" />
          <Debounced type="number" value={v.ageMax ?? ''} onChange={(ageMax) => f.set({ ageMax })} placeholder="Ancienneté max. (ans)" />
          <Debounced type="number" value={v.economicMin ?? ''} onChange={(economicMin) => f.set({ economicMin })} placeholder="Score économique ≥" />
          <Debounced type="number" value={v.riskMax ?? ''} onChange={(riskMax) => f.set({ riskMax })} placeholder="Score de risque ≤" />
          <Debounced type="number" value={v.reliabilityMin ?? ''} onChange={(reliabilityMin) => f.set({ reliabilityMin })} placeholder="Fiabilité ≥" />
          <Debounced type="number" value={v.transmissionIndexMin ?? ''} onChange={(transmissionIndexMin) => f.set({ transmissionIndexMin })} placeholder="Indice transmission ≥" />
          <select className={inputCls} value={TRI(v.hasAccounts)} onChange={(e) => f.set({ hasAccounts: e.target.value })} aria-label="Comptes disponibles">
            <option value="">Comptes : indifférent</option>
            <option value="true">Comptes disponibles</option>
            <option value="false">Sans comptes publiés</option>
          </select>
          <select className={inputCls} value={TRI(v.hasWebsite)} onChange={(e) => f.set({ hasWebsite: e.target.value })} aria-label="Site internet">
            <option value="">Site internet : indifférent</option>
            <option value="true">Site connu</option>
            <option value="false">Aucun site connu</option>
          </select>
          <Multi label="Statut des données" value={v.dataStatus ?? ''} options={[{ id: 'suffisant', label: 'Suffisant' }, { id: 'partiel', label: 'Partiel' }, { id: 'insuffisant', label: 'Insuffisant' }]} onChange={(dataStatus) => f.set({ dataStatus })} />
          <div className="flex gap-1 lg:col-span-2">
            <select
              className={inputCls}
              value={v.communeCenter ?? ''}
              onChange={(e) => {
                const c = meta.communes.find((x) => x.code_insee === e.target.value);
                f.set({ communeCenter: e.target.value, lat: c?.lat?.toString(), lon: c?.lon?.toString(), radiusKm: e.target.value ? v.radiusKm || '10' : undefined });
              }}
              aria-label="Rayon autour de"
            >
              <option value="">Rayon autour d'une commune…</option>
              {meta.communes.filter((c) => c.lat).map((c) => (
                <option key={c.code_insee} value={c.code_insee}>
                  {c.name}
                </option>
              ))}
            </select>
            <Debounced type="number" className="w-24" value={v.radiusKm ?? ''} onChange={(radiusKm) => f.set({ radiusKm })} placeholder="km" />
          </div>
          <label className="flex items-center gap-2 text-xs text-fog-300">
            <input type="checkbox" checked={v.includeCeased === 'true'} onChange={(e) => f.set({ includeCeased: e.target.checked ? 'true' : undefined })} />
            Inclure les entreprises cessées
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setMore(!more)}>
          {more ? 'Moins de filtres' : 'Plus de filtres'}
        </Button>
        {activeCount > 0 && (
          <Button size="sm" variant="ghost" onClick={f.reset}>
            Réinitialiser ({activeCount})
          </Button>
        )}
      </div>
    </div>
  );
}
