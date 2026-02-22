/**
 * Phase 12.1 – Promotion Export Pipeline
 *
 * Deterministic, read-only export of unmapped discovery output into a REVIEW ARTIFACT
 * for human-in-the-loop taxonomy/registry growth. No writes, no LLM, no schema changes.
 *
 * Why read-only: Human-in-the-loop remains required; this endpoint only generates
 * a structured JSON payload for PR review. No automatic ontology mutation.
 */

import { discoverUnmapped, type UnmappedCandidate } from "./unmappedDiscovery.js";
import { ALLERGEN_TAXONOMY, ALLERGEN_TAXONOMY_VERSION } from "../inference/allergenTaxonomy.js";
import { matchFunctionalClasses } from "../inference/functionalClasses.js";

export type PromotionExportMode = "suggest" | "blank";

export interface PromotionExportRequest {
  profileId: string;
  windowHours?: number;
  limit?: number;
  mode?: PromotionExportMode;
}

export interface PromotionExportResult {
  meta: {
    exportVersion: string;
    generatedAt: string;
    profileId: string;
    windowHours: number;
    limit: number;
    candidateCount: number;
    taxonomyVersion: string | null;
    registryVersion: string | null;
  };
  candidates: Array<{
    candidate: string;
    kind: "meal_token" | "medication" | "supplement";
    count: number;
    highRiskCount: number;
    riskRate: number;
    firstSeenAt: string;
    lastSeenAt: string;
    examples: string[];
    sources: Record<string, number>;
  }>;
  proposals: {
    taxonomyAdditions: Array<{
      term: string;
      suggestedParent: string | null;
      confidence: "blank" | "rule_based";
      evidence: {
        highRiskCount: number;
        count: number;
        riskRate: number;
        examples: string[];
      };
      notes: string;
    }>;
    registryAdditions: Array<{
      name: string;
      kind: "medication" | "supplement";
      suggestedFunctionClass: string | null;
      confidence: "blank" | "rule_based";
      evidence: {
        highRiskCount: number;
        count: number;
        riskRate: number;
        examples: string[];
      };
      notes: string;
    }>;
  };
}

const BLANK_NOTES =
  "Human review required; promote via PR; no auto-mutation.";

/** Known tree_nut children for conservative suggest heuristic. */
const TREE_NUT_CHILDREN = new Set(
  (ALLERGEN_TAXONOMY.tree_nut?.children ?? []).map((c) => c.toLowerCase())
);

/**
 * Conservative rule-based suggestion for meal_token: if candidate contains "nut"
 * AND includes a known tree_nut child word → suggest tree_nut.
 * Why conservative: no ML/LLM; only safe substring rules; no broad or speculative heuristics.
 */
function suggestParentForMealToken(candidate: string): string | null {
  const lower = candidate.toLowerCase();
  if (!lower.includes("nut")) return null;
  for (const nutChild of TREE_NUT_CHILDREN) {
    if (lower.includes(nutChild)) return "tree_nut";
  }
  return null;
}

/**
 * Safety check: do NOT propose if candidate is already mapped.
 * (Should not occur for unmapped discovery output; defensive.)
 */
function isAlreadyMapped(candidate: string, kind: UnmappedCandidate["kind"]): boolean {
  const norm = candidate.toLowerCase().trim().replace(/[^\w\s-]/g, " ").replace(/\s+/g, " ").trim();
  if (!norm) return true;
  // Taxonomy parent keys
  if (Object.keys(ALLERGEN_TAXONOMY).includes(norm)) return true;
  // Taxonomy children
  for (const entry of Object.values(ALLERGEN_TAXONOMY)) {
    if (entry.children.some((c) => c.toLowerCase() === norm)) return true;
  }
  // Registry (medication/supplement)
  if (kind === "medication" || kind === "supplement") {
    if (matchFunctionalClasses(candidate).length > 0) return true;
  }
  return false;
}

/**
 * Build promotion export from pre-fetched discovery result.
 * Used for testing with fixtures; no DB access.
 */
export function buildPromotionExportFromCandidates(
  candidates: UnmappedCandidate[],
  request: { profileId: string; windowHours?: number; limit?: number; mode?: PromotionExportMode }
): PromotionExportResult {
  const profileId = request.profileId;
  const windowHours = Math.min(Math.max(request.windowHours ?? 168, 1), 720);
  const limit = Math.min(Math.max(request.limit ?? 20, 1), 100);
  const mode = request.mode === "suggest" ? "suggest" : "blank";

  return buildExportFromDiscoveryResult(
    { profileId, windowHours, limit, candidates },
    mode
  );
}

/**
 * Build promotion export from discovery result.
 * Proposals default to blank (null suggestions, confidence="blank") unless mode="suggest".
 * Why blank by default: human-in-the-loop required; no auto-mutation; human must review and promote via PR.
 */
export async function buildPromotionExport(
  request: PromotionExportRequest
): Promise<PromotionExportResult> {
  const profileId = request.profileId;
  const windowHours = Math.min(Math.max(request.windowHours ?? 168, 1), 720);
  const limit = Math.min(Math.max(request.limit ?? 20, 1), 100);
  const mode = request.mode === "suggest" ? "suggest" : "blank";

  const discovery = await discoverUnmapped({ profileId, windowHours, limit });

  return buildExportFromDiscoveryResult(
    { profileId, windowHours, limit, candidates: discovery.candidates },
    mode
  );
}

function buildExportFromDiscoveryResult(
  params: {
    profileId: string;
    windowHours: number;
    limit: number;
    candidates: UnmappedCandidate[];
  },
  mode: PromotionExportMode
): PromotionExportResult {
  const { profileId, windowHours, limit, candidates: discoveryCandidates } = params;

  const candidates = discoveryCandidates.map((c) => ({
    candidate: c.value,
    kind: c.kind,
    count: c.count,
    highRiskCount: c.highRiskCount,
    riskRate: c.riskRate,
    firstSeenAt: c.firstSeenAt,
    lastSeenAt: c.lastSeenAt,
    examples: c.examples,
    sources: c.sources,
  }));

  const taxonomyAdditions: PromotionExportResult["proposals"]["taxonomyAdditions"] = [];
  const registryAdditions: PromotionExportResult["proposals"]["registryAdditions"] = [];

  for (const c of discoveryCandidates) {
    const evidence = {
      highRiskCount: c.highRiskCount,
      count: c.count,
      riskRate: c.riskRate,
      examples: c.examples,
    };

    if (c.kind === "meal_token") {
      if (isAlreadyMapped(c.value, c.kind)) continue;
      let suggestedParent: string | null = null;
      let confidence: "blank" | "rule_based" = "blank";
      if (mode === "suggest") {
        const suggested = suggestParentForMealToken(c.value);
        if (suggested) {
          suggestedParent = suggested;
          confidence = "rule_based";
        }
      }
      taxonomyAdditions.push({
        term: c.value,
        suggestedParent,
        confidence,
        evidence,
        notes: BLANK_NOTES,
      });
    } else {
      // medication or supplement
      if (isAlreadyMapped(c.value, c.kind)) continue;
      let suggestedFunctionClass: string | null = null;
      let confidence: "blank" | "rule_based" = "blank";
      // suggest mode: no safe heuristics for medication/supplement class suggestion
      // (would require domain rules we don't have; keep blank)
      registryAdditions.push({
        name: c.value,
        kind: c.kind,
        suggestedFunctionClass,
        confidence,
        evidence,
        notes: BLANK_NOTES,
      });
    }
  }

  return {
    meta: {
      exportVersion: "v0-promo-12.1",
      generatedAt: new Date().toISOString(),
      profileId,
      windowHours,
      limit,
      candidateCount: candidates.length,
      taxonomyVersion: ALLERGEN_TAXONOMY_VERSION,
      registryVersion: null, // No version exported from functionalClasses
    },
    candidates,
    proposals: {
      taxonomyAdditions,
      registryAdditions,
    },
  };
}
