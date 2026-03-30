import { describe, expect, it } from "vitest";
import { createProposal } from "./createProposal";

describe("createProposal", () => {
  it("returns payload with preview and timestamps without side effects", () => {
    const p = createProposal({
      signalId: "ue:test",
      research: { aliases: ["a"], classificationConfidence: 80 },
      classification: "alias",
      selection: { kind: "unknown-entity", entity: "Test" },
    });
    expect(p.signalId).toBe("ue:test");
    expect(p.classification).toBe("alias");
    expect(p.preview.before).toBeTruthy();
    expect(p.preview.after).toBeTruthy();
    expect(p.createdAt).toBeLessThanOrEqual(Date.now());
  });
});
