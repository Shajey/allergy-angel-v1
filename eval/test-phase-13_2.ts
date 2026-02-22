/**
 * Phase 13.2 – Recent Triggers Tests
 *
 * Tests the pure helper computeRecentTriggersFromChecks.
 * Asserts:
 * - filters only medium/high
 * - sort order: createdAt desc, tie-breaker checkId asc
 * - matched terms normalized (dedupe + sort)
 * - limit respected
 */

import {
  computeRecentTriggersFromChecks,
  type RecentTriggerCheck,
} from "../api/_lib/vigilance/recentTriggers.js";

const CHECKS: RecentTriggerCheck[] = [
  {
    id: "chk-003",
    verdict: { riskLevel: "none" },
    created_at: "2026-02-21T12:00:00.000Z",
  },
  {
    id: "chk-001",
    verdict: {
      riskLevel: "high",
      matched: [
        { rule: "allergy_match", details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 } },
        { rule: "allergy_match", details: { allergen: "walnut", matchedCategory: "tree_nut", severity: 90 } },
      ],
      meta: { taxonomyVersion: "10i.2", severity: 90 },
    },
    created_at: "2026-02-21T10:00:00.000Z",
  },
  {
    id: "chk-002",
    verdict: {
      riskLevel: "medium",
      matched: [
        { rule: "cross_reactive", details: { matchedTerm: "mango", source: "tree_nut", severity: 100 } },
      ],
      meta: { taxonomyVersion: "10i.2", severity: 100 },
    },
    created_at: "2026-02-21T11:00:00.000Z",
  },
  {
    id: "chk-004",
    verdict: {
      riskLevel: "medium",
      matched: [
        { rule: "medication_interaction", details: { extracted: "ibuprofen", conflictsWith: "aspirin" } },
      ],
      meta: { severity: 50 },
    },
    created_at: "2026-02-21T11:00:00.000Z",
  },
  {
    id: "chk-005",
    verdict: { riskLevel: "none" },
    created_at: "2026-02-21T09:00:00.000Z",
  },
];

function runTests(): void {
  let passed = 0;
  let failed = 0;

  // ── 1) Filters only medium/high, excludes none ───────────────────────
  const all = computeRecentTriggersFromChecks(CHECKS, 50);
  if (all.length !== 3) {
    failed++;
    console.error(`✗ should have 3 triggers (medium/high only), got ${all.length}`);
  } else {
    passed++;
    console.log("✓ filters only medium/high checks");
  }

  // ── 2) Sort order: createdAt desc ────────────────────────────────────
  const triggers = computeRecentTriggersFromChecks(CHECKS, 50);
  const firstIsNewest = triggers[0].createdAt === "2026-02-21T11:00:00.000Z";
  const lastIsOldest = triggers[triggers.length - 1].createdAt === "2026-02-21T10:00:00.000Z";
  if (!firstIsNewest || !lastIsOldest) {
    failed++;
    console.error(`✗ triggers should be sorted createdAt desc, got [${triggers.map((t) => t.createdAt).join(", ")}]`);
  } else {
    passed++;
    console.log("✓ sorted by createdAt desc");
  }

  // ── 3) Tie-breaker: same createdAt → checkId asc ────────────────────
  const tied = triggers.filter((t) => t.createdAt === "2026-02-21T11:00:00.000Z");
  if (tied.length !== 2) {
    failed++;
    console.error(`✗ expected 2 triggers at same time, got ${tied.length}`);
  } else if (tied[0].checkId !== "chk-002" || tied[1].checkId !== "chk-004") {
    failed++;
    console.error(`✗ tie-breaker should be checkId asc: expected [chk-002, chk-004], got [${tied[0].checkId}, ${tied[1].checkId}]`);
  } else {
    passed++;
    console.log("✓ tie-breaker: checkId asc");
  }

  // ── 4) Matched terms deduped and sorted alphabetically ──────────────
  const highTrigger = triggers.find((t) => t.checkId === "chk-001");
  if (!highTrigger) {
    failed++;
    console.error("✗ chk-001 not found in triggers");
  } else {
    const expected = ["cashew", "walnut"];
    if (JSON.stringify(highTrigger.matched) !== JSON.stringify(expected)) {
      failed++;
      console.error(`✗ matched should be ${JSON.stringify(expected)}, got ${JSON.stringify(highTrigger.matched)}`);
    } else {
      passed++;
      console.log("✓ matched terms deduped and sorted alphabetically");
    }
  }

  // ── 5) Medication interaction terms extracted ────────────────────────
  const medTrigger = triggers.find((t) => t.checkId === "chk-004");
  if (!medTrigger) {
    failed++;
    console.error("✗ chk-004 not found in triggers");
  } else {
    const expected = ["aspirin", "ibuprofen"];
    if (JSON.stringify(medTrigger.matched) !== JSON.stringify(expected)) {
      failed++;
      console.error(`✗ med matched should be ${JSON.stringify(expected)}, got ${JSON.stringify(medTrigger.matched)}`);
    } else {
      passed++;
      console.log("✓ medication interaction terms extracted and sorted");
    }
  }

  // ── 6) Limit respected ──────────────────────────────────────────────
  const limited = computeRecentTriggersFromChecks(CHECKS, 2);
  if (limited.length !== 2) {
    failed++;
    console.error(`✗ limit=2 should return 2 triggers, got ${limited.length}`);
  } else {
    passed++;
    console.log("✓ limit respected");
  }

  // ── 7) Empty input returns empty ────────────────────────────────────
  const empty = computeRecentTriggersFromChecks([], 10);
  if (empty.length !== 0) {
    failed++;
    console.error(`✗ empty input should return 0 triggers, got ${empty.length}`);
  } else {
    passed++;
    console.log("✓ empty input returns empty");
  }

  // ── 8) All-none input returns empty ─────────────────────────────────
  const noneChecks: RecentTriggerCheck[] = [
    { id: "n1", verdict: { riskLevel: "none" }, created_at: "2026-02-21T12:00:00.000Z" },
    { id: "n2", verdict: { riskLevel: "none" }, created_at: "2026-02-21T11:00:00.000Z" },
  ];
  const noneResult = computeRecentTriggersFromChecks(noneChecks, 10);
  if (noneResult.length !== 0) {
    failed++;
    console.error("✗ all-none checks should return empty");
  } else {
    passed++;
    console.log("✓ all-none checks returns empty");
  }

  // ── 9) severity and taxonomyVersion carried through ─────────────────
  if (highTrigger!.severity !== 90) {
    failed++;
    console.error(`✗ severity should be 90, got ${highTrigger!.severity}`);
  } else if (highTrigger!.taxonomyVersion !== "10i.2") {
    failed++;
    console.error(`✗ taxonomyVersion should be "10i.2", got "${highTrigger!.taxonomyVersion}"`);
  } else {
    passed++;
    console.log("✓ severity and taxonomyVersion carried through");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
