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
    <div className="rounded-lg border-2 border-[#FCD34D] bg-[#FFFBEB] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#92400E]">Proposal preview</h3>
        <span className="rounded bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">
          Not verified · Requires human review
        </span>
      </div>

      <section className="mb-3">
        <h4 className="text-xs font-medium uppercase tracking-wide text-[#B45309]">
          Proposal type
        </h4>
        <p className="mt-1 font-medium text-[#0F172A]">
          {proposalTypeLabel(proposal.proposalType)}
        </p>
      </section>

      {proposal.entityDraft && (
        <section className="mb-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-[#B45309]">
            Entity draft
          </h4>
          <dl className="mt-1 space-y-1 text-sm text-[#334155]">
            {proposal.entityDraft.canonicalName && (
              <div>
                <span className="font-medium text-[#475569]">Canonical:</span>{" "}
                {proposal.entityDraft.canonicalName}
              </div>
            )}
            {proposal.entityDraft.aliases?.length ? (
              <div>
                <span className="font-medium text-[#475569]">Aliases:</span>{" "}
                {proposal.entityDraft.aliases.join(", ")}
              </div>
            ) : null}
            {proposal.entityDraft.class && (
              <div>
                <span className="font-medium text-[#475569]">Class:</span>{" "}
                {proposal.entityDraft.class}
              </div>
            )}
          </dl>
        </section>
      )}

      {proposal.aliasDraft && (
        <section className="mb-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-[#B45309]">
            Alias draft
          </h4>
          <dl className="mt-1 space-y-1 text-sm text-[#334155]">
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
        <section className="mb-3">
          <h4 className="text-xs font-medium uppercase tracking-wide text-[#B45309]">
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
          <h4 className="text-xs font-medium uppercase tracking-wide text-[#B45309]">
            Reasoning
          </h4>
          <p className="mt-1 text-sm text-[#334155] leading-relaxed">
            {proposal.reasoning}
          </p>
        </section>
      )}
    </div>
  );
}
