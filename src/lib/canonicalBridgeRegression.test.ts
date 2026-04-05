/**
 * Canonical Bridge Regression Test
 *
 * Focused test proving:
 *   1. "pollen allergy" → pollen_cross_reactive
 *   2. "birch pollen" → pollen_cross_reactive
 *
 * Then verifies that a promoted apple entity with:
 *   - riskTags: ["pollen_cross_reactive"]
 *   - riskModifiers: ["raw_only"]
 *
 * Matches the normalized profile correctly.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  normalizeToCanonical,
  expandProfileAllergiesToCanonical,
} from "@api/_lib/inference/clinicalOntology.ts";
import { checkRisk } from "@api/_lib/inference/checkRisk.ts";
import {
  clearPromotedRegistryEntitiesForTest,
} from "@api/_lib/knowledge/entityResolver.ts";
import {
  applyPromotedProposalsToRegistryMemory,
} from "@api/_lib/knowledge/promotedRegistryDb.ts";
import { createAppleOasProposal } from "./fixtures/o83OntologyBridgeFixtures.fixture.ts";

// Helper to create a profile with given allergies
function createProfile(allergies: string[]) {
  return {
    known_allergies: allergies,
    current_medications: [] as { name: string; dosage?: string }[],
  };
}

// Helper to create meal event
function mealEvent(meal: string) {
  return { type: "meal" as const, fields: { meal } };
}

describe("Canonical Bridge Regression: Human Terms → pollen_cross_reactive", () => {
  beforeEach(() => {
    clearPromotedRegistryEntitiesForTest();
  });

  describe("1. Ontology normalization: pollen allergy", () => {
    it('"pollen allergy" → [pollen_cross_reactive]', () => {
      const canonical = normalizeToCanonical("pollen allergy");
      expect(canonical).toContain("pollen_cross_reactive");
      expect(canonical).toHaveLength(1);
    });

    it('"Pollen Allergy" (case insensitive) → [pollen_cross_reactive]', () => {
      const canonical = normalizeToCanonical("Pollen Allergy");
      expect(canonical).toContain("pollen_cross_reactive");
    });

    it('"POLLEN ALLERGY" (uppercase) → [pollen_cross_reactive]', () => {
      const canonical = normalizeToCanonical("POLLEN ALLERGY");
      expect(canonical).toContain("pollen_cross_reactive");
    });
  });

  describe("2. Ontology normalization: birch pollen", () => {
    it('"birch pollen" → [pollen_cross_reactive]', () => {
      const canonical = normalizeToCanonical("birch pollen");
      expect(canonical).toContain("pollen_cross_reactive");
    });

    it('"Birch Pollen" (title case) → [pollen_cross_reactive]', () => {
      const canonical = normalizeToCanonical("Birch Pollen");
      expect(canonical).toContain("pollen_cross_reactive");
    });

    it('"BIRCH POLLEN" (uppercase) → [pollen_cross_reactive]', () => {
      const canonical = normalizeToCanonical("BIRCH POLLEN");
      expect(canonical).toContain("pollen_cross_reactive");
    });
  });

  describe("3. Profile expansion includes canonical tag", () => {
    it('expandProfileAllergiesToCanonical(["pollen allergy"]) includes pollen_cross_reactive', () => {
      const expanded = expandProfileAllergiesToCanonical(["pollen allergy"]);
      expect(expanded.has("pollen_cross_reactive")).toBe(true);
    });

    it('expandProfileAllergiesToCanonical(["birch pollen"]) includes pollen_cross_reactive', () => {
      const expanded = expandProfileAllergiesToCanonical(["birch pollen"]);
      expect(expanded.has("pollen_cross_reactive")).toBe(true);
    });

    it("expansion deduplicates multiple terms mapping to same tag", () => {
      const expanded = expandProfileAllergiesToCanonical([
        "pollen allergy",
        "birch pollen",
        "Birch Pollen",
      ]);
      // Should only have one pollen_cross_reactive
      const tags = Array.from(expanded).filter((t) => t === "pollen_cross_reactive");
      expect(tags).toHaveLength(1);
    });
  });

  describe("4. Promoted entity with pollen_cross_reactive tag matches", () => {
    beforeEach(() => {
      // Promote apple with pollen_cross_reactive tag and raw_only modifier
      applyPromotedProposalsToRegistryMemory([createAppleOasProposal()]);
    });

    it('promoted apple + "pollen allergy" profile → raw apple HIGH', () => {
      const profile = createProfile(["pollen allergy"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("high");

      // Verify the specific match
      const hit = verdict.matched?.find((m) => m.rule === "entity_risk_tag_match");
      expect(hit).toBeDefined();
      expect(hit?.details.matchedTag).toBe("pollen_cross_reactive");
      expect(hit?.details.entityId).toBe("apple");
    });

    it('promoted apple + "birch pollen" profile → raw apple HIGH', () => {
      const profile = createProfile(["birch pollen"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("high");

      const hit = verdict.matched?.find((m) => m.rule === "entity_risk_tag_match");
      expect(hit?.details.matchedTag).toBe("pollen_cross_reactive");
    });

    it('promoted apple + pollen_cross_reactive profile → raw apple HIGH', () => {
      // Direct canonical tag (backward compat)
      const profile = createProfile(["pollen_cross_reactive"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("high");
    });
  });

  describe("5. raw_only modifier downgrades cooked preparations", () => {
    beforeEach(() => {
      applyPromotedProposalsToRegistryMemory([createAppleOasProposal()]);
    });

    it('cooked apple + "pollen allergy" profile → SAFE (raw_only downgrade)', () => {
      const profile = createProfile(["pollen allergy"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("cooked apple")],
      });

      expect(verdict.riskLevel).toBe("none");
      expect(verdict.matched?.some((m) => m.rule === "prep_downgrade")).toBe(true);
    });

    it('apple pie + "birch pollen" profile → SAFE (raw_only downgrade)', () => {
      const profile = createProfile(["birch pollen"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("apple pie")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('grilled apple + "pollen allergy" profile → SAFE', () => {
      const profile = createProfile(["pollen allergy"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("grilled apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("6. Multiple OAS-related terms all map to same behavior", () => {
    const oasTerms = [
      "pollen allergy",
      "birch pollen",
      "Birch Pollen",
      "oral allergy syndrome",
      "OAS",
      "oas",
    ];

    beforeEach(() => {
      applyPromotedProposalsToRegistryMemory([createAppleOasProposal()]);
    });

    it.each(oasTerms)("'%s' profile → raw apple HIGH", (term) => {
      const profile = createProfile([term]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("high");
    });

    it.each(oasTerms)("'%s' profile → apple pie SAFE", (term) => {
      const profile = createProfile([term]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("apple pie")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });
});
