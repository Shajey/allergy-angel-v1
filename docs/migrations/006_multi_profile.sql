-- ============================================================
-- Phase 16 – Multi-Profile Foundation
-- Run this against your Supabase project (SQL Editor → New Query)
--
-- Extends existing profiles table. Does NOT create new tables.
-- profile_medications, profile_supplements, profile_allergies do NOT exist;
-- data lives in profiles columns (known_allergies, current_medications, supplements).
--
-- Idempotency: uses ADD COLUMN IF NOT EXISTS, safe to re-run.
-- ============================================================

-- Add is_primary column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT false;

-- Add updated_at column
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Index for primary profile lookup
CREATE INDEX IF NOT EXISTS idx_profiles_is_primary
  ON profiles (is_primary) WHERE is_primary = true;

-- Backfill: Set existing Amber profile as primary
UPDATE profiles
  SET is_primary = true
  WHERE id = 'a0000000-0000-0000-0000-000000000001';

-- Ensure at least one primary exists (guard for empty DB)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE is_primary = true) THEN
    UPDATE profiles
      SET is_primary = true
      WHERE id = (SELECT id FROM profiles ORDER BY created_at ASC LIMIT 1);
  END IF;
END $$;
