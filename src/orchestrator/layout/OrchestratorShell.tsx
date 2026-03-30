/**
 * Phase O1/O3/O5.1 – Orchestrator Shell
 * Mission Control layout. Selection context for interactive workflow.
 * O5.1: Graph telemetry for demo audit log.
 */

import { Outlet, useLocation } from "react-router-dom";
import { OrchestratorSelectionProvider } from "../context/OrchestratorSelectionContext";
import { InvestigationStoreProvider } from "../context/InvestigationStoreContext";
import { GraphTelemetryProvider } from "../context/GraphTelemetryContext";
import { ActivityStoreProvider } from "../lib/activityStore";
import { GovernanceStoreProvider } from "../lib/governanceStore";
import CommandBar from "../components/CommandBar";
import OrchestratorPipeline from "../components/OrchestratorPipeline";
import SignalRadarPanel from "../components/SignalRadarPanel";
import ContextPanel from "../components/ContextPanel";
import ActivityStream from "../components/ActivityStream";

export default function OrchestratorShell() {
  const location = useLocation();
  const signalsWorkbench =
    location.pathname === "/orchestrator/radar" || location.pathname.startsWith("/orchestrator/radar/");
  const governanceWorkbench =
    location.pathname === "/orchestrator/governance" || location.pathname.startsWith("/orchestrator/governance/");
  const hideContextPanel = signalsWorkbench || governanceWorkbench;

  return (
    <OrchestratorSelectionProvider>
      <ActivityStoreProvider>
      <GovernanceStoreProvider>
      <InvestigationStoreProvider>
      <GraphTelemetryProvider>
      <div className="orch-bg flex h-[100dvh] flex-col overflow-hidden px-4 pt-4">
        <CommandBar />
        <OrchestratorPipeline />
        <div className="flex min-h-0 flex-1 gap-4 pt-4">
          <div className="w-72 shrink-0 overflow-auto rounded-xl border border-[#E2E8F0] bg-slate-50 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.05)]">
            <SignalRadarPanel />
          </div>
          <main className="orch-card min-h-0 min-w-0 flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          {!hideContextPanel ? (
            <div className="orch-card-frosted w-64 shrink-0 overflow-auto">
              <ContextPanel />
            </div>
          ) : null}
        </div>
        <footer className="shrink-0 h-0 overflow-visible">
          <ActivityStream />
        </footer>
      </div>
      </GraphTelemetryProvider>
      </InvestigationStoreProvider>
      </GovernanceStoreProvider>
      </ActivityStoreProvider>
    </OrchestratorSelectionProvider>
  );
}
