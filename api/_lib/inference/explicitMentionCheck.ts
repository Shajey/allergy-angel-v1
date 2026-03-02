/**
 * Phase 18.1 – Intelligent Follow-up Questions
 *
 * Check if the matched allergen was explicitly mentioned in the input.
 * If explicit, no need to ask confirmation ("Does this contain peanut?" when they said "peanut pie").
 */

/** Common synonyms for allergen terms (lowercase). */
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanut: ["groundnut", "goober"],
};

export interface AllergenMatchForExplicitCheck {
  /** Matched term, e.g. "peanut", "tree_nut" */
  term: string;
  /** Child/specific term if matched via taxonomy, e.g. "cashew", "pistachio" */
  childTerm?: string;
  /** Additional synonyms to check */
  synonyms?: string[];
}

/**
 * Check if the matched allergen was explicitly mentioned in the input.
 * Uses word-boundary matching to avoid false positives (e.g. "peanuts" in "peanut butter").
 */
export function isAllergenExplicitInInput(
  rawInput: string,
  match: AllergenMatchForExplicitCheck
): boolean {
  const inputLower = (rawInput ?? "").toLowerCase().trim();
  if (!inputLower) return false;

  const termsToCheck: string[] = [
    match.term,
    match.childTerm,
    ...(match.synonyms ?? []),
    ...(ALLERGEN_SYNONYMS[match.term.toLowerCase()] ?? []),
  ].filter((t): t is string => typeof t === "string" && t.length > 0);

  for (const term of termsToCheck) {
    const t = term.toLowerCase();
    if (!t) continue;
    // Word-boundary style: term as whole word (peanut, peanuts, cashew, etc.)
    const regex = new RegExp(`\\b${escapeRegex(t)}s?\\b`, "i");
    if (regex.test(inputLower)) return true;
  }

  return false;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
