/**
 * Phase O6.2 / O6.5 / O6.6 / O6.9 — Center owns workflow; investigation state persists in session.
 */

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import OrchestratorPageState from "../orchestrator/components/OrchestratorPageState";
import {
  useInvestigationStore,
} from "../orchestrator/context/InvestigationStoreContext";
import {
  useOrchestratorSelection,
  type OrchestratorSelection,
} from "../orchestrator/context/OrchestratorSelectionContext";
import type { InvestigationEntry, InvestigationResult } from "../orchestrator/lib/investigationTypes";
import { stableSelectionKey } from "../orchestrator/lib/investigationKey";
import { humanReadableProposedForUnknownEntity } from "../orchestrator/lib/investigationProposalBridge";
import { workbenchGraphUrl, workbenchRegistryUrl } from "../orchestrator/lib/workbenchTools";
import {
  activityWorkspaceButtonLabel,
  activityWorkspaceRoute,
  isResolvedOnlyDecision,
  orchestratorDraftTarget,
} from "../orchestrator/lib/orchestratorDraftTarget";
import { PendingGovernanceSection, ProposalPreviewSection } from "../orchestrator/components/ProposalPreviewWorkbench";

function investigatingEntityName(sel: OrchestratorSelection): string {
  switch (sel.kind) {
    case "unknown-entity":
      return sel.entity;
    case "interaction-gap":
      return `${sel.entityA} + ${sel.entityB}`;
    case "signal":
      return sel.title;
    case "ingestion-candidate":
      return sel.name ?? sel.canonicalId ?? sel.candidateId;
    case "registry-entity":
      return sel.canonicalId;
    case "activity":
      return sel.title;
  }
}

function slugifyToken(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function registryPrefix(entityType?: string): string {
  const t = (entityType ?? "entity").toLowerCase();
  if (t === "medication") return "drug";
  return slugifyToken(t) || "entity";
}

function proposedCanonicalId(sel: Extract<OrchestratorSelection, { kind: "unknown-entity" }>): string {
  const reg = registryPrefix(sel.entityType);
  const id = slugifyToken(sel.entity);
  return `${reg}:${id || "unknown"}`;
}

function humanizeKey(k: string): string {
  return k.replace(/_/g, " ");
}

function unknownProblemMeta(sel: Extract<OrchestratorSelection, { kind: "unknown-entity" }>): string {
  const parts: string[] = [];
  if (sel.entityType) parts.push(`Type: ${sel.entityType}`);
  if (sel.occurrenceCount != null) parts.push(`Occurrences: ${sel.occurrenceCount}`);
  const p = sel.payload as Record<string, unknown> | undefined;
  const gap = p?.gapType && typeof p.gapType === "string" ? humanizeKey(p.gapType) : null;
  const dom = p?.dominantContext && typeof p.dominantContext === "string" ? humanizeKey(p.dominantContext) : null;
  const ctx = gap ?? dom;
  if (ctx) parts.push(`Context: ${ctx}`);
  return parts.join(" · ");
}

function unknownSuggestion(sel: Extract<OrchestratorSelection, { kind: "unknown-entity" }>): string {
  switch (sel.suggestedAction) {
    case "alias_candidate":
      return "Likely an alias. Confirm against registry evidence.";
    case "new_entry_candidate":
      return "New entry candidate. Verify type before promotion.";
    case "low_priority":
      return "Low priority. Likely dismissible.";
    case "investigate":
      return "Investigate before committing to a registry change.";
    default:
      return "Classify using Research or Registry evidence.";
  }
}

function interactionProblemMeta(sel: Extract<OrchestratorSelection, { kind: "interaction-gap" }>): string {
  const parts: string[] = [];
  if (sel.combinationType) parts.push(`Type: ${sel.combinationType}`);
  if (sel.occurrenceCount != null) parts.push(`Occurrences: ${sel.occurrenceCount}`);
  if (sel.signalPattern) parts.push(`Pattern: ${humanizeKey(sel.signalPattern)}`);
  const p = sel.payload as { relationship?: string } | undefined;
  if (p?.relationship) parts.push(`Relationship: ${humanizeKey(p.relationship)}`);
  return parts.join(" · ");
}

function interactionSuggestion(sel: Extract<OrchestratorSelection, { kind: "interaction-gap" }>): string {
  if (sel.signalPattern === "emerging_risk") return "Emerging risk. Document interaction before promotion.";
  if (sel.highRiskCount && sel.highRiskCount > 0) return "High-risk signal. Prioritize relationship modeling.";
  return "Link in registry when evidence supports it.";
}

function proposedInteractionId(sel: Extract<OrchestratorSelection, { kind: "interaction-gap" }>): string {
  const a = slugifyToken(sel.entityA);
  const b = slugifyToken(sel.entityB);
  const reg = registryPrefix(undefined);
  return `${reg}:${a}+${b}`;
}

function WorkbenchToolsRow({ selection }: { selection: OrchestratorSelection }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Verify</span>
      <Link
        to={workbenchRegistryUrl(selection)}
        className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-50/90 px-2.5 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:bg-slate-100"
      >
        Check Registry
      </Link>
      <Link
        to={workbenchGraphUrl(selection)}
        className="inline-flex items-center rounded-lg border border-slate-200/90 bg-slate-50/90 px-2.5 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:bg-slate-100"
      >
        View Graph
      </Link>
    </div>
  );
}

function SuggestionBlock({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50/90 px-4 py-3 text-[15px] leading-snug text-[#334155]">
      <span className="font-semibold text-[#64748B]">Suggestion:</span> {children}
    </div>
  );
}

function DecisionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-7 border-t border-slate-300/70 pt-6">
      <p className="text-lg font-semibold tracking-tight text-[#0F172A]">{title}</p>
      {children}
    </div>
  );
}

function DecisionRadios({
  name,
  value,
  onChange,
  options,
}: {
  name: string;
  value: string | null;
  onChange: (v: string) => void;
  options: { value: string; label: ReactNode }[];
}) {
  return (
    <fieldset className="mt-3 space-y-2">
      <legend className="sr-only">Choose one option</legend>
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-start gap-2.5 rounded-md py-0.5 pl-0.5 text-[15px] leading-snug text-[#334155] hover:bg-slate-50"
        >
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:ring-offset-1"
          />
          <span className="select-none">{opt.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function ResearchProgressSection() {
  const [widthPct, setWidthPct] = useState(4);
  useEffect(() => {
    const t = window.setTimeout(() => setWidthPct(96), 80);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <div className="mt-5 space-y-3">
      <p className="text-sm font-semibold text-[#0F172A]">Gathering clinical evidence</p>
      <p className="text-xs leading-snug text-[#64748B]">
        Scanning literature, internal alias index, and co-occurrence signals…
      </p>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-indigo-500 to-violet-600 shadow-sm transition-[width] duration-[2600ms] ease-out"
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

function ResearchResultsSection({ result }: { result: InvestigationResult }) {
  return (
    <div className="mt-5 space-y-3 rounded-xl border border-emerald-200/80 bg-emerald-50/40 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">Research results</p>
      <ul className="list-inside list-disc text-[15px] leading-relaxed text-[#334155]">
        <li>
          <span className="font-medium text-[#0F172A]">Extracted aliases / matches:</span> {result.aliases.join(" · ")}
        </li>
        {result.suggestedClassification ? (
          <li>
            <span className="font-medium text-[#0F172A]">Suggested classification:</span>{" "}
            {result.suggestedClassification}
          </li>
        ) : null}
        <li>
          <span className="font-medium text-[#0F172A]">Confidence:</span> {result.classificationConfidence}%
        </li>
        {result.evidenceSummary ? (
          <li>
            <span className="font-medium text-[#0F172A]">Evidence:</span> {result.evidenceSummary}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

type RadioOpt = { value: string; label: ReactNode };

/** Phase O6.9c — state-based center workflow (not_started → researching → completed → proposal_ready). */
function InvestigationWorkflow({
  selection,
  groupName,
  decisionTitle,
  options,
  onClearSelection,
  showSuggestion,
  suggestion,
  proposalLedgerLine,
}: {
  selection: OrchestratorSelection;
  groupName: string;
  decisionTitle: string;
  options: RadioOpt[];
  onClearSelection: () => void;
  showSuggestion: boolean;
  suggestion?: ReactNode;
  proposalLedgerLine?: { current: string; proposed: string };
}) {
  const navigate = useNavigate();
  const key = useMemo(() => stableSelectionKey(selection), [selection]);
  const { getEntry, setManualSelection, startResearch, generateProposal, rerunResearch, submitForGovernance } =
    useInvestigationStore();
  const entry = getEntry(key);
  const decision = entry.manualSelection;
  const resultsHref = orchestratorDraftTarget(selection);

  const onRadioChange = (v: string) => setManualSelection(key, v);

  const canStartAi =
    decision != null &&
    !isResolvedOnlyDecision(selection, decision) &&
    !(selection.kind === "activity" && decision === "open");

  if (entry.status === "governance_approved") {
    return (
      <p className="mt-5 text-sm text-emerald-900">
        This signal was promoted in Governance. Future checks will use the updated registry path.
      </p>
    );
  }

  if (entry.status === "governance_rejected") {
    return (
      <p className="mt-5 text-sm text-slate-700">
        This signal was closed in Governance without promotion.
      </p>
    );
  }

  if (entry.status === "pending_governance") {
    if (entry.proposalPreview) {
      return <PendingGovernanceSection preview={entry.proposalPreview} ledgerLine={proposalLedgerLine} />;
    }
    return (
      <p className="mt-5 text-sm text-amber-900">
        Submitted for Governance — awaiting review. Preview data is unavailable for this session.
      </p>
    );
  }

  if (entry.status === "proposal_ready" && entry.proposalPreview) {
    return (
      <>
        <ProposalPreviewSection
          className="mt-5"
          preview={entry.proposalPreview}
          ledgerLine={proposalLedgerLine}
          onSubmitGovernance={() => submitForGovernance(selection)}
        />
        {showSuggestion && suggestion ? <SuggestionBlock>{suggestion}</SuggestionBlock> : null}
      </>
    );
  }

  if (entry.status === "completed") {
    if (!entry.result) {
      return (
        <p className="mt-5 text-sm text-amber-900">
          Research data missing for this session. Choose a classification and run Start AI Research again.
        </p>
      );
    }
    return (
      <>
        <ResearchResultsSection result={entry.result} />
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={() => generateProposal(selection)}
            className="orch-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-sm"
          >
            Generate Draft Proposal
          </button>
          <p className="text-center text-xs leading-snug text-[#64748B]">
            Creates a proposal for review. Does not update Allergy Angel until approved in Governance.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <Link
              to={resultsHref}
              className="inline-flex flex-1 justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC] sm:flex-none"
            >
              View Results
            </Link>
            <button
              type="button"
              onClick={() => rerunResearch(key)}
              className="inline-flex flex-1 justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-medium text-[#475569] hover:bg-[#F8FAFC] sm:flex-none"
            >
              Re-run Research
            </button>
          </div>
        </div>
        {showSuggestion && suggestion ? <SuggestionBlock>{suggestion}</SuggestionBlock> : null}
      </>
    );
  }

  if (entry.status === "researching") {
    return (
      <>
        <ResearchProgressSection />
        <p className="mt-3 text-xs text-[#94A3B8]">Actions are disabled until research finishes.</p>
        {showSuggestion && suggestion ? <SuggestionBlock>{suggestion}</SuggestionBlock> : null}
      </>
    );
  }

  return (
    <>
      <DecisionBlock title={decisionTitle}>
        <DecisionRadios name={groupName} value={decision} onChange={onRadioChange} options={options} />
        <div className="mt-5 flex flex-col gap-3">
          {decision != null && isResolvedOnlyDecision(selection, decision) ? (
            <button
              type="button"
              onClick={onClearSelection}
              className="orch-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-sm"
            >
              Mark as Resolved
            </button>
          ) : null}
          {selection.kind === "activity" && decision === "open" ? (
            <button
              type="button"
              onClick={() => navigate(activityWorkspaceRoute(selection))}
              className="orch-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-sm"
            >
              {activityWorkspaceButtonLabel(selection)}
            </button>
          ) : null}
          {canStartAi ? (
            <button
              type="button"
              onClick={() => startResearch(selection)}
              className="orch-gradient-btn w-full rounded-xl px-4 py-3 text-sm font-semibold shadow-sm"
            >
              Start AI Research
            </button>
          ) : null}
        </div>
      </DecisionBlock>
      {showSuggestion && suggestion ? <SuggestionBlock>{suggestion}</SuggestionBlock> : null}
    </>
  );
}

function DecisionWorkspaceCard({
  selection,
  onClearSelection,
}: {
  selection: OrchestratorSelection;
  onClearSelection: () => void;
}) {
  const resetKey = useMemo(() => stableSelectionKey(selection), [selection]);
  const groupName = useMemo(
    () => `orch-decision-${resetKey.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 96)}`,
    [resetKey]
  );

  switch (selection.kind) {
    case "unknown-entity": {
      const meta = unknownProblemMeta(selection);
      const reg = selection.entityType ?? "registry";
      const suggestion = unknownSuggestion(selection);
      const proposedId = proposedCanonicalId(selection);
      const proposedHuman = humanReadableProposedForUnknownEntity(selection, proposedId);
      return (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-md sm:p-6">
          <p className="text-sm font-semibold tracking-tight text-amber-900">Unknown entity detected</p>
          <h2 className="mt-1 text-xl font-semibold leading-snug text-[#0F172A] sm:text-[22px]">{selection.entity}</h2>
          {meta ? (
            <p className="mt-2 text-[15px] leading-snug text-[#475569]">{meta}</p>
          ) : null}

          <WorkbenchToolsRow selection={selection} />

          <InvestigationWorkflow
            selection={selection}
            groupName={groupName}
            decisionTitle="What is this?"
            options={[
              { value: "new-entity", label: <>New entity (add to {reg} registry)</> },
              { value: "alias", label: "Alias of existing entity" },
              { value: "dismiss", label: "Not actionable (dismiss)" },
            ]}
            onClearSelection={onClearSelection}
            showSuggestion
            suggestion={suggestion}
            proposalLedgerLine={{ current: "Unresolved", proposed: proposedHuman }}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Current</p>
              <p className="mt-1.5 text-[15px] font-medium text-[#0F172A]">Unresolved</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Proposed</p>
              <p className="mt-1.5 text-[15px] leading-snug text-[#0F172A]">{proposedHuman}</p>
            </div>
          </div>
        </div>
      );
    }
    case "interaction-gap": {
      const meta = interactionProblemMeta(selection);
      const title = `${selection.entityA} + ${selection.entityB}`;
      const suggestion = interactionSuggestion(selection);
      const proposed = proposedInteractionId(selection);
      return (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-md sm:p-6">
          <p className="text-sm font-semibold tracking-tight text-violet-900">Interaction gap detected</p>
          <h2 className="mt-1 text-xl font-semibold leading-snug text-[#0F172A] sm:text-[22px]">{title}</h2>
          {meta ? (
            <p className="mt-2 text-[15px] leading-snug text-[#475569]">{meta}</p>
          ) : null}

          <WorkbenchToolsRow selection={selection} />

          <InvestigationWorkflow
            selection={selection}
            groupName={groupName}
            decisionTitle="What should we do?"
            options={[
              { value: "record", label: "Record a supported relationship in the registry" },
              { value: "evidence", label: "Gather more evidence before changing knowledge" },
              { value: "dismiss", label: "Not actionable (dismiss)" },
            ]}
            onClearSelection={onClearSelection}
            showSuggestion
            suggestion={suggestion}
          />

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Current</p>
              <p className="mt-1.5 text-[15px] font-medium text-[#0F172A]">No known interaction</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#94A3B8]">Proposed</p>
              <p className="mt-1.5 break-all font-mono text-[15px] text-[#0F172A]">{proposed}</p>
            </div>
          </div>
        </div>
      );
    }
    case "signal": {
      const count = typeof selection.payload?.count === "number" ? selection.payload.count : undefined;
      const meta = [
        selection.signalType ? `Type: ${selection.signalType}` : null,
        count != null ? `Occurrences: ${count}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-md sm:p-6">
          <p className="text-sm font-semibold tracking-tight text-rose-900">Safety signal detected</p>
          <h2 className="mt-1 text-xl font-semibold leading-snug text-[#0F172A] sm:text-[22px]">{selection.title}</h2>
          {meta ? <p className="mt-2 text-[15px] leading-snug text-[#475569]">{meta}</p> : null}
          <WorkbenchToolsRow selection={selection} />
          <InvestigationWorkflow
            selection={selection}
            groupName={groupName}
            decisionTitle="What is the next step?"
            options={[
              { value: "escalate", label: "Escalate for relationship review" },
              { value: "monitor", label: "Monitor only — no registry change yet" },
              { value: "dismiss", label: "Not actionable (dismiss)" },
            ]}
            onClearSelection={onClearSelection}
            showSuggestion
            suggestion="Review emerging pattern with evidence before governance."
          />
        </div>
      );
    }
    case "ingestion-candidate":
      return (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-md sm:p-6">
          <p className="text-sm font-semibold tracking-tight text-cyan-900">Ingestion candidate</p>
          <h2 className="mt-1 text-xl font-semibold leading-snug text-[#0F172A] sm:text-[22px]">
            {selection.name ?? selection.candidateId}
          </h2>
          <p className="mt-2 text-[15px] text-[#475569]">
            {[selection.sourceDataset && `Source: ${selection.sourceDataset}`, selection.aliasCount != null && `Aliases: ${selection.aliasCount}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <WorkbenchToolsRow selection={selection} />
          <InvestigationWorkflow
            selection={selection}
            groupName={groupName}
            decisionTitle="What is this?"
            options={[
              { value: "promote", label: "Promote into registry after validation" },
              { value: "merge", label: "Merge with an existing canonical entry" },
              { value: "dismiss", label: "Dismiss candidate" },
            ]}
            onClearSelection={onClearSelection}
            showSuggestion
            suggestion="Finish validation in Ingestion before promotion."
          />
        </div>
      );
    case "registry-entity":
      return (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-md sm:p-6">
          <p className="text-sm font-semibold tracking-tight text-slate-800">Registry entity</p>
          <h2 className="mt-1 text-xl font-semibold leading-snug text-[#0F172A] sm:text-[22px]">{selection.canonicalId}</h2>
          <p className="mt-2 text-[15px] text-[#475569]">
            {[
              selection.registryType && `Type: ${selection.registryType}`,
              selection.aliasCount != null && `Aliases: ${selection.aliasCount}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <WorkbenchToolsRow selection={selection} />
          <InvestigationWorkflow
            selection={selection}
            groupName={groupName}
            decisionTitle="What do you need?"
            options={[
              { value: "verify", label: "Verify or extend this entry" },
              { value: "anchor", label: "Use as anchor for aliases or relationships" },
              { value: "none", label: "No change needed" },
            ]}
            onClearSelection={onClearSelection}
            showSuggestion={false}
          />
        </div>
      );
    case "activity":
      return (
        <div className="mx-auto w-full max-w-4xl rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-md sm:p-6">
          <p className="text-sm font-semibold tracking-tight text-slate-700">Activity</p>
          <h2 className="mt-1 text-xl font-semibold leading-snug text-[#0F172A] sm:text-[22px]">{selection.title}</h2>
          {selection.detail ? (
            <p className="mt-2 text-[15px] text-[#475569]">{selection.detail}</p>
          ) : null}
          <WorkbenchToolsRow selection={selection} />
          <InvestigationWorkflow
            selection={selection}
            groupName={groupName}
            decisionTitle="Next step"
            options={[
              { value: "open", label: "Open the linked workspace from Actions" },
              { value: "archive", label: "Archive or ignore" },
            ]}
            onClearSelection={onClearSelection}
            showSuggestion={false}
          />
        </div>
      );
  }
}

export default function AdminUnmappedPage() {
  const { selection, clearSelection } = useOrchestratorSelection();

  const activeHeader = useMemo(() => {
    if (!selection) return null;
    return {
      title: `Investigating: ${investigatingEntityName(selection)}`,
      subtext: "Knowledge gap detected from real safety checks.",
    };
  }, [selection]);

  return (
    <OrchestratorPageState state="success" pageName="Signals">
      <div className="mx-auto flex min-h-[min(60vh,480px)] w-full max-w-4xl flex-1 flex-col px-4 py-5 sm:px-6">
        <header className={selection ? "mb-5" : "mb-6"}>
          <h1 className="orch-section-header text-xl font-semibold text-[#0F172A] sm:text-2xl">
            {activeHeader ? activeHeader.title : "Safety Signals"}
          </h1>
          {activeHeader ? (
            <p className="mt-1.5 text-sm leading-snug text-[#64748B] sm:text-[15px]">{activeHeader.subtext}</p>
          ) : (
            <p className="mx-auto mt-8 max-w-md text-center text-sm leading-snug text-[#94A3B8]">
              Select a safety signal from the left queue to begin investigation.
            </p>
          )}
        </header>
        {selection ? (
          <div key={stableSelectionKey(selection)} className="contents">
            <DecisionWorkspaceCard selection={selection} onClearSelection={clearSelection} />
          </div>
        ) : null}
      </div>
    </OrchestratorPageState>
  );
}
