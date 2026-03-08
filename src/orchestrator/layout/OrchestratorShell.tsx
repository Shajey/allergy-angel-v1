/**
 * Phase O1/O3 – Orchestrator Shell
 * Mission Control layout. Selection context for interactive workflow.
 */

import { Outlet } from "react-router-dom";
import { OrchestratorSelectionProvider } from "../context/OrchestratorSelectionContext";
import CommandBar from "../components/CommandBar";
import SignalRadarPanel from "../components/SignalRadarPanel";
import ContextPanel from "../components/ContextPanel";
import ActivityStream from "../components/ActivityStream";

export default function OrchestratorShell() {
  return (
    <OrchestratorSelectionProvider>
      <div className="orch-bg flex min-h-screen flex-col pt-4 px-4">
        <CommandBar />
        <div className="flex flex-1 min-h-0 gap-4 p-4">
          <div className="orch-card shrink-0 overflow-auto">
            <SignalRadarPanel />
          </div>
          <main className="orch-card flex-1 min-w-0 overflow-auto p-6">
            <Outlet />
          </main>
          <div className="orch-card-frosted shrink-0 overflow-auto">
            <ContextPanel />
          </div>
        </div>
        <ActivityStream />
      </div>
    </OrchestratorSelectionProvider>
  );
}
