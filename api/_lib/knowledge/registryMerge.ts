/**
 * O8.1 — Merge static registries with promoted runtime entities (single read model).
 * Pure functions — no I/O.
 */

import type { CanonicalEntity } from "./types.js";
import { DRUGS } from "./drugs.registry.js";
import { SUPPLEMENTS } from "./supplements.registry.js";
import { FOODS } from "./foods.registry.js";

export type RegistryType = "drug" | "supplement" | "food";

function normalizeId(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/['']/g, "'")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ");
}

export function getStaticEntities(type: RegistryType): CanonicalEntity[] {
  switch (type) {
    case "drug":
      return DRUGS;
    case "supplement":
      return SUPPLEMENTS;
    case "food":
      return FOODS;
    default:
      return [];
  }
}

export function entityMatchesRegistryType(
  e: CanonicalEntity,
  type: RegistryType
): boolean {
  if (type === "drug") return e.type === "drug";
  if (type === "supplement") return e.type === "supplement";
  if (type === "food") return e.type === "food" || e.type === "allergen";
  return false;
}

/**
 * Promoted rows replace static entries with the same canonical id (normalized).
 */
export function mergeStaticAndPromotedForType(
  type: RegistryType,
  promoted: CanonicalEntity[]
): CanonicalEntity[] {
  const staticE = getStaticEntities(type);
  const promForType = promoted.filter((e) => entityMatchesRegistryType(e, type));
  const override = new Set(promForType.map((e) => normalizeId(e.id)));
  const filtered = staticE.filter((e) => !override.has(normalizeId(e.id)));
  return [...filtered, ...promForType];
}

export function getAllMergedForResolution(
  promoted: CanonicalEntity[]
): CanonicalEntity[] {
  return [
    ...mergeStaticAndPromotedForType("drug", promoted),
    ...mergeStaticAndPromotedForType("supplement", promoted),
    ...mergeStaticAndPromotedForType("food", promoted),
  ];
}

export function getStaticCanonicalEntity(
  type: RegistryType,
  canonicalId: string
): CanonicalEntity | null {
  const idNorm = normalizeId(canonicalId);
  const entities = getStaticEntities(type);
  return entities.find((e) => normalizeId(e.id) === idNorm) ?? null;
}
