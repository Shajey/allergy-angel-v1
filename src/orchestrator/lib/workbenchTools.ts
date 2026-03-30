/**
 * Phase O6.10 — Registry + Graph shortcut URLs for the Signals workbench (same targets as former Context panel).
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { buildGraphUrl } from "./graphUtils";

function regSearch(q: string): string {
  return `/orchestrator/registry?search=${encodeURIComponent(q)}`;
}

export function workbenchRegistryUrl(selection: OrchestratorSelection): string {
  switch (selection.kind) {
    case "unknown-entity":
      return regSearch(selection.entity);
    case "interaction-gap":
      return regSearch(selection.entityA);
    case "signal":
      return selection.entityA ? regSearch(selection.entityA) : "/orchestrator/registry";
    case "ingestion-candidate":
      return regSearch(selection.name ?? selection.canonicalId ?? selection.candidateId);
    case "registry-entity":
      return regSearch(selection.canonicalId);
    case "activity":
      return regSearch(selection.title);
  }
}

export function workbenchGraphUrl(selection: OrchestratorSelection): string {
  switch (selection.kind) {
    case "unknown-entity":
      return buildGraphUrl({ entity: selection.entity });
    case "interaction-gap":
      return buildGraphUrl({ entityA: selection.entityA, entityB: selection.entityB });
    case "signal":
      return selection.entityA && selection.entityB
        ? buildGraphUrl({ entityA: selection.entityA, entityB: selection.entityB })
        : "/orchestrator/graph";
    case "ingestion-candidate":
      return buildGraphUrl({ entity: selection.name ?? selection.canonicalId ?? selection.candidateId });
    case "registry-entity":
      return buildGraphUrl({ entity: selection.canonicalId });
    case "activity":
      return "/orchestrator/graph";
  }
}
