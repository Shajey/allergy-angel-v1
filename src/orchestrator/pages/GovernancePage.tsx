/**
 * Governance — queue + review desk (O6.11 / O7).
 * Client queue (Signals) + registry-backed API rows; center uses same preview as Signals.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  dismissAliasProposal,
  fetchGovernancePendingProposals,
  promoteAliasProposals,
} from "../lib/fetchOrchestratorData";
import type { GovernanceProposalRow } from "../lib/governanceProposal";
import {
  classifyGovernanceProposal,
  governanceProposalTypeLabel,
} from "../lib/governanceProposal";
import { useActivityStore } from "../lib/activityStore";
import { useInvestigationStore } from "../context/InvestigationStoreContext";
import { governanceItemFromInvestigationEntry } from "../lib/governanceRehydrate";
import { useGovernanceStore, type GovernanceItem } from "../lib/governanceStore";
import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { stableSelectionKey } from "../lib/investigationKey";
import { impactLineForApiProposal, impactLineForGovernanceItem } from "../lib/governanceImpactLine";
import ProposalReviewPanel from "../components/governance/ProposalReviewPanel";
import GovernanceSignalReviewDesk from "../components/governance/GovernanceSignalReviewDesk";
import GovernanceActionBar, {
  type GovernanceActionPhase,
} from "../components/governance/GovernanceActionBar";

function localSelectionKey(id: string): string {
  return `local:${id}`;
}

function apiSelectionKey(id: string): string {
  return `api:${id}`;
}

function formatShortDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(ts);
  }
}

export default function GovernancePage() {
  const activity = useActivityStore();
  const { selection } = useOrchestratorSelection();
  const { proposals: governanceItems, add: addGovernanceRow, updateItemStatus } = useGovernanceStore();
  const { resolveFromGovernance, listPendingGovernanceWithProposal } = useInvestigationStore();

  /** Investigation can be pending_governance (sidebar badge) while the governance queue row was lost — sync rows. */
  useLayoutEffect(() => {
    const storeIds = new Set(governanceItems.map((p) => p.id));
    for (const { signalId, entry } of listPendingGovernanceWithProposal()) {
      if (storeIds.has(signalId)) continue;
      const row = governanceItemFromInvestigationEntry(signalId, entry);
      if (row) addGovernanceRow(row);
    }
  }, [governanceItems, listPendingGovernanceWithProposal, addGovernanceRow]);

  const governancePending = useMemo(
    () => governanceItems.filter((p) => p.status === "pending"),
    [governanceItems]
  );

  const [apiProposals, setApiProposals] = useState<GovernanceProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [actionPhase, setActionPhase] = useState<GovernanceActionPhase>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [successVariant, setSuccessVariant] = useState<"approved" | "rejected" | null>(null);
  /** Keep selection on a terminal local row briefly so the success panel can show (O7). */
  const [successHoldKey, setSuccessHoldKey] = useState<string | null>(null);
  const [apiFlash, setApiFlash] = useState<{ kind: "approve" | "reject"; title: string; detail: string } | null>(
    null
  );
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const result = await fetchGovernancePendingProposals("pending");
    if (result.ok) {
      const list = (result.data.proposals ?? []) as GovernanceProposalRow[];
      setApiProposals(list);
    } else {
      setApiProposals([]);
      setLoadError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetActionUi = useCallback(() => {
    setActionPhase("idle");
    setActionError(null);
    setSuccessVariant(null);
  }, []);

  useEffect(() => {
    if (!selection) return;
    const sk = stableSelectionKey(selection);
    const match = governancePending.find((p) => p.signalId === sk || p.id === sk);
    if (match) {
      setSelectedKey(localSelectionKey(match.id));
      resetActionUi();
    }
  }, [selection, governancePending, resetActionUi]);

  /** Only reset action UI when the user actually changes selection — not on spurious effect runs. */
  const prevSelectedKeyForActionRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (prevSelectedKeyForActionRef.current === selectedKey) return;
    prevSelectedKeyForActionRef.current = selectedKey;
    setActionPhase("idle");
    setActionError(null);
    setSuccessVariant(null);
  }, [selectedKey]);

  useEffect(() => {
    if (successHoldKey) return;
    if (loading) return;
    setSelectedKey((prev) => {
      const keys = new Set<string>();
      for (const p of governancePending) keys.add(localSelectionKey(p.id));
      for (const p of apiProposals) keys.add(apiSelectionKey(p.id));
      if (prev && keys.has(prev)) return prev;
      if (governancePending[0]) return localSelectionKey(governancePending[0].id);
      if (apiProposals[0]) return apiSelectionKey(apiProposals[0].id);
      return null;
    });
  }, [loading, governancePending, apiProposals, successHoldKey]);

  const resolvedKey = useMemo(() => {
    if (selectedKey) return selectedKey;
    if (governancePending[0]) return localSelectionKey(governancePending[0].id);
    if (apiProposals[0]) return apiSelectionKey(apiProposals[0].id);
    return null;
  }, [selectedKey, governancePending, apiProposals]);

  const selectedLocal: GovernanceItem | null = useMemo(() => {
    if (!resolvedKey?.startsWith("local:")) return null;
    const id = resolvedKey.slice("local:".length);
    const row = governanceItems.find((p) => p.id === id);
    if (!row) return null;
    if (row.status === "pending") return row;
    if (successHoldKey === resolvedKey && (row.status === "approved" || row.status === "rejected")) {
      return row;
    }
    return null;
  }, [resolvedKey, governanceItems, successHoldKey]);

  const selectedApi: GovernanceProposalRow | null = useMemo(() => {
    if (!resolvedKey?.startsWith("api:")) return null;
    const id = resolvedKey.slice("api:".length);
    return apiProposals.find((p) => p.id === id) ?? null;
  }, [resolvedKey, apiProposals]);

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const scheduleReleaseHold = useCallback((key: string) => {
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      setSuccessHoldKey((prev) => (prev === key ? null : prev));
      holdTimerRef.current = null;
    }, 5000);
  }, []);

  useEffect(() => () => clearHoldTimer(), []);

  const handleApproveLocal = useCallback(() => {
    if (!selectedLocal || selectedLocal.status !== "pending") return;
    const key = localSelectionKey(selectedLocal.id);
    setActionPhase("busy");
    setActionError(null);
    try {
      updateItemStatus(selectedLocal.id, "approved");
      resolveFromGovernance(selectedLocal.signalId, "approved");
      const ts = new Date().toISOString();
      activity?.pushEvent({
        type: "registry_promotion",
        message: `${selectedLocal.entity} — ${selectedLocal.proposalType} — promoted successfully`,
        status: "success",
        source: "governance",
        metadata: {
          entity: selectedLocal.entity,
          proposalType: selectedLocal.proposalType,
          promotedAt: ts,
          signalId: selectedLocal.signalId,
        },
      });
      setSuccessHoldKey(key);
      setActionPhase("success");
      setSuccessVariant("approved");
      scheduleReleaseHold(key);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Promotion failed";
      setActionPhase("error");
      setActionError(msg);
    }
  }, [selectedLocal, updateItemStatus, resolveFromGovernance, activity, scheduleReleaseHold]);

  const handleRejectLocal = useCallback(() => {
    if (!selectedLocal || selectedLocal.status !== "pending") return;
    const key = localSelectionKey(selectedLocal.id);
    updateItemStatus(selectedLocal.id, "rejected");
    resolveFromGovernance(selectedLocal.signalId, "rejected");
    activity?.pushEvent({
      type: "governance_rejected",
      message: `${selectedLocal.entity} — ${selectedLocal.proposalType} — closed without promotion`,
      status: "success",
      source: "governance",
      metadata: {
        entity: selectedLocal.entity,
        proposalType: selectedLocal.proposalType,
        signalId: selectedLocal.signalId,
        closedAt: new Date().toISOString(),
      },
    });
    setSuccessHoldKey(key);
    setActionPhase("success");
    setSuccessVariant("rejected");
    scheduleReleaseHold(key);
  }, [selectedLocal, updateItemStatus, resolveFromGovernance, activity, scheduleReleaseHold]);

  const handleApproveApi = useCallback(async () => {
    if (!selectedApi) return;
    setActionPhase("busy");
    setActionError(null);
    const result = await promoteAliasProposals([selectedApi.id]);
    if (result.ok) {
      const kind = classifyGovernanceProposal(selectedApi);
      const ts = new Date().toISOString();
      activity?.pushEvent({
        type: "registry_promotion",
        message: `${governanceProposalTypeLabel(kind)} — ${selectedApi.registry_type}/${selectedApi.canonical_id} — promoted successfully`,
        status: "success",
        source: "governance",
        metadata: {
          proposalId: selectedApi.id,
          proposalType: kind,
          affectedEntity: `${selectedApi.registry_type}/${selectedApi.canonical_id}`,
          promotedAt: ts,
        },
      });
      setApiFlash({
        kind: "approve",
        title: "Promoted successfully",
        detail:
          "This change has been applied through the registry promotion flow and will affect future checks.",
      });
      window.setTimeout(() => setApiFlash(null), 6000);
      await load();
      setActionPhase("idle");
      return;
    }
    const replayHint = /replay|validation|strict/i.test(result.error);
    setActionPhase("error");
    setActionError(
      replayHint
        ? `Promotion failed — replay validation error: ${result.error}`
        : `Promotion failed — ${result.error}`
    );
  }, [selectedApi, activity, load]);

  const handleRejectApi = useCallback(async () => {
    if (!selectedApi) return;
    setActionPhase("busy");
    setActionError(null);
    const result = await dismissAliasProposal(selectedApi.id);
    if (result.ok) {
      const kind = classifyGovernanceProposal(selectedApi);
      activity?.pushEvent({
        type: "governance_rejected",
        message: `${governanceProposalTypeLabel(kind)} — ${selectedApi.registry_type}/${selectedApi.canonical_id} — dismissed`,
        status: "success",
        source: "governance",
        metadata: {
          proposalId: selectedApi.id,
          proposalType: kind,
          closedAt: new Date().toISOString(),
        },
      });
      setApiFlash({
        kind: "reject",
        title: "Closed without promotion",
        detail: "The registry proposal was dismissed and removed from the pending queue.",
      });
      window.setTimeout(() => setApiFlash(null), 6000);
      await load();
      setActionPhase("idle");
      return;
    }
    setActionPhase("error");
    setActionError(result.error);
  }, [selectedApi, activity, load]);

  const impactLine = useMemo(() => {
    if (selectedLocal) return impactLineForGovernanceItem(selectedLocal);
    if (selectedApi) return impactLineForApiProposal(selectedApi);
    return "";
  }, [selectedLocal, selectedApi]);

  const hasPendingSelection = Boolean(
    (selectedLocal && selectedLocal.status === "pending") || selectedApi
  );

  const showActionBar = Boolean(selectedLocal || selectedApi);

  const showRegistryLoading = loading && governancePending.length === 0 && apiProposals.length === 0;
  const showGlobalEmpty =
    !loading && governancePending.length === 0 && apiProposals.length === 0 && !successHoldKey;
  const showWorkspace =
    governancePending.length > 0 ||
    (!loading && apiProposals.length > 0) ||
    Boolean(successHoldKey);

  return (
    <div className="max-w-4xl">
      <h1 className="text-[22px] font-semibold text-[#0F172A]">Governance</h1>
      <p className="mt-1 text-sm text-[#64748B] leading-relaxed">
        Review packets submitted from Signals and registry-backed drafts. The center uses the same before/after preview
        as the investigator submitted.
      </p>

      {loadError && (
        <p className="mt-6 text-sm text-[#B91C1C]" role="alert">
          {loadError}
        </p>
      )}

      {apiFlash && (
        <div
          className={`mt-6 rounded-xl border p-4 text-sm ${
            apiFlash.kind === "approve"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950"
              : "border-slate-200 bg-slate-50 text-[#334155]"
          }`}
          role="status"
          data-testid="governance-api-flash"
        >
          <p className="font-semibold">{apiFlash.title}</p>
          <p className="mt-1 leading-relaxed">{apiFlash.detail}</p>
        </div>
      )}

      {showRegistryLoading && (
        <p className="mt-6 text-sm text-[#64748B]">Loading registry proposal list…</p>
      )}

      {showGlobalEmpty && (
        <p className="mt-6 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-6 text-sm text-[#64748B]">
          Registry is up to date. No pending proposals require action.
        </p>
      )}

      {showWorkspace && (
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-64 shrink-0">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#64748B]">Pending</p>
            <ul className="space-y-2">
              {governancePending.map((p) => {
                const key = localSelectionKey(p.id);
                const active = resolvedKey === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        setSuccessHoldKey(null);
                        clearHoldTimer();
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? "border-[#0F172A] bg-[#F1F5F9] font-medium text-[#0F172A]"
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <span className="block text-[10px] font-bold uppercase tracking-wide text-amber-700">Signals</span>
                      <span className="mt-0.5 block truncate font-medium">{p.entity}</span>
                      <span className="mt-1 block font-mono text-[10px] leading-tight text-[#94A3B8]">{p.proposalType}</span>
                      <span className="mt-1 block text-[10px] text-[#94A3B8]">
                        {p.confidence != null ? `${p.confidence}% · ` : ""}
                        {formatShortDate(p.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
              {apiProposals.map((p) => {
                const kind = classifyGovernanceProposal(p);
                const key = apiSelectionKey(p.id);
                const active = resolvedKey === key;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedKey(key);
                        setSuccessHoldKey(null);
                        clearHoldTimer();
                      }}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? "border-[#0F172A] bg-[#F1F5F9] font-medium text-[#0F172A]"
                          : "border-[#E2E8F0] bg-white text-[#64748B] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                        {governanceProposalTypeLabel(kind)}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-xs">{p.registry_type}/{p.canonical_id}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>
          <div className="min-w-0 flex-1 space-y-6">
            {selectedLocal ? (
              <GovernanceSignalReviewDesk item={selectedLocal} />
            ) : selectedApi ? (
              <ProposalReviewPanel
                proposal={selectedApi}
                promoting={false}
                feedback={{ kind: null, message: "" }}
                onApprovePromote={() => {}}
                showPromoteActions={false}
                hideFooter
              />
            ) : (
              <p className="rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-6 text-center text-sm text-[#64748B]">
                Select a pending proposal from the list.
              </p>
            )}
            {showActionBar ? (
              <GovernanceActionBar
                impactLine={impactLine}
                phase={actionPhase}
                errorMessage={actionError}
                successVariant={successVariant}
                actionsEnabled={hasPendingSelection}
                onApprove={() => {
                  if (selectedLocal) void handleApproveLocal();
                  else void handleApproveApi();
                }}
                onReject={() => {
                  if (selectedLocal) handleRejectLocal();
                  else void handleRejectApi();
                }}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
