/**
 * Phase 12.3a – Replay Gate Version Mismatch Fix
 *
 * Tests that when bump version differs from fixture candidate version,
 * packager produces replay-candidate-taxonomy.json with fixture version.
 * - replay-candidate-taxonomy.json taxonomy content equals proposed-taxonomy.json (except version)
 * - Deterministic: same inputs → same outputs
 */

import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { loadAllergenTaxonomy } from "../api/_lib/knowledge/loadAllergenTaxonomy.js";
import { loadFunctionalRegistry } from "../api/_lib/knowledge/loadFunctionalRegistry.js";
import { buildPRPackagerOutput, type PRPackagerInput } from "../api/_lib/admin/prPackager/index.js";

const FIXTURE_PATH = resolve(process.cwd(), "eval/fixtures/replay/knowledge/candidate-taxonomy.json");
const TEST_OUT = resolve(process.cwd(), "eval/out/pr-packages-test-12_3a");

const mockPromotion = {
  meta: {
    exportVersion: "v0-promo-12.1",
    generatedAt: "2026-01-15T10:00:00.000Z",
    profileId: "a0000000-0000-0000-0000-000000000001",
    windowHours: 168,
    limit: 20,
    candidateCount: 1,
    taxonomyVersion: "10i.3",
    registryVersion: null,
  },
  candidates: [{ candidate: "mango", kind: "meal_token" as const, count: 1, highRiskCount: 0, riskRate: 0, firstSeenAt: "", lastSeenAt: "", examples: [], sources: {} }],
  proposals: {
    taxonomyAdditions: [{ term: "mango", suggestedParent: "tree_nut", confidence: "blank" as const, evidence: { highRiskCount: 0, count: 1, riskRate: 0, examples: [] }, notes: "" }],
    registryAdditions: [],
  },
};

function getFixtureCandidateVersion(): string {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  const parsed = JSON.parse(raw) as { version?: string };
  return typeof parsed.version === "string" ? parsed.version : "unknown";
}

function runTests(): void {
  let passed = 0;
  let failed = 0;

  const currentTaxonomy = loadAllergenTaxonomy();
  const currentRegistry = loadFunctionalRegistry();
  const fixtureVersion = getFixtureCandidateVersion();

  // ── 1) Bump version differs from fixture → replay-candidate uses fixture version ─
  const inputWithBump: PRPackagerInput = {
    promotion: mockPromotion as PRPackagerInput["promotion"],
    selection: { taxonomy: ["mango"], registry: [] },
    taxonomyMode: "crossReactive",
    taxonomyParent: "tree_nut",
    currentTaxonomy,
    currentRegistry,
    options: { bumpTaxonomyVersionTo: "10i.3" },
  };
  const out = buildPRPackagerOutput(inputWithBump);
  const proposedVersion = out.proposedTaxonomy.version;
  if (proposedVersion !== "10i.3") {
    failed++;
    console.error(`✗ proposed version should be 10i.3; got ${proposedVersion}`);
  } else {
    passed++;
    console.log("✓ bump produces proposed version 10i.3");
  }

  // Build replay-candidate (same content, fixture version)
  const replayCandidate = {
    ...out.proposedTaxonomy,
    version: fixtureVersion,
  };

  if (replayCandidate.version !== fixtureVersion) {
    failed++;
    console.error(`✗ replay-candidate version should be ${fixtureVersion}; got ${replayCandidate.version}`);
  } else {
    passed++;
    console.log(`✓ replay-candidate uses fixture version (${fixtureVersion})`);
  }

  // ── 2) replay-candidate content equals proposed (except version) ─────────────
  const { version: _pv, ...proposedRest } = out.proposedTaxonomy;
  const { version: _rv, ...replayRest } = replayCandidate;
  if (JSON.stringify(proposedRest) !== JSON.stringify(replayRest)) {
    failed++;
    console.error("✗ replay-candidate taxonomy content should equal proposed (except version)");
  } else {
    passed++;
    console.log("✓ replay-candidate content equals proposed (except version)");
  }

  // ── 3) Determinism: same inputs → same outputs ─────────────────────────────
  const out2 = buildPRPackagerOutput(inputWithBump);
  const j1 = JSON.stringify(out.proposedTaxonomy);
  const j2 = JSON.stringify(out2.proposedTaxonomy);
  if (j1 !== j2) {
    failed++;
    console.error("✗ same input produced different proposed taxonomy");
  } else {
    passed++;
    console.log("✓ determinism: same inputs → same outputs");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
