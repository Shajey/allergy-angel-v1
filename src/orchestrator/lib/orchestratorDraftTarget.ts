/**
 * Draft / workspace navigation targets for orchestrator selections.
 * Mirrors ContextPanel + QuickActionsCard `draftTo` / activity routes (single source of truth for center CTA).
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { buildResearchUrl } from "./researchTarget";

export function orchestratorDraftTarget(selection: OrchestratorSelection): string {
  switch (selection.kind) {
    case "unknown-entity":
      return buildResearchUrl({
        mode: "entity",
        entity: selection.entity,
        entityType: selection.entityType ?? "unknown",
        radarMetadata: selection.occurrenceCount != null ? { occurrenceCount: selection.occurrenceCount } : undefined,
      });
    case "interaction-gap":
      return buildResearchUrl({
        mode: "combination",
        entityA: selection.entityA,
        entityB: selection.entityB,
        typeA: "unknown",
        typeB: "unknown",
        radarTelemetry: {
          occurrenceCount: selection.occurrenceCount,
          highRiskCount: selection.highRiskCount,
          safeOccurrenceCount: selection.safeCount,
          signalPattern: selection.signalPattern,
        },
      });
    case "signal":
      return selection.entityA && selection.entityB
        ? buildResearchUrl({
            mode: "combination",
            entityA: selection.entityA,
            entityB: selection.entityB,
            typeA: "unknown",
            typeB: "unknown",
          })
        : "/orchestrator/research";
    case "ingestion-candidate":
      return `/orchestrator/ingestion?candidateId=${encodeURIComponent(selection.candidateId)}`;
    case "registry-entity":
      return buildResearchUrl({
        mode: "entity",
        entity: selection.canonicalId,
        entityType: selection.registryType ?? "unknown",
      });
    case "activity":
      return "/orchestrator/research";
  }
}

const ACTIVITY_ROUTE_MAP: Record<string, string> = {
  research: "/orchestrator/research",
  ingestion: "/orchestrator/ingestion",
  proposal: "/orchestrator/registry",
  signal: "/orchestrator/radar",
};

const ACTIVITY_LABEL_MAP: Record<string, string> = {
  research: "Continue Investigation",
  ingestion: "Review Ingestion",
  proposal: "Check Registry",
  signal: "View Safety Signal",
};

export function activityWorkspaceRoute(selection: Extract<OrchestratorSelection, { kind: "activity" }>): string {
  return selection.eventType ? ACTIVITY_ROUTE_MAP[selection.eventType] ?? "/orchestrator/activity" : "/orchestrator/activity";
}

export function activityWorkspaceButtonLabel(selection: Extract<OrchestratorSelection, { kind: "activity" }>): string {
  return selection.eventType
    ? ACTIVITY_LABEL_MAP[selection.eventType] ?? "Open workspace"
    : "Open workspace";
}

/** Dismiss / no-change / archive — center CTA is resolve, not draft. */
export function isResolvedOnlyDecision(selection: OrchestratorSelection, decision: string): boolean {
  if (decision === "dismiss") return true;
  if (selection.kind === "registry-entity" && decision === "none") return true;
  if (selection.kind === "activity" && decision === "archive") return true;
  return false;
}
