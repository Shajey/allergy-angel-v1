/**
 * Phase 12.6 – Linguistic Variants (Deterministic Alias Bridge)
 *
 * 4.1 Plural Success: mangoes, mangos trigger mango advice
 * 4.2 Anti-Match Barrier: mangrove, mangojuice, mangoe do NOT match
 * 4.3 Exact Match Integrity: peanut still matches, no regression
 * 4.4 Alias Map Determinism: CANONICAL_MAP identical across loads, aliases sorted
 */

import { checkRisk } from "../api/_lib/inference/checkRisk.js";
import {
  resolveToCanonical,
  ALIASES,
} from "../api/_lib/inference/allergenTaxonomy.js";

// ── 4.1 Plural Success ─────────────────────────────────────────────────

function testPluralSuccess(): void {
  const cases = [
    { meal: "mangoes chutney", expect: "mango" },
    { meal: "mangos smoothie", expect: "mango" },
  ];
  for (const { meal, expect } of cases) {
    const verdict = checkRisk({
      profile: { known_allergies: ["tree_nut"], current_medications: [] },
      events: [{ type: "meal", fields: { meal } }],
    });
    const matched = verdict.matched?.find((m) => m.rule === "cross_reactive");
    const matchedTerm = matched?.details?.matchedTerm as string | undefined;
    if (verdict.riskLevel !== "medium" || matchedTerm !== expect) {
      throw new Error(
        `4.1 Plural: "${meal}" => expected medium + matchedTerm=${expect}, got riskLevel=${verdict.riskLevel} matchedTerm=${matchedTerm}`
      );
    }
  }
  console.log("  4.1 Plural Success: mangoes, mangos → mango ✓");
}

// ── 4.2 Anti-Match Barrier ────────────────────────────────────────────

function testAntiMatchBarrier(): void {
  const cases = [
    { meal: "mangrove tea", expect: "none" },
    { meal: "mangojuice", expect: "none" },
    { meal: "mangoe salad", expect: "none" },
  ];
  for (const { meal, expect } of cases) {
    const verdict = checkRisk({
      profile: { known_allergies: ["tree_nut"], current_medications: [] },
      events: [{ type: "meal", fields: { meal } }],
    });
    if (verdict.riskLevel !== expect) {
      throw new Error(
        `4.2 Anti-Match: "${meal}" => expected ${expect}, got ${verdict.riskLevel}`
      );
    }
  }
  console.log("  4.2 Anti-Match Barrier: mangrove, mangojuice, mangoe → no match ✓");
}

// ── 4.3 Exact Match Integrity ─────────────────────────────────────────

function testExactMatchIntegrity(): void {
  const verdict = checkRisk({
    profile: { known_allergies: ["peanut"], current_medications: [] },
    events: [{ type: "meal", fields: { meal: "peanut butter" } }],
  });
  if (verdict.riskLevel !== "high") {
    throw new Error(
      `4.3 Exact: peanut => expected high, got ${verdict.riskLevel}`
    );
  }
  const matched = verdict.matched?.find((m) => m.rule === "allergy_match");
  const allergen = matched?.details?.allergen as string | undefined;
  if (allergen !== "peanut") {
    throw new Error(`4.3 Exact: expected allergen=peanut, got ${allergen}`);
  }
  console.log("  4.3 Exact Match Integrity: peanut → peanut ✓");
}

// ── 4.4 Alias Map Determinism ─────────────────────────────────────────

function testAliasMapDeterminism(): void {
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    const sorted = [...aliases].sort((a, b) => a.localeCompare(b));
    if (JSON.stringify(aliases) !== JSON.stringify(sorted)) {
      throw new Error(
        `4.4 Alias arrays must be sorted: ${canonical} has unsorted aliases`
      );
    }
    const seen = new Set<string>();
    for (const a of aliases) {
      const norm = a.toLowerCase().trim();
      if (seen.has(norm)) {
        throw new Error(`4.4 No duplicates: ${canonical} has duplicate ${a}`);
      }
      seen.add(norm);
    }
  }

  const r1 = resolveToCanonical("mangoes");
  const r2 = resolveToCanonical("mangoes");
  if (r1 !== r2 || r1 !== "mango") {
    throw new Error(`4.4 CANONICAL_MAP determinism: mangoes => ${r1}, ${r2}`);
  }
  console.log("  4.4 Alias Map Determinism: sorted, no duplicates, identical across lookups ✓");
}

// ── Main ──────────────────────────────────────────────────────────────

function main(): void {
  console.log("\n=== Phase 12.6 – Linguistic Variants ===\n");
  testPluralSuccess();
  testAntiMatchBarrier();
  testExactMatchIntegrity();
  testAliasMapDeterminism();
  console.log("\nPhase 12.6 PASSED\n");
}

main();
