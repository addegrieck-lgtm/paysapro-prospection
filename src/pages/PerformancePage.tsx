// Performance de l'enrichissement : quantité + exactitude + provenance, calculées sur les données réelles.
import { PageHeader } from '../components/ui/PageHeader';
import { Card, CardTitle } from '../components/ui/Card';
import { StatCard, Skeleton } from '../components/ui/Extras';
import { Alert } from '../components/ui/Feedback';
import { nf, pctFmt } from '../components/common';
import { useQuery } from '../app/context';
import { ENRICHMENT_CONFIG } from '../config';
import { OSM_ATTRIBUTION } from '../providers/company/OpenStreetMapProvider';
import type { CompanyEmail, CompanyPhone, CompanyWebsite } from '../domain/types';

function bySource(list: (CompanyPhone | CompanyEmail | CompanyWebsite)[]) {
  const m = new Map<string, number>();
  for (const c of list) {
    if (c.status === 'rejected') continue;
    for (const p of new Set(c.evidence.map((e) => e.provider))) m.set(p, (m.get(p) ?? 0) + 1);
  }
  return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
}

function SourceBars({ title, entries }: { title: string; entries: [string, number][] }) {
  const max = Math.max(1, ...entries.map(([, n]) => n));
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">Aucune donnée pour l'instant.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {entries.map(([source, n]) => (
            <li key={source} className="grid grid-cols-[minmax(8rem,40%)_1fr_auto] items-center gap-3">
              <span className="truncate text-muted" title={source}>
                {source}
              </span>
              <span className="h-2.5 rounded-r-[4px] bg-brand" style={{ width: `${Math.max(3, (n / max) * 100)}%` }} aria-hidden />
              <span className="tabular-nums font-semibold">{nf.format(n)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function PerformancePage() {
  const { data } = useQuery(async (a) => {
    const [rows, contacts, logs] = await Promise.all([a.allRows(), a.allContacts(), a.allEnrichmentLogs()]);
    return { rows: rows.filter((r) => !r.demo), contacts, logs };
  }, []);
  if (!data) return <Skeleton className="h-96" />;
  const { rows, contacts, logs } = data;
  const phones = contacts.phones.filter((c) => c.status !== 'rejected');
  const engineLogs = logs.filter((l) => l.provider === 'moteur');
  const analysed = new Set(engineLogs.map((l) => l.prospectId)).size;
  const withPhone = rows.filter((r) => r.phone).length;
  const verified = rows.filter((r) => r.phone && r.phoneStatus === 'verified').length;
  const durations = engineLogs.map((l) => l.durationMs ?? 0).filter((d) => d > 0);
  const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
  const errors = logs.filter((l) => l.status === 'failed').length;
  const rejected = contacts.phones.filter((c) => c.status === 'rejected').length;
  const shared = phones.filter((c) => c.shared).length;

  return (
    <>
      <PageHeader title="Performance de l'enrichissement" subtitle="Quantité, exactitude et provenance des coordonnées trouvées — calculées sur vos données réelles." />
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Entreprises analysées" value={nf.format(analysed)} hint={`sur ${nf.format(rows.length)} prospects réels`} />
          <StatCard label="Téléphones trouvés" value={nf.format(phones.length)} hint={`${nf.format(withPhone)} prospects avec téléphone`} />
          <StatCard label="Téléphones vérifiés" value={nf.format(verified)} hint="🟢 fortement associés (principal)" />
          <StatCard label="Taux de réussite" value={pctFmt(rows.length ? (withPhone / rows.length) * 100 : null)} hint="prospects avec téléphone" />
          <StatCard label="E-mails trouvés" value={nf.format(contacts.emails.filter((c) => c.status !== 'rejected').length)} />
          <StatCard label="Sites trouvés" value={nf.format(contacts.websites.filter((c) => c.status !== 'rejected').length)} hint={`${nf.format(contacts.websites.filter((c) => c.verified).length)} vérifiés`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <SourceBars title="Téléphones — sources les plus efficaces" entries={bySource(contacts.phones)} />
          <SourceBars title="E-mails et sites — sources" entries={bySource([...contacts.emails, ...contacts.websites])} />
        </div>

        <Card>
          <CardTitle>Qualité</CardTitle>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Faux positifs signalés</dt>
              <dd className="text-xl font-bold tabular-nums">{nf.format(rejected)}</dd>
              <dd className="text-xs text-muted">numéros écartés par vous</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Numéros partagés</dt>
              <dd className="text-xl font-bold tabular-nums">{nf.format(shared)}</dd>
              <dd className="text-xs text-muted">confiance réduite</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Temps moyen / entreprise</dt>
              <dd className="text-xl font-bold tabular-nums">{avg !== null ? `${(avg / 1000).toFixed(1).replace('.', ',')} s` : '—'}</dd>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <dt className="text-muted">Erreurs</dt>
              <dd className="text-xl font-bold tabular-nums">{nf.format(errors)}</dd>
            </div>
          </dl>
        </Card>

        <Alert tone="info" title="Sources configurées">
          Données publiques officielles (SIRENE) · Annuaire public OpenStreetMap ({OSM_ATTRIBUTION}) ·{' '}
          {ENRICHMENT_CONFIG.webProxyUrl ? 'Sites officiels des entreprises (relais web actif)' : 'Sites officiels : relais web non configuré (voir Paramètres)'} · Imports CSV et saisies manuelles. Recherche
          automatique des coordonnées professionnelles disponibles : tous les numéros ne sont pas publics.
        </Alert>
      </div>
    </>
  );
}
