-- ============================================================
-- Phase 22.1 – Knowledge Radar Context + Combination Types
-- Run after 010_knowledge_radar.sql
--
-- Required for: gap type, context labels, drug_unknown pairings.
-- Adds context counters and new combination types.
-- Idempotent: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where supported.
-- ============================================================

-- Context counters for unknown entities (privacy-safe domain counts)
ALTER TABLE unknown_entity_daily
  ADD COLUMN IF NOT EXISTS context_medication_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS context_supplement_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS context_food_count INTEGER DEFAULT 0;

-- Expand combination_type to include unknown+known pairings
ALTER TABLE unknown_combination_daily
  DROP CONSTRAINT IF EXISTS unknown_combination_daily_combination_type_check;

ALTER TABLE unknown_combination_daily
  ADD CONSTRAINT unknown_combination_daily_combination_type_check
  CHECK (combination_type IN (
    'drug_supplement',
    'drug_drug',
    'drug_food',
    'supplement_supplement',
    'supplement_food',
    'food_food',
    'drug_unknown',
    'supplement_unknown',
    'food_unknown',
    'other'
  ));
