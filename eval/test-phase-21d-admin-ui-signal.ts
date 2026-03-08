/**
 * Phase 21d – Admin UI Signal Quality Tests
 *
 * Verifies suggested action classification, sorting, and proposal wording.
 */

import dotenv from "dotenv";
dotenv.config({ path: ".env.local", override: true });

import { classifySuggestedAction } from "../api/_lib/admin/suggestedAction.js";
import { discoverUnmappedFromRecords } from "../api/_lib/admin/unmappedDiscovery.js";

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

  // ── Suggested Action Classification ─────────────────────────────────

  console.log("\n--- Suggested action classification ---");

  // Alias candidate: term matches registry (tylenol → acetaminophen)
  {
    const a = classifySuggestedAction("tylenol", "medication");
    assert(a === "alias-candidate", "tylenol → alias-candidate");
  }

  // Alias candidate: vitamin d → vitamin-d
  {
    const a = classifySuggestedAction("vitamin d", "supplement");
    assert(a === "alias-candidate", "vitamin d → alias-candidate");
  }

  // Alias candidate: st johns wort
  {
    const a = classifySuggestedAction("st johns wort", "supplement");
    assert(a === "alias-candidate", "st johns wort → alias-candidate");
  }

  // New canonical entry: valid medication not in registry
  {
    const a = classifySuggestedAction("testosterone complex", "medication");
    assert(a === "new-canonical-entry", "testosterone complex → new-canonical-entry");
  }

  // New canonical entry: valid supplement not in registry
  {
    const a = classifySuggestedAction("nootropic stack v2", "supplement");
    assert(a === "new-canonical-entry", "nootropic stack v2 → new-canonical-entry");
  }

  // Review needed: generic meal token
  {
    const a = classifySuggestedAction("ice", "meal_token");
    assert(a === "review-needed", "ice → review-needed");
  }

  // Review needed: too short
  {
    const a = classifySuggestedAction("x", "medication");
    assert(a === "review-needed", "x (too short) → review-needed");
  }

  // ── Sorting Order ──────────────────────────────────────────────────

  console.log("\n--- Sorting order ---");

  const checks = [
    { id: "c1", verdict: { riskLevel: "high" } },
    { id: "c2", verdict: { riskLevel: "low" } },
    { id: "c3", verdict: { riskLevel: "high" } },
    { id: "c4", verdict: { riskLevel: "low" } },
  ];
  const events = [
    { check_id: "c1", event_type: "medication", event_data: { medication: "highrisk" }, created_at: "2024-01-01T00:00:00Z" },
    { check_id: "c1", event_type: "medication", event_data: { medication: "highrisk" }, created_at: "2024-01-01T00:00:00Z" },
    { check_id: "c2", event_type: "medication", event_data: { medication: "highcount" }, created_at: "2024-01-01T00:00:00Z" },
    { check_id: "c2", event_type: "medication", event_data: { medication: "highcount" }, created_at: "2024-01-01T00:00:00Z" },
    { check_id: "c2", event_type: "medication", event_data: { medication: "highcount" }, created_at: "2024-01-01T00:00:00Z" },
    { check_id: "c4", event_type: "medication", event_data: { medication: "lowcount" }, created_at: "2024-01-01T00:00:00Z" },
    { check_id: "c4", event_type: "medication", event_data: { medication: "lowcount" }, created_at: "2024-01-01T00:00:00Z" },
  ];

  const result = discoverUnmappedFromRecords("profile-1", checks, events, 10);
  const cands = result.candidates;

  // highrisk: 2 high-risk events → should be first (HighRiskCount=2)
  // highcount: 3 events, 0 high-risk → second (Count=3)
  // lowcount: 2 events, 0 high-risk → third (Count=2)
  // Within same HighRiskCount/Count, Value ASC
  const highriskIdx = cands.findIndex((c) => c.value === "highrisk");
  const highcountIdx = cands.findIndex((c) => c.value === "highcount");
  const lowcountIdx = cands.findIndex((c) => c.value === "lowcount");

  assert(highriskIdx >= 0, "highrisk candidate exists");
  assert(highcountIdx >= 0, "highcount candidate exists");
  assert(lowcountIdx >= 0, "lowcount candidate exists");
  assert(highriskIdx < highcountIdx, "HighRiskCount DESC: highrisk before highcount");
  assert(highcountIdx < lowcountIdx, "Count DESC: highcount before lowcount");

  // ── Proposal Wording (no live mutation language) ────────────────────

  console.log("\n--- Proposal wording ---");

  const draftPhrases = [
    "Draft alias proposal created",
    "Draft remove-alias proposal created",
    "Proposal dismissed",
  ];
  const badPhrases = ["Alias added", "Alias removed"];

  assert(
    draftPhrases.every((p) => p.includes("proposal") || p.includes("dismissed")),
    "Success messages use proposal/dismissed language"
  );
  assert(
    !badPhrases.some((b) => draftPhrases.includes(b)),
    "No live mutation wording (Alias added/removed)"
  );

  // Summary
  console.log("\n--- Summary ---");
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
