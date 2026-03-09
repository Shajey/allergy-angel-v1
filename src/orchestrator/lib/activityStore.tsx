/**
 * Phase O4.2 – Activity Store
 * Session-scoped event stream for Orchestrator Activity Timeline.
 * UI/state wiring only — no backend persistence.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type ActivityEventType =
  | "research_started"
  | "research_completed"
  | "research_failed"
  | "proposal_drafted"
  | "proposal_exported"
  | "registry_promotion"
  | "api_sync"
  | "candidate_opened"
  | "graph_focus_changed";

export type ActivityEventStatus = "success" | "info" | "warning" | "error";

export type ActivityEventSource = "ui" | "api" | "governance" | "system";

/** O4.3: Iconography map — medical-engineering icon set with status colors */
export const ACTIVITY_ICONOGRAPHY: Record<
  ActivityEventType,
  { icon: string; color: string; category: "research" | "governance" | "api" | "alert" | "investigation" }
> = {
  research_started: { icon: "🧪", color: "#22D3EE", category: "research" },
  research_completed: { icon: "🧪", color: "#22D3EE", category: "research" },
  research_failed: { icon: "❌", color: "#b42318", category: "alert" },
  proposal_drafted: { icon: "🏛️", color: "#F59E0B", category: "governance" },
  proposal_exported: { icon: "🏛️", color: "#F59E0B", category: "governance" },
  registry_promotion: { icon: "🏛️", color: "#F59E0B", category: "governance" },
  api_sync: { icon: "⚡", color: "#3B82F6", category: "api" },
  candidate_opened: { icon: "🔎", color: "#94A3B8", category: "investigation" },
  graph_focus_changed: { icon: "🔎", color: "#94A3B8", category: "investigation" },
};

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  message: string;
  timestamp: string;
  status: ActivityEventStatus;
  source: ActivityEventSource;
  metadata?: Record<string, unknown>;
}

interface ActivityStoreValue {
  events: ActivityEvent[];
  pushEvent: (event: Omit<ActivityEvent, "id" | "timestamp">) => void;
  clearEvents: () => void;
}

const ActivityStoreContext = createContext<ActivityStoreValue | null>(null);

function generateId(): string {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatTimestamp(): string {
  const d = new Date();
  return d.toISOString().slice(11, 19); // HH:mm:ss
}

export function ActivityStoreProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<ActivityEvent[]>([]);

  const pushEvent = useCallback((event: Omit<ActivityEvent, "id" | "timestamp">) => {
    const full: ActivityEvent = {
      ...event,
      id: generateId(),
      timestamp: formatTimestamp(),
    };
    setEvents((prev) => [full, ...prev].slice(0, 50));
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);

  return (
    <ActivityStoreContext.Provider value={{ events, pushEvent, clearEvents }}>
      {children}
    </ActivityStoreContext.Provider>
  );
}

export function useActivityStore(): ActivityStoreValue | null {
  return useContext(ActivityStoreContext);
}
