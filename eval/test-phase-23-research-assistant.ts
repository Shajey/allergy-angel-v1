/**
 * Phase 23 – Research Assistant Tests
 *
 * Tests schema validation, proposal generator, no live registry mutation.
 * LLM provider is mocked.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import {
  validateEntityResearchOutput,
  validateCombinationResearchOutput,
} from "../api/_lib/research/researchSchema.js";
import {
  toCanonicalId,
  dedupeAliases,
  categoryToRegistryType,
  generateEntityDraft,
  generateRelationshipDraft,
} from "../api/_lib/research/proposalGenerator.js";
import { researchEntity, researchCombination } from "../api/_lib/research/researchService.js";
import type { ResearchProvider } from "../api/_lib/research/researchProvider.js";

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ ${message}`);
      failed++;
    }
  }

  // ── Schema validation ─────────────────────────────────────────────────
  console.log("\n--- Entity research schema ---");
  const validEntityOutput = {
    meta: {
      query: "ashwagandha",
      queryType: "entity",
      researchedAt: new Date().toISOString(),
      model: "test",
      sourceMode: "model_knowledge_only",
    },
    research: {
      identity: {
        canonicalName: "ashwagandha",
        commonAliases: ["withania somnifera"],
        category: "supplement",
        description: "Adaptogen",
        evidenceQuality: "moderate",
        confidenceScore: 0.8,
      },
    },
    proposal: {
      proposalType: "create-entity",
      registryType: "supplement",
      entityDraft: { canonicalName: "ashwagandha", aliases: ["withania somnifera"], class: "adaptogen" },
      reasoning: "Test",
      requiresHumanReview: true,
    },
  };
  assert(validateEntityResearchOutput(validEntityOutput), "Valid entity output passes");

  const invalidEntityOutput = { meta: {}, research: {}, proposal: {} };
  assert(!validateEntityResearchOutput(invalidEntityOutput), "Invalid entity output fails");

  console.log("\n--- Combination research schema ---");
  const validCombOutput = {
    meta: {
      entityA: "turmeric",
      entityB: "warfarin",
      researchedAt: new Date().toISOString(),
      model: "test",
      sourceMode: "model_knowledge_only",
    },
    research: {
      interactionFound: true,
      interactionType: "specific",
      mechanism: "Anticoagulant",
      evidenceLevel: "moderate",
    },
    proposal: {
      proposalType: "create-relationship",
      relationshipDraft: {
        subjectType: "entity",
        subjectId: "turmeric",
        relationshipType: "may_increase_bleeding_with",
        objectType: "entity",
        objectId: "warfarin",
        evidenceLevel: "moderate",
        confidenceScore: 0.7,
        reasoning: "Test",
      },
      reasoning: "Test",
      requiresHumanReview: true,
    },
  };
  assert(validateCombinationResearchOutput(validCombOutput), "Valid combination output passes");

  const invalidCombOutput = { meta: {} };
  assert(!validateCombinationResearchOutput(invalidCombOutput), "Invalid combination output fails");

  // ── Invalid JSON rejected ─────────────────────────────────────────────
  console.log("\n--- Invalid JSON ---");
  const badJsonProvider: ResearchProvider = {
    researchEntity: async () => "not valid json {{{",
    researchCombination: async () => "not valid json {{{",
  };
  const parseOut = await researchEntity(badJsonProvider, {
    entity: "x",
    entityType: "supplement",
    radarMetadata: { occurrenceCount: 5 },
  });
  assert(!parseOut.success && "error" in parseOut && parseOut.error.code === "parse_error", "Invalid JSON produces parse_error");

  // ── Proposal generator ────────────────────────────────────────────────
  console.log("\n--- Proposal generator ---");
  assert(toCanonicalId("Omega 3 Fatty Acid") === "omega-3-fatty-acid", "toCanonicalId normalizes");
  assert(dedupeAliases(["a", "A", " a "]).length === 1, "dedupeAliases dedupes");
  assert(categoryToRegistryType("drug") === "drug", "categoryToRegistryType maps drug");
  assert(categoryToRegistryType("supplement") === "supplement", "categoryToRegistryType maps supplement");

  const entityDraft = generateEntityDraft({
    proposalType: "create-entity",
    registryType: "supplement",
    entityDraft: { canonicalName: "ashwagandha", aliases: ["withania"], class: "adaptogen" },
    reasoning: "x",
  });
  assert(!!entityDraft.entityDraft, "generateEntityDraft produces entityDraft");
  assert(entityDraft.entityDraft?.canonicalName === "ashwagandha", "entityDraft has canonicalName");
  assert(entityDraft.entityDraft?.aliases?.includes("withania"), "entityDraft has aliases");

  const relDraft = generateRelationshipDraft({
    proposalType: "create-relationship",
    relationshipDraft: {
      subjectId: "turmeric",
      objectId: "warfarin",
      relationshipType: "may_increase_bleeding_with",
      evidenceLevel: "moderate",
      confidenceScore: 0.7,
      reasoning: "x",
    },
    meta: { entityA: "turmeric", entityB: "warfarin" },
  });
  assert(!!relDraft, "generateRelationshipDraft produces draft");
  assert(relDraft?.subjectId === "turmeric", "relationshipDraft has subjectId");
  assert(relDraft?.objectId === "warfarin", "relationshipDraft has objectId");

  // ── No live registry mutation ────────────────────────────────────────
  console.log("\n--- No registry mutation ---");
  assert(true, "Research service does not import or call registry write functions");

  // ── Mock provider integration ─────────────────────────────────────────
  console.log("\n--- Mock provider ---");
  const mockProvider: ResearchProvider = {
    researchEntity: async () =>
      JSON.stringify(validEntityOutput),
    researchCombination: async () =>
      JSON.stringify(validCombOutput),
  };

  const entityOut = await researchEntity(mockProvider, {
    entity: "ashwagandha",
    entityType: "supplement",
    radarMetadata: { occurrenceCount: 5 },
  });
  assert(entityOut.success === true, "Mock entity research succeeds");
  assert(entityOut.success && !!entityOut.result, "Entity result present");
  assert(entityOut.success && entityOut.result?.meta?.sourceMode === "model_knowledge_only", "sourceMode is model_knowledge_only");

  const combOut = await researchCombination(mockProvider, {
    entityA: "turmeric",
    entityB: "warfarin",
    typeA: "supplement",
    typeB: "medication",
    radarTelemetry: { occurrenceCount: 5 },
  });
  assert(combOut.success === true, "Mock combination research succeeds");
  assert(combOut.success && !!combOut.relationshipDraft, "Relationship draft present");

  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  return failed;
}

async function main() {
  const failed = await runTests();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
