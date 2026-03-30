/**
 * Phase 21a – Entity Resolver
 *
 * Resolves raw entity strings to canonical IDs across drug, supplement,
 * and food registries.
 * O8 / O8.1 — Runtime-promoted entities (Supabase) merge with static registries.
 */

import { CanonicalEntity, ResolvedEntity } from "./types.js";
import { getAllMergedForResolution, mergeStaticAndPromotedForType } from "./registryMerge.js";

/** O8.1 — Applied promotion snapshots (hydrated from promoted_registry_entities + tests). */
let promotedRegistryEntities: CanonicalEntity[] = [];

export function getPromotedRegistryEntities(): CanonicalEntity[] {
  return promotedRegistryEntities;
}

/** @deprecated Use getPromotedRegistryEntities */
export function getPromotedFoodEntities(): CanonicalEntity[] {
  return promotedRegistryEntities;
}

export function setPromotedRegistryEntities(entities: CanonicalEntity[]): void {
  promotedRegistryEntities = entities.slice();
  invalidateAliasMapCache();
}

/** @deprecated Use setPromotedRegistryEntities */
export function setPromotedFoodEntities(entities: CanonicalEntity[]): void {
  setPromotedRegistryEntities(entities);
}

export function setPromotedRegistryEntitiesForTest(entities: CanonicalEntity[]): void {
  setPromotedRegistryEntities(entities);
}

/** @deprecated Use setPromotedRegistryEntitiesForTest */
export function setPromotedFoodEntitiesForTest(entities: CanonicalEntity[]): void {
  setPromotedRegistryEntities(entities);
}

export function clearPromotedRegistryEntitiesForTest(): void {
  promotedRegistryEntities = [];
  invalidateAliasMapCache();
}

/** @deprecated Use clearPromotedRegistryEntitiesForTest */
export function clearPromotedFoodEntitiesForTest(): void {
  clearPromotedRegistryEntitiesForTest();
}

let _aliasMap: Map<string, CanonicalEntity> | null = null;
let _mealReplacements: { pattern: RegExp; canonical: string }[] | null = null;

export function invalidateAliasMapCache(): void {
  _aliasMap = null;
  _mealReplacements = null;
}

function buildAliasMap(): Map<string, CanonicalEntity> {
  const map = new Map<string, CanonicalEntity>();
  const allEntities = getAllMergedForResolution(promotedRegistryEntities);

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

function getAliasMap(): Map<string, CanonicalEntity> {
  if (!_aliasMap) _aliasMap = buildAliasMap();
  return _aliasMap;
}

function buildMealAliasReplacements(): { pattern: RegExp; canonical: string }[] {
  const pairs: { alias: string; canonical: string }[] = [];

  const mealEntities = mergeStaticAndPromotedForType(
    "food",
    promotedRegistryEntities
  ).filter((e) => e.type === "food" || e.type === "allergen");

  for (const entity of mealEntities) {
    for (const alias of entity.aliases) {
      if (alias.toLowerCase() !== entity.id.toLowerCase()) {
        pairs.push({ alias, canonical: entity.id });
      }
    }
  }

  pairs.sort((a, b) => b.alias.length - a.alias.length);

  return pairs.map(({ alias, canonical }) => ({
    pattern: new RegExp(`\\b${escapeRegex(alias)}\\b`, "gi"),
    canonical,
  }));
}

function getMealReplacements(): { pattern: RegExp; canonical: string }[] {
  if (!_mealReplacements) _mealReplacements = buildMealAliasReplacements();
  return _mealReplacements;
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

  const entity = getAliasMap().get(normalized);

  if (entity) {
    return {
      raw,
      canonical: entity.id,
      type: entity.type,
      class: entity.class,
      riskTags: entity.riskTags,
      resolved: true,
      confidence: 1.0,
    };
  }

  return {
    raw,
    canonical: normalized,
    type: "unknown",
    class: undefined,
    riskTags: undefined,
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
 */
export function resolveMealText(mealText: string): string {
  if (!mealText || typeof mealText !== "string") return mealText;

  let result = mealText;
  for (const { pattern, canonical } of getMealReplacements()) {
    result = result.replace(pattern, canonical);
  }
  return result;
}

/**
 * Check if a canonical ID exists in any registry.
 */
export function isKnownEntity(canonicalId: string): boolean {
  const normalized = normalizeForLookup(canonicalId);
  return getAliasMap().has(normalized);
}

/**
 * Get all entities of a specific type.
 */
export function getEntitiesByType(
  type: CanonicalEntity["type"]
): CanonicalEntity[] {
  switch (type) {
    case "drug":
      return mergeStaticAndPromotedForType("drug", promotedRegistryEntities);
    case "supplement":
      return mergeStaticAndPromotedForType("supplement", promotedRegistryEntities);
    case "food":
    case "allergen":
      return mergeStaticAndPromotedForType("food", promotedRegistryEntities).filter(
        (e) => e.type === "food" || e.type === "allergen"
      );
    default:
      return [];
  }
}
