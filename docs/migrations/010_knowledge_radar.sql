-- ============================================================
-- Phase 22 – Knowledge Radar (Persistent Telemetry)
-- Run this against your Supabase project (SQL Editor → New Query)
--
-- Daily-bucketed telemetry for unknown entities and combinations.
-- No profile_id, user_id, check_id, raw text, or timestamp precision.
--
-- Idempotency: uses IF NOT EXISTS, safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS unknown_entity_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('medication', 'supplement', 'food', 'unknown')),
  day DATE NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  high_risk_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (entity, entity_type, day)
);

CREATE INDEX IF NOT EXISTS idx_unknown_entity_daily_day
  ON unknown_entity_daily (day);

CREATE INDEX IF NOT EXISTS idx_unknown_entity_daily_entity_type
  ON unknown_entity_daily (entity_type);

-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unknown_combination_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_a TEXT NOT NULL,
  entity_a_type TEXT NOT NULL,
  entity_b TEXT NOT NULL,
  entity_b_type TEXT NOT NULL,
  combination_type TEXT NOT NULL CHECK (combination_type IN (
    'drug_supplement',
    'drug_drug',
    'drug_food',
    'supplement_supplement',
    'supplement_food',
    'food_food',
    'other'
  )),
  day DATE NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  high_risk_count INTEGER NOT NULL DEFAULT 0,
  UNIQUE (entity_a, entity_a_type, entity_b, entity_b_type, day)
);

CREATE INDEX IF NOT EXISTS idx_unknown_combination_daily_day
  ON unknown_combination_daily (day);

CREATE INDEX IF NOT EXISTS idx_unknown_combination_daily_type
  ON unknown_combination_daily (combination_type);
