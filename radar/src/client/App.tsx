import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation, Link } from 'react-router';
import { api, type Meta, type User } from './api';
import { cx, Loading } from './components/ui';
import LoginPage from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const MapPage = lazy(() => import('./pages/MapPage'));
const Companies = lazy(() => import('./pages/Companies'));
const ForSale = lazy(() => import('./pages/ForSale'));
const Transmission = lazy(() => import('./pages/Transmission'));
const Proceedings = lazy(() => import('./pages/Proceedings'));
const Financial = lazy(() => import('./pages/Financial'));
const Compare = lazy(() => import('./pages/Compare'));
const Acquisitions = lazy(() => import('./pages/Acquisitions'));
const Assistant = lazy(() => import('./pages/Assistant'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Admin = lazy(() => import('./pages/Admin'));
const CompanyPage = lazy(() => import('./pages/CompanyPage'));

interface Ctx {
  user: User;
  meta: Meta;
  can: (role: 'analyste' | 'admin') => boolean;
  refreshMeta: () => void;
  logout: () => void;
  compare: number[];
  toggleCompare: (id: number) => void;
}
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => useContext(AppCtx)!;

const RANK = { lecteur: 1, analyste: 2, admin: 3 } as const;

const NAV: { to: string; label: string; icon: string; role?: 'admin' }[] = [
  { to: '/', label: 'Vue générale', icon: 'M3 12l9-9 9 9M5 10v10h14V10' },
  { to: '/carte', label: 'Carte du 76', icon: 'M9 4l-6 3v13l6-3 6 3 6-3V4l-6 3-6-3zM9 4v13M15 7v13' },
  { to: '/entreprises', label: 'Toutes les entreprises', icon: 'M4 21V5l8-3 8 3v16M9 21v-5h6v5M8 9h1M15 9h1M8 13h1M15 13h1' },
  { to: '/a-vendre', label: 'Opportunités à vendre', icon: 'M20 12l-8 8-9-9V3h8l9 9zM7.5 7.5h.01' },
  { to: '/transmissions', label: 'Transmissions potentielles', icon: 'M4 12h12M12 6l6 6-6 6M20 4v16' },
  { to: '/procedures', label: 'Procédures judiciaires', icon: 'M12 3v18M5 7l7-4 7 4M3 13l3-6 3 6a3 3 0 01-6 0zM15 13l3-6 3 6a3 3 0 01-6 0z' },
  { to: '/analyse', label: 'Analyse financière', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
  { to: '/comparateur', label: 'Comparateur', icon: 'M8 3v18M16 3v18M3 8h5M16 16h5' },
  { to: '/acquisitions', label: 'Acquisition Manager', icon: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18' },
  { to: '/radar-ai', label: 'RADAR AI', icon: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 12l5-5M12 7v.01' },
  { to: '/alertes', label: 'Alertes', icon: 'M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4' },
  { to: '/admin', label: 'Administration', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.8 1.2V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-2.8-1.2l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 004.6 15H3a2 2 0 110-4h.1a1.7 1.7 0 001.2-2.8l-.1-.1a2 2 0 112.8-2.8l.1.1A1.7 1.7 0 009 4.6V3a2 2 0 114 0v.1a1.7 1.7 0 002.8 1.2l.1-.1a2 2 0 112.8 2.8l-.1.1A1.7 1.7 0 0019.4 9H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 2z', role: 'admin' },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Layout({ children, unread }: { children: ReactNode; unread: number }) {
  const { user, logout, can, compare } = useApp();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);
  return (
    <div className="flex min-h-full">
      <aside className={cx('fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-ink-700 bg-ink-950/95 backdrop-blur transition-transform lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <Link to="/" className="flex items-center gap-2.5 px-4 py-4">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-wide text-fog-50">NORMANDIE</div>
            <div className="text-[11px] font-medium tracking-[0.18em] text-volt-400">BUSINESS RADAR</div>
          </div>
        </Link>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4" aria-label="Navigation principale">
          {NAV.filter((n) => !n.role || can(n.role)).map((n, i) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => cx('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors', isActive ? 'bg-volt-500/15 text-fog-50 shadow-[inset_2px_0_0_var(--color-volt-500)]' : 'text-fog-400 hover:bg-ink-800 hover:text-fog-100')}>
              <span className="w-4 text-right text-[10px] text-fog-500 tabular">{i + 1}</span>
              <Icon d={n.icon} />
              <span className="flex-1 truncate">{n.label}</span>
              {n.to === '/alertes' && unread > 0 && <span className="rounded-full bg-warn/20 px-1.5 text-[10px] font-semibold text-warn tabular">{unread > 99 ? '99+' : unread}</span>}
              {n.to === '/comparateur' && compare.length > 0 && <span className="rounded-full bg-volt-500/20 px-1.5 text-[10px] font-semibold text-volt-300 tabular">{compare.length}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-ink-700 px-4 py-3 text-xs">
          <div className="truncate text-fog-100">{user.name}</div>
          <div className="flex items-center justify-between text-fog-500">
            <span>{user.role}</span>
            <button className="text-fog-400 hover:text-fog-100" onClick={logout}>
              Se déconnecter
            </button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-ink-700 bg-ink-900/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button onClick={() => setOpen(true)} className="rounded-md p-1.5 text-fog-300 hover:bg-ink-800" aria-label="Ouvrir le menu">
            <Icon d="M4 6h16M4 12h16M4 18h16" />
          </button>
          <span className="text-sm font-semibold">Normandie Business Radar</span>
        </header>
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-4 py-5 sm:px-6">
          <Suspense fallback={<Loading />}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="py-16 text-center text-sm text-fog-400">
      Page introuvable. <Link className="text-volt-300 underline" to="/">Retour à la vue générale</Link>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState<{ loading: boolean; user: User | null; setupRequired: boolean; setupTokenConfigured: boolean }>({ loading: true, user: null, setupRequired: false, setupTokenConfigured: false });
  const [meta, setMeta] = useState<Meta | null>(null);
  const [unread, setUnread] = useState(0);
  const [compare, setCompare] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('radar:compare') ?? '[]');
    } catch {
      return [];
    }
  });
  const load = useCallback(async () => {
    try {
      const s = await api.get<{ setupRequired: boolean; setupTokenConfigured: boolean; user: User | null }>('/auth/status');
      setState({ loading: false, ...s });
      if (s.user) setMeta(await api.get<Meta>('/meta'));
    } catch {
      setState((x) => ({ ...x, loading: false }));
    }
  }, []);
  useEffect(() => {
    void load();
    const h = () => setState((x) => ({ ...x, user: null }));
    window.addEventListener('radar:unauthorized', h);
    return () => window.removeEventListener('radar:unauthorized', h);
  }, [load]);
  useEffect(() => {
    if (!state.user) return;
    const poll = () => api.get<{ unread: number }>('/alerts?unread=1').then((r) => setUnread(r.unread)).catch(() => {});
    void poll();
    const t = setInterval(poll, 120_000);
    return () => clearInterval(t);
  }, [state.user]);
  useEffect(() => {
    try {
      localStorage.setItem('radar:compare', JSON.stringify(compare));
    } catch {
      /* stockage indisponible */
    }
  }, [compare]);

  if (state.loading) return <Loading label="Démarrage…" />;
  if (!state.user) return <LoginPage setupRequired={state.setupRequired} setupTokenConfigured={state.setupTokenConfigured} onDone={load} />;
  if (!meta) return <Loading />;
  const user = state.user;
  const ctx: Ctx = {
    user,
    meta,
    can: (r) => RANK[user.role] >= RANK[r],
    refreshMeta: () => void api.get<Meta>('/meta').then(setMeta),
    logout: () => void api.post('/auth/logout').finally(() => setState((x) => ({ ...x, user: null }))),
    compare,
    toggleCompare: (id) => setCompare((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id].slice(-6))),
  };
  return (
    <AppCtx.Provider value={ctx}>
      <BrowserRouter>
        <Layout unread={unread}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/carte" element={<MapPage />} />
            <Route path="/entreprises" element={<Companies />} />
            <Route path="/entreprises/:id" element={<CompanyPage />} />
            <Route path="/a-vendre" element={<ForSale />} />
            <Route path="/transmissions" element={<Transmission />} />
            <Route path="/procedures" element={<Proceedings />} />
            <Route path="/analyse" element={<Financial />} />
            <Route path="/analyse/:id" element={<Financial />} />
            <Route path="/comparateur" element={<Compare />} />
            <Route path="/acquisitions" element={<Acquisitions />} />
            <Route path="/acquisitions/:id" element={<Acquisitions />} />
            <Route path="/radar-ai" element={<Assistant />} />
            <Route path="/alertes" element={<Alerts onRead={() => api.get<{ unread: number }>('/alerts?unread=1').then((r) => setUnread(r.unread))} />} />
            <Route path="/admin/*" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </AppCtx.Provider>
  );
}
