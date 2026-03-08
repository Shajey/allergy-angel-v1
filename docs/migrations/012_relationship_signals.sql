-- ============================================================
-- Phase 22.2 – Knowledge Relationship Signals
-- Run after 011_knowledge_radar_context.sql
--
-- Tracks repeated entity pairs across checks (privacy-safe).
-- No profile_id, no raw text, date only.
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_relationship_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  entity_a TEXT NOT NULL,
  entity_a_type TEXT,

  entity_b TEXT NOT NULL,
  entity_b_type TEXT,

  relationship_type TEXT NOT NULL,

  occurrence_count INTEGER DEFAULT 1,

  context_medication_count INTEGER DEFAULT 0,
  context_supplement_count INTEGER DEFAULT 0,
  context_food_count INTEGER DEFAULT 0,

  first_seen DATE DEFAULT CURRENT_DATE,
  last_seen DATE DEFAULT CURRENT_DATE,

  UNIQUE(entity_a, entity_b, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_relationship_signals_relationship_type
  ON knowledge_relationship_signals (relationship_type);

CREATE INDEX IF NOT EXISTS idx_relationship_signals_last_seen
  ON knowledge_relationship_signals (last_seen);
