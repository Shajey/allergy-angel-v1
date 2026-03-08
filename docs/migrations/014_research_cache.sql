-- ============================================================
-- Phase 23.1 – Research Cache
-- Run after 013_combination_safety_signal.sql
--
-- Caches LLM research outputs to avoid duplicate calls.
-- ============================================================

CREATE TABLE IF NOT EXISTS research_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  research_key TEXT NOT NULL UNIQUE,
  research_type TEXT NOT NULL CHECK (research_type IN ('entity', 'combination')),

  normalized_input JSONB NOT NULL,
  result JSONB NOT NULL,

  model TEXT,
  prompt_version TEXT,

  created_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_research_cache_key
  ON research_cache (research_key);
