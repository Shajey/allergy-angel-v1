/**
 * Phase O6.4 — High-density queue row for the left rail.
 * Click row to select; actions live in the right Context panel.
 */

export type QueueRiskLevel = "high" | "medium" | "low";
export type QueueBadge = "new" | "gap";

export type QueueInvestigationStatus = "researching" | "proposal_ready" | "pending_governance";

interface SignalCardProps {
  /** Primary label (entity pair, name, etc.) */
  title: string;
  /** Muted subline, e.g. occurrences or type */
  subtext?: string;
  /** Left 4px bar: high = red, medium = amber, low = slate */
  riskLevel: QueueRiskLevel;
  /** Optional right badge */
  badge?: QueueBadge | null;
  /** Phase O6.9 — center workflow state (left-rail dot / check) */
  investigationStatus?: QueueInvestigationStatus | null;
  onSelect?: () => void;
  isSelected?: boolean;
}

const riskBarClass: Record<QueueRiskLevel, string> = {
  high: "bg-[#EF4444]",
  medium: "bg-[#F59E0B]",
  low: "bg-[#CBD5E1]",
};

export default function SignalCard({
  title,
  subtext,
  riskLevel,
  badge,
  investigationStatus,
  onSelect,
  isSelected = false,
}: SignalCardProps) {
  const bar = riskBarClass[riskLevel];

  const row = (
    <>
      <span className={`w-1 shrink-0 self-stretch rounded-l-[3px] ${bar}`} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5 pl-2 pr-1">
        <p
          className={`truncate text-[13px] font-semibold leading-tight ${
            isSelected ? "text-white" : "text-[#0F172A]"
          }`}
        >
          {title}
        </p>
        {subtext ? (
          <p
            className={`truncate text-[11px] leading-tight ${
              isSelected ? "text-slate-200" : "text-[#64748B]"
            }`}
          >
            {subtext}
          </p>
        ) : null}
      </div>
      {investigationStatus || badge ? (
        <div className="flex shrink-0 items-center gap-1 pr-2">
          {investigationStatus === "researching" ? (
            <span
              className="h-2 w-2 shrink-0 rounded-full bg-sky-500 shadow-sm"
              title="Research in progress"
              aria-label="Research in progress"
            />
          ) : null}
          {investigationStatus === "proposal_ready" ? (
            <span
              className="shrink-0 text-[13px] font-semibold leading-none text-emerald-600"
              title="Proposal ready for Governance"
              aria-label="Proposal ready for Governance"
            >
              ✓
            </span>
          ) : null}
          {investigationStatus === "pending_governance" ? (
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isSelected ? "bg-amber-400/25 text-amber-100" : "text-amber-800"
              }`}
              title="Pending governance review"
              aria-label="Pending governance review"
            >
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${isSelected ? "bg-amber-300" : "bg-amber-500"}`}
                aria-hidden
              />
              Pending
            </span>
          ) : null}
          {badge ? (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isSelected
                  ? badge === "new"
                    ? "bg-white/20 text-white"
                    : "bg-white/15 text-white"
                  : badge === "new"
                    ? "bg-sky-100 text-sky-900"
                    : "bg-violet-100 text-violet-900"
              }`}
            >
              {badge === "new" ? "New" : "Gap"}
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (onSelect) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onSelect();
        }}
        className={`flex w-full min-h-[40px] items-stretch overflow-hidden rounded-md border text-left transition-colors ${
          isSelected
            ? "border-[#0F172A] bg-[#0F172A] shadow-sm"
            : "border-slate-200/90 bg-white hover:bg-slate-50"
        }`}
      >
        {row}
      </button>
    );
  }

  return (
    <div
      className={`flex min-h-[40px] items-stretch overflow-hidden rounded-md border border-slate-200/90 bg-white ${
        isSelected ? "border-[#0F172A] bg-[#0F172A]" : ""
      }`}
    >
      {row}
    </div>
  );
}
