import fs from "node:fs";
import path from "node:path";

const BASE_URL = process.env.API_URL || "http://localhost:3000";

interface ExpectedResult {
  type: string;
  fields: Record<string, string>;
  needsClarification: boolean;
}

interface TestCase {
  name: string;
  input: string;
  expected: ExpectedResult;
}

interface GoldFile {
  testCases: TestCase[];
}

interface TestResult {
  name: string;
  passed: boolean;
  errors: string[];
}

async function runTest(testCase: TestCase): Promise<TestResult> {
  const errors: string[] = [];

  try {
    const response = await fetch(`${BASE_URL}/api/extract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawText: testCase.input }),
    });

    if (!response.ok) {
      errors.push(`HTTP ${response.status}: ${await response.text()}`);
      return { name: testCase.name, passed: false, errors };
    }

    const result = await response.json();

    if (!result.events || result.events.length === 0) {
      errors.push("No events returned");
      return { name: testCase.name, passed: false, errors };
    }

    const event = result.events[0];

    // Assert type
    if (event.type !== testCase.expected.type) {
      errors.push(`type: expected "${testCase.expected.type}", got "${event.type}"`);
    }

    // Assert fields
    for (const [key, expectedValue] of Object.entries(testCase.expected.fields)) {
      const actualValue = event.fields?.[key];
      if (actualValue !== expectedValue) {
        errors.push(`fields.${key}: expected "${expectedValue}", got "${actualValue}"`);
      }
    }

    // Assert needsClarification
    if (event.needsClarification !== testCase.expected.needsClarification) {
      errors.push(
        `needsClarification: expected ${testCase.expected.needsClarification}, got ${event.needsClarification}`
      );
    }

    return { name: testCase.name, passed: errors.length === 0, errors };
  } catch (err: any) {
    errors.push(`Request failed: ${err.message}`);
    return { name: testCase.name, passed: false, errors };
  }
}

async function main() {
  const goldPath = path.join(import.meta.dirname, "gold.inputs.json");
  const goldRaw = fs.readFileSync(goldPath, "utf-8");
  const gold: GoldFile = JSON.parse(goldRaw);

  console.log(`\n🧪 Running ${gold.testCases.length} extraction tests against ${BASE_URL}\n`);
  console.log("─".repeat(60));

  const results: TestResult[] = [];

  for (const testCase of gold.testCases) {
    const result = await runTest(testCase);
    results.push(result);

    const icon = result.passed ? "✅" : "❌";
    console.log(`${icon} ${result.name}`);

    if (!result.passed) {
      for (const error of result.errors) {
        console.log(`   └─ ${error}`);
      }
    }
  }

  console.log("─".repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
