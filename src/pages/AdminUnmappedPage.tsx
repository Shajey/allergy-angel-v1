/**
 * Phase 11 / 22 – Knowledge Radar (Admin Discovery)
 *
 * Upgraded with persisted telemetry. Unknown entities and interaction gaps.
 * Proposal-safe wording. Links to Registry Browser.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { buildResearchUrl } from "../orchestrator/lib/researchTarget";
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

function SuggestedActionBadge({ action }: { action: string }) {
  const labels: Record<string, string> = {
    alias_candidate: "Alias candidate",
    new_entry_candidate: "New entry candidate",
    investigate: "Investigate",
    low_priority: "Low priority",
  };
  const classes: Record<string, string> = {
    alias_candidate: "bg-blue-50 text-blue-800",
    new_entry_candidate: "bg-amber-50 text-amber-800",
    investigate: "bg-amber-100 text-amber-900",
    low_priority: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${classes[action] ?? classes.low_priority}`}>
      {labels[action] ?? action}
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
    high: "bg-red-50 text-red-800",
    medium: "bg-amber-50 text-amber-800",
    low: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${classes[label] ?? classes.low}`}>
      {label}
    </span>
  );
}

/** Phase 22.4: Signal pattern badge */
function SignalPatternBadge({ pattern }: { pattern?: SignalPattern }) {
  const labels: Record<string, string> = {
    emerging_risk: "Emerging risk",
    mostly_safe: "Mostly safe",
    mixed_signal: "Mixed signal",
    insufficient_data: "Insufficient data",
  };
  const classes: Record<string, string> = {
    emerging_risk: "bg-red-50 text-red-800",
    mostly_safe: "bg-green-50 text-green-800",
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Signal Radar</h1>
          <p className="mt-1 text-sm text-gray-600">
            Unknown entities and interaction gaps from telemetry. Evidence-based proposals only.
          </p>
        </div>
        <Link
          to="/orchestrator/registry"
          className="text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          Registry Browser →
        </Link>
      </div>

      {/* Stats strip */}
      {stats && (
        <div className="mb-6 flex flex-wrap gap-4 text-sm text-gray-600">
          <span>Unknown entities (30d): {stats.totalUnknownEntities}</span>
          <span>Interaction gaps: {stats.totalInteractionGaps}</span>
          <span>High priority: {stats.highPriorityCount}</span>
          {stats.totalCombinationsObserved != null && (
            <>
              <span>Combinations observed: {stats.totalCombinationsObserved}</span>
              <span>Emerging risk: {stats.emergingRiskCount ?? 0}</span>
              <span>Mostly safe: {stats.mostlySafeCount ?? 0}</span>
              <span>Insufficient data: {stats.insufficientDataCount ?? 0}</span>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab("entities")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "entities"
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Unknown Entities
        </button>
        <button
          type="button"
          onClick={() => setTab("combinations")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "combinations"
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Interaction Gaps
        </button>
        <button
          type="button"
          onClick={() => setTab("signals")}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === "signals"
              ? "bg-gray-900 text-white"
              : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          Emerging Signals
        </button>
      </div>

      {tab === "entities" && (
        <div className="overflow-x-auto">
          {entities.length === 0 ? (
            <p className="text-sm text-gray-500">No unknown entities in the last 30 days.</p>
          ) : (
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Entity</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Count</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">High Risk</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Context</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Gap Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Priority</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Possible alias of</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Suggested</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
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
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      orchSelection?.selection?.kind === "unknown-entity" &&
                      orchSelection.selection.entity === e.entity
                        ? "ring-1 ring-inset ring-[#0F172A] bg-gray-50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">{e.entity}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{e.entityType}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{e.occurrenceCount}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{e.highRiskCount}</td>
                    <td className="px-4 py-2">
                      <ContextBadge dominantContext={e.dominantContext} />
                    </td>
                    <td className="px-4 py-2">
                      {e.gapType ? <GapTypeBadge gapType={e.gapType} /> : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <PriorityBadge label={e.priorityScore >= 2 ? "high" : e.priorityScore >= 1 ? "medium" : "low"} />
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
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
                    <td className="px-4 py-2">
                      <SuggestedActionBadge action={e.suggestedAction} />
                    </td>
                    <td className="px-4 py-2 flex gap-2 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
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
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Entity A</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Entity B</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Relationship</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Occurrences</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Priority</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
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
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      orchSelection?.selection?.kind === "interaction-gap" &&
                      orchSelection.selection.entityA === s.entityA &&
                      orchSelection.selection.entityB === s.entityB
                        ? "ring-1 ring-inset ring-[#0F172A] bg-gray-50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">{s.entityA}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{s.entityB}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      <span className="text-xs">{s.relationship.replace(/_/g, " ")}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{s.occurrenceCount}</td>
                    <td className="px-4 py-2">
                      <PriorityBadge label={s.priority} />
                    </td>
                    <td className="px-4 py-2 flex gap-2 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
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
            <table className="min-w-full border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Entity A</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Entity B</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Occurrences</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">High Risk</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Safe</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Signal Pattern</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Priority</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
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
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      orchSelection?.selection?.kind === "interaction-gap" &&
                      orchSelection.selection.entityA === c.entityA &&
                      orchSelection.selection.entityB === c.entityB
                        ? "ring-1 ring-inset ring-[#0F172A] bg-gray-50"
                        : ""
                    }`}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">{c.entityA}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{c.entityB}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.combinationType}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.occurrenceCount}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.highRiskCount}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{c.safeOccurrenceCount ?? 0}</td>
                    <td className="px-4 py-2">
                      <SignalPatternBadge pattern={c.signalPattern} />
                    </td>
                    <td className="px-4 py-2">
                      <PriorityBadge label={c.priorityLabel} />
                    </td>
                    <td className="px-4 py-2 flex gap-2 flex-wrap" onClick={(ev) => ev.stopPropagation()}>
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
