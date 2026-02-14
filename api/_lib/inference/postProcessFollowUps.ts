/**
 * Phase 10J – Risk-Driven Follow-Up Hygiene
 *
 * Deterministic post-processing layer. Follow-ups are gated by:
 *   - Safety-first: high allergen verdict → evidence/label questions (no carbs)
 *   - Intent-gating: carb questions only when user explicitly mentions glucose/carb intent
 *   - Phase 10J.2: medium cross-reactive + empty follow-ups → evidence-seeking (symptom or carb cue)
 *   - Otherwise: strip nutrition/carb follow-ups to keep Allergy Angel on-scope
 *
 * No extraction changes. No LLM. Auditable and deterministic.
 */

/** Regex for glucose/carb/diabetes intent. Carb follow-ups allowed only when this matches. */
const GLUCOSE_INTENT_REGEX =
  /\b(carbs?|carbohydrate|grams?|g\b|glucose|mg\/dL|blood sugar|diabetes|a1c)\b/i;

/** Regex for follow-up questions that mention carbs/nutrition (to filter when no glucose intent). */
const CARB_FOLLOWUP_REGEX =
  /\b(carbs?|carbohydrate|grams?|nutrition|calories?|calorie|g\s*of\s*carb)\b/i;

/** Phase 10J.2: symptom cue in rawText (evidence-seeking for cross-reactive). */
const SYMPTOM_CUE_REGEX =
  /\b(itch|hive|rash|throat|swell|tight|wheeze|vomit|nausea|dizzy|wobbly)\b/i;

/** Phase 10J.2: carb/glucose cue in rawText. */
const CARB_GLUCOSE_CUE_REGEX =
  /\b(carb|carbs|mg\/dl|mgdl|\d+\s*g)\b/i;

/**
 * True if rawText contains explicit glucose/carb/diabetes intent.
 * Used to gate carb-related follow-ups.
 */
export function hasGlucoseIntent(rawText: string): boolean {
  return GLUCOSE_INTENT_REGEX.test(rawText ?? "");
}

/**
 * True if verdict is high risk due to direct allergen taxonomy match.
 * Cross-reactive (medium) does NOT trigger evidence follow-ups.
 */
export function hasHighAllergenVerdict(verdict: { riskLevel?: string; matched?: { rule: string }[] } | null | undefined): boolean {
  if (!verdict) return false;
  if (verdict.riskLevel !== "high") return false;
  const hasAllergyMatch = (verdict.matched ?? []).some((m) => m.rule === "allergy_match");
  return hasAllergyMatch;
}

/**
 * Phase 10J: Post-process follow-up questions based on verdict and user intent.
 * - High allergen verdict → replace with 1–2 evidence/label questions
 * - No glucose intent → remove carb/nutrition follow-ups
 * - Glucose intent present → leave follow-ups untouched
 */
export function postProcessFollowUps(args: {
  rawText: string;
  events: unknown[];
  followUpQuestions: string[];
  verdict?: { riskLevel?: string; matched?: { rule: string; details?: Record<string, unknown> }[]; meta?: { matchedChild?: string; matchedCategory?: string; crossReactive?: boolean } } | null;
}): { followUpQuestions: string[]; warnings?: string[] } {
  const { rawText, followUpQuestions, verdict } = args;
  const warnings: string[] = [];

  const highAllergen = hasHighAllergenVerdict(verdict);
  const glucoseIntent = hasGlucoseIntent(rawText);

  if (highAllergen && verdict) {
    // Safety-first: evidence/label questions, no carbs
    const meta = verdict.meta ?? {};
    const matchedChild = meta.matchedChild ?? meta.matchedCategory ?? "the listed allergens";
    return {
      followUpQuestions: [
        `Does this contain any of the following: ${matchedChild}? (Yes/No/Not sure)`,
        "If you have the label, can you confirm the ingredient list or upload a photo?",
      ],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Phase 10J.2: medium cross-reactive, empty follow-ups → evidence-seeking (no nagging)
  if (
    verdict?.riskLevel === "medium" &&
    verdict?.meta?.crossReactive === true &&
    followUpQuestions.length === 0
  ) {
    const hasSymptomCue = SYMPTOM_CUE_REGEX.test(rawText ?? "");
    const hasCarbOrGlucoseCue = CARB_GLUCOSE_CUE_REGEX.test(rawText ?? "");
    if (hasSymptomCue) {
      return {
        followUpQuestions: ["Any symptoms after that (itching, hives, throat tightness)?"],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
    if (hasCarbOrGlucoseCue) {
      return {
        followUpQuestions: ["How many grams of carbohydrates was that (approx.)?"],
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
    return {
      followUpQuestions: [],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  if (!glucoseIntent) {
    // No glucose intent → strip carb/nutrition follow-ups
    const filtered = followUpQuestions.filter((q) => !CARB_FOLLOWUP_REGEX.test(q));
    return {
      followUpQuestions: filtered,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Glucose intent present but extraction emitted zero follow-ups → add carb question
  if (glucoseIntent && followUpQuestions.length === 0) {
    return {
      followUpQuestions: ["How many grams of carbohydrates was that (approx.)?"],
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  // Glucose intent present with existing follow-ups → leave untouched
  return {
    followUpQuestions,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
