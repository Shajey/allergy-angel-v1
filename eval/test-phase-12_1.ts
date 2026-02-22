/**
 * Phase 12.1 – Promotion Export Pipeline
 *
 * Tests buildPromotionExportFromCandidates with Phase 11 fixtures.
 * Asserts: export shape, blank mode proposals, candidates match discovery.
 */

import {
  discoverUnmappedFromRecords,
  type MockCheck,
  type MockEvent,
} from "../api/_lib/admin/unmappedDiscovery.js";
import { buildPromotionExportFromCandidates } from "../api/_lib/admin/promotionExport.js";
import { isUuidLike } from "../api/_lib/validation/isUuidLike.js";

const profileId = "a0000000-0000-0000-0000-000000000001";

const checks: MockCheck[] = [
  { id: "check-high", verdict: { riskLevel: "high" } },
  { id: "check-medium", verdict: { riskLevel: "medium" } },
  { id: "check-none", verdict: { riskLevel: "none" } },
];

const events: MockEvent[] = [
  {
    check_id: "check-high",
    event_type: "medication",
    event_data: { medication: "ibuprofen", dosage: 200, unit: "mg" },
    created_at: "2025-01-15T10:00:00.000Z",
  },
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
  {
    check_id: "check-high",
    event_type: "meal",
    event_data: { meal: "mango smoothie with yogurt", carbs: null },
    created_at: "2025-01-15T10:02:00.000Z",
  },
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
  {
    check_id: "check-none",
    event_type: "meal",
    event_data: { meal: "smoothie and salad for lunch", carbs: null },
    created_at: "2025-01-15T14:00:00.000Z",
  },
  {
    check_id: "check-high",
    event_type: "meal",
    event_data: { meal: "NY strip steak", carbs: null },
    created_at: "2025-01-15T10:04:00.000Z",
  },
  {
    check_id: "check-high",
    event_type: "meal",
    event_data: { meal: "ice cream with sprinkles", carbs: null },
    created_at: "2025-01-15T10:05:00.000Z",
  },
  {
    check_id: "check-medium",
    event_type: "supplement",
    event_data: { supplement: "rhodiola", dosage: null },
    created_at: "2025-01-15T11:01:00.000Z",
  },
  {
    check_id: "check-high",
    event_type: "supplement",
    event_data: { supplement: "apricot seeds", dosage: null },
    created_at: "2025-01-15T10:06:00.000Z",
  },
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

  const discovery = discoverUnmappedFromRecords(profileId, checks, events, 20);
  const exportResult = buildPromotionExportFromCandidates(discovery.candidates, {
    profileId,
    windowHours: 168,
    limit: 20,
    mode: "blank",
  });

  // ── 1) Export shape: meta + candidates + proposals keys exist ─────────
  if (!exportResult.meta || typeof exportResult.meta !== "object") {
    failed++;
    console.error("✗ export must have meta object");
  } else if (!Array.isArray(exportResult.candidates)) {
    failed++;
    console.error("✗ export must have candidates array");
  } else if (!exportResult.proposals || typeof exportResult.proposals !== "object") {
    failed++;
    console.error("✗ export must have proposals object");
  } else if (
    !Array.isArray(exportResult.proposals.taxonomyAdditions) ||
    !Array.isArray(exportResult.proposals.registryAdditions)
  ) {
    failed++;
    console.error("✗ proposals must have taxonomyAdditions and registryAdditions arrays");
  } else {
    const m = exportResult.meta;
    if (
      m.exportVersion !== "v0-promo-12.1" ||
      typeof m.generatedAt !== "string" ||
      m.profileId !== profileId ||
      m.windowHours !== 168 ||
      m.limit !== 20 ||
      typeof m.candidateCount !== "number"
    ) {
      failed++;
      console.error("✗ meta shape invalid");
    } else {
      passed++;
      console.log("✓ export shape matches (meta + candidates + proposals)");
    }
  }

  // ── 2) Blank mode: all suggestedParent/suggestedFunctionClass null, confidence blank ─
  const taxAdds = exportResult.proposals?.taxonomyAdditions ?? [];
  const regAdds = exportResult.proposals?.registryAdditions ?? [];
  let blankOk = true;
  for (const t of taxAdds) {
    if (t.suggestedParent !== null || t.confidence !== "blank") {
      blankOk = false;
      break;
    }
  }
  for (const r of regAdds) {
    if (r.suggestedFunctionClass !== null || r.confidence !== "blank") {
      blankOk = false;
      break;
    }
  }
  if (!blankOk) {
    failed++;
    console.error("✗ blank mode: all proposals must have null suggestions and confidence=blank");
  } else {
    passed++;
    console.log("✓ blank mode: all proposals null + confidence=blank");
  }

  // ── 3) candidates in export match discovery (same order, same evidence fields) ─
  if (exportResult.candidates.length !== discovery.candidates.length) {
    failed++;
    console.error(
      `✗ candidates count mismatch: export ${exportResult.candidates.length}, discovery ${discovery.candidates.length}`
    );
  } else {
    let matchOk = true;
    for (let i = 0; i < discovery.candidates.length; i++) {
      const disc = discovery.candidates[i];
      const exp = exportResult.candidates[i];
      if (
        exp.candidate !== disc.value ||
        exp.kind !== disc.kind ||
        exp.count !== disc.count ||
        exp.highRiskCount !== disc.highRiskCount ||
        exp.riskRate !== disc.riskRate ||
        exp.firstSeenAt !== disc.firstSeenAt ||
        exp.lastSeenAt !== disc.lastSeenAt ||
        JSON.stringify(exp.examples) !== JSON.stringify(disc.examples) ||
        JSON.stringify(exp.sources) !== JSON.stringify(disc.sources)
      ) {
        matchOk = false;
        break;
      }
    }
    if (!matchOk) {
      failed++;
      console.error("✗ export candidates must match discovery (order + evidence fields)");
    } else {
      passed++;
      console.log("✓ candidates match discovery (order + evidence)");
    }
  }

  // ── 4) isUuidLike accepts DEFAULT_PROFILE_ID (non-v4 but valid shape) ─
  if (!isUuidLike("a0000000-0000-0000-0000-000000000001")) {
    failed++;
    console.error("✗ isUuidLike should accept DEFAULT_PROFILE_ID");
  } else {
    passed++;
    console.log("✓ isUuidLike accepts DEFAULT_PROFILE_ID");
  }

  // ── 5) isUuidLike rejects clearly invalid profileId ────────────────────
  if (isUuidLike("not-a-uuid")) {
    failed++;
    console.error("✗ isUuidLike should reject 'not-a-uuid'");
  } else {
    passed++;
    console.log("✓ isUuidLike rejects invalid profileId");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
