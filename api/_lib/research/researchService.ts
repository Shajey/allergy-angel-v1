/**
 * Phase 23 – Research Service
 * Phase 23.1 – Cache + threshold gate
 *
 * Orchestrates: gate → cache lookup → provider call → JSON parse → AJV validation → proposal generation.
 */

import type { ResearchProvider } from "./researchProvider.js";
import {
  validateEntityResearchOutput,
  validateCombinationResearchOutput,
} from "./researchSchema.js";
import {
  generateEntityDraft,
  generateRelationshipDraft,
} from "./proposalGenerator.js";
import {
  generateEntityResearchKey,
  generateCombinationResearchKey,
  lookupCache,
  storeCache,
  RESEARCH_PROMPT_VERSION,
} from "./researchCache.js";

export type SourceMode = "model_knowledge_only" | "provided_curated_sources";

export interface EntityResearchResult {
  meta: {
    query: string;
    queryType: string;
    researchedAt: string;
    model: string;
    sourceMode: SourceMode;
  };
  research: {
    identity: {
      canonicalName: string;
      scientificName?: string;
      commonAliases: string[];
      category: string;
      class?: string;
      description: string;
      safetyNotes?: string;
      evidenceQuality: string;
      confidenceScore: number;
      uncertaintyNotes?: string;
    };
    confidenceScore: number;
  };
  proposal: {
    proposalType: "create-entity" | "add-alias" | "no-action";
    registryType?: string;
    entityDraft?: { canonicalName: string; aliases: string[]; class?: string };
    aliasDraft?: { canonicalId: string; proposedAlias: string };
    reasoning: string;
    requiresHumanReview: true;
  };
}

export interface CombinationResearchResult {
  meta: {
    entityA: string;
    entityB: string;
    researchedAt: string;
    model: string;
    sourceMode: SourceMode;
  };
  research: {
    interactionFound: boolean;
    interactionType: "specific" | "class" | "unclear" | "none";
    mechanism?: string;
    severityHypothesis?: string;
    evidenceLevel?: string;
    summary?: string;
    uncertaintyNotes?: string;
    sourceNotes?: string;
  };
  proposal: {
    proposalType: "create-relationship" | "investigate-only" | "no-action";
    relationshipDraft?: {
      subjectType: string;
      subjectId: string;
      relationshipType: string;
      objectType: string;
      objectId: string;
      evidenceLevel: string;
      confidenceScore: number;
      reasoning: string;
    };
    reasoning: string;
    requiresHumanReview: true;
  };
}

export interface ResearchError {
  code: "validation_failed" | "provider_error" | "parse_error";
  message: string;
  details?: unknown;
}

export interface ResearchSkipped {
  researchSkipped: true;
  reason: "low_signal";
  recommendation: "wait_for_more_data";
}

export type EntityResearchOutcome =
  | { success: true; result: EntityResearchResult; entityDraft?: unknown; aliasDraft?: unknown; meta: { researchKey: string; cached: boolean; model?: string; promptVersion?: string } }
  | { success: false; error: ResearchError }
  | ResearchSkipped;

export type CombinationResearchOutcome =
  | { success: true; result: CombinationResearchResult; relationshipDraft?: unknown; meta: { researchKey: string; cached: boolean; model?: string; promptVersion?: string } }
  | { success: false; error: ResearchError }
  | ResearchSkipped;

function entityGatePassed(radarMetadata?: Record<string, unknown>, adminForce?: boolean): boolean {
  if (adminForce === true) return true;
  const occ = (radarMetadata?.occurrenceCount as number) ?? 0;
  const risk = (radarMetadata?.highRiskCount as number) ?? 0;
  return occ >= 3 || risk > 0;
}

/** Normalize LLM output: coerce invalid draft fields (null, array, string) to undefined for schema validation */
function normalizeProposalDrafts(parsed: unknown, type: "entity" | "combination"): void {
  const obj = parsed as Record<string, unknown>;
  const proposal = obj?.proposal as Record<string, unknown> | undefined;
  if (!proposal || typeof proposal !== "object") return;

  const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === "object" && !Array.isArray(v);

  if (type === "entity") {
    if (!isPlainObject(proposal.entityDraft)) delete proposal.entityDraft;
    if (!isPlainObject(proposal.aliasDraft)) delete proposal.aliasDraft;
  } else {
    if (!isPlainObject(proposal.relationshipDraft)) delete proposal.relationshipDraft;
  }
}

function combinationGatePassed(
  radarTelemetry?: { occurrenceCount?: number; highRiskCount?: number; signalPattern?: string },
  adminForce?: boolean
): boolean {
  if (adminForce === true) return true;
  const occ = radarTelemetry?.occurrenceCount ?? 0;
  const risk = radarTelemetry?.highRiskCount ?? 0;
  const pattern = radarTelemetry?.signalPattern ?? "";
  return occ >= 3 || risk > 0 || pattern === "emerging_risk";
}

export async function researchEntity(
  provider: ResearchProvider,
  args: {
    entity: string;
    entityType: string;
    contextEntities?: string[];
    radarMetadata?: Record<string, unknown>;
    adminForce?: boolean;
    forceResearch?: boolean;
  }
): Promise<EntityResearchOutcome> {
  if (!entityGatePassed(args.radarMetadata, args.adminForce ?? args.forceResearch)) {
    return {
      researchSkipped: true,
      reason: "low_signal",
      recommendation: "wait_for_more_data",
    };
  }

  const researchKey = generateEntityResearchKey(args.entity, args.entityType);
  const normalizedInput = {
    entity: args.entity,
    entityType: args.entityType,
    contextEntities: args.contextEntities,
  };

  if (!args.forceResearch) {
    const cached = await lookupCache(researchKey);
    if (cached) {
      const result = cached.result as EntityResearchResult;
      const { entityDraft, aliasDraft } = generateEntityDraft({
        proposalType: result.proposal.proposalType,
        registryType: result.proposal.registryType,
        entityDraft: result.proposal.entityDraft,
        aliasDraft: result.proposal.aliasDraft,
        reasoning: result.proposal.reasoning,
        research: { identity: result.research.identity },
      });
      return {
        success: true,
        result,
        entityDraft: entityDraft ?? undefined,
        aliasDraft: aliasDraft ?? undefined,
        meta: {
          researchKey,
          cached: true,
          model: cached.model ?? undefined,
          promptVersion: cached.prompt_version ?? RESEARCH_PROMPT_VERSION,
        },
      };
    }
  }

  try {
    const raw = await provider.researchEntity(args);
    const parsed = JSON.parse(raw) as unknown;
    normalizeProposalDrafts(parsed, "entity");
    const valid = validateEntityResearchOutput(parsed);
    if (!valid) {
      return {
        success: false,
        error: {
          code: "validation_failed",
          message: "LLM output failed schema validation",
          details: validateEntityResearchOutput.errors,
        },
      };
    }
    const obj = parsed as EntityResearchResult;
    if (obj.meta.sourceMode !== "model_knowledge_only" && obj.meta.sourceMode !== "provided_curated_sources") {
      obj.meta.sourceMode = "model_knowledge_only";
    }
    const { entityDraft, aliasDraft } = generateEntityDraft({
      proposalType: obj.proposal.proposalType,
      registryType: obj.proposal.registryType,
      entityDraft: obj.proposal.entityDraft,
      aliasDraft: obj.proposal.aliasDraft,
      reasoning: obj.proposal.reasoning,
      research: { identity: obj.research.identity },
    });

    await storeCache({
      researchKey,
      researchType: "entity",
      normalizedInput,
      result: obj,
      model: obj.meta.model,
      promptVersion: RESEARCH_PROMPT_VERSION,
    });

    return {
      success: true,
      result: obj,
      entityDraft: entityDraft ?? undefined,
      aliasDraft: aliasDraft ?? undefined,
      meta: {
        researchKey,
        cached: false,
        model: obj.meta.model,
        promptVersion: RESEARCH_PROMPT_VERSION,
      },
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        success: false,
        error: {
          code: "parse_error",
          message: "Invalid JSON from research provider",
          details: err.message,
        },
      };
    }
    return {
      success: false,
      error: {
        code: "provider_error",
        message: err instanceof Error ? err.message : "Research provider failed",
        details: err,
      },
    };
  }
}

export async function researchCombination(
  provider: ResearchProvider,
  args: {
    entityA: string;
    entityB: string;
    typeA: string;
    typeB: string;
    radarTelemetry?: {
      occurrenceCount?: number;
      highRiskCount?: number;
      safeOccurrenceCount?: number;
      signalPattern?: string;
    };
    adminForce?: boolean;
    forceResearch?: boolean;
  }
): Promise<CombinationResearchOutcome> {
  if (!combinationGatePassed(args.radarTelemetry, args.adminForce ?? args.forceResearch)) {
    return {
      researchSkipped: true,
      reason: "low_signal",
      recommendation: "wait_for_more_data",
    };
  }

  const researchKey = generateCombinationResearchKey(args.entityA, args.entityB, args.typeA, args.typeB);
  const normalizedInput = {
    entityA: args.entityA,
    entityB: args.entityB,
    typeA: args.typeA,
    typeB: args.typeB,
    radarTelemetry: args.radarTelemetry,
  };

  if (!args.forceResearch) {
    const cached = await lookupCache(researchKey);
    if (cached) {
      const result = cached.result as CombinationResearchResult;
      const relationshipDraft = generateRelationshipDraft({
        proposalType: result.proposal.proposalType,
        relationshipDraft: result.proposal.relationshipDraft,
        meta: result.meta,
      });
      return {
        success: true,
        result,
        relationshipDraft: relationshipDraft ?? undefined,
        meta: {
          researchKey,
          cached: true,
          model: cached.model ?? undefined,
          promptVersion: cached.prompt_version ?? RESEARCH_PROMPT_VERSION,
        },
      };
    }
  }

  try {
    const raw = await provider.researchCombination(args);
    const parsed = JSON.parse(raw) as unknown;
    normalizeProposalDrafts(parsed, "combination");
    const valid = validateCombinationResearchOutput(parsed);
    if (!valid) {
      return {
        success: false,
        error: {
          code: "validation_failed",
          message: "LLM output failed schema validation",
          details: validateCombinationResearchOutput.errors,
        },
      };
    }
    const obj = parsed as CombinationResearchResult;
    if (obj.meta.sourceMode !== "model_knowledge_only" && obj.meta.sourceMode !== "provided_curated_sources") {
      obj.meta.sourceMode = "model_knowledge_only";
    }
    const relationshipDraft = generateRelationshipDraft({
      proposalType: obj.proposal.proposalType,
      relationshipDraft: obj.proposal.relationshipDraft,
      meta: obj.meta,
    });

    await storeCache({
      researchKey,
      researchType: "combination",
      normalizedInput,
      result: obj,
      model: obj.meta.model,
      promptVersion: RESEARCH_PROMPT_VERSION,
    });

    return {
      success: true,
      result: obj,
      relationshipDraft: relationshipDraft ?? undefined,
      meta: {
        researchKey,
        cached: false,
        model: obj.meta.model,
        promptVersion: RESEARCH_PROMPT_VERSION,
      },
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return {
        success: false,
        error: {
          code: "parse_error",
          message: "Invalid JSON from research provider",
          details: err.message,
        },
      };
    }
    return {
      success: false,
      error: {
        code: "provider_error",
        message: err instanceof Error ? err.message : "Research provider failed",
        details: err,
      },
    };
  }
}
