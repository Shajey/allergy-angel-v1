/**
 * Phase 10G – Functional Stacking Eval (offline, no Supabase)
 *
 * Verifies the deterministic registry + matching logic of the functional
 * class registry and stacking detection logic using in-memory data.
 *
 * Run:  npx tsx eval/test-functional-stacking.ts
 */

import {
  normalizeTerm,
  matchFunctionalClasses,
  FUNCTIONAL_CLASS_REGISTRY,
} from "../api/_lib/inference/functionalClasses.js";

// ── Harness ──────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    console.log(`✅ ${name}`);
    passed++;
  } else {
    console.log(`❌ ${name}`);
    failed++;
  }
}

// ── Test 1: normalizeTerm strips quotes and trims ────────────────────

function testNormalizeTerm() {
  assert(normalizeTerm("  Aspirin  ") === "aspirin", "normalizeTerm: trims + lowercases");
  assert(normalizeTerm('"Ibuprofen"') === "ibuprofen", "normalizeTerm: strips double quotes");
  assert(normalizeTerm("(Eliquis)") === "eliquis", "normalizeTerm: strips parens");
  assert(normalizeTerm("'Warfarin'") === "warfarin", "normalizeTerm: strips single quotes");
}

// ── Test 2: matchFunctionalClasses exact matches ─────────────────────

function testMatchFunctionalClasses() {
  // Anticoagulants
  assert(
    matchFunctionalClasses("aspirin").includes("anticoagulants"),
    "match: aspirin → anticoagulants",
  );
  assert(
    matchFunctionalClasses("Eliquis").includes("anticoagulants"),
    "match: Eliquis → anticoagulants (case-insensitive)",
  );
  assert(
    matchFunctionalClasses("plavix").includes("anticoagulants"),
    "match: plavix → anticoagulants",
  );

  // NSAIDs
  assert(
    matchFunctionalClasses("ibuprofen").includes("nsaids"),
    "match: ibuprofen → nsaids",
  );
  assert(
    matchFunctionalClasses("Advil").includes("nsaids"),
    "match: Advil → nsaids (brand)",
  );
  assert(
    matchFunctionalClasses("naproxen").includes("nsaids"),
    "match: naproxen → nsaids",
  );
  assert(
    matchFunctionalClasses("Aleve").includes("nsaids"),
    "match: Aleve → nsaids (brand)",
  );

  // No match
  assert(
    matchFunctionalClasses("acetaminophen").length === 0,
    "match: acetaminophen → no class (not in registry)",
  );
  assert(
    matchFunctionalClasses("salad").length === 0,
    "match: salad → no class (meal, not in registry)",
  );

  // Ashwagandha (herbal hint)
  assert(
    matchFunctionalClasses("ashwagandha").includes("anticoagulants"),
    "match: ashwagandha → anticoagulants (herbal hint)",
  );
}

// ── Test 3: Fixture A – "I took aspirin and eliquis" ─────────────────
//    Both should match anticoagulants → stacking detected

function testFixtureA_AspirinEliquis() {
  const items = ["aspirin", "eliquis"];
  const classItems = new Map<string, Set<string>>();

  for (const item of items) {
    const classes = matchFunctionalClasses(item);
    for (const cls of classes) {
      const set = classItems.get(cls) ?? new Set<string>();
      set.add(item);
      classItems.set(cls, set);
    }
  }

  // Should find anticoagulants with 2 items
  const anticoagItems = classItems.get("anticoagulants");
  assert(
    anticoagItems !== undefined && anticoagItems.size >= 2,
    "Fixture A: aspirin + eliquis → anticoagulants stacking (≥2 items)",
  );
}

// ── Test 4: Fixture B – "I took ibuprofen and naproxen" ──────────────
//    Both should match nsaids → stacking detected

function testFixtureB_IbuprofenNaproxen() {
  const items = ["ibuprofen", "naproxen"];
  const classItems = new Map<string, Set<string>>();

  for (const item of items) {
    const classes = matchFunctionalClasses(item);
    for (const cls of classes) {
      const set = classItems.get(cls) ?? new Set<string>();
      set.add(item);
      classItems.set(cls, set);
    }
  }

  // Should find nsaids with 2 items
  const nsaidItems = classItems.get("nsaids");
  assert(
    nsaidItems !== undefined && nsaidItems.size >= 2,
    "Fixture B: ibuprofen + naproxen → nsaids stacking (≥2 items)",
  );
}

// ── Test 5: No stacking for single item ──────────────────────────────

function testNoStackingSingleItem() {
  const items = ["aspirin"];
  const classItems = new Map<string, Set<string>>();

  for (const item of items) {
    const classes = matchFunctionalClasses(item);
    for (const cls of classes) {
      const set = classItems.get(cls) ?? new Set<string>();
      set.add(item);
      classItems.set(cls, set);
    }
  }

  // No class should have ≥2 items
  let hasStacking = false;
  for (const [, items] of classItems) {
    if (items.size >= 2) hasStacking = true;
  }
  assert(!hasStacking, "Single item: aspirin alone → no stacking");
}

// ── Test 6: Registry has expected minimum classes ─────────────────────

function testRegistryMinimum() {
  assert(
    "anticoagulants" in FUNCTIONAL_CLASS_REGISTRY,
    "Registry: anticoagulants class exists",
  );
  assert(
    "nsaids" in FUNCTIONAL_CLASS_REGISTRY,
    "Registry: nsaids class exists",
  );
  assert(
    FUNCTIONAL_CLASS_REGISTRY.anticoagulants.terms.length >= 4,
    "Registry: anticoagulants has ≥4 terms",
  );
  assert(
    FUNCTIONAL_CLASS_REGISTRY.nsaids.terms.length >= 4,
    "Registry: nsaids has ≥4 terms",
  );
}

// ── Run all tests ────────────────────────────────────────────────────

console.log("\n🧪 Functional Stacking Tests (Phase 10G)\n" + "─".repeat(60));
testNormalizeTerm();
testMatchFunctionalClasses();
testFixtureA_AspirinEliquis();
testFixtureB_IbuprofenNaproxen();
testNoStackingSingleItem();
testRegistryMinimum();
console.log("─".repeat(60));
console.log(`\n📊 ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
