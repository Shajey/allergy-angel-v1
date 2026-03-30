/**
 * Phase O6.9c — Persistent investigation state (sessionStorage-backed).
 */

export type InvestigationStatus =
  | "not_started"
  | "researching"
  | "completed"
  | "proposal_ready"
  | "pending_governance"
  /** O7 — Governance approved & promoted (session handoff). */
  | "governance_approved"
  /** O7 — Governance rejected / closed without promotion. */
  | "governance_rejected";

/** Canonical classification for unknown-entity workflow (maps from radio values). */
export type UnknownEntityManualSelection = "new_entity" | "alias" | "dismiss";

export interface ProposalPreview {
  before: string;
  after: string;
}

/** Client-side proposal record (O6.9c — no API / no registry write). */
export interface StoredProposalPayload {
  signalId: string;
  research: unknown;
  classification: string | null;
  createdAt: number;
  preview: ProposalPreview;
}

export interface InvestigationResult {
  aliases: string[];
  /** 0–100 */
  classificationConfidence: number;
  evidenceSummary?: string;
  /** Optional model suggestion (mock / future API). */
  suggestedClassification?: string;
}

/**
 * Full investigation record (signalId === stable queue key).
 * `manualSelection` uses UI values per kind; unknown-entity maps to UnknownEntityManualSelection when normalized.
 */
export interface Investigation {
  signalId: string;
  status: InvestigationStatus;
  result?: InvestigationResult | unknown;
  manualSelection?: string | null;
  lastUpdatedAt: number;
  proposalPreview?: ProposalPreview | null;
  /** Set when Generate Draft Proposal runs — audit / governance handoff only. */
  proposalPayload?: StoredProposalPayload | null;
}

/** Storage shape merged with defaults. */
export interface InvestigationEntry extends Investigation {
  status: InvestigationStatus;
  manualSelection: string | null;
  result: InvestigationResult | null;
  proposalPreview: ProposalPreview | null;
  proposalPayload: StoredProposalPayload | null;
}

export function defaultInvestigationEntry(signalId: string): InvestigationEntry {
  const t = Date.now();
  return {
    signalId,
    status: "not_started",
    manualSelection: null,
    result: null,
    proposalPreview: null,
    proposalPayload: null,
    lastUpdatedAt: t,
  };
}

/** Map radio value → canonical unknown-entity classification for proposals. */
export function normalizeUnknownEntityClassification(
  value: string | null
): UnknownEntityManualSelection | null {
  if (value == null) return null;
  if (value === "new-entity" || value === "new_entity") return "new_entity";
  if (value === "alias") return "alias";
  if (value === "dismiss") return "dismiss";
  return null;
}
