/**
 * Phase 21d – Suggested Action Classifier
 *
 * Deterministic heuristics to classify unmapped candidates.
 * No LLM, no external APIs.
 */

import { searchRegistry } from "./registryBrowser.js";

export type SuggestedAction = "alias-candidate" | "new-canonical-entry" | "review-needed";

const MEAL_GENERIC = new Set([
  "ice", "cream", "sweet", "sandwich", "cookie", "cookies", "biscuit", "biscuits",
  "pie", "steak", "sirloin", "potato", "potatoes", "mixed", "dish", "dishes",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Classify an unmapped candidate into a suggested action.
 */
export function classifySuggestedAction(
  value: string,
  kind: "meal_token" | "medication" | "supplement"
): SuggestedAction {
  const norm = normalize(value);
  if (!norm || norm.length < 2) return "review-needed";

  // Review needed: generic meal tokens, noisy patterns
  if (kind === "meal_token") {
    const words = norm.split(/\s+/);
    if (words.some((w) => MEAL_GENERIC.has(w))) return "review-needed";
    if (norm.length < 4) return "review-needed";
    // Multi-word meal tokens that suggest mixed dishes
    if (words.length >= 3 && (norm.includes("with") || norm.includes("and"))) {
      return "review-needed";
    }
  }

  // Alias candidate: term matches something in drug/supplement/food registry
  const searchResult = searchRegistry(norm);
  if (searchResult.results.length > 0) return "alias-candidate";

  // Also try with spaces→hyphens (e.g. "st johns wort" vs "st-johns-wort")
  const hyphenated = norm.replace(/\s+/g, "-");
  if (hyphenated !== norm) {
    const alt = searchRegistry(hyphenated);
    if (alt.results.length > 0) return "alias-candidate";
  }

  // New canonical entry: medication/supplement that looks valid, no registry match
  if (kind === "medication" || kind === "supplement") {
    if (norm.length >= 4 && norm.length <= 60) return "new-canonical-entry";
  }

  // Meal token that passed review-needed checks but no registry match
  if (kind === "meal_token" && norm.length >= 4) return "new-canonical-entry";

  return "review-needed";
}

/** Phase 22.1: Radar suggested actions (alias_candidate | new_entry_candidate | investigate | low_priority) */
export type RadarSuggestedAction =
  | "alias_candidate"
  | "new_entry_candidate"
  | "investigate"
  | "low_priority";

export type GapType = "alias_gap" | "semantic_gap" | "interaction_gap";

function toRadarKind(
  entityType: "medication" | "supplement" | "food" | "unknown"
): "meal_token" | "medication" | "supplement" {
  if (entityType === "medication") return "medication";
  if (entityType === "supplement") return "supplement";
  return "meal_token";
}

/**
 * Phase 22.1: Classify suggested action for Knowledge Radar entities.
 * Uses occurrence, context, highRisk, and registry lookup.
 */
export function classifyRadarEntityAction(
  entity: string,
  entityType: "medication" | "supplement" | "food" | "unknown",
  options?: {
    occurrenceCount?: number;
    highRiskCount?: number;
    contextMedicationCount?: number;
    contextSupplementCount?: number;
    contextFoodCount?: number;
  }
): RadarSuggestedAction {
  const occ = options?.occurrenceCount ?? 0;
  const highRisk = options?.highRiskCount ?? 0;
  const ctxMed = options?.contextMedicationCount ?? 0;
  const ctxSupp = options?.contextSupplementCount ?? 0;
  const ctxFood = options?.contextFoodCount ?? 0;

  // Investigate: high risk
  if (highRisk > 0) return "investigate";

  // Alias candidate: high occurrence, co-occurs with known entity, no high risk
  const hasKnownCooccurrence = ctxMed > 0 || ctxSupp > 0 || ctxFood > 0;
  if (occ >= 3 && hasKnownCooccurrence && highRisk === 0) return "alias_candidate";

  // New entry candidate: occurrence >= 2, entity type known, appears across contexts
  const contextDiversity = [ctxMed, ctxSupp, ctxFood].filter((c) => c > 0).length;
  if (occ >= 2 && entityType !== "unknown" && contextDiversity >= 1) return "new_entry_candidate";

  // Fallback: use base classifier for registry-based hints
  const base = classifySuggestedAction(entity, toRadarKind(entityType));
  if (base === "alias-candidate") return "alias_candidate";
  if (base === "new-canonical-entry") return "new_entry_candidate";
  return "low_priority";
}

/**
 * Phase 22.1: Classify suggested action for Knowledge Radar combinations.
 */
export function classifyRadarCombinationAction(
  _entityA: string,
  _entityAType: string,
  _entityB: string,
  _entityBType: string,
  combinationType: string,
  options?: { highRiskCount?: number }
): RadarSuggestedAction {
  const highRisk = options?.highRiskCount ?? 0;
  if (highRisk > 0) return "investigate";
  const highValue = ["drug_supplement", "drug_drug", "drug_food", "drug_unknown", "supplement_unknown"];
  if (highValue.includes(combinationType)) return "investigate";
  return "low_priority";
}

/**
 * Phase 22.1: Compute gap type for entity (display-only metadata).
 */
export function classifyEntityGapType(options: {
  occurrenceCount: number;
  contextMedicationCount?: number;
  contextSupplementCount?: number;
  contextFoodCount?: number;
  hasKnownCooccurrence?: boolean;
}): GapType {
  const { occurrenceCount, contextMedicationCount = 0, contextSupplementCount = 0, contextFoodCount = 0 } = options;
  const contexts = [contextMedicationCount, contextSupplementCount, contextFoodCount].filter((c) => c > 0);

  // Alias gap: frequently with ONE canonical entity
  if (occurrenceCount >= 3 && contexts.length === 1) return "alias_gap";

  // Semantic gap: appears across multiple contexts
  if (contexts.length >= 2 || occurrenceCount >= 2) return "semantic_gap";

  return "semantic_gap";
}

/**
 * Phase 22.1: Gap type for combinations is always interaction_gap.
 */
export function getCombinationGapType(): GapType {
  return "interaction_gap";
}
