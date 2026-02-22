/**
 * Phase 12.2 – Replay Validator Tests
 *
 * Tests diff logic with toy taxonomies. Asserts:
 * - normalization is stable (sorted lists)
 * - diff identifies addedMatches/removedMatches deterministically
 * - gating fails/passes correctly based on allowlist
 * - 12.2y: fingerprinted allowlist pass/fail, backward compat with legacy
 */

import { resolve } from "path";
import { loadAllergenTaxonomy } from "../api/_lib/knowledge/loadAllergenTaxonomy.js";
import { checkRiskWithTaxonomy } from "../api/_lib/eval/replayCheckRisk.js";
import {
  normalizeVerdict,
  computeReplayDiff,
  buildReplayReport,
  evaluateGate,
  legacyAllowlist,
  parseAllowlist,
} from "../api/_lib/eval/replayDiff.js";
import type { Verdict } from "../api/_lib/inference/checkRisk.js";

const FIXTURES = resolve(process.cwd(), "eval/fixtures/replay");

function runTests(): void {
  let passed = 0;
  let failed = 0;

  const baseline = loadAllergenTaxonomy(resolve(FIXTURES, "knowledge/baseline-taxonomy.json"));
  const candidate = loadAllergenTaxonomy(resolve(FIXTURES, "knowledge/candidate-taxonomy.json"));

  const profile = {
    known_allergies: ["tree_nut"],
    current_medications: [] as { name: string; dosage?: string }[],
  };

  // ── 1) Normalization is stable (sorted lists) ────────────────────────
  const verdictHigh: Verdict = {
    riskLevel: "high",
    reasoning: "Match.",
    matched: [
      { rule: "allergy_match", details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 } },
      { rule: "allergy_match", details: { allergen: "walnut", matchedCategory: "tree_nut", severity: 90 } },
    ],
    meta: { taxonomyVersion: "test", severity: 90, matchedCategory: "tree_nut", matchedChild: "cashew" },
  };
  const norm = normalizeVerdict(verdictHigh, "v1", null);
  if (norm.matchedTerms[0] !== "cashew" || norm.matchedTerms[1] !== "walnut") {
    failed++;
    console.error(`✗ matchedTerms should be sorted: expected [cashew, walnut], got [${norm.matchedTerms.join(", ")}]`);
  } else {
    passed++;
    console.log("✓ normalization produces sorted matchedTerms");
  }

  // ── 2) Diff identifies addedMatches/removedMatches deterministically ─
  const eventsTigerNut = [
    { type: "meal" as const, event_data: { meal: "tiger nut milk" } },
  ];
  const baselineVerdict = checkRiskWithTaxonomy(profile, eventsTigerNut, baseline);
  const candidateVerdict = checkRiskWithTaxonomy(profile, eventsTigerNut, candidate);

  const baselineNorm = normalizeVerdict(baselineVerdict, baseline.version, null);
  const candidateNorm = normalizeVerdict(candidateVerdict, candidate.version, null);

  const diff = computeReplayDiff("scn_tiger_nut", baselineNorm, candidateNorm);

  if (!diff.changes.addedMatches.includes("tiger nut")) {
    failed++;
    console.error(`✗ addedMatches should include 'tiger nut', got [${diff.changes.addedMatches.join(", ")}]`);
  } else if (diff.changes.removedMatches.length !== 0) {
    failed++;
    console.error(`✗ removedMatches should be empty, got [${diff.changes.removedMatches.join(", ")}]`);
  } else if (!diff.changes.riskLevelChanged) {
    failed++;
    console.error("✗ riskLevelChanged should be true (none → high)");
  } else {
    passed++;
    console.log("✓ diff identifies addedMatches deterministically");
  }

  // ── 3) Legacy gating fails when riskLevel increase not in allowlist ──
  const report = buildReplayReport([diff], {
    baselineTaxonomyVersion: baseline.version,
    candidateTaxonomyVersion: candidate.version,
  });
  const gateFail = evaluateGate(report, legacyAllowlist(new Set()), true);
  if (gateFail.passed) {
    failed++;
    console.error("✗ gate should FAIL when riskLevel increase not in allowlist");
  } else {
    passed++;
    console.log("✓ legacy gate fails when change not in allowlist");
  }

  // ── 4) Legacy gating passes when scenario is in allowlist ────────────
  const gatePass = evaluateGate(report, legacyAllowlist(new Set(["scn_tiger_nut"])), true);
  if (!gatePass.passed) {
    failed++;
    console.error(`✗ gate should PASS when scenario in allowlist: ${gatePass.failures.join("; ")}`);
  } else {
    passed++;
    console.log("✓ legacy gate passes when scenario in allowlist");
  }

  // ── 5) Control scenario: cashew unchanged between baseline and candidate ─
  const eventsCashew = [{ type: "meal" as const, event_data: { meal: "cashew chicken" } }];
  const baseCashew = checkRiskWithTaxonomy(profile, eventsCashew, baseline);
  const candCashew = checkRiskWithTaxonomy(profile, eventsCashew, candidate);
  const diffCashew = computeReplayDiff(
    "scn_control",
    normalizeVerdict(baseCashew, baseline.version, null),
    normalizeVerdict(candCashew, candidate.version, null)
  );
  if (diffCashew.changes.riskLevelChanged || diffCashew.changes.addedMatches.length > 0 || diffCashew.changes.removedMatches.length > 0) {
    failed++;
    console.error("✗ control scenario (cashew) should have no diff");
  } else {
    passed++;
    console.log("✓ control scenario unchanged");
  }

  // ── 6) parseAllowlist detects legacy format ──────────────────────────
  const legacyParsed = parseAllowlist({ allowedRiskLevelChanges: ["scn_a"] });
  if (legacyParsed.mode !== "legacy" || !legacyParsed.legacyIds.has("scn_a")) {
    failed++;
    console.error("✗ parseAllowlist should detect legacy format");
  } else {
    passed++;
    console.log("✓ parseAllowlist detects legacy format");
  }

  // ── 7) parseAllowlist detects fingerprinted format ───────────────────
  const fpParsed = parseAllowlist({
    fingerprints: [{
      scenarioId: "scn_x",
      expected: { riskLevelFrom: "none", riskLevelTo: "high", addedMatches: ["a"], removedMatches: [] },
    }],
  });
  if (fpParsed.mode !== "fingerprinted" || !fpParsed.fingerprints.has("scn_x")) {
    failed++;
    console.error("✗ parseAllowlist should detect fingerprinted format");
  } else {
    passed++;
    console.log("✓ parseAllowlist detects fingerprinted format");
  }

  // ── 8) Fingerprinted gate PASSES when diff matches fingerprint ───────
  const fpCorrect = parseAllowlist({
    fingerprints: [{
      scenarioId: "scn_tiger_nut",
      expected: {
        riskLevelFrom: "none",
        riskLevelTo: "high",
        addedMatches: ["tiger nut"],
        removedMatches: [],
        candidateTaxonomyVersion: candidate.version,
      },
    }],
  });
  const gatePassFP = evaluateGate(report, fpCorrect, true);
  if (!gatePassFP.passed) {
    failed++;
    console.error(`✗ fingerprinted gate should PASS when diff matches: ${gatePassFP.failures.join("; ")}`);
  } else {
    passed++;
    console.log("✓ fingerprinted gate passes when diff matches fingerprint");
  }

  // ── 9) Fingerprinted gate FAILS when addedMatches differ ─────────────
  const fpWrongAdded = parseAllowlist({
    fingerprints: [{
      scenarioId: "scn_tiger_nut",
      expected: {
        riskLevelFrom: "none",
        riskLevelTo: "high",
        addedMatches: ["wrong term"],
        removedMatches: [],
      },
    }],
  });
  const gateFailAdded = evaluateGate(report, fpWrongAdded, true);
  if (gateFailAdded.passed) {
    failed++;
    console.error("✗ fingerprinted gate should FAIL when addedMatches differ");
  } else if (!gateFailAdded.failures.some((f) => f.includes("addedMatches mismatch"))) {
    failed++;
    console.error(`✗ failure message should mention addedMatches mismatch: ${gateFailAdded.failures.join("; ")}`);
  } else {
    passed++;
    console.log("✓ fingerprinted gate fails when addedMatches differ");
  }

  // ── 10) Fingerprinted gate FAILS when riskLevelTo differs ────────────
  const fpWrongLevel = parseAllowlist({
    fingerprints: [{
      scenarioId: "scn_tiger_nut",
      expected: {
        riskLevelFrom: "none",
        riskLevelTo: "medium",
        addedMatches: ["tiger nut"],
        removedMatches: [],
      },
    }],
  });
  const gateFailLevel = evaluateGate(report, fpWrongLevel, true);
  if (gateFailLevel.passed) {
    failed++;
    console.error("✗ fingerprinted gate should FAIL when riskLevelTo differs");
  } else if (!gateFailLevel.failures.some((f) => f.includes("riskLevelTo mismatch"))) {
    failed++;
    console.error(`✗ failure message should mention riskLevelTo mismatch: ${gateFailLevel.failures.join("; ")}`);
  } else {
    passed++;
    console.log("✓ fingerprinted gate fails when riskLevelTo differs");
  }

  // ── 11) Fingerprinted gate FAILS when candidateTaxonomyVersion differs
  const fpWrongVersion = parseAllowlist({
    fingerprints: [{
      scenarioId: "scn_tiger_nut",
      expected: {
        riskLevelFrom: "none",
        riskLevelTo: "high",
        addedMatches: ["tiger nut"],
        removedMatches: [],
        candidateTaxonomyVersion: "99.99",
      },
    }],
  });
  const gateFailVer = evaluateGate(report, fpWrongVersion, true);
  if (gateFailVer.passed) {
    failed++;
    console.error("✗ fingerprinted gate should FAIL when candidateTaxonomyVersion differs");
  } else if (!gateFailVer.failures.some((f) => f.includes("candidateTaxonomyVersion mismatch"))) {
    failed++;
    console.error(`✗ failure message should mention version mismatch: ${gateFailVer.failures.join("; ")}`);
  } else {
    passed++;
    console.log("✓ fingerprinted gate fails when candidateTaxonomyVersion differs");
  }

  // ── 12) Report meta includes taxonomy versions ───────────────────────
  if (report.meta.baselineTaxonomyVersion !== baseline.version) {
    failed++;
    console.error(`✗ report.meta.baselineTaxonomyVersion should be "${baseline.version}", got "${report.meta.baselineTaxonomyVersion}"`);
  } else if (report.meta.candidateTaxonomyVersion !== candidate.version) {
    failed++;
    console.error(`✗ report.meta.candidateTaxonomyVersion should be "${candidate.version}", got "${report.meta.candidateTaxonomyVersion}"`);
  } else {
    passed++;
    console.log("✓ report meta includes baseline/candidate taxonomy versions");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
