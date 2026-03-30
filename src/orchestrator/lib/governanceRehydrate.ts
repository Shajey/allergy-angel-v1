/**
 * Rebuild governance queue rows from investigation session state when the queue
 * was cleared or never persisted, while investigations still show pending_governance.
 */

import type { GovernanceItem } from "./governanceStore";
import type { InvestigationEntry } from "./investigationTypes";

function selectionKindPrefix(signalId: string): string {
  if (signalId.startsWith("ue:")) return "unknown-entity";
  if (signalId.startsWith("ig:")) return "interaction-gap";
  if (signalId.startsWith("sig:")) return "signal";
  if (signalId.startsWith("in:")) return "ingestion-candidate";
  if (signalId.startsWith("re:")) return "registry-entity";
  if (signalId.startsWith("act:")) return "activity";
  return "signal";
}

/** Human-readable label from stable selection key (matches Signals list context). */
export function entityLabelFromSignalId(signalId: string): string {
  if (signalId.startsWith("ue:")) {
    const rest = signalId.slice(3).trim();
    return rest || signalId;
  }
  if (signalId.startsWith("ig:")) {
    const parts = signalId.slice(3).split("|");
    const a = (parts[0] ?? "").trim();
    const b = (parts[1] ?? "").trim();
    if (a && b) return `${a} + ${b}`;
    return signalId;
  }
  if (signalId.startsWith("sig:")) return signalId.slice(4).trim() || signalId;
  if (signalId.startsWith("in:")) return signalId.slice(3).trim() || signalId;
  if (signalId.startsWith("re:")) return signalId.slice(3).trim() || signalId;
  if (signalId.startsWith("act:")) return signalId.slice(4).trim() || signalId;
  return signalId;
}

/**
 * Build a governance queue row from a pending_governance investigation when the
 * session queue row is missing (e.g. storage cleared).
 */
export function governanceItemFromInvestigationEntry(
  signalId: string,
  entry: InvestigationEntry
): GovernanceItem | null {
  if (entry.status !== "pending_governance") return null;
  if (!entry.proposalPreview || !entry.proposalPayload) return null;
  const manual = entry.manualSelection ?? "";
  const kind = selectionKindPrefix(signalId);
  return {
    id: signalId,
    signalId,
    entity: entityLabelFromSignalId(signalId),
    proposalType: `${kind}:${manual}`,
    proposal: entry.proposalPayload,
    before: entry.proposalPreview.before,
    after: entry.proposalPreview.after,
    confidence: entry.result?.classificationConfidence ?? 0,
    status: "pending",
    createdAt: entry.lastUpdatedAt,
  };
}
