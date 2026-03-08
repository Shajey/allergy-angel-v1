-- ============================================================
-- Phase 22.4 – Combination Safety Signal
-- Run after 010_knowledge_radar.sql (and 011, 012 if present)
--
-- Adds safe_occurrence_count to distinguish:
--   - repeated risky combinations (emerging_risk)
--   - repeated safe/common combinations (mostly_safe)
-- ============================================================

ALTER TABLE unknown_combination_daily
ADD COLUMN IF NOT EXISTS safe_occurrence_count INTEGER NOT NULL DEFAULT 0;
