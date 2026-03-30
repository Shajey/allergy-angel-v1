import { describe, expect, it } from "vitest";
import {
  buildProposalPreview,
  humanReadableProposedForUnknownEntity,
  mockResearchResult,
} from "./investigationProposalBridge";

describe("buildProposalPreview", () => {
  it("builds before/after for unknown entity", () => {
    const p = buildProposalPreview(
      { kind: "unknown-entity", entity: "FooBar", entityType: "drug" },
      "alias",
      { aliases: ["a", "b"], classificationConfidence: 88, evidenceSummary: "x" }
    );
    expect(p.before).toContain("FooBar");
    expect(p.before).toContain("Medication");
    expect(p.after).toContain("alias");
    expect(p.after).toContain("88%");
  });
});

describe("humanReadableProposedForUnknownEntity", () => {
  it("formats canonical id as readable new-entity line", () => {
    const line = humanReadableProposedForUnknownEntity(
      { kind: "unknown-entity", entity: "channa daal", entityType: "food" },
      "food:channa-daal"
    );
    expect(line).toMatch(/New entity:/i);
    expect(line).toContain("Food");
    expect(line).not.toContain("unknown:");
  });
});

describe("mockResearchResult", () => {
  it("returns aliases and confidence", () => {
    const r = mockResearchResult({ kind: "unknown-entity", entity: "X" }, "new-entity");
    expect(r.aliases.length).toBeGreaterThan(0);
    expect(r.classificationConfidence).toBeGreaterThanOrEqual(72);
    expect(r.classificationConfidence).toBeLessThanOrEqual(94);
  });
});
