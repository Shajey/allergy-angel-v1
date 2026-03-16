/**
 * Phase O4 – Research Workspace Page
 * Primary home for admin research. Lab bench flow.
 */

import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useOptionalOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import {
  parseResearchTargetFromSearchParams,
  researchTargetFromSelection,
  buildResearchUrl,
  type ResearchTarget,
} from "../lib/researchTarget";
import ProposalPreviewPanel from "../components/research/ProposalPreviewPanel";
import ResearchOutputPanel from "../components/research/ResearchOutputPanel";
import ResearchTargetSummary from "../components/research/ResearchTargetSummary";
import ResearchWorkspaceLayout from "../components/research/ResearchWorkspaceLayout";
import { useActivityStore } from "../lib/activityStore";
import { Link } from "react-router-dom";

type ResearchResult =
  | { researchSkipped: true; reason: string; recommendation: string }
  | {
      research: unknown;
      proposal: Record<string, unknown>;
      meta?: { sourceMode?: string; cached?: boolean };
    };

function useStableTarget(target: ResearchTarget | null): ResearchTarget | null {
  const ref = useRef<ResearchTarget | null>(null);
  const key = target ? JSON.stringify(target) : null;
  const prevKey = ref.current ? JSON.stringify(ref.current) : null;
  if (key !== prevKey) {
    ref.current = target;
  }
  return ref.current;
}

export default function ResearchWorkspacePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const selection = useOptionalOrchestratorSelection()?.selection ?? null;
  const activityStore = useActivityStore();

  const [target, setTarget] = useState<ResearchTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResearchResult | null>(null);

  const targetFromParams = useMemo(
    () => parseResearchTargetFromSearchParams(searchParams),
    [searchParams]
  );
  const targetFromSelection = useMemo(
    () => researchTargetFromSelection(selection),
    [selection]
  );
  const derivedTarget = useStableTarget(targetFromParams ?? targetFromSelection);
  const hasParams = targetFromParams !== null;
  const hasSelection = targetFromSelection !== null;

  useEffect(() => {
    setTarget(derivedTarget);
    if (!derivedTarget) {
      setResult(null);
      setError(null);
      return;
    }
    // Persist target to URL when from selection — so "Start research" stays visible if selection clears
    if (!hasParams && hasSelection) {
      navigate(buildResearchUrl(derivedTarget), { replace: true });
    }
  }, [derivedTarget, hasParams, hasSelection, navigate]);

  const runResearch = useCallback(
    async (forceResearch = false) => {
      if (!target) return;
      setLoading(true);
      setError(null);
      setResult(null);
      const targetLabel = target.mode === "entity" ? target.entity : `${target.entityA} + ${target.entityB}`;
      activityStore?.pushEvent({
        type: "research_started",
        message: `Research started: ${targetLabel}`,
        status: "info",
        source: "ui",
        metadata: { target: target.mode === "entity" ? target.entity : [target.entityA, target.entityB] },
      });
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
          activityStore?.pushEvent({
            type: "research_completed",
            message: `Research skipped: ${targetLabel}`,
            status: "warning",
            source: "api",
            metadata: { reason: data.reason },
          });
        } else {
          setResult({
            research: data.research,
            proposal: data.proposal,
            meta: data.meta,
          });
          activityStore?.pushEvent({
            type: "research_completed",
            message: `Research completed: ${targetLabel}`,
            status: "success",
            source: "api",
            metadata: { cached: data.meta?.cached },
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Research failed";
        setError(msg);
        activityStore?.pushEvent({
          type: "research_failed",
          message: `Research failed: ${targetLabel}`,
          status: "error",
          source: "api",
          metadata: { error: msg },
        });
      } finally {
        setLoading(false);
      }
    },
    [target, activityStore]
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
    activityStore?.pushEvent({
      type: "proposal_exported",
      message: "Proposal draft exported",
      status: "success",
      source: "governance",
    });
  }, [result, activityStore]);

  if (!target) {
    return (
      <ResearchWorkspaceLayout>
        <div className="rounded-xl border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-8 text-center">
          <h2 className="text-lg font-semibold text-[#0F172A]">No safety signal selected</h2>
          <p className="mt-2 text-sm text-[#64748B]">
            Select a safety signal, entity, or interaction gap from Safety Signals to begin investigation.
          </p>
          <Link
            to="/orchestrator/radar"
            className="mt-4 inline-block text-sm font-medium text-[#0F172A] hover:text-[#334155]"
          >
            Return to Safety Signals →
          </Link>
        </div>
      </ResearchWorkspaceLayout>
    );
  }

  return (
    <ResearchWorkspaceLayout>
      {/* Section 1 — TARGET: observed unknown entity (input signal) */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-4">1. Target</h2>
        <ResearchTargetSummary target={target} />
      </section>

      <div className="flex flex-col gap-8">
        {!result && !loading && (
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-4">2. Evidence</h2>
            <p className="text-sm text-[#64748B] mb-4">Run research to gather evidence.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => runResearch(false)}
                className="orch-gradient-btn rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
              >
                Start research
              </button>
              <button
                type="button"
                onClick={() => runResearch(true)}
                className="rounded-xl border border-[#F59E0B] px-5 py-2.5 text-sm font-medium text-[#B45309] hover:bg-[#FFFBEB] disabled:opacity-50"
              >
                Force research
              </button>
            </div>
          </section>
        )}

        {loading && (
          <section className="rounded-xl border border-[#E2E8F0] bg-white p-6 text-center">
            <p className="text-sm text-[#64748B]">Researching…</p>
          </section>
        )}

        {error && (
          <section className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#B91C1C]">
            {error}
          </section>
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

        {/* Section 2 — EVIDENCE: raw research findings */}
        {result && !("researchSkipped" in result) && result.research && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-4">2. Evidence</h2>
            <ResearchOutputPanel
              research={result.research as Parameters<typeof ResearchOutputPanel>[0]["research"]}
              meta={result.meta}
              mode={target.mode}
            />
          </section>
        )}

        {/* Section 3 — PROPOSAL MANIFEST: system-generated ontology change candidate */}
        {result && !("researchSkipped" in result) && result.proposal && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[#64748B] mb-4">3. Proposal Manifest</h2>
            <ProposalPreviewPanel proposal={result.proposal as Parameters<typeof ProposalPreviewPanel>[0]["proposal"]} />
          </section>
        )}

        {/* Section 4 — GOVERNANCE FOOTER: persistent action bar */}
        {result && !("researchSkipped" in result) && (
          <footer
            className="sticky bottom-0 -mx-6 px-6 py-4 mt-4 border-t border-[#E2E8F0] bg-white/90 backdrop-blur-md shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
            role="contentinfo"
          >
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={exportDraft}
                className="orch-gradient-btn rounded-xl px-5 py-2.5 text-sm font-semibold"
              >
                Save Draft Proposal
              </button>
              <button
                type="button"
                onClick={exportDraft}
                className="rounded-xl border border-[#E2E8F0] px-5 py-2.5 text-sm font-medium text-[#334155] hover:bg-[#F8FAFC]"
              >
                Export Draft
              </button>
              <button
                type="button"
                onClick={() => runResearch(true)}
                className="rounded-xl border border-[#CBD5E1] px-5 py-2.5 text-sm font-medium text-[#64748B] hover:bg-[#F8FAFC]"
              >
                Re-run Research
              </button>
            </div>
          </footer>
        )}
      </div>
    </ResearchWorkspaceLayout>
  );
}
