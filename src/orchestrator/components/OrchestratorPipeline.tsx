/**
 * Phase O6 – Orchestrator Pipeline Indicator
 * Investigate → Draft → Govern → Publish
 * Radar is the signal feed, not a workflow stage.
 */

import { Link, useLocation } from "react-router-dom";

const STAGES = [
  { id: "investigate", label: "Investigate", path: "/orchestrator/research" },
  { id: "draft", label: "Draft", path: "/orchestrator/research" },
  { id: "govern", label: "Govern", path: "/orchestrator/governance" },
  { id: "publish", label: "Publish", path: "/orchestrator/registry" },
] as const;

function getActiveStage(pathname: string): string | null {
  if (pathname.startsWith("/orchestrator/research")) return "investigate";
  if (pathname.startsWith("/orchestrator/governance")) return "govern";
  if (pathname.startsWith("/orchestrator/registry")) return "publish";
  if (pathname.startsWith("/orchestrator/ingestion")) return "draft";
  if (pathname.startsWith("/orchestrator/graph")) return "investigate";
  return null;
}

export default function OrchestratorPipeline() {
  const location = useLocation();
  const activeStage = getActiveStage(location.pathname);

  return (
    <div
      className="mx-4 mb-0 flex items-center gap-1 px-4 py-2 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0]"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {STAGES.map((stage, i) => {
        const isActive = activeStage === stage.id;
        const path = stage.id === "investigate" || stage.id === "draft" ? "/orchestrator/research"
          : stage.id === "govern" ? "/orchestrator/governance"
          : "/orchestrator/registry";
        return (
          <span key={stage.id} className="flex items-center gap-1">
            <Link
              to={path}
              className={`inline-block px-2.5 py-1 rounded text-[11px] font-semibold uppercase tracking-wide transition-colors ${
                isActive
                  ? "bg-[#0F172A] text-white"
                  : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]"
              }`}
            >
              {stage.label}
            </Link>
            {i < STAGES.length - 1 && (
              <span className="text-[#CBD5E1] text-[11px] px-0.5" aria-hidden>
                &gt;
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
