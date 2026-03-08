/**
 * Phase 21a – Entity Resolution Tests
 */

import {
  resolveEntity,
  resolveEntities,
  isKnownEntity,
  resolveMealText,
} from "../api/_lib/knowledge/entityResolver.js";

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

  // Drug resolution
  console.log("\n--- Drug resolution ---");
  {
    const r = resolveEntity("Lexapro");
    assert(r.resolved && r.canonical === "escitalopram", "Lexapro → escitalopram");
    assert(r.type === "drug" && r.class === "ssri", "Type and class correct");

    assert(resolveEntity("escitalopram").canonical === "escitalopram", "Generic resolves");
    assert(resolveEntity("LEXAPRO").canonical === "escitalopram", "Case-insensitive");
    assert(resolveEntity("  lexapro  ").canonical === "escitalopram", "Whitespace trimmed");
    assert(resolveEntity("fish  oil").canonical === "omega-3-fatty-acid", "Multi-space");
  }

  // Supplement resolution
  console.log("\n--- Supplement resolution ---");
  {
    const variants = ["fish oil", "omega 3", "omega-3", "EPA", "DHA", "cod liver oil"];
    for (const v of variants) {
      const r = resolveEntity(v);
      assert(r.resolved && r.canonical === "omega-3-fatty-acid", `${v} → omega-3-fatty-acid`);
    }
    assert(resolveEntity("vitamin d3").canonical === "vitamin-d", "Vitamin D3");
    assert(resolveEntity("cholecalciferol").canonical === "vitamin-d", "Cholecalciferol");
    assert(resolveEntity("turmeric").canonical === "turmeric", "Turmeric");
    assert(resolveEntity("curcumin").canonical === "turmeric", "Curcumin → turmeric");
  }

  // Food/Allergen resolution
  console.log("\n--- Food/Allergen resolution ---");
  {
    assert(resolveEntity("groundnut").canonical === "peanut", "groundnut → peanut");
    assert(resolveEntity("goober").canonical === "peanut", "goober → peanut");
    assert(resolveEntity("prawns").canonical === "shrimp", "prawns → shrimp");
    const r = resolveEntity("cashew");
    assert(r.type === "allergen" && r.class === "tree_nut", "Cashew type preserved");
  }

  // Meal text resolution
  console.log("\n--- Meal text resolution ---");
  {
    const meal = resolveMealText("pad thai with groundnut sauce");
    assert(meal.includes("peanut") && !meal.includes("groundnut"), "groundnut → peanut in meal");
    const meal2 = resolveMealText("garlic prawns");
    assert(meal2.includes("shrimp") && !meal2.includes("prawns"), "prawns → shrimp in meal");
  }

  // Unknown entities
  console.log("\n--- Unknown entities ---");
  {
    const r = resolveEntity("xyzzy123abc");
    assert(!r.resolved && r.type === "unknown" && r.confidence === 0, "Unknown unresolved");
    assert(resolveEntity("  Some Unknown Thing  ").canonical === "some unknown thing", "Normalized fallback");
  }

  // Batch resolution
  console.log("\n--- Batch resolution ---");
  {
    const results = resolveEntities(["Lexapro", "fish oil", "peanut", "unknown"]);
    assert(results.length === 4, "Batch length");
    assert(results[0].canonical === "escitalopram", "Batch[0] escitalopram");
    assert(results[1].canonical === "omega-3-fatty-acid", "Batch[1] omega-3");
    assert(results[2].canonical === "peanut", "Batch[2] peanut");
    assert(!results[3].resolved, "Batch[3] unresolved");
  }

  // isKnownEntity
  console.log("\n--- isKnownEntity ---");
  {
    assert(isKnownEntity("escitalopram"), "escitalopram known");
    assert(isKnownEntity("lexapro"), "lexapro known");
    assert(!isKnownEntity("xyzzy"), "xyzzy unknown");
  }

  console.log(`\n=== Phase 21a Results: ${passed} passed, ${failed} failed ===`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
