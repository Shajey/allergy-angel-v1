/**
 * Phase 22.2 – Relationship Signal Priority Scoring
 *
 * Scores emerging knowledge signals for admin triage.
 */

import type { RelationshipType } from "./relationshipDetector.js";

const RELATIONSHIP_WEIGHTS: Record<RelationshipType, number> = {
  drug_supplement_possible_interaction: 1.0,
  drug_food_possible_interaction: 0.8,
  supplement_stack: 0.5,
  food_pair: 0.2,
  unknown_pair: 0.05,
};

export function scoreRelationshipSignal(args: {
  occurrenceCount: number;
  relationshipType: RelationshipType;
  lastSeenDay: string;
  windowDays?: number;
}): number {
  const { occurrenceCount, relationshipType, lastSeenDay, windowDays = 30 } = args;
  const weight = RELATIONSHIP_WEIGHTS[relationshipType] ?? 0.05;
  const base = Math.log10(occurrenceCount + 1);
  const daysSince = daysSinceLastSeen(lastSeenDay);
  const recencyMultiplier = Math.max(0.3, 1 - daysSince / (windowDays * 2));
  return base * weight * recencyMultiplier;
}

function daysSinceLastSeen(dayStr: string): number {
  const day = new Date(dayStr);
  const now = new Date();
  const diff = now.getTime() - day.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
}

export function getSignalPriorityLabel(score: number): string {
  if (score >= 0.5) return "high";
  if (score >= 0.2) return "medium";
  return "low";
}
