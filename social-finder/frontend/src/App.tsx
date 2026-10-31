import { Route, Routes } from 'react-router';
import Layout from './components/Layout';
import { ToastProvider } from './components/ui';
import DashboardPage from './pages/DashboardPage';
import DiscoveryPage from './pages/DiscoveryPage';
import ProspectsPage from './pages/ProspectsPage';
import ProspectPage from './pages/ProspectPage';
import QueuePage from './pages/QueuePage';
import CampaignsPage from './pages/CampaignsPage';
import MatchesPage from './pages/MatchesPage';
import StudioPage from './pages/StudioPage';
import SourcesPage from './pages/SourcesPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <ToastProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/decouverte" element={<DiscoveryPage />} />
          <Route path="/prospects" element={<ProspectsPage />} />
          <Route path="/meilleurs" element={<ProspectsPage best />} />
          <Route path="/prospects/:id" element={<ProspectPage />} />
          <Route path="/file" element={<QueuePage />} />
          <Route path="/campagnes" element={<CampaignsPage />} />
          <Route path="/campagnes/:id" element={<CampaignsPage />} />
          <Route path="/correspondances" element={<MatchesPage />} />
          <Route path="/studio" element={<StudioPage />} />
          <Route path="/sources" element={<SourcesPage />} />
          <Route path="/parametres" element={<SettingsPage />} />
          <Route path="*" element={<DashboardPage />} />
        </Routes>
      </Layout>
    </ToastProvider>
  );
}
