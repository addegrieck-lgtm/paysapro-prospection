import { useState } from 'react';
import { api } from '../api';
import { useApp } from '../App';
import { eur, isNum, num, pct } from '../lib/format';
import { Button, Card, ErrorBox, Field, inputCls, Loading, Notice, Table, td } from './ui';

interface Year {
  year: number;
  revenue: number;
  ebe: number;
  operatingIncome: number;
  netIncome: number;
  freeCashFlow: number;
  debtService: number;
  equityCashFlow: number;
  cumulativeEquityCash: number;
  remainingDebt: number;
  dscr: number | null;
}
interface Result {
  params: { name: string; label: string; assumptions: string[] };
  financing: { price: number; fees: number; investment: number; workingCapital: number; cashBuffer: number; totalNeed: number; debt: number; equity: number; annuity: number };
  years: Year[];
  at3: { cumulativeEquityCash: number; netIncomeTotal: number };
  at5: { cumulativeEquityCash: number; netIncomeTotal: number };
  breakEvenRevenue: number | null;
  paybackYears: number | null;
  businessReturn: number | null;
  equityIrr: number | null;
  warnings: string[];
}
interface Payload {
  available: boolean;
  reason?: string;
  priceOrigin?: string;
  base: { revenue: number | null; ebe: number | null; year: number | null; ebeStatus?: string };
  deal?: Record<string, number | null>;
  results?: Result[];
  disclaimer?: string;
}

export function ScenarioPanel({ companyId, projectId }: { companyId: number; projectId?: number }) {
  const { can } = useApp();
  const [form, setForm] = useState<Record<string, string>>({});
  const [data, setData] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const toNum = (s: string | undefined, div = 1) => (s === undefined || s === '' ? undefined : Number(s.replace(',', '.')) / div);
  const run = async (save = false) => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        companyId,
        price: toNum(form.price),
        baseRevenue: toNum(form.baseRevenue),
        baseEbe: toNum(form.baseEbe),
        debtShare: toNum(form.debtShare, 100),
        interestRate: toNum(form.interestRate, 100),
        loanYears: toNum(form.loanYears),
        acquisitionFeesRate: toNum(form.fees, 100),
        initialInvestment: toNum(form.investment),
        exitEbeMultiple: toNum(form.exit),
        save: save && projectId ? { projectId, name: `Simulation du ${new Date().toLocaleDateString('fr-FR')}` } : undefined,
      };
      setData(await api.post<Payload>('/scenarios', body));
      if (save) setSaved(true);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  const input = (k: string, label: string, ph: string, hint?: string) => (
    <Field label={label} hint={hint}>
      <input className={inputCls} inputMode="decimal" value={form[k] ?? ''} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
    </Field>
  );
  return (
    <div className="space-y-4">
      <Card title="Hypothèses de reprise">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {input('price', "Prix d'acquisition (€)", 'auto', 'Vide : prix demandé, sinon valeur centrale')}
          {input('baseRevenue', 'CA de référence (€)', 'dernier publié', 'À remplacer par les chiffres du vendeur')}
          {input('baseEbe', 'EBE retraité (€)', 'dernier publié')}
          {input('debtShare', 'Part financée par emprunt (%)', '70')}
          {input('interestRate', 'Taux d\'emprunt (%)', '4,5')}
          {input('loanYears', 'Durée d\'emprunt (ans)', '7')}
          {input('fees', 'Frais d\'acquisition (%)', '8', 'Droits, conseils, garanties')}
          {input('investment', 'Investissements de reprise (€)', '0')}
          {input('exit', 'Multiple d\'EBE de sortie (TRI)', '4')}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="primary" busy={busy} onClick={() => run(false)}>
            Calculer les 3 scénarios
          </Button>
          {projectId && can('analyste') && data?.available && (
            <Button busy={busy} onClick={() => run(true)}>
              {saved ? 'Enregistré ✓' : 'Enregistrer dans le projet'}
            </Button>
          )}
        </div>
      </Card>
      <ErrorBox error={error} />
      {busy && !data && <Loading label="Calcul…" />}
      {data && !data.available && <Notice tone="warn">{data.reason}</Notice>}
      {data?.available && data.results && (
        <>
          <Notice>
            Base : CA {eur(data.base.revenue)} et EBE {eur(data.base.ebe)} ({data.base.year ?? 'saisie'}, EBE {data.base.ebeStatus === 'calculee' ? 'recalculé' : data.base.ebeStatus === 'saisi' ? 'saisi' : 'publié'}). Prix retenu : {eur(data.deal?.price)} ({data.priceOrigin}). {data.disclaimer}
          </Notice>
          <div className="grid gap-4 xl:grid-cols-3">
            {data.results.map((r) => (
              <Card key={r.params.name} title={r.params.label}>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                  <dt className="text-fog-400">Besoin total de financement</dt>
                  <dd className="text-right tabular">{eur(r.financing.totalNeed)}</dd>
                  <dt className="text-fog-400">dont prix / frais</dt>
                  <dd className="text-right tabular">
                    {eur(r.financing.price, true)} / {eur(r.financing.fees, true)}
                  </dd>
                  <dt className="text-fog-400">dont investissements / BFR / trésorerie</dt>
                  <dd className="text-right tabular">
                    {eur(r.financing.investment, true)} / {eur(r.financing.workingCapital, true)} / {eur(r.financing.cashBuffer, true)}
                  </dd>
                  <dt className="text-fog-400">Emprunt · annuité</dt>
                  <dd className="text-right tabular">
                    {eur(r.financing.debt, true)} · {eur(r.financing.annuity, true)}/an
                  </dd>
                  <dt className="text-fog-400">Apport en fonds propres</dt>
                  <dd className="text-right font-semibold tabular">{eur(r.financing.equity)}</dd>
                  <dt className="text-fog-400">Seuil de rentabilité (CA)</dt>
                  <dd className="text-right tabular">{eur(r.breakEvenRevenue)}</dd>
                  <dt className="text-fog-400">Trésorerie cumulée acquéreur à 3 / 5 ans</dt>
                  <dd className="text-right tabular">
                    {eur(r.at3.cumulativeEquityCash, true)} / {eur(r.at5.cumulativeEquityCash, true)}
                  </dd>
                  <dt className="text-fog-400">Délai de récupération de l'apport</dt>
                  <dd className="text-right tabular">{isNum(r.paybackYears) ? `${num(r.paybackYears, 1)} ans` : '> 5 ans'}</dd>
                  <dt className="text-fog-400" title="Résultat d'exploitation après impôt / investissement total">
                    Rendement de l'entreprise
                  </dt>
                  <dd className="text-right tabular">{pct(r.businessReturn)}</dd>
                  <dt className="text-fog-400" title="TRI des fonds propres, après service de la dette, avec valeur de revente à 5 ans">
                    TRI des fonds propres
                  </dt>
                  <dd className="text-right font-semibold tabular">{pct(r.equityIrr)}</dd>
                </dl>
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-fog-400">Projection annuelle et hypothèses</summary>
                  <ul className="my-2 list-disc pl-4 text-fog-400">
                    {r.params.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                  <Table dense head={['An', 'CA', 'EBE', 'Rés. net', 'Flux acquéreur', 'Couv. dette']}>
                    {r.years.map((y) => (
                      <tr key={y.year}>
                        <td className={td}>{y.year}</td>
                        <td className={`${td} tabular`}>{eur(y.revenue, true)}</td>
                        <td className={`${td} tabular`}>{eur(y.ebe, true)}</td>
                        <td className={`${td} tabular`}>{eur(y.netIncome, true)}</td>
                        <td className={`${td} tabular ${y.equityCashFlow < 0 ? 'text-bad' : ''}`}>{eur(y.equityCashFlow, true)}</td>
                        <td className={`${td} tabular ${y.dscr !== null && y.dscr < 1.2 ? 'text-warn' : ''}`}>{y.dscr === null ? '—' : num(y.dscr, 2)}</td>
                      </tr>
                    ))}
                  </Table>
                </details>
                {r.warnings.map((w) => (
                  <p key={w} className="mt-2 text-xs text-warn">
                    ⚠ {w}
                  </p>
                ))}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
