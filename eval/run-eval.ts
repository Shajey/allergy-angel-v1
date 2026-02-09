/**
 * Eval harness — runs two independent test suites:
 *
 *   1. Heuristic suite  → calls extractFromTextHeuristic() in-process (deterministic)
 *   2. LLM suite        → hits POST /api/extract over HTTP (requires dev server)
 *
 * Gold files:
 *   eval/gold.heuristic.json  — exact-match expectations for the rule-based extractor
 *   eval/gold.llm.json        — type + structural expectations for the LLM extractor
 *
 * Exit code: 0 if all suites green, 1 otherwise.
 *
 * Canonical endpoints tested:
 *   POST /api/extract           — extraction
 *   GET  /api/history           — history list
 *   GET  /api/history/:id       — history detail
 *
 * No legacy /api/v0/*, /api/extract/v0, or /api/check references remain in code.
 */

import fs from "node:fs";
import path from "node:path";
import { extractFromTextHeuristic } from "../api/_lib/extractFromTextHeuristic.js";

const BASE_URL = process.env.API_URL || "http://localhost:3000";

// ── Types ────────────────────────────────────────────────────────────

interface ExpectedResult {
  type: string;
  fields: Record<string, any>;
  needsClarification: boolean;
}

interface ExpectedEventStub {
  type: string;
}

interface TestCase {
  name: string;
  input: string;
  /** Exact single-event match (type + fields + needsClarification) */
  expected?: ExpectedResult;
  /** Multi-event type assertions (count + types) */
  expectedEvents?: ExpectedEventStub[];
  /** Minimum follow-up question count */
  minFollowUpQuestions?: number;
  /** Standalone needsClarification assertion on first event (works with expectedEvents) */
  assertNeedsClarification?: boolean;
}

interface GoldFile {
  testCases: TestCase[];
}

interface TestResult {
  name: string;
  passed: boolean;
  errors: string[];
}

// ── Shared assertion logic ───────────────────────────────────────────

function assertResult(testCase: TestCase, result: any): TestResult {
  const errors: string[] = [];

  if (!result.events || result.events.length === 0) {
    errors.push("No events returned");
    return { name: testCase.name, passed: false, errors };
  }

  // ── Multi-event assertions (expectedEvents) ──
  if (testCase.expectedEvents) {
    const actualCount = result.events.length;
    const expectedCount = testCase.expectedEvents.length;

    if (actualCount !== expectedCount) {
      errors.push(`event count: expected ${expectedCount}, got ${actualCount}`);
    }

    // Count expected types (handles duplicate types like 2× supplement)
    const expectedTypeCounts: Record<string, number> = {};
    for (const ev of testCase.expectedEvents) {
      expectedTypeCounts[ev.type] = (expectedTypeCounts[ev.type] ?? 0) + 1;
    }

    const actualTypeCounts: Record<string, number> = {};
    for (const ev of result.events) {
      actualTypeCounts[ev.type] = (actualTypeCounts[ev.type] ?? 0) + 1;
    }

    for (const [type, count] of Object.entries(expectedTypeCounts)) {
      const actualTypeCount = actualTypeCounts[type] ?? 0;
      if (actualTypeCount < count) {
        errors.push(
          `expected ${count}× "${type}", got ${actualTypeCount} (actual types: [${result.events.map((e: any) => e.type).join(", ")}])`
        );
      }
    }
  }

  // ── Follow-up question count ──
  if (testCase.minFollowUpQuestions != null) {
    const actualCount = result.followUpQuestions?.length ?? 0;
    if (actualCount < testCase.minFollowUpQuestions) {
      errors.push(
        `followUpQuestions: expected >= ${testCase.minFollowUpQuestions}, got ${actualCount}`
      );
    }
  }

  // ── Single-event exact match (expected) ──
  if (testCase.expected) {
    const event = result.events[0];

    if (event.type !== testCase.expected.type) {
      errors.push(`type: expected "${testCase.expected.type}", got "${event.type}"`);
    }

    for (const [key, expectedValue] of Object.entries(testCase.expected.fields)) {
      const actualValue = event.fields?.[key];
      if (actualValue !== expectedValue) {
        errors.push(
          `fields.${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`
        );
      }
    }

    if (event.needsClarification !== testCase.expected.needsClarification) {
      errors.push(
        `needsClarification: expected ${testCase.expected.needsClarification}, got ${event.needsClarification}`
      );
    }
  }

  // ── Standalone needsClarification assertion ──
  if (testCase.assertNeedsClarification !== undefined && !testCase.expected) {
    const event = result.events[0];
    if (event.needsClarification !== testCase.assertNeedsClarification) {
      errors.push(
        `needsClarification: expected ${testCase.assertNeedsClarification}, got ${event.needsClarification}`
      );
    }
  }

  return { name: testCase.name, passed: errors.length === 0, errors };
}

// ── Heuristic test runner (in-process, no HTTP) ─────────────────────

async function runHeuristicTest(testCase: TestCase): Promise<TestResult> {
  try {
    const result = await extractFromTextHeuristic(testCase.input);
    return assertResult(testCase, result);
  } catch (err: any) {
    return {
      name: testCase.name,
      passed: false,
      errors: [`Heuristic error: ${err.message}`],
    };
  }
}

// ── LLM test runner (HTTP against dev server) ───────────────────────

async function runLLMTest(testCase: TestCase): Promise<TestResult> {
  try {
    const response = await fetch(`${BASE_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: testCase.input }),
    });

    if (!response.ok) {
      return {
        name: testCase.name,
        passed: false,
        errors: [`HTTP ${response.status}: ${await response.text()}`],
      };
    }

    const result = await response.json();
    return assertResult(testCase, result);
  } catch (err: any) {
    return {
      name: testCase.name,
      passed: false,
      errors: [`Request failed: ${err.message}`],
    };
  }
}

// ── Suite printer ────────────────────────────────────────────────────

function printResults(
  suiteName: string,
  results: TestResult[]
): { passed: number; failed: number } {
  console.log(`\n${suiteName}`);
  console.log("─".repeat(60));

  for (const result of results) {
    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);
    if (!result.passed) {
      for (const error of result.errors) {
        console.log(`   └─ ${error}`);
      }
    }
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`\n📊 ${suiteName}: ${passed} passed, ${failed} failed`);
  return { passed, failed };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const dir = import.meta.dirname;

  // Load gold files
  const heuristicGold: GoldFile = JSON.parse(
    fs.readFileSync(path.join(dir, "gold.heuristic.json"), "utf-8")
  );
  const llmGold: GoldFile = JSON.parse(
    fs.readFileSync(path.join(dir, "gold.llm.json"), "utf-8")
  );

  // ── Heuristic suite ──
  console.log(
    `\n🧪 Running ${heuristicGold.testCases.length} heuristic tests (in-process)\n`
  );
  const hResults: TestResult[] = [];
  for (const tc of heuristicGold.testCases) {
    hResults.push(await runHeuristicTest(tc));
  }
  const hStats = printResults("Heuristic Suite", hResults);

  // ── LLM suite ──
  console.log(
    `\n🧪 Running ${llmGold.testCases.length} LLM tests against ${BASE_URL}\n`
  );
  const lResults: TestResult[] = [];
  for (const tc of llmGold.testCases) {
    lResults.push(await runLLMTest(tc));
  }
  const lStats = printResults("LLM Suite", lResults);

  // ── Grand total ──
  const totalPassed = hStats.passed + lStats.passed;
  const totalFailed = hStats.failed + lStats.failed;

  console.log("\n" + "═".repeat(60));
  console.log(`📊 TOTAL: ${totalPassed} passed, ${totalFailed} failed`);
  console.log("═".repeat(60) + "\n");

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main();
