/**
 * Phase O1/O2/O3/O4 – Context Panel
 * Right rail. Dynamic content based on selection.
 */

import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { buildResearchUrl } from "../lib/researchTarget";
import ContextSection from "./context/ContextSection";
import QuickActionsCard, { type QuickAction } from "./context/QuickActionsCard";

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
      <p className="text-sm font-medium text-[#0F172A]">No item selected</p>
      <p className="mt-2 text-xs text-[#64748B] leading-relaxed">
        Select a signal, candidate, registry entry, or activity item to inspect related context and
        take the next action.
      </p>
      <p className="mt-3 text-xs text-[#94A3B8]">
        Try: Signal Radar card · Activity item · Radar/Registry/Ingestion row
      </p>
    </div>
  );
}

function UnknownEntityContext({
  entity,
  entityType,
  occurrenceCount,
  suggestedAction,
}: {
  entity: string;
  entityType?: string;
  occurrenceCount?: number;
  suggestedAction?: string;
}) {
  const researchUrl = buildResearchUrl({
    mode: "entity",
    entity,
    entityType: entityType ?? "unknown",
    radarMetadata: occurrenceCount != null ? { occurrenceCount } : undefined,
  });
  const actions: QuickAction[] = [
    { label: "Check registry", to: `/orchestrator/registry?search=${encodeURIComponent(entity)}` },
    { label: "Open radar", to: "/orchestrator/radar" },
    { label: "Research", to: researchUrl },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Unknown entity">
        <p className="font-medium">{entity}</p>
        {entityType && <p className="text-xs text-[#64748B] mt-0.5">Type: {entityType}</p>}
        {occurrenceCount != null && (
          <p className="text-xs text-[#64748B]">Occurrences: {occurrenceCount}</p>
        )}
        {suggestedAction && (
          <p className="text-xs text-[#F59E0B] mt-1">Suggested: {suggestedAction}</p>
        )}
      </ContextSection>
      <QuickActionsCard actions={actions} />
    </div>
  );
}

function InteractionGapContext({
  entityA,
  entityB,
  combinationType,
  occurrenceCount,
  highRiskCount,
  safeCount,
  signalPattern,
}: {
  entityA: string;
  entityB: string;
  combinationType?: string;
  occurrenceCount?: number;
  highRiskCount?: number;
  safeCount?: number;
  signalPattern?: string;
}) {
  const researchUrl = buildResearchUrl({
    mode: "combination",
    entityA,
    entityB,
    typeA: "unknown",
    typeB: "unknown",
    radarTelemetry: {
      occurrenceCount,
      highRiskCount,
      safeOccurrenceCount: safeCount,
      signalPattern,
    },
  });
  const actions: QuickAction[] = [
    { label: "Investigate", to: "/orchestrator/radar" },
    { label: "Research pair", to: researchUrl },
    { label: "Check A", to: `/orchestrator/registry?search=${encodeURIComponent(entityA)}` },
    { label: "Check B", to: `/orchestrator/registry?search=${encodeURIComponent(entityB)}` },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Interaction gap">
        <p className="font-medium">{entityA} + {entityB}</p>
        {combinationType && (
          <p className="text-xs text-[#64748B] mt-0.5">Type: {combinationType}</p>
        )}
        {occurrenceCount != null && (
          <p className="text-xs text-[#64748B]">Occurrences: {occurrenceCount}</p>
        )}
        {highRiskCount != null && (
          <p className="text-xs text-[#EF4444]">High risk: {highRiskCount}</p>
        )}
        {safeCount != null && (
          <p className="text-xs text-[#10B981]">Safe: {safeCount}</p>
        )}
        {signalPattern && (
          <p className="text-xs text-[#64748B] mt-1">Pattern: {signalPattern}</p>
        )}
      </ContextSection>
      <QuickActionsCard actions={actions} />
    </div>
  );
}

function SignalContext({
  title,
  signalType,
  entityA,
  entityB,
}: {
  title: string;
  signalType?: string;
  entityA?: string;
  entityB?: string;
}) {
  const researchUrl =
    entityA && entityB
      ? buildResearchUrl({
          mode: "combination",
          entityA,
          entityB,
          typeA: "unknown",
          typeB: "unknown",
        })
      : "/orchestrator/research";
  const actions: QuickAction[] = [
    { label: "Open radar", to: "/orchestrator/radar" },
    { label: "Research", to: researchUrl },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Signal">
        <p className="font-medium">{title}</p>
        {signalType && <p className="text-xs text-[#64748B] mt-0.5">{signalType}</p>}
      </ContextSection>
      <QuickActionsCard actions={actions} />
    </div>
  );
}

function IngestionCandidateContext({
  name,
  canonicalId,
  sourceDataset,
  aliasCount,
  candidateId,
}: {
  candidateId: string;
  name?: string;
  canonicalId?: string;
  sourceDataset?: string;
  aliasCount?: number;
}) {
  const researchUrl = buildResearchUrl({
    mode: "entity",
    entity: name ?? canonicalId ?? candidateId,
    entityType: "drug",
    radarMetadata: aliasCount != null ? { occurrenceCount: aliasCount } : undefined,
  });
  const actions: QuickAction[] = [
    { label: "Open ingestion", to: "/orchestrator/ingestion" },
    { label: "Create draft proposal", to: `/orchestrator/ingestion?candidateId=${encodeURIComponent(candidateId)}` },
    { label: "Research", to: researchUrl },
    { label: "Dismiss candidate", to: "/orchestrator/ingestion" },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Ingestion candidate">
        <p className="font-medium">{name ?? candidateId}</p>
        {canonicalId && <p className="text-xs text-[#64748B] mt-0.5">ID: {canonicalId}</p>}
        {sourceDataset && <p className="text-xs text-[#64748B]">Source: {sourceDataset}</p>}
        {aliasCount != null && <p className="text-xs text-[#64748B]">Aliases: {aliasCount}</p>}
      </ContextSection>
      <QuickActionsCard actions={actions} />
    </div>
  );
}

function RegistryEntityContext({
  canonicalId,
  registryType,
  aliasCount,
  entityClass,
}: {
  canonicalId: string;
  registryType?: string;
  aliasCount?: number;
  entityClass?: string;
}) {
  const researchUrl = buildResearchUrl({
    mode: "entity",
    entity: canonicalId,
    entityType: registryType ?? "unknown",
  });
  const actions: QuickAction[] = [
    { label: "Open registry", to: `/orchestrator/registry?search=${encodeURIComponent(canonicalId)}` },
    { label: "Research", to: researchUrl },
    { label: "Search radar", to: "/orchestrator/radar" },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Registry entity">
        <p className="font-medium">{canonicalId}</p>
        {registryType && <p className="text-xs text-[#64748B] mt-0.5">Type: {registryType}</p>}
        {aliasCount != null && <p className="text-xs text-[#64748B]">Aliases: {aliasCount}</p>}
        {entityClass && <p className="text-xs text-[#64748B]">Class: {entityClass}</p>}
      </ContextSection>
      <QuickActionsCard actions={actions} />
    </div>
  );
}

function ActivityContext({
  title,
  eventType,
  detail,
  timestamp,
}: {
  title: string;
  eventType?: string;
  detail?: string;
  timestamp?: string;
}) {
  const routeMap: Record<string, string> = {
    research: "/orchestrator/research",
    ingestion: "/orchestrator/ingestion",
    proposal: "/orchestrator/registry",
    signal: "/orchestrator/radar",
  };
  const route = eventType ? routeMap[eventType] : "/orchestrator/activity";
  const actions: QuickAction[] = [{ label: "Open related page", to: route }];
  return (
    <div className="space-y-3">
      <ContextSection title="Activity">
        <p className="font-medium">{title}</p>
        {eventType && <p className="text-xs text-[#64748B] mt-0.5">Type: {eventType}</p>}
        {detail && <p className="text-xs text-[#64748B]">{detail}</p>}
        {timestamp && <p className="text-xs text-[#94A3B8] font-mono mt-1">{timestamp}</p>}
      </ContextSection>
      <QuickActionsCard actions={actions} />
    </div>
  );
}

export default function ContextPanel() {
  const { selection } = useOrchestratorSelection();

  return (
    <aside className="w-64 shrink-0 p-4 overflow-y-auto">
      <p className="orch-section-header mb-3 text-xs font-semibold uppercase tracking-wide text-[#0F172A]">
        Context
      </p>
      <div className="space-y-3">
        {!selection && <EmptyState />}
        {selection?.kind === "unknown-entity" && (
          <UnknownEntityContext
            entity={selection.entity}
            entityType={selection.entityType}
            occurrenceCount={selection.occurrenceCount}
            suggestedAction={selection.suggestedAction}
          />
        )}
        {selection?.kind === "interaction-gap" && (
          <InteractionGapContext
            entityA={selection.entityA}
            entityB={selection.entityB}
            combinationType={selection.combinationType}
            occurrenceCount={selection.occurrenceCount}
            highRiskCount={selection.highRiskCount}
            safeCount={selection.safeCount}
            signalPattern={selection.signalPattern}
          />
        )}
        {selection?.kind === "signal" && (
          <SignalContext
            title={selection.title}
            signalType={selection.signalType}
            entityA={selection.entityA}
            entityB={selection.entityB}
          />
        )}
        {selection?.kind === "ingestion-candidate" && (
          <IngestionCandidateContext
            candidateId={selection.candidateId}
            name={selection.name}
            canonicalId={selection.canonicalId}
            sourceDataset={selection.sourceDataset}
            aliasCount={selection.aliasCount}
          />
        )}
        {selection?.kind === "registry-entity" && (
          <RegistryEntityContext
            canonicalId={selection.canonicalId}
            registryType={selection.registryType}
            aliasCount={selection.aliasCount}
            entityClass={selection.entityClass}
          />
        )}
        {selection?.kind === "activity" && (
          <ActivityContext
            title={selection.title}
            eventType={selection.eventType}
            detail={selection.detail}
            timestamp={selection.timestamp}
          />
        )}
      </div>
    </aside>
  );
}
