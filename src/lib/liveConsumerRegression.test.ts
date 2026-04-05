/**
 * Live Consumer Integration Regression Test
 *
 * The missing test that would have caught the bug.
 *
 * Uses the real profile save/load path (simulated), then runs consumer check
 * with promoted entities to verify the complete flow works correctly.
 *
 * Flow:
 *   1. Save profile allergy as "birch pollen" or "pollen allergy"
 *   2. Reload / hydrate profile
 *   3. Run consumer check for "raw fuji apples" → Assert ELEVATED verdict (HIGH)
 *   4. Run consumer check for "apple pie" → Assert SAFE (raw_only downgrade)
 *
 * This exercises:
 *   - Profile persistence sanitization
 *   - Profile hydration into checkRisk context
 *   - Canonical normalization
 *   - Entity resolution
 *   - checkRisk with preparation detection
 */

import { describe, it, expect, beforeEach } from "vitest";
import { checkRisk } from "@api/_lib/inference/checkRisk.ts";
import {
  clearPromotedRegistryEntitiesForTest,
} from "@api/_lib/knowledge/entityResolver.ts";
import {
  applyPromotedProposalsToRegistryMemory,
} from "@api/_lib/knowledge/promotedRegistryDb.ts";
import {
  sanitizeAllergyArray,
} from "@api/_lib/util/sanitizeAllergyName.ts";
import {
  normalizeToCanonical,
  expandProfileAllergiesToCanonical,
} from "@api/_lib/inference/clinicalOntology.ts";
import { createAppleOasProposal } from "./fixtures/o83OntologyBridgeFixtures.fixture.ts";

// Simulated profile persistence layer
type Profile = {
  id: string;
  known_allergies: string[];
  current_medications: { name: string; dosage?: string }[];
};

class SimulatedProfileStore {
  private profiles = new Map<string, Profile>();

  async saveAllergies(
    profileId: string,
    rawAllergies: unknown[]
  ): Promise<Profile> {
    // Mirror: api/profile.ts PATCH sanitization
    const cleaned = sanitizeAllergyArray(rawAllergies);

    const existing = this.profiles.get(profileId);
    const updated: Profile = {
      id: profileId,
      known_allergies: cleaned,
      current_medications: existing?.current_medications ?? [],
    };

    this.profiles.set(profileId, updated);
    return updated;
  }

  async loadProfile(profileId: string): Promise<Profile | null> {
    return this.profiles.get(profileId) ?? null;
  }

  // Simulates the sanitization that happens in saveExtractionRun.ts
  getSanitizedAllergies(profile: Profile): string[] {
    // Known_allergies is text[] - sanitize any corrupted entries
    return sanitizeAllergyArray(profile.known_allergies as unknown[]);
  }
}

// Simulated meal check using the real checkRisk
type MealInput = string;

async function runConsumerCheck(
  store: SimulatedProfileStore,
  profileId: string,
  meal: MealInput
) {
  const profile = await store.loadProfile(profileId);
  if (!profile) {
    throw new Error(`Profile not found: ${profileId}`);
  }

  // Mirror: saveExtractionRun.ts sanitization before checkRisk
  const knownAllergies = store.getSanitizedAllergies(profile);

  const verdict = checkRisk({
    profile: {
      known_allergies: knownAllergies,
      current_medications: profile.current_medications,
    },
    events: [{ type: "meal", fields: { meal } }],
  });

  return verdict;
}

describe("Live Consumer Integration — Profile Save/Load → Verdict", () => {
  const PROFILE_ID = "live-consumer-test-profile";
  let store: SimulatedProfileStore;

  beforeEach(() => {
    store = new SimulatedProfileStore();
    clearPromotedRegistryEntitiesForTest();
    // Promote apple with pollen_cross_reactive + raw_only modifiers
    applyPromotedProposalsToRegistryMemory([createAppleOasProposal()]);
  });

  describe("Flow: Save birch pollen → Check raw fuji apples → ELEVATED", () => {
    it("saved 'birch pollen' profile → raw fuji apples verdict is HIGH", async () => {
      // Step 1: Save profile with birch pollen
      await store.saveAllergies(PROFILE_ID, ["birch pollen"]);

      // Step 2: Reload and run consumer check
      const verdict = await runConsumerCheck(store, PROFILE_ID, "raw fuji apples");

      // Assert: ELEVATED verdict
      expect(verdict.riskLevel).toBe("high");
      expect(verdict.matched?.some((m) => m.rule === "entity_risk_tag_match")).toBe(true);
    });

    it("saved 'pollen allergy' profile → raw fuji apples verdict is HIGH", async () => {
      // Step 1: Save profile with "pollen allergy" (different human term)
      await store.saveAllergies(PROFILE_ID, ["pollen allergy"]);

      // Step 2: Reload and run consumer check
      const verdict = await runConsumerCheck(store, PROFILE_ID, "raw fuji apples");

      // Assert: ELEVATED verdict
      expect(verdict.riskLevel).toBe("high");
    });

    it("handles JSON-stringified allergy input and still produces HIGH verdict", async () => {
      // This is the bug regression case!
      // Simulates the corrupted input that caused the original bug
      const corruptedInput = '{"name":"birch pollen","displayName":"birch pollen"}';

      // Step 1: Save with corrupted input (sanitization should clean it)
      await store.saveAllergies(PROFILE_ID, [corruptedInput]);

      // Verify it was stored as plain string
      const saved = await store.loadProfile(PROFILE_ID);
      expect(saved?.known_allergies[0]).toBe("birch pollen");

      // Step 2: Reload and run consumer check
      const verdict = await runConsumerCheck(store, PROFILE_ID, "raw fuji apples");

      // Assert: Still ELEVATED (sanitization worked)
      expect(verdict.riskLevel).toBe("high");
    });
  });

  describe("Flow: Save birch pollen → Check apple pie → SAFE (raw_only)", () => {
    it("saved 'birch pollen' profile → apple pie verdict is SAFE", async () => {
      // Step 1: Save profile with birch pollen
      await store.saveAllergies(PROFILE_ID, ["birch pollen"]);

      // Step 2: Check cooked apple (apple pie)
      const verdict = await runConsumerCheck(store, PROFILE_ID, "apple pie");

      // Assert: SAFE due to raw_only downgrade
      expect(verdict.riskLevel).toBe("none");
      expect(verdict.matched?.some((m) => m.rule === "prep_downgrade")).toBe(true);
    });

    it("saved 'pollen allergy' profile → apple pie verdict is SAFE", async () => {
      await store.saveAllergies(PROFILE_ID, ["pollen allergy"]);

      const verdict = await runConsumerCheck(store, PROFILE_ID, "apple pie");

      expect(verdict.riskLevel).toBe("none");
    });

    it("saved 'birch pollen' profile → baked apple verdict is SAFE", async () => {
      await store.saveAllergies(PROFILE_ID, ["birch pollen"]);

      const verdict = await runConsumerCheck(store, PROFILE_ID, "baked apple");

      expect(verdict.riskLevel).toBe("none");
    });
  });

  describe("Profile with corrupted legacy data → still works after sanitization", () => {
    it("reloads and sanitizes legacy-corrupted profile before checkRisk", async () => {
      // Save with corrupted data (simulating legacy DB state)
      const corruptedJson = '{"name":"birch pollen","displayName":"birch pollen"}';
      await store.saveAllergies(PROFILE_ID, [corruptedJson]);

      // The stored value should be plain string
      const saved = await store.loadProfile(PROFILE_ID);
      expect(saved?.known_allergies[0]).toBe("birch pollen");

      // Sanitization on read (like in saveExtractionRun)
      const sanitized = store.getSanitizedAllergies(saved!);
      expect(sanitized[0]).toBe("birch pollen");

      // Canonical expansion works
      const expanded = expandProfileAllergiesToCanonical(sanitized);
      expect(expanded.has("pollen_cross_reactive")).toBe(true);

      // Consumer check works
      const verdict = await runConsumerCheck(store, PROFILE_ID, "raw fuji apples");
      expect(verdict.riskLevel).toBe("high");
    });

    it("handles double-wrapped legacy data correctly", async () => {
      const inner = JSON.stringify({ displayName: "pollen allergy" });
      const doubleWrapped = JSON.stringify(inner);

      await store.saveAllergies(PROFILE_ID, [doubleWrapped]);

      const verdict = await runConsumerCheck(store, PROFILE_ID, "raw fuji apples");
      expect(verdict.riskLevel).toBe("high");
    });
  });

  describe("Canonical normalization verification in live path", () => {
    it("expands birch pollen to pollen_cross_reactive before checkRisk", async () => {
      await store.saveAllergies(PROFILE_ID, ["birch pollen"]);

      const profile = await store.loadProfile(PROFILE_ID);
      const sanitized = store.getSanitizedAllergies(profile!);

      // Verify normalization
      const canonical = normalizeToCanonical(sanitized[0]);
      expect(canonical).toContain("pollen_cross_reactive");

      // Verify expansion includes the canonical tag
      const expanded = expandProfileAllergiesToCanonical(sanitized);
      expect(expanded.has("pollen_cross_reactive")).toBe(true);
    });

    it("expands pollen allergy to pollen_cross_reactive before checkRisk", async () => {
      await store.saveAllergies(PROFILE_ID, ["pollen allergy"]);

      const profile = await store.loadProfile(PROFILE_ID);
      const sanitized = store.getSanitizedAllergies(profile!);

      const canonical = normalizeToCanonical(sanitized[0]);
      expect(canonical).toContain("pollen_cross_reactive");
    });
  });
});
