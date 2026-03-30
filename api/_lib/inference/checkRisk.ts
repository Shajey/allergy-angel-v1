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
 *   C) Phase 17 – Supplement event interacts with profile medications.
 *   D) Phase 17 – Meal event contains food that interacts with profile medications.
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
  getDishAllergenMatch,
  ALLERGEN_TAXONOMY_VERSION,
  type AllergenParentKey,
} from "./allergenTaxonomy.js";
import {
  RULE_ALLERGEN_MATCH,
  RULE_DISH_ALLERGEN,
  RULE_CROSS_REACTIVE,
  RULE_MED_INTERACTION,
  RULE_SUPPLEMENT_MED_INTERACTION,
  RULE_FOOD_MED_INTERACTION,
  RULE_ENTITY_RISK_TAG,
} from "./ruleCodes.js";
import { matchEntityRiskTagsToProfile } from "./entityRiskTagMatch.js";
import {
  SUPPLEMENT_INTERACTION_MAP,
  normalizeSupplementName,
  normalizeMedicationName,
} from "./supplementInteractions.js";
import { resolveEntity, resolveMealText } from "../knowledge/entityResolver.js";

// ── Types ────────────────────────────────────────────────────────────

interface ProfileInput {
  known_allergies: string[];
  current_medications: { name: string; dosage?: string }[];
}

interface RuleMatch {
  rule: string;
  ruleCode: string;
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
  /** Phase 13.4: deterministic trace identifier = checkId:taxonomyVersion */
  traceId?: string;
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

// ── Phase 17: Food ↔ medication interaction keywords ─────────────────
const FOOD_MEDICATION_KEYWORDS: Record<
  string,
  { meds: string[]; risk: "medium" | "high"; reason: string }
> = {
  grapefruit: {
    meds: [
      "atorvastatin",
      "lipitor",
      "simvastatin",
      "zocor",
      "amlodipine",
      "norvasc",
    ],
    risk: "medium",
    reason: "Grapefruit can increase drug levels, potentially causing side effects",
  },
  spinach: {
    meds: ["warfarin", "coumadin"],
    risk: "medium",
    reason:
      "High vitamin K content may reduce warfarin effectiveness; maintain consistent intake",
  },
  kale: {
    meds: ["warfarin", "coumadin"],
    risk: "medium",
    reason:
      "High vitamin K content may reduce warfarin effectiveness; maintain consistent intake",
  },
  broccoli: {
    meds: ["warfarin", "coumadin"],
    risk: "medium",
    reason: "Vitamin K content may affect warfarin; maintain consistent intake",
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

/** Phase 21a: Resolve medication to canonical for lookup. Strips dosage in parens. */
function resolveMedicationToCanonical(name: string): string {
  const cleaned = normalizeMedicationName(name); // Strips (5mg) etc.
  const resolved = resolveEntity(cleaned);
  return resolved.resolved ? resolved.canonical : cleaned;
}

/**
 * Check whether an extracted medication conflicts with any current medication.
 * Phase 21a: Uses canonical forms for matching.
 */
function medicationInteracts(
  extractedMed: string,
  currentMeds: { name: string }[]
): { extracted: string; conflictsWith: string } | null {
  const extractedCanonical = resolveMedicationToCanonical(extractedMed);
  const interactions = INTERACTION_MAP[extractedCanonical];
  if (!interactions) return null;

  for (const current of currentMeds) {
    const currentCanonical = resolveMedicationToCanonical(current.name);
    if (interactions.includes(currentCanonical)) {
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
        // Phase 21a: Resolve meal text aliases (e.g. groundnut → peanut)
        const resolvedMealText = resolveMealText(mealText);
        const { matched: isMatch, matchedTerm } = isAllergenMatch(
          resolvedMealText,
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
            ruleCode: RULE_ALLERGEN_MATCH,
            details: {
              meal: mealText,
              allergen: matchedTerm,
              parentKey: parentKey ?? undefined,
              matchedCategory,
              severity,
            },
          });
        } else {
          // ── O8: Promoted entity risk tags vs profile (HIGH) ───────────
          const entityRiskMatch = matchEntityRiskTagsToProfile({
            mealText,
            resolvedMealText,
            knownAllergies: profile.known_allergies,
          });
          if (entityRiskMatch) {
            highestRisk = "high";
            const severity = getAllergenSeverity(entityRiskMatch.matchedTag);
            const meta: VerdictMeta = {
              taxonomyVersion: ALLERGEN_TAXONOMY_VERSION,
              matchedCategory: entityRiskMatch.matchedTag,
              matchedChild: entityRiskMatch.entityId,
              severity,
              crossReactive: false,
            };
            if (!bestAllergyMeta || severity > (bestAllergyMeta.severity ?? 0)) {
              bestAllergyMeta = meta;
            }
            matched.push({
              rule: "entity_risk_tag_match",
              ruleCode: RULE_ENTITY_RISK_TAG,
              details: {
                meal: mealText,
                entityId: entityRiskMatch.entityId,
                matchedTag: entityRiskMatch.matchedTag,
                riskTags: entityRiskMatch.riskTags,
                severity,
              },
            });
          }

          // ── Phase 18.1.1: Dish commonly contains allergen (HIGH) ─
          // e.g. pad thai → peanut. Ask for confirmation.
          const dishMatch = getDishAllergenMatch(resolvedMealText, profile.known_allergies);
          if (dishMatch && highestRisk !== "high") {
            highestRisk = "high";
            const matchedCategory = resolveCategoryForSeverity(dishMatch.allergen);
            const severity = getAllergenSeverity(matchedCategory);
            const meta: VerdictMeta = {
              taxonomyVersion: ALLERGEN_TAXONOMY_VERSION,
              matchedCategory,
              matchedChild: dishMatch.allergen,
              severity,
              crossReactive: false,
            };
            if (!bestAllergyMeta || severity > (bestAllergyMeta.severity ?? 0)) {
              bestAllergyMeta = meta;
            }
            matched.push({
              rule: "dish_allergen",
              ruleCode: RULE_DISH_ALLERGEN,
              details: {
                meal: mealText,
                allergen: dishMatch.allergen,
                matchedDish: dishMatch.matchedDish,
                matchedCategory,
                severity,
              },
            });
          } else if (!dishMatch) {
            // ── Phase 10J: Cross-reactive check (MEDIUM) ─────────────
            // Only when no direct taxonomy match. Do NOT override High.
            const crossMatch = getCrossReactiveMatch(
              profile.known_allergies,
              resolvedMealText
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
                ruleCode: RULE_CROSS_REACTIVE,
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

        // ── Rule D: Food → medication interaction (Phase 17) ─────────
        const mealLower = resolvedMealText.toLowerCase();
        for (const [food, interaction] of Object.entries(FOOD_MEDICATION_KEYWORDS)) {
          if (mealLower.includes(food)) {
            for (const profileMed of profile.current_medications) {
              const medCanonical = resolveMedicationToCanonical(profileMed.name);
              if (interaction.meds.includes(medCanonical)) {
                matched.push({
                  rule: "food_medication_interaction",
                  ruleCode: RULE_FOOD_MED_INTERACTION,
                  details: {
                    food,
                    medication: profileMed.name,
                    risk: interaction.risk,
                    reason: interaction.reason,
                  },
                });
                if (
                  interaction.risk === "high" &&
                  highestRisk !== "high"
                ) {
                  highestRisk = "high";
                } else if (
                  interaction.risk === "medium" &&
                  highestRisk === "none"
                ) {
                  highestRisk = "medium";
                }
              }
            }
          }
        }
      }
    }

    // ── Rule B: Medication interaction (MEDIUM) ──────────────────
    if (event.type === "medication") {
      const medName: string = event.fields?.medication ?? "";
      if (medName) {
        // Phase 21a: medicationInteracts uses canonical resolution internally
        const conflict = medicationInteracts(medName, profile.current_medications);
        if (conflict) {
          if (highestRisk !== "high") highestRisk = "medium";
          matched.push({
            rule: "medication_interaction",
            ruleCode: RULE_MED_INTERACTION,
            details: conflict,
          });
        }
      }
    }

    // ── Rule C: Supplement → medication interaction (Phase 17) ───────
    if (event.type === "supplement") {
      // Phase 21a: Use resolution.canonical if available, else resolve or normalize
      const rawSupplement =
        (event.fields?.supplement ?? event.fields?.name ?? "") as string;
      if (!rawSupplement) continue;

      let supplementCanonical: string;
      if (event.resolution?.resolved && event.resolution?.type === "supplement") {
        supplementCanonical = event.resolution.canonical;
      } else {
        const resolved = resolveEntity(rawSupplement);
        supplementCanonical = resolved.resolved
          ? resolved.canonical
          : normalizeSupplementName(rawSupplement);
      }
      const interaction = SUPPLEMENT_INTERACTION_MAP[supplementCanonical];
      if (interaction && profile.current_medications.length > 0) {
        for (const profileMed of profile.current_medications) {
          const medCanonical = resolveMedicationToCanonical(profileMed.name);
          if (interaction.interactsWith.includes(medCanonical)) {
            matched.push({
              rule: "supplement_medication_interaction",
              ruleCode: RULE_SUPPLEMENT_MED_INTERACTION,
              details: {
                supplement: rawSupplement,
                medication: profileMed.name,
                risk: interaction.risk,
                reason: interaction.reason,
              },
            });
            if (interaction.risk === "high" && highestRisk !== "high") {
              highestRisk = "high";
            } else if (interaction.risk === "medium" && highestRisk === "none") {
              highestRisk = "medium";
            }
          }
        }
      }
    }
  }

  // ── Build reasoning string ───────────────────────────────────────
  if (matched.length === 0) {
    return {
      riskLevel: "none",
      reasoning: "No known risks detected.",
      matched: [],
      meta: { taxonomyVersion: ALLERGEN_TAXONOMY_VERSION, severity: 0 },
    };
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
    if (m.rule === "dish_allergen") {
      return `"${m.details.matchedDish}" commonly contains ${m.details.allergen} (severity ${m.details.severity ?? 50}/100).`;
    }
    if (m.rule === "cross_reactive") {
      return `"${m.details.matchedTerm}" is associated with ${m.details.source} allergies (cross-reactive).`;
    }
    if (m.rule === "medication_interaction") {
      return `${m.details.extracted} may interact with current medication ${m.details.conflictsWith}`;
    }
    if (m.rule === "supplement_medication_interaction") {
      return (m.details.reason as string) ?? `${m.details.supplement} may interact with ${m.details.medication}`;
    }
    if (m.rule === "food_medication_interaction") {
      return (m.details.reason as string) ?? `${m.details.food} may interact with ${m.details.medication}`;
    }
    if (m.rule === "entity_risk_tag_match") {
      const sev = (m.details.severity as number) ?? 50;
      return `Meal "${m.details.meal}" mentions registry entity "${m.details.entityId}" with risk tag "${m.details.matchedTag}" that matches your profile (severity ${sev}/100).`;
    }
    return JSON.stringify(m);
  });

  // Ensure exactly one trailing period (parts may already end with period)
  const reasoning = parts.join("; ").replace(/\.+$/, "") + ".";

  const meta: VerdictMeta = bestAllergyMeta ?? {
    taxonomyVersion: ALLERGEN_TAXONOMY_VERSION,
    severity: 0,
  };

  return {
    riskLevel: highestRisk,
    reasoning,
    matched,
    meta,
  };
}
