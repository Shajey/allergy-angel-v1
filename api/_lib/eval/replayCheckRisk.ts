/**
 * Phase 12.2 – Replay Check Risk
 *
 * Runs checkRisk logic with injected LoadedTaxonomy for replay validation.
 * Eval-only; production uses checkRisk from inference. No DB, no LLM.
 */

import type { LoadedTaxonomy } from "../knowledge/loadAllergenTaxonomy.js";
import type { Verdict } from "../inference/checkRisk.js";
import {
  RULE_ALLERGEN_MATCH,
  RULE_CROSS_REACTIVE,
  RULE_MED_INTERACTION,
} from "../inference/ruleCodes.js";

interface ProfileInput {
  known_allergies: string[];
  current_medications: { name: string; dosage?: string }[];
}

const INTERACTION_MAP: Record<string, string[]> = {
  ibuprofen: ["aspirin", "warfarin", "naproxen"],
  aspirin: ["ibuprofen", "warfarin"],
  warfarin: ["ibuprofen", "aspirin"],
  naproxen: ["ibuprofen"],
};

function normalize(s: string): string {
  return s.toLowerCase().trim();
}

function normalizeToken(s: string): string {
  let t = s.toLowerCase().trim();
  t = t.replace(/\s+/g, " ");
  t = t.replace(/^['"(\[\{]+|['")\]\}]+$/g, "").trim();
  return t;
}

function stripPunctuation(s: string): string {
  return s.replace(/[^\w\s]/g, " ");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildTermRegex(term: string): RegExp {
  const escaped = escapeRegex(term);
  const plural = term.endsWith("s") ? term.slice(0, -1) : term + "s";
  const escapedPlural = escapeRegex(plural);
  return new RegExp(`\\b(${escaped}|${escapedPlural})\\b`, "i");
}

function normalizePlural(s: string): string {
  const trimmed = s.toLowerCase().trim();
  if (trimmed.endsWith("s") && trimmed.length > 1) return trimmed.slice(0, -1);
  return trimmed;
}

function expandAllergiesWithTaxonomy(
  profileAllergies: string[],
  taxonomy: LoadedTaxonomy["taxonomy"]
): Set<string> {
  const expanded = new Set<string>();
  for (const allergy of profileAllergies) {
    const key = normalizeToken(allergy);
    if (key in taxonomy) {
      const entry = taxonomy[key];
      for (const child of entry.children) {
        expanded.add(child);
      }
    } else {
      expanded.add(normalizePlural(key));
    }
  }
  return expanded;
}

function isAllergenMatchWithSet(
  mealText: string,
  expandedAllergies: Set<string>
): { matched: boolean; matchedTerm?: string } {
  const normalized = stripPunctuation(normalizeToken(mealText));
  if (!normalized) return { matched: false };
  const sorted = [...expandedAllergies].sort((a, b) => b.length - a.length);
  for (const term of sorted) {
    if (buildTermRegex(term).test(normalized)) {
      return { matched: true, matchedTerm: term };
    }
  }
  return { matched: false };
}

function getParentKeyForTermWithTaxonomy(
  term: string,
  taxonomy: LoadedTaxonomy["taxonomy"]
): string | null {
  const normalized = normalizeToken(term);
  for (const [key, entry] of Object.entries(taxonomy)) {
    if (entry.children.some((c) => normalizeToken(c) === normalized)) {
      return key;
    }
  }
  return null;
}

function getSeverityWithTaxonomy(
  categoryKey: string,
  severity: LoadedTaxonomy["severity"]
): number {
  const key = categoryKey.toLowerCase().trim();
  return severity[key] ?? 50;
}

function resolveCategoryWithTaxonomy(
  matchedTerm: string,
  taxonomy: LoadedTaxonomy["taxonomy"],
  severity: LoadedTaxonomy["severity"]
): string {
  const normalized = normalizeToken(matchedTerm);
  if (normalized in severity) return normalized;
  const parent = getParentKeyForTermWithTaxonomy(matchedTerm, taxonomy);
  if (parent) return parent;
  return normalized;
}

function getCrossReactiveMatchWithRegistry(
  userAllergies: string[],
  ingestibleName: string,
  crossReactive: LoadedTaxonomy["crossReactive"]
): { source: string; matchedTerm: string; modifier: number } | null {
  const normalizedIngestible = stripPunctuation(normalizeToken(ingestibleName));
  if (!normalizedIngestible) return null;
  const userAllergySet = new Set(
    userAllergies.map((a) => normalizeToken(a).replace(/\s+/g, "_"))
  );
  for (const rel of crossReactive) {
    const sourceNorm = rel.source.toLowerCase();
    const sourceMatches =
      userAllergySet.has(sourceNorm) ||
      userAllergySet.has(sourceNorm + "s") ||
      [...userAllergySet].some((u) => u.replace(/s$/, "") === sourceNorm);
    if (!sourceMatches) continue;
    const sorted = [...rel.related].sort((a, b) => b.length - a.length);
    for (const term of sorted) {
      if (buildTermRegex(term).test(normalizedIngestible)) {
        return {
          source: rel.source,
          matchedTerm: term,
          modifier: rel.riskModifier,
        };
      }
    }
  }
  return null;
}

function medicationInteracts(
  extractedMed: string,
  currentMeds: { name: string }[]
): { extracted: string; conflictsWith: string } | null {
  const extracted = normalize(extractedMed);
  const interactions = INTERACTION_MAP[extracted];
  if (!interactions) return null;
  for (const current of currentMeds) {
    if (interactions.includes(normalize(current.name))) {
      return { extracted: extractedMed, conflictsWith: current.name };
    }
  }
  return null;
}

/** Event shape: { type, fields? } or { type, event_data? } (replay normalizes event_data → fields) */
function getMealText(event: { type?: string; fields?: Record<string, unknown>; event_data?: Record<string, unknown> }): string {
  const fields = event.fields ?? event.event_data ?? {};
  return (fields.meal as string) ?? "";
}

function getMedicationName(event: { type?: string; fields?: Record<string, unknown>; event_data?: Record<string, unknown> }): string {
  const fields = event.fields ?? event.event_data ?? {};
  return (fields.medication as string) ?? "";
}

/**
 * Run check risk with injected taxonomy. Same logic as production checkRisk.
 */
export function checkRiskWithTaxonomy(
  profile: ProfileInput,
  events: Array<{ type?: string; fields?: Record<string, unknown>; event_data?: Record<string, unknown> }>,
  knowledge: LoadedTaxonomy
): Verdict {
  const { taxonomy, severity, crossReactive, version } = knowledge;
  const matched: { rule: string; ruleCode: string; details: Record<string, unknown> }[] = [];
  let highestRisk: "none" | "medium" | "high" = "none";
  let bestAllergyMeta: { taxonomyVersion: string; severity: number; matchedCategory?: string; matchedChild?: string; crossReactive?: boolean; source?: string; matchedTerm?: string } | undefined;

  const expandedAllergies = expandAllergiesWithTaxonomy(profile.known_allergies, taxonomy);

  for (const event of events) {
    if (event.type === "meal") {
      const mealText = getMealText(event);
      if (mealText) {
        const { matched: isMatch, matchedTerm } = isAllergenMatchWithSet(mealText, expandedAllergies);
        if (isMatch && matchedTerm) {
          highestRisk = "high";
          const parentKey = getParentKeyForTermWithTaxonomy(matchedTerm, taxonomy);
          const matchedCategory = resolveCategoryWithTaxonomy(matchedTerm, taxonomy, severity);
          const sev = getSeverityWithTaxonomy(matchedCategory, severity);
          const meta = {
            taxonomyVersion: version,
            matchedCategory,
            matchedChild: matchedTerm,
            severity: sev,
            crossReactive: false,
          };
          if (!bestAllergyMeta || sev > (bestAllergyMeta.severity ?? 0)) bestAllergyMeta = meta;
          matched.push({
            rule: "allergy_match",
            ruleCode: RULE_ALLERGEN_MATCH,
            details: { meal: mealText, allergen: matchedTerm, parentKey: parentKey ?? undefined, matchedCategory, severity: sev },
          });
        } else {
          const crossMatch = getCrossReactiveMatchWithRegistry(profile.known_allergies, mealText, crossReactive);
          if (crossMatch && highestRisk !== "high") {
            highestRisk = "medium";
            const baseSev = getSeverityWithTaxonomy(crossMatch.source, severity);
            const sev = baseSev + crossMatch.modifier;
            const meta = {
              taxonomyVersion: version,
              severity: sev,
              crossReactive: true,
              source: crossMatch.source,
              matchedTerm: crossMatch.matchedTerm,
            };
            if (!bestAllergyMeta || sev > (bestAllergyMeta.severity ?? 0)) bestAllergyMeta = meta;
            matched.push({
              rule: "cross_reactive",
              ruleCode: RULE_CROSS_REACTIVE,
              details: { meal: mealText, source: crossMatch.source, matchedTerm: crossMatch.matchedTerm, severity: sev },
            });
          }
        }
      }
    }
    if (event.type === "medication") {
      const medName = getMedicationName(event);
      if (medName) {
        const conflict = medicationInteracts(medName, profile.current_medications);
        if (conflict) {
          if (highestRisk !== "high") highestRisk = "medium";
          matched.push({ rule: "medication_interaction", ruleCode: RULE_MED_INTERACTION, details: conflict });
        }
      }
    }
  }

  if (matched.length === 0) {
    return {
      riskLevel: "none",
      reasoning: "No known risks detected.",
      matched: [],
      meta: { taxonomyVersion: version, severity: 0 },
    };
  }

  const parts = matched.map((m) => {
    if (m.rule === "allergy_match") {
      return `Meal "${m.details.meal}" matches known allergen "${m.details.allergen}" (severity ${m.details.severity}/100).`;
    }
    if (m.rule === "cross_reactive") {
      return `"${m.details.matchedTerm}" is associated with ${m.details.source} allergies (cross-reactive).`;
    }
    if (m.rule === "medication_interaction") {
      return `${m.details.extracted} may interact with current medication ${m.details.conflictsWith}`;
    }
    return JSON.stringify(m);
  });
  const reasoning = parts.join("; ").replace(/\.+$/, "") + ".";

  const meta = bestAllergyMeta ?? { taxonomyVersion: version, severity: 0 };

  return {
    riskLevel: highestRisk,
    reasoning,
    matched,
    meta,
  };
}
