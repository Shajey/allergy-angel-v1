/**
 * Phase 22.2 – Relationship Type Detection
 *
 * Classifies entity pairs for knowledge evolution signals.
 * Does NOT affect inference.
 */

export type RelationshipType =
  | "drug_supplement_possible_interaction"
  | "drug_food_possible_interaction"
  | "supplement_stack"
  | "food_pair"
  | "unknown_pair";

type EntityType = "medication" | "supplement" | "food" | "unknown";

export function detectRelationship(
  aType: EntityType,
  bType: EntityType
): RelationshipType {
  if (aType === "medication" && bType === "supplement") return "drug_supplement_possible_interaction";
  if (aType === "supplement" && bType === "medication") return "drug_supplement_possible_interaction";

  if (aType === "medication" && bType === "food") return "drug_food_possible_interaction";
  if (aType === "food" && bType === "medication") return "drug_food_possible_interaction";

  if (aType === "supplement" && bType === "supplement") return "supplement_stack";

  if (aType === "food" && bType === "food") return "food_pair";

  return "unknown_pair";
}
