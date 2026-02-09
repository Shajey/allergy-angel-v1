-- ============================================================
-- Phase 9B – Deterministic Risk Interpretation
-- Run this against your Supabase project (SQL Editor → New Query)
--
-- Adds a verdict JSONB column to the checks table so that each
-- extraction run stores its deterministic risk assessment.
-- The verdict is computed at persist-time by comparing extracted
-- events against the user's profile (known_allergies, medications).
--
-- Idempotency: uses ADD COLUMN IF NOT EXISTS so the script can
-- be re-run safely.
-- ============================================================

ALTER TABLE checks
  ADD COLUMN IF NOT EXISTS verdict jsonb NOT NULL DEFAULT '{}'::jsonb;
