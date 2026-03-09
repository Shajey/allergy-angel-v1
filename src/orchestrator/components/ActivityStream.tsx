/**
 * Phase O1/O2/O3/O4.2/O4.3/O4.4/O5.1 – Activity Terminal
 * O4.4: Drawer between sidebar & context, 280px expanded, gap-6 px-6 py-2 rows, border-white/5.
 * Auto-scroll to newest, smooth height transition.
 */

import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown,
  ChevronUp,
  FlaskConical,
  Landmark,
  Zap,
  XCircle,
  Search,
  Inbox,
  type LucideIcon,
} from "lucide-react";
import { loadActivityFeed } from "../lib/activityFeed";
import { loadOrchestratorSummary } from "../lib/orchestratorSummary";
import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { useGraphTelemetry } from "../context/GraphTelemetryContext";
import { useActivityStore, type ActivityEvent } from "../lib/activityStore";
import type { ActivityItem } from "../lib/activityFeed";

/** O4.4: Iconography — 🧪 Research (Cyan), 🏛️ Governance (Amber), ⚡ Identity Verify (Blue), ⚠️ Error (Red) */
const LUCIDE_ICON_MAP: Record<string, { Icon: LucideIcon; color: string }> = {
  research_started: { Icon: FlaskConical, color: "#22D3EE" },
  research_completed: { Icon: FlaskConical, color: "#22D3EE" },
  research_failed: { Icon: XCircle, color: "#EF4444" },
  proposal_drafted: { Icon: Landmark, color: "#F59E0B" },
  proposal_exported: { Icon: Landmark, color: "#F59E0B" },
  registry_promotion: { Icon: Landmark, color: "#F59E0B" },
  api_sync: { Icon: Zap, color: "#3B82F6" },
  candidate_opened: { Icon: Zap, color: "#3B82F6" },
  graph_focus_changed: { Icon: Zap, color: "#3B82F6" },
  research: { Icon: FlaskConical, color: "#22D3EE" },
  ingestion: { Icon: Zap, color: "#3B82F6" },
  proposal: { Icon: Landmark, color: "#F59E0B" },
  signal: { Icon: Zap, color: "#3B82F6" },
  dismissed: { Icon: XCircle, color: "#EF4444" },
};

function getIconConfig(type: string): { Icon: LucideIcon; color: string } {
  const config = LUCIDE_ICON_MAP[type];
  return config ?? { Icon: Zap, color: "#94A3B8" };
}

interface LogRow {
  id: string;
  timestamp: string;
  type: string;
  message: string;
  event?: ActivityEvent;
  legacy?: ActivityItem;
}

function LogRowContent({
  row,
  isNewest,
  isSelected,
  onClick,
  asButton = true,
}: {
  row: LogRow;
  isNewest: boolean;
  isSelected: boolean;
  onClick: () => void;
  asButton?: boolean;
}) {
  const { Icon, color } = getIconConfig(row.type);
  const showPulse = row.type === "research_started" && isNewest;

  const className = `orch-activity-row w-full text-left hover:bg-[rgba(248,250,252,0.04)] ${
    isNewest ? "orch-activity-pulse" : ""
  } ${isSelected ? "bg-[rgba(248,250,252,0.06)]" : ""}`;

  const content = (
    <>
      <span className="orch-activity-timestamp text-slate-500">{row.timestamp}</span>
      <span
        className={`orch-activity-icon flex items-center justify-center ${showPulse ? "orch-activity-icon-pulse" : ""}`}
        style={{ color }}
      >
        <Icon className="w-3.5 h-3.5" aria-hidden />
      </span>
      <span className="orch-activity-message truncate text-white text-xs">{row.message}</span>
    </>
  );

  if (asButton) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

export default function ActivityStream() {
  const { selection, setSelection } = useOrchestratorSelection();
  const graphTelemetry = useGraphTelemetry();
  const activityStore = useActivityStore();
  const [legacyItems, setLegacyItems] = useState<ActivityItem[]>([]);
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const result = await loadOrchestratorSummary();
      if (cancelled) return;
      if (!result.ok) {
        if (!cancelled) setLegacyItems([]);
        return;
      }
      const summary = result.data;
      const feed = await loadActivityFeed({
        ingestionPending: summary.summaryCounts.ingestionPending,
        proposalsPending: summary.summaryCounts.proposalsPending,
        unknownCount: summary.summaryCounts.unknownEntities,
        emergingCount: summary.summaryCounts.emergingRisk,
      });
      if (!cancelled) setLegacyItems(feed.slice(0, 50));
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const showGraphAudit = graphTelemetry && graphTelemetry.entries.length > 0;
  const sessionEvents = activityStore?.events ?? [];
  const hasSessionEvents = sessionEvents.length > 0;

  const rows: LogRow[] = hasSessionEvents
    ? sessionEvents
        .slice()
        .reverse()
        .map((e) => ({
          id: e.id,
          timestamp: e.timestamp,
          type: e.type,
          message: e.message,
          event: e,
        }))
    : legacyItems.map((e) => ({
        id: e.id,
        timestamp: e.timestamp ?? "--:--:--",
        type: e.eventType,
        message: e.title,
        legacy: e,
      }));

  const newestId = rows.length > 0 ? rows[rows.length - 1]?.id : null;
  const newestRow = rows.length > 0 ? rows[rows.length - 1] : null;

  useEffect(() => {
    if (!expanded || !scrollRef.current) return;
    const el = scrollRef.current;
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [rows, expanded]);

  const handleRowClick = (row: LogRow) => {
    if (row.event) {
      setSelection({
        kind: "activity",
        activityId: row.id,
        title: row.message,
        eventType: row.type,
        detail: JSON.stringify(row.event.metadata ?? {}),
        timestamp: row.timestamp,
      });
    } else if (row.legacy) {
      setSelection({
        kind: "activity",
        activityId: row.id,
        title: row.message,
        eventType: row.type,
        detail: row.legacy.detail,
        timestamp: row.timestamp,
      });
    }
  };

  return (
    <div
      className={`orch-activity-panel overflow-hidden flex-col ${
        expanded ? "orch-activity-expanded" : "orch-activity-collapsed"
      }`}
    >
      {/* Collapsed: single most recent row as toggle */}
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full h-full flex items-center px-6 cursor-ns-resize hover:bg-[rgba(248,250,252,0.04)]"
          aria-label="Expand activity console"
        >
          {newestRow ? (
            <LogRowContent
              row={newestRow}
              isNewest
              isSelected={selection?.kind === "activity" && selection.activityId === newestRow.id}
              onClick={() => setExpanded(true)}
              asButton={false}
            />
          ) : (
            <div className="orch-activity-row w-full">
              <span className="orch-activity-timestamp text-slate-500">--:--:--</span>
              <span className="orch-activity-icon flex items-center justify-center" style={{ color: "#94A3B8" }}>
                <Zap className="w-3.5 h-3.5" aria-hidden />
              </span>
              <span className="orch-activity-message truncate text-slate-500 text-xs">No activity yet</span>
            </div>
          )}
          <span className="text-[10px] font-semibold uppercase text-[#94A3B8] ml-auto">ACTIVITY ^</span>
        </button>
      )}

      {/* Expanded: handle + scrollable list */}
      {expanded && (
        <>
          <div
            className="orch-activity-handle"
            onClick={() => setExpanded(false)}
            role="button"
            tabIndex={0}
            aria-expanded={true}
            aria-label="Collapse activity console"
          >
            <Link
              to="/orchestrator/activity"
              className="shrink-0 text-[10px] font-semibold uppercase tracking-wide hover:text-[#F8FAFC] mr-2"
              onClick={(ev) => ev.stopPropagation()}
            >
              ACTIVITY
            </Link>
            <ChevronDown className="w-3.5 h-3.5" aria-hidden />
          </div>

          {showGraphAudit && (
            <div className="flex items-center gap-2 shrink-0 px-3 py-1.5 border-b border-[rgba(248,250,252,0.1)]">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                Audit
              </span>
              <div className="flex gap-2 overflow-x-auto max-w-[240px]">
                {graphTelemetry!.entries.slice(0, 3).map((e) => (
                  <span key={e.id} className="shrink-0 text-[10px] text-[#94A3B8]">
                    {e.message}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col"
          >
            {rows.length === 0 ? (
              <div className="orch-activity-row">
                <span className="orch-activity-timestamp text-slate-500">--:--:--</span>
                <span className="orch-activity-icon flex items-center justify-center" style={{ color: "#94A3B8" }}>
                  <Zap className="w-3.5 h-3.5" aria-hidden />
                </span>
                <span className="orch-activity-message truncate text-slate-500 text-xs">No activity yet</span>
              </div>
            ) : (
              rows.map((row) => {
                const isNewest = row.id === newestId;
                const isSelected =
                  selection?.kind === "activity" && selection.activityId === row.id;
                return (
                  <LogRowContent
                    key={row.id}
                    row={row}
                    isNewest={isNewest}
                    isSelected={isSelected}
                    onClick={() => handleRowClick(row)}
                  />
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
