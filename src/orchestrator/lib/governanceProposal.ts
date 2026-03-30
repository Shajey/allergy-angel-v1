/**
 * Governance — map persisted alias proposals to review labels and before/after text.
 * Aligns with api/_lib/admin/aliasProposalStore proposal_action values.
 */

export type GovernanceProposalKind = "alias" | "new_entity" | "relationship";

export interface GovernanceProposalRow {
  id: string;
  registry_type: string;
  canonical_id: string;
  proposed_alias: string;
  proposal_action: string;
  status: string;
  created_at: string;
  proposed_entry?: Record<string, unknown> | null;
  notes?: string | null;
}

function entryLooksLikeRelationship(entry: Record<string, unknown>): boolean {
  if (entry.relationshipType != null || entry.relationship_type != null) return true;
  if (entry.subjectId != null || entry.subject_id != null) return true;
  if (entry.objectId != null || entry.object_id != null) return true;
  return false;
}

export function classifyGovernanceProposal(p: GovernanceProposalRow): GovernanceProposalKind {
  if (p.proposal_action === "create-entry") {
    const pe = p.proposed_entry;
    if (pe && entryLooksLikeRelationship(pe)) return "relationship";
    return "new_entity";
  }
  return "alias";
}

export function governanceProposalTypeLabel(kind: GovernanceProposalKind): string {
  switch (kind) {
    case "alias":
      return "Alias";
    case "new_entity":
      return "New Entity";
    case "relationship":
      return "Relationship";
    default:
      return "Proposal";
  }
}

/** One-sentence, operator-facing summary (plain English). */
export function governanceProposalSummary(p: GovernanceProposalRow, kind: GovernanceProposalKind): string {
  const rt = p.registry_type;
  const cid = p.canonical_id;
  if (kind === "new_entity") {
    const name = (p.proposed_entry?.name as string) ?? p.proposed_alias;
    const cls =
      (p.proposed_entry?.class as string) ?? (p.proposed_entry?.entityClass as string) ?? undefined;
    const clsPart = cls ? ` as ${cls}` : "";
    return `Create a new ${rt} entity “${name}”${clsPart} with canonical id “${cid}”.`;
  }
  if (kind === "relationship") {
    const sub = String(p.proposed_entry?.subjectId ?? p.proposed_entry?.subject_id ?? cid);
    const obj = String(p.proposed_entry?.objectId ?? p.proposed_entry?.object_id ?? "—");
    const relRaw = String(
      p.proposed_entry?.relationshipType ?? p.proposed_entry?.relationship_type ?? "relationship"
    );
    const rel = relRaw.replace(/_/g, " ");
    return `Add a ${rel} between ${rt} “${sub}” and “${obj}”.`;
  }
  if (p.proposal_action === "remove-alias") {
    return `Remove “${p.proposed_alias}” from the alias list for ${rt} “${cid}”.`;
  }
  return `Map “${p.proposed_alias}” to the existing ${rt} entry “${cid}” as an alternate name.`;
}

/** Compact human-readable change preview (not a JSON diff). */
export function governanceBeforeAfterStrings(
  p: GovernanceProposalRow,
  kind: GovernanceProposalKind
): { before: string; after: string } {
  const rt = p.registry_type;
  const cid = p.canonical_id;
  if (kind === "new_entity") {
    const name = (p.proposed_entry?.name as string) ?? p.proposed_alias;
    const cls =
      (p.proposed_entry?.class as string) ?? (p.proposed_entry?.entityClass as string) ?? undefined;
    const clsPart = cls ? ` · type: ${cls}` : "";
    return {
      before: "No canonical entry for this proposal in the registry yet.",
      after: `New ${rt} entry: “${name}” (id ${cid})${clsPart}.`,
    };
  }
  if (kind === "relationship") {
    const sub = String(p.proposed_entry?.subjectId ?? p.proposed_entry?.subject_id ?? cid);
    const obj = String(p.proposed_entry?.objectId ?? p.proposed_entry?.object_id ?? "—");
    const relRaw = String(
      p.proposed_entry?.relationshipType ?? p.proposed_entry?.relationship_type ?? "relationship"
    );
    const rel = relRaw.replace(/_/g, " ");
    return {
      before: `No “${rel}” link is recorded yet between “${sub}” and “${obj}”.`,
      after: `After approval: ${sub} + ${obj} → ${rel} (${rt}).`,
    };
  }
  if (p.proposal_action === "remove-alias") {
    return {
      before: `${rt} “${cid}” currently lists “${p.proposed_alias}” as an alias.`,
      after: `“${p.proposed_alias}” will be removed from “${cid}”.`,
    };
  }
  return {
    before: `“${p.proposed_alias}” is not yet registered as an alias for ${rt} “${cid}”.`,
    after: `“${p.proposed_alias}” will resolve to canonical ${rt}/${cid}.`,
  };
}

const RATIONALE_KEYS = [
  "rationale",
  "evidence",
  "evidenceSnippet",
  "evidence_snippet",
  "sourceSignal",
  "source_signal",
  "researchOutput",
  "research_summary",
  "researchSummary",
  "suggestedClassification",
  "suggested_classification",
] as const;

/** Lines for “why” — uses notes and known optional fields on proposed_entry only. */
export function governanceProposalRationaleLines(p: GovernanceProposalRow): string[] {
  const out: string[] = [];
  if (p.notes?.trim()) out.push(p.notes.trim());
  const pe = p.proposed_entry;
  if (!pe || typeof pe !== "object") return out;
  const o = pe as Record<string, unknown>;
  const occ = o.occurrenceCount ?? o.occurrences;
  if (typeof occ === "number") out.push(`Observed ${occ} time(s) in telemetry or radar.`);
  for (const key of RATIONALE_KEYS) {
    const v = o[key];
    if (typeof v === "string" && v.trim()) {
      const label =
        key === "sourceSignal" || key === "source_signal"
          ? "Source signal"
          : key === "suggestedClassification" || key === "suggested_classification"
            ? "Suggested classification"
            : key === "rationale"
              ? "Rationale"
              : key.startsWith("research") || key.includes("research")
                ? "Research note"
                : key.includes("evidence")
                  ? "Evidence"
                  : "Detail";
      out.push(`${label}: ${v.trim()}`);
    }
  }
  return out;
}
