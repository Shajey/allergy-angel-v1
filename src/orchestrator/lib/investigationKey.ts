/**
 * Stable key for investigation persistence (must match queue row → selection mapping).
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";

export function stableSelectionKey(s: OrchestratorSelection): string {
  switch (s.kind) {
    case "unknown-entity":
      return `ue:${s.entity}`;
    case "interaction-gap":
      return `ig:${s.entityA}|${s.entityB}|${s.combinationType ?? ""}|${String((s.payload as { relationship?: string } | undefined)?.relationship ?? "")}`;
    case "signal":
      return `sig:${s.id}`;
    case "ingestion-candidate":
      return `in:${s.candidateId}`;
    case "registry-entity":
      return `re:${s.canonicalId}`;
    case "activity":
      return `act:${s.activityId ?? s.title}`;
  }
}

/** Emerging radar row (no combinationType). */
export function keyFromEmergingGapRow(s: {
  entityA: string;
  entityB: string;
  relationship?: string;
}): string {
  return `ig:${s.entityA}|${s.entityB}||${s.relationship ?? ""}`;
}

export function keyFromUnknownEntityRow(e: { entity: string }): string {
  return `ue:${e.entity}`;
}

export function keyFromCombinationRow(c: {
  entityA: string;
  entityB: string;
  combinationType?: string;
}): string {
  return `ig:${c.entityA}|${c.entityB}|${c.combinationType ?? ""}|`;
}
