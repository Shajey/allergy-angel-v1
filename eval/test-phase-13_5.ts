/**
 * Phase 13.5 – Safety Report Export Tests
 *
 * Tests buildCheckReport pure helper.
 * Asserts:
 * - deterministic event sorting (created_at ASC, id ASC)
 * - deterministic matched sorting (kind ASC, matchedTerm ASC, matchedCategory ASC)
 * - ruleCodes present
 * - traceId present
 * - taxonomyVersion present
 * - reportVersion correct
 * - generatedAt exists
 * - profileId passthrough
 */

import {
  buildCheckReport,
  REPORT_VERSION,
  type ReportCheckInput,
  type ReportEventInput,
} from "../api/_lib/report/buildCheckReport.js";

import {
  RULE_ALLERGEN_MATCH,
  RULE_CROSS_REACTIVE,
  RULE_MED_INTERACTION,
} from "../api/_lib/inference/ruleCodes.js";

let pass = 0;
let fail = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

// ── Fixtures ────────────────────────────────────────────────────────

const TRACE_ID = "a0000000-0000-0000-0000-000000000001:10i.2";
const TAXONOMY_VERSION = "10i.2";
const CHECK_ID = "a0000000-0000-0000-0000-000000000001";
const PROFILE_ID = "b0000000-0000-0000-0000-000000000002";
const GENERATED_AT = "2026-02-21T12:00:00.000Z";

const sampleCheck: ReportCheckInput = {
  id: CHECK_ID,
  profile_id: PROFILE_ID,
  created_at: "2026-02-21T10:00:00.000Z",
  raw_text: "I ate cashew curry and took ibuprofen",
  verdict: {
    riskLevel: "high",
    reasoning: "test",
    matched: [
      {
        rule: "medication_interaction",
        ruleCode: RULE_MED_INTERACTION,
        details: { extracted: "ibuprofen", conflictsWith: "aspirin" },
      },
      {
        rule: "allergy_match",
        ruleCode: RULE_ALLERGEN_MATCH,
        details: { meal: "cashew curry", allergen: "cashew", matchedCategory: "tree_nut", severity: 90 },
      },
      {
        rule: "cross_reactive",
        ruleCode: RULE_CROSS_REACTIVE,
        details: { meal: "mango smoothie", matchedTerm: "mango", source: "tree_nut", severity: 100 },
      },
    ],
    meta: {
      taxonomyVersion: TAXONOMY_VERSION,
      severity: 90,
      traceId: TRACE_ID,
    },
  },
};

const sampleEvents: ReportEventInput[] = [
  { id: "evt-003", created_at: "2026-02-21T10:01:00.000Z", event_type: "meal", event_data: { meal: "cashew curry" } },
  { id: "evt-001", created_at: "2026-02-21T10:00:00.000Z", event_type: "medication", event_data: { medication: "ibuprofen" } },
  { id: "evt-002", created_at: "2026-02-21T10:00:00.000Z", event_type: "meal", event_data: { meal: "mango smoothie" } },
];

// ── Tests ───────────────────────────────────────────────────────────

console.log("\n=== Phase 13.5 – Safety Report Export ===\n");

// Test 1: reportVersion
console.log("Test 1: reportVersion");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  assert(report.meta.reportVersion === REPORT_VERSION, `reportVersion is "${REPORT_VERSION}"`);
  assert(REPORT_VERSION === "v0-report-13.5", "REPORT_VERSION constant value correct");
}

// Test 2: generatedAt
console.log("\nTest 2: generatedAt");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents });
  assert(typeof report.meta.generatedAt === "string", "generatedAt is a string");
  assert(report.meta.generatedAt.length > 0, "generatedAt is non-empty");
  assert(!isNaN(Date.parse(report.meta.generatedAt)), "generatedAt is valid ISO");
}

// Test 3: meta fields
console.log("\nTest 3: meta fields");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  assert(report.meta.checkId === CHECK_ID, "checkId matches");
  assert(report.meta.profileId === PROFILE_ID, "profileId matches");
  assert(report.meta.createdAt === "2026-02-21T10:00:00.000Z", "createdAt matches");
  assert(report.meta.taxonomyVersion === TAXONOMY_VERSION, "taxonomyVersion matches");
  assert(report.meta.traceId === TRACE_ID, "traceId matches");
  assert(report.meta.extractionVersion === null, "extractionVersion is null");
  assert(report.meta.modelVersion === null, "modelVersion is null");
}

// Test 4: deterministic event sorting (created_at ASC, id ASC)
console.log("\nTest 4: deterministic event sorting");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  const ids = report.input.events.map((e) => e.id);
  assert(ids[0] === "evt-001", "first event: evt-001 (earliest time, lowest id)");
  assert(ids[1] === "evt-002", "second event: evt-002 (same time, id tie-breaker)");
  assert(ids[2] === "evt-003", "third event: evt-003 (latest time)");
}

// Test 5: deterministic matched sorting (kind ASC, matchedTerm ASC)
console.log("\nTest 5: deterministic matched sorting");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  const kinds = report.output.verdict.matched.map((m) => m.kind);
  assert(kinds[0] === "allergy_match", "first matched: allergy_match");
  assert(kinds[1] === "cross_reactive", "second matched: cross_reactive");
  assert(kinds[2] === "medication_interaction", "third matched: medication_interaction");
}

// Test 6: ruleCodes present on all matched entries
console.log("\nTest 6: ruleCodes present");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  const codes = report.output.verdict.matched.map((m) => m.ruleCode);
  assert(codes.includes(RULE_ALLERGEN_MATCH), "AA-RULE-AL-001 present");
  assert(codes.includes(RULE_CROSS_REACTIVE), "AA-RULE-CR-001 present");
  assert(codes.includes(RULE_MED_INTERACTION), "AA-RULE-MI-001 present");
}

// Test 7: traceId and taxonomyVersion in output.verdict.meta
console.log("\nTest 7: output verdict meta");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  assert(report.output.verdict.meta.traceId === TRACE_ID, "verdict meta traceId");
  assert(report.output.verdict.meta.taxonomyVersion === TAXONOMY_VERSION, "verdict meta taxonomyVersion");
  assert(report.output.verdict.meta.severity === 90, "verdict meta severity");
}

// Test 8: matchedTerm extracted correctly per kind
console.log("\nTest 8: matchedTerm extraction");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  const allergyEntry = report.output.verdict.matched.find((m) => m.kind === "allergy_match");
  const crossEntry = report.output.verdict.matched.find((m) => m.kind === "cross_reactive");
  const medEntry = report.output.verdict.matched.find((m) => m.kind === "medication_interaction");

  assert(allergyEntry!.matchedTerm === "cashew", "allergy_match matchedTerm");
  assert(allergyEntry!.matchedCategory === "tree_nut", "allergy_match matchedCategory");
  assert(crossEntry!.matchedTerm === "mango", "cross_reactive matchedTerm");
  assert(crossEntry!.crossReactive === true, "cross_reactive flag true");
  assert(medEntry!.matchedTerm === "aspirin, ibuprofen", "medication_interaction matchedTerm sorted");
}

// Test 9: empty events
console.log("\nTest 9: empty events");
{
  const report = buildCheckReport({ check: sampleCheck, events: [], generatedAt: GENERATED_AT });
  assert(report.input.events.length === 0, "no events in report");
  assert(report.output.verdict.matched.length === 3, "matched still present");
}

// Test 10: no matched → empty array
console.log("\nTest 10: no matched entries");
{
  const noMatchCheck: ReportCheckInput = {
    ...sampleCheck,
    verdict: { riskLevel: "none", reasoning: "No issues", meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 0 } },
  };
  const report = buildCheckReport({ check: noMatchCheck, events: [], generatedAt: GENERATED_AT });
  assert(report.output.verdict.matched.length === 0, "0 matched entries");
  assert(report.output.verdict.riskLevel === "none", "riskLevel is none");
}

// Test 11: deterministic — identical calls produce identical output
console.log("\nTest 11: deterministic output");
{
  const a = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  const b = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  assert(JSON.stringify(a) === JSON.stringify(b), "two calls produce identical JSON");
}

// Test 12: matchedCategory sort with undefined last
console.log("\nTest 12: matchedCategory undefined sorts last");
{
  const check: ReportCheckInput = {
    ...sampleCheck,
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        { rule: "allergy_match", ruleCode: RULE_ALLERGEN_MATCH, details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 } },
        { rule: "allergy_match", ruleCode: RULE_ALLERGEN_MATCH, details: { allergen: "cashew", severity: 90 } },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
    },
  };
  const report = buildCheckReport({ check, events: [], generatedAt: GENERATED_AT });
  assert(report.output.verdict.matched[0].matchedCategory === "tree_nut", "category present sorts first");
  assert(report.output.verdict.matched[1].matchedCategory === undefined, "undefined category sorts last");
}

// Test 13: legacy matched without ruleCode → ruleCode is null (do not invent)
console.log("\nTest 13: legacy matched without ruleCode");
{
  const check: ReportCheckInput = {
    ...sampleCheck,
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        { rule: "allergy_match", details: { allergen: "walnut", matchedCategory: "tree_nut", severity: 90 } },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
    },
  };
  const report = buildCheckReport({ check, events: [], generatedAt: GENERATED_AT });
  assert(report.output.verdict.matched[0].ruleCode === null, "ruleCode is null for legacy matched without ruleCode");
}

// Test 14: traceId computed when verdict.meta.traceId is absent (with taxonomyVersion)
console.log("\nTest 14: traceId computed from checkId + taxonomyVersion when missing");
{
  const check: ReportCheckInput = {
    ...sampleCheck,
    verdict: {
      riskLevel: "high",
      reasoning: "test",
      matched: [
        { rule: "allergy_match", ruleCode: RULE_ALLERGEN_MATCH, details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 } },
      ],
      meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
    },
  };
  const report = buildCheckReport({ check, events: [], generatedAt: GENERATED_AT });
  const expected = `${CHECK_ID}:${TAXONOMY_VERSION}`;
  assert(report.meta.traceId === expected, `meta.traceId is "${expected}"`);
  assert(report.output.verdict.meta.traceId === expected, `verdict.meta.traceId is "${expected}"`);
}

// Test 15: traceId computed with "unknown" when no taxonomyVersion at all
console.log("\nTest 15: traceId with unknown when no taxonomyVersion");
{
  const check: ReportCheckInput = {
    ...sampleCheck,
    verdict: {
      riskLevel: "none",
      reasoning: "Old check, no meta",
    },
  };
  const report = buildCheckReport({ check, events: [], generatedAt: GENERATED_AT });
  const expected = `${CHECK_ID}:unknown`;
  assert(report.meta.traceId === expected, `meta.traceId is "${expected}"`);
  assert(report.output.verdict.meta.traceId === expected, `verdict.meta.traceId is "${expected}"`);
  assert(report.meta.taxonomyVersion === null, "taxonomyVersion is null when absent");
}

// Test 16: stored traceId takes precedence over computed
console.log("\nTest 16: stored traceId takes precedence");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  assert(report.meta.traceId === TRACE_ID, "stored traceId preserved in meta");
  assert(report.output.verdict.meta.traceId === TRACE_ID, "stored traceId preserved in verdict");
}

// Test 17: traceId is never null
console.log("\nTest 17: traceId is never null");
{
  const checks: ReportCheckInput[] = [
    sampleCheck,
    { ...sampleCheck, verdict: { riskLevel: "none", reasoning: "x" } },
    { ...sampleCheck, verdict: { riskLevel: "none", reasoning: "x", meta: { taxonomyVersion: "v1", severity: 0 } } },
  ];
  for (const check of checks) {
    const report = buildCheckReport({ check, events: [], generatedAt: GENERATED_AT });
    assert(report.meta.traceId !== null, `traceId not null for check ${JSON.stringify(check.verdict.meta ?? "no meta").slice(0, 40)}`);
    assert(typeof report.meta.traceId === "string", "traceId is a string");
    assert(report.meta.traceId.length > 0, "traceId is non-empty");
  }
}

// ── Phase 13.5.2: Back-compat tests ─────────────────────────────────

// Test 18 (Case A): old minimal verdict
console.log("\nTest 18 (13.5.2 Case A): old minimal verdict");
{
  const oldMinimalCheck: ReportCheckInput = {
    id: CHECK_ID,
    profile_id: PROFILE_ID,
    created_at: "2026-02-21T10:00:00.000Z",
    raw_text: "plain rice",
    verdict: { riskLevel: "none", reasoning: "No known risks detected." },
  };
  const report = buildCheckReport({ check: oldMinimalCheck, events: [], generatedAt: GENERATED_AT });
  assert(report.meta.taxonomyVersion === null, "meta.taxonomyVersion is null");
  assert(report.meta.traceId === `${CHECK_ID}:unknown`, "meta.traceId computed");
  assert(report.output.verdict.meta.traceId === `${CHECK_ID}:unknown`, "verdict.meta.traceId same");
  assert(report.output.verdict.matched.length === 0, "matched is []");
  assert(report.output.verdict.riskLevel === "none", "riskLevel is none");
}

// Test 19 (Case B): new full verdict uses stored values
console.log("\nTest 19 (13.5.2 Case B): new full verdict");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, generatedAt: GENERATED_AT });
  assert(report.meta.taxonomyVersion === TAXONOMY_VERSION, "stored taxonomyVersion used");
  assert(report.meta.traceId === TRACE_ID, "stored traceId used");
  assert(report.output.verdict.meta.traceId === TRACE_ID, "stored traceId in verdict");
  assert(report.output.verdict.matched.every((m) => m.ruleCode != null), "all ruleCodes present");
}

// Test 20: determinism — identical except generatedAt
console.log("\nTest 20: determinism (identical except generatedAt)");
{
  const a = buildCheckReport({ check: sampleCheck, events: sampleEvents });
  const b = buildCheckReport({ check: sampleCheck, events: sampleEvents });
  const stripGeneratedAt = (r: ReturnType<typeof buildCheckReport>) => {
    const copy = JSON.parse(JSON.stringify(r));
    delete copy.meta.generatedAt;
    return copy;
  };
  assert(
    JSON.stringify(stripGeneratedAt(a)) === JSON.stringify(stripGeneratedAt(b)),
    "two builds identical except generatedAt"
  );
}

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
