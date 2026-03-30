import { describe, it, expect } from "vitest";
import {
  classifyGovernanceProposal,
  governanceBeforeAfterStrings,
  governanceProposalRationaleLines,
  governanceProposalSummary,
  governanceProposalTypeLabel,
  type GovernanceProposalRow,
} from "./governanceProposal";

describe("governanceProposal", () => {
  const aliasAdd: GovernanceProposalRow = {
    id: "a1",
    registry_type: "drug",
    canonical_id: "warfarin",
    proposed_alias: "coumadin",
    proposal_action: "add-alias",
    status: "pending",
    created_at: "2025-01-01T00:00:00Z",
  };

  const newEntity: GovernanceProposalRow = {
    id: "n1",
    registry_type: "drug",
    canonical_id: "new-drug-id",
    proposed_alias: "newdrug",
    proposal_action: "create-entry",
    status: "pending",
    created_at: "2025-01-01T00:00:00Z",
    proposed_entry: { name: "newdrug", aliases: ["nd"], class: "small molecule" },
  };

  const relationship: GovernanceProposalRow = {
    id: "r1",
    registry_type: "drug",
    canonical_id: "subj",
    proposed_alias: "link",
    proposal_action: "create-entry",
    status: "pending",
    created_at: "2025-01-01T00:00:00Z",
    proposed_entry: {
      subjectId: "warfarin",
      objectId: "aspirin",
      relationshipType: "interaction",
    },
  };

  it("classifies alias vs new entity vs relationship", () => {
    expect(classifyGovernanceProposal(aliasAdd)).toBe("alias");
    expect(classifyGovernanceProposal(newEntity)).toBe("new_entity");
    expect(classifyGovernanceProposal(relationship)).toBe("relationship");
  });

  it("exposes type labels", () => {
    expect(governanceProposalTypeLabel("alias")).toBe("Alias");
    expect(governanceProposalTypeLabel("new_entity")).toBe("New Entity");
    expect(governanceProposalTypeLabel("relationship")).toBe("Relationship");
  });

  it("builds plain-English summaries for each kind", () => {
    expect(governanceProposalSummary(aliasAdd, "alias")).toMatch(/Map.*coumadin.*warfarin/i);
    expect(governanceProposalSummary(newEntity, "new_entity")).toMatch(/newdrug/);
    expect(governanceProposalSummary(newEntity, "new_entity")).toMatch(/small molecule/);
    expect(governanceProposalSummary(relationship, "relationship")).toMatch(/interaction/i);
    expect(governanceProposalSummary(relationship, "relationship")).toMatch(/warfarin/);
    expect(governanceProposalSummary(relationship, "relationship")).toMatch(/aspirin/);
  });

  it("builds human-readable before/after for each kind", () => {
    const a = governanceBeforeAfterStrings(aliasAdd, "alias");
    expect(a.before).toMatch(/coumadin/i);
    expect(a.before).toMatch(/warfarin/i);
    expect(a.after).toMatch(/coumadin/i);

    const n = governanceBeforeAfterStrings(newEntity, "new_entity");
    expect(n.before).toMatch(/No canonical entry/i);
    expect(n.after).toMatch(/newdrug/);
    expect(n.after).toMatch(/new-drug-id/);

    const r = governanceBeforeAfterStrings(relationship, "relationship");
    expect(r.before).toMatch(/warfarin/i);
    expect(r.after).toMatch(/warfarin/i);
    expect(r.after).toMatch(/aspirin/i);
  });

  it("collects rationale lines from notes and proposed_entry", () => {
    const withMeta: GovernanceProposalRow = {
      ...aliasAdd,
      notes: "Flagged from ingestion review.",
      proposed_entry: {
        occurrenceCount: 12,
        source_signal: "unknown_entity_radar",
        evidence: "User report + 3 corroborating checks.",
      },
    };
    const lines = governanceProposalRationaleLines(withMeta);
    expect(lines.some((l) => l.includes("ingestion review"))).toBe(true);
    expect(lines.some((l) => l.includes("12"))).toBe(true);
    expect(lines.some((l) => l.includes("unknown_entity_radar"))).toBe(true);
    expect(lines.some((l) => l.includes("corroborating"))).toBe(true);
  });
});
