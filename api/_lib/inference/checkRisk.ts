/**
 * Phase 9B – Deterministic Risk Interpretation
 *
 * Evaluates extracted health events against a user's profile to produce
 * a simple, auditable risk verdict.  This is purely rules-based — no LLM
 * calls, no probabilistic inference.  Every verdict is reproducible given
 * the same inputs.
 *
 * Rules:
 *   A) HIGH  – A meal event mentions a term found in known_allergies
 *              (Phase 10H: taxonomy expansion — parent categories expand
 *              to children, e.g., tree_nut → pistachio, cashew).
 *   B) MEDIUM – A medication event conflicts with a current medication
 *              (checked against a small hardcoded interaction map).
 *   C) NONE  – No rules triggered.
 *
 * The highest-severity match wins (high > medium > none).
 */

import {
  expandAllergies,
  isAllergenMatch,
  getParentKeyForTerm,
  getAllergenSeverity,
  resolveCategoryForSeverity,
  getCrossReactiveMatch,
  ALLERGEN_TAXONOMY_VERSION,
  type AllergenParentKey,
} from "./allergenTaxonomy.js";

// ── Types ────────────────────────────────────────────────────────────

interface ProfileInput {
  known_allergies: string[];
  current_medications: { name: string; dosage?: string }[];
}

interface RuleMatch {
  rule: string;
  details: Record<string, unknown>;
}

/** Phase 10H++: meta persisted in checks.verdict JSONB for allergen matches. Phase 10J: crossReactive. */
export interface VerdictMeta {
  taxonomyVersion: string;
  matchedCategory?: string;
  matchedChild?: string;
  severity: number;
  /** Phase 10J: true when verdict is cross-reactive (medium), not direct taxonomy match */
  crossReactive?: boolean;
  /** Phase 10J: source allergy category for cross-reactive match */
  source?: string;
  /** Phase 10J: matched cross-reactive term */
  matchedTerm?: string;
}

export interface Verdict {
  riskLevel: "none" | "medium" | "high";
  reasoning: string;
  matched?: RuleMatch[];
  /** Phase 10H++: allergen match meta (severity, taxonomyVersion) — persisted in checks.verdict */
  meta?: VerdictMeta;
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

  const expandedAllergies = expandAllergies(profile.known_allergies);
  let bestAllergyMeta: VerdictMeta | undefined;

  for (const event of events) {
    // ── Rule A: Allergy match (HIGH) ─────────────────────────────
    // Phase 10H: taxonomy expansion — parent keys expand to children
    // Phase 10H++: severity + taxonomyVersion in meta (persisted in checks.verdict)
    if (event.type === "meal") {
      const mealText: string = event.fields?.meal ?? "";
      if (mealText) {
        const { matched: isMatch, matchedTerm } = isAllergenMatch(
          mealText,
          expandedAllergies
        );
        if (isMatch && matchedTerm) {
          highestRisk = "high";
          const parentKey = getParentKeyForTerm(matchedTerm);
          const matchedCategory = resolveCategoryForSeverity(matchedTerm);
          const severity = getAllergenSeverity(matchedCategory);
          const meta: VerdictMeta = {
            taxonomyVersion: ALLERGEN_TAXONOMY_VERSION,
            matchedCategory,
            matchedChild: matchedTerm,
            severity,
            crossReactive: false,
          };
          if (
            !bestAllergyMeta ||
            severity > (bestAllergyMeta.severity ?? 0)
          ) {
            bestAllergyMeta = meta;
          }
          matched.push({
            rule: "allergy_match",
            details: {
              meal: mealText,
              allergen: matchedTerm,
              parentKey: parentKey ?? undefined,
              matchedCategory,
              severity,
            },
          });
        } else {
          // ── Phase 10J: Cross-reactive check (MEDIUM) ─────────────
          // Only when no direct taxonomy match. Do NOT override High.
          const crossMatch = getCrossReactiveMatch(
            profile.known_allergies,
            mealText
          );
          if (crossMatch && highestRisk !== "high") {
            highestRisk = "medium";
            const baseSeverity = getAllergenSeverity(crossMatch.source);
            const severity = baseSeverity + crossMatch.modifier;
            const meta: VerdictMeta = {
              taxonomyVersion: ALLERGEN_TAXONOMY_VERSION,
              severity,
              crossReactive: true,
              source: crossMatch.source,
              matchedTerm: crossMatch.matchedTerm,
            };
            if (
              !bestAllergyMeta ||
              severity > (bestAllergyMeta.severity ?? 0)
            ) {
              bestAllergyMeta = meta;
            }
            matched.push({
              rule: "cross_reactive",
              details: {
                meal: mealText,
                source: crossMatch.source,
                matchedTerm: crossMatch.matchedTerm,
                severity,
              },
            });
          }
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
      const parentKey = m.details.parentKey as AllergenParentKey | undefined;
      const severity = (m.details.severity as number) ?? 50;
      const wasExpanded =
        parentKey &&
        profile.known_allergies.some(
          (a) => a.toLowerCase().trim() === parentKey
        );
      if (wasExpanded && parentKey) {
        return `Meal "${m.details.meal}" matches ${parentKey} allergy via child token "${m.details.allergen}" (severity ${severity}/100).`;
      }
      return `Meal "${m.details.meal}" matches known allergen "${m.details.allergen}" (severity ${severity}/100).`;
    }
    if (m.rule === "cross_reactive") {
      return `"${m.details.matchedTerm}" is associated with ${m.details.source} allergies (cross-reactive).`;
    }
    if (m.rule === "medication_interaction") {
      return `${m.details.extracted} may interact with current medication ${m.details.conflictsWith}`;
    }
    return JSON.stringify(m);
  });

  // Ensure exactly one trailing period (parts may already end with period)
  const reasoning = parts.join("; ").replace(/\.+$/, "") + ".";

  return {
    riskLevel: highestRisk,
    reasoning,
    matched,
    ...(bestAllergyMeta ? { meta: bestAllergyMeta } : {}),
  };
}
