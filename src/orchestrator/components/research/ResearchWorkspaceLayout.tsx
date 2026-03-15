/**
 * Phase O4/O5 – Research Workspace Layout
 * Lab bench layout: Chain of Evidence — TARGET → EVIDENCE → PROPOSAL MANIFEST → GOVERNANCE FOOTER.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const RESEARCH_DESCRIPTION =
  "Research investigates safety signals and gathers evidence. It produces proposal drafts but does not change production knowledge.";

interface Props {
  children: ReactNode;
}

export default function ResearchWorkspaceLayout({ children }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between pb-4 border-b border-[#E2E8F0]">
        <div>
          <h1 className="orch-section-header text-[22px]">Research Workspace</h1>
          <h2 className="text-sm font-semibold text-[#64748B] mt-1">Investigation</h2>
        </div>
        <Link
          to="/orchestrator/radar"
          className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
        >
          Back to Safety Signals →
        </Link>
      </header>

      <p className="text-sm text-[#64748B] leading-relaxed">
        {RESEARCH_DESCRIPTION}
      </p>

      <main className="flex flex-col gap-8">{children}</main>
    </div>
  );
}
