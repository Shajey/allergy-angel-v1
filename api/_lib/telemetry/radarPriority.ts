/**
 * Phase 22 – Knowledge Radar Priority Scoring
 *
 * Simple, deterministic priority score for entities and combinations.
 */

import type { CombinationType } from "./radarStore.js";

const COMBINATION_WEIGHTS: Record<CombinationType, number> = {
  drug_supplement: 1.5,
  drug_drug: 1.4,
  drug_food: 1.3,
  supplement_supplement: 1.0,
  supplement_food: 0.8,
  food_food: 0.5,
  drug_unknown: 1.2,
  supplement_unknown: 0.9,
  food_unknown: 0.7,
  other: 0.6,
};

/**
 * Compute priority score for an entity.
 * base = log-scaled occurrence_count + high-risk boost + recency decay
 */
export function scoreEntity(args: {
  occurrenceCount: number;
  highRiskCount: number;
  lastSeenDay: string;
  windowDays?: number;
}): number {
  const { occurrenceCount, highRiskCount, lastSeenDay, windowDays = 30 } = args;
  const base = Math.log1p(occurrenceCount);
  const riskBoost = highRiskCount * 0.5;
  const daysSince = daysSinceLastSeen(lastSeenDay);
  const recencyDecay = Math.max(0, 1 - daysSince / (windowDays * 2));
  return (base + riskBoost) * (0.7 + 0.3 * recencyDecay);
}

/**
 * Compute priority score for a combination.
 * Phase 22.4: Incorporates highRiskBoost (strong) and safePatternDiscount (moderate).
 */
export function scoreCombination(args: {
  occurrenceCount: number;
  highRiskCount: number;
  safeOccurrenceCount?: number;
  lastSeenDay: string;
  combinationType: CombinationType;
  windowDays?: number;
}): number {
  const {
    occurrenceCount,
    highRiskCount,
    safeOccurrenceCount = 0,
    lastSeenDay,
    combinationType,
    windowDays = 30,
  } = args;
  const base = Math.log1p(occurrenceCount);
  const highRiskBoost = highRiskCount * 0.8;
  const safeRatio =
    occurrenceCount > 0 ? safeOccurrenceCount / occurrenceCount : 0;
  const safePatternDiscount =
    safeRatio >= 0.8 && highRiskCount === 0 ? 0.5 : 0;
  const typeWeight = COMBINATION_WEIGHTS[combinationType] ?? 0.6;
  const daysSince = daysSinceLastSeen(lastSeenDay);
  const recencyAdjustment = Math.max(0.3, 1 - daysSince / (windowDays * 2));
  return (
    (base + highRiskBoost - safePatternDiscount) *
    typeWeight *
    (0.7 + 0.3 * recencyAdjustment)
  );
}

function daysSinceLastSeen(dayStr: string): number {
  const day = new Date(dayStr);
  const now = new Date();
  const diff = now.getTime() - day.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function getPriorityLabel(score: number): string {
  if (score >= 2) return "high";
  if (score >= 1) return "medium";
  return "low";
}

/** Phase 22.1: Calibrated suggested action from score (tuned for log-scaled scores). */
export function getSuggestedActionFromScore(score: number): string {
  if (score >= 2) return "new_entry_candidate";
  if (score >= 1) return "investigate";
  return "low_priority";
}
