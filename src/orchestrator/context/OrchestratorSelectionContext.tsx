/**
 * Phase O3 – Orchestrator Selection Context
 * Tracks active selection for Context Panel updates.
 */

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type OrchestratorSelection =
  | {
      kind: "signal";
      id: string;
      title: string;
      signalType?: string;
      entityA?: string;
      entityB?: string;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "unknown-entity";
      entity: string;
      entityType?: string;
      occurrenceCount?: number;
      suggestedAction?: string;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "interaction-gap";
      entityA: string;
      entityB: string;
      combinationType?: string;
      occurrenceCount?: number;
      highRiskCount?: number;
      safeCount?: number;
      signalPattern?: string;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "ingestion-candidate";
      candidateId: string;
      name?: string;
      canonicalId?: string;
      sourceDataset?: string;
      aliasCount?: number;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "registry-entity";
      canonicalId: string;
      registryType?: string;
      aliasCount?: number;
      entityClass?: string;
      payload?: Record<string, unknown>;
    }
  | {
      kind: "activity";
      activityId?: string;
      title: string;
      eventType?: string;
      detail?: string;
      timestamp?: string;
      payload?: Record<string, unknown>;
    };

interface OrchestratorSelectionContextValue {
  selection: OrchestratorSelection | null;
  setSelection: (s: OrchestratorSelection | null) => void;
  clearSelection: () => void;
}

const OrchestratorSelectionContext = createContext<OrchestratorSelectionContextValue | null>(null);

export function OrchestratorSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<OrchestratorSelection | null>(null);
  const setSelection = useCallback((s: OrchestratorSelection | null) => {
    setSelectionState(s);
  }, []);
  const clearSelection = useCallback(() => setSelectionState(null), []);

  return (
    <OrchestratorSelectionContext.Provider
      value={{ selection, setSelection, clearSelection }}
    >
      {children}
    </OrchestratorSelectionContext.Provider>
  );
}

export function useOrchestratorSelection() {
  const ctx = useContext(OrchestratorSelectionContext);
  if (!ctx) {
    throw new Error("useOrchestratorSelection must be used within OrchestratorSelectionProvider");
  }
  return ctx;
}

/** Use when component may render outside Orchestrator (e.g. admin pages). Returns null when not in provider. */
export function useOptionalOrchestratorSelection(): OrchestratorSelectionContextValue | null {
  return useContext(OrchestratorSelectionContext);
}
