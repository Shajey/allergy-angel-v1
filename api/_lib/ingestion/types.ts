/**
 * Phase 24.1 – Normalized Ingestion Candidate Contract
 *
 * Single shape for staged ingestion candidates.
 * External data is a source, not an authority.
 */

export type RegistryType = "drug" | "supplement" | "food";
export type CandidateType = "entity" | "alias" | "class_assignment";
export type CandidateStatus = "pending" | "duplicate" | "promoted" | "dismissed";
export type MatchType = "exact" | "alias";

export interface MatchedExisting {
  registryType: RegistryType;
  canonicalId: string;
  matchType: MatchType;
}

export interface IngestionSource {
  dataset: string;
  version: string;
  recordId: string;
  url?: string;
}

export interface IngestionCandidate {
  id: string;
  canonicalId: string;
  registryType: RegistryType;
  candidateType: CandidateType;
  name: string;
  aliases: string[];
  class?: string;
  source: IngestionSource;
  status: CandidateStatus;
  matchedExisting?: MatchedExisting;
}
