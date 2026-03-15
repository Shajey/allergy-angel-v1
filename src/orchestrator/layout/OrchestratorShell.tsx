/**
 * Phase O1/O3/O5.1 – Orchestrator Shell
 * Mission Control layout. Selection context for interactive workflow.
 * O5.1: Graph telemetry for demo audit log.
 */

import { Outlet } from "react-router-dom";
import { OrchestratorSelectionProvider } from "../context/OrchestratorSelectionContext";
import { GraphTelemetryProvider } from "../context/GraphTelemetryContext";
import { ActivityStoreProvider } from "../lib/activityStore";
import CommandBar from "../components/CommandBar";
import OrchestratorPipeline from "../components/OrchestratorPipeline";
import SignalRadarPanel from "../components/SignalRadarPanel";
import ContextPanel from "../components/ContextPanel";
import ActivityStream from "../components/ActivityStream";

export default function OrchestratorShell() {
  return (
    <OrchestratorSelectionProvider>
      <ActivityStoreProvider>
      <GraphTelemetryProvider>
      <div className="orch-bg flex h-[100dvh] flex-col overflow-hidden px-4 pt-4">
        <CommandBar />
        <OrchestratorPipeline />
        <div className="flex min-h-0 flex-1 gap-4 pt-4">
          <div className="orch-card w-56 shrink-0 overflow-auto">
            <SignalRadarPanel />
          </div>
          <main className="orch-card min-h-0 min-w-0 flex-1 overflow-auto p-6">
            <Outlet />
          </main>
          <div className="orch-card-frosted w-64 shrink-0 overflow-auto">
            <ContextPanel />
          </div>
        </div>
        <footer className="shrink-0 h-0 overflow-visible">
          <ActivityStream />
        </footer>
      </div>
      </GraphTelemetryProvider>
      </ActivityStoreProvider>
    </OrchestratorSelectionProvider>
  );
}
