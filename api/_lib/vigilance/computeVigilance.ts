/**
 * Phase 13 / 15.1 / 15.2 / 15.3 – Vigilance State (Deterministic, Read-only)
 *
 * Computes whether a profile currently has an active medium/high risk
 * based on stored check verdicts within a time window.
 * Phase 15.1: time-weighted decay.
 * Phase 15.2: topN_sum aggregation (pressureScore = min(100, sum(top 3 weighted severities))).
 * Phase 15.3: pressureSources ranking (terms contributing to pressure; normalized lowercase).
 * No inference re-computation; reads persisted verdicts only.
 * No LLM, no DB writes, no schema changes.
 */

import { getSupabaseClient } from "../supabaseClient.js";

// ── Constants ────────────────────────────────────────────────────────

const MEDIUM_THRESHOLD = 50;
const TOP_N = 3;

/** Map riskLevel to severity when meta.severity missing (back-compat). high=100, medium=50, none=0 */
function mapFromRiskLevel(riskLevel: string): number {
  if (riskLevel === "high") return 100;
  if (riskLevel === "medium") return 50;
  return 0;
}

/** Deterministic decay buckets (no Math.exp). */
function getDecayWeight(hoursSinceCheck: number): number {
  if (hoursSinceCheck <= 1) return 1.0;
  if (hoursSinceCheck <= 6) return 0.75;
  if (hoursSinceCheck <= 12) return 0.5;
  return 0.25;
}

/** Map hoursSince to deterministic age bucket (no raw float in API). */
function getAgeBucket(hoursSince: number): "0_to_1h" | "1_to_6h" | "6_to_12h" | "12h_plus" {
  if (hoursSince <= 1) return "0_to_1h";
  if (hoursSince <= 6) return "1_to_6h";
  if (hoursSince <= 12) return "6_to_12h";
  return "12h_plus";
}

// ── Types ────────────────────────────────────────────────────────────

export interface VigilanceTrigger {
  checkId: string;
  riskLevel: "medium" | "high";
  severity: number | null;
  matched: string[];
  lastSeenAt: string;
  taxonomyVersion: string | null;
  /** Phase 15.2: debug fields (deterministic; no raw time-delta) */
  weight?: number;
  weightedSeverity?: number;
  ageBucket?: "0_to_1h" | "1_to_6h" | "6_to_12h" | "12h_plus";
  rawSeverity?: number;
}

export interface VigilanceAggregation {
  mode: "topN_sum";
  topN: number;
  /** Top N weighted severities as ints (Math.round), descending */
  components: number[];
}

/** Phase 15.3: term contributing to vigilance pressure. Term normalized to lowercase. */
export interface PressureSource {
  term: string;
  count: number;
  weightedScore: number;
  maxWeighted: number;
  /** Newest contributing check IDs (max 3), created_at desc, checkId asc */
  sourceCheckIds?: string[];
}

export interface VigilanceResult {
  profileId: string;
  windowHours: number;
  vigilanceActive: boolean;
  vigilanceScore: number;
  decayApplied: boolean;
  /** Phase 15.2: aggregation debug */
  aggregation: VigilanceAggregation;
  /** Phase 15.3: ranked terms contributing to pressure */
  pressureSources: PressureSource[];
  trigger: VigilanceTrigger | null;
}

/** Minimal check row shape for vigilance computation. */
export interface VigilanceCheck {
  id: string;
  verdict?: {
    riskLevel?: string;
    matched?: Array<{
      rule: string;
      details: Record<string, unknown>;
    }>;
    meta?: {
      taxonomyVersion?: string;
      severity?: number;
    };
  };
  created_at: string;
}

/**
 * Extract matched term strings from verdict.matched rules.
 * Deterministic: deduplicates and sorts alphabetically.
 */
function extractMatchedTerms(
  matched: Array<{ rule: string; details: Record<string, unknown> }>
): string[] {
  const terms = new Set<string>();
  for (const m of matched) {
    if (m.rule === "allergy_match") {
      const allergen = m.details.allergen as string | undefined;
      if (allergen) terms.add(allergen);
    } else if (m.rule === "cross_reactive") {
      const matchedTerm = m.details.matchedTerm as string | undefined;
      if (matchedTerm) terms.add(matchedTerm);
    } else if (m.rule === "medication_interaction") {
      const extracted = m.details.extracted as string | undefined;
      const conflictsWith = m.details.conflictsWith as string | undefined;
      if (extracted) terms.add(extracted);
      if (conflictsWith) terms.add(conflictsWith);
    }
  }
  return [...terms].sort((a, b) => a.localeCompare(b));
}

/**
 * Pure function: compute vigilance state from pre-fetched check rows.
 * Phase 15.2: topN_sum aggregation. vigilanceScore = min(100, round(sum(top 3 weighted severities))).
 * Rounding: Math.round for sum and components (deterministic; no floating-point drift).
 *
 * @param nowIso - ISO string reference time for decay. Required; caller passes new Date().toISOString().
 */
export function computeVigilanceFromChecks(
  profileId: string,
  checks: VigilanceCheck[],
  windowHours: number,
  nowIso: string
): VigilanceResult {
  const refMs = new Date(nowIso).getTime();

  const scores: number[] = [];
  let bestCheck: VigilanceCheck | null = null;
  let bestWeighted = 0;
  let bestWeight = 0;
  let bestHoursSince = 0;
  let bestRawSeverity = 0;

  /** Phase 15.3: term key (lowercase) -> { count, weightedScore, maxWeighted, checkEntries } */
  const termAccum = new Map<
    string,
    { count: number; weightedScore: number; maxWeighted: number; checkEntries: { checkId: string; created_at: string }[] }
  >();

  for (const check of checks) {
    const riskLevel = check.verdict?.riskLevel;
    if (riskLevel !== "medium" && riskLevel !== "high") continue;

    const meta = check.verdict?.meta;
    const rawSeverity =
      meta?.severity ?? mapFromRiskLevel(riskLevel as string);

    const checkMs = new Date(check.created_at).getTime();
    let hoursSince = (refMs - checkMs) / (60 * 60 * 1000);
    if (hoursSince < 0) hoursSince = 0;
    const weight = getDecayWeight(hoursSince);
    const weightedSeverity = rawSeverity * weight;

    scores.push(weightedSeverity);
    if (weightedSeverity > bestWeighted) {
      bestWeighted = weightedSeverity;
      bestCheck = check;
      bestWeight = weight;
      bestHoursSince = hoursSince;
      bestRawSeverity = rawSeverity;
    }

    if (weightedSeverity > 0) {
      const terms = extractMatchedTerms(check.verdict?.matched ?? []);
      const seen = new Set<string>();
      for (const t of terms) {
        const key = t.toLowerCase().trim();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const cur = termAccum.get(key);
        if (cur) {
          cur.count += 1;
          cur.weightedScore += weightedSeverity;
          cur.maxWeighted = Math.max(cur.maxWeighted, weightedSeverity);
          cur.checkEntries.push({ checkId: check.id, created_at: check.created_at });
        } else {
          termAccum.set(key, {
            count: 1,
            weightedScore: weightedSeverity,
            maxWeighted: weightedSeverity,
            checkEntries: [{ checkId: check.id, created_at: check.created_at }],
          });
        }
      }
    }
  }

  scores.sort((a, b) => b - a);
  const topN = scores.slice(0, TOP_N);
  const sumTopN = topN.reduce((s, v) => s + v, 0);
  const vigilanceScore = Math.min(100, Math.round(sumTopN));
  const components = topN.map((v) => Math.round(v));
  const vigilanceActive = vigilanceScore >= MEDIUM_THRESHOLD;

  const aggregation: VigilanceAggregation = {
    mode: "topN_sum",
    topN: TOP_N,
    components,
  };

  const pressureSources: PressureSource[] = [];
  for (const [termKey, acc] of termAccum) {
    const sortedEntries = [...acc.checkEntries].sort((a, b) => {
      const cmp = b.created_at.localeCompare(a.created_at);
      return cmp !== 0 ? cmp : a.checkId.localeCompare(b.checkId);
    });
    pressureSources.push({
      term: termKey,
      count: acc.count,
      weightedScore: Math.round(acc.weightedScore),
      maxWeighted: Math.round(acc.maxWeighted),
      sourceCheckIds: sortedEntries.slice(0, 3).map((e) => e.checkId),
    });
  }
  pressureSources.sort((a, b) => {
    if (b.weightedScore !== a.weightedScore) return b.weightedScore - a.weightedScore;
    if (b.count !== a.count) return b.count - a.count;
    return a.term.localeCompare(b.term);
  });

  if (bestCheck && vigilanceActive) {
    const matched = extractMatchedTerms(bestCheck.verdict?.matched ?? []);
    const meta = bestCheck.verdict?.meta;
    const riskLevel = bestCheck.verdict!.riskLevel as "medium" | "high";
    return {
      profileId,
      windowHours,
      vigilanceActive: true,
      vigilanceScore,
      decayApplied: true,
      aggregation,
      pressureSources,
      trigger: {
        checkId: bestCheck.id,
        riskLevel,
        severity: meta?.severity ?? null,
        matched,
        lastSeenAt: bestCheck.created_at,
        taxonomyVersion: meta?.taxonomyVersion ?? null,
        weight: bestWeight,
        weightedSeverity: bestWeighted,
        ageBucket: getAgeBucket(bestHoursSince),
        rawSeverity: bestRawSeverity,
      },
    };
  }

  return {
    profileId,
    windowHours,
    vigilanceActive: false,
    vigilanceScore,
    decayApplied: true,
    aggregation,
    pressureSources,
    trigger: null,
  };
}

/**
 * Async DB wrapper: fetch checks within window and compute vigilance.
 */
export async function fetchVigilance(
  profileId: string,
  windowHours: number
): Promise<VigilanceResult> {
  const supabase = getSupabaseClient();
  const since = new Date(
    Date.now() - windowHours * 60 * 60 * 1000
  ).toISOString();

  const { data: checks, error } = await supabase
    .from("checks")
    .select("id, verdict, created_at")
    .eq("profile_id", profileId)
    .gte("created_at", since)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Vigilance checks query failed: ${error.message}`);
  }

  return computeVigilanceFromChecks(
    profileId,
    (checks ?? []) as VigilanceCheck[],
    windowHours,
    new Date().toISOString()
  );
}
