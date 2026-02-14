/**
 * Post-process extraction results (LLM/heuristic) to enforce locked rules.
 *
 * Rule A (Meal clarification normalization):
 *   Optional fields (meal.carbs) must NOT trigger needsClarification.
 *   If event.type === "meal" and event.fields?.meal is non-empty, force needsClarification = false.
 *
 * Rule B (Carb follow-up suppression):
 *   When carbs already appear in rawText and at least one meal has carbs captured,
 *   remove follow-up questions that ask for carbs (avoids redundant nagging).
 *
 * Deterministic. No prompt/schema changes.
 */

/** Regex: carb cue in rawText (carb, carbs, or N g/gram/grams). */
const CARB_CUE_REGEX = /(carb|carbs|\b\d+(\.\d+)?\s*(g|gram|grams)\b)/i;

/** Regex: follow-up that asks for carbs (to remove when carbs already captured). */
const CARB_FOLLOWUP_REGEX = /(carb|carbohydrate)/i;

export interface ExtractionResult {
  events: { type?: string; fields?: Record<string, unknown>; needsClarification?: boolean }[];
  followUpQuestions?: string[];
  warnings?: string[];
}

/**
 * Mutates result in place. Rule A: meal events with non-empty meal name get needsClarification=false.
 * Rule B: when hasCarbCue && anyCarbsCaptured, remove carb follow-ups.
 */
export function postProcessExtractionResult(
  rawText: string,
  result: ExtractionResult
): void {
  if (!result.events || !Array.isArray(result.events)) return;

  // ── Rule A: Meal clarification normalization ────────────────────────
  for (const event of result.events) {
    if (event.type === "meal") {
      const mealName = event.fields?.meal;
      if (typeof mealName === "string" && mealName.trim().length > 0) {
        event.needsClarification = false;
      }
    }
  }

  // ── Rule B: Carb follow-up suppression ─────────────────────────────
  const hasCarbCue = CARB_CUE_REGEX.test(rawText ?? "");
  const anyCarbsCaptured = result.events.some(
    (e) => e.type === "meal" && e.fields?.carbs != null
  );

  if (hasCarbCue && anyCarbsCaptured && Array.isArray(result.followUpQuestions)) {
    result.followUpQuestions = result.followUpQuestions.filter(
      (q) => !CARB_FOLLOWUP_REGEX.test(q)
    );
  }
}
