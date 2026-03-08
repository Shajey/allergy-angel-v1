/**
 * Phase O1/O2 – Command Bar
 * Mission-mode selection. Stronger active state, header identity.
 */

import { Link, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/orchestrator/radar", label: "Radar" },
  { path: "/orchestrator/registry", label: "Registry" },
  { path: "/orchestrator/research", label: "Research" },
  { path: "/orchestrator/ingestion", label: "Ingestion" },
  { path: "/orchestrator/governance", label: "Governance", placeholder: true },
  { path: "/orchestrator/activity", label: "Activity" },
] as const;

export default function CommandBar() {
  const location = useLocation();

  return (
    <header className="flex items-center justify-between border-b border-[#E2E8F0] bg-white px-4 py-3">
      <Link
        to="/orchestrator/radar"
        className="flex flex-col gap-0.5"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-[#0F172A] hover:text-[#334155]">
          <span className="text-[#64748B]">AA</span>
          <span>Orchestrator</span>
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#94A3B8]">
          Governed Safety Intelligence
        </span>
      </Link>
      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            location.pathname === item.path ||
            location.pathname.startsWith(item.path + "/");
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              } ${item.placeholder ? "opacity-60" : ""}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
