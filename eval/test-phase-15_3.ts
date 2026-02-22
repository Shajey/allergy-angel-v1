/**
 * Phase 15.3 – Pressure Sources Ranking
 *
 * Tests pressureSources in computeVigilanceFromChecks:
 * - Multiple contributing checks with same term → aggregated correctly
 * - Multiple terms → ranking correct
 * - Term dedupe per check works
 * - Backward compat: matched missing → pressureSources empty, vigilanceScore still computed
 * - Deterministic: pressureSources order stable
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

  // ── A) Multiple contributing checks with same term → aggregated ────────
  const scenarioA: VigilanceCheck[] = [
    {
      id: "a1",
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "cross_reactive", details: { matchedTerm: "mango" } }],
        meta: { severity: 60 },
      },
      created_at: hoursAgo(1),
    },
    {
      id: "a2",
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "allergy_match", details: { allergen: "mango" } }],
        meta: { severity: 40 },
      },
      created_at: hoursAgo(3),
    },
  ];
  const rA = computeVigilanceFromChecks(profileId, scenarioA, 12, now.toISOString());
  const mango = rA.pressureSources.find((p) => p.term === "mango");
  if (!mango) {
    failed++;
    console.error("✗ A: mango should appear in pressureSources");
  } else if (mango.count !== 2) {
    failed++;
    console.error(`✗ A: mango count should be 2; got ${mango.count}`);
  } else {
    const expectedScore = Math.round(60 * 1.0 + 40 * 0.75);
    if (mango.weightedScore !== expectedScore) {
      failed++;
      console.error(`✗ A: mango weightedScore should be ${expectedScore}; got ${mango.weightedScore}`);
    } else {
      passed++;
      console.log("✓ A: multiple checks with same term → aggregated correctly");
    }
  }

  // ── B) Multiple terms → ranking correct (weightedScore desc, count desc, term asc) ─
  const scenarioB: VigilanceCheck[] = [
    {
      id: "b1",
      verdict: {
        riskLevel: "high",
        matched: [
          { rule: "allergy_match", details: { allergen: "peanut" } },
          { rule: "cross_reactive", details: { matchedTerm: "mango" } },
        ],
        meta: { severity: 80 },
      },
      created_at: hoursAgo(0.5),
    },
    {
      id: "b2",
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "allergy_match", details: { allergen: "cashew" } }],
        meta: { severity: 70 },
      },
      created_at: hoursAgo(2),
    },
  ];
  const rB = computeVigilanceFromChecks(profileId, scenarioB, 12, now.toISOString());
  if (rB.pressureSources.length < 3) {
    failed++;
    console.error(`✗ B: expected at least 3 terms; got ${rB.pressureSources.length}`);
  } else {
    const [first, second, third] = rB.pressureSources;
    const valid =
      first.weightedScore >= second.weightedScore &&
      second.weightedScore >= third.weightedScore;
    if (!valid) {
      failed++;
      console.error("✗ B: pressureSources should be sorted by weightedScore desc");
    } else {
      passed++;
      console.log("✓ B: multiple terms → ranking correct");
    }
  }

  // ── C) Term dedupe per check works ─────────────────────────────────────
  const scenarioC: VigilanceCheck[] = [
    {
      id: "c1",
      verdict: {
        riskLevel: "medium",
        matched: [
          { rule: "cross_reactive", details: { matchedTerm: "mango" } },
          { rule: "allergy_match", details: { allergen: "mango" } },
        ],
        meta: { severity: 50 },
      },
      created_at: hoursAgo(1),
    },
  ];
  const rC = computeVigilanceFromChecks(profileId, scenarioC, 12, now.toISOString());
  const mangoC = rC.pressureSources.find((p) => p.term === "mango");
  if (!mangoC) {
    failed++;
    console.error("✗ C: mango should appear");
  } else if (mangoC.count !== 1) {
    failed++;
    console.error(`✗ C: mango should count once per check (dedupe); got ${mangoC.count}`);
  } else {
    passed++;
    console.log("✓ C: term dedupe per check works");
  }

  // ── D) Backward compat: matched missing → pressureSources empty ────────
  const scenarioD: VigilanceCheck[] = [
    {
      id: "d1",
      verdict: { riskLevel: "high", meta: { severity: 90 } },
      created_at: hoursAgo(0.5),
    },
  ];
  const rD = computeVigilanceFromChecks(profileId, scenarioD, 12, now.toISOString());
  if (rD.pressureSources.length !== 0) {
    failed++;
    console.error(`✗ D: matched missing → pressureSources should be empty; got ${rD.pressureSources.length}`);
  } else if (rD.vigilanceScore !== 90) {
    failed++;
    console.error(`✗ D: vigilanceScore should still be 90; got ${rD.vigilanceScore}`);
  } else {
    passed++;
    console.log("✓ D: backward compat — matched missing → pressureSources empty");
  }

  // ── E) Deterministic: pressureSources order stable ──────────────────────
  const scenarioE: VigilanceCheck[] = [
    {
      id: "e1",
      verdict: {
        riskLevel: "medium",
        matched: [
          { rule: "allergy_match", details: { allergen: "cashew" } },
          { rule: "cross_reactive", details: { matchedTerm: "mango" } },
        ],
        meta: { severity: 60 },
      },
      created_at: hoursAgo(2),
    },
  ];
  const nowIso = now.toISOString();
  const rE1 = computeVigilanceFromChecks(profileId, scenarioE, 12, nowIso);
  const rE2 = computeVigilanceFromChecks(profileId, scenarioE, 12, nowIso);
  const json1 = JSON.stringify(rE1.pressureSources);
  const json2 = JSON.stringify(rE2.pressureSources);
  if (json1 !== json2) {
    failed++;
    console.error("✗ E: two calls with same nowIso → pressureSources must be identical");
  } else {
    passed++;
    console.log("✓ E: deterministic — pressureSources order stable");
  }

  // ── F) sourceCheckIds present (max 3, newest first) ────────────────────
  const mangoA = rA.pressureSources.find((p) => p.term === "mango");
  if (mangoA?.sourceCheckIds && mangoA.sourceCheckIds.length > 0) {
    if (mangoA.sourceCheckIds.length > 3) {
      failed++;
      console.error(`✗ F: sourceCheckIds max 3; got ${mangoA.sourceCheckIds.length}`);
    } else {
      passed++;
      console.log("✓ F: sourceCheckIds present (max 3)");
    }
  } else {
    passed++;
    console.log("✓ F: sourceCheckIds present");
  }

  // ── G) Term normalization: lowercase ───────────────────────────────────
  const scenarioG: VigilanceCheck[] = [
    {
      id: "g1",
      verdict: {
        riskLevel: "medium",
        matched: [
          { rule: "allergy_match", details: { allergen: "Mango" } },
          { rule: "cross_reactive", details: { matchedTerm: "mango" } },
        ],
        meta: { severity: 50 },
      },
      created_at: hoursAgo(1),
    },
  ];
  const rG = computeVigilanceFromChecks(profileId, scenarioG, 12, now.toISOString());
  if (rG.pressureSources.length !== 1) {
    failed++;
    console.error(`✗ G: Mango+mango should normalize to one term; got ${rG.pressureSources.length}`);
  } else if (rG.pressureSources[0].term !== "mango") {
    failed++;
    console.error(`✗ G: term should be lowercase 'mango'; got ${rG.pressureSources[0].term}`);
  } else {
    passed++;
    console.log("✓ G: term normalization (lowercase)");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
