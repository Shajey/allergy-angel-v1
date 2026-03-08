/**
 * Phase O4 – Research Output Panel
 * Structured research display as draft intelligence report.
 */

interface EntityResearch {
  identity: {
    canonicalName: string;
    scientificName?: string;
    commonAliases?: string[];
    category?: string;
    class?: string;
    description?: string;
    safetyNotes?: string;
    evidenceQuality?: string;
    confidenceScore?: number;
    uncertaintyNotes?: string;
  };
  confidenceScore?: number;
}

interface CombinationResearch {
  interactionFound?: boolean;
  interactionType?: string;
  mechanism?: string;
  severityHypothesis?: string;
  evidenceLevel?: string;
  summary?: string;
  uncertaintyNotes?: string;
  sourceNotes?: string;
}

interface Props {
  research: EntityResearch | CombinationResearch;
  meta?: { sourceMode?: string };
  mode: "entity" | "combination";
}

function sourceModeLabel(mode?: string): string {
  if (mode === "provided_curated_sources") return "Verified source context";
  return "Model knowledge only";
}

export default function ResearchOutputPanel({ research, meta, mode }: Props) {
  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#0F172A]">Research output</h3>
        <span className="rounded bg-[#FEF3C7] px-2 py-0.5 text-xs font-medium text-[#92400E]">
          Research draft · Requires human review
        </span>
      </div>
      {meta?.sourceMode && (
        <p className="mb-3 text-xs text-[#64748B]">
          Source mode: {sourceModeLabel(meta.sourceMode)}
        </p>
      )}

      {mode === "entity" && "identity" in research ? (
        <div className="space-y-3 text-sm">
          <section>
            <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
              Identity
            </h4>
            <p className="mt-1 font-medium text-[#0F172A]">
              {research.identity.canonicalName}
            </p>
            {research.identity.scientificName && (
              <p className="text-xs text-[#64748B]">
                Scientific: {research.identity.scientificName}
              </p>
            )}
          </section>
          {research.identity.commonAliases?.length ? (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Aliases
              </h4>
              <p className="mt-1 text-[#334155]">
                {research.identity.commonAliases.join(", ")}
              </p>
            </section>
          ) : null}
          {(research.identity.category || research.identity.class) && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Category / Class
              </h4>
              <p className="mt-1 text-[#334155]">
                {[research.identity.category, research.identity.class]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          )}
          {research.identity.description && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Description
              </h4>
              <p className="mt-1 text-[#334155] leading-relaxed">
                {research.identity.description}
              </p>
            </section>
          )}
          {(research.identity.evidenceQuality ?? research.identity.confidenceScore != null) && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Evidence / Confidence
              </h4>
              <p className="mt-1 text-[#334155]">
                {research.identity.evidenceQuality}
                {research.identity.confidenceScore != null &&
                  ` · Score: ${research.identity.confidenceScore}`}
              </p>
            </section>
          )}
          {research.identity.uncertaintyNotes && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#F59E0B]">
                Uncertainty notes
              </h4>
              <p className="mt-1 text-[#92400E]">{research.identity.uncertaintyNotes}</p>
            </section>
          )}
        </div>
      ) : mode === "combination" ? (
        <div className="space-y-3 text-sm">
          {"interactionType" in research && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Interaction type
              </h4>
              <p className="mt-1 font-medium text-[#0F172A]">
                {research.interactionType ?? "—"}
              </p>
            </section>
          )}
          {"mechanism" in research && research.mechanism && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Mechanism hypothesis
              </h4>
              <p className="mt-1 text-[#334155]">{research.mechanism}</p>
            </section>
          )}
          {"severityHypothesis" in research && research.severityHypothesis && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Severity hypothesis
              </h4>
              <p className="mt-1 text-[#334155]">{research.severityHypothesis}</p>
            </section>
          )}
          {"evidenceLevel" in research && research.evidenceLevel && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Evidence level
              </h4>
              <p className="mt-1 text-[#334155]">{research.evidenceLevel}</p>
            </section>
          )}
          {"summary" in research && research.summary && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
                Summary
              </h4>
              <p className="mt-1 text-[#334155] leading-relaxed">{research.summary}</p>
            </section>
          )}
          {"uncertaintyNotes" in research && research.uncertaintyNotes && (
            <section>
              <h4 className="text-xs font-medium uppercase tracking-wide text-[#F59E0B]">
                Uncertainty notes
              </h4>
              <p className="mt-1 text-[#92400E]">{research.uncertaintyNotes}</p>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
