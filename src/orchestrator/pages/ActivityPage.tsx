/**
 * Phase O1/O2 – Activity Page
 * Structured recent-activity feed. Operational telemetry.
 */

import { useEffect, useState } from "react";
import ActivityFeedList from "../components/ActivityFeedList";
import { loadActivityFeed } from "../lib/activityFeed";
import { loadOrchestratorSummary } from "../lib/orchestratorSummary";
import type { ActivityItem } from "../lib/activityFeed";

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const summary = await loadOrchestratorSummary();
      if (cancelled) return;
      const feed = await loadActivityFeed({
        ingestionPending: summary.summaryCounts.ingestionPending,
        proposalsPending: summary.summaryCounts.proposalsPending,
        unknownCount: summary.summaryCounts.unknownEntities,
        emergingCount: summary.summaryCounts.emergingRisk,
      });
      if (!cancelled) {
        setItems(feed);
      }
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-2xl">
      <h1 className="text-[22px] font-semibold text-[#0F172A]">Activity</h1>
      <p className="mt-1 text-sm text-[#64748B] leading-relaxed">
        Audit trail of research, governance, and knowledge updates. Track session events, promotion activity, and API sync for operational visibility.
      </p>
      <div className="mt-6">
        {loading ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 text-center text-sm text-[#64748B]">
            Loading…
          </div>
        ) : (
          <ActivityFeedList items={items} />
        )}
      </div>
    </div>
  );
}
