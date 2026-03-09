/**
 * Phase O4/O5 – Research Workspace Layout
 * Lab bench layout: Chain of Evidence — TARGET → EVIDENCE → PROPOSAL MANIFEST → GOVERNANCE FOOTER.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const GOVERNANCE_NOTE =
  "Research output is admin-only, not verified, and does not affect production until promoted through governed proposal flow.";

interface Props {
  children: ReactNode;
}

export default function ResearchWorkspaceLayout({ children }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
        <h1 className="orch-section-header text-[22px]">Research Workspace</h1>
        <Link
          to="/orchestrator/radar"
          className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
        >
          Back to Radar →
        </Link>
      </header>

      <div
        className="rounded-xl border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-sm text-[#92400E]"
        role="status"
      >
        {GOVERNANCE_NOTE}
      </div>

      <main className="flex flex-col gap-8">{children}</main>
    </div>
  );
}
