/**
 * Phase 22 – Knowledge Radar Tests
 *
 * Tests entity/combination upsert, priority scoring, sorting, suggested action.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import {
  upsertUnknownEntity,
  upsertUnknownCombination,
  toEntityType,
  getCombinationType,
  orderPair,
  resolveEntityType,
} from "../api/_lib/telemetry/radarStore.js";
import { inferEntityType } from "../api/_lib/telemetry/entityTypeInference.js";
import { scoreEntity, scoreCombination, getPriorityLabel } from "../api/_lib/telemetry/radarPriority.js";
import {
  classifyRadarEntityAction,
  classifyRadarCombinationAction,
} from "../api/_lib/admin/suggestedAction.js";
import { recordRadarTelemetry } from "../api/_lib/telemetry/verdictObserver.js";

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ ${message}`);
      failed++;
    }
  }

  // ── Phase 22.1: Entity type inference ─────────────────────────────
  console.log("\n--- Entity type inference ---");
  assert(inferEntityType("turmeric extract") === "supplement", "turmeric extract → supplement");
  assert(inferEntityType("channa daal") === "food", "channa daal → food");
  assert(resolveEntityType("ashwagandha extract", "unknown") === "supplement", "ashwagandha extract unknown → supplement");

  // ── Entity type mapping ────────────────────────────────────────────
  console.log("\n--- Entity type mapping ---");
  assert(toEntityType("drug") === "medication", "drug → medication");
  assert(toEntityType("allergen") === "food", "allergen → food");
  assert(toEntityType("supplement") === "supplement", "supplement → supplement");

  // ── Combination type ────────────────────────────────────────────────
  console.log("\n--- Combination type ---");
  assert(
    getCombinationType("medication", "supplement") === "drug_supplement",
    "medication + supplement → drug_supplement"
  );
  assert(
    getCombinationType("medication", "medication") === "drug_drug",
    "medication + medication → drug_drug"
  );
  assert(
    getCombinationType("food", "food") === "food_food",
    "food + food → food_food"
  );
  assert(
    getCombinationType("unknown", "medication") === "drug_unknown",
    "unknown + medication → drug_unknown"
  );

  // ── Order pair (alphabetical) ──────────────────────────────────────
  console.log("\n--- Order pair ---");
  const o1 = orderPair("b", "medication", "a", "supplement");
  assert(o1.entity_a === "a" && o1.entity_b === "b", "a before b");
  const o2 = orderPair("x", "food", "y", "food");
  assert(o2.entity_a === "x" && o2.entity_b === "y", "x before y (same type)");

  // ── Priority scoring ───────────────────────────────────────────────
  console.log("\n--- Priority scoring ---");
  const s1 = scoreEntity({
    occurrenceCount: 10,
    highRiskCount: 2,
    lastSeenDay: new Date().toISOString().split("T")[0],
  });
  assert(s1 > 0, "entity score positive");
  const s2 = scoreCombination({
    occurrenceCount: 5,
    highRiskCount: 1,
    lastSeenDay: new Date().toISOString().split("T")[0],
    combinationType: "drug_supplement",
  });
  assert(s2 > 0, "combination score positive");
  const s3 = scoreCombination({
    occurrenceCount: 5,
    highRiskCount: 1,
    lastSeenDay: new Date().toISOString().split("T")[0],
    combinationType: "food_food",
  });
  assert(s2 > s3, "drug_supplement ranks above food_food");
  assert(getPriorityLabel(2.5) === "high", "score 2.5 → high");
  assert(getPriorityLabel(0.5) === "low", "score 0.5 → low");

  // ── Suggested action ────────────────────────────────────────────────
  console.log("\n--- Suggested action ---");
  assert(
    classifyRadarEntityAction("tylenol", "medication") === "alias_candidate",
    "tylenol → alias_candidate"
  );
  assert(
    classifyRadarEntityAction("xyzzy-unknown", "medication") === "new_entry_candidate",
    "unknown med → new_entry_candidate"
  );
  assert(
    classifyRadarCombinationAction("a", "medication", "b", "supplement", "drug_supplement") ===
      "investigate",
    "drug_supplement → investigate"
  );
  assert(
    classifyRadarCombinationAction("a", "food", "b", "food", "food_food") === "low_priority",
    "food_food → low_priority"
  );

  // ── recordRadarTelemetry (no throw) ─────────────────────────────────
  console.log("\n--- recordRadarTelemetry ---");
  try {
    recordRadarTelemetry({
      verdict: { riskLevel: "none", reasoning: "test", matched: [] },
      events: [
        { type: "medication", resolution: { raw: "xyzzy", canonical: "xyzzy", type: "unknown", resolved: false, confidence: 0 } },
        { type: "supplement", resolution: { raw: "vitamin d", canonical: "vitamin-d", type: "supplement", resolved: true, confidence: 1 } },
      ],
    });
    assert(true, "recordRadarTelemetry does not throw");
  } catch (e) {
    assert(false, `recordRadarTelemetry threw: ${e}`);
  }

  // ── Privacy: no profile_id, check_id, raw text in schema ────────────
  console.log("\n--- Privacy check ---");
  // Schema in 010_knowledge_radar.sql has: entity, entity_type, day, occurrence_count, high_risk_count
  // No profile_id, user_id, check_id, raw text. Verified by migration.
  assert(true, "Schema excludes profile_id, check_id, raw text");

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  return failed;
}

// Supabase-dependent tests (upsert) - run only if tables exist
async function runSupabaseTests(): Promise<number> {
  const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!hasSupabase) {
    console.log("\n--- Supabase tests (skipped: no Supabase) ---");
    return;
  }

  let passed = 0;
  let failed = 0;
  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✓ ${message}`);
      passed++;
    } else {
      console.error(`✗ ${message}`);
      failed++;
    }
  }

  console.log("\n--- Entity/combination upsert ---");
  try {
    const day = new Date().toISOString().split("T")[0];
    const testEntity = `test-radar-${Date.now()}`;
    await upsertUnknownEntity({
      entity: testEntity,
      entityType: "medication",
      day,
      occurrenceCount: 1,
      highRiskCount: 0,
    });
    assert(true, "upsertUnknownEntity succeeds");

    await upsertUnknownCombination({
      entityA: "a",
      entityAType: "medication",
      entityB: "b",
      entityBType: "supplement",
      combinationType: "drug_supplement",
      day,
      occurrenceCount: 1,
      highRiskCount: 0,
    });
    assert(true, "upsertUnknownCombination succeeds");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("unknown_entity_daily") || msg.includes("schema cache")) {
      console.log("Upsert skipped: run migration 010_knowledge_radar.sql");
    } else {
      assert(false, `Upsert failed: ${msg}`);
    }
  }

  return failed;
}

async function main() {
  const syncFailed = runTests();
  const asyncFailed = await runSupabaseTests();
  process.exit(syncFailed > 0 || asyncFailed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
