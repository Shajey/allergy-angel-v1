import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AppShell from './components/layout/AppShell';
import { ToastContainer } from './components/ui/toast';
import { ProfileProvider } from './context/ProfileContext';

import AskPage from './pages/AskPage';
import ResultPage from './pages/ResultPage';
import AngelProfilePage from './pages/AngelProfilePage';
import HistoryPage from './pages/HistoryPage';
import HistoryCheckDetailPage from './pages/HistoryCheckDetailPage';
import InsightsPage from './pages/InsightsPage';
import AdminUnmappedPage from './pages/AdminUnmappedPage';
import ManageProfilesPage from './pages/ManageProfilesPage';

function App() {
  return (
      <Router>
        <ProfileProvider>
        <ToastContainer />
        <Routes>
          {/* Default route */}
          <Route path="/" element={<Navigate to="/ask" replace />} />

          {/* Main app routes within AppShell */}
          <Route element={<AppShell />}>
            <Route path="ask" element={<AskPage />} />
            <Route path="result" element={<ResultPage />} />
            <Route path="profile" element={<AngelProfilePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="history/:id" element={<HistoryCheckDetailPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="manage-profiles" element={<ManageProfilesPage />} />
            <Route path="admin/unmapped" element={<AdminUnmappedPage />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/ask" replace />} />
        </Routes>
        </ProfileProvider>
      </Router>
  
  );
}

export default App;
