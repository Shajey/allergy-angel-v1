/**
 * Phase O1/O2/O3/O4 / O6.6 / O6.9 – Context Panel
 * Right rail: identity + optional shortcuts (Registry, Graph). Center owns workflow.
 */

import type { OrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { useOrchestratorSelection } from "../context/OrchestratorSelectionContext";
import { buildGraphUrl } from "../lib/graphUtils";
import ContextSection from "./context/ContextSection";
import QuickActionsCard from "./context/QuickActionsCard";

function EmptyState() {
  return (
    <div className="rounded-lg border-2 border-dashed border-[#E2E8F0] bg-[#F8FAFC] p-4 text-center">
      <p className="text-sm font-medium text-[#0F172A]">Select a safety signal to begin investigation.</p>
      <p className="mt-2 text-xs text-[#64748B] leading-relaxed">
        Signals represent knowledge gaps detected during safety checks.
        Investigating them improves Allergy Angel&apos;s safety intelligence.
      </p>
    </div>
  );
}

function UnknownEntityContext({
  selection,
}: {
  selection: Extract<OrchestratorSelection, { kind: "unknown-entity" }>;
}) {
  const { entity, entityType } = selection;
  const shortcuts = [
    { label: "Check Registry", to: `/orchestrator/registry?search=${encodeURIComponent(entity)}` },
    { label: "View Graph", to: buildGraphUrl({ entity }) },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Identity">
        <p className="font-medium">{entity}</p>
        <p className="mt-0.5 text-xs text-[#64748B]">Type: {entityType ?? "—"}</p>
      </ContextSection>
      <QuickActionsCard shortcuts={shortcuts} />
    </div>
  );
}

function InteractionGapContext({
  selection,
}: {
  selection: Extract<OrchestratorSelection, { kind: "interaction-gap" }>;
}) {
  const { entityA, entityB, combinationType } = selection;
  const shortcuts = [
    { label: "Check Registry", to: `/orchestrator/registry?search=${encodeURIComponent(entityA)}` },
    { label: "View Graph", to: buildGraphUrl({ entityA, entityB }) },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Identity">
        <p className="font-medium">
          {entityA} + {entityB}
        </p>
        <p className="mt-0.5 text-xs text-[#64748B]">Type: {combinationType ?? "Interaction gap"}</p>
      </ContextSection>
      <QuickActionsCard shortcuts={shortcuts} />
    </div>
  );
}

function SignalContext({
  selection,
}: {
  selection: Extract<OrchestratorSelection, { kind: "signal" }>;
}) {
  const { title, signalType, entityA, entityB } = selection;
  const shortcuts = [
    {
      label: "Check Registry",
      to: entityA
        ? `/orchestrator/registry?search=${encodeURIComponent(entityA)}`
        : "/orchestrator/registry",
    },
    {
      label: "View Graph",
      to: entityA && entityB ? buildGraphUrl({ entityA, entityB }) : "/orchestrator/graph",
    },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Identity">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-[#64748B]">Type: {signalType ?? "Safety signal"}</p>
      </ContextSection>
      <QuickActionsCard shortcuts={shortcuts} />
    </div>
  );
}

function IngestionCandidateContext({
  selection,
}: {
  selection: Extract<OrchestratorSelection, { kind: "ingestion-candidate" }>;
}) {
  const { candidateId, name, canonicalId } = selection;
  const displayName = name ?? canonicalId ?? candidateId;
  const shortcuts = [
    {
      label: "Check Registry",
      to: `/orchestrator/registry?search=${encodeURIComponent(name ?? canonicalId ?? candidateId)}`,
    },
    { label: "View Graph", to: buildGraphUrl({ entity: name ?? canonicalId ?? candidateId }) },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Identity">
        <p className="font-medium">{displayName}</p>
        <p className="mt-0.5 text-xs text-[#64748B]">Type: Ingestion candidate</p>
      </ContextSection>
      <QuickActionsCard shortcuts={shortcuts} />
    </div>
  );
}

function RegistryEntityContext({
  selection,
}: {
  selection: Extract<OrchestratorSelection, { kind: "registry-entity" }>;
}) {
  const { canonicalId, registryType } = selection;
  const shortcuts = [
    { label: "Check Registry", to: `/orchestrator/registry?search=${encodeURIComponent(canonicalId)}` },
    { label: "View Graph", to: buildGraphUrl({ entity: canonicalId }) },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Identity">
        <p className="font-medium">{canonicalId}</p>
        <p className="mt-0.5 text-xs text-[#64748B]">Type: {registryType ?? "—"}</p>
      </ContextSection>
      <QuickActionsCard shortcuts={shortcuts} />
    </div>
  );
}

function ActivityContext({
  selection,
}: {
  selection: Extract<OrchestratorSelection, { kind: "activity" }>;
}) {
  const { title } = selection;
  const shortcuts = [
    { label: "Check Registry", to: `/orchestrator/registry?search=${encodeURIComponent(title)}` },
    { label: "View Graph", to: "/orchestrator/graph" },
  ];
  return (
    <div className="space-y-3">
      <ContextSection title="Identity">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-[#64748B]">Type: {selection.eventType ?? "—"}</p>
      </ContextSection>
      <QuickActionsCard shortcuts={shortcuts} />
    </div>
  );
}

export default function ContextPanel() {
  const { selection } = useOrchestratorSelection();

  return (
    <aside className="w-64 shrink-0 p-4 overflow-y-auto">
      <div className="space-y-4">
        {!selection && <EmptyState />}
        {selection?.kind === "unknown-entity" && (
          <UnknownEntityContext selection={selection} />
        )}
        {selection?.kind === "interaction-gap" && (
          <InteractionGapContext selection={selection} />
        )}
        {selection?.kind === "signal" && <SignalContext selection={selection} />}
        {selection?.kind === "ingestion-candidate" && (
          <IngestionCandidateContext selection={selection} />
        )}
        {selection?.kind === "registry-entity" && (
          <RegistryEntityContext selection={selection} />
        )}
        {selection?.kind === "activity" && <ActivityContext selection={selection} />}
      </div>
    </aside>
  );
}
