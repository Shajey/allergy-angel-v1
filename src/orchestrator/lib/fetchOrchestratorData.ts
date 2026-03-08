/**
 * Phase O3.1 – Orchestrator Data Fetch Helpers
 * Normalized fetch layer for Radar, Registry, Ingestion pages.
 */

export type OrchestratorFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; details?: string };

const BASE = "/api/orchestrator";

function logFetchFailure(page: string, action: string, status?: number, error?: string): void {
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.warn(`[Orchestrator][${page}] fetch failed: action=${action} status=${status ?? "?"}`, error ?? "");
  }
}

async function fetchOrchestrator<T>(
  page: string,
  action: string,
  params: Record<string, string | number> = {}
): Promise<OrchestratorFetchResult<T>> {
  const qs = new URLSearchParams();
  qs.set("action", action);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") qs.set(k, String(v));
  }
  const url = `${BASE}?${qs.toString()}`;
  try {
    const res = await fetch(url);
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const fallback = `${page} data unavailable`;
      const msg = body?.error ?? fallback;
      const details = body?.details ?? undefined;
      const fullMsg = details ? `${msg}. ${details}` : msg;
      logFetchFailure(page, action, res.status, fullMsg);
      return { ok: false, error: fullMsg, status: res.status, details };
    }
    return { ok: true, data: body as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error";
    logFetchFailure(page, action, undefined, msg);
    return { ok: false, error: msg };
  }
}

// ── Radar ────────────────────────────────────────────────────────────────

export interface RadarEntitiesResponse {
  entities?: Array<{
    entity: string;
    entityType: string;
    occurrenceCount: number;
    highRiskCount: number;
    lastSeenDay: string;
    priorityScore: number;
    suggestedAction: string;
    gapType?: string;
    dominantContext?: string;
    possibleAliasOf?: string | null;
  }>;
  meta?: { count?: number };
}

export interface RadarCombinationsResponse {
  combinations?: Array<{
    entityA: string;
    entityAType: string;
    entityB: string;
    entityBType: string;
    combinationType: string;
    occurrenceCount: number;
    highRiskCount: number;
    safeOccurrenceCount?: number;
    lastSeenDay: string;
    priorityScore: number;
    priorityLabel: string;
    suggestedAction: string;
    gapType?: string;
    signalPattern?: string;
  }>;
  meta?: { count?: number };
}

export interface RadarStatsResponse {
  totalUnknownEntities?: number;
  totalInteractionGaps?: number;
  highPriorityCount?: number;
  totalCombinationsObserved?: number;
  emergingRiskCount?: number;
  mostlySafeCount?: number;
  insufficientDataCount?: number;
}

export interface RadarSignalsResponse {
  signals?: Array<{
    entityA: string;
    entityAType: string | null;
    entityB: string;
    entityBType: string | null;
    relationship: string;
    occurrenceCount: number;
    lastSeenDay: string;
    priorityScore: number;
    priority: string;
  }>;
}

export async function fetchRadarEntities(
  limit = 50,
  windowDays = 30
): Promise<OrchestratorFetchResult<RadarEntitiesResponse>> {
  return fetchOrchestrator<RadarEntitiesResponse>("Radar", "radar-entities", {
    limit,
    windowDays,
  });
}

export async function fetchRadarCombinations(
  limit = 50,
  windowDays = 30
): Promise<OrchestratorFetchResult<RadarCombinationsResponse>> {
  return fetchOrchestrator<RadarCombinationsResponse>("Radar", "radar-combinations", {
    limit,
    windowDays,
  });
}

export async function fetchRadarStats(
  windowDays = 30
): Promise<OrchestratorFetchResult<RadarStatsResponse>> {
  return fetchOrchestrator<RadarStatsResponse>("Radar", "radar-stats", { windowDays });
}

export async function fetchRadarSignals(
  limit = 50,
  windowDays = 30
): Promise<OrchestratorFetchResult<RadarSignalsResponse>> {
  return fetchOrchestrator<RadarSignalsResponse>("Radar", "radar-signals", {
    limit,
    windowDays,
  });
}

// ── Registry ──────────────────────────────────────────────────────────────

export interface RegistryListResponse {
  entries?: Array<{
    id: string;
    type: string;
    aliases: string[];
    class?: string;
    aliasCount?: number;
    source?: string;
  }>;
  meta?: { type?: string; count?: number };
}

export interface RegistrySearchResponse {
  results?: Array<{
    id: string;
    type: string;
    aliases: string[];
    class?: string;
    matchedOn?: string;
    source?: string;
  }>;
}

export interface AliasProposalsResponse {
  proposals?: Array<{
    id: string;
    registry_type: string;
    canonical_id: string;
    proposed_alias: string;
    proposal_action: string;
    status: string;
    created_at: string;
  }>;
  meta?: { count?: number };
}

export async function fetchRegistryEntries(
  type: string
): Promise<OrchestratorFetchResult<RegistryListResponse>> {
  return fetchOrchestrator<RegistryListResponse>("Registry", "registry-list", { type });
}

export async function fetchRegistrySearch(
  search: string,
  type: string
): Promise<OrchestratorFetchResult<RegistrySearchResponse>> {
  return fetchOrchestrator<RegistrySearchResponse>("Registry", "registry-search", {
    search,
    type,
  });
}

export async function fetchPendingProposals(
  type: string,
  status = "pending"
): Promise<OrchestratorFetchResult<AliasProposalsResponse>> {
  return fetchOrchestrator<AliasProposalsResponse>("Registry", "alias-proposals", {
    type,
    status,
  });
}

// ── Ingestion ─────────────────────────────────────────────────────────────

export interface IngestionCandidatesResponse {
  candidates?: Array<{
    id: string;
    canonicalId: string;
    registryType: string;
    candidateType: string;
    name: string;
    aliases: string[];
    class?: string;
    source: { dataset: string; version: string; recordId: string };
    status: string;
    matchedExisting?: { registryType: string; canonicalId: string; matchType: string };
  }>;
  meta?: { count?: number };
}

export interface IngestionStatsResponse {
  pending?: number;
  duplicate?: number;
  promoted?: number;
  dismissed?: number;
}

export async function fetchIngestionCandidates(
  status: string,
  limit = 50
): Promise<OrchestratorFetchResult<IngestionCandidatesResponse>> {
  return fetchOrchestrator<IngestionCandidatesResponse>("Ingestion", "ingestion-candidates", {
    status,
    limit,
  });
}

export async function fetchIngestionStats(): Promise<
  OrchestratorFetchResult<IngestionStatsResponse>
> {
  return fetchOrchestrator<IngestionStatsResponse>("Ingestion", "ingestion-stats");
}
