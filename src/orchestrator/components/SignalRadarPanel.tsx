/**
 * Phase O6.2 / O6.4 – High-density signal queue (left rail)
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import SignalCard from "./SignalCard";
import { useInvestigationStore } from "../context/InvestigationStoreContext";
import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import {
  keyFromCombinationRow,
  keyFromEmergingGapRow,
  keyFromUnknownEntityRow,
} from "../lib/investigationKey";
import {
  loadOrchestratorSummary,
  type OrchestratorSummary,
  type GovernanceQueueItem,
} from "../lib/orchestratorSummary";
import {
  fetchRadarCombinations,
  fetchRadarEntities,
  fetchRadarSignals,
} from "../lib/fetchOrchestratorData";
import type {
  RadarEntitiesResponse,
  RadarCombinationsResponse,
  RadarSignalsResponse,
} from "../lib/fetchOrchestratorData";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 mt-3 first:mt-0 text-[10px] font-semibold uppercase tracking-wide text-[#64748B]">
      {children}
    </p>
  );
}

function EmptySectionPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded border border-dashed border-slate-200 bg-slate-100/80 px-2 py-1.5 text-[11px] text-[#94A3B8]">
      No {label}
    </div>
  );
}

function FallbackSectionPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded border border-dashed border-amber-200 bg-amber-50/80 px-2 py-1.5 text-[11px] text-amber-900">
      {label} unavailable
    </div>
  );
}

type EntityRow = NonNullable<RadarEntitiesResponse["entities"]>[number];
type ComboRow = NonNullable<RadarCombinationsResponse["combinations"]>[number];
type SignalRow = NonNullable<RadarSignalsResponse["signals"]>[number];

const WINDOW_DAYS = 30;
const LIST_LIMIT = 50;

function riskFromEntity(e: EntityRow): QueueRiskLevel {
  if (e.priorityScore >= 2) return "high";
  if (e.priorityScore >= 1) return "medium";
  return "low";
}

function riskFromRadarSignal(s: SignalRow): QueueRiskLevel {
  const p = (s.priority ?? "").toLowerCase();
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

function riskFromCombo(c: ComboRow): QueueRiskLevel {
  const p = (c.priorityLabel ?? "").toLowerCase();
  if (p === "high") return "high";
  if (p === "medium") return "medium";
  return "low";
}

export default function SignalRadarPanel() {
  const { selection, setSelection } = useOrchestratorSelection();
  const { queueBadgeForKey } = useInvestigationStore();
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [combinations, setCombinations] = useState<ComboRow[]>([]);
  const [radarSignals, setRadarSignals] = useState<SignalRow[]>([]);
  const [governanceSummary, setGovernanceSummary] = useState<OrchestratorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitiesOk, setEntitiesOk] = useState(true);
  const [combinationsOk, setCombinationsOk] = useState(true);
  const [signalsOk, setSignalsOk] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [entRes, comboRes, sigRes, summaryRes] = await Promise.all([
      fetchRadarEntities(LIST_LIMIT, WINDOW_DAYS),
      fetchRadarCombinations(LIST_LIMIT, WINDOW_DAYS),
      fetchRadarSignals(LIST_LIMIT, WINDOW_DAYS),
      loadOrchestratorSummary(),
    ]);

    setEntitiesOk(entRes.ok);
    setCombinationsOk(comboRes.ok);
    setSignalsOk(sigRes.ok);
    setEntities(entRes.ok ? (entRes.data.entities ?? []) : []);
    setCombinations(comboRes.ok ? (comboRes.data.combinations ?? []) : []);
    setRadarSignals(sigRes.ok ? (sigRes.data.signals ?? []) : []);
    setGovernanceSummary(summaryRes.ok ? summaryRes.data : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const gq = governanceSummary?.governanceQueue ?? [];
  const govUnavail = governanceSummary?.sectionUnavailable?.governance ?? false;

  const queueTotal = useMemo(() => {
    let n = 0;
    if (signalsOk) n += radarSignals.length;
    if (entitiesOk) n += entities.length;
    if (combinationsOk) n += combinations.length;
    if (!govUnavail) n += gq.length;
    return n;
  }, [
    signalsOk,
    radarSignals.length,
    entitiesOk,
    entities.length,
    combinationsOk,
    combinations.length,
    govUnavail,
    gq.length,
  ]);

  const handleGovernanceSelect = (item: GovernanceQueueItem) => {
    if (item.type === "ingestion") {
      setSelection({
        kind: "ingestion-candidate",
        candidateId: "ingestion-queue",
        name: item.title,
        aliasCount: item.count,
        sourceDataset: "RxNorm",
      });
    } else {
      setSelection({
        kind: "activity",
        activityId: "proposals-queue",
        title: item.title,
        eventType: "proposal",
        detail: item.subtitle,
      });
    }
  };

  if (loading) {
    return (
      <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent p-3">
        <p className="orch-section-header text-xs font-semibold uppercase tracking-wide text-[#0F172A]">
          Signal Queue
        </p>
        <p className="text-[11px] text-[#64748B]">Loading…</p>
        <div className="mt-2 rounded border border-slate-200 bg-slate-100/80 px-2 py-2 text-[11px] text-[#94A3B8]">
          Loading queue…
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent p-3">
      <p className="orch-section-header text-xs font-semibold uppercase tracking-wide text-[#0F172A]">
        Signal Queue ({queueTotal})
      </p>
      <p className="mt-0.5 text-[11px] text-[#64748B]">Select a row to open the workbench.</p>

      <div className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5">
        <div>
          <SectionHeader>Emerging</SectionHeader>
          <div className="space-y-1">
            {!signalsOk ? (
              <FallbackSectionPlaceholder label="Emerging" />
            ) : radarSignals.length > 0 ? (
              radarSignals.map((s, i) => {
                const occ = s.occurrenceCount;
                const sub = `${occ} occurrence${occ !== 1 ? "s" : ""}`;
                const rowKey = keyFromEmergingGapRow({
                  entityA: s.entityA,
                  entityB: s.entityB,
                  relationship: s.relationship,
                });
                return (
                  <SignalCard
                    key={`rs-${s.entityA}-${s.entityB}-${s.relationship}-${i}`}
                    title={`${s.entityA} + ${s.entityB}`}
                    subtext={sub}
                    riskLevel={riskFromRadarSignal(s)}
                    badge="gap"
                    investigationStatus={queueBadgeForKey(rowKey)}
                    onSelect={() =>
                      setSelection({
                        kind: "interaction-gap",
                        entityA: s.entityA,
                        entityB: s.entityB,
                        occurrenceCount: s.occurrenceCount,
                        payload: { relationship: s.relationship, priority: s.priority },
                      })
                    }
                    isSelected={
                      selection?.kind === "interaction-gap" &&
                      selection.entityA === s.entityA &&
                      selection.entityB === s.entityB &&
                      selection.combinationType == null &&
                      (selection.payload as { relationship?: string } | undefined)?.relationship ===
                        s.relationship
                    }
                  />
                );
              })
            ) : (
              <EmptySectionPlaceholder label="emerging signals" />
            )}
          </div>
        </div>

        <div>
          <SectionHeader>Active</SectionHeader>
          <div className="space-y-1">
            {!entitiesOk ? (
              <FallbackSectionPlaceholder label="Active" />
            ) : entities.length > 0 ? (
              entities.map((e, i) => {
                const occ = e.occurrenceCount;
                const sub = [e.entityType, `${occ} occurrence${occ !== 1 ? "s" : ""}`]
                  .filter(Boolean)
                  .join(" · ");
                const rowKey = keyFromUnknownEntityRow(e);
                return (
                  <SignalCard
                    key={`ent-${e.entity}-${i}`}
                    title={e.entity}
                    subtext={sub}
                    riskLevel={riskFromEntity(e)}
                    badge="new"
                    investigationStatus={queueBadgeForKey(rowKey)}
                    onSelect={() =>
                      setSelection({
                        kind: "unknown-entity",
                        entity: e.entity,
                        entityType: e.entityType,
                        occurrenceCount: e.occurrenceCount,
                        suggestedAction: e.suggestedAction,
                        payload: {
                          dominantContext: e.dominantContext,
                          gapType: e.gapType,
                          possibleAliasOf: e.possibleAliasOf,
                          highRiskCount: e.highRiskCount,
                        },
                      })
                    }
                    isSelected={selection?.kind === "unknown-entity" && selection.entity === e.entity}
                  />
                );
              })
            ) : (
              <EmptySectionPlaceholder label="active signals" />
            )}
          </div>
        </div>

        <div>
          <SectionHeader>Interaction gaps</SectionHeader>
          <div className="space-y-1">
            {!combinationsOk ? (
              <FallbackSectionPlaceholder label="Gaps" />
            ) : combinations.length > 0 ? (
              combinations.map((c, i) => {
                const occ = c.occurrenceCount;
                const sub = [c.combinationType, `${occ} occurrence${occ !== 1 ? "s" : ""}`]
                  .filter(Boolean)
                  .join(" · ");
                const rowKey = keyFromCombinationRow(c);
                return (
                  <SignalCard
                    key={`combo-${c.entityA}-${c.entityB}-${i}`}
                    title={`${c.entityA} + ${c.entityB}`}
                    subtext={sub}
                    riskLevel={riskFromCombo(c)}
                    badge="gap"
                    investigationStatus={queueBadgeForKey(rowKey)}
                    onSelect={() =>
                      setSelection({
                        kind: "interaction-gap",
                        entityA: c.entityA,
                        entityB: c.entityB,
                        combinationType: c.combinationType,
                        occurrenceCount: c.occurrenceCount,
                        highRiskCount: c.highRiskCount,
                        safeCount: c.safeOccurrenceCount,
                        signalPattern: c.signalPattern,
                        payload: {
                          entityAType: c.entityAType,
                          entityBType: c.entityBType,
                          priorityLabel: c.priorityLabel,
                        },
                      })
                    }
                    isSelected={
                      selection?.kind === "interaction-gap" &&
                      selection.entityA === c.entityA &&
                      selection.entityB === c.entityB &&
                      selection.combinationType != null
                    }
                  />
                );
              })
            ) : (
              <EmptySectionPlaceholder label="interaction gaps" />
            )}
          </div>
        </div>

        <div>
          <SectionHeader>Governance</SectionHeader>
          <div className="space-y-1">
            {govUnavail ? (
              <FallbackSectionPlaceholder label="Queue" />
            ) : gq.length > 0 ? (
              gq.map((item, i) => (
                <SignalCard
                  key={`gq-${i}`}
                  title={item.title}
                  subtext={item.subtitle ?? `${item.count} pending`}
                  riskLevel="medium"
                  badge={item.type === "ingestion" ? "new" : "gap"}
                  onSelect={() => handleGovernanceSelect(item)}
                  isSelected={
                    (selection?.kind === "ingestion-candidate" && item.type === "ingestion") ||
                    (selection?.kind === "activity" &&
                      selection.eventType === "proposal" &&
                      item.type === "proposal")
                  }
                />
              ))
            ) : (
              <EmptySectionPlaceholder label="pending items" />
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
