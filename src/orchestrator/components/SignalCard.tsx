/**
 * Phase O1/O2/O3 – Signal Card
 * Compact summary for Signal Radar Panel. Click to select.
 */

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
}

const statusClasses: Record<string, string> = {
  emerging: "border-l-[#EF4444]",
  mostlySafe: "border-l-[#10B981]",
  investigate: "border-l-[#F59E0B]",
  insufficient: "border-l-[#94A3B8]",
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
}: SignalCardProps) {
  const accentClass = statusClasses[statusColor] ?? statusClasses.insufficient;
  const baseClass = `rounded-lg border p-3 text-left shadow-sm border-l-4 ${accentClass} transition-colors cursor-pointer`;
  const interactiveClass = onSelect
    ? `hover:bg-[#F8FAFC] ${isSelected ? "ring-2 ring-[#0F172A] ring-offset-1 bg-[#F1F5F9]" : "bg-white border-[#E2E8F0]"}`
    : "bg-white border-[#E2E8F0]";

  const content = (
    <>
      <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">{signalType}</p>
      <p className="mt-0.5 text-sm font-medium text-[#0F172A]">{title}</p>
      {subtitle && <p className="mt-0.5 text-xs text-[#64748B]">{subtitle}</p>}
      <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#64748B]">
        {confidence != null && <span>Confidence: {confidence}</span>}
        {priority != null && <span>Priority: {priority}</span>}
        {count != null && <span>{count} occurrence{count !== 1 ? "s" : ""}</span>}
      </div>
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
