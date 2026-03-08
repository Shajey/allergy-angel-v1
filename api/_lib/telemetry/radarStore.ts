/**
 * Phase 22 / 22.1 – Knowledge Radar Store
 *
 * Persists unknown entity and combination telemetry in daily buckets.
 * Called from verdict observer only, after verdict exists.
 * Never throws into user-facing path.
 */

import { getSupabaseClient } from "../supabaseClient.js";
import { inferEntityType } from "./entityTypeInference.js";

export type EntityType = "medication" | "supplement" | "food" | "unknown";

export type CombinationType =
  | "drug_supplement"
  | "drug_drug"
  | "drug_food"
  | "supplement_supplement"
  | "supplement_food"
  | "food_food"
  | "drug_unknown"
  | "supplement_unknown"
  | "food_unknown"
  | "other";

function toEntityType(t: string): EntityType {
  if (t === "drug") return "medication";
  if (t === "medication" || t === "supplement" || t === "food" || t === "unknown") return t;
  if (t === "allergen") return "food";
  return "unknown";
}

/** Phase 22.1: Use heuristic inference when type is unknown. */
export function resolveEntityType(entity: string, rawType: EntityType): EntityType {
  if (rawType !== "unknown") return rawType;
  const inferred = inferEntityType(entity);
  return inferred !== "unknown" ? inferred : rawType;
}

/** Phase 22.1: Robust combination classification; rarely default to "other". */
function getCombinationType(
  typeA: EntityType,
  typeB: EntityType
): CombinationType {
  const a = typeA;
  const b = typeB;

  // Both known
  if (a === "medication" && b === "supplement") return "drug_supplement";
  if (a === "supplement" && b === "medication") return "drug_supplement";
  if (a === "medication" && b === "medication") return "drug_drug";
  if (a === "medication" && b === "food") return "drug_food";
  if (a === "food" && b === "medication") return "drug_food";
  if (a === "supplement" && b === "supplement") return "supplement_supplement";
  if (a === "supplement" && b === "food") return "supplement_food";
  if (a === "food" && b === "supplement") return "supplement_food";
  if (a === "food" && b === "food") return "food_food";

  // One unknown: use known type for pairing
  if (a === "unknown" && b === "medication") return "drug_unknown";
  if (a === "medication" && b === "unknown") return "drug_unknown";
  if (a === "unknown" && b === "supplement") return "supplement_unknown";
  if (a === "supplement" && b === "unknown") return "supplement_unknown";
  if (a === "unknown" && b === "food") return "food_unknown";
  if (a === "food" && b === "unknown") return "food_unknown";

  return "other";
}

/** Order pair for stable dedupe: entity_a <= entity_b lexicographically. */
function orderPair(
  entityA: string,
  typeA: EntityType,
  entityB: string,
  typeB: EntityType
): { entity_a: string; entity_a_type: EntityType; entity_b: string; entity_b_type: EntityType } {
  const keyA = `${entityA}:${typeA}`;
  const keyB = `${entityB}:${typeB}`;
  if (keyA <= keyB) {
    return { entity_a: entityA, entity_a_type: typeA, entity_b: entityB, entity_b_type: typeB };
  }
  return { entity_a: entityB, entity_a_type: typeB, entity_b: entityA, entity_b_type: typeA };
}

export async function upsertUnknownEntity(args: {
  entity: string;
  entityType: EntityType;
  day: string;
  occurrenceCount?: number;
  highRiskCount?: number;
  contextMedicationCount?: number;
  contextSupplementCount?: number;
  contextFoodCount?: number;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const {
      entity,
      entityType,
      day,
      occurrenceCount = 1,
      highRiskCount = 0,
      contextMedicationCount = 0,
      contextSupplementCount = 0,
      contextFoodCount = 0,
    } = args;

    // Phase 22.1: Infer type when unknown
    const resolvedType = resolveEntityType(entity, entityType);

    const { data: existing } = await supabase
      .from("unknown_entity_daily")
      .select("id, occurrence_count, high_risk_count, context_medication_count, context_supplement_count, context_food_count")
      .eq("entity", entity)
      .eq("entity_type", resolvedType)
      .eq("day", day)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("unknown_entity_daily")
        .update({
          occurrence_count: (existing.occurrence_count ?? 0) + occurrenceCount,
          high_risk_count: (existing.high_risk_count ?? 0) + highRiskCount,
          context_medication_count: (existing.context_medication_count ?? 0) + contextMedicationCount,
          context_supplement_count: (existing.context_supplement_count ?? 0) + contextSupplementCount,
          context_food_count: (existing.context_food_count ?? 0) + contextFoodCount,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("unknown_entity_daily").insert({
        entity,
        entity_type: resolvedType,
        day,
        occurrence_count: occurrenceCount,
        high_risk_count: highRiskCount,
        context_medication_count: contextMedicationCount,
        context_supplement_count: contextSupplementCount,
        context_food_count: contextFoodCount,
      });
    }
  } catch (err) {
    console.error("[Radar] upsertUnknownEntity failed:", err instanceof Error ? err.message : err);
  }
}

/** Phase 22.4: Signal kind for combination telemetry. */
export type CombinationSignalKind = "high_risk" | "safe";

export async function upsertUnknownCombination(args: {
  entityA: string;
  entityAType: EntityType;
  entityB: string;
  entityBType: EntityType;
  combinationType: CombinationType;
  day: string;
  occurrenceCount?: number;
  highRiskCount?: number;
  safeOccurrenceCount?: number;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const ordered = orderPair(
      args.entityA,
      args.entityAType,
      args.entityB,
      args.entityBType
    );
    const occurrenceCount = args.occurrenceCount ?? 1;
    const highRiskCount = args.highRiskCount ?? 0;
    const safeOccurrenceCount = args.safeOccurrenceCount ?? 0;

    const { data: existing } = await supabase
      .from("unknown_combination_daily")
      .select("id, occurrence_count, high_risk_count, safe_occurrence_count")
      .eq("entity_a", ordered.entity_a)
      .eq("entity_a_type", ordered.entity_a_type)
      .eq("entity_b", ordered.entity_b)
      .eq("entity_b_type", ordered.entity_b_type)
      .eq("day", args.day)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("unknown_combination_daily")
        .update({
          occurrence_count: (existing.occurrence_count ?? 0) + occurrenceCount,
          high_risk_count: (existing.high_risk_count ?? 0) + highRiskCount,
          safe_occurrence_count: (existing.safe_occurrence_count ?? 0) + safeOccurrenceCount,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("unknown_combination_daily").insert({
        entity_a: ordered.entity_a,
        entity_a_type: ordered.entity_a_type,
        entity_b: ordered.entity_b,
        entity_b_type: ordered.entity_b_type,
        combination_type: args.combinationType,
        day: args.day,
        occurrence_count: occurrenceCount,
        high_risk_count: highRiskCount,
        safe_occurrence_count: safeOccurrenceCount,
      });
    }
  } catch (err) {
    console.error("[Radar] upsertUnknownCombination failed:", err instanceof Error ? err.message : err);
  }
}

export { toEntityType, getCombinationType, orderPair };
