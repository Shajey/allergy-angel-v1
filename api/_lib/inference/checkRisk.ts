/**
 * Phase 9B – Deterministic Risk Interpretation
 *
 * Evaluates extracted health events against a user's profile to produce
 * a simple, auditable risk verdict.  This is purely rules-based — no LLM
 * calls, no probabilistic inference.  Every verdict is reproducible given
 * the same inputs.
 *
 * Rules:
 *   A) HIGH  – A meal event mentions a term found in known_allergies.
 *   B) MEDIUM – A medication event conflicts with a current medication
 *              (checked against a small hardcoded interaction map).
 *   C) NONE  – No rules triggered.
 *
 * The highest-severity match wins (high > medium > none).
 */

// ── Types ────────────────────────────────────────────────────────────

interface ProfileInput {
  known_allergies: string[];
  current_medications: { name: string; dosage?: string }[];
}

interface RuleMatch {
  rule: string;
  details: Record<string, unknown>;
}

export interface Verdict {
  riskLevel: "none" | "medium" | "high";
  reasoning: string;
  matched?: RuleMatch[];
}

// ── Hardcoded medication interaction map ─────────────────────────────
// Each key is a lowercase medication name; value is a set of medications
// that interact with it.  Interactions are bidirectional — if A interacts
// with B then B interacts with A.

const INTERACTION_MAP: Record<string, string[]> = {
  ibuprofen: ["aspirin", "warfarin", "naproxen"],
  aspirin: ["ibuprofen", "warfarin"],
  warfarin: ["ibuprofen", "aspirin"],
  naproxen: ["ibuprofen"],
};

// ── Helpers ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function stripTrailingS(s: string): string {
  return s.endsWith("s") ? s.slice(0, -1) : s;
}

/**
 * Check whether a meal description contains any allergy term.
 * Uses simple substring matching (case-insensitive) with basic plural
 * normalization so "peanuts" in the profile matches "peanut butter sandwich".
 */
function mealContainsAllergen(mealText: string, allergies: string[]): string | null {
  const meal = normalize(mealText);
  for (const allergy of allergies) {
    const term = normalize(allergy);
    // Check both "peanuts" and "peanut"
    if (meal.includes(term) || meal.includes(stripTrailingS(term))) {
      return allergy;
    }
  }
  return null;
}

/**
 * Check whether an extracted medication conflicts with any current medication.
 */
function medicationInteracts(
  extractedMed: string,
  currentMeds: { name: string }[]
): { extracted: string; conflictsWith: string } | null {
  const extracted = normalize(extractedMed);
  const interactions = INTERACTION_MAP[extracted];
  if (!interactions) return null;

  for (const current of currentMeds) {
    const currentName = normalize(current.name);
    if (interactions.includes(currentName)) {
      return { extracted: extractedMed, conflictsWith: current.name };
    }
  }
  return null;
}

// ── Main ─────────────────────────────────────────────────────────────

export function checkRisk(args: {
  profile: ProfileInput;
  events: any[];
}): Verdict {
  const { profile, events } = args;
  const matched: RuleMatch[] = [];

  let highestRisk: "none" | "medium" | "high" = "none";

  for (const event of events) {
    // ── Rule A: Allergy match (HIGH) ─────────────────────────────
    if (event.type === "meal") {
      const mealText: string = event.fields?.meal ?? "";
      if (mealText) {
        const allergen = mealContainsAllergen(mealText, profile.known_allergies);
        if (allergen) {
          highestRisk = "high";
          matched.push({
            rule: "allergy_match",
            details: { meal: mealText, allergen },
          });
        }
      }
    }

    // ── Rule B: Medication interaction (MEDIUM) ──────────────────
    if (event.type === "medication") {
      const medName: string = event.fields?.medication ?? "";
      if (medName) {
        const conflict = medicationInteracts(medName, profile.current_medications);
        if (conflict) {
          if (highestRisk !== "high") highestRisk = "medium";
          matched.push({
            rule: "medication_interaction",
            details: conflict,
          });
        }
      }
    }
  }

  // ── Build reasoning string ───────────────────────────────────────
  if (matched.length === 0) {
    return { riskLevel: "none", reasoning: "No known risks detected." };
  }

  const parts = matched.map((m) => {
    if (m.rule === "allergy_match") {
      return `Meal "${m.details.meal}" contains known allergen "${m.details.allergen}"`;
    }
    if (m.rule === "medication_interaction") {
      return `${m.details.extracted} may interact with current medication ${m.details.conflictsWith}`;
    }
    return JSON.stringify(m);
  });

  return {
    riskLevel: highestRisk,
    reasoning: parts.join("; ") + ".",
    matched,
  };
}
