import { useState } from 'react';
import Login from './screens/Login';
import Layout from './components/Layout';
import Dashboard from './screens/Dashboard';
import MapView from './screens/MapView';
import LiveEmissions from './screens/LiveEmissions';
import VesselMetrics from './screens/VesselMetrics';
import ReportGenerator from './screens/ReportGenerator';
import Settings from './screens/Settings';
import EmissionsReplay from './screens/EmissionsReplay';

export default function App() {
  const [authed, setAuthed] = useState(false);
  const [page, setPage] = useState('dashboard');

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  const screens = {
    dashboard:    <Dashboard onNavigate={setPage} />,
    map:          <MapView />,
    emissions:    <LiveEmissions />,
    replay:       <EmissionsReplay />,
    vessels:      <VesselMetrics />,
    reports:      <ReportGenerator />,
    settings:     <Settings />,
  };

  return (
    <Layout page={page} onNavigate={setPage} onLogout={() => setAuthed(false)}>
      {screens[page] ?? screens.dashboard}
    </Layout>
  );
}
