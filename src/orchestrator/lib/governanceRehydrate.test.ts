import { describe, it, expect } from "vitest";
import { governanceItemFromInvestigationEntry, entityLabelFromSignalId } from "./governanceRehydrate";
import type { InvestigationEntry } from "./investigationTypes";

describe("governanceRehydrate", () => {
  it("entityLabelFromSignalId parses ue and ig keys", () => {
    expect(entityLabelFromSignalId("ue:carum seeds")).toBe("carum seeds");
    expect(entityLabelFromSignalId("ig:a|b||")).toBe("a + b");
  });

  it("builds GovernanceItem from pending_governance investigation", () => {
    const signalId = "ue:channa";
    const entry: InvestigationEntry = {
      signalId,
      status: "pending_governance",
      manualSelection: "new_entity",
      result: { aliases: [], classificationConfidence: 90 },
      proposalPreview: { before: "x", after: "y" },
      proposalPayload: {
        signalId,
        research: {},
        classification: "new_entity",
        createdAt: 1,
        preview: { before: "x", after: "y" },
      },
      lastUpdatedAt: 12345,
    };
    const row = governanceItemFromInvestigationEntry(signalId, entry);
    expect(row).not.toBeNull();
    expect(row!.id).toBe(signalId);
    expect(row!.entity).toBe("channa");
    expect(row!.proposalType).toContain("unknown-entity");
    expect(row!.status).toBe("pending");
  });

  it("returns null without proposal packet", () => {
    const signalId = "ue:x";
    const entry: InvestigationEntry = {
      signalId,
      status: "pending_governance",
      manualSelection: null,
      result: null,
      proposalPreview: null,
      proposalPayload: null,
      lastUpdatedAt: 1,
    };
    expect(governanceItemFromInvestigationEntry(signalId, entry)).toBeNull();
  });
});
