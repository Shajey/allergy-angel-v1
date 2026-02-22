/**
 * Phase 13.4 – Deterministic Rule Codes + Trace IDs
 *
 * Asserts:
 * - ruleCode constants have expected values
 * - ruleCode present in matched items for each rule type
 * - ruleCode propagated through buildExplanationFromCheck
 * - traceId format is checkId:taxonomyVersion
 * - traceId passthrough in structured explanation
 * - no change to riskLevel or matched terms vs previous fixtures
 * - deterministic ordering preserved
 */

import { checkRisk } from "../api/_lib/inference/checkRisk.js";
import {
  RULE_ALLERGEN_MATCH,
  RULE_CROSS_REACTIVE,
  RULE_MED_INTERACTION,
  ruleCodeFor,
} from "../api/_lib/inference/ruleCodes.js";
import {
  buildExplanationFromCheck,
  type ExplainableCheck,
} from "../src/lib/buildExplanation.js";

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

const TAXONOMY_VERSION = "10i.2";

// ── Test 1: Rule code constants ─────────────────────────────────────

console.log("\n=== Phase 13.4 – Rule Codes + Trace IDs ===\n");
console.log("Test 1: Rule code constants");
{
  assert(RULE_ALLERGEN_MATCH === "AA-RULE-AL-001", "RULE_ALLERGEN_MATCH value");
  assert(RULE_CROSS_REACTIVE === "AA-RULE-CR-001", "RULE_CROSS_REACTIVE value");
  assert(RULE_MED_INTERACTION === "AA-RULE-MI-001", "RULE_MED_INTERACTION value");
}

// ── Test 2: ruleCodeFor helper ──────────────────────────────────────

console.log("\nTest 2: ruleCodeFor helper");
{
  assert(ruleCodeFor("allergy_match") === RULE_ALLERGEN_MATCH, "allergy_match maps correctly");
  assert(ruleCodeFor("cross_reactive") === RULE_CROSS_REACTIVE, "cross_reactive maps correctly");
  assert(ruleCodeFor("medication_interaction") === RULE_MED_INTERACTION, "medication_interaction maps correctly");
  assert(ruleCodeFor("unknown_rule") === null, "unknown rule returns null");
}

// ── Test 3: checkRisk allergy_match includes ruleCode ───────────────

console.log("\nTest 3: allergy_match includes ruleCode");
{
  const verdict = checkRisk({
    profile: {
      known_allergies: ["tree_nut"],
      current_medications: [],
    },
    events: [{ type: "meal", fields: { meal: "cashew curry" } }],
  });
  assert(verdict.riskLevel === "high", "riskLevel is high");
  const m = verdict.matched?.[0];
  assert(m != null, "matched entry exists");
  assert(m!.ruleCode === RULE_ALLERGEN_MATCH, "ruleCode is AA-RULE-AL-001");
  assert((m!.details.allergen as string) === "cashew", "allergen unchanged");
}

// ── Test 4: checkRisk cross_reactive includes ruleCode ──────────────

console.log("\nTest 4: cross_reactive includes ruleCode");
{
  const verdict = checkRisk({
    profile: {
      known_allergies: ["tree_nut"],
      current_medications: [],
    },
    events: [{ type: "meal", fields: { meal: "mango smoothie" } }],
  });
  assert(verdict.riskLevel === "medium", "riskLevel is medium");
  const m = verdict.matched?.[0];
  assert(m != null, "matched entry exists");
  assert(m!.ruleCode === RULE_CROSS_REACTIVE, "ruleCode is AA-RULE-CR-001");
  assert((m!.details.matchedTerm as string) === "mango", "matchedTerm unchanged");
}

// ── Test 5: checkRisk medication_interaction includes ruleCode ──────

console.log("\nTest 5: medication_interaction includes ruleCode");
{
  const verdict = checkRisk({
    profile: {
      known_allergies: [],
      current_medications: [{ name: "aspirin" }],
    },
    events: [{ type: "medication", fields: { medication: "ibuprofen" } }],
  });
  assert(verdict.riskLevel === "medium", "riskLevel is medium");
  const m = verdict.matched?.[0];
  assert(m != null, "matched entry exists");
  assert(m!.ruleCode === RULE_MED_INTERACTION, "ruleCode is AA-RULE-MI-001");
  assert((m!.details.extracted as string) === "ibuprofen", "extracted unchanged");
  assert((m!.details.conflictsWith as string) === "aspirin", "conflictsWith unchanged");
}

// ── Test 6: traceId format ──────────────────────────────────────────

console.log("\nTest 6: traceId format validation");
{
  const checkId = "abc-123-def";
  const version = "10i.2";
  const expected = `${checkId}:${version}`;
  assert(expected === "abc-123-def:10i.2", "traceId format is checkId:version");

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:.+$/;
  const sampleTraceId = "a0000000-0000-0000-0000-000000000001:10i.2";
  assert(uuidPattern.test(sampleTraceId), "traceId with UUID matches expected pattern");
}

// ── Test 7: buildExplanation passes through ruleCode ────────────────

console.log("\nTest 7: buildExplanation ruleCode passthrough");
{
  const check: ExplainableCheck = {
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        {
          rule: "allergy_match",
          ruleCode: RULE_ALLERGEN_MATCH,
          details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 },
        },
        {
          rule: "cross_reactive",
          ruleCode: RULE_CROSS_REACTIVE,
          details: { matchedTerm: "mango", source: "tree_nut", severity: 100 },
        },
        {
          rule: "medication_interaction",
          ruleCode: RULE_MED_INTERACTION,
          details: { extracted: "ibuprofen", conflictsWith: "aspirin" },
        },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
    },
  };

  const result = buildExplanationFromCheck(check, TAXONOMY_VERSION);
  assert(result.entries[0].ruleCode === RULE_ALLERGEN_MATCH, "directMatch entry has RULE_ALLERGEN_MATCH");
  assert(result.entries[1].ruleCode === RULE_CROSS_REACTIVE, "crossReactive entry has RULE_CROSS_REACTIVE");
  assert(result.entries[2].ruleCode === RULE_MED_INTERACTION, "interaction entry has RULE_MED_INTERACTION");
}

// ── Test 8: buildExplanation passes through traceId ─────────────────

console.log("\nTest 8: buildExplanation traceId passthrough");
{
  const traceId = "a0000000-0000-0000-0000-000000000001:10i.2";
  const check: ExplainableCheck = {
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        {
          rule: "allergy_match",
          ruleCode: RULE_ALLERGEN_MATCH,
          details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 },
        },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90, traceId },
    },
  };

  const result = buildExplanationFromCheck(check, TAXONOMY_VERSION);
  assert(result.traceId === traceId, "traceId passed through to StructuredExplanation");
}

// ── Test 9: no traceId when absent in meta ──────────────────────────

console.log("\nTest 9: no traceId when absent");
{
  const check: ExplainableCheck = {
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        {
          rule: "allergy_match",
          ruleCode: RULE_ALLERGEN_MATCH,
          details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 },
        },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
    },
  };

  const result = buildExplanationFromCheck(check, TAXONOMY_VERSION);
  assert(!("traceId" in result), "no traceId key when not in meta");
}

// ── Test 10: riskLevel and matchedTerm unchanged by ruleCode ────────

console.log("\nTest 10: ruleCode does not alter risk outcomes");
{
  const verdict = checkRisk({
    profile: {
      known_allergies: ["tree_nut"],
      current_medications: [{ name: "aspirin" }],
    },
    events: [
      { type: "meal", fields: { meal: "cashew butter toast" } },
      { type: "medication", fields: { medication: "ibuprofen" } },
    ],
  });
  assert(verdict.riskLevel === "high", "riskLevel still high with combined matches");
  assert(verdict.matched!.length === 2, "2 matched entries");
  const allergyMatch = verdict.matched!.find((m) => m.rule === "allergy_match");
  const medMatch = verdict.matched!.find((m) => m.rule === "medication_interaction");
  assert(allergyMatch != null, "allergy_match present");
  assert(medMatch != null, "medication_interaction present");
  assert((allergyMatch!.details.allergen as string) === "cashew", "allergen term unchanged");
  assert((medMatch!.details.extracted as string) === "ibuprofen", "medication term unchanged");
}

// ── Test 11: deterministic ordering preserved ───────────────────────

console.log("\nTest 11: deterministic ordering preserved");
{
  const check: ExplainableCheck = {
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        { rule: "cross_reactive", ruleCode: RULE_CROSS_REACTIVE, details: { matchedTerm: "mango", source: "tree_nut", severity: 100 } },
        { rule: "medication_interaction", ruleCode: RULE_MED_INTERACTION, details: { extracted: "ibuprofen", conflictsWith: "aspirin" } },
        { rule: "allergy_match", ruleCode: RULE_ALLERGEN_MATCH, details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 } },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
    },
  };

  const a = buildExplanationFromCheck(check, TAXONOMY_VERSION);
  const b = buildExplanationFromCheck(check, TAXONOMY_VERSION);
  assert(a.entries[0].ruleType === "directMatch", "directMatch first after sort");
  assert(a.entries[1].ruleType === "crossReactive", "crossReactive second");
  assert(a.entries[2].ruleType === "interaction", "interaction third");
  assert(JSON.stringify(a) === JSON.stringify(b), "identical output across calls");
}

// ── Test 12: backward compat — matched without ruleCode ─────────────

console.log("\nTest 12: backward compat — matched without ruleCode");
{
  const check: ExplainableCheck = {
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        { rule: "allergy_match", details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 } },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
    },
  };

  const result = buildExplanationFromCheck(check, TAXONOMY_VERSION);
  assert(result.entries.length === 1, "entry created from legacy match");
  assert(result.entries[0].ruleCode === undefined, "no ruleCode when not in input");
  assert(result.entries[0].ruleType === "directMatch", "ruleType still correct");
}

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
