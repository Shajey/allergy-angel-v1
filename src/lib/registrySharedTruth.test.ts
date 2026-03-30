/**
 * O8.1 — Shared registry: promoted overlay drives Registry search + resolver + checkRisk.
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  searchRegistry,
  listRegistry,
} from "@api/_lib/admin/registryBrowser.ts";
import {
  clearPromotedRegistryEntitiesForTest,
  setPromotedRegistryEntitiesForTest,
  resolveEntity,
} from "@api/_lib/knowledge/entityResolver.ts";
import { checkRisk } from "@api/_lib/inference/checkRisk.ts";

const carumEntity = {
  id: "carum-seeds",
  type: "food" as const,
  aliases: ["carum seeds", "carum seeds with water", "carum", "carum seed"],
  class: "spice",
  riskTags: ["legume_family"],
};

describe("O8.1 shared registry truth", () => {
  beforeEach(() => {
    clearPromotedRegistryEntitiesForTest();
  });

  it("A: registry search returns promoted entity (same source as resolver)", () => {
    setPromotedRegistryEntitiesForTest([carumEntity]);
    const r = searchRegistry("carum", "food");
    expect(r.results.some((x) => x.id === "carum-seeds")).toBe(true);
    const listed = listRegistry("food");
    expect(listed.entries.some((e) => e.id === "carum-seeds")).toBe(true);
    expect(listed.entries.find((e) => e.id === "carum-seeds")?.source).toBe("registry");
  });

  it("B: resolver finds promoted alias", () => {
    setPromotedRegistryEntitiesForTest([carumEntity]);
    const res = resolveEntity("carum seeds with water");
    expect(res.resolved).toBe(true);
    expect(res.canonical).toBe("carum-seeds");
  });

  it("C: checkRisk uses semantic riskTags from promoted entity", () => {
    setPromotedRegistryEntitiesForTest([carumEntity]);
    const verdict = checkRisk({
      profile: { known_allergies: ["legume_family"], current_medications: [] },
      events: [
        {
          type: "meal",
          fields: { meal: "carum seeds with water" },
        } as Record<string, unknown>,
      ],
    });
    expect(verdict.riskLevel).toBe("high");
    expect(verdict.matched?.some((m) => m.rule === "entity_risk_tag_match")).toBe(true);
  });

  it("D: registry browser does not use a separate static-only list", async () => {
    const { mergeStaticAndPromotedForType } = await import(
      "@api/_lib/knowledge/registryMerge.ts"
    );
    const { FOODS } = await import("@api/_lib/knowledge/foods.registry.ts");
    const merged = mergeStaticAndPromotedForType("food", [carumEntity]);
    expect(merged.length).toBeGreaterThanOrEqual(FOODS.length + 1);
    expect(merged.some((e) => e.id === "carum-seeds")).toBe(true);
  });
});
