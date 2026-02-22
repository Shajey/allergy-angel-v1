/**
 * Phase 13.5 – Safety Report Builder (Pure, Deterministic)
 * Phase 13.5.2 – Back-compat: old checks may have minimal verdict (riskLevel/reasoning only).
 * Phase 14.2 – Advice block: ranked advice from registry, cap 3, General Safety fallback.
 * Report reflects stored state; only derives traceId when missing.
 */

import {
  resolveAdviceForMatched,
  ADVICE_REGISTRY_VERSION,
  GENERAL_SAFETY_FALLBACK,
  type AdviceEntry,
} from "../advice/adviceRegistry.js";
import { getParentKeyForTerm } from "../inference/allergenTaxonomy.js";

// ── Input types ─────────────────────────────────────────────────────

export interface ReportCheckInput {
  id: string;
  profile_id: string;
  created_at: string;
  raw_text: string;
  verdict: {
    riskLevel: "none" | "medium" | "high";
    reasoning: string;
    matched?: Array<{
      rule: string;
      ruleCode?: string;
      details: Record<string, unknown>;
    }>;
    meta?: {
      severity?: number;
      taxonomyVersion?: string;
      traceId?: string;
      matchedCategory?: string;
      matchedChild?: string;
      crossReactive?: boolean;
      source?: string;
      matchedTerm?: string;
    };
  };
}

export interface ReportEventInput {
  id: string;
  created_at: string;
  event_type: string;
  event_data: Record<string, unknown>;
}

// ── Output types ────────────────────────────────────────────────────

export interface ReportMatchedEntry {
  kind: string;
  ruleCode: string | null;
  matchedTerm: string;
  matchedCategory?: string;
  crossReactive?: boolean;
  details?: Record<string, unknown>;
}

export interface CheckReport {
  meta: {
    reportVersion: string;
    generatedAt: string;
    checkId: string;
    profileId: string;
    createdAt: string;
    taxonomyVersion: string | null;
    extractionVersion: string | null;
    modelVersion: string | null;
    traceId: string;
  };
  input: {
    events: Array<{
      id: string;
      created_at: string;
      event_type: string;
      event_data: Record<string, unknown>;
    }>;
    rawText?: string;
  };
  output: {
    verdict: {
      riskLevel: string;
      meta: {
        severity: number;
        taxonomyVersion: string | null;
        traceId: string;
      };
      matched: ReportMatchedEntry[];
    };
    /** Phase 14.2: Actionable advice. Term overrides parent, cap 3, alphabetical tie-breaker. */
    advice?: {
      version: string;
      items: AdviceEntry[];
      topTarget: string | null;
    };
  };
}

export const REPORT_VERSION = "v0-report-13.5";

/** Deterministic filename for safety report download. */
export function reportFilename(profileId: string, checkId: string, taxonomyVersion: string | null): string {
  const version = taxonomyVersion ?? "unknown";
  return `AA_SafetyReport_${profileId}_${checkId}_${version}.json`;
}

// ── Builder ─────────────────────────────────────────────────────────

export function buildCheckReport(args: {
  check: ReportCheckInput;
  events: ReportEventInput[];
  generatedAt?: string;
  includeRawText?: boolean;
}): CheckReport {
  const { check, events, generatedAt, includeRawText = false } = args;
  const verdict = check.verdict;
  const meta = verdict.meta ?? {};
  const taxonomyVersion = meta.taxonomyVersion ?? null;
  const traceId = verdict.meta?.traceId ?? `${check.id}:${taxonomyVersion ?? "unknown"}`;

  const sortedEvents = [...events].sort((a, b) => {
    const timeCmp = a.created_at.localeCompare(b.created_at);
    if (timeCmp !== 0) return timeCmp;
    return a.id.localeCompare(b.id);
  });

  const matched = normalizeMatched(verdict.matched ?? []);
  const advice = buildAdviceBlock(matched);

  return {
    meta: {
      reportVersion: REPORT_VERSION,
      generatedAt: generatedAt ?? new Date().toISOString(),
      checkId: check.id,
      profileId: check.profile_id,
      createdAt: check.created_at,
      taxonomyVersion,
      extractionVersion: null,
      modelVersion: null,
      traceId,
    },
    input: {
      events: sortedEvents.map((e) => ({
        id: e.id,
        created_at: e.created_at,
        event_type: e.event_type,
        event_data: e.event_data,
      })),
      ...(includeRawText ? { rawText: check.raw_text } : {}),
    },
    output: {
      verdict: {
        riskLevel: verdict.riskLevel,
        meta: {
          severity: meta.severity ?? 0,
          taxonomyVersion,
          traceId,
        },
        matched,
      },
      ...(advice ? { advice } : {}),
    },
  };
}

const ADVICE_CAP = 3;

/** Phase 14.2: Build advice block. Deterministic. Cap 3. General Safety fallback when matched but no registry advice. */
function buildAdviceBlock(matched: ReportMatchedEntry[]): CheckReport["output"]["advice"] | undefined {
  const allergyRelevant = matched.filter(
    (m) => m.kind === "allergy_match" || m.kind === "cross_reactive"
  );
  if (allergyRelevant.length === 0) return undefined;

  const matchedForAdvice = allergyRelevant.map((m) => ({
    matchedTerm: m.matchedTerm,
    matchedCategory: m.matchedCategory,
  }));

  let items = resolveAdviceForMatched(matchedForAdvice, getParentKeyForTerm);

  if (items.length === 0) {
    items = [GENERAL_SAFETY_FALLBACK];
  } else {
    items = items.slice(0, ADVICE_CAP);
  }

  const topTarget = items.length > 0 ? items[0].target : null;

  return {
    version: ADVICE_REGISTRY_VERSION,
    items,
    topTarget,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────

function normalizeMatched(
  raw: Array<{ rule: string; ruleCode?: string; details: Record<string, unknown> }>
): ReportMatchedEntry[] {
  const entries: ReportMatchedEntry[] = raw.map((m) => {
    const kind = m.rule;
    const code = m.ruleCode ?? null;
    const matchedTerm = extractMatchedTerm(m);
    const matchedCategory = extractCategory(m);
    const crossReactive = m.rule === "cross_reactive" ? true : undefined;

    const entry: ReportMatchedEntry = {
      kind,
      ruleCode: code,
      matchedTerm,
    };
    if (matchedCategory !== undefined) entry.matchedCategory = matchedCategory;
    if (crossReactive !== undefined) entry.crossReactive = crossReactive;

    const filtered = filterDetails(m.details);
    if (Object.keys(filtered).length > 0) entry.details = filtered;

    return entry;
  });

  entries.sort((a, b) => {
    const kindCmp = a.kind.localeCompare(b.kind);
    if (kindCmp !== 0) return kindCmp;
    const termCmp = a.matchedTerm.localeCompare(b.matchedTerm);
    if (termCmp !== 0) return termCmp;
    const catA = a.matchedCategory ?? "\uffff";
    const catB = b.matchedCategory ?? "\uffff";
    return catA.localeCompare(catB);
  });

  return entries;
}

function extractMatchedTerm(m: { rule: string; details: Record<string, unknown> }): string {
  if (m.rule === "allergy_match") return str(m.details.allergen);
  if (m.rule === "cross_reactive") return str(m.details.matchedTerm);
  if (m.rule === "medication_interaction") {
    const pair = [str(m.details.extracted), str(m.details.conflictsWith)]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    return pair.join(", ");
  }
  return "";
}

function extractCategory(m: { rule: string; details: Record<string, unknown> }): string | undefined {
  if (m.rule === "allergy_match") return str(m.details.matchedCategory) || undefined;
  if (m.rule === "cross_reactive") return str(m.details.source) || undefined;
  return undefined;
}

/** Strip fields already surfaced as top-level report fields to avoid duplication. */
function filterDetails(d: Record<string, unknown>): Record<string, unknown> {
  const skip = new Set(["allergen", "matchedTerm", "matchedCategory", "source", "extracted", "conflictsWith"]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (!skip.has(k) && v !== undefined) out[k] = v;
  }
  return out;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
