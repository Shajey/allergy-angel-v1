/**
 * Phase O2 / O3.1 – Orchestrator Summary Loader
 * Fetches lightweight summary from existing admin endpoints.
 * Returns fallback on partial/total failure for left rail stability.
 */

export interface EmergingSignal {
  title: string;
  subtitle?: string;
  count: number;
  priority?: string;
  entityA?: string;
  entityB?: string;
}

export interface UnknownEntity {
  title: string;
  subtitle?: string;
  count: number;
  suggestedAction?: string;
  entityType?: string;
}

export interface GovernanceQueueItem {
  title: string;
  subtitle?: string;
  count: number;
  type: "ingestion" | "proposal";
}

export interface OrchestratorSummary {
  emergingSignals: EmergingSignal[];
  unknownEntities: UnknownEntity[];
  governanceQueue: GovernanceQueueItem[];
  summaryCounts: {
    emergingRisk: number;
    unknownEntities: number;
    ingestionPending: number;
    proposalsPending: number;
  };
  /** Per-section availability: true = API failed for that section */
  sectionUnavailable?: {
    emerging: boolean;
    unknownEntities: boolean;
    governance: boolean;
  };
}

const WINDOW_DAYS = 30;
const ENTITY_LIMIT = 3;
const COMBINATION_LIMIT = 3;

async function fetchJson<T>(url: string): Promise<{ ok: boolean; data: T | null }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
        console.warn("[Orchestrator][Summary] fetch failed:", url, res.status);
      }
      return { ok: false, data: null };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
      console.warn("[Orchestrator][Summary] fetch error:", url, err);
    }
    return { ok: false, data: null };
  }
}

export type OrchestratorSummaryResult =
  | { ok: true; data: OrchestratorSummary }
  | { ok: false; error: string };

export async function loadOrchestratorSummary(): Promise<OrchestratorSummaryResult> {
  const base = "/api/orchestrator";
  const [statsRes, entitiesRes, combinationsRes, ingestionRes, proposalsRes] = await Promise.all([
    fetchJson<{
      totalUnknownEntities?: number;
      totalInteractionGaps?: number;
      emergingRiskCount?: number;
      mostlySafeCount?: number;
      insufficientDataCount?: number;
    }>(`${base}?action=radar-stats&windowDays=${WINDOW_DAYS}`),
    fetchJson<{ entities?: Array<{ entity: string; entityType: string; occurrenceCount: number; suggestedAction: string }> }>(
      `${base}?action=radar-entities&limit=${ENTITY_LIMIT}&windowDays=${WINDOW_DAYS}`
    ),
    fetchJson<{
      combinations?: Array<{
        entityA: string;
        entityB: string;
        occurrenceCount: number;
        highRiskCount: number;
        signalPattern?: string;
        priorityLabel?: string;
      }>;
    }>(`${base}?action=radar-combinations&limit=${COMBINATION_LIMIT}&windowDays=${WINDOW_DAYS}`),
    fetchJson<{ pending?: number; duplicate?: number; promoted?: number; dismissed?: number }>(
      `${base}?action=ingestion-stats`
    ),
    fetchJson<{ proposals?: unknown[] }>(`${base}?action=alias-proposals&status=pending`),
  ]);

  const stats = statsRes.data;
  const entities = entitiesRes.data;
  const combinations = combinationsRes.data;
  const ingestionStats = ingestionRes.data;
  const proposals = proposalsRes.data;

  const emergingSignals: EmergingSignal[] = [];
  const unknownEntities: UnknownEntity[] = [];
  const governanceQueue: GovernanceQueueItem[] = [];

  // Emerging signals from combinations with emerging_risk pattern
  const combos = combinations?.combinations ?? [];
  for (const c of combos) {
    if (c.signalPattern === "emerging_risk" || (c.highRiskCount > 0 && c.occurrenceCount >= 2)) {
      emergingSignals.push({
        title: `${c.entityA} + ${c.entityB}`,
        subtitle: "Emerging risk",
        count: c.occurrenceCount,
        priority: c.priorityLabel ?? "high",
        entityA: c.entityA,
        entityB: c.entityB,
      });
      if (emergingSignals.length >= 3) break;
    }
  }
  if (emergingSignals.length === 0 && (stats?.emergingRiskCount ?? 0) > 0) {
    emergingSignals.push({
      title: "Emerging risk signals",
      count: stats.emergingRiskCount ?? 0,
      priority: "high",
    });
  }

  // Unknown entities
  const ents = entities?.entities ?? [];
  for (const e of ents) {
    unknownEntities.push({
      title: e.entity,
      subtitle: e.entityType ? `${e.entityType} · ${e.suggestedAction}` : e.suggestedAction,
      count: e.occurrenceCount,
      suggestedAction: e.suggestedAction,
      entityType: e.entityType,
    });
  }
  if (unknownEntities.length === 0 && (stats?.totalUnknownEntities ?? 0) > 0) {
    unknownEntities.push({
      title: "Unknown entities",
      count: stats.totalUnknownEntities ?? 0,
      subtitle: "Requires investigation",
    });
  }

  // Governance queue
  const ingestionPending = ingestionStats?.pending ?? 0;
  const proposalsPending = Array.isArray(proposals?.proposals) ? proposals.proposals.length : 0;
  if (ingestionPending > 0) {
    governanceQueue.push({
      title: `${ingestionPending} ingestion candidate${ingestionPending !== 1 ? "s" : ""}`,
      subtitle: "Pending review",
      count: ingestionPending,
      type: "ingestion",
    });
  }
  if (proposalsPending > 0) {
    governanceQueue.push({
      title: `${proposalsPending} pending proposal${proposalsPending !== 1 ? "s" : ""}`,
      subtitle: "Draft alias proposals",
      count: proposalsPending,
      type: "proposal",
    });
  }

  const sectionUnavailable = {
    emerging: !combinationsRes.ok && !statsRes.ok,
    unknownEntities: !entitiesRes.ok && !statsRes.ok,
    governance: !ingestionRes.ok && !proposalsRes.ok,
  };

  return {
    ok: true,
    data: {
      emergingSignals,
      unknownEntities,
      governanceQueue,
      summaryCounts: {
        emergingRisk: stats?.emergingRiskCount ?? 0,
        unknownEntities: stats?.totalUnknownEntities ?? 0,
        ingestionPending,
        proposalsPending,
      },
      sectionUnavailable,
    },
  };
}
