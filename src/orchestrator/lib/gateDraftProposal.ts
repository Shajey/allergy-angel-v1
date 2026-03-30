/**
 * Session gate: legacy draft unlock (center workflow now owns Generate Draft Proposal).
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";

const PREFIX = "orch_draft_";

export function draftGateKey(selection: OrchestratorSelection): string {
  switch (selection.kind) {
    case "unknown-entity":
      return `ue:${selection.entity}`;
    case "interaction-gap":
      return `ig:${selection.entityA}|${selection.entityB}`;
    case "signal":
      return `sig:${selection.id}`;
    case "ingestion-candidate":
      return `in:${selection.candidateId}`;
    case "registry-entity":
      return `re:${selection.canonicalId}`;
    case "activity":
      return `act:${selection.activityId ?? selection.title}`;
  }
}

export function isDraftUnlocked(key: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(PREFIX + key) === "1";
}

export function markInvestigationChosen(key: string): void {
  sessionStorage.setItem(PREFIX + key, "1");
}

export function markDraftSkip(key: string): void {
  sessionStorage.setItem(PREFIX + key, "1");
}
