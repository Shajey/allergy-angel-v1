/**
 * Phase 21a / 22 – Verdict Observer (Telemetry Layer)
 *
 * Observes inference results for telemetry purposes.
 * Does NOT modify inference — purely observational.
 *
 * Phase 22: Records unknown entities and combinations to Knowledge Radar.
 * Fire-and-forget; never throws into user-facing path.
 */

import type { ResolvedEntity } from "../knowledge/types.js";
import type { Verdict } from "../inference/checkRisk.js";
import {
  upsertUnknownEntity,
  upsertUnknownCombination,
  toEntityType,
  getCombinationType,
  orderPair,
} from "./radarStore.js";
import { detectRelationship } from "./relationshipDetector.js";
import { recordRelationshipSignal } from "./relationshipStore.js";

/** Event with resolution attached (from enrichWithResolution) */
interface EnrichedEvent {
  type?: string;
  resolution?: ResolvedEntity;
  [key: string]: unknown;
}

function resolutionToEntityType(r: ResolvedEntity): "medication" | "supplement" | "food" | "unknown" {
  return toEntityType(r.type);
}

/**
 * Record unknown entities and combinations to Knowledge Radar.
 * Called AFTER verdict exists, from saveExtractionRun.
 * Fire-and-forget; errors are logged, never propagated.
 */
export function recordRadarTelemetry(args: {
  verdict: Verdict;
  events: EnrichedEvent[];
}): void {
  const { verdict, events } = args;
  const day = new Date().toISOString().split("T")[0];
  const isHighRisk = verdict.riskLevel === "high" || verdict.riskLevel === "medium";
  const highRiskDelta = isHighRisk ? 1 : 0;
  const safeDelta = isHighRisk ? 0 : 1;

  const resolutions = events
    .map((e) => e.resolution)
    .filter((r): r is ResolvedEntity => !!r && typeof r === "object");

  const unresolved = resolutions.filter((r) => !r.resolved);
  const resolved = resolutions.filter((r) => r.resolved);
  if (unresolved.length === 0) return;

  // Phase 22.1: Context counts (co-occurring resolved entities by domain)
  const medCount = resolved.filter((r) => toEntityType(r.type) === "medication").length;
  const suppCount = resolved.filter((r) => toEntityType(r.type) === "supplement").length;
  const foodCount = resolved.filter((r) => toEntityType(r.type) === "food").length;

  // Aggregate by (entity, entityType) for this check
  const entityCounts = new Map<string, number>();
  for (const r of unresolved) {
    const entity = r.canonical?.trim();
    if (!entity) continue;
    const entityType = resolutionToEntityType(r);
    const key = `${entity}:${entityType}`;
    entityCounts.set(key, (entityCounts.get(key) ?? 0) + 1);
  }

  // Unresolved entities → unknown_entity_daily (with context)
  for (const [key, count] of entityCounts) {
    const [entity, entityType] = key.split(":") as [string, "medication" | "supplement" | "food" | "unknown"];
    upsertUnknownEntity({
      entity,
      entityType,
      day,
      occurrenceCount: count,
      highRiskCount: highRiskDelta,
      contextMedicationCount: medCount,
      contextSupplementCount: suppCount,
      contextFoodCount: foodCount,
    }).catch((err) =>
      console.error("[Radar] Entity upsert failed:", err instanceof Error ? err.message : err)
    );
  }

  // Combinations: aggregate pairs from events (unresolved+resolved, unresolved+unresolved)
  const comboCounts = new Map<string, number>();

  for (let i = 0; i < resolutions.length; i++) {
    const rA = resolutions[i];
    const entityA = rA.canonical?.trim();
    if (!entityA) continue;
    const typeA = resolutionToEntityType(rA);
    const unresolvedA = !rA.resolved;

    for (let j = i + 1; j < resolutions.length; j++) {
      const rB = resolutions[j];
      const entityB = rB.canonical?.trim();
      if (!entityB || entityA === entityB) continue;
      const typeB = resolutionToEntityType(rB);
      const unresolvedB = !rB.resolved;

      // Only record if at least one is unresolved
      if (!unresolvedA && !unresolvedB) continue;

      const ordered = orderPair(entityA, typeA, entityB, typeB);
      const comboType = getCombinationType(typeA, typeB);
      const key = `${ordered.entity_a}:${ordered.entity_a_type}:${ordered.entity_b}:${ordered.entity_b_type}:${comboType}`;
      comboCounts.set(key, (comboCounts.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of comboCounts) {
    const parts = key.split(":");
    const entityA = parts[0];
    const typeA = parts[1] as "medication" | "supplement" | "food" | "unknown";
    const entityB = parts[2];
    const typeB = parts[3] as "medication" | "supplement" | "food" | "unknown";
    const comboType = parts[4] as import("./radarStore.js").CombinationType;

    upsertUnknownCombination({
      entityA,
      entityAType: typeA,
      entityB,
      entityBType: typeB,
      combinationType: comboType,
      day,
      occurrenceCount: count,
      highRiskCount: highRiskDelta,
      safeOccurrenceCount: safeDelta,
    }).catch((err) =>
      console.error("[Radar] Combination upsert failed:", err instanceof Error ? err.message : err)
    );
  }

  // Phase 22.2: Record relationship signals for ALL entity pairs (not just unknown)
  const signalCounts = new Map<
    string,
    {
      entityA: string;
      entityB: string;
      typeA: string;
      typeB: string;
      relType: import("./relationshipDetector.js").RelationshipType;
      count: number;
    }
  >();
  for (let i = 0; i < resolutions.length; i++) {
    const rA = resolutions[i];
    const entityA = rA.canonical?.trim();
    if (!entityA) continue;
    const typeA = resolutionToEntityType(rA);

    for (let j = i + 1; j < resolutions.length; j++) {
      const rB = resolutions[j];
      const entityB = rB.canonical?.trim();
      if (!entityB || entityA === entityB) continue;
      const typeB = resolutionToEntityType(rB);

      const relType = detectRelationship(typeA, typeB);
      const [ea, eb] = entityA <= entityB ? [entityA, entityB] : [entityB, entityA];
      const tA = entityA <= entityB ? typeA : typeB;
      const tB = entityA <= entityB ? typeB : typeA;
      const key = `${ea}\0${eb}\0${relType}`;
      const cur = signalCounts.get(key);
      if (cur) {
        cur.count += 1;
      } else {
        signalCounts.set(key, {
          entityA: ea,
          entityB: eb,
          typeA: tA,
          typeB: tB,
          relType: relType as import("./relationshipDetector.js").RelationshipType,
          count: 1,
        });
      }
    }
  }

  for (const v of signalCounts.values()) {
    recordRelationshipSignal({
      entityA: v.entityA,
      entityAType: v.typeA,
      entityB: v.entityB,
      entityBType: v.typeB,
      relationshipType: v.relType,
      occurrenceCount: v.count,
      contextMedicationCount: medCount,
      contextSupplementCount: suppCount,
      contextFoodCount: foodCount,
      day,
    }).catch((err) =>
      console.error("[Radar] Relationship signal failed:", err instanceof Error ? err.message : err)
    );
  }
}

/**
 * Log unresolved entities for future radar analysis.
 * Called from extract.ts when no profile (legacy path).
 * Phase 22: Primary recording is via recordRadarTelemetry from saveExtractionRun.
 */
export function observeUnresolvedEntities(resolutions: ResolvedEntity[]): void {
  const unresolved = resolutions.filter((r) => !r.resolved);
  if (unresolved.length === 0) return;

  for (const r of unresolved) {
    console.log("[Radar] Unresolved entity:", {
      entity: r.canonical,
      contextType: resolutionToEntityType(r),
      date: new Date().toISOString().split("T")[0],
    });
  }
}
