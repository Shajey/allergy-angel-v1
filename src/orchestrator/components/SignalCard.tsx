/**
 * Phase O1/O2/O3/O6 – Signal Card
 * Compact summary for Signal Radar Panel. Click to select.
 * O6: Optional Investigate button (primary, sm) for Radar → Research flow.
 */

import { Link } from "react-router-dom";

interface SignalCardProps {
  title: string;
  signalType: string;
  subtitle?: string;
  confidence?: string;
  priority?: string;
  count?: number;
  statusColor?: "emerging" | "mostlySafe" | "investigate" | "insufficient";
  /** Click handler for selection (sets context, does not navigate) */
  onSelect?: () => void;
  /** Whether this card is currently selected */
  isSelected?: boolean;
  /** O6: URL for Investigate button (routes to Research with entity preloaded) */
  investigateTo?: string;
  /** URL for View Graph secondary action */
  graphTo?: string;
  /** URL for Check Registry secondary action */
  registryTo?: string;
}

const statusClasses: Record<string, string> = {
  emerging: "border-l-4 border-l-[#EF4444]",
  mostlySafe: "border-l-4 border-l-[#10B981]",
  investigate: "border-l-4 border-l-[#F59E0B]",
  insufficient: "border-l-4 border-l-[#94A3B8]",
};

export default function SignalCard({
  title,
  signalType,
  subtitle,
  confidence,
  priority,
  count,
  statusColor = "insufficient",
  onSelect,
  isSelected = false,
  investigateTo,
  graphTo,
  registryTo,
}: SignalCardProps) {
  const accentClass = statusClasses[statusColor] ?? statusClasses.insufficient;
  const baseClass = `rounded-lg border p-3 text-left shadow-sm ${accentClass} transition-colors cursor-pointer`;
  const interactiveClass = onSelect
    ? `hover:bg-[#F8FAFC] ${isSelected ? "ring-2 ring-[#0F172A] ring-offset-1 bg-[#F1F5F9]" : "bg-white border-[#E2E8F0]"}`
    : "bg-white border-[#E2E8F0]";

  const content = (
    <>
      <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">{signalType}</p>
      <p className="mt-0.5 text-sm font-medium text-[#0F172A]">{title}</p>
      {count != null && (
        <p className="mt-0.5 text-xs text-[#64748B]">{count} occurrence{count !== 1 ? "s" : ""}</p>
      )}
      <p className="mt-0.5 text-[11px] text-[#94A3B8] italic">Detected from safety checks.</p>
      {(confidence != null || priority != null) && (
        <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#64748B]">
          {confidence != null && <span>Confidence: {confidence}</span>}
          {priority != null && <span>Priority: {priority}</span>}
        </div>
      )}
      {(investigateTo || graphTo || registryTo) && (
        <div className="mt-2 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
          {investigateTo && (
            <Link
              to={investigateTo}
              className="orch-gradient-btn inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
            >
              Investigate
            </Link>
          )}
          {graphTo && (
            <Link
              to={graphTo}
              className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-transparent px-2 py-1 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              View Graph
            </Link>
          )}
          {registryTo && (
            <Link
              to={registryTo}
              className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-transparent px-2 py-1 text-xs font-medium text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
            >
              Check Registry
            </Link>
          )}
        </div>
      )}
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
        className={`block w-full text-left ${baseClass} ${interactiveClass}`}
      >
        {content}
      </button>
    );
  }

  return (
    <div className={`${baseClass} ${interactiveClass}`}>
      {content}
    </div>
  );
}
