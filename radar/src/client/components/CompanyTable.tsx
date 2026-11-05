import { Link } from 'react-router';
import type { CompanyRow } from '../api';
import { useApp } from '../App';
import { eur, years } from '../lib/format';
import { Empty, OppBadge, ScoreCell, Table, td } from './ui';

export function CompanyTable({ rows, empty, showDistance }: { rows: CompanyRow[]; empty?: React.ReactNode; showDistance?: boolean }) {
  const { meta, compare, toggleCompare } = useApp();
  const sector = (id: string | null) => (id ? meta.sectors.find((s) => s.id === id)?.label : null);
  if (!rows.length) return <>{empty ?? <Empty title="Aucune entreprise ne correspond à ces critères">Élargissez les filtres ou vérifiez que les sources concernées sont synchronisées.</Empty>}</>;
  return (
    <Table head={['', 'Entreprise', 'Situation', 'Score éco.', 'Risque', 'Fiabilité', 'CA (année)', 'Résultat net', 'Ancienneté', ...(showDistance ? ['Distance'] : [])]}>
      {rows.map((r) => (
        <tr key={r.id} className="hover:bg-ink-750/50">
          <td className={td}>
            <input type="checkbox" aria-label={`Comparer ${r.name}`} checked={compare.includes(r.id)} onChange={() => toggleCompare(r.id)} title="Ajouter au comparateur" />
          </td>
          <td className={td}>
            <Link to={`/entreprises/${r.id}`} className="font-medium text-fog-50 hover:text-volt-300">
              {r.name}
            </Link>
            {r.trade_name && r.trade_name !== r.name && <span className="ml-1 text-xs text-fog-400">({r.trade_name})</span>}
            <div className="text-xs text-fog-500">
              {[r.commune_name, sector(r.sector_id) ?? r.naf_code, r.legal_form_label].filter(Boolean).join(' · ')}
              {r.admin_status === 'C' && <span className="ml-1 text-bad">· cessée</span>}
              {r.project_status && <span className="ml-1 text-volt-300">· suivie</span>}
            </div>
          </td>
          <td className={td}>
            <OppBadge type={r.primary_type} />
            {r.transmission_index !== null && <div className="mt-1 text-[10px] text-fog-500">indice transm. {r.transmission_index}</div>}
          </td>
          <td className={td}>
            <ScoreCell value={r.economic_score} status={r.data_status} />
          </td>
          <td className={td}>
            <ScoreCell value={r.risk_score} kind="risk" />
          </td>
          <td className={td}>
            <ScoreCell value={r.reliability_score} kind="rel" />
          </td>
          <td className={`${td} whitespace-nowrap tabular`}>
            {eur(r.revenue, true)} <span className="text-xs text-fog-500">{r.last_year ?? ''}</span>
          </td>
          <td className={`${td} whitespace-nowrap tabular ${r.net_income !== null && r.net_income < 0 ? 'text-bad' : ''}`}>{eur(r.net_income, true)}</td>
          <td className={`${td} whitespace-nowrap text-xs text-fog-300`}>{years(r.creation_date)}</td>
          {showDistance && <td className={`${td} tabular text-xs`}>{r.distance_km !== undefined ? `${r.distance_km.toFixed(1)} km` : '—'}</td>}
        </tr>
      ))}
    </Table>
  );
}
