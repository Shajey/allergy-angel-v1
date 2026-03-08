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

export default function QuickActionsCard({ actions }: QuickActionsCardProps) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-3">
      <p className="text-xs font-medium text-[#64748B] mb-2">Quick actions</p>
      <div className="flex flex-wrap gap-2">
        {actions.map((a, i) =>
          a.to ? (
            <Link
              key={i}
              to={a.to}
              className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
            >
              {a.label}
            </Link>
          ) : (
            <button
              key={i}
              type="button"
              onClick={a.onClick}
              className="inline-flex items-center rounded-md border border-[#E2E8F0] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0F172A] hover:bg-[#F1F5F9] transition-colors"
            >
              {a.label}
            </button>
          )
        )}
      </div>
    </div>
  );
}
