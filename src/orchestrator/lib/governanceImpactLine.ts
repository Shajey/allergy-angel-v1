/**
 * O7 — Compact human-readable impact line above governance actions.
 */

import type { GovernanceItem } from "./governanceStore";
import type { GovernanceProposalRow } from "./governanceProposal";
import { classifyGovernanceProposal, type GovernanceProposalKind } from "./governanceProposal";

function fromKind(kind: GovernanceProposalKind): string {
  switch (kind) {
    case "alias":
      return "Impact: adds 1 alias mapping";
    case "new_entity":
      return "Impact: adds 1 new entity";
    case "relationship":
      return "Impact: adds 1 relationship for future safety checks";
    default:
      return "Impact: registry knowledge update";
  }
}

export function impactLineForApiProposal(row: GovernanceProposalRow): string {
  return fromKind(classifyGovernanceProposal(row));
}

/** Derive from Signals proposalType / classification (client queue). */
export function impactLineForGovernanceItem(item: GovernanceItem): string {
  const pt = item.proposalType.toLowerCase();
  if (pt.includes("new-entity") || pt.includes("new_entity")) {
    return "Impact: adds 1 new entity";
  }
  if (pt.includes("alias")) {
    return "Impact: adds 1 alias mapping";
  }
  if (pt.includes("interaction") || pt.includes("relationship") || pt.includes("record")) {
    return "Impact: adds 1 relationship for future safety checks";
  }
  return "Impact: registry knowledge update";
}
