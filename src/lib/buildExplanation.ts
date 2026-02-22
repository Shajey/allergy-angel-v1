/**
 * Phase 13.3 – Structured Explainability (Pure, Deterministic)
 *
 * Transforms raw verdict matched-rules into structured explanation entries.
 * No LLM, no DB, no inference changes. Read-only derivation from engine state.
 */

// ── Input types (minimal; mirrors verdict shape without coupling to UI) ─

export interface ExplainableMatch {
  rule: string;
  ruleCode?: string;
  details: Record<string, unknown>;
}

export interface ExplainableVerdict {
  riskLevel: "none" | "medium" | "high";
  reasoning: string;
  matched?: ExplainableMatch[];
  meta?: {
    severity?: number;
    taxonomyVersion?: string;
    matchedCategory?: string;
    matchedChild?: string;
    crossReactive?: boolean;
    traceId?: string;
  };
}

export interface ExplainableCheck {
  verdict: ExplainableVerdict;
}

// ── Output types ────────────────────────────────────────────────────

export type ExplanationRuleType = "crossReactive" | "directMatch" | "interaction";

export interface ExplanationEntry {
  summary: string;
  ruleType: ExplanationRuleType;
  ruleCode?: string;
  parentCategory?: string;
  matchedTerm: string;
  taxonomyVersion: string;
  evidence?: {
    riskRate?: number;
    count?: number;
    highRiskCount?: number;
  };
}

export interface StructuredExplanation {
  riskLevel: "none" | "medium" | "high";
  taxonomyVersion: string;
  traceId?: string;
  entries: ExplanationEntry[];
}

// ── Builder ─────────────────────────────────────────────────────────

/**
 * Build structured explanation entries from a check's verdict.
 * Deterministic: sorted entries, no undefined fields leaking.
 */
export function buildExplanationFromCheck(
  check: ExplainableCheck,
  taxonomyVersion: string
): StructuredExplanation {
  const { verdict } = check;
  const version = verdict.meta?.taxonomyVersion ?? taxonomyVersion;
  const entries: ExplanationEntry[] = [];

  for (const m of verdict.matched ?? []) {
    const entry = buildEntry(m, version);
    if (entry) entries.push(entry);
  }

  entries.sort((a, b) => {
    const typeOrder = ruleTypeOrder(a.ruleType) - ruleTypeOrder(b.ruleType);
    if (typeOrder !== 0) return typeOrder;
    return a.matchedTerm.localeCompare(b.matchedTerm);
  });

  return {
    riskLevel: verdict.riskLevel,
    taxonomyVersion: version,
    ...(verdict.meta?.traceId ? { traceId: verdict.meta.traceId } : {}),
    entries,
  };
}

function ruleTypeOrder(rt: ExplanationRuleType): number {
  switch (rt) {
    case "directMatch": return 0;
    case "crossReactive": return 1;
    case "interaction": return 2;
  }
}

function buildEntry(
  m: ExplainableMatch,
  taxonomyVersion: string
): ExplanationEntry | null {
  let entry: ExplanationEntry | null = null;
  if (m.rule === "allergy_match") {
    entry = buildDirectMatchEntry(m, taxonomyVersion);
  } else if (m.rule === "cross_reactive") {
    entry = buildCrossReactiveEntry(m, taxonomyVersion);
  } else if (m.rule === "medication_interaction") {
    entry = buildInteractionEntry(m, taxonomyVersion);
  }
  if (entry && m.ruleCode) {
    entry.ruleCode = m.ruleCode;
  }
  return entry;
}

function buildDirectMatchEntry(
  m: ExplainableMatch,
  taxonomyVersion: string
): ExplanationEntry {
  const allergen = str(m.details.allergen);
  const category = str(m.details.matchedCategory);
  const severity = num(m.details.severity);

  return {
    summary: `"${allergen}" matches allergen category ${category}`,
    ruleType: "directMatch",
    parentCategory: category || undefined,
    matchedTerm: allergen,
    taxonomyVersion,
    ...(severity != null ? { evidence: { riskRate: severity / 100 } } : {}),
  };
}

function buildCrossReactiveEntry(
  m: ExplainableMatch,
  taxonomyVersion: string
): ExplanationEntry {
  const matchedTerm = str(m.details.matchedTerm);
  const source = str(m.details.source);
  const severity = num(m.details.severity);

  return {
    summary: `"${matchedTerm}" is cross-reactive with ${source}`,
    ruleType: "crossReactive",
    parentCategory: source || undefined,
    matchedTerm,
    taxonomyVersion,
    ...(severity != null ? { evidence: { riskRate: severity / 100 } } : {}),
  };
}

function buildInteractionEntry(
  m: ExplainableMatch,
  taxonomyVersion: string
): ExplanationEntry {
  const extracted = str(m.details.extracted);
  const conflictsWith = str(m.details.conflictsWith);
  const pair = [extracted, conflictsWith].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const matchedTerm = pair.join(", ");

  return {
    summary: `${pair[0]} may interact with ${pair[1] ?? "unknown"}`,
    ruleType: "interaction",
    matchedTerm,
    taxonomyVersion,
  };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number | null {
  return typeof v === "number" ? v : null;
}
