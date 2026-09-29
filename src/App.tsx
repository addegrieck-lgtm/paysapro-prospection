import { lazy, Suspense, type ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router';
import { ToastProvider } from './components/ui/Feedback';
import { Skeleton } from './components/ui/Extras';
import { AppProvider } from './app/context';
import { Layout, LogoMark } from './app/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { ProspectsPage } from './pages/ProspectsPage';

const lazyPage = <K extends string>(load: () => Promise<Record<K, () => ReactNode>>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })));

const ProspectPage = lazyPage(() => import('./pages/ProspectPage'), 'ProspectPage');
const ProspectFormPage = lazyPage(() => import('./pages/ProspectFormPage'), 'ProspectFormPage');
const ImportPage = lazyPage(() => import('./pages/ImportPage'), 'ImportPage');
const SegmentsPage = lazyPage(() => import('./pages/SegmentsPage'), 'SegmentsPage');
const CampaignsPage = lazyPage(() => import('./pages/CampaignsPage'), 'CampaignsPage');
const CampaignPage = lazyPage(() => import('./pages/CampaignsPage'), 'CampaignPage');
const PerformancePage = lazyPage(() => import('./pages/PerformancePage'), 'PerformancePage');
const DuplicatesPage = lazyPage(() => import('./pages/DuplicatesPage'), 'DuplicatesPage');
const TasksPage = lazyPage(() => import('./pages/TasksPage'), 'TasksPage');
const TemplatesPage = lazyPage(() => import('./pages/TemplatesPage'), 'TemplatesPage');
const StatsPage = lazyPage(() => import('./pages/StatsPage'), 'StatsPage');
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage');

function Splash({ message }: { message: string | null }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 p-6 text-center" aria-busy={!message}>
      <LogoMark className="h-14 w-14" />
      {message ? (
        <>
          <p className="max-w-sm text-muted">{message}</p>
          <button type="button" onClick={() => window.location.reload()} className="min-h-12 rounded-xl bg-brand px-5 font-semibold text-on-brand">
            Réessayer
          </button>
        </>
      ) : (
        <div className="w-56 space-y-2" aria-label="Chargement">
          <Skeleton className="h-3" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      )}
    </div>
  );
}

function NotFound() {
  return <p className="text-muted">Page introuvable.</p>;
}

export default function App() {
  return (
    // HashRouter : fonctionne sur GitHub Pages sans configuration serveur (URL du type /#/prospects)
    <HashRouter>
      <ToastProvider>
        <AppProvider fallback={(error) => <Splash message={error} />}>
          <Suspense fallback={<Skeleton className="m-6 h-40" />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<DashboardPage />} />
                <Route path="prospects" element={<ProspectsPage />} />
                <Route path="prospects/new" element={<ProspectFormPage />} />
                <Route path="prospects/:id" element={<ProspectPage />} />
                <Route path="prospects/:id/edit" element={<ProspectFormPage />} />
                <Route path="import" element={<ImportPage />} />
                <Route path="duplicates" element={<DuplicatesPage />} />
                <Route path="performance" element={<PerformancePage />} />
                <Route path="segments" element={<SegmentsPage />} />
                <Route path="campaigns" element={<CampaignsPage />} />
                <Route path="campaigns/:id" element={<CampaignPage />} />
                <Route path="tasks" element={<TasksPage />} />
                <Route path="templates" element={<TemplatesPage />} />
                <Route path="stats" element={<StatsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </AppProvider>
      </ToastProvider>
    </HashRouter>
  );
}
