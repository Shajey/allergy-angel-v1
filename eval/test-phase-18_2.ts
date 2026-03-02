/**
 * Phase 18.2 – Human-readable report formatter
 */

import {
  formatReportAsText,
  textReportFilename,
} from "../api/_lib/report/formatReportAsText.js";

function assert(condition: boolean, message: string): boolean {
  if (condition) {
    console.log(`✓ ${message}`);
    return true;
  }
  console.error(`✗ ${message}`);
  return false;
}

function runTests(): void {
  let passed = 0;
  let failed = 0;

  console.log("\n--- 18.2 formatReportAsText ---");

  const reportData = {
    meta: {
      checkId: "test-id",
      profileId: "profile-id",
      createdAt: "2026-03-02T14:05:00.000Z",
      taxonomyVersion: "v1",
    },
    input: {
      events: [
        { event_type: "meal", event_data: { meal: "pad thai" } },
        { event_type: "meal", event_data: { meal: "mango juice" } },
      ],
      rawText: "pad thai with mango juice",
    },
    output: {
      verdict: {
        riskLevel: "high",
        meta: { severity: 95 },
        matched: [],
      },
    },
    profile: {
      name: "Amber",
      allergies: ["peanut", "tree nuts"],
      medications: ["Eliquis", "Zyrtec"],
      supplements: ["Vitamin D"],
    },
  };

  const text = formatReportAsText(reportData, { includeOriginalText: true });

  if (assert(text.includes("ALLERGY ANGEL REPORT"), "Contains header")) passed++;
  else failed++;
  if (assert(text.includes("Amber"), "Contains profile name")) passed++;
  else failed++;
  if (assert(text.includes("⚠️ HIGH RISK"), "Contains risk level")) passed++;
  else failed++;
  if (assert(text.includes("pad thai with mango juice"), "Contains original text when included")) passed++;
  else failed++;
  if (assert(text.includes("pad thai") && text.includes("mango juice"), "Contains events")) passed++;
  else failed++;
  if (assert(text.includes("peanut") && text.includes("tree nuts"), "Contains allergies")) passed++;
  else failed++;
  if (assert(text.includes("Eliquis") && text.includes("Zyrtec"), "Contains medications")) passed++;
  else failed++;
  if (assert(text.includes("This is not medical advice"), "Contains disclaimer")) passed++;
  else failed++;

  const textRedacted = formatReportAsText(reportData, { includeOriginalText: false });
  if (assert(textRedacted.includes("[Original text redacted for privacy]"), "Redacts when unchecked")) passed++;
  else failed++;

  // Test dish_allergen match formatting
  const withDishMatch = formatReportAsText(
    { ...reportData, output: { verdict: { riskLevel: "high", meta: {}, matched: [] } } },
    {
      includeOriginalText: false,
      rawMatched: [
        {
          rule: "dish_allergen",
          details: {
            meal: "pad thai",
            allergen: "peanut",
            matchedDish: "pad thai",
            severity: 95,
          },
        },
      ],
    }
  );
  if (assert(withDishMatch.includes("pad thai") && withDishMatch.includes("peanut"), "Formats dish_allergen")) passed++;
  else failed++;

  // Test filename
  const filename = textReportFilename("2026-03-02T14:05:00.000Z");
  if (assert(filename.endsWith(".txt") && filename.includes("allergy-angel-check"), "Filename format")) passed++;
  else failed++;

  console.log(`\n=== Phase 18.2 Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
