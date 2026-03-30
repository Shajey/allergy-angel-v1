/**
 * Phase O6.9 — Right rail: optional tool shortcuts only (center owns draft / research flow).
 */

import { Link } from "react-router-dom";

export interface QuickActionsCardProps {
  shortcuts: Array<{ label: string; to: string }>;
}

export default function QuickActionsCard({ shortcuts }: QuickActionsCardProps) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-3">Shortcuts</p>
      <div className="flex flex-col gap-2">
        {shortcuts.map((s) => (
          <Link
            key={s.label + s.to}
            to={s.to}
            className="inline-flex w-full justify-center rounded-lg border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-medium text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
          >
            {s.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
