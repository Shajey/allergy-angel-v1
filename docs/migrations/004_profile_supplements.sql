-- ============================================================
-- Phase 9C+ – Add supplements column to profiles
-- Run this against your Supabase project (SQL Editor → New Query)
--
-- Adds a supplements text[] column so the Profile UI can persist
-- all three item types (allergies, medications, supplements).
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS supplements text[] NOT NULL DEFAULT '{}';
