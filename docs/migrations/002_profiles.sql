-- ============================================================
-- Phase 9A – Profile Foundation
-- Run this against your Supabase project (SQL Editor → New Query)
--
-- Creates the profiles table and seeds a default "Amber" profile.
-- Existing tables (checks, health_events, raw_inputs) are NOT modified.
--
-- Idempotency: uses IF NOT EXISTS and ON CONFLICT so the script
-- can be re-run safely without duplicating data.
-- ============================================================

-- ── profiles ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name          text        NOT NULL,
  known_allergies       text[]      NOT NULL DEFAULT '{}',
  current_medications   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

-- Index for quick lookup by display_name
CREATE INDEX IF NOT EXISTS idx_profiles_display_name
  ON profiles (display_name);

-- ── Seed: default "Amber" profile ──────────────────────────
-- Uses a fixed UUID so DEFAULT_PROFILE_ID can reference it and
-- re-running this migration won't create duplicates.
INSERT INTO profiles (id, display_name, known_allergies, current_medications)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Amber',
  ARRAY['peanuts', 'tree nuts'],
  '[{"name": "Zyrtec", "dosage": "10mg"}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
