/**
 * Phase O1/O2/O3 – Activity Stream
 * Bottom strip. Items are selectable.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadActivityFeed } from "../lib/activityFeed";
import { loadOrchestratorSummary } from "../lib/orchestratorSummary";
import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import type { ActivityItem } from "../lib/activityFeed";

export default function ActivityStream() {
  const { selection, setSelection } = useOrchestratorSelection();
  const [items, setItems] = useState<ActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await loadOrchestratorSummary();
      if (cancelled) return;
      if (!result.ok) {
        if (!cancelled) setItems([]);
        return;
      }
      const summary = result.data;
      const feed = await loadActivityFeed({
        ingestionPending: summary.summaryCounts.ingestionPending,
        proposalsPending: summary.summaryCounts.proposalsPending,
        unknownCount: summary.summaryCounts.unknownEntities,
        emergingCount: summary.summaryCounts.emergingRisk,
      });
      if (!cancelled) setItems(feed.slice(0, 6));
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex items-center gap-4 border-t border-[#E2E8F0] bg-white px-4 py-2">
      <Link
        to="/orchestrator/activity"
        className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[#64748B] hover:text-[#0F172A]"
      >
        Activity
      </Link>
      <div className="flex min-w-0 flex-1 gap-4 overflow-x-auto">
        {items.map((e) => {
          const isSelected =
            selection?.kind === "activity" &&
            selection.title === e.title &&
            selection.activityId === e.id;
          return (
            <button
              key={e.id}
              type="button"
              onClick={() =>
                setSelection({
                  kind: "activity",
                  activityId: e.id,
                  title: e.title,
                  eventType: e.eventType,
                  detail: e.detail,
                  timestamp: e.timestamp,
                })
              }
              className={`shrink-0 rounded border px-2 py-1 text-xs transition-colors ${
                isSelected
                  ? "border-[#0F172A] bg-[#F1F5F9] text-[#0F172A] ring-1 ring-[#0F172A] ring-offset-1"
                  : "border-[#E2E8F0] bg-[#F8FAFC] text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A]"
              }`}
            >
              {e.title}
            </button>
          );
        })}
      </div>
    </div>
  );
}
