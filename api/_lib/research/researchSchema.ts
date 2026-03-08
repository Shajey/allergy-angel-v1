/**
 * Phase 23 – Research Output Schemas (AJV)
 *
 * Validates LLM outputs before proposal generation.
 */

import Ajv, { type ValidateFunction } from "ajv";

const ajv = new Ajv({ allErrors: true });

const entityResearchIdentitySchema = {
  type: "object",
  required: ["canonicalName"],
  properties: {
    canonicalName: { type: "string" },
    scientificName: { type: "string" },
    commonAliases: { type: "array", items: { type: "string" } },
    category: { type: "string" },
    class: { type: "string" },
    description: { type: "string" },
    safetyNotes: { type: "string" },
    evidenceQuality: { type: "string" },
    confidenceScore: { type: "number" },
    uncertaintyNotes: { type: "string" },
  },
};

const entityResearchOutputSchema = {
  type: "object",
  required: ["meta", "research", "proposal"],
  properties: {
    meta: {
      type: "object",
      required: ["query", "queryType", "researchedAt", "model", "sourceMode"],
      properties: {
        query: { type: "string" },
        queryType: { type: "string", enum: ["entity"] },
        researchedAt: { type: "string" },
        model: { type: "string" },
        sourceMode: { type: "string", enum: ["model_knowledge_only", "provided_curated_sources"] },
      },
    },
    research: {
      type: "object",
      required: ["identity"],
      properties: {
        identity: entityResearchIdentitySchema,
        confidenceScore: { type: "number" },
      },
    },
    proposal: {
      type: "object",
      required: ["proposalType", "reasoning", "requiresHumanReview"],
      properties: {
        proposalType: { type: "string", enum: ["create-entity", "add-alias", "no-action"] },
        registryType: { type: "string", enum: ["drug", "supplement", "food"] },
        entityDraft: {
          type: ["object", "null"],
          properties: {
            canonicalName: { type: "string" },
            aliases: { type: "array", items: { type: "string" } },
            class: { type: "string" },
          },
        },
        aliasDraft: {
          type: ["object", "null"],
          properties: {
            canonicalId: { type: "string" },
            proposedAlias: { type: "string" },
          },
        },
        reasoning: { type: "string" },
        requiresHumanReview: { type: "boolean", const: true },
      },
    },
  },
};

const combinationResearchOutputSchema = {
  type: "object",
  required: ["meta", "research", "proposal"],
  properties: {
    meta: {
      type: "object",
      required: ["entityA", "entityB", "researchedAt", "model", "sourceMode"],
      properties: {
        entityA: { type: "string" },
        entityB: { type: "string" },
        researchedAt: { type: "string" },
        model: { type: "string" },
        sourceMode: { type: "string", enum: ["model_knowledge_only", "provided_curated_sources"] },
      },
    },
    research: {
      type: "object",
      required: ["interactionFound", "interactionType"],
      properties: {
        interactionFound: { type: "boolean" },
        interactionType: { type: "string", enum: ["specific", "class", "unclear", "none"] },
        mechanism: { type: "string" },
        severityHypothesis: { type: "string" },
        evidenceLevel: { type: "string" },
        summary: { type: "string" },
        uncertaintyNotes: { type: "string" },
        sourceNotes: { type: "string" },
      },
    },
    proposal: {
      type: "object",
      required: ["proposalType", "reasoning", "requiresHumanReview"],
      properties: {
        proposalType: { type: "string", enum: ["create-relationship", "investigate-only", "no-action"] },
        relationshipDraft: {
          type: ["object", "null"],
          properties: {
            subjectType: { type: "string", enum: ["entity", "class"] },
            subjectId: { type: "string" },
            relationshipType: { type: "string" },
            objectType: { type: "string", enum: ["entity", "class"] },
            objectId: { type: "string" },
            evidenceLevel: { type: "string" },
            confidenceScore: { type: "number" },
            reasoning: { type: "string" },
          },
        },
        reasoning: { type: "string" },
        requiresHumanReview: { type: "boolean", const: true },
      },
    },
  },
};

export const validateEntityResearchOutput: ValidateFunction =
  ajv.compile(entityResearchOutputSchema);
export const validateCombinationResearchOutput: ValidateFunction =
  ajv.compile(combinationResearchOutputSchema);
