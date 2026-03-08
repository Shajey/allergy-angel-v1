/**
 * Phase 21c – Admin Registry Browser
 *
 * Read-only registry browser with draft alias proposal support.
 * Proposals do NOT affect live inference.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { showToast } from "@/lib/toast";
import RegistryEntryCard from "../components/admin/RegistryEntryCard";
import PendingProposalPanel from "../components/admin/PendingProposalPanel";

type RegistryType = "drug" | "supplement" | "food";

interface RegistryEntry {
  id: string;
  type: string;
  aliases: string[];
  class?: string;
  source?: string;
  matchedOn?: string;
}

interface Proposal {
  id: string;
  registry_type: string;
  canonical_id: string;
  proposed_alias: string;
  proposal_action: string;
  status: string;
  created_at: string;
}

const REGISTRY_TYPES: RegistryType[] = ["drug", "supplement", "food"];

async function adminFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export default function AdminRegistryPage() {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get("search") ?? "";
  const [registryType, setRegistryType] = useState<RegistryType>("drug");
  const [search, setSearch] = useState(initialSearch);
  const [entries, setEntries] = useState<RegistryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(true);
  const [selectedProposalIds, setSelectedProposalIds] = useState<Set<string>>(new Set());
  const [exportResult, setExportResult] = useState<object | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (search.trim()) {
        const result = await adminFetch<{ results: RegistryEntry[] }>(
          `/api/admin?action=registry-search&search=${encodeURIComponent(search.trim())}&type=${registryType}`
        );
        setEntries(result.results ?? []);
      } else {
        const result = await adminFetch<{ entries: RegistryEntry[] }>(
          `/api/admin?action=registry-list&type=${registryType}`
        );
        setEntries(result.entries ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load registry");
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [registryType, search]);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    try {
      const result = await adminFetch<{ proposals: Proposal[] }>(
        `/api/admin?action=alias-proposals&type=${registryType}&status=pending`
      );
      setProposals(result.proposals ?? []);
      setSelectedProposalIds(new Set());
    } catch {
      setProposals([]);
    } finally {
      setProposalsLoading(false);
    }
  }, [registryType]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const handleProposeAdd = async (canonicalId: string, alias: string) => {
    await adminFetch("/api/admin?action=alias-propose-add", {
      method: "POST",
      body: JSON.stringify({ type: registryType, id: canonicalId, alias }),
    });
    await loadProposals();
  };

  const handleProposeRemove = async (canonicalId: string, alias: string) => {
    await adminFetch("/api/admin?action=alias-propose-remove", {
      method: "POST",
      body: JSON.stringify({ type: registryType, id: canonicalId, alias }),
    });
    await loadProposals();
  };

  const handleDismiss = async (proposalId: string) => {
    await adminFetch("/api/admin?action=alias-proposal-dismiss", {
      method: "POST",
      body: JSON.stringify({ proposalId }),
    });
    showToast("Proposal dismissed", "success");
    await loadProposals();
  };

  const handleExport = async (proposalIds: string[]) => {
    const result = await adminFetch<object>("/api/admin?action=alias-proposal-export", {
      method: "POST",
      body: JSON.stringify({ proposalIds }),
    });
    setExportResult(result);
    await loadProposals();
  };

  const toggleProposalSelect = (id: string) => {
    setSelectedProposalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Registry Browser</h1>
          <p className="mt-1 text-sm text-gray-600">
            View registries and draft alias proposals. Proposals do not affect live inference.
          </p>
        </div>
        <Link
          to="/admin/unmapped"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Unmapped Discovery →
        </Link>
      </div>

      {/* Registry type tabs */}
      <div className="flex gap-2 mb-4">
        {REGISTRY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setRegistryType(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              registryType === t
                ? "bg-gray-900 text-white"
                : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by alias or canonical ID..."
          className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Export result */}
      {exportResult && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800 mb-2">Export complete</p>
          <pre className="text-xs text-green-900 overflow-auto max-h-48">
            {JSON.stringify(exportResult, null, 2)}
          </pre>
          <button
            type="button"
            onClick={() => setExportResult(null)}
            className="mt-2 text-sm text-green-700 hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        {/* Entry list */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            {search.trim() ? "Search results" : `${registryType} entries`}
          </h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-gray-500">
              {search.trim()
                ? "No registry entries match this search."
                : "No entries found."}
            </p>
          ) : (
            <div className="space-y-3">
              {entries.map((e) => (
                <RegistryEntryCard
                  key={`${e.type}-${e.id}`}
                  id={e.id}
                  type={e.type}
                  aliases={e.aliases}
                  entityClass={e.class}
                  source={e.source ?? "static"}
                  matchedOn={e.matchedOn}
                  onProposeAdd={(alias) => handleProposeAdd(e.id, alias)}
                  onProposeRemove={(alias) => handleProposeRemove(e.id, alias)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Pending proposals */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">Pending proposals</h2>
          <PendingProposalPanel
            proposals={proposals}
            selectedIds={selectedProposalIds}
            onToggleSelect={toggleProposalSelect}
            onDismiss={handleDismiss}
            onExport={handleExport}
            loading={proposalsLoading}
          />
        </div>
      </div>
    </div>
  );
}
