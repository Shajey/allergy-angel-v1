/**
 * Phase 14.2 – Care Loop Contract Tests
 *
 * Deterministic, pure, no DB/network. Enforces:
 * - buildCheckReport advice block: same matched terms → identical output
 * - Term overrides parent, cap 3, alphabetical tie-breaker
 * - General Safety fallback when match exists but no registry advice
 */

import assert from "node:assert";
import { buildCheckReport } from "../api/_lib/report/buildCheckReport.js";

const CHECK_ID = "a0000000-0000-0000-0000-000000000001";
const PROFILE_ID = "a0000000-0000-0000-0000-000000000002";
const CREATED_AT = "2025-01-15T12:00:00.000Z";

function makeCheck(verdict: {
  riskLevel: "none" | "medium" | "high";
  reasoning: string;
  matched?: Array<{ rule: string; details: Record<string, unknown> }>;
  meta?: Record<string, unknown>;
}) {
  return {
    id: CHECK_ID,
    profile_id: PROFILE_ID,
    created_at: CREATED_AT,
    raw_text: "test",
    verdict,
  };
}

function runTests(): void {
  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void): void {
    try {
      fn();
      passed++;
      console.log(`✓ ${name}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${name}\n  ${msg}`);
    }
  }

  // ── A. Mango care flow (cross-reactive, term advice) ───────────────────

  test("A: mango + tree_nut → term:mango advice, topTarget mango", () => {
    const check = makeCheck({
      riskLevel: "medium",
      reasoning: "Cross-reactive.",
      matched: [
        {
          rule: "cross_reactive",
          details: {
            meal: "mango smoothie",
            source: "tree_nut",
            matchedTerm: "mango",
            severity: 100,
          },
        },
      ],
      meta: { taxonomyVersion: "10i.3", crossReactive: true },
    });

    const report = buildCheckReport({
      check,
      events: [],
      generatedAt: CREATED_AT,
    });

    const advice = report.output.advice;
    assert.ok(advice, "advice block must exist");
    assert.strictEqual(advice.version, "14a.1");
    assert.strictEqual(advice.items.length, 1);
    assert.strictEqual(advice.items[0].id, "term:mango");
    assert.strictEqual(advice.items[0].title, "Mango (Cross-Reactive with Latex/Tree Nut)");
    assert.strictEqual(advice.topTarget, "mango");
  });

  // ── B. Determinism: two calls identical ──────────────────────────────

  test("B: same matched terms → identical advice (deepStrictEqual)", () => {
    const check = makeCheck({
      riskLevel: "high",
      reasoning: "Allergy match.",
      matched: [
        {
          rule: "allergy_match",
          details: {
            meal: "pistachio ice cream",
            allergen: "pistachio",
            matchedCategory: "tree_nut",
            severity: 90,
          },
        },
        {
          rule: "cross_reactive",
          details: {
            meal: "mango",
            source: "tree_nut",
            matchedTerm: "mango",
            severity: 100,
          },
        },
      ],
      meta: { taxonomyVersion: "10i.3" },
    });

    const r1 = buildCheckReport({ check, events: [], generatedAt: CREATED_AT });
    const r2 = buildCheckReport({ check, events: [], generatedAt: CREATED_AT });

    assert.deepStrictEqual(r1.output.advice, r2.output.advice);
  });

  // ── C. Ordering: term before parent, alphabetical ──────────────────────

  test("C: advice items ordered (term before parent, alphabetical by target)", () => {
    const check = makeCheck({
      riskLevel: "high",
      reasoning: "Multiple matches.",
      matched: [
        {
          rule: "allergy_match",
          details: {
            meal: "pistachio and almond",
            allergen: "pistachio",
            matchedCategory: "tree_nut",
            severity: 90,
          },
        },
        {
          rule: "allergy_match",
          details: {
            meal: "almond",
            allergen: "almond",
            matchedCategory: "tree_nut",
            severity: 90,
          },
        },
        {
          rule: "cross_reactive",
          details: {
            meal: "mango",
            source: "tree_nut",
            matchedTerm: "mango",
            severity: 100,
          },
        },
      ],
      meta: { taxonomyVersion: "10i.3" },
    });

    const report = buildCheckReport({
      check,
      events: [],
      generatedAt: CREATED_AT,
    });

    const advice = report.output.advice;
    assert.ok(advice && advice.items.length >= 2);

    for (let i = 1; i < advice.items.length; i++) {
      const prev = advice.items[i - 1];
      const curr = advice.items[i];
      const prevOrder = prev.level === "term" ? 0 : 1;
      const currOrder = curr.level === "term" ? 0 : 1;
      assert.ok(currOrder >= prevOrder, `Order: ${prev.id} before ${curr.id}`);
      if (prevOrder === currOrder) {
        assert.ok(
          curr.target >= prev.target,
          `Alphabetical: ${prev.target} before ${curr.target}`
        );
      }
    }
  });

  // ── D. Cap at 3 ──────────────────────────────────────────────────────

  test("D: advice items capped at 3", () => {
    const check = makeCheck({
      riskLevel: "high",
      reasoning: "Multiple matches.",
      matched: [
        { rule: "allergy_match", details: { allergen: "almond", matchedCategory: "tree_nut", meal: "a", severity: 90 } },
        { rule: "allergy_match", details: { allergen: "pistachio", matchedCategory: "tree_nut", meal: "b", severity: 90 } },
        { rule: "cross_reactive", details: { matchedTerm: "mango", source: "tree_nut", meal: "c", severity: 100 } },
        { rule: "allergy_match", details: { allergen: "shrimp", matchedCategory: "shellfish", meal: "d", severity: 95 } },
      ],
      meta: { taxonomyVersion: "10i.3" },
    });

    const report = buildCheckReport({
      check,
      events: [],
      generatedAt: CREATED_AT,
    });

    const advice = report.output.advice;
    assert.ok(advice);
    assert.ok(advice.items.length <= 3, `Expected ≤3 items, got ${advice.items.length}`);
  });

  // ── E. General Safety fallback (match but no registry advice) ─────────

  test("E: match with no registry advice → General Safety fallback", () => {
    const check = makeCheck({
      riskLevel: "high",
      reasoning: "Allergy match.",
      matched: [
        {
          rule: "allergy_match",
          details: {
            meal: "coconut flakes",
            allergen: "coconut",
            matchedCategory: "unknown",
            severity: 50,
          },
        },
      ],
      meta: { taxonomyVersion: "10i.3" },
    });

    const report = buildCheckReport({
      check,
      events: [],
      generatedAt: CREATED_AT,
    });

    const advice = report.output.advice;
    assert.ok(advice, "advice block must exist when allergy matched");
    assert.strictEqual(advice.items.length, 1);
    assert.strictEqual(advice.items[0].id, "fallback:general_safety");
    assert.strictEqual(advice.items[0].title, "General Safety");
    assert.strictEqual(advice.topTarget, "general");
  });

  // ── F. No allergy match → no advice block ─────────────────────────────

  test("F: no allergy/cross_reactive match → no advice block", () => {
    const check = makeCheck({
      riskLevel: "none",
      reasoning: "No known risks detected.",
      matched: [],
      meta: { taxonomyVersion: "10i.3", severity: 0 },
    });

    const report = buildCheckReport({
      check,
      events: [],
      generatedAt: CREATED_AT,
    });

    assert.strictEqual(report.output.advice, undefined);
  });

  test("F2: medication_interaction only → no advice block", () => {
    const check = makeCheck({
      riskLevel: "medium",
      reasoning: "Medication interaction.",
      matched: [
        {
          rule: "medication_interaction",
          details: { extracted: "ibuprofen", conflictsWith: "aspirin" },
        },
      ],
      meta: { taxonomyVersion: "10i.3" },
    });

    const report = buildCheckReport({
      check,
      events: [],
      generatedAt: CREATED_AT,
    });

    assert.strictEqual(report.output.advice, undefined);
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
