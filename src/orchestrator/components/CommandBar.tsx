/**
 * Phase O1/O2/O3 / O6.10 – Command Bar
 * Primary mission nav. Investigation / Registry remain routable via bookmarks; not shown here.
 */

import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Logo from "./Logo";
import { fetchGovernancePendingProposals } from "../lib/fetchOrchestratorData";
import { useGovernanceStore } from "../lib/governanceStore";

const PRIMARY_NAV = [
  { path: "/orchestrator/radar", label: "Signals" },
  { path: "/orchestrator/graph", label: "Graph" },
  { path: "/orchestrator/ingestion", label: "Ingestion" },
  { path: "/orchestrator/governance", label: "Governance", placeholder: false },
  { path: "/orchestrator/activity", label: "Activity" },
] as const;

function GovernancePendingBadge() {
  const { proposals } = useGovernanceStore();
  const clientPending = proposals.filter((p) => p.status === "pending").length;
  const [apiPending, setApiPending] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void fetchGovernancePendingProposals("pending").then((r) => {
      if (!cancelled && r.ok) setApiPending((r.data.proposals ?? []).length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const total = clientPending + apiPending;
  if (total <= 0) return null;
  return (
    <span
      className="ml-1 inline-flex min-w-[1.125rem] justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
      aria-label={`${total} pending governance items`}
    >
      {total > 99 ? "99+" : total}
    </span>
  );
}

export default function CommandBar() {
  const location = useLocation();

  return (
    <header className="orch-card mx-4 mt-4 mb-0 flex flex-wrap items-center justify-between gap-y-2 px-4 py-3 [&_a]:pointer-events-auto">
      <Logo />
      <div className="flex flex-wrap items-center justify-end gap-x-1 gap-y-1 pl-4">
        <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
          {PRIMARY_NAV.map((item) => {
            const isActive =
              location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`inline-flex items-center px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "orch-nav-active shadow-sm"
                    : "text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                } ${item.placeholder ? "opacity-60" : ""}`}
              >
                {item.label}
                {item.path === "/orchestrator/governance" ? <GovernancePendingBadge /> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
