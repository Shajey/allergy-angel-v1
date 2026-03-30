/**
 * Phase 13.4 – Deterministic Rule Codes
 *
 * Stable identifiers for every inference rule. These codes appear in
 * matched entries and the "Why?" panel for auditability.
 */

export const RULE_ALLERGEN_MATCH = "AA-RULE-AL-001";
export const RULE_DISH_ALLERGEN = "AA-RULE-DA-001";
export const RULE_CROSS_REACTIVE = "AA-RULE-CR-001";
export const RULE_MED_INTERACTION = "AA-RULE-MI-001";
export const RULE_SUPPLEMENT_MED_INTERACTION = "AA-RULE-SM-001";
export const RULE_FOOD_MED_INTERACTION = "AA-RULE-FM-001";
/** O8 — Registry entity risk tag matched profile allergy token */
export const RULE_ENTITY_RISK_TAG = "AA-RULE-ER-001";

export function ruleCodeFor(rule: string): string | null {
  switch (rule) {
    case "allergy_match":
      return RULE_ALLERGEN_MATCH;
    case "dish_allergen":
      return RULE_DISH_ALLERGEN;
    case "cross_reactive":
      return RULE_CROSS_REACTIVE;
    case "medication_interaction":
      return RULE_MED_INTERACTION;
    case "supplement_medication_interaction":
      return RULE_SUPPLEMENT_MED_INTERACTION;
    case "food_medication_interaction":
      return RULE_FOOD_MED_INTERACTION;
    case "entity_risk_tag_match":
      return RULE_ENTITY_RISK_TAG;
    default:
      return null;
  }
}
