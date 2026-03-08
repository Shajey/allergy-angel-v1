/**
 * Phase O2/O3 – Activity Feed List
 * Structured rows. Click to select.
 */

import { Link } from "react-router-dom";
import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import type { ActivityItem } from "../lib/activityFeed";

const EVENT_ICONS: Record<ActivityItem["eventType"], string> = {
  research: "📋",
  ingestion: "📥",
  proposal: "📤",
  signal: "📡",
  dismissed: "⊘",
};

const EVENT_ROUTES: Partial<Record<ActivityItem["eventType"], string>> = {
  research: "/orchestrator/research",
  ingestion: "/orchestrator/ingestion",
  proposal: "/orchestrator/registry",
  signal: "/orchestrator/radar",
};

interface ActivityFeedListProps {
  items: ActivityItem[];
}

export default function ActivityFeedList({ items }: ActivityFeedListProps) {
  const { selection, setSelection } = useOrchestratorSelection();

  return (
    <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white overflow-hidden">
      {items.map((item) => {
        const route = EVENT_ROUTES[item.eventType];
        const isSelected =
          selection?.kind === "activity" &&
          selection.activityId === item.id &&
          selection.title === item.title;
        const content = (
          <>
            <span className="shrink-0 text-base" aria-hidden>
              {EVENT_ICONS[item.eventType]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[#0F172A]">{item.title}</p>
              {item.detail && (
                <p className="text-xs text-[#64748B] mt-0.5">{item.detail}</p>
              )}
            </div>
            {item.timestamp && (
              <span className="shrink-0 text-xs text-[#94A3B8] font-mono">
                {item.timestamp}
              </span>
            )}
          </>
        );
        const rowClass = `flex items-start gap-3 px-4 py-3 transition-colors ${
          isSelected
            ? "bg-[#F1F5F9] ring-1 ring-inset ring-[#0F172A]"
            : "hover:bg-[#F8FAFC]"
        }`;
        return (
          <div key={item.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() =>
                setSelection({
                  kind: "activity",
                  activityId: item.id,
                  title: item.title,
                  eventType: item.eventType,
                  detail: item.detail,
                  timestamp: item.timestamp,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelection({
                    kind: "activity",
                    activityId: item.id,
                    title: item.title,
                    eventType: item.eventType,
                    detail: item.detail,
                    timestamp: item.timestamp,
                  });
                }
              }}
              className={`block w-full text-left cursor-pointer ${rowClass}`}
            >
              {content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
