/**
 * Phase O4 – Research Target Derivation
 * From query params or Orchestrator selection.
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";

export type ResearchTarget =
  | { mode: "entity"; entity: string; entityType: string; radarMetadata?: Record<string, unknown> }
  | {
      mode: "combination";
      entityA: string;
      entityB: string;
      typeA: string;
      typeB: string;
      radarTelemetry?: {
        occurrenceCount?: number;
        highRiskCount?: number;
        safeOccurrenceCount?: number;
        signalPattern?: string;
      };
    };

export function parseResearchTargetFromSearchParams(
  searchParams: URLSearchParams
): ResearchTarget | null {
  const entity = searchParams.get("entity")?.trim();
  const entityType = searchParams.get("type")?.trim() || "unknown";
  const entityA = searchParams.get("entityA")?.trim();
  const entityB = searchParams.get("entityB")?.trim();
  const mode = searchParams.get("mode");

  if (entity) {
    const occ = searchParams.get("occurrenceCount");
    const risk = searchParams.get("highRiskCount");
    return {
      mode: "entity",
      entity,
      entityType,
      radarMetadata:
        occ || risk
          ? {
              occurrenceCount: occ ? parseInt(occ, 10) : undefined,
              highRiskCount: risk ? parseInt(risk, 10) : undefined,
            }
          : undefined,
    };
  }

  if (entityA && entityB && mode === "combination") {
    const typeA = searchParams.get("typeA")?.trim() || "unknown";
    const typeB = searchParams.get("typeB")?.trim() || "unknown";
    const occ = searchParams.get("occurrenceCount");
    const risk = searchParams.get("highRiskCount");
    const safe = searchParams.get("safeCount");
    const pattern = searchParams.get("signalPattern")?.trim();
    return {
      mode: "combination",
      entityA,
      entityB,
      typeA,
      typeB,
      radarTelemetry:
        occ || risk || safe || pattern
          ? {
              occurrenceCount: occ ? parseInt(occ, 10) : undefined,
              highRiskCount: risk ? parseInt(risk, 10) : undefined,
              safeOccurrenceCount: safe ? parseInt(safe, 10) : undefined,
              signalPattern: pattern ?? undefined,
            }
          : undefined,
    };
  }

  return null;
}

export function researchTargetFromSelection(
  selection: OrchestratorSelection | null
): ResearchTarget | null {
  if (!selection) return null;

  switch (selection.kind) {
    case "unknown-entity":
      return {
        mode: "entity",
        entity: selection.entity,
        entityType: selection.entityType ?? "unknown",
        radarMetadata:
          selection.occurrenceCount != null
            ? { occurrenceCount: selection.occurrenceCount }
            : undefined,
      };
    case "interaction-gap":
    case "signal":
      if (selection.entityA && selection.entityB) {
        return {
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
        };
      }
      return null;
    case "ingestion-candidate":
      return {
        mode: "entity",
        entity: selection.name ?? selection.canonicalId ?? selection.candidateId,
        entityType: "drug",
        radarMetadata: selection.aliasCount != null ? { occurrenceCount: selection.aliasCount } : undefined,
      };
    case "registry-entity":
      return {
        mode: "entity",
        entity: selection.canonicalId,
        entityType: selection.registryType ?? "unknown",
      };
    default:
      return null;
  }
}

export function buildResearchUrl(target: ResearchTarget): string {
  if (target.mode === "entity") {
    const params = new URLSearchParams();
    params.set("entity", target.entity);
    params.set("type", target.entityType);
    if (target.radarMetadata?.occurrenceCount != null) {
      params.set("occurrenceCount", String(target.radarMetadata.occurrenceCount));
    }
    if (target.radarMetadata?.highRiskCount != null) {
      params.set("highRiskCount", String(target.radarMetadata.highRiskCount));
    }
    return `/orchestrator/research?${params.toString()}`;
  }
  const params = new URLSearchParams();
  params.set("entityA", target.entityA);
  params.set("entityB", target.entityB);
  params.set("mode", "combination");
  params.set("typeA", target.typeA);
  params.set("typeB", target.typeB);
  if (target.radarTelemetry?.occurrenceCount != null) {
    params.set("occurrenceCount", String(target.radarTelemetry.occurrenceCount));
  }
  if (target.radarTelemetry?.highRiskCount != null) {
    params.set("highRiskCount", String(target.radarTelemetry.highRiskCount));
  }
  if (target.radarTelemetry?.safeOccurrenceCount != null) {
    params.set("safeCount", String(target.radarTelemetry.safeOccurrenceCount));
  }
  if (target.radarTelemetry?.signalPattern) {
    params.set("signalPattern", target.radarTelemetry.signalPattern);
  }
  return `/orchestrator/research?${params.toString()}`;
}
