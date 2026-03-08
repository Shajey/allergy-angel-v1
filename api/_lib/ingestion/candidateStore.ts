/**
 * Phase 24.1 – Ingestion Candidate Store
 *
 * Saves and fetches staged candidates. Used by admin API and ingest scripts.
 */

import { getSupabaseClient } from "../supabaseClient.js";
import type { IngestionCandidate, CandidateStatus } from "./types.js";

export interface StoredCandidate {
  id: string;
  canonical_id: string;
  registry_type: string;
  candidate_type: string;
  name: string;
  aliases: string[];
  class: string | null;
  source_dataset: string;
  source_version: string;
  source_record_id: string;
  source_url: string | null;
  status: string;
  matched_existing: Record<string, unknown> | null;
  ingested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

function toRow(c: IngestionCandidate): Record<string, unknown> {
  return {
    canonical_id: c.canonicalId,
    registry_type: c.registryType,
    candidate_type: c.candidateType,
    name: c.name,
    aliases: c.aliases,
    class: c.class ?? null,
    source_dataset: c.source.dataset,
    source_version: c.source.version,
    source_record_id: c.source.recordId,
    source_url: c.source.url ?? null,
    status: c.status,
    matched_existing: c.matchedExisting ?? null,
  };
}

function fromRow(r: StoredCandidate): IngestionCandidate {
  return {
    id: r.id,
    canonicalId: r.canonical_id,
    registryType: r.registry_type as "drug" | "supplement" | "food",
    candidateType: r.candidate_type as "entity" | "alias" | "class_assignment",
    name: r.name,
    aliases: Array.isArray(r.aliases) ? r.aliases : [],
    class: r.class ?? undefined,
    source: {
      dataset: r.source_dataset,
      version: r.source_version,
      recordId: r.source_record_id,
      url: r.source_url ?? undefined,
    },
    status: r.status as CandidateStatus,
    matchedExisting: r.matched_existing as IngestionCandidate["matchedExisting"],
  };
}

export async function saveCandidates(candidates: IngestionCandidate[]): Promise<number> {
  const supabase = getSupabaseClient();
  let saved = 0;
  for (const c of candidates) {
    const row = toRow(c);
    const { error } = await supabase.from("ingestion_candidates").upsert(row, {
      onConflict: "source_dataset,source_record_id",
      ignoreDuplicates: false,
    });
    if (!error) saved++;
  }
  return saved;
}

export async function fetchCandidates(args: {
  status?: CandidateStatus;
  limit?: number;
}): Promise<IngestionCandidate[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("ingestion_candidates")
    .select("*")
    .order("ingested_at", { ascending: false });
  if (args.status) {
    query = query.eq("status", args.status);
  }
  const limit = args.limit ?? 50;
  const { data, error } = await query.limit(limit);
  if (error) throw new Error(`Fetch candidates failed: ${error.message}`);
  return (data ?? []).map((r) => fromRow(r as StoredCandidate));
}

export async function fetchCandidateById(id: string): Promise<IngestionCandidate | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ingestion_candidates")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Fetch candidate failed: ${error.message}`);
  return data ? fromRow(data as StoredCandidate) : null;
}

export async function updateCandidateStatus(
  id: string,
  status: CandidateStatus,
  reviewedBy?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const update: Record<string, unknown> = {
    status,
    reviewed_at: new Date().toISOString(),
  };
  if (reviewedBy) update.reviewed_by = reviewedBy;
  const { error } = await supabase
    .from("ingestion_candidates")
    .update(update)
    .eq("id", id);
  if (error) throw new Error(`Update candidate failed: ${error.message}`);
}

export async function getCandidateStats(): Promise<Record<CandidateStatus, number>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ingestion_candidates")
    .select("status");
  if (error) throw new Error(`Stats failed: ${error.message}`);
  const counts: Record<string, number> = {
    pending: 0,
    duplicate: 0,
    promoted: 0,
    dismissed: 0,
  };
  for (const r of data ?? []) {
    const s = r.status as CandidateStatus;
    if (s in counts) counts[s]++;
  }
  return counts as Record<CandidateStatus, number>;
}
