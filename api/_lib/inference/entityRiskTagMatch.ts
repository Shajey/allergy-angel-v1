/**
 * O8 — Deterministic match: meal text ↔ registry entity risk tags ↔ profile allergy tokens.
 * No LLM. Used by checkRisk after resolveMealText.
 */

import type { CanonicalEntity } from "../knowledge/types.js";
import { FOODS } from "../knowledge/foods.registry.js";
import { getPromotedFoodEntities } from "../knowledge/entityResolver.js";

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeAllergyToken(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "_");
}

/** Collect food/allergen entities that carry O8 risk tags. */
export function getEntitiesWithRiskTags(): CanonicalEntity[] {
  const fromStatic = FOODS.filter((e) => e.riskTags && e.riskTags.length > 0);
  const fromPromoted = getPromotedFoodEntities().filter(
    (e) =>
      (e.type === "food" || e.type === "allergen") && e.riskTags && e.riskTags.length > 0
  );
  return [...fromStatic, ...fromPromoted];
}

/**
 * If any entity with riskTags is mentioned in the meal (word-boundary) and
 * profile lists a matching tag in known_allergies, return match details.
 */
export function matchEntityRiskTagsToProfile(args: {
  mealText: string;
  resolvedMealText: string;
  knownAllergies: string[];
}): {
  entityId: string;
  matchedTag: string;
  riskTags: string[];
} | null {
  const profileSet = new Set(
    args.knownAllergies.map((a) => normalizeAllergyToken(typeof a === "string" ? a : String(a)))
  );
  const haystacks = [args.mealText, args.resolvedMealText].map((s) =>
    (s ?? "").toLowerCase()
  );

  for (const entity of getEntitiesWithRiskTags()) {
    const tags = entity.riskTags ?? [];
    const terms = [entity.id, ...entity.aliases];
    for (const term of terms) {
      const t = term.trim();
      if (t.length < 2) continue;
      const re = new RegExp(`\\b${escapeRegex(t.toLowerCase())}\\b`, "i");
      const mentioned = haystacks.some((h) => re.test(h));
      if (!mentioned) continue;

      for (const tag of tags) {
        const nt = normalizeAllergyToken(tag);
        if (profileSet.has(nt)) {
          return { entityId: entity.id, matchedTag: tag, riskTags: tags };
        }
      }
    }
  }

  return null;
}
