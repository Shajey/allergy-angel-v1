/**
 * Phase O4 – Research Workspace Page
 * Primary home for admin research. Lab bench flow.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useOptionalOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import {
  parseResearchTargetFromSearchParams,
  researchTargetFromSelection,
  type ResearchTarget,
} from "../lib/researchTarget";
import ProposalPreviewPanel from "../components/research/ProposalPreviewPanel";
import ResearchOutputPanel from "../components/research/ResearchOutputPanel";
import ResearchTargetSummary from "../components/research/ResearchTargetSummary";
import ResearchWorkspaceLayout from "../components/research/ResearchWorkspaceLayout";
import { Link } from "react-router-dom";

type ResearchResult =
  | { researchSkipped: true; reason: string; recommendation: string }
  | {
      research: unknown;
      proposal: Record<string, unknown>;
      meta?: { sourceMode?: string; cached?: boolean };
    };

export default function ResearchWorkspacePage() {
  const [searchParams] = useSearchParams();
  const selection = useOptionalOrchestratorSelection()?.selection ?? null;

  const [target, setTarget] = useState<ResearchTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const derivedTarget = parseResearchTargetFromSearchParams(searchParams) ?? researchTargetFromSelection(selection);

  useEffect(() => {
    setTarget(derivedTarget);
    if (!derivedTarget) {
      setResult(null);
      setError(null);
    }
  }, [derivedTarget]);

  const runResearch = useCallback(
    async (forceResearch = false) => {
      if (!target) return;
      setLoading(true);
      setError(null);
      setResult(null);
      try {
        const url =
          target.mode === "entity"
            ? "/api/orchestrator?action=research-entity"
            : "/api/orchestrator?action=research-combination";
        const body =
          target.mode === "entity"
            ? {
                entity: target.entity,
                entityType: target.entityType,
                radarMetadata: target.radarMetadata,
                forceResearch,
              }
            : {
                entityA: target.entityA,
                entityB: target.entityB,
                typeA: target.typeA,
                typeB: target.typeB,
                radarTelemetry: target.radarTelemetry,
                forceResearch,
              };
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Research failed");
        }
        if (data.researchSkipped) {
          setResult({
            researchSkipped: true,
            reason: data.reason,
            recommendation: data.recommendation,
          });
        } else {
          setResult({
            research: data.research,
            proposal: data.proposal,
            meta: data.meta,
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Research failed");
      } finally {
        setLoading(false);
      }
    },
    [target]
  );

  const exportDraft = useCallback(() => {
    if (!result || "researchSkipped" in result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `research-draft-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }, [result]);

  if (!target) {
    return (
      <ResearchWorkspaceLayout>
        <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
          <h2 className="text-lg font-semibold text-[#0F172A]">No research target selected</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Select a signal, entity, or interaction gap from Radar or the Context Panel, or open
            Research with query params.
          </p>
          <Link
            to="/orchestrator/radar"
            className="mt-4 inline-block text-sm font-medium text-[#0F172A] hover:text-[#334155]"
          >
            Open Radar →
          </Link>
        </div>
      </ResearchWorkspaceLayout>
    );
  }

  return (
    <ResearchWorkspaceLayout>
      <ResearchTargetSummary target={target} />

      <div className="flex flex-col gap-4">
        {!result && !loading && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => runResearch(false)}
              className="orch-gradient-btn rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
            >
              Start research
            </button>
            <button
              type="button"
              onClick={() => runResearch(true)}
              className="rounded-lg border border-[#F59E0B] px-4 py-2 text-sm font-medium text-[#B45309] hover:bg-[#FFFBEB] disabled:opacity-50"
            >
              Force research
            </button>
          </div>
        )}

        {loading && (
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-6 text-center">
            <p className="text-sm text-[#64748B]">Researching…</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm text-[#B91C1C]">
            {error}
          </div>
        )}

        {result && "researchSkipped" in result && !loading && (
          <div className="rounded-lg border border-[#FCD34D] bg-[#FFFBEB] p-4">
            <p className="font-medium text-[#92400E]">Research skipped due to low signal</p>
            <p className="mt-1 text-sm text-[#B45309]">
              Reason: {result.reason}. Recommendation: {result.recommendation}
            </p>
            <button
              type="button"
              onClick={() => runResearch(true)}
              className="mt-3 rounded-lg bg-[#F59E0B] px-4 py-2 text-sm font-medium text-white hover:bg-[#D97706]"
            >
              Force research
            </button>
          </div>
        )}

        {result && !("researchSkipped" in result) && result.research && (
          <ResearchOutputPanel
            research={result.research as Parameters<typeof ResearchOutputPanel>[0]["research"]}
            meta={result.meta}
            mode={target.mode}
          />
        )}

        {result && !("researchSkipped" in result) && result.proposal && (
          <ProposalPreviewPanel proposal={result.proposal as Parameters<typeof ProposalPreviewPanel>[0]["proposal"]} />
        )}

        {result && !("researchSkipped" in result) && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportDraft}
              className="orch-gradient-btn rounded-lg px-4 py-2 text-sm font-medium"
            >
              Save draft proposal
            </button>
            <button
              type="button"
              onClick={exportDraft}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]"
            >
              Export draft
            </button>
            <Link
              to="/orchestrator/radar"
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]"
            >
              Back to Radar
            </Link>
            <button
              type="button"
              onClick={() => runResearch(true)}
              className="rounded-lg border border-[#E2E8F0] px-4 py-2 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]"
            >
              Re-run research
            </button>
          </div>
        )}
      </div>
    </ResearchWorkspaceLayout>
  );
}
