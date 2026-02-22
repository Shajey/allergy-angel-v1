/**
 * Phase 15.2 – Risk Pressure Aggregation (Top-N Sum)
 *
 * Tests computeVigilanceFromChecks with topN_sum mode:
 * - Scenario A: one recent medium → single component
 * - Scenario B: three medium checks → sum of top 3 (capped at 100)
 * - Scenario C: many small checks → only top 3 counted
 * - Scenario D: old checks outside window excluded
 * - Scenario E: severity fallback when verdict.meta.severity missing
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

  // ── A) One recent medium → single component ──────────────────────────
  const scenarioA: VigilanceCheck[] = [
    {
      id: "check-a",
      verdict: {
        riskLevel: "medium",
        matched: [{ rule: "allergy_match", details: { allergen: "mango" } }],
        meta: { severity: 60 },
      },
      created_at: hoursAgo(0.5),
    },
  ];
  const rA = computeVigilanceFromChecks(
    profileId,
    scenarioA,
    12,
    now.toISOString()
  );
  const expectedA = Math.min(100, Math.round(60 * 1.0));
  if (rA.vigilanceScore !== expectedA) {
    failed++;
    console.error(`✗ A: expected score=${expectedA}; got ${rA.vigilanceScore}`);
  } else if (rA.aggregation?.mode !== "topN_sum" || rA.aggregation?.components?.length !== 1) {
    failed++;
    console.error(
      `✗ A: expected aggregation.mode=topN_sum, components=[60]; got ${JSON.stringify(rA.aggregation)}`
    );
  } else {
    passed++;
    console.log("✓ A: one recent medium → single component (60)");
  }

  // ── B) Three medium checks with different ages → sum top 3, capped 100 ─
  const scenarioB: VigilanceCheck[] = [
    { id: "b1", verdict: { riskLevel: "medium", meta: { severity: 40 } }, created_at: hoursAgo(2) },
    { id: "b2", verdict: { riskLevel: "medium", meta: { severity: 35 } }, created_at: hoursAgo(5) },
    { id: "b3", verdict: { riskLevel: "medium", meta: { severity: 30 } }, created_at: hoursAgo(10) },
  ];
  const rB = computeVigilanceFromChecks(profileId, scenarioB, 24, now.toISOString());
  const w1 = 40 * 0.75;
  const w2 = 35 * 0.75;
  const w3 = 30 * 0.5;
  const sumB = w1 + w2 + w3;
  const expectedB = Math.min(100, Math.round(sumB));
  if (rB.vigilanceScore !== expectedB) {
    failed++;
    console.error(`✗ B: expected score=${expectedB}; got ${rB.vigilanceScore}`);
  } else if (rB.aggregation?.components?.length !== 3) {
    failed++;
    console.error(
      `✗ B: expected 3 components; got ${rB.aggregation?.components?.length}`
    );
  } else {
    passed++;
    console.log(`✓ B: three medium checks → sum top 3 (${expectedB})`);
  }

  // ── C) Many small checks → only top 3 counted ────────────────────────
  const scenarioC: VigilanceCheck[] = [
    { id: "c1", verdict: { riskLevel: "medium", meta: { severity: 25 } }, created_at: hoursAgo(1) },
    { id: "c2", verdict: { riskLevel: "medium", meta: { severity: 24 } }, created_at: hoursAgo(2) },
    { id: "c3", verdict: { riskLevel: "medium", meta: { severity: 23 } }, created_at: hoursAgo(3) },
    { id: "c4", verdict: { riskLevel: "medium", meta: { severity: 22 } }, created_at: hoursAgo(4) },
    { id: "c5", verdict: { riskLevel: "medium", meta: { severity: 21 } }, created_at: hoursAgo(5) },
  ];
  const rC = computeVigilanceFromChecks(profileId, scenarioC, 24, now.toISOString());
  const sortedC = [25 * 1.0, 24 * 0.75, 23 * 0.75, 22 * 0.75, 21 * 0.75].sort((a, b) => b - a);
  const top3C = sortedC.slice(0, 3);
  const expectedC = Math.min(100, Math.round(top3C[0] + top3C[1] + top3C[2]));
  if (rC.vigilanceScore !== expectedC) {
    failed++;
    console.error(`✗ C: expected score=${expectedC}; got ${rC.vigilanceScore}`);
  } else if (rC.aggregation?.components?.length !== 3) {
    failed++;
    console.error(
      `✗ C: expected 3 components; got ${rC.aggregation?.components?.length}`
    );
  } else {
    passed++;
    console.log(`✓ C: many small checks → only top 3 counted (${expectedC})`);
  }

  // ── D) Old checks outside window excluded (empty = none in window) ──────
  const scenarioD: VigilanceCheck[] = [];
  const rD = computeVigilanceFromChecks(profileId, scenarioD, 24, now.toISOString());
  if (rD.vigilanceActive || rD.vigilanceScore !== 0) {
    failed++;
    console.error("✗ D: empty checks (outside window) → score 0, inactive");
  } else if (rD.aggregation?.components?.length !== 0) {
    failed++;
    console.error(`✗ D: expected 0 components; got ${rD.aggregation?.components?.length}`);
  } else {
    passed++;
    console.log("✓ D: no checks in window → score 0");
  }

  // D2: Very old check (24h) gets 0.25 weight → score 25 < 50, inactive
  const scenarioD2: VigilanceCheck[] = [
    {
      id: "d-old",
      verdict: { riskLevel: "high", meta: { severity: 100 } },
      created_at: hoursAgo(24),
    },
  ];
  const rD2 = computeVigilanceFromChecks(profileId, scenarioD2, 48, now.toISOString());
  if (rD2.vigilanceActive || rD2.vigilanceScore !== 25) {
    failed++;
    console.error(`✗ D2: 24h check weight 0.25 → score 25; got ${rD2.vigilanceScore}`);
  } else {
    passed++;
    console.log("✓ D: old check decayed → score 25 < 50 inactive");
  }

  // ── E) Severity fallback when verdict.meta.severity missing ───────────
  const scenarioE: VigilanceCheck[] = [
    {
      id: "e1",
      verdict: { riskLevel: "high" },
      created_at: hoursAgo(0.5),
    },
  ];
  const rE = computeVigilanceFromChecks(profileId, scenarioE, 12, now.toISOString());
  const expectedE = Math.min(100, Math.round(100 * 1.0));
  if (rE.vigilanceScore !== expectedE) {
    failed++;
    console.error(`✗ E: fallback high=100, expected ${expectedE}; got ${rE.vigilanceScore}`);
  } else if (rE.trigger?.rawSeverity !== 100) {
    failed++;
    console.error(`✗ E: trigger.rawSeverity should be 100; got ${rE.trigger?.rawSeverity}`);
  } else if ("hoursSince" in (rE.trigger ?? {})) {
    failed++;
    console.error("✗ E: trigger must not include hoursSince (nondeterministic)");
  } else {
    passed++;
    console.log("✓ E: severity fallback (high=100) when meta.severity missing");
  }

  // ── F) Determinism: two calls with same nowIso → identical JSON ─────────
  const scenarioF: VigilanceCheck[] = [
    {
      id: "f1",
      verdict: { riskLevel: "medium", meta: { severity: 70 } },
      created_at: hoursAgo(3),
    },
  ];
  const nowIso = now.toISOString();
  const rF1 = computeVigilanceFromChecks(profileId, scenarioF, 12, nowIso);
  const rF2 = computeVigilanceFromChecks(profileId, scenarioF, 12, nowIso);
  const json1 = JSON.stringify(rF1);
  const json2 = JSON.stringify(rF2);
  if (json1 !== json2) {
    failed++;
    console.error("✗ F: two calls with same nowIso must produce identical JSON");
  } else if ("hoursSince" in (rF1.trigger ?? {})) {
    failed++;
    console.error("✗ F: hoursSince must not appear in response");
  } else if (rF1.trigger?.ageBucket !== "1_to_6h") {
    failed++;
    console.error(`✗ F: 3h check should have ageBucket 1_to_6h; got ${rF1.trigger?.ageBucket}`);
  } else {
    passed++;
    console.log("✓ F: determinism — same nowIso → identical JSON, no hoursSince");
  }

  // ── Aggregation structure ────────────────────────────────────────────
  if (rA.aggregation?.mode !== "topN_sum" || rA.aggregation?.topN !== 3) {
    failed++;
    console.error(`✗ aggregation: expected mode=topN_sum, topN=3`);
  } else {
    passed++;
    console.log("✓ aggregation.mode=topN_sum, topN=3");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
