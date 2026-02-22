/**
 * Phase 11.3 – Evidence computation for unmapped discovery
 *
 * Pure, deterministic helpers to compute firstSeenAt, lastSeenAt, examples,
 * sources, and riskRate for each candidate. No randomness, no I/O.
 */

export interface EvidenceInput {
  kind: "meal_token" | "medication" | "supplement";
  count: number;
  highRiskCount: number;
  firstTs: string;
  lastTs: string;
  /** eventType -> Map of example string -> earliest timestamp (ISO) */
  examplesByType: Map<string, Map<string, string>>;
  /** Per-event-type counts */
  sources: { meal: number; supplement: number; medication: number };
}

export interface EvidenceOutput {
  firstSeenAt: string;
  lastSeenAt: string;
  examples: string[];
  sources: Record<string, number>;
  riskRate: number;
}

/**
 * Compute riskRate = highRiskCount / max(1, count) rounded to 3 decimals.
 * Deterministic: uses fixed rounding, no floating-point tricks.
 */
export function computeRiskRate(highRiskCount: number, count: number): number {
  const denom = Math.max(1, count);
  const raw = highRiskCount / denom;
  return Math.round(raw * 1000) / 1000;
}

/**
 * Build evidence output from aggregation data.
 * Examples: earliest 3 distinct by timestamp, filtered by candidate kind.
 * Determinism: examples ordered by timestamp asc (< >), tie-breaker example string asc.
 * Take first 3. Stable key order in sources (meal, supplement, medication).
 */
export function buildEvidence(input: EvidenceInput): EvidenceOutput {
  const { kind, count, highRiskCount, firstTs, lastTs, examplesByType, sources } = input;

  // Examples: only from events matching candidate kind (context isolation; no cross-type mixing)
  const kindKey = kind === "meal_token" ? "meal" : kind;
  const exMap = examplesByType.get(kindKey);
  const examples: string[] = [];
  if (exMap && exMap.size > 0) {
    // Determinism: primary = timestamp asc (< > not localeCompare); tie-breaker = example string asc
    const entries = Array.from(exMap.entries()).sort((a, b) => {
      if (a[1] < b[1]) return -1;
      if (a[1] > b[1]) return 1;
      if (a[0] < b[0]) return -1;
      if (a[0] > b[0]) return 1;
      return 0;
    });
    for (let i = 0; i < Math.min(3, entries.length); i++) {
      examples.push(entries[i][0]);
    }
  }

  // Sources: include only types with count > 0 (stable key order: meal, supplement, medication)
  const outSources: Record<string, number> = {};
  if (sources.meal > 0) outSources.meal = sources.meal;
  if (sources.supplement > 0) outSources.supplement = sources.supplement;
  if (sources.medication > 0) outSources.medication = sources.medication;

  return {
    firstSeenAt: firstTs,
    lastSeenAt: lastTs,
    examples,
    sources: outSources,
    riskRate: computeRiskRate(highRiskCount, count),
  };
}
