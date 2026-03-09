import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { ToastContainer } from "./components/ui/toast";
import { ProfileProvider } from "./context/ProfileContext";
import { OrchestratorThemeProvider } from "./orchestrator/theme/OrchestratorThemeProvider";
import OrchestratorShell from "./orchestrator/layout/OrchestratorShell";

import AskPage from "./pages/AskPage";
import ResultPage from "./pages/ResultPage";
import AngelProfilePage from "./pages/AngelProfilePage";
import HistoryPage from "./pages/HistoryPage";
import HistoryCheckDetailPage from "./pages/HistoryCheckDetailPage";
import InsightsPage from "./pages/InsightsPage";
import ManageProfilesPage from "./pages/ManageProfilesPage";

// Orchestrator pages — lazy loaded
const AdminUnmappedPage = lazy(() => import("./pages/AdminUnmappedPage"));
const AdminRegistryPage = lazy(() => import("./pages/AdminRegistryPage"));
const AdminIngestionPage = lazy(() => import("./pages/AdminIngestionPage"));
const ResearchWorkspacePage = lazy(() => import("./orchestrator/pages/ResearchWorkspacePage"));
const GraphPage = lazy(() => import("./orchestrator/pages/GraphPage"));
const GovernancePage = lazy(() => import("./orchestrator/pages/GovernancePage"));
const ActivityPage = lazy(() => import("./orchestrator/pages/ActivityPage"));

function OrchestratorFallback() {
  return (
    <div className="flex items-center justify-center p-12">
      <p className="text-sm text-[#64748B]">Loading…</p>
    </div>
  );
}

function App() {
  return (
    <Router>
      <ProfileProvider>
        <ToastContainer />
        <Routes>
          <Route path="/" element={<Navigate to="/ask" replace />} />

          {/* AA consumer routes — AppShell */}
          <Route element={<AppShell />}>
            <Route path="ask" element={<AskPage />} />
            <Route path="result" element={<ResultPage />} />
            <Route path="profile" element={<AngelProfilePage />} />
            <Route path="history" element={<HistoryPage />} />
            <Route path="history/:id" element={<HistoryCheckDetailPage />} />
            <Route path="insights" element={<InsightsPage />} />
            <Route path="manage-profiles" element={<ManageProfilesPage />} />
          </Route>

          {/* Orchestrator routes — own shell, theme, lazy loaded */}
          <Route
            path="orchestrator"
            element={
              <OrchestratorThemeProvider>
                <OrchestratorShell />
              </OrchestratorThemeProvider>
            }
          >
            <Route index element={<Navigate to="/orchestrator/radar" replace />} />
            <Route
              path="radar"
              element={
                <Suspense fallback={<OrchestratorFallback />}>
                  <AdminUnmappedPage />
                </Suspense>
              }
            />
            <Route
              path="registry"
              element={
                <Suspense fallback={<OrchestratorFallback />}>
                  <AdminRegistryPage />
                </Suspense>
              }
            />
            <Route
              path="ingestion"
              element={
                <Suspense fallback={<OrchestratorFallback />}>
                  <AdminIngestionPage />
                </Suspense>
              }
            />
            <Route
              path="research"
              element={
                <Suspense fallback={<OrchestratorFallback />}>
                  <ResearchWorkspacePage />
                </Suspense>
              }
            />
            <Route
              path="graph"
              element={
                <Suspense fallback={<OrchestratorFallback />}>
                  <GraphPage />
                </Suspense>
              }
            />
            <Route
              path="governance"
              element={
                <Suspense fallback={<OrchestratorFallback />}>
                  <GovernancePage />
                </Suspense>
              }
            />
            <Route
              path="activity"
              element={
                <Suspense fallback={<OrchestratorFallback />}>
                  <ActivityPage />
                </Suspense>
              }
            />
          </Route>

          {/* Backward compatibility: redirect /admin/* to /orchestrator/* */}
          <Route path="admin/unmapped" element={<Navigate to="/orchestrator/radar" replace />} />
          <Route path="admin/registry" element={<Navigate to="/orchestrator/registry" replace />} />
          <Route path="admin/ingestion" element={<Navigate to="/orchestrator/ingestion" replace />} />

          <Route path="*" element={<Navigate to="/ask" replace />} />
        </Routes>
      </ProfileProvider>
    </Router>
  );
}

export default App;
