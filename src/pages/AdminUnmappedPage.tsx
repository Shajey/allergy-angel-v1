/**
 * Phase 11 / 22 – Knowledge Radar (Admin Discovery)
 *
 * Upgraded with persisted telemetry. Unknown entities and interaction gaps.
 * Proposal-safe wording. Links to Registry Browser.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildResearchUrl } from "../orchestrator/lib/researchTarget";
import { buildGraphUrl } from "../orchestrator/lib/graphUtils";
import {
  fetchRadarEntities,
  fetchRadarCombinations,
  fetchRadarStats,
  fetchRadarSignals,
} from "../orchestrator/lib/fetchOrchestratorData";
import OrchestratorPageState from "../orchestrator/components/OrchestratorPageState";
import { useOptionalOrchestratorSelection } from "../orchestrator/context/OrchestratorSelectionContext";

type RadarSuggestedAction = "alias_candidate" | "new_entry_candidate" | "investigate" | "low_priority";
type GapType = "alias_gap" | "semantic_gap" | "interaction_gap";

/** Phase O4/O5: Suggested action with icons — Investigate gets extra padding to prevent truncation */
function SuggestedActionBadge({ action }: { action: string }) {
  const config: Record<string, { icon: string; label: string; className: string; extraPadding?: boolean }> = {
    investigate: { icon: "🔎", label: "Investigate", className: "bg-amber-50 text-amber-800", extraPadding: true },
    new_entry_candidate: { icon: "➕", label: "New entry candidate", className: "bg-amber-50 text-amber-800" },
    low_priority: { icon: "↓", label: "Low priority", className: "bg-gray-100 text-gray-600" },
    alias_candidate: { icon: "↗", label: "Alias candidate", className: "bg-blue-50 text-blue-800" },
  };
  const c = config[action] ?? { icon: "", label: action, className: "bg-gray-100 text-gray-600" };
  return (
    <span className={`orch-suggested-badge inline-flex items-center gap-1.5 text-xs py-0.5 rounded ${c.extraPadding ? "px-3" : "px-2"} ${c.className}`}>
      <span aria-hidden>{c.icon}</span>
      {c.label}
    </span>
  );
}

function GapTypeBadge({ gapType }: { gapType: GapType }) {
  const labels: Record<GapType, string> = {
    alias_gap: "Alias gap",
    semantic_gap: "Semantic gap",
    interaction_gap: "Interaction gap",
  };
  const classes: Record<GapType, string> = {
    alias_gap: "bg-blue-50 text-blue-800",
    semantic_gap: "bg-orange-50 text-orange-800",
    interaction_gap: "bg-purple-50 text-purple-800",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${classes[gapType]}`}>
      {labels[gapType]}
    </span>
  );
}

function PriorityBadge({ label }: { label: string }) {
  const classes: Record<string, string> = {
    high: "orch-badge-high-risk",
    medium: "bg-amber-50 text-amber-800",
    low: "bg-gray-100 text-gray-600",
  };
  const key = (label ?? "").toLowerCase();
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${classes[key] ?? classes.low}`}>
      {label}
    </span>
  );
}

/** Phase 22.4: Signal pattern badge — PureMed glow for high risk / mostly safe */
function SignalPatternBadge({ pattern }: { pattern?: SignalPattern }) {
  const labels: Record<string, string> = {
    emerging_risk: "Emerging risk",
    mostly_safe: "Mostly safe",
    mixed_signal: "Mixed signal",
    insufficient_data: "Insufficient data",
  };
  const classes: Record<string, string> = {
    emerging_risk: "orch-badge-high-risk",
    mostly_safe: "orch-badge-mostly-safe",
    mixed_signal: "bg-amber-50 text-amber-800",
    insufficient_data: "bg-gray-100 text-gray-600",
  };
  const p = pattern ?? "insufficient_data";
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${classes[p] ?? classes.insufficient_data}`}>
      {labels[p] ?? p}
    </span>
  );
}

/** Phase 22.3: Context badge styling */
function ContextBadge({ dominantContext }: { dominantContext?: string }) {
  const labels: Record<string, string> = {
    medication: "medication context",
    supplement: "supplement context",
    food: "food context",
    mixed: "mixed context",
  };
  const classes: Record<string, string> = {
    medication: "bg-red-50 text-red-800",
    supplement: "bg-green-50 text-green-800",
    food: "bg-orange-50 text-orange-800",
    mixed: "bg-gray-100 text-gray-600",
  };
  const ctx = dominantContext ?? "mixed";
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${classes[ctx] ?? classes.mixed}`}>
      {labels[ctx] ?? ctx}
    </span>
  );
}

interface RadarEntity {
  entity: string;
  entityType: string;
  occurrenceCount: number;
  highRiskCount: number;
  lastSeenDay: string;
  priorityScore: number;
  suggestedAction: string;
  gapType?: GapType;
  contextLabel?: string;
  dominantContext?: "medication" | "supplement" | "food" | "mixed";
  possibleAliasOf?: string | null;
}

type SignalPattern = "emerging_risk" | "mostly_safe" | "mixed_signal" | "insufficient_data";

interface RadarCombination {
  entityA: string;
  entityAType: string;
  entityB: string;
  entityBType: string;
  combinationType: string;
  occurrenceCount: number;
  highRiskCount: number;
  safeOccurrenceCount?: number;
  lastSeenDay: string;
  priorityScore: number;
  priorityLabel: string;
  suggestedAction: string;
  gapType?: GapType;
  riskRatio?: number;
  safeRatio?: number;
  signalPattern?: SignalPattern;
}

interface RadarStats {
  totalUnknownEntities: number;
  totalInteractionGaps: number;
  highPriorityCount: number;
  totalCombinationsObserved?: number;
  emergingRiskCount?: number;
  mostlySafeCount?: number;
  insufficientDataCount?: number;
}

interface RadarSignal {
  entityA: string;
  entityAType: string | null;
  entityB: string;
  entityBType: string | null;
  relationship: string;
  occurrenceCount: number;
  lastSeenDay: string;
  priorityScore: number;
  priority: string;
}

type Tab = "entities" | "combinations" | "signals";

export default function AdminUnmappedPage() {
  const orchSelection = useOptionalOrchestratorSelection();
  const [tab, setTab] = useState<Tab>("entities");
  const [entities, setEntities] = useState<RadarEntity[]>([]);
  const [combinations, setCombinations] = useState<RadarCombination[]>([]);
  const [signals, setSignals] = useState<RadarSignal[]>([]);
  const [stats, setStats] = useState<RadarStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const windowDays = 30;

  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadRadarData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [entitiesRes, combinationsRes, statsRes, signalsRes] = await Promise.all([
      fetchRadarEntities(50, windowDays),
      fetchRadarCombinations(50, windowDays),
      fetchRadarStats(windowDays),
      fetchRadarSignals(50, windowDays),
    ]);

    const firstError =
      !entitiesRes.ok ? entitiesRes.error
      : !combinationsRes.ok ? combinationsRes.error
      : !statsRes.ok ? statsRes.error
      : !signalsRes.ok ? signalsRes.error
      : null;

    if (firstError) {
      setError(firstError);
      setEntities([]);
      setCombinations([]);
      setSignals([]);
      setStats(null);
    } else {
      setEntities(entitiesRes.ok ? (entitiesRes.data.entities ?? []) : []);
      setCombinations(combinationsRes.ok ? (combinationsRes.data.combinations ?? []) : []);
      setSignals(signalsRes.ok ? (signalsRes.data.signals ?? []) : []);
      setStats(statsRes.ok ? statsRes.data : null);
    }
    setLastSync(new Date().toISOString().slice(11, 19) + "Z");
    setLoading(false);
  }, [windowDays]);

  useEffect(() => {
    loadRadarData();
  }, [loadRadarData]);

  const pageState =
    loading ? "loading"
    : error ? "error"
    : entities.length === 0 && combinations.length === 0 && signals.length === 0
      ? "empty"
      : "success";

  return (
    <OrchestratorPageState
      state={pageState}
      pageName="Radar"
      errorMessage={error}
      emptyMessage="No unknown entities or interaction gaps in the last 30 days."
      onRetry={loadRadarData}
    >
    <div className="p-6 max-w-4xl mx-auto">
      {/* Phase O5: Telemetry header — title, metric chips, Last Sync, tabs */}
      <div className="orch-telemetry-panel mb-6 -mx-6 px-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="orch-section-header text-xl">Signal Radar</h1>
            <p className="mt-2 text-sm text-[#64748B] leading-relaxed">
              Unknown entities and interaction gaps from telemetry. Evidence-based proposals only.
            </p>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            {lastSync && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-[#94A3B8]">Last Sync</p>
                <p className="orch-last-sync">{lastSync}</p>
              </div>
            )}
            <Link
              to="/orchestrator/registry"
              className="text-sm font-medium text-[#64748B] hover:text-[#0F172A]"
            >
              Registry Browser →
            </Link>
          </div>
        </div>
        {stats && (
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="orch-metric-chip">Unknown Entities: {stats.totalUnknownEntities}</span>
            <span className="orch-metric-chip">Interaction Gaps: {stats.totalInteractionGaps}</span>
            <span className="orch-metric-chip">
              <span className="orch-live-pulse" aria-hidden />
              High Priority: {stats.highPriorityCount}
            </span>
            {stats.totalCombinationsObserved != null && (
              <span className="orch-metric-chip">Combinations Observed: {stats.totalCombinationsObserved}</span>
            )}
          </div>
        )}
        {/* Tabs — active: navy bg white text; inactive: ghost, underline on hover */}
        <div className="flex gap-2 pt-1 border-t border-[#E2E8F0]">
          <button
            type="button"
            onClick={() => setTab("entities")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "entities" ? "orch-tab-active-o5" : "orch-tab-inactive-o5"
            }`}
          >
            Unknown Entities
          </button>
          <button
            type="button"
            onClick={() => setTab("combinations")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "combinations" ? "orch-tab-active-o5" : "orch-tab-inactive-o5"
            }`}
          >
            Interaction Gaps
          </button>
          <button
            type="button"
            onClick={() => setTab("signals")}
            className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === "signals" ? "orch-tab-active-o5" : "orch-tab-inactive-o5"
            }`}
          >
            Emerging Signals
          </button>
        </div>
      </div>

      {tab === "entities" && (
        <div className="overflow-x-auto">
          {entities.length === 0 ? (
            <p className="text-sm text-gray-500">No unknown entities in the last 30 days.</p>
          ) : (
            <table className="orch-table min-w-full rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th className="text-left text-[#0F172A]">Entity</th>
                  <th className="text-left text-[#0F172A]">Type</th>
                  <th className="text-left text-[#0F172A]">Count</th>
                  <th className="text-left text-[#0F172A]">High Risk</th>
                  <th className="text-left text-[#0F172A]">Context</th>
                  <th className="text-left text-[#0F172A]">Gap Type</th>
                  <th className="text-left text-[#0F172A]">Priority</th>
                  <th className="text-left text-[#0F172A]">Possible alias of</th>
                  <th className="text-left text-[#0F172A]">Suggested</th>
                  <th className="text-left text-[#0F172A]">Actions</th>
                </tr>
              </thead>
              <tbody className="orch-table-body bg-white">
                {entities.map((e, i) => (
                  <tr
                    key={`${e.entity}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      orchSelection?.setSelection({
                        kind: "unknown-entity",
                        entity: e.entity,
                        entityType: e.entityType,
                        occurrenceCount: e.occurrenceCount,
                        suggestedAction: e.suggestedAction,
                      })
                    }
                    onKeyDown={(ev) => {
                      if ((ev.key === "Enter" || ev.key === " ") && orchSelection) {
                        ev.preventDefault();
                        orchSelection.setSelection({
                          kind: "unknown-entity",
                          entity: e.entity,
                          entityType: e.entityType,
                          occurrenceCount: e.occurrenceCount,
                          suggestedAction: e.suggestedAction,
                        });
                      }
                    }}
                    className={`orch-table-row cursor-pointer transition-colors ${
                      e.priorityScore >= 2 ? "orch-priority-high" : ""
                    } ${
                      orchSelection?.selection?.kind === "unknown-entity" &&
                      orchSelection.selection.entity === e.entity
                        ? "ring-1 ring-inset ring-[#0F172A] bg-[#F1F5F9]"
                        : ""
                    }`}
                  >
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#0F172A]">{e.entity}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{e.entityType}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{e.occurrenceCount}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{e.highRiskCount}</td>
                    <td className="px-4 py-3">
                      <ContextBadge dominantContext={e.dominantContext} />
                    </td>
                    <td className="px-4 py-3">
                      {e.gapType ? <GapTypeBadge gapType={e.gapType} /> : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge label={e.priorityScore >= 2 ? "high" : e.priorityScore >= 1 ? "medium" : "low"} />
                    </td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">
                      {e.possibleAliasOf ? (
                        <Link
                          to={`/orchestrator/registry?search=${encodeURIComponent(e.possibleAliasOf)}`}
                          className="text-blue-600 hover:underline"
                        >
                          {e.possibleAliasOf}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="orch-suggested-cell">
                      <span className="orch-suggested-action-hover inline-block">
                        <SuggestedActionBadge action={e.suggestedAction} />
                      </span>
                    </td>
                    <td className="flex gap-2 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
                      <Link
                        to={`/orchestrator/registry?search=${encodeURIComponent(e.entity)}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Check registry
                      </Link>
                      <Link
                        to={buildResearchUrl({
                          mode: "entity",
                          entity: e.entity,
                          entityType: e.entityType,
                          radarMetadata: {
                            occurrenceCount: e.occurrenceCount,
                            highRiskCount: e.highRiskCount,
                            dominantContext: e.dominantContext,
                          },
                        })}
                        className="text-sm text-amber-700 hover:underline"
                      >
                        Research
                      </Link>
                      <Link
                        to={buildGraphUrl({ entity: e.entity })}
                        className="text-sm text-slate-600 hover:underline"
                      >
                        Inspect in Graph
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "signals" && (
        <div className="overflow-x-auto">
          {signals.length === 0 ? (
            <p className="text-sm text-gray-500">No emerging relationship signals in the last 30 days.</p>
          ) : (
            <table className="orch-table min-w-full rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th className="text-left text-[#0F172A]">Entity A</th>
                  <th className="text-left text-[#0F172A]">Entity B</th>
                  <th className="text-left text-[#0F172A]">Relationship</th>
                  <th className="text-left text-[#0F172A]">Occurrences</th>
                  <th className="text-left text-[#0F172A]">Priority</th>
                  <th className="text-left text-[#0F172A]">Actions</th>
                </tr>
              </thead>
              <tbody className="orch-table-body bg-white">
                {signals.map((s, i) => (
                  <tr
                    key={`${s.entityA}-${s.entityB}-${s.relationship}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      orchSelection?.setSelection({
                        kind: "interaction-gap",
                        entityA: s.entityA,
                        entityB: s.entityB,
                        occurrenceCount: s.occurrenceCount,
                        payload: { relationship: s.relationship, priority: s.priority },
                      })
                    }
                    onKeyDown={(ev) => {
                      if ((ev.key === "Enter" || ev.key === " ") && orchSelection) {
                        ev.preventDefault();
                        orchSelection.setSelection({
                          kind: "interaction-gap",
                          entityA: s.entityA,
                          entityB: s.entityB,
                          occurrenceCount: s.occurrenceCount,
                          payload: { relationship: s.relationship, priority: s.priority },
                        });
                      }
                    }}
                    className={`orch-table-row cursor-pointer transition-colors ${
                      (s.priority ?? "").toLowerCase() === "high" ? "orch-priority-high" : ""
                    } ${
                      orchSelection?.selection?.kind === "interaction-gap" &&
                      orchSelection.selection.entityA === s.entityA &&
                      orchSelection.selection.entityB === s.entityB
                        ? "ring-1 ring-inset ring-[#0F172A] bg-[#F1F5F9]"
                        : ""
                    }`}
                  >
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#0F172A]">{s.entityA}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#0F172A]">{s.entityB}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">
                      <span className="text-xs">{s.relationship.replace(/_/g, " ")}</span>
                    </td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{s.occurrenceCount}</td>
                    <td className="px-4 py-3">
                      <PriorityBadge label={s.priority} />
                    </td>
                    <td className="flex gap-2 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
                      <Link
                        to={`/orchestrator/registry?search=${encodeURIComponent(s.entityA)}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Check A
                      </Link>
                      <Link
                        to={`/orchestrator/registry?search=${encodeURIComponent(s.entityB)}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Check B
                      </Link>
                      <Link
                        to={buildGraphUrl({ entityA: s.entityA, entityB: s.entityB })}
                        className="text-sm text-slate-600 hover:underline"
                      >
                        Inspect in Graph
                      </Link>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(s.entityA + " " + s.entityB + " interaction")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-amber-700 hover:underline"
                      >
                        Research interaction
                      </a>
                      <Link
                        to={buildResearchUrl({
                          mode: "combination",
                          entityA: s.entityA,
                          entityB: s.entityB,
                          typeA: s.entityAType ?? "unknown",
                          typeB: s.entityBType ?? "unknown",
                          radarTelemetry: { occurrenceCount: s.occurrenceCount },
                        })}
                        className="text-sm text-amber-700 hover:underline"
                      >
                        Draft proposal
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "combinations" && (
        <div className="overflow-x-auto">
          {combinations.length === 0 ? (
            <p className="text-sm text-gray-500">No interaction gaps in the last 30 days.</p>
          ) : (
            <table className="orch-table min-w-full rounded-xl overflow-hidden">
              <thead>
                <tr>
                  <th className="text-left text-[#0F172A]">Entity A</th>
                  <th className="text-left text-[#0F172A]">Entity B</th>
                  <th className="text-left text-[#0F172A]">Type</th>
                  <th className="text-left text-[#0F172A]">Occurrences</th>
                  <th className="text-left text-[#0F172A]">High Risk</th>
                  <th className="text-left text-[#0F172A]">Safe</th>
                  <th className="text-left text-[#0F172A]">Signal Pattern</th>
                  <th className="text-left text-[#0F172A]">Priority</th>
                  <th className="text-left text-[#0F172A]">Action</th>
                </tr>
              </thead>
              <tbody className="orch-table-body bg-white">
                {combinations.map((c, i) => (
                  <tr
                    key={`${c.entityA}-${c.entityB}-${i}`}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      orchSelection?.setSelection({
                        kind: "interaction-gap",
                        entityA: c.entityA,
                        entityB: c.entityB,
                        combinationType: c.combinationType,
                        occurrenceCount: c.occurrenceCount,
                        highRiskCount: c.highRiskCount,
                        safeCount: c.safeOccurrenceCount,
                        signalPattern: c.signalPattern,
                      })
                    }
                    onKeyDown={(ev) => {
                      if ((ev.key === "Enter" || ev.key === " ") && orchSelection) {
                        ev.preventDefault();
                        orchSelection.setSelection({
                          kind: "interaction-gap",
                          entityA: c.entityA,
                          entityB: c.entityB,
                          combinationType: c.combinationType,
                          occurrenceCount: c.occurrenceCount,
                          highRiskCount: c.highRiskCount,
                          safeCount: c.safeOccurrenceCount,
                          signalPattern: c.signalPattern,
                        });
                      }
                    }}
                    className={`orch-table-row cursor-pointer transition-colors ${
                      (c.priorityLabel ?? "").toLowerCase() === "high" ? "orch-priority-high" : ""
                    } ${
                      orchSelection?.selection?.kind === "interaction-gap" &&
                      orchSelection.selection.entityA === c.entityA &&
                      orchSelection.selection.entityB === c.entityB
                        ? "ring-1 ring-inset ring-[#0F172A] bg-[#F1F5F9]"
                        : ""
                    }`}
                  >
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#0F172A]">{c.entityA}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#0F172A]">{c.entityB}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{c.combinationType}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{c.occurrenceCount}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{c.highRiskCount}</td>
                    <td className="orch-data-cell px-4 py-3 text-sm text-[#64748B]">{c.safeOccurrenceCount ?? 0}</td>
                    <td className="orch-suggested-cell px-4 py-3">
                      <span className="orch-suggested-action-hover inline-block">
                        <SignalPatternBadge pattern={c.signalPattern} />
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge label={c.priorityLabel} />
                    </td>
                    <td className="flex gap-2 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
                      <Link
                        to={`/orchestrator/registry?search=${encodeURIComponent(c.entityA)}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Check A
                      </Link>
                      <Link
                        to={`/orchestrator/registry?search=${encodeURIComponent(c.entityB)}`}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        Check B
                      </Link>
                      <Link
                        to={buildGraphUrl({ entityA: c.entityA, entityB: c.entityB })}
                        className="text-sm text-slate-600 hover:underline"
                      >
                        Inspect in Graph
                      </Link>
                      <Link
                        to="/orchestrator/radar"
                        className="text-sm text-gray-600 hover:underline"
                      >
                        Investigate
                      </Link>
                      <Link
                        to={buildResearchUrl({
                          mode: "combination",
                          entityA: c.entityA,
                          entityB: c.entityB,
                          typeA: c.entityAType,
                          typeB: c.entityBType,
                          radarTelemetry: {
                            occurrenceCount: c.occurrenceCount,
                            highRiskCount: c.highRiskCount,
                            safeOccurrenceCount: c.safeOccurrenceCount,
                            signalPattern: c.signalPattern,
                          },
                        })}
                        className="text-sm text-amber-700 hover:underline"
                      >
                        Draft proposal
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

    </div>
    </OrchestratorPageState>
  );
}
