// Doublons potentiels : Fusionner / Ignorer / Conserver les deux.
import { Link } from 'react-router';
import { Copy, GitMerge } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { Button } from '../components/ui/Button';
import { Card, Badge } from '../components/ui/Card';
import { EmptyState, useToast } from '../components/ui/Feedback';
import { Skeleton } from '../components/ui/Extras';
import { ScoreBadge, StatusBadge, formatDateShort, nf, useAction } from '../components/common';
import { EnrichmentBadge } from '../components/enrichment';
import { useApp, useCan, useQuery } from '../app/context';
import { MATCH_LABEL, STRONG_RULES } from '../domain/dedupe';
import { formatPhone } from '../domain/normalize';
import type { Prospect } from '../domain/types';

function Side({ p, onKeep, disabled }: { p: Prospect; onKeep: () => void; disabled: boolean }) {
  const line = (label: string, v: string | null | undefined) => (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted">{label}</span>
      <span className={`text-right ${v ? '' : 'italic text-muted/70'}`}>{v || 'Non disponible'}</span>
    </div>
  );
  return (
    <div className="flex flex-col rounded-xl border border-line p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <Link to={`/prospects/${p.id}`} className="font-semibold hover:text-brand">
          {p.name}
        </Link>
        <ScoreBadge score={p.score} />
      </div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <StatusBadge status={p.status} />
        <EnrichmentBadge status={p.enrichmentStatus} short />
      </div>
      <div className="flex-1 space-y-1">
        {line('SIRET', p.siret)}
        {line('SIREN', p.siren)}
        {line('Adresse', [p.address, p.postalCode, p.city].filter(Boolean).join(' '))}
        {line('Téléphone', p.phone ? formatPhone(p.phone) : null)}
        {line('E-mail', p.email)}
        {line('Site', p.website?.replace(/^https?:\/\//, ''))}
        {line('Ajouté le', formatDateShort(p.createdAt))}
      </div>
      <Button className="mt-3" variant="secondary" size="sm" icon={<GitMerge className="h-4 w-4" />} disabled={disabled} onClick={onKeep}>
        Fusionner en gardant cette fiche
      </Button>
    </div>
  );
}

export function DuplicatesPage() {
  const { api } = useApp();
  const run = useAction();
  const toast = useToast();
  const canEdit = useCan('prospecting.edit');
  const { data, loading } = useQuery(async (a) => {
    const list = await a.listDuplicates('open');
    const pairs = await Promise.all(list.map(async (c) => ({ c, a: await a.getProspect(c.prospectIdA), b: await a.getProspect(c.prospectIdB) })));
    return pairs.filter((x): x is { c: typeof x.c; a: Prospect; b: Prospect } => !!x.a && !!x.b);
  }, []);

  return (
    <>
      <PageHeader
        title="Doublons à vérifier"
        subtitle="Une entreprise ne doit apparaître qu'une fois. Lors d'une fusion, les informations des deux fiches sont conservées."
        back="/import"
        actions={
          canEdit && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const n = await run(() => api.scanDuplicates());
                if (n !== undefined) toast(n ? `${nf.format(n)} nouveau(x) doublon(s) potentiel(s)` : 'Aucun nouveau doublon', 'info');
              }}
            >
              Analyser la base
            </Button>
          )
        }
      />
      {loading && !data ? (
        <Skeleton className="h-40" />
      ) : !data?.length ? (
        <EmptyState icon={<Copy className="h-7 w-7" />} title="Aucun doublon à vérifier">
          Les doublons certains (même SIRET, même SIREN, même nom + adresse ou nom + téléphone) sont fusionnés automatiquement à l'import. Les cas incertains apparaissent ici.
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {data.map(({ c, a, b }) => (
            <li key={c.id}>
              <Card>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone={STRONG_RULES.includes(c.rule) ? 'warning' : 'info'}>{MATCH_LABEL[c.rule]}</Badge>
                  <span className="text-sm text-muted">détecté le {formatDateShort(c.createdAt)}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Side p={a} disabled={!canEdit} onKeep={() => run(() => api.mergeDuplicate(c.id, a.id), 'Fiches fusionnées')} />
                  <Side p={b} disabled={!canEdit} onKeep={() => run(() => api.mergeDuplicate(c.id, b.id), 'Fiches fusionnées')} />
                </div>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => run(() => api.resolveDuplicate(c.id, 'kept_both'), 'Les deux fiches sont conservées')}>
                      Conserver les deux (entreprises différentes)
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => run(() => api.resolveDuplicate(c.id, 'ignored'), 'Doublon ignoré')}>
                      Ignorer
                    </Button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
