/**
 * Client governance queue — submissions from Signals (O6.11).
 * Distinct from investigation status: state change ≠ queue row until enqueued here.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";
import type { StoredProposalPayload } from "./investigationTypes";

/** Governance queue row — same before/after packet as Signals, plus stable signal linkage. */
export interface GovernanceItem {
  id: string;
  /** Stable selection key (matches investigation / left rail). */
  signalId: string;
  entity: string;
  proposalType: string;
  /** Full submitted payload (audit / handoff). */
  proposal: StoredProposalPayload;
  /** Duplicated from proposal.preview — exact packet shown in Signals. */
  before: string;
  after: string;
  /** Optional CURRENT / PROPOSED strip when present in Signals (e.g. unknown entity). */
  ledgerLine?: { current: string; proposed: string };
  confidence?: number;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
}

/** @deprecated Use GovernanceItem */
export type GovernanceProposal = GovernanceItem;

const STORAGE_KEY = "orch_governance_queue_v1";

function normalizeLegacyRow(raw: Record<string, unknown>): GovernanceItem | null {
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;
  const proposal = raw.proposal as StoredProposalPayload | undefined;
  if (!proposal?.preview) return null;
  const signalId = typeof raw.signalId === "string" ? raw.signalId : id;
  const proposalType =
    typeof raw.proposalType === "string"
      ? raw.proposalType
      : typeof raw.type === "string"
        ? raw.type
        : "";
  if (!proposalType) return null;
  const before =
    typeof raw.before === "string" ? raw.before : (proposal.preview.before ?? "");
  const after = typeof raw.after === "string" ? raw.after : (proposal.preview.after ?? "");
  const confidence =
    typeof raw.confidence === "number" ? raw.confidence : proposal.research != null && typeof (proposal.research as { classificationConfidence?: number }).classificationConfidence === "number"
      ? (proposal.research as { classificationConfidence: number }).classificationConfidence
      : 0;
  const ledgerLine =
    raw.ledgerLine && typeof raw.ledgerLine === "object"
      ? (raw.ledgerLine as { current: string; proposed: string })
      : undefined;
  const status = raw.status;
  const createdAt = typeof raw.createdAt === "number" ? raw.createdAt : Date.now();
  if (status !== "pending" && status !== "approved" && status !== "rejected") return null;

  return {
    id,
    signalId,
    entity: typeof raw.entity === "string" ? raw.entity : "",
    proposalType,
    proposal,
    before,
    after,
    ledgerLine,
    confidence,
    status,
    createdAt,
  };
}

function loadProposals(): GovernanceItem[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: GovernanceItem[] = [];
    for (const row of parsed) {
      if (!row || typeof row !== "object") continue;
      const n = normalizeLegacyRow(row as Record<string, unknown>);
      if (n) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}

function saveProposals(proposals: GovernanceItem[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(proposals));
  } catch {
    /* ignore quota */
  }
}

/** Display label for a signal submission (matches Signals workbench title patterns). */
export function governingEntityLabel(sel: OrchestratorSelection): string {
  switch (sel.kind) {
    case "unknown-entity":
      return sel.entity;
    case "interaction-gap":
      return `${sel.entityA} + ${sel.entityB}`;
    case "signal":
      return sel.title;
    case "ingestion-candidate":
      return sel.name ?? sel.canonicalId ?? sel.candidateId;
    case "registry-entity":
      return sel.canonicalId;
    case "activity":
      return sel.title;
  }
}

interface GovernanceStoreValue {
  /** Pending + terminal rows (session-scoped). */
  proposals: GovernanceItem[];
  add: (
    p: Omit<GovernanceItem, "status" | "createdAt"> & {
      status?: GovernanceItem["status"];
      createdAt?: number;
    }
  ) => void;
  /** O7 — terminal status update (removes row from pending filter). */
  updateItemStatus: (id: string, status: Exclude<GovernanceItem["status"], "pending">) => void;
}

const GovernanceStoreContext = createContext<GovernanceStoreValue | null>(null);

export function GovernanceStoreProvider({ children }: { children: ReactNode }) {
  const [proposals, setProposals] = useState<GovernanceItem[]>(() => loadProposals());

  const add = useCallback(
    (
      input: Omit<GovernanceItem, "status" | "createdAt"> & {
        status?: GovernanceItem["status"];
        createdAt?: number;
      }
    ) => {
      const row: GovernanceItem = {
        ...input,
        status: input.status ?? "pending",
        createdAt: input.createdAt ?? Date.now(),
      };
      setProposals((prev) => {
        const without = prev.filter((x) => !(x.id === row.id && x.status === "pending"));
        const next = [...without, row];
        saveProposals(next);
        return next;
      });
    },
    []
  );

  const updateItemStatus = useCallback((id: string, status: Exclude<GovernanceItem["status"], "pending">) => {
    setProposals((prev) => {
      const next = prev.map((x) => (x.id === id ? { ...x, status } : x));
      saveProposals(next);
      return next;
    });
  }, []);

  const value = useMemo<GovernanceStoreValue>(
    () => ({ proposals, add, updateItemStatus }),
    [proposals, add, updateItemStatus]
  );

  return <GovernanceStoreContext.Provider value={value}>{children}</GovernanceStoreContext.Provider>;
}

export function useGovernanceStore(): GovernanceStoreValue {
  const ctx = useContext(GovernanceStoreContext);
  if (!ctx) {
    throw new Error("useGovernanceStore must be used within GovernanceStoreProvider");
  }
  return ctx;
}

export function useOptionalGovernanceStore(): GovernanceStoreValue | null {
  return useContext(GovernanceStoreContext);
}
