-- ============================================================
-- Phase 7 – Memory Room: persistence tables
-- Run this against your Supabase project (SQL Editor → New Query)
--
-- MRD §9.2 – Contract Fidelity
-- These constraints enforce data-level guarantees required by the
-- MRD for both the "Amber" (caregiver) and "Zea" (child) personas:
--   • follow_up_questions must always be a JSONB array (never NULL
--     or an object) so the History UI can iterate without guards.
--   • confidence_score is an integer in [0, 100] matching the MRD
--     HealthEvent.confidenceScore contract (0–100 inclusive).
--
-- Idempotency: every statement uses IF NOT EXISTS or a guarded
-- DO $$…END$$ block so the script can be re-run safely.
-- ============================================================

-- ── raw_inputs (optional) ────────────────────────────────────
-- Only written when STORE_RAW_INPUTS=true.
CREATE TABLE IF NOT EXISTS raw_inputs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  text        NOT NULL,
  input_text  text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── checks ───────────────────────────────────────────────────
-- One row per "Check" – groups every event extracted from a single
-- user input.  This is the atomic unit that ties a raw_text, its
-- follow-up questions, and all resulting health_events together so
-- they can be replayed as one cohesive unit.
CREATE TABLE IF NOT EXISTS checks (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id           text        NOT NULL,
  raw_text             text        NOT NULL,
  follow_up_questions  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- ── health_events ────────────────────────────────────────────
-- One row per extracted HealthEvent, linked to its parent check.
CREATE TABLE IF NOT EXISTS health_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        text        NOT NULL,
  check_id          uuid        NOT NULL REFERENCES checks(id) ON DELETE CASCADE,
  raw_input_id      uuid        REFERENCES raw_inputs(id) ON DELETE SET NULL,
  event_type        text        NOT NULL,
  event_data        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  confidence_score  integer     NOT NULL DEFAULT 0,
  provenance        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ── CHECK constraints (idempotent via DO blocks) ─────────────

-- confidence_score must be 0–100 inclusive (MRD §9.2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_confidence_score_range'
  ) THEN
    ALTER TABLE health_events
      ADD CONSTRAINT chk_confidence_score_range
      CHECK (confidence_score >= 0 AND confidence_score <= 100);
  END IF;
END
$$;

-- follow_up_questions must be a JSONB array (MRD §9.2)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_follow_up_questions_is_array'
  ) THEN
    ALTER TABLE checks
      ADD CONSTRAINT chk_follow_up_questions_is_array
      CHECK (jsonb_typeof(follow_up_questions) = 'array');
  END IF;
END
$$;

-- ── Indexes for common query patterns ────────────────────────
CREATE INDEX IF NOT EXISTS idx_checks_profile
  ON checks (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_events_check
  ON health_events (check_id);

CREATE INDEX IF NOT EXISTS idx_health_events_profile
  ON health_events (profile_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_raw_inputs_profile
  ON raw_inputs (profile_id, created_at DESC);
