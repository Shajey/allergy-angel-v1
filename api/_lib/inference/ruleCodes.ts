/**
 * Phase 13.4 – Deterministic Rule Codes
 *
 * Stable identifiers for every inference rule. These codes appear in
 * matched entries and the "Why?" panel for auditability.
 */

export const RULE_ALLERGEN_MATCH = "AA-RULE-AL-001";
export const RULE_CROSS_REACTIVE = "AA-RULE-CR-001";
export const RULE_MED_INTERACTION = "AA-RULE-MI-001";

export function ruleCodeFor(rule: string): string | null {
  switch (rule) {
    case "allergy_match":
      return RULE_ALLERGEN_MATCH;
    case "cross_reactive":
      return RULE_CROSS_REACTIVE;
    case "medication_interaction":
      return RULE_MED_INTERACTION;
    default:
      return null;
  }
}
