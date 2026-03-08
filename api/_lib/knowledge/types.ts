/**
 * Phase 21a – Entity Resolution Types
 *
 * Universal structure for all resolved entities.
 * Used across drug, supplement, and food registries.
 */

/**
 * Universal structure for all resolved entities.
 * Used across drug, supplement, and food registries.
 */
export interface CanonicalEntity {
  /** Canonical identifier, e.g., "escitalopram", "omega-3-fatty-acid" */
  id: string;

  /** Entity type */
  type: "drug" | "supplement" | "food" | "allergen";

  /** All known aliases (lowercase, trimmed) */
  aliases: string[];

  /** Functional class, e.g., "ssri", "anticoagulant", "tree_nut" */
  class?: string;
}

/**
 * Result of resolving a raw string to a canonical entity.
 */
export interface ResolvedEntity {
  /** Original input */
  raw: string;

  /** Canonical ID (or normalized raw if unresolved) */
  canonical: string;

  /** Entity type */
  type: "drug" | "supplement" | "food" | "allergen" | "unknown";

  /** Functional class if known */
  class?: string;

  /** Whether entity was found in a registry */
  resolved: boolean;

  /** 1.0 for exact match, 0 for unresolved */
  confidence: number;
}

/**
 * Phase 21b – Resolution metadata for observability.
 * Included in report output and persisted with events.
 */
export interface ResolutionMetadata {
  /** Original user input */
  rawTerm: string;

  /** Canonical ID after resolution */
  canonicalId: string;

  /** Entity type */
  entityType: "drug" | "supplement" | "food" | "allergen" | "unknown";

  /** How it was resolved */
  resolutionType: "exact" | "alias" | "unresolved";

  /** Functional class if known */
  entityClass?: string;

  /** Confidence (1.0 for resolved, 0 for unresolved) */
  confidence: number;
}

/** Convert ResolvedEntity to ResolutionMetadata for output. */
export function toResolutionMetadata(r: ResolvedEntity): ResolutionMetadata {
  const resolutionType: ResolutionMetadata["resolutionType"] = r.resolved
    ? r.raw.toLowerCase().trim() === r.canonical.toLowerCase()
      ? "exact"
      : "alias"
    : "unresolved";
  return {
    rawTerm: r.raw,
    canonicalId: r.canonical,
    entityType: r.type,
    resolutionType,
    entityClass: r.class,
    confidence: r.confidence,
  };
}
