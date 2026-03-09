/**
 * Phase O4/O5 – Research Output Panel
 * Structured research display as draft intelligence report.
 * O5: Evidence attribution with Source Quality badge, .orch-entity-link for scientific names.
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

/** Phase O5: Source Quality badge for evidence attribution */
function SourceQualityBadge({ quality, pattern }: { quality: "high" | "medium" | "low"; pattern?: string }) {
  const config: Record<string, { label: string; className: string }> = {
    high: { label: "Quality: High", className: "bg-emerald-50 text-emerald-800" },
    medium: { label: "Quality: Medium", className: "bg-amber-50 text-amber-800" },
    low: { label: "Quality: Low", className: "bg-red-50 text-red-800" },
  };
  const c = config[quality];
  const defaultPatterns: Record<string, string> = {
    high: "Peer-reviewed pattern",
    medium: "Multi-source culinary reference",
    low: "Weak evidence",
  };
  const subtitle = pattern || defaultPatterns[quality];
  return (
    <span className={`inline-flex flex-col items-start rounded px-2 py-1 text-xs ${c.className}`}>
      <span className="font-medium">{c.label}</span>
      <span className="text-[10px] opacity-90">{subtitle}</span>
    </span>
  );
}

function inferSourceQuality(evidenceQuality?: string, sourceMode?: string): "high" | "medium" | "low" {
  if (sourceMode === "provided_curated_sources") return "high";
  const q = (evidenceQuality ?? "").toLowerCase();
  if (q.includes("peer") || q.includes("clinical") || q.includes("verified")) return "high";
  if (q.includes("multi") || q.includes("culinary") || q.includes("reference")) return "medium";
  return "low";
}

export default function ResearchOutputPanel({ research, meta, mode }: Props) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#0F172A]">Research output</h3>
        <span className="rounded-lg bg-[#FEF3C7] px-2.5 py-1 text-xs font-medium text-[#92400E]">
          Research draft · Requires human review
        </span>
      </div>
      {meta?.sourceMode && (
        <p className="mb-4 text-xs text-[#64748B]">
          Source mode: {sourceModeLabel(meta.sourceMode)}
        </p>
      )}

      {mode === "entity" && "identity" in research ? (
        <div className="space-y-6 text-sm">
          <section>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
              Identity
            </h4>
            <p className="mt-2 font-semibold text-[#0F172A]">
              {research.identity.canonicalName}
            </p>
            {research.identity.scientificName && (
              <p className="mt-1 text-[#64748B] leading-relaxed">
                Scientific:{" "}
                <span className="orch-entity-link">{research.identity.scientificName}</span>
              </p>
            )}
          </section>
          {research.identity.commonAliases?.length ? (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Aliases
              </h4>
              <p className="mt-2 text-[#334155] leading-relaxed">
                {research.identity.commonAliases.join(", ")}
              </p>
            </section>
          ) : null}
          {(research.identity.category || research.identity.class) && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Category
              </h4>
              <p className="mt-2 text-[#334155] leading-relaxed">
                {[research.identity.category, research.identity.class]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </section>
          )}
          {research.identity.description && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Description
              </h4>
              <p className="mt-2 text-[#334155] leading-relaxed">
                {research.identity.description}
              </p>
            </section>
          )}
          {(research.identity.evidenceQuality ?? research.identity.confidenceScore != null) && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Evidence / Confidence
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {research.identity.confidenceScore != null && (
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs font-medium text-[#64748B]">Score:</span>
                    <span className="font-semibold text-[#0F172A]">{research.identity.confidenceScore}</span>
                  </span>
                )}
                <SourceQualityBadge
                  quality={inferSourceQuality(research.identity.evidenceQuality, meta?.sourceMode)}
                  pattern={research.identity.evidenceQuality}
                />
              </div>
            </section>
          )}
          {research.identity.uncertaintyNotes && (
            <section className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#B45309]">
                Uncertainty notes
              </h4>
              <p className="mt-2 text-sm text-[#92400E] leading-relaxed">{research.identity.uncertaintyNotes}</p>
            </section>
          )}
        </div>
      ) : mode === "combination" ? (
        <div className="space-y-6 text-sm">
          {"interactionType" in research && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Interaction type
              </h4>
              <p className="mt-2 font-semibold text-[#0F172A] leading-relaxed">
                {research.interactionType ?? "—"}
              </p>
            </section>
          )}
          {"evidenceLevel" in research && research.evidenceLevel && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Evidence / Confidence
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-[#334155]">{research.evidenceLevel}</span>
                <SourceQualityBadge
                  quality={inferSourceQuality(research.evidenceLevel, meta?.sourceMode)}
                  pattern={research.evidenceLevel}
                />
              </div>
            </section>
          )}
          {"mechanism" in research && research.mechanism && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Mechanism hypothesis
              </h4>
              <p className="mt-2 text-[#334155] leading-relaxed">{research.mechanism}</p>
            </section>
          )}
          {"severityHypothesis" in research && research.severityHypothesis && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Severity hypothesis
              </h4>
              <p className="mt-2 text-[#334155]">{research.severityHypothesis}</p>
            </section>
          )}
          {"summary" in research && research.summary && (
            <section>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">
                Summary
              </h4>
              <p className="mt-2 text-[#334155] leading-relaxed">{research.summary}</p>
            </section>
          )}
          {"uncertaintyNotes" in research && research.uncertaintyNotes && (
            <section className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-[#B45309]">
                Uncertainty notes
              </h4>
              <p className="mt-2 text-sm text-[#92400E] leading-relaxed">{research.uncertaintyNotes}</p>
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
