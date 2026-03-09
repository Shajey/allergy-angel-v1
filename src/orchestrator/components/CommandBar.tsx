/**
 * Phase O1/O2/O3 – Command Bar
 * Mission-mode selection. Stronger active state, header identity.
 * O3: Clinical Modernism logo with shield + radar node.
 */

import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";

const NAV_ITEMS = [
  { path: "/orchestrator/radar", label: "Radar" },
  { path: "/orchestrator/registry", label: "Registry" },
  { path: "/orchestrator/research", label: "Research" },
  { path: "/orchestrator/graph", label: "Graph" },
  { path: "/orchestrator/ingestion", label: "Ingestion" },
  { path: "/orchestrator/governance", label: "Governance", placeholder: true },
  { path: "/orchestrator/activity", label: "Activity" },
] as const;

export default function CommandBar() {
  const location = useLocation();

  return (
    <header className="orch-card mx-4 mt-4 mb-0 flex items-center justify-between px-4 py-3 [&_a]:pointer-events-auto">
      <Logo />
      <nav className="flex items-center gap-1 pl-4">
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
                  ? "orch-nav-active shadow-sm"
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
