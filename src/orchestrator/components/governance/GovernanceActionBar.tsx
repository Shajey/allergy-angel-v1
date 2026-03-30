/**
 * O7 — Dedicated action strip below proposal preview (Approve & Promote / Reject & Close).
 */

export type GovernanceActionPhase = "idle" | "busy" | "success" | "error";

export interface GovernanceActionBarProps {
  impactLine: string;
  phase: GovernanceActionPhase;
  errorMessage?: string | null;
  /** Shown when phase === "success" */
  successVariant?: "approved" | "rejected" | null;
  onApprove: () => void;
  onReject: () => void;
  /** When false, buttons are disabled (no pending selection). */
  actionsEnabled: boolean;
}

export default function GovernanceActionBar({
  impactLine,
  phase,
  errorMessage,
  successVariant,
  onApprove,
  onReject,
  actionsEnabled,
}: GovernanceActionBarProps) {
  const busy = phase === "busy";
  const showSuccess = phase === "success" && successVariant === "approved";
  const showRejectSuccess = phase === "success" && successVariant === "rejected";
  const showError = phase === "error";

  if (showSuccess) {
    return (
      <div
        data-testid="governance-action-success"
        className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center"
      >
        <p className="text-sm font-semibold text-emerald-900">Promoted successfully</p>
        <p className="mt-2 text-sm leading-relaxed text-emerald-950/90">
          This change has been applied through the registry promotion flow and will affect future checks.
        </p>
      </div>
    );
  }

  if (showRejectSuccess) {
    return (
      <div
        data-testid="governance-reject-success"
        className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center"
      >
        <p className="text-sm font-semibold text-[#0F172A]">Closed without promotion</p>
        <p className="mt-2 text-sm leading-relaxed text-[#475569]">
          This proposal was rejected and removed from the pending queue.
        </p>
      </div>
    );
  }

  const canClick = actionsEnabled && !busy;

  return (
    <div
      data-testid="governance-action-bar"
      className="rounded-xl border border-[#E2E8F0] bg-[#FAFAFA] p-5"
    >
      <p className="text-center text-sm font-medium text-[#334155]" data-testid="governance-impact-line">
        {impactLine}
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <button
          type="button"
          data-testid="governance-approve-promote"
          onClick={onApprove}
          disabled={!canClick}
          className="orch-gradient-btn order-1 w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:opacity-50 sm:order-none sm:min-w-[200px] sm:flex-1 sm:max-w-xs"
        >
          {busy ? "Working…" : "Approve & Promote"}
        </button>
        <button
          type="button"
          data-testid="governance-reject-close"
          onClick={onReject}
          disabled={!canClick}
          className="order-2 w-full rounded-xl border border-[#CBD5E1] bg-white px-5 py-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] disabled:opacity-50 sm:order-none sm:min-w-[200px] sm:flex-1 sm:max-w-xs"
        >
          Reject & Close
        </button>
      </div>
      {showError && errorMessage ? (
        <p className="mt-3 text-center text-sm font-medium text-[#B91C1C]" role="alert" data-testid="governance-action-error">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
