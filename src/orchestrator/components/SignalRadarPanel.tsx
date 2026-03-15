/**
 * Phase O1/O2/O3 – Signal Radar Panel
 * Left rail with three sections. Cards are selectable.
 */

import { useEffect, useState } from "react";
import SignalCard from "./SignalCard";
import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import {
  loadOrchestratorSummary,
  type OrchestratorSummary,
  type EmergingSignal,
  type UnknownEntity,
  type GovernanceQueueItem,
} from "../lib/orchestratorSummary";
import { buildResearchUrl } from "../lib/researchTarget";
import { buildGraphUrl } from "../lib/graphUtils";

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="orch-section-header mb-2 mt-4 first:mt-0 text-xs font-semibold uppercase tracking-wide text-[#0F172A]">
      {children}
    </p>
  );
}

function EmptySectionPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#94A3B8]">
      No {label}
    </div>
  );
}

function FallbackSectionPlaceholder({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#FCD34D] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
      {label} unavailable
    </div>
  );
}

export default function SignalRadarPanel() {
  const { selection, setSelection } = useOrchestratorSelection();
  const [summary, setSummary] = useState<OrchestratorSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadOrchestratorSummary().then((result) => {
      if (!cancelled) {
        if (result.ok) {
          setSummary(result.data);
        } else {
          setSummary({
            emergingSignals: [],
            unknownEntities: [],
            governanceQueue: [],
            summaryCounts: { emergingRisk: 0, unknownEntities: 0, ingestionPending: 0, proposalsPending: 0 },
            sectionUnavailable: { emerging: true, unknownEntities: true, governance: true },
          });
        }
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const s = summary ?? {
    emergingSignals: [],
    unknownEntities: [],
    governanceQueue: [],
    summaryCounts: { emergingRisk: 0, unknownEntities: 0, ingestionPending: 0, proposalsPending: 0 },
    sectionUnavailable: { emerging: false, unknownEntities: false, governance: false },
  };
  const unavail = s.sectionUnavailable ?? { emerging: false, unknownEntities: false, governance: false };

  const handleEmergingSelect = (sig: EmergingSignal) => {
    setSelection({
      kind: "signal",
      id: `em:${sig.title}`,
      title: sig.title,
      signalType: "Emerging risk",
      entityA: sig.entityA,
      entityB: sig.entityB,
      payload: { count: sig.count, priority: sig.priority },
    });
  };

  const handleUnknownEntitySelect = (ent: UnknownEntity) => {
    setSelection({
      kind: "unknown-entity",
      entity: ent.title,
      entityType: ent.entityType,
      occurrenceCount: ent.count,
      suggestedAction: ent.suggestedAction,
    });
  };

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
      <aside className="w-56 shrink-0 bg-white p-4 overflow-y-auto">
        <p className="orch-section-header mb-1 text-xs font-semibold uppercase tracking-wide text-[#0F172A]">
          Safety Signals
        </p>
        <p className="text-[11px] text-[#64748B] mb-3">Signals are knowledge gaps detected from real safety checks.</p>
        <div className="space-y-2">
          <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-xs text-[#94A3B8]">
            Loading…
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-56 shrink-0 bg-white p-4 overflow-y-auto">
      <p className="orch-section-header mb-1 text-xs font-semibold uppercase tracking-wide text-[#0F172A]">
        Safety Signals
      </p>
      <p className="text-[11px] text-[#64748B] mb-3">Signals are knowledge gaps detected from real safety checks.</p>

      <SectionHeader>Emerging Signals</SectionHeader>
      <div className="space-y-2">
        {unavail.emerging ? (
          <FallbackSectionPlaceholder label="Radar" />
        ) : s.emergingSignals.length > 0 ? (
          s.emergingSignals.slice(0, 3).map((sig, i) => (
            <SignalCard
              key={`em-${i}`}
              title={sig.title}
              signalType="Emerging risk"
              subtitle={sig.subtitle}
              count={sig.count}
              priority={sig.priority}
              statusColor="emerging"
              onSelect={() => handleEmergingSelect(sig)}
              isSelected={
                selection?.kind === "signal" &&
                (selection.entityA && selection.entityB
                  ? selection.entityA === sig.entityA && selection.entityB === sig.entityB
                  : selection.title === sig.title)
              }
              investigateTo={
                sig.entityA && sig.entityB
                  ? buildResearchUrl({
                      mode: "combination",
                      entityA: sig.entityA,
                      entityB: sig.entityB,
                      typeA: "unknown",
                      typeB: "unknown",
                      radarTelemetry: { occurrenceCount: sig.count },
                    })
                  : undefined
              }
              graphTo={sig.entityA && sig.entityB ? buildGraphUrl({ entityA: sig.entityA, entityB: sig.entityB }) : undefined}
              registryTo={sig.entityA ? `/orchestrator/registry?search=${encodeURIComponent(sig.entityA)}` : undefined}
            />
          ))
        ) : (
          <EmptySectionPlaceholder label="emerging signals" />
        )}
      </div>

      <SectionHeader>Unknown Entities</SectionHeader>
      <div className="space-y-2">
        {unavail.unknownEntities ? (
          <FallbackSectionPlaceholder label="Unknown entities" />
        ) : s.unknownEntities.length > 0 ? (
          s.unknownEntities.slice(0, 3).map((ent, i) => (
            <SignalCard
              key={`ue-${i}`}
              title={ent.title}
              signalType="Unknown entity"
              subtitle={ent.subtitle}
              count={ent.count}
              statusColor="investigate"
              onSelect={() => handleUnknownEntitySelect(ent)}
              isSelected={selection?.kind === "unknown-entity" && selection.entity === ent.title}
              investigateTo={buildResearchUrl({
                mode: "entity",
                entity: ent.title,
                entityType: ent.entityType ?? "unknown",
                radarMetadata: { occurrenceCount: ent.count },
              })}
              graphTo={buildGraphUrl({ entity: ent.title })}
              registryTo={`/orchestrator/registry?search=${encodeURIComponent(ent.title)}`}
            />
          ))
        ) : (
          <EmptySectionPlaceholder label="unknown entities" />
        )}
      </div>

      <SectionHeader>Governance Queue</SectionHeader>
      <div className="space-y-2">
        {unavail.governance ? (
          <FallbackSectionPlaceholder label="Queue" />
        ) : s.governanceQueue.length > 0 ? (
          s.governanceQueue.slice(0, 3).map((item, i) => (
            <SignalCard
              key={`gq-${i}`}
              title={item.title}
              signalType={item.type === "ingestion" ? "Ingestion" : "Proposals"}
              subtitle={item.subtitle}
              count={item.count}
              statusColor="investigate"
              onSelect={() => handleGovernanceSelect(item)}
              isSelected={
                (selection?.kind === "ingestion-candidate" && item.type === "ingestion") ||
                (selection?.kind === "activity" && selection.eventType === "proposal" && item.type === "proposal")
              }
            />
          ))
        ) : (
          <EmptySectionPlaceholder label="pending items" />
        )}
      </div>
    </aside>
  );
}
