import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Award, CheckCircle2, MessageCircle, Radar, Send, ShieldCheck, Sparkles, TrendingUp, Users } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { fmtDateTime } from '../lib/format';
import type { EventItem, Opportunity } from '../lib/types';
import { Button, Card, DemoBadge, Empty, PageHeader, Spinner, Toggle } from '../components/ui';
import { InstagramIcon, FacebookIcon } from '../components/brand';
import { DistributionChart, TimelineChart } from '../components/charts';
import { ScorePill } from '../components/scores';

interface Dash {
  kpi: Record<string, number>;
  confidence_distribution: { label: string; count: number }[];
  commercial_distribution: { label: string; count: number }[];
  timeline: { date: string; discovered: number; sent: number }[];
  statuses: { key: string; label: string; count: number }[];
  best: { id: number; name: string; city: string | null; activity_label: string | null; confidence_score: number; commercial_score: number; priority: number; is_demo: boolean; main_opportunity: Opportunity | null }[];
  events: EventItem[];
}

function Kpi({ label, value, icon, accent }: { label: string; value: number | string; icon: React.ReactNode; accent?: boolean }) {
  return (
    <div className={accent ? 'rounded-2xl p-4 bg-ink text-white' : 'rounded-2xl p-4 bg-surface border border-line'}>
      <div className={accent ? 'text-[#d4b06a]' : 'text-muted'}>{icon}</div>
      <div className="mt-3 text-[26px] font-semibold num leading-none">{value}</div>
      <div className={accent ? 'mt-1 text-[12.5px] text-white/70' : 'mt-1 text-[12.5px] text-muted'}>{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [withDemo, setWithDemo] = useState(false);
  const { data, loading } = useApi<Dash>(`/dashboard?include_demo=${withDemo}`, [withDemo]);
  const nav = useNavigate();
  if (loading && !data) return <Spinner />;
  if (!data) return null;
  const k = data.kpi;
  const empty = k.total === 0;
  return (
    <>
      <PageHeader eyebrow="Signe & Seine" title="Tableau de bord" subtitle="Vos découvertes sur Instagram et Facebook, leurs deux scores et l'avancement de la prospection."
        actions={<>
          {k.demo_count > 0 && <Toggle checked={withDemo} onChange={setWithDemo} label="Inclure la démo" />}
          <Button variant="brass" onClick={() => nav('/decouverte')}><Radar className="size-4" />Nouvelle recherche</Button>
        </>} />
      {empty && (
        <Card className="mb-6">
          <Empty icon={<Radar className="size-6" />} title="Aucune entreprise découverte pour l'instant"
            action={<div className="flex gap-2 justify-center"><Button variant="primary" onClick={() => nav('/decouverte')}>Lancer une première recherche</Button>
              <Button onClick={() => nav('/sources')}>Configurer les sources</Button></div>}>
            Choisissez une ville et une activité dans « Découverte sociale ». {k.demo_count > 0 && 'Les données de démonstration sont masquées ici : activez « Inclure la démo » pour les voir.'}
          </Empty>
        </Card>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-3">
        <Kpi accent label="Découvertes aujourd'hui" value={k.today} icon={<Sparkles className="size-5" />} />
        <Kpi label="Cette semaine" value={k.week} icon={<Radar className="size-5" />} />
        <Kpi label="Profils Instagram" value={k.instagram} icon={<InstagramIcon className="size-5" />} />
        <Kpi label="Pages Facebook" value={k.facebook} icon={<FacebookIcon className="size-5" />} />
        <Kpi label="Entreprises validées" value={k.validated} icon={<CheckCircle2 className="size-5" />} />
        <Kpi label="Très fiables (≥ 90)" value={k.very_reliable} icon={<ShieldCheck className="size-5" />} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        <Kpi label="Fort potentiel (≥ 70)" value={k.high_potential} icon={<TrendingUp className="size-5" />} />
        <Kpi label="Messages préparés" value={k.messages_ready} icon={<MessageCircle className="size-5" />} />
        <Kpi label="Messages envoyés" value={k.messages_sent} icon={<Send className="size-5" />} />
        <Kpi label="Réponses reçues" value={k.replies} icon={<MessageCircle className="size-5" />} />
        <Kpi label="Prospects intéressés" value={k.interested} icon={<Award className="size-5" />} />
        <Kpi label="Total entreprises" value={k.total} icon={<Users className="size-5" />} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="lg:col-span-2" title="Activité des 14 derniers jours" subtitle="Découvertes et messages envoyés par jour">
          <TimelineChart data={data.timeline} />
        </Card>
        <Card title="Suivi commercial">
          <ul className="space-y-1.5">
            {data.statuses.map((s) => (
              <li key={s.key}>
                <Link to={`/prospects?status=${s.key}`} className="flex justify-between rounded-md px-2 py-1 text-[13px] hover:bg-paper">
                  <span className="text-ink-2">{s.label}</span><span className="num font-semibold">{s.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Card title="Meilleurs prospects" subtitle="Confiance ≥ 75 et potentiel ≥ 70, classés par priorité" className="lg:col-span-2"
          action={<Link to="/meilleurs" className="text-[13px] text-seine hover:underline">Tout voir</Link>}>
          {data.best.length === 0 ? <p className="text-sm text-muted py-6 text-center">Aucun prospect ne remplit encore les deux conditions.</p> : (
            <ul className="divide-y divide-line">
              {data.best.map((b) => (
                <li key={b.id}>
                  <Link to={`/prospects/${b.id}`} className="flex items-center gap-4 py-2.5 hover:bg-paper -mx-2 px-2 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">{b.name}{!!b.is_demo && <DemoBadge />}</div>
                      <div className="text-[12.5px] text-muted truncate">{[b.activity_label, b.city].filter(Boolean).join(' · ')}{b.main_opportunity && ` — ${b.main_opportunity.text}`}</div>
                    </div>
                    <ScorePill kind="confidence" score={b.confidence_score} />
                    <ScorePill kind="commercial" score={b.commercial_score} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="space-y-4">
          <Card title="Répartition — confiance"><DistributionChart data={data.confidence_distribution} color="var(--color-seine)" /></Card>
          <Card title="Répartition — potentiel commercial"><DistributionChart data={data.commercial_distribution} color="var(--color-brass)" /></Card>
        </div>
      </div>
      <Card title="Activité récente" className="mt-4">
        {data.events.length === 0 ? <p className="text-sm text-muted">Rien pour l'instant.</p> : (
          <ul className="divide-y divide-line">
            {data.events.map((e) => (
              <li key={e.id} className="flex gap-3 py-2 text-[13px]">
                <span className="w-28 shrink-0 text-muted num">{fmtDateTime(e.created_at)}</span>
                <span className="flex-1 text-ink-2">
                  {e.company_id ? <Link to={`/prospects/${e.company_id}`} className="font-medium text-ink hover:underline">{e.company_name}</Link> : null}
                  {e.company_id ? ' — ' : ''}{e.detail}
                </span>
                {e.is_demo ? <DemoBadge /> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
