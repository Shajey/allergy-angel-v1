/**
 * Phase O6.9 / O6.9c — Persistent investigation lifecycle (sessionStorage) + proposal bridge.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OrchestratorSelection } from "./OrchestratorSelectionContext";
import { createProposal } from "../lib/createProposal";
import { stableSelectionKey } from "../lib/investigationKey";
import { mockResearchResult } from "../lib/investigationProposalBridge";
import {
  defaultInvestigationEntry,
  type InvestigationEntry,
} from "../lib/investigationTypes";
import { useActivityStore } from "../lib/activityStore";
import { governingEntityLabel, useGovernanceStore } from "../lib/governanceStore";

const STORAGE_KEY = "orch_investigation_v2";

type StoreMap = Record<string, InvestigationEntry>;

function migrateEntry(key: string, raw: unknown): InvestigationEntry {
  const base = defaultInvestigationEntry(key);
  if (!raw || typeof raw !== "object") return base;
  const e = raw as Record<string, unknown>;
  let status = e.status;
  if (status === "proposed") status = "proposal_ready";
  if (
    status !== "not_started" &&
    status !== "researching" &&
    status !== "completed" &&
    status !== "proposal_ready" &&
    status !== "pending_governance" &&
    status !== "governance_approved" &&
    status !== "governance_rejected"
  ) {
    status = "not_started";
  }
  return {
    ...base,
    ...e,
    signalId: typeof e.signalId === "string" ? e.signalId : key,
    status: status as InvestigationEntry["status"],
    manualSelection: typeof e.manualSelection === "string" || e.manualSelection === null ? e.manualSelection : null,
    result: (e.result ?? null) as InvestigationEntry["result"],
    proposalPreview: (e.proposalPreview ?? null) as InvestigationEntry["proposalPreview"],
    proposalPayload: (e.proposalPayload ?? null) as InvestigationEntry["proposalPayload"],
    lastUpdatedAt: typeof e.lastUpdatedAt === "number" ? e.lastUpdatedAt : base.lastUpdatedAt,
  };
}

function loadMap(): StoreMap {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const legacy = sessionStorage.getItem("orch_investigation_v1");
      if (legacy) {
        const old = JSON.parse(legacy) as Record<string, unknown>;
        const next: StoreMap = {};
        for (const k of Object.keys(old)) {
          next[k] = migrateEntry(k, old[k]);
        }
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      }
      return {};
    }
    const parsed = JSON.parse(raw) as StoreMap;
    const next: StoreMap = {};
    for (const k of Object.keys(parsed)) {
      next[k] = migrateEntry(k, parsed[k]);
    }
    return next;
  } catch {
    return {};
  }
}

function saveMap(map: StoreMap): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

function mergeEntry(key: string, prev: InvestigationEntry | undefined): InvestigationEntry {
  return { ...defaultInvestigationEntry(key), ...prev, signalId: key };
}

export type QueueInvestigationBadge = "researching" | "proposal_ready" | "pending_governance";

interface InvestigationStoreValue {
  getEntry: (signalId: string) => InvestigationEntry;
  /** Signals awaiting governance with a stored proposal packet (for queue rehydration). */
  listPendingGovernanceWithProposal: () => Array<{ signalId: string; entry: InvestigationEntry }>;
  setManualSelection: (signalId: string, value: string | null) => void;
  startResearch: (selection: OrchestratorSelection) => void;
  generateProposal: (selection: OrchestratorSelection) => void;
  submitForGovernance: (selection: OrchestratorSelection) => void;
  /** O7 — terminal handoff from Governance approve / reject. */
  resolveFromGovernance: (signalId: string, outcome: "approved" | "rejected") => void;
  rerunResearch: (signalId: string) => void;
  resetInvestigation: (signalId: string) => void;
  queueBadgeForKey: (signalId: string) => QueueInvestigationBadge | undefined;
}

const InvestigationStoreContext = createContext<InvestigationStoreValue | null>(null);

const RESEARCH_MS = 2600;

function useInvestigationStoreInner(): InvestigationStoreValue {
  const [map, setMap] = useState<StoreMap>(() => loadMap());
  const activity = useActivityStore();
  const { add: addGovernanceProposal } = useGovernanceStore();

  const pushActivity = useCallback(
    (
      type: "research_started" | "research_completed" | "proposal_drafted" | "governance_submitted",
      message: string,
      metadata?: Record<string, unknown>
    ) => {
      activity?.pushEvent({
        type,
        message,
        status: "success",
        source: "ui",
        metadata,
      });
    },
    [activity]
  );

  const getEntry = useCallback(
    (signalId: string) => mergeEntry(signalId, map[signalId]),
    [map]
  );

  const listPendingGovernanceWithProposal = useCallback((): Array<{
    signalId: string;
    entry: InvestigationEntry;
  }> => {
    const out: Array<{ signalId: string; entry: InvestigationEntry }> = [];
    for (const signalId of Object.keys(map)) {
      const e = mergeEntry(signalId, map[signalId]);
      if (e.status !== "pending_governance") continue;
      if (!e.proposalPreview || !e.proposalPayload) continue;
      out.push({ signalId, entry: e });
    }
    return out;
  }, [map]);

  const touch = useCallback((entry: InvestigationEntry): InvestigationEntry => {
    return { ...entry, lastUpdatedAt: Date.now() };
  }, []);

  const setManualSelection = useCallback(
    (signalId: string, value: string | null) => {
      setMap((prev) => {
        const cur = mergeEntry(signalId, prev[signalId]);
        if (
          cur.status === "pending_governance" ||
          cur.status === "governance_approved" ||
          cur.status === "governance_rejected"
        ) {
          return prev;
        }
        const next: StoreMap = {
          ...prev,
          [signalId]: touch({ ...cur, manualSelection: value }),
        };
        saveMap(next);
        return next;
      });
    },
    [touch]
  );

  const resetInvestigation = useCallback((signalId: string) => {
    setMap((prev) => {
      const next = { ...prev };
      delete next[signalId];
      saveMap(next);
      return next;
    });
  }, []);

  const rerunResearch = useCallback(
    (signalId: string) => {
      setMap((prev) => {
        const cur = mergeEntry(signalId, prev[signalId]);
        if (
          cur.status === "pending_governance" ||
          cur.status === "governance_approved" ||
          cur.status === "governance_rejected"
        ) {
          return prev;
        }
        const next: StoreMap = {
          ...prev,
          [signalId]: touch({
            ...cur,
            status: "not_started",
            result: null,
            proposalPreview: null,
            proposalPayload: null,
          }),
        };
        saveMap(next);
        return next;
      });
    },
    [touch]
  );

  const startResearch = useCallback(
    (selection: OrchestratorSelection) => {
      const key = stableSelectionKey(selection);
      setMap((prev) => {
        const cur = mergeEntry(key, prev[key]);
        if (
          cur.status === "researching" ||
          cur.status === "pending_governance" ||
          cur.status === "governance_approved" ||
          cur.status === "governance_rejected"
        ) {
          return prev;
        }
        const next: StoreMap = {
          ...prev,
          [key]: touch({
            ...cur,
            status: "researching",
            result: null,
            proposalPreview: null,
            proposalPayload: null,
          }),
        };
        saveMap(next);
        return next;
      });
      pushActivity("research_started", `Research started for signal ${key}`, { signalId: key });

      window.setTimeout(() => {
        setMap((prev) => {
          const cur = mergeEntry(key, prev[key]);
          const manual = cur.manualSelection ?? "";
          const result = mockResearchResult(selection, manual);
          const next: StoreMap = {
            ...prev,
            [key]: touch({
              ...cur,
              status: "completed",
              result,
              proposalPreview: null,
              proposalPayload: null,
            }),
          };
          saveMap(next);
          return next;
        });
        pushActivity("research_completed", `Research completed for signal ${key}`, { signalId: key });
      }, RESEARCH_MS);
    },
    [pushActivity, touch]
  );

  const generateProposal = useCallback(
    (selection: OrchestratorSelection) => {
      const key = stableSelectionKey(selection);
      setMap((prev) => {
        const cur = mergeEntry(key, prev[key]);
        if (
          cur.status === "pending_governance" ||
          cur.status === "governance_approved" ||
          cur.status === "governance_rejected"
        ) {
          return prev;
        }
        if (cur.status !== "completed" || !cur.result) return prev;
        const manual = cur.manualSelection ?? "";
        const payload = createProposal({
          signalId: key,
          research: cur.result,
          classification: manual,
          selection,
        });
        const next: StoreMap = {
          ...prev,
          [key]: touch({
            ...cur,
            status: "proposal_ready",
            proposalPreview: payload.preview,
            proposalPayload: payload,
          }),
        };
        saveMap(next);
        queueMicrotask(() =>
          pushActivity("proposal_drafted", `Proposal generated for signal ${key} (pending governance)`, {
            signalId: key,
          })
        );
        return next;
      });
    },
    [pushActivity, touch]
  );

  const submitForGovernance = useCallback(
    (selection: OrchestratorSelection) => {
      const key = stableSelectionKey(selection);
      const cur = getEntry(key);
      if (cur.status === "governance_approved" || cur.status === "governance_rejected") return;
      if (cur.status !== "proposal_ready" || !cur.proposalPreview || !cur.proposalPayload) return;
      addGovernanceProposal({
        id: key,
        signalId: key,
        entity: governingEntityLabel(selection),
        proposal: cur.proposalPayload,
        proposalType: `${selection.kind}:${cur.manualSelection ?? ""}`,
        before: cur.proposalPreview.before,
        after: cur.proposalPreview.after,
        confidence: cur.result?.classificationConfidence ?? 0,
        status: "pending",
        createdAt: Date.now(),
      });
      setMap((prev) => {
        const nextCur = mergeEntry(key, prev[key]);
        if (nextCur.status !== "proposal_ready" || !nextCur.proposalPreview || !nextCur.proposalPayload) {
          return prev;
        }
        const next: StoreMap = {
          ...prev,
          [key]: touch({
            ...nextCur,
            status: "pending_governance",
          }),
        };
        saveMap(next);
        queueMicrotask(() =>
          pushActivity(
            "governance_submitted",
            `Submitted for Governance: signal ${key} (awaiting review)`,
            { signalId: key }
          )
        );
        return next;
      });
    },
    [getEntry, addGovernanceProposal, pushActivity, touch]
  );

  const resolveFromGovernance = useCallback(
    (signalId: string, outcome: "approved" | "rejected") => {
      setMap((prev) => {
        const cur = mergeEntry(signalId, prev[signalId]);
        if (cur.status !== "pending_governance") return prev;
        const nextStatus = outcome === "approved" ? "governance_approved" : "governance_rejected";
        const next: StoreMap = {
          ...prev,
          [signalId]: touch({ ...cur, status: nextStatus }),
        };
        saveMap(next);
        return next;
      });
    },
    [touch]
  );

  const queueBadgeForKey = useCallback(
    (signalId: string): QueueInvestigationBadge | undefined => {
      const e = mergeEntry(signalId, map[signalId]);
      if (e.status === "researching") return "researching";
      if (e.status === "pending_governance") return "pending_governance";
      if (e.status === "proposal_ready") return "proposal_ready";
      return undefined;
    },
    [map]
  );

  return useMemo<InvestigationStoreValue>(
    () => ({
      getEntry,
      listPendingGovernanceWithProposal,
      setManualSelection,
      startResearch,
      generateProposal,
      submitForGovernance,
      resolveFromGovernance,
      rerunResearch,
      resetInvestigation,
      queueBadgeForKey,
    }),
    [
      getEntry,
      listPendingGovernanceWithProposal,
      setManualSelection,
      startResearch,
      generateProposal,
      submitForGovernance,
      resolveFromGovernance,
      rerunResearch,
      resetInvestigation,
      queueBadgeForKey,
    ]
  );
}

export function InvestigationStoreProvider({ children }: { children: ReactNode }) {
  const value = useInvestigationStoreInner();
  return (
    <InvestigationStoreContext.Provider value={value}>{children}</InvestigationStoreContext.Provider>
  );
}

export function useInvestigationStore(): InvestigationStoreValue {
  const ctx = useContext(InvestigationStoreContext);
  if (!ctx) {
    throw new Error("useInvestigationStore must be used within InvestigationStoreProvider");
  }
  return ctx;
}

export function useOptionalInvestigationStore(): InvestigationStoreValue | null {
  return useContext(InvestigationStoreContext);
}

/** O6.9c — read investigation state for the current signal id (stable selection key). */
export function useInvestigation(signalId: string): InvestigationEntry {
  const { getEntry } = useInvestigationStore();
  return useMemo(() => getEntry(signalId), [getEntry, signalId]);
}

export type { InvestigationEntry } from "../lib/investigationTypes";
export type { InvestigationStatus } from "../lib/investigationTypes";
