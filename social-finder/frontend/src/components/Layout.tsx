import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router';
import { Award, Cable, FolderKanban, GitMerge, LayoutDashboard, Menu, MessageSquareText, Radar, Send, Settings, Users, X } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/format';
import { Logo } from './brand';

const NAV = [
  { to: '/', label: 'Tableau de bord', icon: LayoutDashboard, end: true },
  { to: '/decouverte', label: 'Découverte sociale', icon: Radar },
  { to: '/prospects', label: 'Prospects', icon: Users, end: true },
  { to: '/meilleurs', label: 'Meilleurs prospects', icon: Award },
  { to: '/file', label: 'File de prospection', icon: Send, badge: 'queue' },
  { to: '/campagnes', label: 'Campagnes', icon: FolderKanban },
  { to: '/correspondances', label: 'Correspondances', icon: GitMerge, badge: 'matches' },
  { to: '/studio', label: 'Message Studio', icon: MessageSquareText },
];
const NAV2 = [
  { to: '/sources', label: 'Sources & connecteurs', icon: Cable },
  { to: '/parametres', label: 'Paramètres & RGPD', icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [counts, setCounts] = useState<{ queue: number; matches: number }>({ queue: 0, matches: 0 });
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    Promise.all([api.get<{ items: unknown[] }>('/queue'), api.get<unknown[]>('/matches')])
      .then(([q, m]) => setCounts({ queue: q.items.length, matches: m.length })).catch(() => {});
  }, [loc.pathname]);

  const link = (item: (typeof NAV)[number]) => (
    <NavLink key={item.to} to={item.to} end={item.end}
      className={({ isActive }) => cn('group flex items-center gap-3 rounded-lg px-3 h-9 text-[13.5px] transition',
        isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:text-white hover:bg-white/5')}>
      {({ isActive }) => (<>
        <item.icon className={cn('size-[17px]', isActive ? 'text-[#d4b06a]' : 'text-white/50 group-hover:text-white/80')} />
        <span className="flex-1">{item.label}</span>
        {item.badge && counts[item.badge as 'queue' | 'matches'] > 0 && (
          <span className="rounded-full bg-[#c9a45c]/90 px-1.5 text-[11px] font-semibold text-ink num">{counts[item.badge as 'queue' | 'matches']}</span>
        )}
      </>)}
    </NavLink>
  );

  const sidebar = (
    <div className="flex h-full flex-col bg-ink px-3 py-5">
      <div className="px-2 mb-7"><Logo /></div>
      <nav className="space-y-0.5">{NAV.map(link)}</nav>
      <div className="mt-6 mb-2 px-3 text-[10.5px] uppercase tracking-[0.16em] text-white/35">Configuration</div>
      <nav className="space-y-0.5">{NAV2.map(link)}</nav>
      <div className="mt-auto px-3 pt-6 text-[11px] leading-relaxed text-white/40">
        Données stockées sur cet ordinateur.<br />Envoi des messages : manuel, depuis vos comptes.
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <aside className="hidden lg:block w-64 shrink-0 h-full sticky top-0">{sidebar}</aside>
      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex" onClick={() => setOpen(false)}>
          <div className="w-64 h-full" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
          <div className="flex-1 bg-ink/40" />
        </div>
      )}
      <div className="flex-1 min-w-0 h-full overflow-y-auto scroll-thin">
        <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between bg-ink px-4 h-14">
          <Logo />
          <button onClick={() => setOpen(!open)} className="text-white p-2" aria-label="Menu">{open ? <X /> : <Menu />}</button>
        </div>
        <main className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-10 py-8 fade-in" key={loc.pathname}>{children}</main>
      </div>
    </div>
  );
}
