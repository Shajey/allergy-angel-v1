/**
 * Phase 23 – Research Modal
 *
 * Admin-only research assistant. Draft-only, requires human review.
 * No wording that implies verified medical truth or live production mutation.
 */

import { useState } from "react";

export type ResearchMode = "entity" | "combination";

interface EntityResearchContext {
  mode: "entity";
  entity: string;
  entityType: string;
  contextEntities?: string[];
  radarMetadata?: Record<string, unknown>;
}

interface CombinationResearchContext {
  mode: "combination";
  entityA: string;
  entityB: string;
  typeA: string;
  typeB: string;
  radarTelemetry?: {
    occurrenceCount?: number;
    highRiskCount?: number;
    safeOccurrenceCount?: number;
    signalPattern?: string;
  };
}

export type ResearchContext = EntityResearchContext | CombinationResearchContext;

interface ResearchModalProps {
  open: boolean;
  onClose: () => void;
  context: ResearchContext | null;
}

export function ResearchModal({ open, onClose, context }: ResearchModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [skipped, setSkipped] = useState<{ reason: string; recommendation: string } | null>(null);

  async function handleStartResearch(forceResearch = false) {
    if (!context) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSkipped(null);
    try {
      const url = context.mode === "entity"
        ? "/api/orchestrator?action=research-entity"
        : "/api/orchestrator?action=research-combination";
      const body = context.mode === "entity"
        ? {
            entity: context.entity,
            entityType: context.entityType,
            contextEntities: context.contextEntities,
            radarMetadata: context.radarMetadata,
            forceResearch,
          }
        : {
            entityA: context.entityA,
            entityB: context.entityB,
            typeA: context.typeA,
            typeB: context.typeB,
            radarTelemetry: context.radarTelemetry,
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
        setSkipped({ reason: data.reason, recommendation: data.recommendation });
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      setLoading(false);
    }
  }

  function handleExportDraft() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `research-draft-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Research Assistant (Draft Only)
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-amber-700">
            Requires human review. Not verified. Not applied to production.
          </p>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1">
          {context && (
            <div className="mb-4 p-3 bg-gray-50 rounded text-sm">
              {context.mode === "entity" ? (
                <p>
                  <strong>Entity:</strong> {context.entity} ({context.entityType})
                </p>
              ) : (
                <p>
                  <strong>Combination:</strong> {context.entityA} + {context.entityB}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-800 rounded text-sm">
              {error}
            </div>
          )}

          {skipped && !loading && (
            <div className="mb-4 p-3 bg-amber-50 text-amber-800 rounded text-sm">
              <p className="font-medium">Research skipped due to low signal</p>
              <p className="mt-1 text-xs">Reason: {skipped.reason}. Recommendation: {skipped.recommendation}</p>
              <p className="mt-2 text-xs">Use Force Research to bypass the threshold gate.</p>
            </div>
          )}

          {loading && (
            <p className="text-sm text-gray-500">Researching…</p>
          )}

          {result && !loading && (
            <div className="space-y-4 text-sm">
              {(result.meta as { cached?: boolean })?.cached && (
                <p className="text-xs text-blue-700 font-medium">Cached research result</p>
              )}
              {result.research && (
                <section>
                  <h3 className="font-medium text-gray-900 mb-2">Research</h3>
                  <pre className="p-3 bg-gray-50 rounded overflow-x-auto text-xs whitespace-pre-wrap">
                    {JSON.stringify(result.research, null, 2)}
                  </pre>
                </section>
              )}
              {result.proposal && (
                <section>
                  <h3 className="font-medium text-gray-900 mb-2">Generate Draft Proposal</h3>
                  <pre className="p-3 bg-amber-50 rounded overflow-x-auto text-xs whitespace-pre-wrap">
                    {JSON.stringify(result.proposal, null, 2)}
                  </pre>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex gap-2 flex-wrap">
          {!result && !skipped ? (
            <>
              <button
                type="button"
                onClick={() => handleStartResearch(false)}
                disabled={loading || !context}
                className="px-4 py-2 bg-gray-900 text-white rounded text-sm font-medium disabled:opacity-50"
              >
                Start research
              </button>
              <button
                type="button"
                onClick={() => handleStartResearch(true)}
                disabled={loading || !context}
                className="px-4 py-2 border border-amber-600 text-amber-700 rounded text-sm font-medium disabled:opacity-50"
              >
                Force research
              </button>
            </>
          ) : skipped ? (
            <button
              type="button"
              onClick={() => handleStartResearch(true)}
              disabled={loading || !context}
              className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-medium disabled:opacity-50"
            >
              Force research
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExportDraft}
              className="px-4 py-2 bg-amber-600 text-white rounded text-sm font-medium"
            >
              Export draft
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 rounded text-sm font-medium text-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
