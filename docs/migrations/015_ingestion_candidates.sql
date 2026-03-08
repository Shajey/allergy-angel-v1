-- ============================================================
-- Phase 24.1 – Ingestion Candidates (Staging)
-- Run after 014_research_cache.sql
--
-- Staged candidates from external ingestion (e.g. RxNorm).
-- No direct registry writes. Governed proposal flow only.
-- ============================================================

CREATE TABLE IF NOT EXISTS ingestion_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  canonical_id TEXT NOT NULL,
  registry_type TEXT NOT NULL CHECK (registry_type IN ('drug', 'supplement', 'food')),
  candidate_type TEXT NOT NULL CHECK (candidate_type IN ('entity', 'alias', 'class_assignment')),

  name TEXT NOT NULL,
  aliases JSONB NOT NULL DEFAULT '[]',

  class TEXT,

  source_dataset TEXT NOT NULL,
  source_version TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_url TEXT,

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'duplicate', 'promoted', 'dismissed')),
  matched_existing JSONB,

  ingested_at TIMESTAMP DEFAULT now(),
  reviewed_at TIMESTAMP,
  reviewed_by TEXT,

  UNIQUE (source_dataset, source_record_id)
);

CREATE INDEX IF NOT EXISTS idx_ingestion_candidates_status
  ON ingestion_candidates (status);

CREATE INDEX IF NOT EXISTS idx_ingestion_candidates_registry_type
  ON ingestion_candidates (registry_type);
