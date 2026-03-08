-- ============================================================
-- Phase 21c – Alias Proposal Storage (Draft Only)
-- Run this against your Supabase project (SQL Editor → New Query)
--
-- These proposals do NOT affect runtime inference.
-- They are staging records for governed alias changes.
--
-- Idempotency: uses IF NOT EXISTS, safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS alias_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_type TEXT NOT NULL CHECK (registry_type IN ('drug', 'supplement', 'food')),
  canonical_id TEXT NOT NULL,
  proposed_alias TEXT NOT NULL,
  proposal_action TEXT NOT NULL CHECK (proposal_action IN ('add-alias', 'remove-alias', 'create-entry')),
  proposed_entry JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'exported', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by TEXT,
  notes TEXT
);

-- Prevent duplicate pending proposals for same alias
CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_proposals_pending_unique
  ON alias_proposals (registry_type, canonical_id, proposed_alias, proposal_action)
  WHERE status = 'pending';

-- Index for listing by type and status
CREATE INDEX IF NOT EXISTS idx_alias_proposals_registry_status
  ON alias_proposals (registry_type, status);
