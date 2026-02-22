/**
 * Phase 11 – Unmapped Discovery Engine
 *
 * Tests discoverUnmappedFromRecords with in-memory fixtures.
 * Asserts: mapped items excluded, unmapped included, ranked by highRiskCount.
 */

import {
  discoverUnmappedFromRecords,
  type MockCheck,
  type MockEvent,
} from "../api/_lib/admin/unmappedDiscovery.js";

const profileId = "test-profile-1";

const checks: MockCheck[] = [
  { id: "check-high", verdict: { riskLevel: "high" } },
  { id: "check-medium", verdict: { riskLevel: "medium" } },
  { id: "check-none", verdict: { riskLevel: "none" } },
];

const events: MockEvent[] = [
  // Mapped: ibuprofen is in FUNCTIONAL_CLASS_REGISTRY (nsaids) → excluded
  {
    check_id: "check-high",
    event_type: "medication",
    event_data: { medication: "ibuprofen", dosage: 200, unit: "mg" },
    created_at: "2025-01-15T10:00:00.000Z",
  },
  // Unmapped: acetaminophen is NOT in registry → included
  {
    check_id: "check-high",
    event_type: "medication",
    event_data: { medication: "acetaminophen", dosage: 500, unit: "mg" },
    created_at: "2025-01-15T10:01:00.000Z",
  },
  {
    check_id: "check-medium",
    event_type: "medication",
    event_data: { medication: "acetaminophen", dosage: 500, unit: "mg" },
    created_at: "2025-01-15T11:00:00.000Z",
  },
  // Unmapped: mango is not in allergen taxonomy (only in cross-reactive) → included as meal token
  {
    check_id: "check-high",
    event_type: "meal",
    event_data: { meal: "mango smoothie with yogurt", carbs: null },
    created_at: "2025-01-15T10:02:00.000Z",
  },
  // mangoes + mango collapse to single "mango" candidate
  {
    check_id: "check-high",
    event_type: "meal",
    event_data: { meal: "mangoes and berries", carbs: null },
    created_at: "2025-01-15T10:03:00.000Z",
  },
  {
    check_id: "check-medium",
    event_type: "meal",
    event_data: { meal: "fresh mango", carbs: null },
    created_at: "2025-01-15T12:00:00.000Z",
  },
  // Mapped: yogurt is in allergen taxonomy (dairy) → excluded
  // Unmapped: smoothie (meal token)
  {
    check_id: "check-none",
    event_type: "meal",
    event_data: { meal: "smoothie and salad for lunch", carbs: null },
    created_at: "2025-01-15T14:00:00.000Z",
  },
  // NY strip steak -> "ny" must NOT appear (length < 3)
  {
    check_id: "check-high",
    event_type: "meal",
    event_data: { meal: "NY strip steak", carbs: null },
    created_at: "2025-01-15T10:04:00.000Z",
  },
  // ice cream -> ice/cream excluded via MEAL_GENERIC_TOKENS
  {
    check_id: "check-high",
    event_type: "meal",
    event_data: { meal: "ice cream with sprinkles", carbs: null },
    created_at: "2025-01-15T10:05:00.000Z",
  },
  // Unmapped supplement: rhodiola not in registry
  {
    check_id: "check-medium",
    event_type: "supplement",
    event_data: { supplement: "rhodiola", dosage: null },
    created_at: "2025-01-15T11:01:00.000Z",
  },
  // Unmapped supplement: apricot seeds
  {
    check_id: "check-high",
    event_type: "supplement",
    event_data: { supplement: "apricot seeds", dosage: null },
    created_at: "2025-01-15T10:06:00.000Z",
  },
  // For riskRate test: diphenhydramine 3x, 1 high-risk → riskRate = 1/3 = 0.333
  {
    check_id: "check-high",
    event_type: "medication",
    event_data: { medication: "diphenhydramine", dosage: 25, unit: "mg" },
    created_at: "2025-01-15T09:00:00.000Z",
  },
  {
    check_id: "check-none",
    event_type: "medication",
    event_data: { medication: "diphenhydramine", dosage: 25, unit: "mg" },
    created_at: "2025-01-15T09:01:00.000Z",
  },
  {
    check_id: "check-none",
    event_type: "medication",
    event_data: { medication: "diphenhydramine", dosage: 25, unit: "mg" },
    created_at: "2025-01-15T09:02:00.000Z",
  },
  // Same-timestamp tie-breaker test: ascorbic acid with two raw forms at same created_at
  {
    check_id: "check-high",
    event_type: "medication",
    event_data: { medication: "ascorbic acid", dosage: 500, unit: "mg" },
    created_at: "2025-01-15T08:00:00.000Z",
  },
  {
    check_id: "check-high",
    event_type: "medication",
    event_data: { medication: "Ascorbic Acid", dosage: 500, unit: "mg" },
    created_at: "2025-01-15T08:00:00.000Z",
  },
];

function runTests(): void {
  let passed = 0;
  let failed = 0;

  const result = discoverUnmappedFromRecords(profileId, checks, events, 20);

  // ── Mapped items excluded ───────────────────────────────────────────
  const values = result.candidates.map((c) => c.value);
  if (values.includes("ibuprofen")) {
    failed++;
    console.error("✗ ibuprofen (mapped) should be excluded");
  } else {
    passed++;
    console.log("✓ ibuprofen (mapped) excluded");
  }
  if (values.includes("yogurt")) {
    failed++;
    console.error("✗ yogurt (mapped) should be excluded");
  } else {
    passed++;
    console.log("✓ yogurt (mapped) excluded");
  }

  // ── Unmapped items included ──────────────────────────────────────────
  if (!values.includes("acetaminophen")) {
    failed++;
    console.error("✗ acetaminophen (unmapped) should be included");
  } else {
    passed++;
    console.log("✓ acetaminophen (unmapped) included");
  }
  if (!values.includes("mango")) {
    failed++;
    console.error("✗ mango (unmapped meal token) should be included");
  } else {
    passed++;
    console.log("✓ mango (unmapped) included");
  }
  if (!values.includes("rhodiola")) {
    failed++;
    console.error("✗ rhodiola (unmapped supplement) should be included");
  } else {
    passed++;
    console.log("✓ rhodiola (unmapped) included");
  }

  // ── Ranked by highRiskCount desc ─────────────────────────────────────
  const acetaminophen = result.candidates.find((c) => c.value === "acetaminophen");
  if (!acetaminophen) {
    failed++;
    console.error("✗ acetaminophen not in candidates");
  } else {
    // acetaminophen appears in check-high (high) and check-medium (medium) → highRiskCount >= 2
    if (acetaminophen.highRiskCount < 2) {
      failed++;
      console.error(`✗ acetaminophen highRiskCount expected >= 2, got ${acetaminophen.highRiskCount}`);
    } else {
      passed++;
      console.log("✓ acetaminophen highRiskCount correct");
    }
  }

  const mango = result.candidates.find((c) => c.value === "mango");
  if (!mango) {
    failed++;
    console.error("✗ mango not in candidates");
  } else {
    // mango + mangoes collapse; count >= 3, highRiskCount >= 1
    if (mango.count < 3) {
      failed++;
      console.error(`✗ mango count expected >= 3 (mango+mangoes collapse), got ${mango.count}`);
    } else {
      passed++;
      console.log("✓ mango/mangoes collapse to single candidate");
    }
  }

  // ── Hygiene: "ny" excluded (length < 3) ─────────────────────────────
  if (values.includes("ny")) {
    failed++;
    console.error("✗ 'ny' from NY strip steak should be excluded (length < 3)");
  } else {
    passed++;
    console.log("✓ 'ny' excluded (length < 3)");
  }

  // ── Hygiene: ice/cream excluded via MEAL_GENERIC_TOKENS ─────────────
  if (values.includes("ice") || values.includes("cream")) {
    failed++;
    console.error("✗ ice/cream from 'ice cream' should be excluded (generic tokens)");
  } else {
    passed++;
    console.log("✓ ice/cream excluded (MEAL_GENERIC_TOKENS)");
  }

  // ── Unmapped supplement: apricot seeds included ──────────────────────
  if (!values.includes("apricot seeds")) {
    failed++;
    console.error("✗ apricot seeds (unmapped supplement) should be included");
  } else {
    passed++;
    console.log("✓ apricot seeds (unmapped supplement) included");
  }

  // First candidate should have highest highRiskCount
  if (result.candidates.length >= 2) {
    const [first, second] = result.candidates;
    if (first.highRiskCount < second.highRiskCount) {
      failed++;
      console.error("✗ candidates should be sorted by highRiskCount desc");
    } else {
      passed++;
      console.log("✓ candidates sorted by highRiskCount desc");
    }
  }

  // sampleCheckIds populated
  if (acetaminophen && acetaminophen.sampleCheckIds.length === 0) {
    failed++;
    console.error("✗ sampleCheckIds should be populated");
  } else if (acetaminophen) {
    passed++;
    console.log("✓ sampleCheckIds populated");
  }

  // ── Phase 11.3: firstSeenAt/lastSeenAt computed correctly ─────────────
  const mangoCandidate = result.candidates.find((c) => c.value === "mango");
  if (!mangoCandidate) {
    failed++;
    console.error("✗ mango not found for firstSeenAt/lastSeenAt test");
  } else {
    // mango: 10:02 (mango smoothie), 10:03 (mangoes), 12:00 (fresh mango)
    const expectedFirst = "2025-01-15T10:02:00.000Z";
    const expectedLast = "2025-01-15T12:00:00.000Z";
    if (mangoCandidate.firstSeenAt !== expectedFirst || mangoCandidate.lastSeenAt !== expectedLast) {
      failed++;
      console.error(
        `✗ mango firstSeenAt/lastSeenAt: expected ${expectedFirst}/${expectedLast}, got ${mangoCandidate.firstSeenAt}/${mangoCandidate.lastSeenAt}`
      );
    } else {
      passed++;
      console.log("✓ firstSeenAt/lastSeenAt computed correctly");
    }
  }

  // ── Phase 11.3: examples max 3 distinct, deterministic order (earliest first) ─
  if (mangoCandidate) {
    const ex = mangoCandidate.examples;
    if (ex.length > 3) {
      failed++;
      console.error(`✗ examples should have max 3, got ${ex.length}`);
    } else {
      // mango: "mango" (10:02), "mangoes" (10:03) - earliest first
      if (ex.length >= 1 && ex[0] !== "mango") {
        failed++;
        console.error(`✗ examples[0] should be earliest distinct 'mango', got '${ex[0]}'`);
      } else {
        passed++;
        console.log("✓ examples max 3 distinct, deterministic order");
      }
    }
  }

  // ── Phase 11.3: examples tie-breaker when same timestamp (alphabetical) ───
  const ascorbicAcid = result.candidates.find((c) => c.value === "ascorbic acid");
  if (!ascorbicAcid) {
    failed++;
    console.error("✗ ascorbic acid not found for same-timestamp tie-breaker test");
  } else {
    // Two examples at same 08:00: "Ascorbic Acid" and "ascorbic acid"
    // Tie-breaker: example string asc → "Ascorbic Acid" before "ascorbic acid" (A < a)
    const ex = ascorbicAcid.examples;
    if (ex.length < 2) {
      failed++;
      console.error(`✗ ascorbic acid expected >= 2 examples (same-ts tie-breaker), got ${ex.length}`);
    } else if (ex[0] !== "Ascorbic Acid" || ex[1] !== "ascorbic acid") {
      failed++;
      console.error(
        `✗ examples tie-breaker: expected ["Ascorbic Acid","ascorbic acid"], got [${ex.map((e) => `"${e}"`).join(",")}]`
      );
    } else {
      passed++;
      console.log("✓ examples same-timestamp tie-breaker deterministic (alphabetical)");
    }
  }

  // ── Phase 11.3: riskRate rounding stable (1/3 => 0.333) ─────────────────
  const diphenhydramine = result.candidates.find((c) => c.value === "diphenhydramine");
  if (!diphenhydramine) {
    failed++;
    console.error("✗ diphenhydramine not found for riskRate test");
  } else {
    // count=3, highRiskCount=1 → riskRate = 1/3 = 0.333...
    if (Math.abs(diphenhydramine.riskRate - 0.333) > 0.001) {
      failed++;
      console.error(
        `✗ riskRate expected 0.333 for 1/3, got ${diphenhydramine.riskRate}`
      );
    } else {
      passed++;
      console.log("✓ riskRate rounding stable (1/3 => 0.333)");
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
