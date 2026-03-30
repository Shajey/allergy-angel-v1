/**
 * Phase O6.9c — Client-side proposal record (no registry mutation, no auto-promotion).
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { buildProposalPreview } from "./investigationProposalBridge";
import type { InvestigationResult, StoredProposalPayload } from "./investigationTypes";

export type { StoredProposalPayload } from "./investigationTypes";

export interface CreateProposalInput {
  signalId: string;
  research: InvestigationResult | unknown;
  classification: string | null;
  selection: OrchestratorSelection;
}

/**
 * Builds a governance-ready proposal record (review only). Does not call APIs or mutate registry.
 */
export function createProposal(input: CreateProposalInput): StoredProposalPayload {
  const preview = buildProposalPreview(
    input.selection,
    input.classification ?? "",
    input.research as InvestigationResult | null
  );
  return {
    signalId: input.signalId,
    research: input.research,
    classification: input.classification,
    createdAt: Date.now(),
    preview,
  };
}
