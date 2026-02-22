/**
 * Phase 14.3A – Orphan Advice Validation
 *
 * Ensures every target in ADVICE_REGISTRY maps to a valid node in allergenTaxonomy.
 * No orphan advice allowed. Deterministic.
 */

import { ADVICE_REGISTRY } from "./adviceRegistry.js";
import {
  ALLERGEN_TAXONOMY,
  CROSS_REACTIVE_REGISTRY,
  type AllergenParentKey,
} from "../inference/allergenTaxonomy.js";

const VALID_PARENT_KEYS = new Set<string>(Object.keys(ALLERGEN_TAXONOMY) as AllergenParentKey[]);

const ALL_CHILDREN = new Set<string>(
  Object.values(ALLERGEN_TAXONOMY).flatMap((e) => e.children.map((c) => c.toLowerCase().trim()))
);

const CROSS_REACTIVE_TERMS = new Set<string>(
  CROSS_REACTIVE_REGISTRY.flatMap((r) => r.related.map((t) => t.toLowerCase().trim()))
);

/** Special targets (fallback) not in taxonomy structure. */
const ALLOWED_SPECIAL = new Set(["general"]);

/**
 * Validate that every ADVICE_REGISTRY target maps to a valid taxonomy node.
 * Returns list of orphan targets (empty = all valid).
 */
export function validateNoOrphanAdvice(): string[] {
  const orphans: string[] = [];

  for (const entry of Object.values(ADVICE_REGISTRY)) {
    const target = entry.target.toLowerCase().trim();

    if (ALLOWED_SPECIAL.has(target)) continue;
    if (VALID_PARENT_KEYS.has(target)) continue;
    if (ALL_CHILDREN.has(target)) continue;
    if (CROSS_REACTIVE_TERMS.has(target)) continue;

    orphans.push(entry.target);
  }

  return orphans.sort((a, b) => a.localeCompare(b));
}
