/**
 * Phase O2 – Activity Feed Data
 * Layered fallback: real data → derived mock → static placeholder.
 */

export interface ActivityItem {
  id: string;
  eventType: "research" | "ingestion" | "proposal" | "signal" | "dismissed";
  title: string;
  detail?: string;
  timestamp?: string;
  relativeTime?: string;
}

export async function loadActivityFeed(summary: {
  ingestionPending?: number;
  proposalsPending?: number;
  unknownCount?: number;
  emergingCount?: number;
} | null): Promise<ActivityItem[]> {
  const now = new Date();
  const formatTime = (d: Date) =>
    `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

  // Layer 2: Deterministic mock from system state
  const items: ActivityItem[] = [];
  let id = 1;

  if (summary) {
    if ((summary.emergingCount ?? 0) > 0) {
      items.push({
        id: `act-${id++}`,
        eventType: "signal",
        title: "Signal detected",
        detail: `${summary.emergingCount} emerging risk combination${(summary.emergingCount ?? 0) !== 1 ? "s" : ""}`,
        timestamp: formatTime(now),
        relativeTime: "Recent",
      });
    }
    if ((summary.ingestionPending ?? 0) > 0) {
      items.push({
        id: `act-${id++}`,
        eventType: "ingestion",
        title: "Ingestion candidate staged",
        detail: `${summary.ingestionPending} pending in queue`,
        timestamp: formatTime(new Date(now.getTime() - 3 * 60000)),
        relativeTime: "Recent",
      });
    }
    if ((summary.proposalsPending ?? 0) > 0) {
      items.push({
        id: `act-${id++}`,
        eventType: "proposal",
        title: "Alias proposal pending",
        detail: `${summary.proposalsPending} draft proposal${(summary.proposalsPending ?? 0) !== 1 ? "s" : ""}`,
        timestamp: formatTime(new Date(now.getTime() - 5 * 60000)),
        relativeTime: "Recent",
      });
    }
    if ((summary.unknownCount ?? 0) > 0) {
      items.push({
        id: `act-${id++}`,
        eventType: "signal",
        title: "Unknown entity observed",
        detail: `${summary.unknownCount} in radar`,
        timestamp: formatTime(new Date(now.getTime() - 8 * 60000)),
        relativeTime: "Recent",
      });
    }
  }

  // Layer 3: Static placeholders if nothing derived
  if (items.length === 0) {
    items.push(
      {
        id: "act-1",
        eventType: "research",
        title: "Research draft created",
        detail: "Requires human review",
        timestamp: formatTime(now),
        relativeTime: "Recent",
      },
      {
        id: "act-2",
        eventType: "ingestion",
        title: "Ingestion candidate staged",
        detail: "RxNorm",
        timestamp: formatTime(new Date(now.getTime() - 12 * 60000)),
        relativeTime: "Recent",
      },
      {
        id: "act-3",
        eventType: "proposal",
        title: "Alias proposal exported",
        detail: "Draft only",
        timestamp: formatTime(new Date(now.getTime() - 24 * 60000)),
        relativeTime: "Recent",
      },
      {
        id: "act-4",
        eventType: "signal",
        title: "Signal detected",
        detail: "Governance queue active",
        timestamp: formatTime(new Date(now.getTime() - 36 * 60000)),
        relativeTime: "Recent",
      }
    );
  }

  return items;
}
