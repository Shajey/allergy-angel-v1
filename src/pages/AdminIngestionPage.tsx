/**
 * Phase 24.1 – Ingestion Browser
 *
 * Lightweight review queue for staged ingestion candidates.
 * Proposal-safe wording. No direct registry writes.
 */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

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
  const [tab, setTab] = useState<CandidateStatus>("pending");
  const [candidates, setCandidates] = useState<IngestionCandidate[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const [candRes, statsRes] = await Promise.all([
          fetch(`/api/admin?action=ingestion-candidates&status=${tab}&limit=50`),
          fetch(`/api/admin?action=ingestion-stats`),
        ]);
        if (!candRes.ok) throw new Error(candRes.statusText);
        if (!statsRes.ok) throw new Error(statsRes.statusText);
        const [candJson, statsJson] = await Promise.all([candRes.json(), statsRes.json()]);
        if (!cancelled) {
          setCandidates(candJson.candidates ?? []);
          setStats(statsJson);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function handleCreateProposal(id: string) {
    setActioning(id);
    try {
      const res = await fetch("/api/admin?action=ingestion-create-proposal", {
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
      const res = await fetch("/api/admin?action=ingestion-dismiss", {
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

  if (loading && candidates.length === 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <p className="text-sm text-gray-500">Loading ingestion candidates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Ingestion Candidates</h1>
          <p className="mt-1 text-sm text-gray-600">
            Staged RxNorm candidates. Create draft proposal or dismiss. Governed flow only.
          </p>
        </div>
        <Link
          to="/admin/unmapped"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Knowledge Radar →
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
          candidates.map((c) => (
            <div
              key={c.id}
              className="p-4 border border-gray-200 rounded-lg bg-white"
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
                  <div className="flex gap-2 shrink-0">
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
          ))
        )}
      </div>
    </div>
  );
}
