/**
 * Governance — single-proposal review: type badge, summary, rationale, before/after, then Approve & Promote.
 */

import {
  type GovernanceProposalRow,
  classifyGovernanceProposal,
  governanceBeforeAfterStrings,
  governanceProposalRationaleLines,
  governanceProposalSummary,
  governanceProposalTypeLabel,
  type GovernanceProposalKind,
} from "../../lib/governanceProposal";

export interface ProposalReviewPanelProps {
  proposal: GovernanceProposalRow | null;
  promoting?: boolean;
  feedback: { kind: "success" | "error" | null; message: string };
  onApprovePromote: () => void;
  /** O6.11 — hide registry export actions until promotion pipeline is wired. */
  showPromoteActions?: boolean;
  /** O7 — parent owns Governance action bar below preview. */
  hideFooter?: boolean;
}

function typeBadgeClass(kind: GovernanceProposalKind): string {
  switch (kind) {
    case "alias":
      return "border-sky-200 bg-sky-50 text-sky-950";
    case "new_entity":
      return "border-emerald-200 bg-emerald-50 text-emerald-950";
    case "relationship":
      return "border-amber-200 bg-amber-50 text-amber-950";
  }
}

export default function ProposalReviewPanel({
  proposal,
  promoting = false,
  feedback,
  onApprovePromote,
  showPromoteActions = true,
  hideFooter = false,
}: ProposalReviewPanelProps) {
  if (!proposal) {
    return (
      <div className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center text-sm text-[#64748B]">
        Select a pending proposal to review.
      </div>
    );
  }

  const kind = classifyGovernanceProposal(proposal);
  const typeLabel = governanceProposalTypeLabel(kind);
  const summary = governanceProposalSummary(proposal, kind);
  const { before, after } = governanceBeforeAfterStrings(proposal, kind);
  const subject = `${proposal.registry_type}/${proposal.canonical_id}`;
  const rationaleLines = governanceProposalRationaleLines(proposal);

  return (
    <div data-testid="proposal-review-root" className="flex flex-col gap-6">
      <div
        data-testid="proposal-review-block-type"
        className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Proposal type</p>
        <span
          data-testid="proposal-type-badge"
          className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${typeBadgeClass(kind)}`}
        >
          {typeLabel}
        </span>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Registry target</p>
        <p className="mt-1 font-mono text-sm text-[#0F172A]">{subject}</p>
      </div>

      <div
        data-testid="proposal-review-block-summary"
        className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Summary</p>
        <p data-testid="proposal-review-summary" className="mt-2 text-base font-medium leading-snug text-[#0F172A]">
          {summary}
        </p>
      </div>

      <div
        data-testid="proposal-review-block-rationale"
        className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Why this is proposed</p>
        {rationaleLines.length > 0 ? (
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[#475569]">
            {rationaleLines.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
            No extra rationale, evidence, or research notes were stored with this draft. Use Registry or Research
            workflows to attach notes when available.
          </p>
        )}
      </div>

      {(() => {
        const pe = proposal.proposed_entry;
        if (!pe || typeof pe !== "object") return null;
        const o = pe as Record<string, unknown>;
        const typ = typeof o.type === "string" ? o.type : null;
        const cls =
          typeof o.class === "string" ? o.class : typeof o.family === "string" ? o.family : null;
        const riskTags = Array.isArray(o.riskTags)
          ? o.riskTags.filter((x): x is string => typeof x === "string")
          : [];
        if (!typ && !cls && riskTags.length === 0) return null;
        return (
          <div
            data-testid="proposal-review-o8-safety"
            className="rounded-xl border border-amber-200 bg-amber-50/90 p-6 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Safety meaning (O8)</p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm leading-relaxed text-amber-950">
              {typ ? <li>Type: {typ}</li> : null}
              {cls ? <li>Class: {cls}</li> : null}
              {riskTags.length > 0 ? <li>Risk tag(s): {riskTags.join(", ")}</li> : null}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-amber-900/90">
              This change adds semantic risk signals used by deterministic verdict checks — not only canonical naming.
            </p>
          </div>
        );
      })()}

      <div
        data-testid="proposal-review-block-change"
        className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-4">What will change</p>
        <div
          data-testid="proposal-review-change"
          className="grid gap-4 sm:grid-cols-2"
        >
          <div>
            <p className="text-xs font-semibold text-[#64748B]">Before</p>
            <p className="mt-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm leading-relaxed text-[#334155]">
              {before}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#64748B]">After</p>
            <p className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/80 p-3 text-sm leading-relaxed text-[#14532D]">
              {after}
            </p>
          </div>
        </div>
      </div>

      {!hideFooter && showPromoteActions ? (
        <div data-testid="proposal-review-block-approve" className="rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] p-6">
          <button
            type="button"
            onClick={onApprovePromote}
            disabled={promoting}
            className="orch-gradient-btn w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
          >
            {promoting ? "Promoting…" : "Approve & Promote"}
          </button>
          {feedback.kind && (
            <p
              role="status"
              className={
                feedback.kind === "success"
                  ? "mt-3 text-sm font-medium text-[#047857]"
                  : "mt-3 text-sm font-medium text-[#B91C1C]"
              }
            >
              {feedback.message}
            </p>
          )}
        </div>
      ) : null}
      {!hideFooter && !showPromoteActions ? (
        <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center text-sm text-[#64748B]">
          Approve &amp; Promote and registry export are not wired in this build — review only.
        </p>
      ) : null}
    </div>
  );
}
