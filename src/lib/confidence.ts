// src/lib/confidence.ts
import type { ConfidenceLevel, RiskLabel } from '@/types/spec';

export function clampScore(score: number): number {
  if (Number.isNaN(score)) return 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}

// confidenceLevel is derived from confidenceScore, not independently set
export function deriveConfidenceLevel(score: number): ConfidenceLevel {
  const s = clampScore(score);
  if (s >= 80) return 'High';
  if (s >= 50) return 'Medium';
  return 'Low';
}

// Safety invariant: Low confidence cannot be "Safe"
export function enforceSafetyInvariant(
  riskLabel: RiskLabel,
  confidenceScore: number
): { riskLabel: RiskLabel; confidenceScore: number } {
  const score = clampScore(confidenceScore);
  const level = deriveConfidenceLevel(score);

  if (level === 'Low' && riskLabel === 'Safe') {
    return { riskLabel: 'Insufficient data', confidenceScore: Math.min(score, 30) };
  }
  return { riskLabel, confidenceScore: score };
}
