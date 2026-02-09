/**
 * Phase 10F – Insight Fingerprint
 *
 * Produces a stable, deterministic string that uniquely identifies an
 * insight across feed calls. Two insights with the same type, primary
 * entities, and supporting evidence will always produce the same
 * fingerprint, regardless of score or description wording changes.
 *
 * Format:
 *   <type>:<triggerValue>:<symptomValue>:<sorted check_ids joined by comma>
 *
 * The raw string is used directly (no hashing) for auditability.
 */

interface FingerprintInput {
  type: string;
  priorityHints: {
    triggerValue?: string;
    symptomValue?: string;
    [key: string]: unknown;
  };
  supportingEvents: string[];
}

/**
 * Compute a stable fingerprint for an insight.
 *
 * All values are lowercased and trimmed for consistency.
 * Supporting event IDs are sorted to ensure order-independence.
 */
export function insightFingerprint(insight: FingerprintInput): string {
  const type = (insight.type ?? "").toLowerCase().trim();
  const trigger = (insight.priorityHints?.triggerValue ?? "").toLowerCase().trim();
  const symptom = (insight.priorityHints?.symptomValue ?? "").toLowerCase().trim();
  const events = [...insight.supportingEvents].sort().join(",");

  return `${type}:${trigger}:${symptom}:${events}`;
}
