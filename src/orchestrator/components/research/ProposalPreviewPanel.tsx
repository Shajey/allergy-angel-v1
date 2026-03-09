/**
 * Phase O4 – Proposal Preview Panel
 * Deterministic draft proposal, visually distinct from research notes.
 */

interface EntityDraft {
  canonicalName?: string;
  aliases?: string[];
  class?: string;
}

interface AliasDraft {
  canonicalId?: string;
  proposedAlias?: string;
}

interface RelationshipDraft {
  subjectType?: string;
  subjectId?: string;
  relationshipType?: string;
  objectType?: string;
  objectId?: string;
  evidenceLevel?: string;
  confidenceScore?: number;
  reasoning?: string;
}

interface Proposal {
  proposalType: string;
  entityDraft?: EntityDraft;
  aliasDraft?: AliasDraft;
  relationshipDraft?: RelationshipDraft;
  reasoning?: string;
  requiresHumanReview?: boolean;
}

interface Props {
  proposal: Proposal;
}

function proposalTypeLabel(type: string): string {
  const map: Record<string, string> = {
    "create-entity": "Create entity draft",
    "add-alias": "Add alias draft",
    "create-relationship": "Create relationship draft",
    "investigate-only": "Investigate only / no-action",
    "no-action": "No action",
  };
  return map[type] ?? type;
}

export default function ProposalPreviewPanel({ proposal }: Props) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] p-6 font-mono text-[13px] shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#0F172A]">Proposal Manifest</h3>
        <span className="rounded-lg bg-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#475569]">
          Not verified – requires human review
        </span>
      </div>

      <section className="mb-5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
          Proposal type
        </h4>
        <p className="mt-2 text-base font-semibold text-[#0F172A]">
          {proposalTypeLabel(proposal.proposalType)}
        </p>
      </section>

      {proposal.entityDraft && (
        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white/60 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Entity draft
          </h4>
          <dl className="mt-2 space-y-2 text-sm text-[#334155]">
            {proposal.entityDraft.canonicalName && (
              <div className="flex gap-2">
                <span className="font-bold text-[#0F172A] shrink-0">CanonicalName:</span>
                <span className="font-semibold text-[#0F172A]">{proposal.entityDraft.canonicalName}</span>
              </div>
            )}
            {proposal.entityDraft.aliases?.length ? (
              <div className="flex gap-2">
                <span className="font-semibold text-[#475569] shrink-0">aliases:</span>
                <span>{proposal.entityDraft.aliases.join(", ")}</span>
              </div>
            ) : null}
            {proposal.entityDraft.class && (
              <div className="flex gap-2">
                <span className="font-bold text-[#0F172A] shrink-0">Category:</span>
                <span className="font-semibold text-[#0F172A]">{proposal.entityDraft.class}</span>
              </div>
            )}
          </dl>
        </section>
      )}

      {proposal.aliasDraft && (
        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white/60 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Alias draft
          </h4>
          <dl className="mt-2 space-y-2 text-sm text-[#334155]">
            {proposal.aliasDraft.canonicalId && (
              <div>
                <span className="font-medium text-[#475569]">Canonical ID:</span>{" "}
                {proposal.aliasDraft.canonicalId}
              </div>
            )}
            {proposal.aliasDraft.proposedAlias && (
              <div>
                <span className="font-medium text-[#475569]">Proposed alias:</span>{" "}
                {proposal.aliasDraft.proposedAlias}
              </div>
            )}
          </dl>
        </section>
      )}

      {proposal.relationshipDraft && (
        <section className="mb-5 rounded-lg border border-[#CBD5E1] bg-white/60 p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Relationship draft
          </h4>
          <dl className="mt-1 space-y-1 text-sm text-[#334155]">
            {proposal.relationshipDraft.subjectId && (
              <div>
                <span className="font-medium text-[#475569]">Subject:</span>{" "}
                {proposal.relationshipDraft.subjectType} /{" "}
                {proposal.relationshipDraft.subjectId}
              </div>
            )}
            {proposal.relationshipDraft.relationshipType && (
              <div>
                <span className="font-medium text-[#475569]">Type:</span>{" "}
                {proposal.relationshipDraft.relationshipType}
              </div>
            )}
            {proposal.relationshipDraft.objectId && (
              <div>
                <span className="font-medium text-[#475569]">Object:</span>{" "}
                {proposal.relationshipDraft.objectType} /{" "}
                {proposal.relationshipDraft.objectId}
              </div>
            )}
            {proposal.relationshipDraft.evidenceLevel && (
              <div>
                <span className="font-medium text-[#475569]">Evidence:</span>{" "}
                {proposal.relationshipDraft.evidenceLevel}
              </div>
            )}
          </dl>
        </section>
      )}

      {proposal.reasoning && (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
            Reasoning
          </h4>
          <p className="mt-2 text-sm text-[#334155] leading-relaxed">
            {proposal.reasoning}
          </p>
        </section>
      )}
    </div>
  );
}
