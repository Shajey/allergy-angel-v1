/**
 * Phase O5.1 – Graph Telemetry Context
 * Audit log for demo graph navigation (e.g. "🏛️ Audit: Navigated to Warfarin clinical cluster").
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface GraphAuditEntry {
  id: string;
  message: string;
  timestamp: number;
}

interface GraphTelemetryContextValue {
  entries: GraphAuditEntry[];
  pushAudit: (message: string) => void;
  clearAudit: () => void;
}

const GraphTelemetryContext = createContext<GraphTelemetryContextValue | null>(null);

export function GraphTelemetryProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<GraphAuditEntry[]>([]);

  const pushAudit = useCallback((message: string) => {
    setEntries((prev) => {
      const next = [
        { id: `audit-${Date.now()}`, message, timestamp: Date.now() },
        ...prev.slice(0, 19),
      ];
      return next;
    });
  }, []);

  const clearAudit = useCallback(() => setEntries([]), []);

  return (
    <GraphTelemetryContext.Provider value={{ entries, pushAudit, clearAudit }}>
      {children}
    </GraphTelemetryContext.Provider>
  );
}

export function useGraphTelemetry(): GraphTelemetryContextValue | null {
  return useContext(GraphTelemetryContext);
}
