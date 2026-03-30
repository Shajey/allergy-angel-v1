/**
 * Shared proposal preview — same red/green before-after surface for Signals and Governance (O6.11).
 */

import type { InvestigationEntry, ProposalPreview } from "../lib/investigationTypes";

export function ProposalPreviewSection({
  preview,
  ledgerLine,
  readOnly = false,
  onSubmitGovernance,
  className = "",
}: {
  preview: ProposalPreview | NonNullable<InvestigationEntry["proposalPreview"]>;
  ledgerLine?: { current: string; proposed: string };
  readOnly?: boolean;
  onSubmitGovernance?: () => void;
  /** Optional wrapper class (e.g. mt-5) */
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`.trim()}>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Proposal preview</p>
      {ledgerLine ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-3 text-[13px] leading-relaxed text-[#0F172A]">
          <p>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              CURRENT:{" "}
            </span>
            {ledgerLine.current}
          </p>
          <p className="mt-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
              PROPOSED:{" "}
            </span>
            {ledgerLine.proposed}
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-900">Before</p>
          <p className="mt-2 text-[15px] leading-snug text-[#334155]">{preview.before}</p>
        </div>
        <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900">After</p>
          <p className="mt-2 text-[15px] leading-snug text-[#334155]">{preview.after}</p>
        </div>
      </div>
      {"safetySemantics" in preview && preview.safetySemantics ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-3 text-[13px] text-amber-950"
          data-testid="proposal-safety-semantics"
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Safety meaning (O8)</p>
          <ul className="mt-2 list-inside list-disc space-y-1 leading-relaxed">
            <li>Type: {preview.safetySemantics.type}</li>
            {preview.safetySemantics.class ? <li>Class: {preview.safetySemantics.class}</li> : null}
            <li>Risk tag(s): {preview.safetySemantics.riskTags.join(", ")}</li>
          </ul>
          <p className="mt-2 text-[12px] leading-snug text-amber-900/90">
            This proposal changes future verdicts when profile risks match these tags — not only naming or resolution.
          </p>
        </div>
      ) : null}
      {!readOnly && onSubmitGovernance ? (
        <button
          type="button"
          onClick={onSubmitGovernance}
          className="orch-gradient-btn inline-flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold shadow-sm sm:w-auto"
        >
          Submit for Governance
        </button>
      ) : null}
    </div>
  );
}

export function PendingGovernanceSection({
  preview,
  ledgerLine,
}: {
  preview: NonNullable<InvestigationEntry["proposalPreview"]>;
  ledgerLine?: { current: string; proposed: string };
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-4">
        <p className="text-sm font-semibold text-amber-950">Submitted for Governance</p>
        <p className="mt-1 text-[15px] text-amber-900">Awaiting review</p>
        <p className="mt-3 text-xs leading-relaxed text-amber-800/90">
          Submitted for Governance. This signal is locked until approved or rejected.
        </p>
      </div>
      <ProposalPreviewSection preview={preview} ledgerLine={ledgerLine} readOnly />
    </div>
  );
}
