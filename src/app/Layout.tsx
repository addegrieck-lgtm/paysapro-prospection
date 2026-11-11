import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { BarChart3, Gauge, Bell, CalendarClock, Ellipsis, FileText, Filter, Headset, LayoutDashboard, Mail, Radar, Settings, Upload, Users } from 'lucide-react';
import { Drawer } from '../components/ui/Extras';
import { useApp, useQuery } from './context';
import { today } from '../domain/filters';
import { OFFERS } from '../domain/offers';

export const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/prospects', label: 'Prospects', icon: Users, end: false },
  { to: '/import', label: 'Import & enrichissement', icon: Upload, end: false },
  { to: '/segments', label: 'Segments', icon: Filter, end: false },
  { to: '/campaigns', label: 'Campagnes', icon: Mail, end: false },
  { to: '/tasks', label: 'Relances', icon: CalendarClock, end: false },
  { to: '/assistant', label: 'Assistant commercial', icon: Headset, end: false },
  { to: '/templates', label: 'Templates', icon: FileText, end: false },
  { to: '/stats', label: 'Statistiques', icon: BarChart3, end: false },
  { to: '/performance', label: 'Performance', icon: Gauge, end: false },
  { to: '/settings', label: 'Paramètres', icon: Settings, end: false },
];

const BOTTOM = [NAV[0]!, NAV[1]!, NAV[5]!, NAV[4]!];

/** S&S Social Finder (découverte Instagram / Facebook) : uniquement dans l'espace de l'agence Signe & Seine. */
const SOCIAL_FINDER_NAV = { to: '/social-finder', label: 'Social Finder', icon: Radar, end: false };
function navFor(offerId: string) {
  return offerId === 'agence' ? [...NAV.slice(0, 3), SOCIAL_FINDER_NAV, ...NAV.slice(3)] : NAV;
}

export function LogoMark({ className = 'h-9 w-9', colors = OFFERS[0]!.logo }: { className?: string; colors?: { bg: string; fg: string } }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <rect width="48" height="48" rx="12" fill={colors.bg} />
      <path d="M14 34c0-11 8-19 21-20-1 13-9 21-20 21" fill={colors.fg} />
      <path d="M14 34 27 21" stroke={colors.bg} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/** Choix de l'espace : chaque offre a ses propres prospects, modèles, campagnes et paramètres. */
function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const { offer, switchWorkspace } = useApp();
  const navigate = useNavigate();
  const change = (workspaceId: string) => {
    if (workspaceId === offer.workspaceId) return;
    navigate('/'); // une fiche ouverte appartient à l'autre espace
    switchWorkspace(workspaceId);
  };
  if (compact) {
    return (
      <select
        aria-label="Espace de prospection"
        value={offer.workspaceId}
        onChange={(e) => change(e.target.value)}
        className="min-h-10 max-w-40 rounded-xl border border-line bg-surface px-2 text-sm font-semibold text-ink"
      >
        {OFFERS.map((o) => (
          <option key={o.id} value={o.workspaceId}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }
  return (
    <div role="radiogroup" aria-label="Espace de prospection" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
      {OFFERS.map((o) => {
        const active = o.workspaceId === offer.workspaceId;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${o.name} — ${o.tagline}`}
            onClick={() => change(o.workspaceId)}
            className={`min-h-10 rounded-lg px-2 text-xs font-semibold leading-tight ${active ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink'}`}
          >
            {o.name}
          </button>
        );
      })}
    </div>
  );
}

/** Notifications internes calculées à partir des données (relances dues, prioritaires jamais contactés, réponses). */
function useNotifications() {
  const { data } = useQuery(async (api) => {
    const [rows, tasks] = await Promise.all([api.allRows(), api.listTasks()]);
    const t = today();
    const due = tasks.filter((x) => !x.done && x.dueAt.slice(0, 10) <= t).length;
    const priority = rows.filter((r) => r.score >= 80 && !r.milestones.contacted && !r.doNotContact && !r.demo).length;
    const replies = rows.filter((r) => r.status === 'replied').length;
    const items: { text: string; to: string }[] = [];
    if (due) items.push({ text: `${due} relance${due > 1 ? 's' : ''} prévue${due > 1 ? 's' : ''} aujourd'hui ou en retard`, to: '/tasks' });
    if (priority) items.push({ text: `${priority} prospect${priority > 1 ? 's' : ''} prioritaire${priority > 1 ? 's' : ''} jamais contacté${priority > 1 ? 's' : ''}`, to: '/prospects?view=priority' });
    if (replies) items.push({ text: `${replies} réponse${replies > 1 ? 's' : ''} nécessite${replies > 1 ? 'nt' : ''} votre attention`, to: '/prospects?status=replied' });
    return items;
  }, []);
  return data ?? [];
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const items = useNotifications();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Notifications (${items.length})`}
        className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-ink"
      >
        <Bell className="h-5 w-5" />
        {items.length > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-danger ring-2 ring-surface" aria-hidden />}
      </button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Notifications">
        {items.length === 0 ? (
          <p className="text-muted">Rien à signaler pour le moment.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.to}>
                <NavLink to={n.to} onClick={() => setOpen(false)} className="block rounded-xl border border-line p-3 font-medium hover:border-brand/40">
                  {n.text}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </Drawer>
    </>
  );
}

export function Layout() {
  const { pathname } = useLocation();
  const [more, setMore] = useState(false);
  const { settings, offer } = useApp();
  const wide = /^\/(prospects$|prospects\?|stats|campaigns\/)/.test(pathname) || pathname === '/prospects';

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
        Aller au contenu
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface p-4 lg:flex">
        <div className="mb-4 flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-2.5">
            <LogoMark colors={offer.logo} />
            <div className="leading-tight">
              <div className="font-bold tracking-tight text-ink">Prospection</div>
              <div className="text-xs text-muted">{settings.saasName}</div>
            </div>
          </div>
          <NotificationBell />
        </div>
        <WorkspaceSwitcher />
        <nav aria-label="Navigation principale" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {navFor(offer.id).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 font-medium ${isActive ? 'bg-brand-soft text-brand' : 'text-muted hover:bg-surface-2 hover:text-ink'}`}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
        {settings.testMode && <p className="mt-3 rounded-xl bg-warning-soft p-3 text-xs font-medium text-warning">Mode test actif : les campagnes partent vers votre adresse.</p>}
      </aside>

      {/* Barre du haut (mobile) */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/95 px-4 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <LogoMark className="h-8 w-8" colors={offer.logo} />
          <WorkspaceSwitcher compact />
        </div>
        <NotificationBell />
      </header>

      <div className="lg:ml-60">
        <main id="main" className="px-4 pb-28 pt-4 sm:px-6 lg:pb-12 lg:pt-8">
          <div className={`animate-in mx-auto ${wide ? 'max-w-7xl' : 'max-w-5xl'}`} key={pathname}>
            <Outlet />
          </div>
        </main>
      </div>

      <nav aria-label="Navigation principale" className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-xl grid-cols-5">
          {BOTTOM.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink to={to} end={end} className={({ isActive }) => `flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold ${isActive ? 'text-brand' : 'text-muted'}`}>
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore(true)} className="flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.7rem] font-semibold text-muted">
              <Ellipsis className="h-5 w-5" aria-hidden />
              Plus
            </button>
          </li>
        </ul>
      </nav>
      <Drawer open={more} onClose={() => setMore(false)} title="Menu">
        <ul className="grid grid-cols-2 gap-2">
          {navFor(offer.id).filter((n) => !BOTTOM.includes(n)).map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink to={to} onClick={() => setMore(false)} className="flex min-h-14 items-center gap-3 rounded-xl border border-line px-3 font-medium hover:border-brand/40">
                <Icon className="h-5 w-5 text-brand" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Drawer>
    </div>
  );
}
