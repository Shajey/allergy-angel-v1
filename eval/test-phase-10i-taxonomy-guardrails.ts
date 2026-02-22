/**
 * Phase 10I – Taxonomy Coverage + Maintenance Guardrails
 *
 * Deterministic tests to prevent taxonomy drift:
 *   - Every category has severity in [0,100]
 *   - No empty child arrays
 *   - No duplicate children across categories unless in ALLOWED_OVERLAPS
 *   - getAllergenSeverity: known parents return expected; unknown returns 50
 *
 * Behavior tests (no Supabase):
 *   - New taxonomy matches: sesame/tahini, dairy/whey, egg/egg white, soy/soy sauce, fish/salmon, wheat/pasta
 *   - False positive guards: tree_nut/nutritional yeast (no match), soy/soylent (excluded)
 */

import { checkRisk } from "../api/_lib/inference/checkRisk.js";
import {
  ALLERGEN_TAXONOMY,
  ALLOWED_OVERLAPS,
  ALLERGEN_TAXONOMY_VERSION,
  getAllergenSeverity,
  type AllergenParentKey,
} from "../api/_lib/inference/allergenTaxonomy.js";

// ── Guardrail tests ────────────────────────────────────────────────────

function runGuardrailTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  // 1. Every category has severity in [0,100]
  for (const key of Object.keys(ALLERGEN_TAXONOMY) as AllergenParentKey[]) {
    const severity = getAllergenSeverity(key);
    if (severity >= 0 && severity <= 100) {
      passed++;
    } else {
      failed++;
      console.error(`✗ Guardrail: ${key} severity ${severity} not in [0,100]`);
    }
  }

  // 2. No empty child arrays
  for (const [key, entry] of Object.entries(ALLERGEN_TAXONOMY)) {
    if (entry.children.length > 0) {
      passed++;
    } else {
      failed++;
      console.error(`✗ Guardrail: ${key} has empty children array`);
    }
  }

  // 3. No duplicate children across categories unless in ALLOWED_OVERLAPS
  const childToParents = new Map<string, string[]>();
  for (const [parent, entry] of Object.entries(ALLERGEN_TAXONOMY)) {
    for (const child of entry.children) {
      const normalized = child.toLowerCase().trim();
      const list = childToParents.get(normalized) ?? [];
      if (!list.includes(parent)) list.push(parent);
      childToParents.set(normalized, list);
    }
  }

  for (const [child, parents] of childToParents) {
    if (parents.length <= 1) {
      passed++;
    } else {
      const pair = [...parents].sort();
      const isAllowed = ALLOWED_OVERLAPS.some(([a, b]) => {
        const overlapPair = [a, b].sort();
        return overlapPair[0] === pair[0] && overlapPair[1] === pair[1];
      });
      if (isAllowed) {
        passed++;
      } else {
        failed++;
        console.error(
          `✗ Guardrail: duplicate child "${child}" in ${parents.join(", ")} not in ALLOWED_OVERLAPS`
        );
      }
    }
  }

  // 4. getAllergenSeverity: known parents return expected; unknown returns 50
  const knownSeverities: [string, number][] = [
    ["tree_nut", 90],
    ["shellfish", 95],
    ["fish", 90],
    ["sesame", 85],
    ["wheat", 70],
    ["soy", 65],
  ];
  for (const [key, expect] of knownSeverities) {
    const actual = getAllergenSeverity(key);
    if (actual === expect) {
      passed++;
    } else {
      failed++;
      console.error(
        `✗ Guardrail: getAllergenSeverity("${key}") expected ${expect}, got ${actual}`
      );
    }
  }
  const unknown = getAllergenSeverity("unknown_xyz");
  if (unknown === 50) {
    passed++;
  } else {
    failed++;
    console.error(
      `✗ Guardrail: getAllergenSeverity("unknown_xyz") expected 50, got ${unknown}`
    );
  }

  return { passed, failed };
}

// ── Behavior tests ─────────────────────────────────────────────────────

interface BehaviorCase {
  name: string;
  profileAllergies: string[];
  mealText: string;
  expectHigh: boolean;
}

const BEHAVIOR_CASES: BehaviorCase[] = [
  { name: "sesame + tahini dressing", profileAllergies: ["sesame"], mealText: "tahini dressing", expectHigh: true },
  { name: "dairy + whey protein shake", profileAllergies: ["dairy"], mealText: "whey protein shake", expectHigh: true },
  { name: "egg + egg white omelet", profileAllergies: ["egg"], mealText: "egg white omelet", expectHigh: true },
  { name: "soy + soy sauce", profileAllergies: ["soy"], mealText: "soy sauce", expectHigh: true },
  { name: "fish + salmon bowl", profileAllergies: ["fish"], mealText: "salmon bowl", expectHigh: true },
  { name: "wheat + pasta", profileAllergies: ["wheat"], mealText: "pasta", expectHigh: true },
  { name: "tree_nut + nutritional yeast (false positive guard)", profileAllergies: ["tree_nut"], mealText: "nutritional yeast", expectHigh: false },
  { name: "soy + soylent (excluded)", profileAllergies: ["soy"], mealText: "soylent", expectHigh: false },
];

function runBehaviorTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  for (const tc of BEHAVIOR_CASES) {
    const verdict = checkRisk({
      profile: { known_allergies: tc.profileAllergies, current_medications: [] },
      events: [{ type: "meal", fields: { meal: tc.mealText } }],
    });
    const ok = tc.expectHigh ? verdict.riskLevel === "high" : verdict.riskLevel !== "high";
    if (ok) {
      passed++;
      console.log(`✓ ${tc.name}`);
    } else {
      failed++;
      console.error(`✗ ${tc.name}: expected ${tc.expectHigh ? "high" : "not high"}, got ${verdict.riskLevel}`);
    }
  }

  return { passed, failed };
}

// ── Main ──────────────────────────────────────────────────────────────

function main(): void {
  console.log("Phase 10I – Taxonomy Guardrails + Behavior\n");

  if (ALLERGEN_TAXONOMY_VERSION !== "10i.2") {
    console.error(`✗ Version: expected "10i.2", got "${ALLERGEN_TAXONOMY_VERSION}"`);
    process.exit(1);
  }
  console.log(`✓ ALLERGEN_TAXONOMY_VERSION === "10i.2"\n`);

  console.log("Guardrail tests:");
  const g = runGuardrailTests();

  console.log("\nBehavior tests:");
  const b = runBehaviorTests();

  const totalPassed = g.passed + b.passed;
  const totalFailed = g.failed + b.failed;

  console.log(`\n${totalPassed} passed, ${totalFailed} failed`);
  process.exit(totalFailed > 0 ? 1 : 0);
}

main();
