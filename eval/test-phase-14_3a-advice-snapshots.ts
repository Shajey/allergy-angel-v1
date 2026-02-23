/**
 * Phase 14.3A – Advice Snapshot Regression Tests
 *
 * Projects only stable fields: version, topTarget, items[].{id, level, target, title}.
 * Uses deepStrictEqual for exact match. No DB, no network.
 */

import assert from "node:assert";
import { readFileSync } from "fs";
import { resolve } from "path";
import { buildCheckReport } from "../api/_lib/report/buildCheckReport.js";
import { validateNoOrphanAdvice } from "../api/_lib/advice/validateNoOrphanAdvice.js";

const FIXTURE_PATH = resolve(process.cwd(), "eval/fixtures/advice/report-advice-snapshots.json");
const CHECK_ID = "a0000000-0000-0000-0000-000000000001";
const PROFILE_ID = "a0000000-0000-0000-0000-000000000002";
const CREATED_AT = "2025-01-15T12:00:00.000Z";

interface SnapshotInput {
  riskLevel: "none" | "medium" | "high";
  reasoning: string;
  matchedTerms: string[];
  matchedCategories: string[];
  ruleKinds: string[];
  medicationDetails?: { extracted: string; conflictsWith: string };
}

interface SnapshotExpected {
  version?: string;
  topTarget?: string | null;
  items?: Array<{ id: string; level: string; target: string; title: string }>;
  adviceAbsent?: boolean;
}

interface Snapshot {
  id: string;
  description: string;
  input: SnapshotInput;
  expected: SnapshotExpected;
}

function buildMatchedFromInput(input: SnapshotInput): Array<{ rule: string; details: Record<string, unknown> }> {
  const matched: Array<{ rule: string; details: Record<string, unknown> }> = [];

  if (input.ruleKinds.includes("medication_interaction") && input.medicationDetails) {
    matched.push({ rule: "medication_interaction", details: input.medicationDetails });
  }

  for (let i = 0; i < input.matchedTerms.length; i++) {
    const rule = input.ruleKinds[i];
    const term = input.matchedTerms[i];
    const category = input.matchedCategories[i];
    if (rule === "allergy_match") {
      matched.push({
        rule: "allergy_match",
        details: { meal: `meal with ${term}`, allergen: term, matchedCategory: category, severity: 90 },
      });
    } else if (rule === "cross_reactive") {
      matched.push({
        rule: "cross_reactive",
        details: { meal: `meal with ${term}`, source: category, matchedTerm: term, severity: 100 },
      });
    }
  }
  return matched;
}

/** Project advice to stable fields only. */
function projectAdvice(advice: { version: string; items: Array<{ id: string; level: string; target: string; title: string }>; topTarget: string | null } | undefined) {
  if (!advice) return undefined;
  return {
    version: advice.version,
    topTarget: advice.topTarget,
    items: advice.items.map((i) => ({ id: i.id, level: i.level, target: i.target, title: i.title })),
  };
}

function runTests(): void {
  const raw = readFileSync(FIXTURE_PATH, "utf-8");
  const fixture: { snapshots: Snapshot[] } = JSON.parse(raw);
  const snapshots = fixture.snapshots;

  assert.ok(Array.isArray(snapshots) && snapshots.length >= 3, "Fixture must have at least 3 snapshots");

  let passed = 0;
  let failed = 0;

  const orphans = validateNoOrphanAdvice();
  if (orphans.length > 0) {
    console.error(`✗ Orphan advice: ${orphans.join(", ")}`);
    process.exit(1);
  }
  passed++;
  console.log("✓ No orphan advice (all targets map to taxonomy)");

  for (const snap of snapshots) {
    try {
      const check = {
        id: CHECK_ID,
        profile_id: PROFILE_ID,
        created_at: CREATED_AT,
        raw_text: "snapshot test",
        verdict: {
          riskLevel: snap.input.riskLevel,
          reasoning: snap.input.reasoning,
          matched: buildMatchedFromInput(snap.input),
          meta: { taxonomyVersion: "10i.3", severity: 90 },
        },
      };

      const report = buildCheckReport({ check, events: [], generatedAt: CREATED_AT });
      const actual = projectAdvice(report.output.advice);
      const expected = snap.expected;

      if (expected.adviceAbsent) {
        assert.strictEqual(actual, undefined, `Snapshot ${snap.id}: advice must be absent`);
      } else {
        const expectedProjected = {
          version: expected.version,
          topTarget: expected.topTarget,
          items: expected.items,
        };
        assert.deepStrictEqual(actual, expectedProjected, `Snapshot ${snap.id}: advice mismatch`);
      }

      passed++;
      console.log(`✓ ${snap.id}: ${snap.description}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`✗ ${snap.id}\n  ${msg}`);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
