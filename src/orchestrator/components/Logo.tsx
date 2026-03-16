/**
 * Phase O3 – Orchestrator Brand Identity
 * Clinical Modernism mark: shield + radar node, high-fidelity logotype.
 */

import { Link } from "react-router-dom";

function OrchestratorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 36"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Shield outline — clean, geometric, symmetrical */}
      <path d="M16 2 L28 8 L28 18 Q28 28 16 34 Q4 28 4 18 L4 8 Z" />
      {/* Radar node — filled circle at top-center */}
      <circle cx="16" cy="7" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function Logo() {
  return (
    <Link
      to="/orchestrator/radar"
      className="orch-logo flex items-center gap-3 pr-4 border-r border-[#E2E8F0] hover:opacity-90 transition-opacity"
    >
      <OrchestratorIcon className="w-8 h-9 shrink-0 text-[#0F172A]" />
      <div className="flex flex-col gap-0.5">
        <span className="orch-logo-title flex items-baseline text-base">
          <span className="orch-logo-aa">AA</span>
          <span className="orch-logo-word"> Orchestrator</span>
        </span>
        <span className="orch-logo-sub">SAFETY INTELLIGENCE</span>
      </div>
    </Link>
  );
}
