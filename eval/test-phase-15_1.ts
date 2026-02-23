/**
 * Phase 15.1 – Time-Weighted Risk Aggregation
 *
 * Tests computeVigilanceFromChecks with decay buckets:
 * - Recent medium check → high vigilanceScore
 * - Old medium check → reduced vigilanceScore
 * - Multiple checks → max weightedSeverity used
 * - Deterministic ordering preserved
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

function runTests(): void {
  let passed = 0;
  let failed = 0;

  // ── 1) Recent medium check → high vigilanceScore ─────────────────────
  const recentMedium: VigilanceCheck[] = [
    {
      id: "check-recent",
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "allergy_match", details: { allergen: "mango" } }],
        meta: { taxonomyVersion: "10i.3", severity: 80 },
      },
      created_at: hoursAgo(0.5),
    },
  ];
  const r1 = computeVigilanceFromChecks(
    profileId,
    recentMedium,
    12,
    now.toISOString()
  );
  const expectedScore1 = 80 * 1.0;
  if (!r1.vigilanceActive || r1.vigilanceScore !== expectedScore1) {
    failed++;
    console.error(
      `✗ Recent medium: expected vigilanceActive=true, score=${expectedScore1}; got active=${r1.vigilanceActive}, score=${r1.vigilanceScore}`
    );
  } else if (!r1.decayApplied) {
    failed++;
    console.error("✗ decayApplied should be true");
  } else {
    passed++;
    console.log("✓ Recent medium check → high vigilanceScore (80)");
  }

  // ── 2) Old medium check → reduced vigilanceScore ─────────────────────
  const oldMedium: VigilanceCheck[] = [
    {
      id: "check-old",
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "allergy_match", details: { allergen: "cashew" } }],
        meta: { taxonomyVersion: "10i.3", severity: 80 },
      },
      created_at: hoursAgo(24),
    },
  ];
  const r2 = computeVigilanceFromChecks(profileId, oldMedium, 48, now.toISOString());
  const expectedScore2 = 80 * 0.25;
  if (r2.vigilanceScore !== expectedScore2) {
    failed++;
    console.error(
      `✗ Old medium: expected score=${expectedScore2} (80*0.25); got ${r2.vigilanceScore}`
    );
  } else if (r2.vigilanceActive) {
    failed++;
    console.error(
      `✗ Old medium: score ${expectedScore2} < 50 threshold, vigilanceActive should be false`
    );
  } else {
    passed++;
    console.log("✓ Old medium check → reduced vigilanceScore (20)");
  }

  // ── 3) Multiple checks → topN sum (Phase 15.2) ───────────────────────
  const multiple: VigilanceCheck[] = [
    {
      id: "check-8h",
      verdict: {
        riskLevel: "high",
        matched: [{ rule: "allergy_match", details: { allergen: "peanut" } }],
        meta: { severity: 90 },
      },
      created_at: hoursAgo(8),
    },
    {
      id: "check-2h",
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "cross_reactive", details: { matchedTerm: "mango" } }],
        meta: { severity: 70 },
      },
      created_at: hoursAgo(2),
    },
  ];
  const r3 = computeVigilanceFromChecks(profileId, multiple, 24, now.toISOString());
  const score8h = 90 * 0.5;
  const score2h = 70 * 0.75;
  const expectedScore3 = Math.min(100, Math.round(score8h + score2h));
  if (r3.vigilanceScore !== expectedScore3) {
    failed++;
    console.error(
      `✗ Multiple: expected topN sum=${expectedScore3}; got ${r3.vigilanceScore}`
    );
  } else if (r3.trigger?.checkId !== "check-2h") {
    failed++;
    console.error(
      `✗ Multiple: trigger should be check-2h (highest weighted); got ${r3.trigger?.checkId}`
    );
  } else {
    passed++;
    console.log("✓ Multiple checks → topN sum (98)");
  }

  // ── 4) Back-compat: derive severity from riskLevel when meta.severity missing ─
  const noMetaSeverity: VigilanceCheck[] = [
    {
      id: "check-high-no-meta",
      verdict: { riskLevel: "high", matched: [] },
      created_at: hoursAgo(0.5),
    },
  ];
  const r4a = computeVigilanceFromChecks(
    profileId,
    noMetaSeverity,
    12,
    now.toISOString()
  );
  const expectedDerived = 100 * 1.0;
  if (r4a.vigilanceScore !== expectedDerived) {
    failed++;
    console.error(
      `✗ Back-compat: high without meta.severity should derive 100; got ${r4a.vigilanceScore}`
    );
  } else {
    passed++;
    console.log("✓ Back-compat: derive severity from riskLevel (high=100)");
  }

  // ── 5) hoursSinceCheck negative clamp (future check → 0) ─────────────
  const futureCheck: VigilanceCheck[] = [
    {
      id: "check-future",
      verdict: {
        riskLevel: "medium",
        matched: [],
        meta: { severity: 60 },
      },
      created_at: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    },
  ];
  const r5 = computeVigilanceFromChecks(
    profileId,
    futureCheck,
    24,
    now.toISOString()
  );
  if (r5.vigilanceScore !== 60) {
    failed++;
    console.error(
      `✗ Future check: hoursSinceCheck clamped to 0, weight=1.0, score should be 60; got ${r5.vigilanceScore}`
    );
  } else {
    passed++;
    console.log("✓ hoursSinceCheck negative clamp (future → 0)");
  }

  // ── 6) Deterministic ordering preserved (tie-break: most recent) ──────
  const tieChecks: VigilanceCheck[] = [
    {
      id: "check-old-tie",
      verdict: {
        riskLevel: "medium",
        matched: [],
        meta: { severity: 100 },
      },
      created_at: hoursAgo(10),
    },
    {
      id: "check-new-tie",
      verdict: {
        riskLevel: "medium",
        matched: [],
        meta: { severity: 100 },
      },
      created_at: hoursAgo(3),
    },
  ];
  const r6 = computeVigilanceFromChecks(profileId, tieChecks, 24, now.toISOString());
  const oldWeighted = 100 * 0.5;
  const newWeighted = 100 * 0.75;
  if (r6.trigger?.checkId !== "check-new-tie") {
    failed++;
    console.error(
      `✗ Tie-break: expected check-new-tie (weight ${newWeighted} > ${oldWeighted}); got ${r6.trigger?.checkId}`
    );
  } else {
    passed++;
    console.log("✓ Deterministic ordering preserved (max wins)");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
