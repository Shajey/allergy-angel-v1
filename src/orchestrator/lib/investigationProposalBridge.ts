/**
 * Phase O6.9 / O6.10 — Bridge manual classification + research result → human-readable proposal preview.
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";
import type { InvestigationResult, ProposalPreview } from "./investigationTypes";

export type { InvestigationResult, ProposalPreview } from "./investigationTypes";

function friendlyRegistryCategory(regOrType?: string): string {
  const t = (regOrType ?? "").toLowerCase();
  if (t === "drug" || t === "medication") return "Medication";
  if (t === "food") return "Food";
  if (t === "supplement") return "Supplement";
  if (!t || t === "unknown" || t === "entity") return "Registry";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Display name from slug segment (food:channa-daal → Channa daal). */
function slugSegmentToWords(slug: string): string {
  const s = slug.replace(/-/g, " ").trim();
  if (!s) return "";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Human-readable “proposed” line for unknown-entity workbench (visible copy only).
 * Example: New entity: Channa daal (Food)
 */
export function humanReadableProposedForUnknownEntity(
  sel: Extract<OrchestratorSelection, { kind: "unknown-entity" }>,
  proposedCanonicalId: string
): string {
  const parts = proposedCanonicalId.split(":");
  const regSlug = parts[0] ?? "";
  const tail = parts.slice(1).join(":");
  const nameWords = slugSegmentToWords(tail) || sel.entity;
  const category = friendlyRegistryCategory(sel.entityType ?? regSlug);
  return `New entity: ${nameWords} (${category})`;
}

export function buildProposalPreview(
  selection: OrchestratorSelection,
  manualSelection: string,
  result: InvestigationResult | null
): ProposalPreview {
  const conf = result?.classificationConfidence;
  const confStr = conf != null ? `${conf}% confidence` : "pending confidence";
  const aliases = result?.aliases?.length ? result.aliases.slice(0, 4).join(", ") : "—";

  switch (selection.kind) {
    case "unknown-entity": {
      const cat = friendlyRegistryCategory(selection.entityType);
      const safetySemantics = inferSafetySemanticsForUnknownEntity(selection, manualSelection);
      return {
        before: `No registry entry yet for “${selection.entity}” (${cat}).`,
        after: `Suggested direction: ${humanizeManual(manualSelection)} · aliases to consider: ${aliases} · ${confStr}.`,
        safetySemantics,
      };
    }
    case "interaction-gap":
      return {
        before: `No documented relationship between ${selection.entityA} and ${selection.entityB}.`,
        after: `Suggested direction: ${humanizeManual(manualSelection)} · evidence: ${result?.evidenceSummary ?? "gathered in session"} · ${confStr}.`,
      };
    case "signal":
      return {
        before: `Safety signal “${selection.title}” not yet tied to a registry change.`,
        after: `Suggested direction: ${humanizeManual(manualSelection)} · notes: ${aliases} · ${confStr}.`,
      };
    case "ingestion-candidate":
      return {
        before: `Candidate “${selection.name ?? selection.candidateId}” not yet promoted.`,
        after: `Suggested direction: ${humanizeManual(manualSelection)} · validation: ${confStr}.`,
      };
    case "registry-entity": {
      const rt = friendlyRegistryCategory(selection.registryType);
      return {
        before: `Current entry “${selection.canonicalId}” (${rt}) — no change filed yet.`,
        after: `Suggested direction: ${humanizeManual(manualSelection)} · ${confStr}.`,
      };
    }
    case "activity":
      return {
        before: `Activity “${selection.title}” is open.`,
        after: `Suggested stewardship: ${humanizeManual(manualSelection)} · ${confStr}.`,
      };
  }
}

function humanizeManual(m: string): string {
  return m.replace(/-/g, " ");
}

/**
 * O8 — Infer minimal safety semantics for new food entities (v1: legume / daal → legume_family).
 * Deterministic; no LLM.
 */
export function inferSafetySemanticsForUnknownEntity(
  sel: Extract<OrchestratorSelection, { kind: "unknown-entity" }>,
  manualSelection: string
): ProposalPreview["safetySemantics"] | undefined {
  const m = manualSelection.replace(/-/g, "_");
  if (m !== "new_entity" && m !== "new-entity") return undefined;
  const et = (sel.entityType ?? "").toLowerCase();
  if (et !== "food" && !et.includes("food") && et !== "meal") return undefined;
  const lower = sel.entity.toLowerCase();
  if (lower.includes("daal") || lower.includes("dal") || lower.includes("lentil")) {
    return { type: "food", class: "legume", riskTags: ["legume_family"] };
  }
  return undefined;
}

export function mockResearchResult(
  selection: OrchestratorSelection,
  manualSelection: string
): InvestigationResult {
  const base =
    selection.kind === "unknown-entity"
      ? selection.entity
      : selection.kind === "interaction-gap"
        ? `${selection.entityA} ↔ ${selection.entityB}`
        : selection.kind === "ingestion-candidate"
          ? selection.name ?? selection.candidateId
          : selection.kind === "registry-entity"
            ? selection.canonicalId
            : selection.kind === "activity"
              ? selection.title
              : selection.title;

  const aliases = [base, `${base} (clinical)`, `${base} (trade name)`].filter(
    (a, i, arr) => a && arr.indexOf(a) === i
  );

  const hash = (manualSelection + base).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const classificationConfidence = 72 + (hash % 23);

  const suggestedClassification =
    selection.kind === "unknown-entity"
      ? manualSelection === "new-entity" || manualSelection === "new_entity"
        ? "New registry entry (candidate)"
        : manualSelection === "alias"
          ? "Alias of existing canonical entity"
          : manualSelection === "dismiss"
            ? "No registry change"
            : "Review operator classification"
      : `Aligned with selection: ${humanizeManual(manualSelection) || "—"}`;

  return {
    aliases,
    classificationConfidence,
    evidenceSummary: "Literature and internal alias index scanned for high-confidence matches.",
    suggestedClassification,
  };
}
