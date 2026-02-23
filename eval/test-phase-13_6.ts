/**
 * Phase 13.6 – Safety Report Download + Redaction Policy Tests
 *
 * Asserts:
 * - includeRawText=false omits raw_text from report
 * - includeRawText=true includes input.rawText
 * - reportFilename determinism
 * - Content-Disposition header format (download endpoint)
 */

import {
  buildCheckReport,
  reportFilename,
  type ReportCheckInput,
  type ReportEventInput,
} from "../api/_lib/report/buildCheckReport.js";

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

const CHECK_ID = "a0000000-0000-0000-0000-000000000001";
const PROFILE_ID = "b0000000-0000-0000-0000-000000000002";
const TAXONOMY_VERSION = "10i.3";
const RAW_TEXT = "I ate cashew curry and took ibuprofen";

const sampleCheck: ReportCheckInput = {
  id: CHECK_ID,
  profile_id: PROFILE_ID,
  created_at: "2026-02-21T10:00:00.000Z",
  raw_text: RAW_TEXT,
  verdict: {
    riskLevel: "high",
    reasoning: "test",
    matched: [
      {
        rule: "allergy_match",
        ruleCode: "AA-RULE-AL-001",
        details: { allergen: "cashew", matchedCategory: "tree_nut", severity: 90 },
      },
    ],
    meta: { taxonomyVersion: TAXONOMY_VERSION, severity: 90 },
  },
};

const sampleEvents: ReportEventInput[] = [
  { id: "evt-001", created_at: "2026-02-21T10:00:00.000Z", event_type: "meal", event_data: { meal: "cashew curry" } },
];

console.log("\n=== Phase 13.6 – Safety Report Download + Redaction ===\n");

// Test 1: includeRawText=false omits raw_text
console.log("Test 1: includeRawText=false omits raw_text");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, includeRawText: false });
  assert(!("rawText" in report.input), "input.rawText not present when includeRawText=false");
  assert(report.input.events.length === 1, "events still present");
}

// Test 2: includeRawText=true includes input.rawText
console.log("\nTest 2: includeRawText=true includes input.rawText");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents, includeRawText: true });
  assert("rawText" in report.input, "input.rawText present when includeRawText=true");
  assert(report.input.rawText === RAW_TEXT, "rawText matches check.raw_text");
}

// Test 3: default includeRawText is false
console.log("\nTest 3: default includeRawText is false");
{
  const report = buildCheckReport({ check: sampleCheck, events: sampleEvents });
  assert(!("rawText" in report.input), "default omits rawText");
}

// Test 4: filename determinism — taxonomyVersion present
console.log("\nTest 4: filename with taxonomyVersion");
{
  const fn = reportFilename(PROFILE_ID, CHECK_ID, TAXONOMY_VERSION);
  assert(fn === `AA_SafetyReport_${PROFILE_ID}_${CHECK_ID}_${TAXONOMY_VERSION}.json`, "filename format correct");
  assert(!fn.includes(" "), "no spaces in filename");
  assert(fn.endsWith(".json"), "ends with .json");
}

// Test 5: filename determinism — taxonomyVersion null
console.log("\nTest 5: filename with taxonomyVersion null");
{
  const fn = reportFilename(PROFILE_ID, CHECK_ID, null);
  assert(fn === `AA_SafetyReport_${PROFILE_ID}_${CHECK_ID}_unknown.json`, "uses unknown when version null");
}

// Test 6: filename determinism — same inputs same output
console.log("\nTest 6: filename determinism");
{
  const a = reportFilename(PROFILE_ID, CHECK_ID, TAXONOMY_VERSION);
  const b = reportFilename(PROFILE_ID, CHECK_ID, TAXONOMY_VERSION);
  assert(a === b, "identical inputs produce identical filename");
}

// Test 7: Content-Disposition format (simulated)
console.log("\nTest 7: Content-Disposition format");
{
  const filename = reportFilename(PROFILE_ID, CHECK_ID, TAXONOMY_VERSION);
  const header = `attachment; filename="${filename}"`;
  assert(header.startsWith("attachment;"), "starts with attachment");
  assert(header.includes('filename="'), "includes filename");
  assert(header.endsWith('.json"'), "filename ends with .json");
}

// Test 8: report shape unchanged when includeRawText varies
console.log("\nTest 8: report shape unchanged except rawText");
{
  const without = buildCheckReport({ check: sampleCheck, events: sampleEvents, includeRawText: false });
  const withRaw = buildCheckReport({ check: sampleCheck, events: sampleEvents, includeRawText: true });
  assert(without.meta.checkId === withRaw.meta.checkId, "meta unchanged");
  assert(without.meta.taxonomyVersion === withRaw.meta.taxonomyVersion, "taxonomyVersion unchanged");
  assert(without.output.verdict.riskLevel === withRaw.output.verdict.riskLevel, "verdict unchanged");
  assert(without.input.events.length === withRaw.input.events.length, "events count unchanged");
}

// Test 9: empty raw_text with includeRawText=true
console.log("\nTest 9: empty raw_text with includeRawText=true");
{
  const check: ReportCheckInput = { ...sampleCheck, raw_text: "" };
  const report = buildCheckReport({ check, events: [], includeRawText: true });
  assert(report.input.rawText === "", "empty rawText included when requested");
}

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===\n`);
if (fail > 0) process.exit(1);
