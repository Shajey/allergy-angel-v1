/**
 * Phase 24.1 – Ingestion Browser
 *
 * Lightweight review queue for staged ingestion candidates.
 * Proposal-safe wording. No direct registry writes.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  fetchIngestionCandidates,
  fetchIngestionStats,
} from "../orchestrator/lib/fetchOrchestratorData";
import OrchestratorPageState from "../orchestrator/components/OrchestratorPageState";
import { useOptionalOrchestratorSelection } from "../orchestrator/context/OrchestratorSelectionContext";

type CandidateStatus = "pending" | "duplicate" | "promoted" | "dismissed";

interface IngestionCandidate {
  id: string;
  canonicalId: string;
  registryType: string;
  candidateType: string;
  name: string;
  aliases: string[];
  class?: string;
  source: { dataset: string; version: string; recordId: string };
  status: CandidateStatus;
  matchedExisting?: { registryType: string; canonicalId: string; matchType: string };
}

interface Stats {
  pending: number;
  duplicate: number;
  promoted: number;
  dismissed: number;
}

export default function AdminIngestionPage() {
  const orchSelection = useOptionalOrchestratorSelection();
  const [tab, setTab] = useState<CandidateStatus>("pending");
  const [candidates, setCandidates] = useState<IngestionCandidate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  const loadIngestionData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [candRes, statsRes] = await Promise.all([
      fetchIngestionCandidates(tab, 50),
      fetchIngestionStats(),
    ]);
    if (!candRes.ok) {
      setError(candRes.error);
      setCandidates([]);
      setStats(statsRes.ok ? statsRes.data : null);
    } else {
      setCandidates(candRes.data.candidates ?? []);
      setStats(statsRes.ok ? statsRes.data : null);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => {
    loadIngestionData();
  }, [loadIngestionData]);

  async function handleCreateProposal(id: string) {
    setActioning(id);
    try {
      const res = await fetch("/api/orchestrator?action=ingestion-create-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      if (stats) setStats({ ...stats, pending: stats.pending - 1, promoted: stats.promoted + 1 });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setActioning(null);
    }
  }

  async function handleDismiss(id: string) {
    setActioning(id);
    try {
      const res = await fetch("/api/orchestrator?action=ingestion-dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setCandidates((prev) => prev.filter((c) => c.id !== id));
      if (stats) setStats({ ...stats, pending: stats.pending - 1, dismissed: stats.dismissed + 1 });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed");
    } finally {
      setActioning(null);
    }
  }

  const pageState =
    loading && candidates.length === 0 && !error ? "loading"
    : error && candidates.length === 0 ? "error"
    : candidates.length === 0 && !loading ? "empty"
    : "success";

  return (
    <OrchestratorPageState
      state={pageState}
      pageName="Ingestion"
      errorMessage={error}
      emptyMessage="No ingestion candidates yet."
      onRetry={loadIngestionData}
    >
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ingestion</h1>
          <p className="mt-1 text-sm text-gray-600">
            Staged candidates. Create draft proposal or dismiss. Governed promotion only.
          </p>
        </div>
        <Link
          to="/orchestrator/radar"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Signal Radar →
        </Link>
      </div>

      {stats && (
        <div className="mb-6 flex gap-4 text-sm text-gray-600">
          <span>Pending: {stats.pending}</span>
          <span>Duplicate: {stats.duplicate}</span>
          <span>Promoted: {stats.promoted}</span>
          <span>Dismissed: {stats.dismissed}</span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(["pending", "duplicate", "promoted", "dismissed"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === t
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500">No {tab} candidates.</p>
        ) : (
          candidates.map((c) => {
            const isSelected =
              orchSelection?.selection?.kind === "ingestion-candidate" &&
              orchSelection.selection.candidateId === c.id;
            return (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() =>
                orchSelection?.setSelection({
                  kind: "ingestion-candidate",
                  candidateId: c.id,
                  name: c.name,
                  canonicalId: c.canonicalId,
                  sourceDataset: c.source.dataset,
                  aliasCount: c.aliases.length,
                })
              }
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && orchSelection) {
                  e.preventDefault();
                  orchSelection.setSelection({
                    kind: "ingestion-candidate",
                    candidateId: c.id,
                    name: c.name,
                    canonicalId: c.canonicalId,
                    sourceDataset: c.source.dataset,
                    aliasCount: c.aliases.length,
                  });
                }
              }}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                isSelected ? "ring-2 ring-[#0F172A] ring-offset-1 border-[#0F172A] bg-gray-50" : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {c.canonicalId} · {c.aliases.length} aliases
                    {c.class && ` · ${c.class}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.source.dataset} {c.source.version} · {c.source.recordId}
                  </p>
                  {c.matchedExisting && (
                    <p className="text-xs text-amber-700 mt-1">
                      Duplicate of {c.matchedExisting.canonicalId} ({c.matchedExisting.matchType})
                    </p>
                  )}
                </div>
                {tab === "pending" && (
                  <div className="flex gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleCreateProposal(c.id)}
                      disabled={!!actioning}
                      className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded disabled:opacity-50"
                    >
                      {actioning === c.id ? "..." : "Create draft proposal"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDismiss(c.id)}
                      disabled={!!actioning}
                      className="px-3 py-1.5 text-sm font-medium border border-gray-200 rounded text-gray-700 disabled:opacity-50"
                    >
                      Dismiss candidate
                    </button>
                  </div>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
    </OrchestratorPageState>
  );
}
