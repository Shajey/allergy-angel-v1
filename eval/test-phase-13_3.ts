/**
 * Phase 13.3 – Structured Explainability Tests
 *
 * Tests buildExplanationFromCheck pure helper.
 * Asserts:
 * - crossReactive explanation with parentCategory
 * - directMatch explanation with allergen
 * - interaction explanation with alphabetically-sorted pair
 * - deterministic output ordering (directMatch < crossReactive < interaction)
 * - no undefined fields leaking
 * - evidence passthrough when severity present
 */

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

// ── Fixtures ────────────────────────────────────────────────────────

const TAXONOMY_VERSION = "10i.2";

const directMatchCheck: ExplainableCheck = {
  verdict: {
    riskLevel: "high",
    reasoning: "Contains known allergen",
    matched: [
      {
        rule: "allergy_match",
        details: {
          meal: "pad thai with cashews",
          allergen: "cashew",
          matchedCategory: "tree_nut",
          severity: 90,
        },
      },
    ],
    meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
  },
};

const crossReactiveCheck: ExplainableCheck = {
  verdict: {
    riskLevel: "medium",
    reasoning: "Cross-reactive ingredient detected",
    matched: [
      {
        rule: "cross_reactive",
        details: {
          meal: "mango smoothie",
          matchedTerm: "mango",
          source: "tree_nut",
          severity: 100,
        },
      },
    ],
    meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 100 },
  },
};

const interactionCheck: ExplainableCheck = {
  verdict: {
    riskLevel: "high",
    reasoning: "Medication interaction detected",
    matched: [
      {
        rule: "medication_interaction",
        details: {
          extracted: "warfarin",
          conflictsWith: "aspirin",
        },
      },
    ],
    meta: { taxonomyVersion: TAXONOMY_VERSION },
  },
};

const multiMatchCheck: ExplainableCheck = {
  verdict: {
    riskLevel: "high",
    reasoning: "Multiple issues detected",
    matched: [
      {
        rule: "cross_reactive",
        details: { matchedTerm: "mango", source: "tree_nut", severity: 100 },
      },
      {
        rule: "medication_interaction",
        details: { extracted: "ibuprofen", conflictsWith: "aspirin" },
      },
      {
        rule: "allergy_match",
        details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 },
      },
    ],
    meta: { taxonomyVersion: TAXONOMY_VERSION },
  },
};

const noneRiskCheck: ExplainableCheck = {
  verdict: {
    riskLevel: "none",
    reasoning: "No issues detected",
    matched: [],
    meta: { taxonomyVersion: TAXONOMY_VERSION },
  },
};

// ── Tests ───────────────────────────────────────────────────────────

console.log("\n=== Phase 13.3 – Structured Explainability ===\n");

// Test 1: Direct match explanation
console.log("Test 1: Direct match explanation");
{
  const result = buildExplanationFromCheck(directMatchCheck, TAXONOMY_VERSION);
  assert(result.riskLevel === "high", "riskLevel is high");
  assert(result.entries.length === 1, "1 entry");
  const e = result.entries[0];
  assert(e.ruleType === "directMatch", "ruleType is directMatch");
  assert(e.matchedTerm === "cashew", 'matchedTerm is "cashew"');
  assert(e.parentCategory === "tree_nut", 'parentCategory is "tree_nut"');
  assert(e.summary.includes('"cashew"'), "summary includes cashew");
  assert(e.taxonomyVersion === TAXONOMY_VERSION, "taxonomyVersion matches");
}

// Test 2: Cross-reactive explanation
console.log("\nTest 2: Cross-reactive explanation");
{
  const result = buildExplanationFromCheck(crossReactiveCheck, TAXONOMY_VERSION);
  assert(result.riskLevel === "medium", "riskLevel is medium");
  assert(result.entries.length === 1, "1 entry");
  const e = result.entries[0];
  assert(e.ruleType === "crossReactive", "ruleType is crossReactive");
  assert(e.matchedTerm === "mango", 'matchedTerm is "mango"');
  assert(e.parentCategory === "tree_nut", 'parentCategory is "tree_nut"');
  assert(e.summary.includes("cross-reactive"), "summary includes cross-reactive");
  assert(e.taxonomyVersion === TAXONOMY_VERSION, "taxonomyVersion matches");
}

// Test 3: Medication interaction explanation (alphabetically sorted pair)
console.log("\nTest 3: Medication interaction explanation");
{
  const result = buildExplanationFromCheck(interactionCheck, TAXONOMY_VERSION);
  assert(result.entries.length === 1, "1 entry");
  const e = result.entries[0];
  assert(e.ruleType === "interaction", "ruleType is interaction");
  assert(e.matchedTerm === "aspirin, warfarin", "matchedTerm alphabetically sorted");
  assert(e.parentCategory === undefined, "no parentCategory for interaction");
  assert(e.summary.includes("aspirin"), "summary includes aspirin");
  assert(e.summary.includes("warfarin"), "summary includes warfarin");
}

// Test 4: Deterministic sort order (directMatch < crossReactive < interaction)
console.log("\nTest 4: Deterministic entry sort order");
{
  const result = buildExplanationFromCheck(multiMatchCheck, TAXONOMY_VERSION);
  assert(result.entries.length === 3, "3 entries");
  assert(result.entries[0].ruleType === "directMatch", "first entry is directMatch");
  assert(result.entries[1].ruleType === "crossReactive", "second entry is crossReactive");
  assert(result.entries[2].ruleType === "interaction", "third entry is interaction");
}

// Test 5: No undefined fields leaking
console.log("\nTest 5: No undefined fields leaking");
{
  const result = buildExplanationFromCheck(directMatchCheck, TAXONOMY_VERSION);
  const e = result.entries[0];
  const json = JSON.parse(JSON.stringify(e));
  const keys = Object.keys(json);
  assert(!keys.includes("undefined"), "no key named undefined");
  for (const k of keys) {
    assert(json[k] !== undefined, `field "${k}" is not undefined`);
  }

  const interResult = buildExplanationFromCheck(interactionCheck, TAXONOMY_VERSION);
  const ie = interResult.entries[0];
  assert(!("parentCategory" in ie), "interaction entry has no parentCategory key");
}

// Test 6: Evidence passthrough
console.log("\nTest 6: Evidence passthrough");
{
  const result = buildExplanationFromCheck(directMatchCheck, TAXONOMY_VERSION);
  const e = result.entries[0];
  assert(e.evidence != null, "evidence present");
  assert(e.evidence!.riskRate === 0.9, "riskRate is 0.9 (severity 90/100)");
}

// Test 7: No evidence when severity absent
console.log("\nTest 7: No evidence when severity absent");
{
  const result = buildExplanationFromCheck(interactionCheck, TAXONOMY_VERSION);
  const e = result.entries[0];
  assert(e.evidence === undefined, "no evidence for interaction without severity");
}

// Test 8: Empty matched array yields zero entries
console.log("\nTest 8: Empty matched array yields zero entries");
{
  const result = buildExplanationFromCheck(noneRiskCheck, TAXONOMY_VERSION);
  assert(result.entries.length === 0, "0 entries for none risk");
  assert(result.riskLevel === "none", "riskLevel is none");
  assert(result.taxonomyVersion === TAXONOMY_VERSION, "taxonomyVersion still set");
}

// Test 9: Taxonomy version from verdict.meta takes precedence
console.log("\nTest 9: Taxonomy version precedence");
{
  const result = buildExplanationFromCheck(directMatchCheck, "fallback-version");
  assert(
    result.taxonomyVersion === TAXONOMY_VERSION,
    "verdict.meta.taxonomyVersion takes precedence over fallback"
  );
}

// Test 10: Deterministic — identical input always produces identical output
console.log("\nTest 10: Deterministic identical output");
{
  const a = buildExplanationFromCheck(multiMatchCheck, TAXONOMY_VERSION);
  const b = buildExplanationFromCheck(multiMatchCheck, TAXONOMY_VERSION);
  assert(
    JSON.stringify(a) === JSON.stringify(b),
    "two calls with same input produce identical JSON"
  );
}

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
