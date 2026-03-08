/**
 * Phase 22.2 – Relationship Signal Store
 *
 * Persists entity-pair relationship signals.
 * Privacy-safe: normalized entities, date only, no profile/check IDs.
 */

import { getSupabaseClient } from "../supabaseClient.js";
import type { RelationshipType } from "./relationshipDetector.js";

function orderPair(
  entityA: string,
  entityB: string
): { entity_a: string; entity_b: string } {
  if (entityA <= entityB) return { entity_a: entityA, entity_b: entityB };
  return { entity_a: entityB, entity_b: entityA };
}

export async function recordRelationshipSignal(args: {
  entityA: string;
  entityAType: string | null;
  entityB: string;
  entityBType: string | null;
  relationshipType: RelationshipType;
  occurrenceCount?: number;
  contextMedicationCount?: number;
  contextSupplementCount?: number;
  contextFoodCount?: number;
  day: string;
}): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    const ordered = orderPair(args.entityA, args.entityB);
    const occ = args.occurrenceCount ?? 1;
    const ctxMed = args.contextMedicationCount ?? 0;
    const ctxSupp = args.contextSupplementCount ?? 0;
    const ctxFood = args.contextFoodCount ?? 0;

    const { data: existing } = await supabase
      .from("knowledge_relationship_signals")
      .select("id, occurrence_count, context_medication_count, context_supplement_count, context_food_count, first_seen, last_seen")
      .eq("entity_a", ordered.entity_a)
      .eq("entity_b", ordered.entity_b)
      .eq("relationship_type", args.relationshipType)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("knowledge_relationship_signals")
        .update({
          occurrence_count: (existing.occurrence_count ?? 0) + occ,
          context_medication_count: (existing.context_medication_count ?? 0) + ctxMed,
          context_supplement_count: (existing.context_supplement_count ?? 0) + ctxSupp,
          context_food_count: (existing.context_food_count ?? 0) + ctxFood,
          last_seen: args.day,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("knowledge_relationship_signals").insert({
        entity_a: ordered.entity_a,
        entity_a_type: args.entityAType,
        entity_b: ordered.entity_b,
        entity_b_type: args.entityBType,
        relationship_type: args.relationshipType,
        occurrence_count: occ,
        context_medication_count: ctxMed,
        context_supplement_count: ctxSupp,
        context_food_count: ctxFood,
        first_seen: args.day,
        last_seen: args.day,
      });
    }
  } catch (err) {
    console.error("[Radar] Relationship signal failed:", err instanceof Error ? err.message : err);
  }
}
