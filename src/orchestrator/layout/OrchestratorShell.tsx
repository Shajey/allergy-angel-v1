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
      <div className="flex min-h-screen flex-col bg-[#F8FAFC]">
        <CommandBar />
        <div className="flex flex-1 min-h-0">
          <SignalRadarPanel />
          <main className="flex-1 min-w-0 overflow-auto p-6">
            <Outlet />
          </main>
          <ContextPanel />
        </div>
        <ActivityStream />
      </div>
    </OrchestratorSelectionProvider>
  );
}
