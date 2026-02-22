/**
 * Phase 13.4.1 – Full Verdict Metadata Persistence Tests
 *
 * Asserts that checkRisk always returns a full verdict shape:
 * - meta (with taxonomyVersion, severity) always present
 * - matched always present (empty array for none-risk)
 * - ruleCode on every matched entry
 * - no behavior change to risk outcomes
 */

import { checkRisk } from "../api/_lib/inference/checkRisk.js";
import { ALLERGEN_TAXONOMY_VERSION } from "../api/_lib/inference/allergenTaxonomy.js";
import {
  RULE_ALLERGEN_MATCH,
  RULE_MED_INTERACTION,
} from "../api/_lib/inference/ruleCodes.js";

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

console.log("\n=== Phase 13.4.1 – Full Verdict Metadata ===\n");

// Test 1: none-risk verdict has full shape
console.log("Test 1: none-risk verdict has meta + matched");
{
  const verdict = checkRisk({
    profile: { known_allergies: [], current_medications: [] },
    events: [{ type: "meal", fields: { meal: "plain rice" } }],
  });
  assert(verdict.riskLevel === "none", "riskLevel is none");
  assert(verdict.meta != null, "meta is present");
  assert(verdict.meta!.taxonomyVersion === ALLERGEN_TAXONOMY_VERSION, "meta.taxonomyVersion matches current");
  assert(verdict.meta!.severity === 0, "meta.severity is 0");
  assert(Array.isArray(verdict.matched), "matched is an array");
  assert(verdict.matched!.length === 0, "matched is empty for none-risk");
  assert(typeof verdict.reasoning === "string", "reasoning is a string");
}

// Test 2: none-risk with empty events still has full shape
console.log("\nTest 2: none-risk with no events");
{
  const verdict = checkRisk({
    profile: { known_allergies: ["tree_nut"], current_medications: [] },
    events: [],
  });
  assert(verdict.riskLevel === "none", "riskLevel is none");
  assert(verdict.meta != null, "meta is present");
  assert(verdict.meta!.taxonomyVersion === ALLERGEN_TAXONOMY_VERSION, "taxonomyVersion present");
  assert(verdict.meta!.severity === 0, "severity is 0");
  assert(Array.isArray(verdict.matched), "matched is array");
  assert(verdict.matched!.length === 0, "matched is empty");
}

// Test 3: high-risk verdict still has meta + matched
console.log("\nTest 3: high-risk verdict shape");
{
  const verdict = checkRisk({
    profile: { known_allergies: ["tree_nut"], current_medications: [] },
    events: [{ type: "meal", fields: { meal: "cashew curry" } }],
  });
  assert(verdict.riskLevel === "high", "riskLevel is high");
  assert(verdict.meta != null, "meta is present");
  assert(verdict.meta!.taxonomyVersion === ALLERGEN_TAXONOMY_VERSION, "taxonomyVersion present");
  assert(verdict.meta!.severity > 0, "severity > 0");
  assert(Array.isArray(verdict.matched), "matched is array");
  assert(verdict.matched!.length > 0, "matched is non-empty");
  assert(verdict.matched![0].ruleCode === RULE_ALLERGEN_MATCH, "ruleCode present");
}

// Test 4: medium-risk (medication interaction) has meta
console.log("\nTest 4: medium-risk medication interaction shape");
{
  const verdict = checkRisk({
    profile: { known_allergies: [], current_medications: [{ name: "aspirin" }] },
    events: [{ type: "medication", fields: { medication: "ibuprofen" } }],
  });
  assert(verdict.riskLevel === "medium", "riskLevel is medium");
  assert(verdict.meta != null, "meta is present");
  assert(verdict.meta!.taxonomyVersion === ALLERGEN_TAXONOMY_VERSION, "taxonomyVersion present");
  assert(Array.isArray(verdict.matched), "matched is array");
  assert(verdict.matched!.length === 1, "1 matched entry");
  assert(verdict.matched![0].ruleCode === RULE_MED_INTERACTION, "ruleCode present");
}

// Test 5: verdict shape is JSON-serializable (simulates Supabase persistence)
console.log("\nTest 5: full verdict is JSON-serializable");
{
  const noneVerdict = checkRisk({
    profile: { known_allergies: [], current_medications: [] },
    events: [],
  });
  const json = JSON.parse(JSON.stringify(noneVerdict));
  assert(json.riskLevel === "none", "riskLevel survives JSON roundtrip");
  assert(json.meta != null, "meta survives JSON roundtrip");
  assert(json.meta.taxonomyVersion === ALLERGEN_TAXONOMY_VERSION, "taxonomyVersion survives");
  assert(json.meta.severity === 0, "severity survives");
  assert(Array.isArray(json.matched), "matched survives as array");
  assert(json.matched.length === 0, "matched empty survives");
}

// Test 6: traceId can be computed deterministically from verdict
console.log("\nTest 6: traceId computation from full verdict");
{
  const verdict = checkRisk({
    profile: { known_allergies: [], current_medications: [] },
    events: [],
  });
  const checkId = "test-check-id-123";
  const traceId = `${checkId}:${verdict.meta!.taxonomyVersion}`;
  assert(traceId === `test-check-id-123:${ALLERGEN_TAXONOMY_VERSION}`, "traceId format correct");
  assert(verdict.meta!.taxonomyVersion != null, "taxonomyVersion available for traceId");
}

// Test 7: risk outcomes unchanged
console.log("\nTest 7: risk outcomes unchanged");
{
  const noneV = checkRisk({
    profile: { known_allergies: ["peanut"], current_medications: [] },
    events: [{ type: "meal", fields: { meal: "plain bread" } }],
  });
  assert(noneV.riskLevel === "none", "plain bread still none for peanut allergy");

  const highV = checkRisk({
    profile: { known_allergies: ["tree_nut"], current_medications: [] },
    events: [{ type: "meal", fields: { meal: "walnut brownie" } }],
  });
  assert(highV.riskLevel === "high", "walnut brownie still high for tree_nut allergy");
  assert((highV.matched![0].details.allergen as string) === "walnut", "matched term unchanged");
}

// Test 8: medication-only verdict (no allergy meta) still has base meta
console.log("\nTest 8: medication-only verdict meta");
{
  const verdict = checkRisk({
    profile: { known_allergies: [], current_medications: [{ name: "warfarin" }] },
    events: [{ type: "medication", fields: { medication: "aspirin" } }],
  });
  assert(verdict.meta != null, "meta present for medication-only verdict");
  assert(verdict.meta!.severity === 0, "severity is 0 (no allergen severity)");
  assert(verdict.meta!.taxonomyVersion === ALLERGEN_TAXONOMY_VERSION, "taxonomyVersion present");
}

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
