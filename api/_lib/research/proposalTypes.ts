/**
 * Phase 23 – Registry Normalization Contract
 *
 * Target structure for all research proposals.
 * Aliases are lexical only; classes are not aliases; relationships are explicit.
 */

export type RegistryType = "drug" | "supplement" | "food";

/** Canonical entity proposal shape */
export interface CanonicalEntityProposal {
  id: string;
  type: RegistryType;
  canonicalName: string;
  aliases: string[];
  class?: string;
  source: string;
  status: "draft" | "pending_review";
  version: string;
}

/** Relationship proposal shape */
export interface RelationshipProposal {
  subjectType: "entity" | "class";
  subjectId: string;
  relationshipType: string;
  objectType: "entity" | "class";
  objectId: string;
  evidenceLevel: string;
  confidenceScore: number;
  reasoning: string;
  requiresHumanReview: true;
}

/** Add-alias draft (points to existing canonical) */
export interface AliasDraft {
  registryType: RegistryType;
  canonicalId: string;
  proposedAlias: string;
  reasoning?: string;
}

/** Create-entity draft (new canonical entry) */
export interface EntityDraft {
  registryType: RegistryType;
  canonicalName: string;
  aliases: string[];
  class?: string;
  reasoning?: string;
}

/** Relationship draft for combination research */
export interface RelationshipDraft {
  subjectType: "entity" | "class";
  subjectId: string;
  relationshipType: string;
  objectType: "entity" | "class";
  objectId: string;
  evidenceLevel: string;
  confidenceScore: number;
  reasoning: string;
}
