/**
 * Governance center — same proposal preview surface as Signals (O6.11).
 */

import type { GovernanceItem } from "../../lib/governanceStore";
import { ProposalPreviewSection } from "../ProposalPreviewWorkbench";

export default function GovernanceSignalReviewDesk({ item }: { item: GovernanceItem }) {
  return (
    <div data-testid="governance-signal-review-desk" className="space-y-6">
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Review packet</p>
        <p className="mt-2 text-lg font-semibold text-[#0F172A]">{item.entity}</p>
        <p className="mt-1 font-mono text-xs text-[#64748B]">{item.proposalType}</p>
        <dl className="mt-4 grid gap-2 border-t border-slate-100 pt-4 text-sm text-[#475569] sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Confidence</dt>
            <dd className="mt-0.5 font-medium text-[#0F172A]">{item.confidence ?? "—"}%</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Submitted</dt>
            <dd className="mt-0.5">{new Date(item.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      <p className="text-sm leading-relaxed text-[#64748B]">
        <span className="font-semibold text-[#334155]">Same packet as Signals.</span> The investigator submitted this
        before/after diff; governance reviews the identical preview below.
      </p>

      <ProposalPreviewSection
        className="mt-0"
        preview={{ before: item.before, after: item.after }}
        ledgerLine={item.ledgerLine}
        readOnly
      />
    </div>
  );
}
