/**
 * Phase 10H – Allergen Taxonomy Expansion verification
 *
 * Test cases from spec:
 *   1. Profile allergy: ["tree_nut"], Input: "I ate pistachio ice cream"
 *      → riskLevel: "high", reasoning references tree_nut expansion
 *   2. Profile allergy: ["peanut"], Input: "I ate pistachio"
 *      → should NOT trigger (peanut ≠ tree_nut)
 *   3. Input: "nutritional yeast" with tree_nut allergy
 *      → should NOT trigger nut match (no partial word match)
 *   4. Input: "Brazil nut bar" with tree_nut allergy
 *      → must match correctly
 *
 * Phase 10H++ – Severity + taxonomy version:
 *   Verdict meta includes severity and taxonomyVersion (persisted in checks.verdict).
 */

import { checkRisk } from "../api/_lib/inference/checkRisk.js";
import {
  getAllergenSeverity,
  ALLERGEN_TAXONOMY_VERSION,
} from "../api/_lib/inference/allergenTaxonomy.js";

interface TestCase {
  name: string;
  profileAllergies: string[];
  mealText: string;
  expectHigh: boolean;
  expectReasoningContains?: string;
  expectReasoningNotContains?: string;
  /** Phase 10H++: expected verdict meta when allergen match */
  expectMeta?: { severity: number; taxonomyVersion: string };
}

const CASES: TestCase[] = [
  {
    name: "tree_nut expansion: pistachio ice cream",
    profileAllergies: ["tree_nut"],
    mealText: "I ate pistachio ice cream",
    expectHigh: true,
    expectReasoningContains: "tree_nut",
    expectMeta: { severity: 90, taxonomyVersion: "10i.3" },
  },
  {
    name: "peanut allergy does NOT match pistachio",
    profileAllergies: ["peanut"],
    mealText: "I ate pistachio",
    expectHigh: false,
  },
  {
    name: "nutritional yeast does NOT match nut",
    profileAllergies: ["tree_nut"],
    mealText: "nutritional yeast",
    expectHigh: false,
  },
  {
    name: "Brazil nut bar matches tree_nut",
    profileAllergies: ["tree_nut"],
    mealText: "Brazil nut bar",
    expectHigh: true,
    expectReasoningContains: "brazil nut",
  },
  {
    name: "direct peanut match",
    profileAllergies: ["peanut"],
    mealText: "peanut butter sandwich",
    expectHigh: true,
    expectReasoningContains: "peanut",
  },
  {
    name: "shellfish expansion: shrimp",
    profileAllergies: ["shellfish"],
    mealText: "grilled shrimp",
    expectHigh: true,
    expectReasoningContains: "shellfish",
    expectMeta: { severity: 95, taxonomyVersion: "10i.3" },
  },
  {
    name: "legume expansion: lentil",
    profileAllergies: ["legume"],
    mealText: "lentil soup",
    expectHigh: true,
    expectReasoningContains: "legume",
  },
];

function runTests(): void {
  let passed = 0;
  let failed = 0;

  for (const tc of CASES) {
    const events = [
      { type: "meal", fields: { meal: tc.mealText } },
    ];
    const verdict = checkRisk({
      profile: {
        known_allergies: tc.profileAllergies,
        current_medications: [],
      },
      events,
    });

    const riskOk = tc.expectHigh
      ? verdict.riskLevel === "high"
      : verdict.riskLevel !== "high";
    const reasoningOk =
      (!tc.expectReasoningContains ||
        verdict.reasoning.toLowerCase().includes(tc.expectReasoningContains.toLowerCase())) &&
      (!tc.expectReasoningNotContains ||
        !verdict.reasoning.toLowerCase().includes(tc.expectReasoningNotContains.toLowerCase()));

    let metaOk = true;
    if (tc.expectMeta && verdict.meta) {
      metaOk =
        verdict.meta.severity === tc.expectMeta.severity &&
        verdict.meta.taxonomyVersion === tc.expectMeta.taxonomyVersion;
    } else if (tc.expectMeta && !verdict.meta) {
      metaOk = false;
    }

    const ok = riskOk && reasoningOk && metaOk;
    if (ok) {
      passed++;
      console.log(`✓ ${tc.name}`);
    } else {
      failed++;
      console.error(`✗ ${tc.name}`);
      if (!riskOk) {
        console.error(`  Expected riskLevel ${tc.expectHigh ? "high" : "not high"}, got ${verdict.riskLevel}`);
      }
      if (!reasoningOk) {
        console.error(`  Reasoning: ${verdict.reasoning}`);
      }
      if (!metaOk && tc.expectMeta) {
        console.error(
          `  Expected meta: ${JSON.stringify(tc.expectMeta)}, got: ${JSON.stringify(verdict.meta)}`
        );
      }
    }
  }

  // ── Phase 10H++: taxonomy version + getAllergenSeverity ─────────────
  if (ALLERGEN_TAXONOMY_VERSION === "10i.3") {
    passed++;
    console.log(`✓ ALLERGEN_TAXONOMY_VERSION === "10i.3"`);
  } else {
    failed++;
    console.error(
      `✗ ALLERGEN_TAXONOMY_VERSION: expected "10i.3", got "${ALLERGEN_TAXONOMY_VERSION}"`
    );
  }

  const severityTests = [
    { key: "tree_nut", expect: 90 },
    { key: "peanut", expect: 95 },
    { key: "shellfish", expect: 95 },
    { key: "unknown_xyz", expect: 50 },
  ];
  for (const st of severityTests) {
    const actual = getAllergenSeverity(st.key);
    if (actual === st.expect) {
      passed++;
      console.log(`✓ getAllergenSeverity("${st.key}") === ${st.expect}`);
    } else {
      failed++;
      console.error(
        `✗ getAllergenSeverity("${st.key}"): expected ${st.expect}, got ${actual}`
      );
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
