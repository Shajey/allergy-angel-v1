/**
 * Phase 13 – Vigilance Mode
 *
 * Tests computeVigilanceFromChecks with in-memory fixtures.
 * Asserts: vigilance active/inactive, trigger selection, deterministic ordering.
 */

import {
  computeVigilanceFromChecks,
  type VigilanceCheck,
} from "../api/_lib/vigilance/computeVigilance.js";

const profileId = "00000000-0000-0000-0000-000000000001";

const now = new Date();
function hoursAgo(h: number): string {
  return new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();
}

const checks: VigilanceCheck[] = [
  {
    id: "check-old-high",
    verdict: {
      riskLevel: "high",
      matched: [
        { rule: "allergy_match", details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 } },
      ],
      meta: { taxonomyVersion: "10i.3", severity: 90 },
    },
    created_at: hoursAgo(24),
  },
  {
    id: "check-recent-medium",
    verdict: {
      riskLevel: "medium",
      matched: [
        { rule: "cross_reactive", details: { matchedTerm: "mango", source: "tree_nut", severity: 100 } },
        { rule: "medication_interaction", details: { extracted: "ibuprofen", conflictsWith: "aspirin" } },
      ],
      meta: { taxonomyVersion: "10i.3", severity: 100 },
    },
    created_at: hoursAgo(2),
  },
  {
    id: "check-recent-none",
    verdict: { riskLevel: "none" },
    created_at: hoursAgo(1),
  },
];

function runTests(): void {
  let passed = 0;
  let failed = 0;

  // ── 1) windowHours=12: vigilanceActive=true, trigger is check-recent-medium ─
  const r1 = computeVigilanceFromChecks(profileId, checks, 12, now.toISOString());
  if (!r1.vigilanceActive) {
    failed++;
    console.error("✗ vigilanceActive should be true with medium-risk check within 12h window");
  } else if (r1.trigger?.checkId !== "check-recent-medium") {
    failed++;
    console.error(`✗ trigger should be check-recent-medium, got ${r1.trigger?.checkId}`);
  } else if (r1.trigger?.riskLevel !== "medium") {
    failed++;
    console.error(`✗ trigger.riskLevel should be medium, got ${r1.trigger?.riskLevel}`);
  } else {
    passed++;
    console.log("✓ vigilanceActive=true with correct trigger (check-recent-medium)");
  }

  // ── 2) windowHours=1: excludes medium check at 2h ago → vigilanceActive=false ─
  const recentOnly = checks.filter((c) => {
    const age = (now.getTime() - new Date(c.created_at).getTime()) / (60 * 60 * 1000);
    return age <= 1;
  });
  const r2 = computeVigilanceFromChecks(profileId, recentOnly, 1, now.toISOString());
  if (r2.vigilanceActive) {
    failed++;
    console.error("✗ vigilanceActive should be false when only none-risk checks in 1h window");
  } else {
    passed++;
    console.log("✓ vigilanceActive=false when medium check is outside window");
  }

  // ── 3) Matched terms sorted deterministically (alphabetical) ───────────
  if (r1.trigger) {
    const terms = r1.trigger.matched;
    // Expected: aspirin, ibuprofen, mango (alphabetical from cross_reactive + medication_interaction)
    const expected = ["aspirin", "ibuprofen", "mango"];
    if (JSON.stringify(terms) !== JSON.stringify(expected)) {
      failed++;
      console.error(`✗ matched terms should be ${JSON.stringify(expected)}, got ${JSON.stringify(terms)}`);
    } else {
      passed++;
      console.log("✓ matched terms sorted deterministically");
    }
  }

  // ── 4) All none-risk checks: vigilanceActive=false ─────────────────────
  const noneChecks: VigilanceCheck[] = [
    { id: "c1", verdict: { riskLevel: "none" }, created_at: hoursAgo(1) },
    { id: "c2", verdict: { riskLevel: "none" }, created_at: hoursAgo(3) },
  ];
  const r3 = computeVigilanceFromChecks(profileId, noneChecks, 12, now.toISOString());
  if (r3.vigilanceActive) {
    failed++;
    console.error("✗ vigilanceActive should be false when all checks are none-risk");
  } else {
    passed++;
    console.log("✓ vigilanceActive=false when all checks are none-risk");
  }

  // ── 5) severity and taxonomyVersion read from meta ─────────────────────
  if (r1.trigger) {
    if (r1.trigger.severity !== 100) {
      failed++;
      console.error(`✗ severity should be 100, got ${r1.trigger.severity}`);
    } else if (r1.trigger.taxonomyVersion !== "10i.3") {
      failed++;
      console.error(`✗ taxonomyVersion should be 10i.2, got ${r1.trigger.taxonomyVersion}`);
    } else {
      passed++;
      console.log("✓ severity and taxonomyVersion read from verdict.meta");
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
