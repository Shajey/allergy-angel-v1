/**
 * Phase 17 – Supplement ↔ Medication Interactions
 *
 * Deterministic map of known supplement-medication interactions.
 * Risk levels: "high" (contraindicated), "medium" (caution/monitor)
 */

export interface SupplementInteraction {
  interactsWith: string[];
  risk: "medium" | "high";
  reason: string;
}

export const SUPPLEMENT_INTERACTION_MAP: Record<string, SupplementInteraction> = {
  "fish oil": {
    interactsWith: [
      "warfarin",
      "eliquis",
      "apixaban",
      "aspirin",
      "plavix",
      "clopidogrel",
      "coumadin",
    ],
    risk: "medium",
    reason: "May increase bleeding risk when combined with blood thinners",
  },
  "omega-3": {
    interactsWith: [
      "warfarin",
      "eliquis",
      "apixaban",
      "aspirin",
      "plavix",
      "clopidogrel",
      "coumadin",
    ],
    risk: "medium",
    reason: "May increase bleeding risk when combined with blood thinners",
  },
  "omega 3": {
    interactsWith: [
      "warfarin",
      "eliquis",
      "apixaban",
      "aspirin",
      "plavix",
      "clopidogrel",
      "coumadin",
    ],
    risk: "medium",
    reason: "May increase bleeding risk when combined with blood thinners",
  },
  "st john's wort": {
    interactsWith: [
      "sertraline",
      "prozac",
      "fluoxetine",
      "lexapro",
      "escitalopram",
      "zoloft",
      "celexa",
      "citalopram",
      "paxil",
      "paroxetine",
      "birth control",
      "oral contraceptive",
      "cyclosporine",
      "warfarin",
      "digoxin",
    ],
    risk: "high",
    reason:
      "Can significantly reduce medication effectiveness and increase serotonin syndrome risk with antidepressants",
  },
  "st johns wort": {
    interactsWith: [
      "sertraline",
      "prozac",
      "fluoxetine",
      "lexapro",
      "escitalopram",
      "zoloft",
      "celexa",
      "citalopram",
      "paxil",
      "paroxetine",
      "birth control",
      "oral contraceptive",
      "cyclosporine",
      "warfarin",
      "digoxin",
    ],
    risk: "high",
    reason:
      "Can significantly reduce medication effectiveness and increase serotonin syndrome risk with antidepressants",
  },
  ginkgo: {
    interactsWith: ["warfarin", "aspirin", "ibuprofen", "naproxen", "eliquis", "plavix"],
    risk: "medium",
    reason: "May increase bleeding risk with blood thinners and NSAIDs",
  },
  "ginkgo biloba": {
    interactsWith: ["warfarin", "aspirin", "ibuprofen", "naproxen", "eliquis", "plavix"],
    risk: "medium",
    reason: "May increase bleeding risk with blood thinners and NSAIDs",
  },
  "vitamin k": {
    interactsWith: ["warfarin", "coumadin"],
    risk: "high",
    reason: "Directly counteracts warfarin; can make blood thinner ineffective",
  },
  grapefruit: {
    interactsWith: [
      "atorvastatin",
      "lipitor",
      "simvastatin",
      "zocor",
      "lovastatin",
      "amlodipine",
      "norvasc",
      "felodipine",
      "nifedipine",
      "cyclosporine",
      "buspirone",
      "sertraline",
    ],
    risk: "medium",
    reason: "Can increase drug levels in blood, potentially causing side effects",
  },
  turmeric: {
    interactsWith: ["warfarin", "eliquis", "aspirin", "plavix", "clopidogrel"],
    risk: "medium",
    reason: "May increase bleeding risk when combined with blood thinners",
  },
  curcumin: {
    interactsWith: ["warfarin", "eliquis", "aspirin", "plavix", "clopidogrel"],
    risk: "medium",
    reason: "May increase bleeding risk when combined with blood thinners",
  },
  magnesium: {
    interactsWith: [
      "ciprofloxacin",
      "cipro",
      "levothyroxine",
      "synthroid",
      "bisphosphonates",
      "fosamax",
      "alendronate",
    ],
    risk: "medium",
    reason: "Can reduce absorption of these medications; take 2+ hours apart",
  },
  calcium: {
    interactsWith: [
      "levothyroxine",
      "synthroid",
      "ciprofloxacin",
      "cipro",
      "tetracycline",
      "bisphosphonates",
      "fosamax",
    ],
    risk: "medium",
    reason: "Can reduce absorption of these medications; take 2+ hours apart",
  },
  iron: {
    interactsWith: [
      "levothyroxine",
      "synthroid",
      "omeprazole",
      "prilosec",
      "ciprofloxacin",
      "tetracycline",
      "levodopa",
    ],
    risk: "medium",
    reason: "Can reduce absorption; take at different times of day",
  },
  coq10: {
    interactsWith: ["warfarin", "coumadin"],
    risk: "medium",
    reason: "May reduce warfarin effectiveness; monitor INR closely",
  },
  "vitamin e": {
    interactsWith: ["warfarin", "aspirin", "plavix", "clopidogrel", "eliquis"],
    risk: "medium",
    reason: "High doses may increase bleeding risk with blood thinners",
  },
  kava: {
    interactsWith: [
      "alprazolam",
      "xanax",
      "lorazepam",
      "ativan",
      "diazepam",
      "valium",
      "alcohol",
      "levodopa",
    ],
    risk: "high",
    reason: "Can cause excessive sedation and potential liver toxicity",
  },
  valerian: {
    interactsWith: [
      "alprazolam",
      "xanax",
      "lorazepam",
      "ativan",
      "diazepam",
      "valium",
      "zolpidem",
      "ambien",
    ],
    risk: "medium",
    reason: "May increase sedative effects; avoid combining with sleep medications",
  },
  ginseng: {
    interactsWith: ["warfarin", "insulin", "metformin", "glipizide", "maois", "phenelzine"],
    risk: "medium",
    reason: "May affect blood clotting and blood sugar levels",
  },
  "green tea extract": {
    interactsWith: ["warfarin", "nadolol", "atenolol"],
    risk: "medium",
    reason:
      "High doses may reduce warfarin effectiveness and affect blood pressure medications",
  },
  "garlic supplement": {
    interactsWith: ["warfarin", "aspirin", "plavix", "clopidogrel", "eliquis"],
    risk: "medium",
    reason: "May increase bleeding risk in high doses with blood thinners",
  },
  "garlic supplements": {
    interactsWith: ["warfarin", "aspirin", "plavix", "clopidogrel", "eliquis"],
    risk: "medium",
    reason: "May increase bleeding risk in high doses with blood thinners",
  },

  // Phase 21a: Canonical keys for entity resolution
  "omega-3-fatty-acid": {
    interactsWith: [
      "warfarin",
      "eliquis",
      "apixaban",
      "aspirin",
      "plavix",
      "clopidogrel",
      "coumadin",
    ],
    risk: "medium",
    reason: "May increase bleeding risk when combined with blood thinners",
  },
  "st-johns-wort": {
    interactsWith: [
      "sertraline",
      "prozac",
      "fluoxetine",
      "lexapro",
      "escitalopram",
      "zoloft",
      "celexa",
      "citalopram",
      "paxil",
      "paroxetine",
      "birth control",
      "oral contraceptive",
      "cyclosporine",
      "warfarin",
      "digoxin",
    ],
    risk: "high",
    reason:
      "Can significantly reduce medication effectiveness and increase serotonin syndrome risk with antidepressants",
  },
  "ginkgo-biloba": {
    interactsWith: ["warfarin", "aspirin", "ibuprofen", "naproxen", "eliquis", "plavix"],
    risk: "medium",
    reason: "May increase bleeding risk with blood thinners and NSAIDs",
  },
  "vitamin-k": {
    interactsWith: ["warfarin", "coumadin"],
    risk: "high",
    reason: "Directly counteracts warfarin; can make blood thinner ineffective",
  },
  "vitamin-e": {
    interactsWith: ["warfarin", "aspirin", "plavix", "clopidogrel", "eliquis"],
    risk: "medium",
    reason: "High doses may increase bleeding risk with blood thinners",
  },
  "green-tea-extract": {
    interactsWith: ["warfarin", "nadolol", "atenolol"],
    risk: "medium",
    reason:
      "High doses may reduce warfarin effectiveness and affect blood pressure medications",
  },
};

export const SUPPLEMENT_INTERACTION_VERSION = "17.1";

/**
 * Normalize supplement name for lookup.
 * Lowercase, trim, normalize apostrophes.
 */
export function normalizeSupplementName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ");
}

/**
 * Normalize medication name for matching.
 * Lowercase, trim, remove dosage info in parens.
 */
export function normalizeMedicationName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s*\([^)]*\)/g, "") // Remove "(10mg)" etc.
    .replace(/\s+/g, " ")
    .trim();
}
