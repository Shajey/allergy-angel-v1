/**
 * Phase 21a – Entity Resolver
 *
 * Resolves raw entity strings to canonical IDs across drug, supplement,
 * and food registries.
 */

import { CanonicalEntity, ResolvedEntity } from "./types.js";
import { DRUGS } from "./drugs.registry.js";
import { SUPPLEMENTS } from "./supplements.registry.js";
import { FOODS } from "./foods.registry.js";

/**
 * Combined alias lookup map.
 * Built once at module load, keyed by normalized alias.
 */
const ALIAS_MAP: Map<string, CanonicalEntity> = buildAliasMap();

/**
 * Food/allergen alias replacement pairs for meal text resolution.
 * Sorted by alias length descending (longest first) to avoid partial replacements.
 */
const MEAL_ALIAS_REPLACEMENTS: { pattern: RegExp; canonical: string }[] =
  buildMealAliasReplacements();

function buildAliasMap(): Map<string, CanonicalEntity> {
  const map = new Map<string, CanonicalEntity>();

  const allEntities = [...DRUGS, ...SUPPLEMENTS, ...FOODS];

  for (const entity of allEntities) {
    for (const alias of entity.aliases) {
      const normalized = normalizeForLookup(alias);
      if (!map.has(normalized)) {
        map.set(normalized, entity);
      }
    }
  }

  return map;
}

function buildMealAliasReplacements(): { pattern: RegExp; canonical: string }[] {
  const pairs: { alias: string; canonical: string }[] = [];

  for (const entity of FOODS) {
    for (const alias of entity.aliases) {
      if (alias.toLowerCase() !== entity.id.toLowerCase()) {
        pairs.push({ alias, canonical: entity.id });
      }
    }
  }

  // Sort by alias length descending (longest first)
  pairs.sort((a, b) => b.alias.length - a.alias.length);

  return pairs.map(({ alias, canonical }) => ({
    pattern: new RegExp(`\\b${escapeRegex(alias)}\\b`, "gi"),
    canonical,
  }));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Normalize a string for alias lookup.
 */
function normalizeForLookup(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

/**
 * Resolve a single raw string to a canonical entity.
 */
export function resolveEntity(raw: string): ResolvedEntity {
  const normalized = normalizeForLookup(raw);

  const entity = ALIAS_MAP.get(normalized);

  if (entity) {
    return {
      raw,
      canonical: entity.id,
      type: entity.type,
      class: entity.class,
      resolved: true,
      confidence: 1.0,
    };
  }

  return {
    raw,
    canonical: normalized,
    type: "unknown",
    class: undefined,
    resolved: false,
    confidence: 0,
  };
}

/**
 * Resolve multiple raw strings.
 */
export function resolveEntities(raws: string[]): ResolvedEntity[] {
  return raws.map(resolveEntity);
}

/**
 * Resolve meal text by replacing known food/allergen aliases with canonical IDs.
 * Used for allergen matching so "groundnut" in "pad thai with groundnut" becomes
 * "pad thai with peanut".
 */
export function resolveMealText(mealText: string): string {
  if (!mealText || typeof mealText !== "string") return mealText;

  let result = mealText;
  for (const { pattern, canonical } of MEAL_ALIAS_REPLACEMENTS) {
    result = result.replace(pattern, canonical);
  }
  return result;
}

/**
 * Check if a canonical ID exists in any registry.
 */
export function isKnownEntity(canonicalId: string): boolean {
  const normalized = normalizeForLookup(canonicalId);
  return ALIAS_MAP.has(normalized);
}

/**
 * Get all entities of a specific type.
 */
export function getEntitiesByType(
  type: CanonicalEntity["type"]
): CanonicalEntity[] {
  switch (type) {
    case "drug":
      return DRUGS;
    case "supplement":
      return SUPPLEMENTS;
    case "food":
    case "allergen":
      return FOODS;
    default:
      return [];
  }
}
