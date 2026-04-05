/**
 * Negative Control Regression Test
 *
 * Verifies that a profile allergy that does NOT map to pollen_cross_reactive
 * stays SAFE for the same inputs that would be HIGH for a pollen-sensitive profile.
 *
 * This prevents over-broad matching and ensures the matching logic is precise.
 *
 * Cases:
 *   - profile with tree_nut (not pollen_cross_reactive) + raw apple → SAFE
 *   - profile with legume_family (not pollen_cross_reactive) + raw apple → SAFE
 *   - profile with fish (not pollen_cross_reactive) + raw apple → SAFE
 *   - profile with no allergies + raw apple → SAFE
 */

import { describe, it, expect, beforeEach } from "vitest";
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

describe("Negative Control: Non-matching profiles stay SAFE", () => {
  beforeEach(() => {
    clearPromotedRegistryEntitiesForTest();
    // Promote apple with pollen_cross_reactive tag
    applyPromotedProposalsToRegistryMemory([createAppleOasProposal()]);
  });

  describe("1. tree_nut profile does NOT trigger on raw apple", () => {
    it('tree_nut profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["tree_nut"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('"tree nuts" profile + "raw fuji apples" → SAFE', () => {
      const profile = createProfile(["tree nuts"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw fuji apples")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('"walnut" (child of tree_nut) profile + "apple" → SAFE', () => {
      const profile = createProfile(["walnut"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("2. legume_family profile does NOT trigger on raw apple", () => {
    it('legume_family profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["legume_family"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('"peanut" profile + "apple" → SAFE', () => {
      const profile = createProfile(["peanut"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("3. fish profile does NOT trigger on raw apple", () => {
    it('fish profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["fish"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('"salmon" profile + "apple" → SAFE', () => {
      const profile = createProfile(["salmon"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("4. shellfish profile does NOT trigger on raw apple", () => {
    it('shellfish profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["shellfish"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("5. milk/dairy profile does NOT trigger on raw apple", () => {
    it('milk_dairy profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["milk_dairy"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("6. wheat/gluten profile does NOT trigger on raw apple", () => {
    it('wheat_gluten profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["wheat_gluten"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("7. egg profile does NOT trigger on raw apple", () => {
    it('egg profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["egg"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("8. sesame profile does NOT trigger on raw apple", () => {
    it('sesame profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["sesame"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("9. seed_family profile does NOT trigger on raw apple", () => {
    it('seed_family profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["seed_family"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("10. No allergies profile stays SAFE for everything", () => {
    it('empty profile + "raw apple" → SAFE', () => {
      const profile = createProfile([]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('empty profile + "apple pie" → SAFE', () => {
      const profile = createProfile([]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("apple pie")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('empty profile + "raw fuji apples" → SAFE', () => {
      const profile = createProfile([]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw fuji apples")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("11. Unknown/unmapped terms stay SAFE", () => {
    it('"mystery allergy" profile + "raw apple" → SAFE', () => {
      const profile = createProfile(["mystery allergy"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });

    it('"random food sensitivity" profile + "apple" → SAFE', () => {
      const profile = createProfile(["random food sensitivity"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("12. Confirm birch pollen profile DOES trigger (positive control)", () => {
    it('birch pollen profile + raw apple → HIGH (confirms the match is specific)', () => {
      const profile = createProfile(["birch pollen"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("high");
    });

    it('pollen_cross_reactive profile + raw apple → HIGH (confirms the tag works)', () => {
      const profile = createProfile(["pollen_cross_reactive"]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("high");
    });
  });

  describe("13. Multiple non-matching allergies still stay SAFE", () => {
    it('profile with multiple non-pollen allergies + raw apple → SAFE', () => {
      const profile = createProfile([
        "tree_nut",
        "legume_family",
        "fish",
        "shellfish",
        "milk_dairy",
      ]);
      const verdict = checkRisk({
        profile,
        events: [mealEvent("raw apple")],
      });

      expect(verdict.riskLevel).toBe("none");
    });
  });
});
