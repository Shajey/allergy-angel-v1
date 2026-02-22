/**
 * Phase 13.2 – Recent Triggers (Pure, Deterministic)
 *
 * Computes a list of recent medium/high risk triggers from check rows.
 * Reuses matched-term extraction logic from computeVigilance.
 * No I/O, no LLM, no DB writes.
 */

export interface RecentTrigger {
  checkId: string;
  createdAt: string;
  riskLevel: "medium" | "high";
  severity: number | null;
  matched: string[];
  taxonomyVersion: string | null;
}

export interface RecentTriggerCheck {
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
 * Filter, sort, and limit check rows to recent medium/high triggers.
 * Deterministic: createdAt desc, tie-breaker checkId asc.
 */
export function computeRecentTriggersFromChecks(
  checks: RecentTriggerCheck[],
  limit: number
): RecentTrigger[] {
  const filtered = checks.filter((c) => {
    const rl = c.verdict?.riskLevel;
    return rl === "medium" || rl === "high";
  });

  filtered.sort((a, b) => {
    const timeCmp = b.created_at.localeCompare(a.created_at);
    if (timeCmp !== 0) return timeCmp;
    return a.id.localeCompare(b.id);
  });

  return filtered.slice(0, limit).map((c) => ({
    checkId: c.id,
    createdAt: c.created_at,
    riskLevel: c.verdict!.riskLevel as "medium" | "high",
    severity: c.verdict?.meta?.severity ?? null,
    matched: extractMatchedTerms(c.verdict?.matched ?? []),
    taxonomyVersion: c.verdict?.meta?.taxonomyVersion ?? null,
  }));
}
