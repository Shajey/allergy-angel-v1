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
 * Rule C (Medication misclassification fix):
 *   If a meal event's meal field contains only known medication names (e.g. "Tylenol with ibuprofen"),
 *   replace that meal with separate medication events.
 *
 * Rule D (Supplement misclassification fix):
 *   If a meal event's meal field contains only known supplement names (e.g. "fish oil", "vitamin D with calcium"),
 *   replace that meal with separate supplement events.
 *
 * Deterministic. No prompt/schema changes.
 */

import { parseMedicationNames, parseSupplementNames } from "../extractFromTextHeuristic.js";

/** Regex: carb cue in rawText (carb, carbs, or N g/gram/grams). */
const CARB_CUE_REGEX = /(carb|carbs|\b\d+(\.\d+)?\s*(g|gram|grams)\b)/i;

/** Regex: follow-up that asks for carbs (to remove when carbs already captured). */
const CARB_FOLLOWUP_REGEX = /(carb|carbohydrate)/i;

export interface ExtractionResult {
  events: { type?: string; fields?: Record<string, unknown>; needsClarification?: boolean; [k: string]: unknown }[];
  followUpQuestions?: string[];
  warnings?: string[];
}

/**
 * Mutates result in place.
 * Rule A: meal events with non-empty meal name get needsClarification=false.
 * Rule B: when hasCarbCue && anyCarbsCaptured, remove carb follow-ups.
 * Rule C: meal events whose meal field is only medication names → replace with medication events.
 */
export function postProcessExtractionResult(
  rawText: string,
  result: ExtractionResult
): void {
  if (!result.events || !Array.isArray(result.events)) return;

  // ── Rule C: Meal→medication reclassification (before Rule A) ─────────
  const newEvents: typeof result.events = [];
  for (const event of result.events) {
    if (event.type === "meal") {
      const mealName = event.fields?.meal;
      if (typeof mealName === "string" && mealName.trim().length > 0) {
        let { names, isOnlyMedications } = parseMedicationNames(mealName);
        // Fallback: if meal field doesn't parse, check rawText (e.g. "Tylenol & Metformin")
        if (names.length === 0 && rawText?.trim()) {
          const rawParsed = parseMedicationNames(rawText.trim());
          if (rawParsed.isOnlyMedications && rawParsed.names.length > 0) {
            names = rawParsed.names;
            isOnlyMedications = true;
          }
        }
        if (isOnlyMedications && names.length > 0) {
          // Replace meal with separate medication events
          for (const med of names) {
            const capitalized = med.charAt(0).toUpperCase() + med.slice(1);
            newEvents.push({
              ...event,
              type: "medication",
              fields: { medication: capitalized, dosage: null, unit: null },
              needsClarification: true,
            });
          }
          continue;
        }
        // Rule D: meal→supplement reclassification
        let suppNames = parseSupplementNames(mealName).names;
        let suppOnly = parseSupplementNames(mealName).isOnlySupplements;
        if (suppNames.length === 0 && rawText?.trim()) {
          const rawParsed = parseSupplementNames(rawText.trim());
          if (rawParsed.isOnlySupplements && rawParsed.names.length > 0) {
            suppNames = rawParsed.names;
            suppOnly = true;
          }
        }
        if (suppOnly && suppNames.length > 0) {
          for (const supp of suppNames) {
            const displayName = supp.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
            newEvents.push({
              ...event,
              type: "supplement",
              fields: { supplement: displayName, dosage: null },
              needsClarification: true,
            });
          }
          continue;
        }
      }
    }
    newEvents.push(event);
  }
  result.events = newEvents;

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
