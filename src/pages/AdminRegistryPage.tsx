/**
 * Phase 21c – Registry Verification
 *
 * Read-only registry verification view with draft alias proposal support.
 * Proposals do NOT affect live inference.
 */

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { showToast } from "@/lib/toast";
import RegistryEntryCard from "../components/admin/RegistryEntryCard";
import PendingProposalPanel from "../components/admin/PendingProposalPanel";
import {
  fetchRegistryEntries,
  fetchRegistrySearch,
  fetchPendingProposals,
} from "../orchestrator/lib/fetchOrchestratorData";
import OrchestratorPageState from "../orchestrator/components/OrchestratorPageState";
import { useOptionalOrchestratorSelection } from "../orchestrator/context/OrchestratorSelectionContext";

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
  const selection = useOptionalOrchestratorSelection();
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
    if (search.trim()) {
      const result = await fetchRegistrySearch(search.trim(), registryType);
      if (result.ok) {
        setEntries(result.data.results ?? []);
      } else {
        setError(result.error);
        setEntries([]);
      }
    } else {
      const result = await fetchRegistryEntries(registryType);
      if (result.ok) {
        setEntries(result.data.entries ?? []);
      } else {
        setError(result.error);
        setEntries([]);
      }
    }
    setLoading(false);
  }, [registryType, search]);

  const loadProposals = useCallback(async () => {
    setProposalsLoading(true);
    const result = await fetchPendingProposals(registryType, "pending");
    if (result.ok) {
      setProposals(result.data.proposals ?? []);
      setSelectedProposalIds(new Set());
    } else {
      setProposals([]);
    }
    setProposalsLoading(false);
  }, [registryType]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  useEffect(() => {
    loadProposals();
  }, [loadProposals]);

  const handleProposeAdd = async (canonicalId: string, alias: string) => {
    await adminFetch("/api/orchestrator?action=alias-propose-add", {
      method: "POST",
      body: JSON.stringify({ type: registryType, id: canonicalId, alias }),
    });
    await loadProposals();
  };

  const handleProposeRemove = async (canonicalId: string, alias: string) => {
    await adminFetch("/api/orchestrator?action=alias-propose-remove", {
      method: "POST",
      body: JSON.stringify({ type: registryType, id: canonicalId, alias }),
    });
    await loadProposals();
  };

  const handleDismiss = async (proposalId: string) => {
    await adminFetch("/api/orchestrator?action=alias-proposal-dismiss", {
      method: "POST",
      body: JSON.stringify({ proposalId }),
    });
    showToast("Proposal dismissed", "success");
    await loadProposals();
  };

  const handleExport = async (proposalIds: string[]) => {
    const result = await adminFetch<object>("/api/orchestrator?action=alias-proposal-export", {
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

  const pageState =
    loading && entries.length === 0 ? "loading"
    : error && entries.length === 0 ? "error"
    : entries.length === 0 && !search.trim() ? "empty"
    : "success";

  return (
    <OrchestratorPageState
      state={pageState}
      pageName="Registry"
      errorMessage={error}
      emptyMessage="No registry entries yet."
      onRetry={loadEntries}
    >
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Registry</h1>
          <p className="mt-1 text-sm text-gray-600">
            The canonical Allergy Angel knowledge base. Before drafting a proposal, verify whether an entity already exists in the registry.
          </p>
        </div>
        <Link
          to="/orchestrator/radar"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Safety Signals →
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
                  onSelect={
                    selection
                      ? () =>
                          selection.setSelection({
                            kind: "registry-entity",
                            canonicalId: e.id,
                            registryType: e.type,
                            aliasCount: e.aliases?.length ?? 0,
                            entityClass: e.class,
                          })
                      : undefined
                  }
                  isSelected={
                    selection?.selection?.kind === "registry-entity" &&
                    selection.selection.canonicalId === e.id
                  }
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
    </OrchestratorPageState>
  );
}
