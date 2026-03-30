/**
 * Governance review panel — proposal type, summary, before/after, rationale, approve placement.
 */

import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ProposalReviewPanel from "./ProposalReviewPanel";
import type { GovernanceProposalRow } from "../../lib/governanceProposal";

describe("ProposalReviewPanel", () => {
  const onApprove = vi.fn();

  const aliasProposal: GovernanceProposalRow = {
    id: "p-alias",
    registry_type: "drug",
    canonical_id: "warfarin",
    proposed_alias: "coumadin",
    proposal_action: "add-alias",
    status: "pending",
    created_at: "2025-01-01T00:00:00Z",
  };

  const newEntityProposal: GovernanceProposalRow = {
    id: "p-entity",
    registry_type: "drug",
    canonical_id: "new-id",
    proposed_alias: "foo",
    proposal_action: "create-entry",
    status: "pending",
    created_at: "2025-01-01T00:00:00Z",
    proposed_entry: { name: "foo", class: "x" },
  };

  const relationshipProposal: GovernanceProposalRow = {
    id: "p-rel",
    registry_type: "drug",
    canonical_id: "s1",
    proposed_alias: "x",
    proposal_action: "create-entry",
    status: "pending",
    created_at: "2025-01-01T00:00:00Z",
    proposed_entry: {
      subjectId: "warfarin",
      objectId: "fish oil",
      relationshipType: "caution",
    },
  };

  it("renders alias proposal with type badge, summary, before and after", () => {
    render(
      <ProposalReviewPanel
        proposal={aliasProposal}
        feedback={{ kind: null, message: "" }}
        onApprovePromote={onApprove}
      />
    );
    expect(screen.getByTestId("proposal-type-badge")).toHaveTextContent("Alias");
    expect(screen.getByTestId("proposal-review-summary")).toHaveTextContent(/Map.*coumadin.*warfarin/i);
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("After")).toBeInTheDocument();
    const change = screen.getByTestId("proposal-review-change");
    expect(within(change).getAllByText(/coumadin/i).length).toBeGreaterThanOrEqual(2);
  });

  it("renders new entity proposal with expected change shape", () => {
    render(
      <ProposalReviewPanel
        proposal={newEntityProposal}
        feedback={{ kind: null, message: "" }}
        onApprovePromote={onApprove}
      />
    );
    expect(screen.getByTestId("proposal-type-badge")).toHaveTextContent("New Entity");
    expect(screen.getByTestId("proposal-review-summary")).toHaveTextContent(/Create a new drug entity.*foo/i);
    const change = screen.getByTestId("proposal-review-change");
    expect(within(change).getByText(/No canonical entry/i)).toBeInTheDocument();
    expect(within(change).getByText(/new-id/)).toBeInTheDocument();
  });

  it("renders relationship proposal with expected change shape", () => {
    render(
      <ProposalReviewPanel
        proposal={relationshipProposal}
        feedback={{ kind: null, message: "" }}
        onApprovePromote={onApprove}
      />
    );
    expect(screen.getByTestId("proposal-type-badge")).toHaveTextContent("Relationship");
    expect(screen.getByTestId("proposal-review-summary")).toHaveTextContent(/caution/i);
    expect(screen.getByTestId("proposal-review-summary")).toHaveTextContent(/warfarin/i);
    expect(screen.getByTestId("proposal-review-summary")).toHaveTextContent(/fish oil/i);
    const change = screen.getByTestId("proposal-review-change");
    expect(within(change).getAllByText(/caution/i).length).toBeGreaterThanOrEqual(2);
  });

  it("shows rationale lines when notes or proposed_entry provide them", () => {
    const withNotes: GovernanceProposalRow = {
      ...aliasProposal,
      notes: "Triaged from safety radar.",
      proposed_entry: { occurrenceCount: 5 },
    };
    render(
      <ProposalReviewPanel
        proposal={withNotes}
        feedback={{ kind: null, message: "" }}
        onApprovePromote={onApprove}
      />
    );
    expect(screen.getByText(/Triaged from safety radar/i)).toBeInTheDocument();
    expect(screen.getByText(/5 time/)).toBeInTheDocument();
  });

  it("places approve after change preview in document order", () => {
    render(
      <ProposalReviewPanel
        proposal={aliasProposal}
        feedback={{ kind: null, message: "" }}
        onApprovePromote={onApprove}
      />
    );
    const root = screen.getByTestId("proposal-review-root");
    const changeBlock = screen.getByTestId("proposal-review-block-change");
    const approveBlock = screen.getByTestId("proposal-review-block-approve");
    expect(root.contains(changeBlock)).toBe(true);
    expect(root.contains(approveBlock)).toBe(true);
    expect(
      changeBlock.compareDocumentPosition(approveBlock) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    const btn = screen.getByRole("button", { name: /Approve & Promote/i });
    expect(approveBlock.contains(btn)).toBe(true);
  });

  it("shows empty state when no proposal", () => {
    render(
      <ProposalReviewPanel
        proposal={null}
        feedback={{ kind: null, message: "" }}
        onApprovePromote={onApprove}
      />
    );
    expect(screen.getByText(/Select a pending proposal/i)).toBeInTheDocument();
  });
});
