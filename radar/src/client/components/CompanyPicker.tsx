import { useEffect, useState } from 'react';
import { api, qs, type CompanyRow } from '../api';
import { cx, inputCls } from './ui';

/** Sélection d'une entreprise par nom ou SIREN (recherche instantanée). */
export function CompanyPicker({ onPick, placeholder = 'Rechercher une entreprise (nom ou SIREN)…' }: { onPick: (c: CompanyRow) => void; placeholder?: string }) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CompanyRow[]>([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (q.trim().length < 2) return setRows([]);
    const t = setTimeout(() => {
      api
        .get<{ rows: CompanyRow[] }>(`/companies${qs({ q, pageSize: 8, sort: 'score', includeCeased: true })}`)
        .then((r) => setRows(r.rows))
        .catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <input className={inputCls} value={q} placeholder={placeholder} onChange={(e) => (setQ(e.target.value), setOpen(true))} onFocus={() => setOpen(true)} aria-label={placeholder} />
      {open && rows.length > 0 && (
        <ul className="absolute z-40 mt-1 w-full overflow-hidden rounded-lg border border-ink-600 bg-ink-850 shadow-xl">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                className={cx('w-full px-3 py-1.5 text-left text-sm hover:bg-ink-750')}
                onClick={() => {
                  onPick(r);
                  setQ('');
                  setOpen(false);
                }}
              >
                {r.name} <span className="text-xs text-fog-500">· {r.siren} · {r.commune_name ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
