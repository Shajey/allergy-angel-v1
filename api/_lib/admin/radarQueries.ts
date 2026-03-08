/**
 * Phase 22 – Knowledge Radar Query Layer
 *
 * Aggregates daily telemetry over a window and returns ranked entities/combinations.
 */

import { getSupabaseClient } from "../supabaseClient.js";
import { scoreEntity, scoreCombination, getPriorityLabel } from "../telemetry/radarPriority.js";
import {
  scoreRelationshipSignal,
  getSignalPriorityLabel,
} from "../telemetry/relationshipPriority.js";
import {
  classifyRadarEntityAction,
  classifyRadarCombinationAction,
  classifyEntityGapType,
  getCombinationGapType,
  type GapType,
} from "./suggestedAction.js";
import type { CombinationType } from "../telemetry/radarStore.js";

/** Phase 22.4: Signal pattern from occurrence/risk/safe counts. */
function getSignalPattern(
  occurrenceCount: number,
  highRiskCount: number,
  safeOccurrenceCount: number,
  riskRatio: number,
  safeRatio: number
): SignalPattern {
  if (occurrenceCount < 3) return "insufficient_data";
  if (riskRatio >= 0.5) return "emerging_risk";
  if (safeRatio >= 0.8 && highRiskCount === 0) return "mostly_safe";
  return "mixed_signal";
}

/** Phase 22.3: Dominant context from ratios (>0.6 → single domain, else mixed) */
function getDominantContext(
  medicationRatio: number,
  supplementRatio: number,
  foodRatio: number
): "medication" | "supplement" | "food" | "mixed" {
  if (medicationRatio > 0.6) return "medication";
  if (supplementRatio > 0.6) return "supplement";
  if (foodRatio > 0.6) return "food";
  return "mixed";
}

export interface RadarEntity {
  entity: string;
  entityType: string;
  occurrenceCount: number;
  highRiskCount: number;
  lastSeenDay: string;
  priorityScore: number;
  suggestedAction: string;
  gapType: GapType;
  contextLabel: string;
  /** Phase 22.3: Context ratios (0–1) */
  medicationRatio: number;
  supplementRatio: number;
  foodRatio: number;
  /** Phase 22.3: Dominant context classification */
  dominantContext: "medication" | "supplement" | "food" | "mixed";
  /** Phase 22.3: Candidate canonical entity when entity appears frequently with a single other */
  possibleAliasOf: string | null;
}

/** Phase 22.4: Signal pattern interpretation. */
export type SignalPattern =
  | "emerging_risk"
  | "mostly_safe"
  | "mixed_signal"
  | "insufficient_data";

export interface RadarCombination {
  entityA: string;
  entityAType: string;
  entityB: string;
  entityBType: string;
  combinationType: string;
  occurrenceCount: number;
  highRiskCount: number;
  /** Phase 22.4: Safe occurrence count. */
  safeOccurrenceCount: number;
  lastSeenDay: string;
  priorityScore: number;
  priorityLabel: string;
  suggestedAction: string;
  gapType: GapType;
  /** Phase 22.4: high_risk_count / occurrence_count. */
  riskRatio: number;
  /** Phase 22.4: safe_occurrence_count / occurrence_count. */
  safeRatio: number;
  /** Phase 22.4: Interpreted signal pattern. */
  signalPattern: SignalPattern;
}

export interface RadarStats {
  totalUnknownEntities: number;
  totalInteractionGaps: number;
  highPriorityCount: number;
  /** Phase 22.4: Safety learning stats. */
  totalCombinationsObserved: number;
  emergingRiskCount: number;
  mostlySafeCount: number;
  insufficientDataCount: number;
}

export interface RadarSignal {
  entityA: string;
  entityAType: string | null;
  entityB: string;
  entityBType: string | null;
  relationship: string;
  occurrenceCount: number;
  lastSeenDay: string;
  priorityScore: number;
  priority: string;
}

async function getEntityBuckets(windowDays: number) {
  const supabase = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("unknown_entity_daily")
    .select("entity, entity_type, day, occurrence_count, high_risk_count, context_medication_count, context_supplement_count, context_food_count")
    .gte("day", sinceStr);

  if (error) throw new Error(`Radar entities query failed: ${error.message}`);
  return data ?? [];
}

async function getCombinationBuckets(windowDays: number) {
  const supabase = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("unknown_combination_daily")
    .select("entity_a, entity_a_type, entity_b, entity_b_type, combination_type, day, occurrence_count, high_risk_count, safe_occurrence_count")
    .gte("day", sinceStr);

  if (error) throw new Error(`Radar combinations query failed: ${error.message}`);
  return data ?? [];
}

/** Phase 22.3: For each entity, find most common co-occurring entity. If one dominates (≥60%), return it. */
function buildPossibleAliasMap(
  combinationBuckets: Array<{
    entity_a: string | null;
    entity_b: string | null;
    occurrence_count: number | null;
  }>
): Map<string, string | null> {
  const entityToPartners = new Map<string, Map<string, number>>();
  for (const row of combinationBuckets) {
    const a = row.entity_a?.trim();
    const b = row.entity_b?.trim();
    const occ = row.occurrence_count ?? 0;
    if (!a || !b || a === b) continue;
    for (const [entity, partner] of [
      [a, b] as const,
      [b, a] as const,
    ]) {
      let partners = entityToPartners.get(entity);
      if (!partners) {
        partners = new Map();
        entityToPartners.set(entity, partners);
      }
      partners.set(partner, (partners.get(partner) ?? 0) + occ);
    }
  }
  const result = new Map<string, string | null>();
  for (const [entity, partners] of entityToPartners) {
    const total = [...partners.values()].reduce((s, c) => s + c, 0);
    if (total === 0) continue;
    let best: { partner: string; count: number } | null = null;
    for (const [partner, count] of partners) {
      if (!best || count > best.count) best = { partner, count };
    }
    if (best && best.count / total >= 0.6) {
      result.set(entity, best.partner);
    }
  }
  return result;
}

export async function getRadarEntities(
  limit = 50,
  windowDays = 30
): Promise<{ meta: { count: number }; entities: RadarEntity[] }> {
  const [buckets, combinationBuckets] = await Promise.all([
    getEntityBuckets(windowDays),
    getCombinationBuckets(windowDays),
  ]);
  const possibleAliasMap = buildPossibleAliasMap(combinationBuckets);

  // Aggregate by entity + entity_type (including context)
  const agg = new Map<
    string,
    {
      occurrenceCount: number;
      highRiskCount: number;
      lastSeenDay: string;
      contextMedicationCount: number;
      contextSupplementCount: number;
      contextFoodCount: number;
    }
  >();
  for (const row of buckets) {
    const key = `${row.entity}:${row.entity_type}`;
    const cur = agg.get(key);
    const occ = row.occurrence_count ?? 0;
    const risk = row.high_risk_count ?? 0;
    const day = row.day ?? "";
    const ctxMed = row.context_medication_count ?? 0;
    const ctxSupp = row.context_supplement_count ?? 0;
    const ctxFood = row.context_food_count ?? 0;
    if (cur) {
      cur.occurrenceCount += occ;
      cur.highRiskCount += risk;
      cur.contextMedicationCount += ctxMed;
      cur.contextSupplementCount += ctxSupp;
      cur.contextFoodCount += ctxFood;
      if (day > cur.lastSeenDay) cur.lastSeenDay = day;
    } else {
      agg.set(key, {
        occurrenceCount: occ,
        highRiskCount: risk,
        lastSeenDay: day,
        contextMedicationCount: ctxMed,
        contextSupplementCount: ctxSupp,
        contextFoodCount: ctxFood,
      });
    }
  }

  const entities: RadarEntity[] = [];
  for (const [key, v] of agg) {
    const [entity, entityType] = key.split(":");
    const priorityScore = scoreEntity({
      occurrenceCount: v.occurrenceCount,
      highRiskCount: v.highRiskCount,
      lastSeenDay: v.lastSeenDay,
      windowDays,
    });
    const suggestedAction = classifyRadarEntityAction(
      entity,
      entityType as "medication" | "supplement" | "food" | "unknown",
      {
        occurrenceCount: v.occurrenceCount,
        highRiskCount: v.highRiskCount,
        contextMedicationCount: v.contextMedicationCount,
        contextSupplementCount: v.contextSupplementCount,
        contextFoodCount: v.contextFoodCount,
      }
    );
    const gapType = classifyEntityGapType({
      occurrenceCount: v.occurrenceCount,
      contextMedicationCount: v.contextMedicationCount,
      contextSupplementCount: v.contextSupplementCount,
      contextFoodCount: v.contextFoodCount,
    });
    const totalContext =
      v.contextMedicationCount + v.contextSupplementCount + v.contextFoodCount;
    const medicationRatio = totalContext
      ? v.contextMedicationCount / totalContext
      : 0;
    const supplementRatio = totalContext
      ? v.contextSupplementCount / totalContext
      : 0;
    const foodRatio = totalContext ? v.contextFoodCount / totalContext : 0;
    const dominantContext = getDominantContext(
      medicationRatio,
      supplementRatio,
      foodRatio
    );
    const contextLabel = `${dominantContext} context`;
    const possibleAliasOf = possibleAliasMap.get(entity) ?? null;
    entities.push({
      entity,
      entityType,
      occurrenceCount: v.occurrenceCount,
      highRiskCount: v.highRiskCount,
      lastSeenDay: v.lastSeenDay,
      priorityScore,
      suggestedAction,
      gapType,
      contextLabel,
      medicationRatio,
      supplementRatio,
      foodRatio,
      dominantContext,
      possibleAliasOf,
    });
  }

  entities.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    return a.entity.localeCompare(b.entity);
  });

  return {
    meta: { count: entities.length },
    entities: entities.slice(0, limit),
  };
}

export async function getRadarCombinations(
  limit = 50,
  windowDays = 30
): Promise<{ meta: { count: number }; combinations: RadarCombination[] }> {
  const buckets = await getCombinationBuckets(windowDays);

  const agg = new Map<
    string,
    {
      occurrenceCount: number;
      highRiskCount: number;
      safeOccurrenceCount: number;
      lastSeenDay: string;
    }
  >();
  for (const row of buckets) {
    const key = `${row.entity_a}:${row.entity_a_type}:${row.entity_b}:${row.entity_b_type}:${row.combination_type}`;
    const cur = agg.get(key);
    const occ = row.occurrence_count ?? 0;
    const risk = row.high_risk_count ?? 0;
    const safe = row.safe_occurrence_count ?? 0;
    const day = row.day ?? "";
    if (cur) {
      cur.occurrenceCount += occ;
      cur.highRiskCount += risk;
      cur.safeOccurrenceCount += safe;
      if (day > cur.lastSeenDay) cur.lastSeenDay = day;
    } else {
      agg.set(key, {
        occurrenceCount: occ,
        highRiskCount: risk,
        safeOccurrenceCount: safe,
        lastSeenDay: day,
      });
    }
  }

  const combinations: RadarCombination[] = [];
  for (const [key, v] of agg) {
    const parts = key.split(":");
    const entityA = parts[0];
    const entityAType = parts[1];
    const entityB = parts[2];
    const entityBType = parts[3];
    const combinationType = parts[4] as CombinationType;
    const riskRatio =
      v.occurrenceCount > 0 ? v.highRiskCount / v.occurrenceCount : 0;
    const safeRatio =
      v.occurrenceCount > 0 ? v.safeOccurrenceCount / v.occurrenceCount : 0;
    const signalPattern = getSignalPattern(
      v.occurrenceCount,
      v.highRiskCount,
      v.safeOccurrenceCount,
      riskRatio,
      safeRatio
    );
    const priorityScore = scoreCombination({
      occurrenceCount: v.occurrenceCount,
      highRiskCount: v.highRiskCount,
      safeOccurrenceCount: v.safeOccurrenceCount,
      lastSeenDay: v.lastSeenDay,
      combinationType,
      windowDays,
    });
    combinations.push({
      entityA,
      entityAType,
      entityB,
      entityBType,
      combinationType,
      occurrenceCount: v.occurrenceCount,
      highRiskCount: v.highRiskCount,
      safeOccurrenceCount: v.safeOccurrenceCount,
      lastSeenDay: v.lastSeenDay,
      priorityScore,
      priorityLabel: getPriorityLabel(priorityScore),
      suggestedAction: classifyRadarCombinationAction(
        entityA,
        entityAType,
        entityB,
        entityBType,
        combinationType,
        { highRiskCount: v.highRiskCount }
      ),
      gapType: getCombinationGapType(),
      riskRatio,
      safeRatio,
      signalPattern,
    });
  }

  combinations.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    const cmpA = a.entityA.localeCompare(b.entityA);
    if (cmpA !== 0) return cmpA;
    return a.entityB.localeCompare(b.entityB);
  });

  return {
    meta: { count: combinations.length },
    combinations: combinations.slice(0, limit),
  };
}

export async function getRadarSignals(
  limit = 50,
  windowDays = 30
): Promise<{ meta: { count: number }; signals: RadarSignal[] }> {
  const supabase = getSupabaseClient();
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = since.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("knowledge_relationship_signals")
    .select("entity_a, entity_a_type, entity_b, entity_b_type, relationship_type, occurrence_count, last_seen")
    .gte("last_seen", sinceStr);

  if (error) throw new Error(`Radar signals query failed: ${error.message}`);
  const rows = data ?? [];

  const signals: RadarSignal[] = rows.map((row) => {
    const occ = row.occurrence_count ?? 0;
    const lastSeen = row.last_seen ?? "";
    const relType = row.relationship_type ?? "unknown_pair";
    const priorityScore = scoreRelationshipSignal({
      occurrenceCount: occ,
      relationshipType: relType as import("../telemetry/relationshipDetector.js").RelationshipType,
      lastSeenDay: lastSeen,
      windowDays,
    });
    return {
      entityA: row.entity_a ?? "",
      entityAType: row.entity_a_type ?? null,
      entityB: row.entity_b ?? "",
      entityBType: row.entity_b_type ?? null,
      relationship: relType,
      occurrenceCount: occ,
      lastSeenDay: lastSeen,
      priorityScore,
      priority: getSignalPriorityLabel(priorityScore),
    };
  });

  signals.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
    if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
    const cmpA = a.entityA.localeCompare(b.entityA);
    if (cmpA !== 0) return cmpA;
    return a.entityB.localeCompare(b.entityB);
  });

  return {
    meta: { count: signals.length },
    signals: signals.slice(0, limit),
  };
}

export async function getRadarStats(windowDays = 30): Promise<RadarStats> {
  const [entitiesResult, combinationsResult] = await Promise.all([
    getRadarEntities(1000, windowDays),
    getRadarCombinations(10000, windowDays),
  ]);

  const highPriorityCount = [
    ...entitiesResult.entities.filter((e) => e.priorityScore >= 1),
    ...combinationsResult.combinations.filter((c) => c.priorityScore >= 1),
  ].length;

  const combinations = combinationsResult.combinations;
  const emergingRiskCount = combinations.filter(
    (c) => c.signalPattern === "emerging_risk"
  ).length;
  const mostlySafeCount = combinations.filter(
    (c) => c.signalPattern === "mostly_safe"
  ).length;
  const insufficientDataCount = combinations.filter(
    (c) => c.signalPattern === "insufficient_data"
  ).length;

  return {
    totalUnknownEntities: entitiesResult.meta.count,
    totalInteractionGaps: combinationsResult.meta.count,
    highPriorityCount,
    totalCombinationsObserved: combinationsResult.meta.count,
    emergingRiskCount,
    mostlySafeCount,
    insufficientDataCount,
  };
}
