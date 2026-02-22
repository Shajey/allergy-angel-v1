/**
 * Phase 12.2 – Replay Diff (Pure, Deterministic)
 *
 * Normalizes verdicts and computes diffs between baseline and candidate.
 * No I/O, no randomness. Stable sorted output for deterministic diffs.
 *
 * Phase 12.2y – Allowlist fingerprints: evaluateGate supports both legacy
 * (scenarioId-only) and fingerprinted (expected diff shape) allowlists.
 */

import type { Verdict } from "../inference/checkRisk.js";

export interface ReplayVerdict {
  riskLevel: "none" | "medium" | "high";
  severity: number;
  matchedTerms: string[];
  matchedCategories: string[];
  crossReactive: boolean;
  taxonomyVersion: string | null;
  registryVersion: string | null;
}

export interface ReplayDiff {
  scenarioId: string;
  baselineVerdict: ReplayVerdict;
  candidateVerdict: ReplayVerdict;
  changes: {
    riskLevelChanged: boolean;
    severityChanged: boolean;
    addedMatches: string[];
    removedMatches: string[];
    notes?: string;
  };
}

export interface ReplayReport {
  meta: {
    baselineTaxonomyVersion: string | null;
    candidateTaxonomyVersion: string | null;
    /** Phase 14.3A: advice integrity. topTargets keys sorted alphabetically. */
    adviceValidation?: {
      mode: "present";
      topTargets: Record<string, string>;
    };
  };
  scenarios: ReplayDiff[];
  summary: {
    totalScenarios: number;
    riskLevelChangesUp: number;
    riskLevelChangesDown: number;
    totalAddedMatches: number;
    totalRemovedMatches: number;
  };
}

// ── Allowlist types (12.2y) ──────────────────────────────────────────

export interface AllowlistFingerprint {
  scenarioId: string;
  expected: {
    riskLevelFrom: string;
    riskLevelTo: string;
    addedMatches: string[];
    removedMatches: string[];
    candidateTaxonomyVersion?: string;
  };
}

export interface ParsedAllowlist {
  mode: "legacy" | "fingerprinted";
  legacyIds: Set<string>;
  fingerprints: Map<string, AllowlistFingerprint>;
}

/** Create a legacy ParsedAllowlist from a simple set of scenario IDs. */
export function legacyAllowlist(ids: Set<string>): ParsedAllowlist {
  return { mode: "legacy", legacyIds: ids, fingerprints: new Map() };
}

/** Normalize and dedupe a string array as a sorted set for deterministic comparison. */
function normalizeSet(arr: string[]): string[] {
  return [...new Set(arr)].sort((a, b) => a.localeCompare(b));
}

function setsEqual(a: string[], b: string[]): boolean {
  const sa = normalizeSet(a);
  const sb = normalizeSet(b);
  return sa.length === sb.length && sa.every((v, i) => v === sb[i]);
}

/**
 * Parse raw allowlist JSON into a ParsedAllowlist.
 * Detects legacy vs fingerprinted format automatically.
 */
export function parseAllowlist(raw: unknown): ParsedAllowlist {
  if (!raw || typeof raw !== "object") {
    return { mode: "legacy", legacyIds: new Set(), fingerprints: new Map() };
  }
  const obj = raw as Record<string, unknown>;

  if (Array.isArray(obj.fingerprints)) {
    const fingerprints = new Map<string, AllowlistFingerprint>();
    for (const entry of obj.fingerprints) {
      if (!entry || typeof entry !== "object") continue;
      const fp = entry as Record<string, unknown>;
      const scenarioId = fp.scenarioId as string | undefined;
      if (!scenarioId) continue;
      const expected = fp.expected as Record<string, unknown> | undefined;
      if (!expected || typeof expected !== "object") continue;
      fingerprints.set(scenarioId, {
        scenarioId,
        expected: {
          riskLevelFrom: (expected.riskLevelFrom as string) ?? "",
          riskLevelTo: (expected.riskLevelTo as string) ?? "",
          addedMatches: Array.isArray(expected.addedMatches) ? (expected.addedMatches as string[]) : [],
          removedMatches: Array.isArray(expected.removedMatches) ? (expected.removedMatches as string[]) : [],
          ...(typeof expected.candidateTaxonomyVersion === "string"
            ? { candidateTaxonomyVersion: expected.candidateTaxonomyVersion }
            : {}),
        },
      });
    }
    return { mode: "fingerprinted", legacyIds: new Set(), fingerprints };
  }

  const ids = Array.isArray(obj.allowedRiskLevelChanges)
    ? new Set(obj.allowedRiskLevelChanges as string[])
    : new Set<string>();
  return { mode: "legacy", legacyIds: ids, fingerprints: new Map() };
}

/** Deterministic normalization of Verdict to ReplayVerdict. Sorted lists. */
export function normalizeVerdict(
  verdict: Verdict,
  taxonomyVersion: string | null = null,
  registryVersion: string | null = null
): ReplayVerdict {
  const severity = verdict.meta?.severity ?? 0;
  const matchedTerms: string[] = [];
  const matchedCategories: string[] = [];
  let crossReactive = false;

  for (const m of verdict.matched ?? []) {
    if (m.rule === "allergy_match") {
      const allergen = m.details.allergen as string | undefined;
      const category = m.details.matchedCategory as string | undefined;
      if (allergen) matchedTerms.push(allergen);
      if (category) matchedCategories.push(category);
    }
    if (m.rule === "cross_reactive") {
      crossReactive = true;
      const term = m.details.matchedTerm as string | undefined;
      if (term) matchedTerms.push(term);
      const source = m.details.source as string | undefined;
      if (source) matchedCategories.push(source);
    }
  }

  return {
    riskLevel: verdict.riskLevel,
    severity,
    matchedTerms: [...new Set(matchedTerms)].sort((a, b) => a.localeCompare(b)),
    matchedCategories: [...new Set(matchedCategories)].sort((a, b) => a.localeCompare(b)),
    crossReactive,
    taxonomyVersion,
    registryVersion,
  };
}

const RISK_ORDER = { none: 0, medium: 1, high: 2 };

/** Compute diff between baseline and candidate verdicts. Deterministic. */
export function computeReplayDiff(
  scenarioId: string,
  baseline: ReplayVerdict,
  candidate: ReplayVerdict
): ReplayDiff {
  const riskLevelChanged = baseline.riskLevel !== candidate.riskLevel;
  const severityChanged = baseline.severity !== candidate.severity;

  const baselineTerms = new Set(baseline.matchedTerms);
  const candidateTerms = new Set(candidate.matchedTerms);
  const addedMatches = [...candidateTerms].filter((t) => !baselineTerms.has(t)).sort((a, b) => a.localeCompare(b));
  const removedMatches = [...baselineTerms].filter((t) => !candidateTerms.has(t)).sort((a, b) => a.localeCompare(b));

  let notes: string | undefined;
  if (riskLevelChanged) {
    const dir = RISK_ORDER[candidate.riskLevel] > RISK_ORDER[baseline.riskLevel] ? "up" : "down";
    notes = `riskLevel ${baseline.riskLevel} → ${candidate.riskLevel} (${dir})`;
  }

  return {
    scenarioId,
    baselineVerdict: baseline,
    candidateVerdict: candidate,
    changes: {
      riskLevelChanged,
      severityChanged,
      addedMatches,
      removedMatches,
      notes,
    },
  };
}

/** Build aggregate report from scenario diffs. */
export function buildReplayReport(
  diffs: ReplayDiff[],
  meta?: { baselineTaxonomyVersion: string | null; candidateTaxonomyVersion: string | null }
): ReplayReport {
  let riskLevelChangesUp = 0;
  let riskLevelChangesDown = 0;
  let totalAddedMatches = 0;
  let totalRemovedMatches = 0;

  for (const d of diffs) {
    if (d.changes.riskLevelChanged) {
      const baseOrd = RISK_ORDER[d.baselineVerdict.riskLevel];
      const candOrd = RISK_ORDER[d.candidateVerdict.riskLevel];
      if (candOrd > baseOrd) riskLevelChangesUp++;
      else riskLevelChangesDown++;
    }
    totalAddedMatches += d.changes.addedMatches.length;
    totalRemovedMatches += d.changes.removedMatches.length;
  }

  return {
    meta: meta ?? { baselineTaxonomyVersion: null, candidateTaxonomyVersion: null },
    scenarios: diffs,
    summary: {
      totalScenarios: diffs.length,
      riskLevelChangesUp,
      riskLevelChangesDown,
      totalAddedMatches,
      totalRemovedMatches,
    },
  };
}

/**
 * Check if report passes gate. Supports both legacy (Set<string>) and
 * fingerprinted (ParsedAllowlist) allowlists for backward compatibility.
 * Strict: fail on any riskLevel change not in allowlist / not matching fingerprint.
 */
export function evaluateGate(
  report: ReplayReport,
  allowlist: ParsedAllowlist,
  strict: boolean
): { passed: boolean; failures: string[] } {
  if (allowlist.mode === "fingerprinted") {
    return evaluateGateFingerprinted(report, allowlist, strict);
  }
  return evaluateGateLegacy(report, allowlist.legacyIds, strict);
}

function evaluateGateLegacy(
  report: ReplayReport,
  allowedIds: Set<string>,
  strict: boolean
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const d of report.scenarios) {
    if (!d.changes.riskLevelChanged) continue;
    const baseOrd = RISK_ORDER[d.baselineVerdict.riskLevel];
    const candOrd = RISK_ORDER[d.candidateVerdict.riskLevel];
    if (candOrd > baseOrd) {
      if (!allowedIds.has(d.scenarioId)) {
        failures.push(
          `Scenario ${d.scenarioId}: riskLevel increased ${d.baselineVerdict.riskLevel} → ${d.candidateVerdict.riskLevel} (not in allowlist)`
        );
      }
    }
  }

  if (strict && report.summary.riskLevelChangesUp + report.summary.riskLevelChangesDown > 0) {
    const changed = report.scenarios.filter((s) => s.changes.riskLevelChanged);
    const notAllowed = changed.filter((s) => !allowedIds.has(s.scenarioId));
    if (notAllowed.length > 0) {
      for (const s of notAllowed) {
        if (!failures.some((f) => f.includes(s.scenarioId))) {
          failures.push(
            `Strict mode: ${s.scenarioId} has riskLevel change (${s.baselineVerdict.riskLevel} → ${s.candidateVerdict.riskLevel})`
          );
        }
      }
    }
  }

  return { passed: failures.length === 0, failures };
}

function evaluateGateFingerprinted(
  report: ReplayReport,
  allowlist: ParsedAllowlist,
  strict: boolean
): { passed: boolean; failures: string[] } {
  const failures: string[] = [];

  for (const d of report.scenarios) {
    if (!d.changes.riskLevelChanged) continue;

    const fp = allowlist.fingerprints.get(d.scenarioId);
    if (!fp) {
      failures.push(
        `Scenario ${d.scenarioId}: riskLevel changed ${d.baselineVerdict.riskLevel} → ${d.candidateVerdict.riskLevel} (no fingerprint in allowlist)`
      );
      continue;
    }

    if (d.baselineVerdict.riskLevel !== fp.expected.riskLevelFrom) {
      failures.push(
        `Scenario ${d.scenarioId}: riskLevelFrom mismatch — expected "${fp.expected.riskLevelFrom}", got "${d.baselineVerdict.riskLevel}"`
      );
    }
    if (d.candidateVerdict.riskLevel !== fp.expected.riskLevelTo) {
      failures.push(
        `Scenario ${d.scenarioId}: riskLevelTo mismatch — expected "${fp.expected.riskLevelTo}", got "${d.candidateVerdict.riskLevel}"`
      );
    }
    if (!setsEqual(d.changes.addedMatches, fp.expected.addedMatches)) {
      failures.push(
        `Scenario ${d.scenarioId}: addedMatches mismatch — expected [${normalizeSet(fp.expected.addedMatches).join(", ")}], got [${normalizeSet(d.changes.addedMatches).join(", ")}]`
      );
    }
    if (!setsEqual(d.changes.removedMatches, fp.expected.removedMatches)) {
      failures.push(
        `Scenario ${d.scenarioId}: removedMatches mismatch — expected [${normalizeSet(fp.expected.removedMatches).join(", ")}], got [${normalizeSet(d.changes.removedMatches).join(", ")}]`
      );
    }
    if (fp.expected.candidateTaxonomyVersion != null) {
      const actualVersion = report.meta.candidateTaxonomyVersion;
      if (actualVersion !== fp.expected.candidateTaxonomyVersion) {
        failures.push(
          `Scenario ${d.scenarioId}: candidateTaxonomyVersion mismatch — expected "${fp.expected.candidateTaxonomyVersion}", got "${actualVersion}"`
        );
      }
    }
  }

  if (strict) {
    const changed = report.scenarios.filter((s) => s.changes.riskLevelChanged);
    for (const s of changed) {
      if (!allowlist.fingerprints.has(s.scenarioId) && !failures.some((f) => f.includes(s.scenarioId))) {
        failures.push(
          `Strict mode: ${s.scenarioId} has riskLevel change (${s.baselineVerdict.riskLevel} → ${s.candidateVerdict.riskLevel}) with no fingerprint`
        );
      }
    }
  }

  return { passed: failures.length === 0, failures };
}
