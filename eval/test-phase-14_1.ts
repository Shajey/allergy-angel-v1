/**
 * Phase 14.1 – Actionable Advice Registry Contract Tests
 *
 * Deterministic, pure, no DB/network. Enforces:
 * - Registry shape + version
 * - Term advice overrides parent advice
 * - Deterministic output (two calls identical)
 * - Stable ordering (term before parent, then alphabetical by target)
 */

import assert from "node:assert";
import {
  ADVICE_REGISTRY_VERSION,
  ADVICE_REGISTRY,
  resolveAdviceForMatched,
  type AdviceEntry,
} from "../api/_lib/advice/adviceRegistry.js";

const ARRAY_KEYS = ["symptomsToWatch", "immediateActions", "education", "disclaimers"] as const;

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

  // ── A. Registry shape + version ───────────────────────────────────────

  test("A1: ADVICE_REGISTRY_VERSION is non-empty string", () => {
    assert.strictEqual(typeof ADVICE_REGISTRY_VERSION, "string");
    assert.ok(ADVICE_REGISTRY_VERSION.length > 0);
  });

  test("A2: ADVICE_REGISTRY exists and has at least one entry", () => {
    assert.ok(ADVICE_REGISTRY && typeof ADVICE_REGISTRY === "object");
    const entries = Object.values(ADVICE_REGISTRY);
    assert.ok(entries.length >= 1, "Registry must have at least one entry");
  });

  test("A3: every advice entry has target and deterministic string arrays", () => {
    for (const entry of Object.values(ADVICE_REGISTRY) as AdviceEntry[]) {
      assert.ok(entry.target, `Entry ${entry.id} must have target`);
      for (const key of ARRAY_KEYS) {
        const arr = entry[key];
        assert.ok(Array.isArray(arr), `Entry ${entry.id}.${key} must be array`);
        assert.ok(
          arr.every((x) => typeof x === "string"),
          `Entry ${entry.id}.${key} must contain only strings`
        );
        const sorted = [...arr].sort((a, b) => a.localeCompare(b));
        const sortedTwice = [...sorted].sort((a, b) => a.localeCompare(b));
        assert.deepStrictEqual(sorted, sortedTwice, `Entry ${entry.id}.${key} must sort deterministically`);
      }
    }
  });

  // ── B. Resolution logic (term override > parent) ──────────────────────

  /**
   * Minimal in-memory taxonomy for test isolation. Maps term → parent.
   * mango: no parent (cross-reactive, not taxonomy child)
   * almond, pistachio: tree_nut
   */
  const getParentForTerm = (term: string): string | null => {
    const t = term.toLowerCase().trim();
    if (["almond", "pistachio", "cashew", "walnut"].includes(t)) return "tree_nut";
    return null;
  };

  test("B1: mango has term advice, overrides parent (mango has no taxonomy parent)", () => {
    const matched = [{ matchedTerm: "mango", matchedCategory: "tree_nut" }];
    const advice = resolveAdviceForMatched(matched, getParentForTerm);
    assert.strictEqual(advice.length, 1);
    assert.strictEqual(advice[0].id, "term:mango");
    assert.strictEqual(advice[0].level, "term");
  });

  test("B2: almond has term advice, overrides parent:tree_nut", () => {
    const matched = [{ matchedTerm: "almond", matchedCategory: "tree_nut" }];
    const advice = resolveAdviceForMatched(matched, getParentForTerm);
    assert.strictEqual(advice.length, 1);
    assert.strictEqual(advice[0].id, "term:almond");
    assert.strictEqual(advice[0].level, "term");
  });

  test("B3: pistachio has no term advice, falls back to parent:tree_nut", () => {
    const matched = [{ matchedTerm: "pistachio", matchedCategory: "tree_nut" }];
    const advice = resolveAdviceForMatched(matched, getParentForTerm);
    assert.strictEqual(advice.length, 1);
    assert.strictEqual(advice[0].id, "parent:tree_nut");
    assert.strictEqual(advice[0].level, "parent");
  });

  // ── C. Deterministic output (two calls identical) ─────────────────────

  test("C: two calls with same input → deepStrictEqual", () => {
    const matched = [
      { matchedTerm: "mango", matchedCategory: "tree_nut" },
      { matchedTerm: "pistachio", matchedCategory: "tree_nut" },
    ];
    const out1 = resolveAdviceForMatched(matched, getParentForTerm);
    const out2 = resolveAdviceForMatched(matched, getParentForTerm);
    assert.deepStrictEqual(out1, out2);
  });

  // ── D. Ordering is stable ───────────────────────────────────────────

  /**
   * Phase 14.1 ordering: term advice before parent advice, then alphabetical by target.
   */
  test("D: multiple advice items sorted (term before parent, then by target)", () => {
    const matched = [
      { matchedTerm: "pistachio", matchedCategory: "tree_nut" },
      { matchedTerm: "mango", matchedCategory: "tree_nut" },
      { matchedTerm: "almond", matchedCategory: "tree_nut" },
    ];
    const advice = resolveAdviceForMatched(matched, getParentForTerm);
    assert.ok(advice.length >= 2);

    for (let i = 1; i < advice.length; i++) {
      const prev = advice[i - 1];
      const curr = advice[i];
      const prevLevelOrder = prev.level === "term" ? 0 : 1;
      const currLevelOrder = curr.level === "term" ? 0 : 1;
      assert.ok(
        currLevelOrder >= prevLevelOrder,
        `Order violation: ${prev.id} before ${curr.id} (term must come before parent)`
      );
      if (prevLevelOrder === currLevelOrder) {
        assert.ok(
          curr.target >= prev.target,
          `Order violation: ${prev.target} before ${curr.target} (alphabetical by target)`
        );
      }
    }
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
