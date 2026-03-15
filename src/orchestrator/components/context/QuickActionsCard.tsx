/**
 * Phase O3 – Quick Actions Card
 * Action buttons for Context Panel.
 */

import { Link } from "react-router-dom";

export interface QuickAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

interface QuickActionsCardProps {
  actions: QuickAction[];
}

function getButtonClass(label: string): string {
  if (/investigate in research/i.test(label)) {
    return "orch-gradient-btn border-0";
  }
  if (/draft proposal/i.test(label)) {
    return "border border-[#F59E0B] bg-amber-50 text-[#B45309] hover:bg-amber-100";
  }
  return "border border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F1F5F9]";
}

export default function QuickActionsCard({ actions }: QuickActionsCardProps) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">Next Step</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a, i) => {
          const btnClass = getButtonClass(a.label);
          return a.to ? (
            <Link
              key={i}
              to={a.to}
              className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${btnClass}`}
            >
              {a.label}
            </Link>
          ) : (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className={`inline-flex items-center rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${btnClass}`}
            >
              {a.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
