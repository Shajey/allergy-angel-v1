/**
 * O8 — Deterministic entity risk tags + profile bridge (no LLM).
 */

import { describe, it, expect, beforeEach } from "vitest";
import { checkRisk } from "@api/_lib/inference/checkRisk.ts";
import {
  clearPromotedFoodEntitiesForTest,
  setPromotedFoodEntitiesForTest,
} from "@api/_lib/knowledge/entityResolver.ts";

describe("checkRisk O8 entity risk tags", () => {
  beforeEach(() => {
    clearPromotedFoodEntitiesForTest();
  });

  it("before promotion: meal mention does not match profile legume_family tag", () => {
    const verdict = checkRisk({
      profile: { known_allergies: ["legume_family"], current_medications: [] },
      events: [{ type: "meal", fields: { meal: "I ate channa daal for lunch" } }],
    });
    expect(verdict.riskLevel).toBe("none");
    expect(verdict.matched?.some((m) => m.rule === "entity_risk_tag_match")).toBe(false);
  });

  it("after promoted overlay: same meal escalates to high when profile lists matching risk tag", () => {
    setPromotedFoodEntitiesForTest([
      {
        id: "channa-daal",
        type: "food",
        class: "legume",
        aliases: ["channa daal", "chana dal", "channa-daal"],
        riskTags: ["legume_family"],
      },
    ]);
    const verdict = checkRisk({
      profile: { known_allergies: ["legume_family"], current_medications: [] },
      events: [{ type: "meal", fields: { meal: "I ate channa daal for lunch" } }],
    });
    expect(verdict.riskLevel).toBe("high");
    expect(verdict.matched?.some((m) => m.rule === "entity_risk_tag_match")).toBe(true);
  });
});
