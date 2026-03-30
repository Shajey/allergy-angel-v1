-- ============================================================
-- O8.1 — Runtime promoted registry (shared truth for UI + resolver)
-- Apply in Supabase SQL Editor. Idempotent.
-- ============================================================

CREATE TABLE IF NOT EXISTS promoted_registry_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_type TEXT NOT NULL CHECK (registry_type IN ('drug', 'supplement', 'food')),
  canonical_id TEXT NOT NULL,
  entity_json JSONB NOT NULL,
  source_proposal_id UUID,
  promoted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (registry_type, canonical_id)
);

CREATE INDEX IF NOT EXISTS idx_promoted_registry_type
  ON promoted_registry_entities (registry_type);

COMMENT ON TABLE promoted_registry_entities IS
  'O8.1 — CanonicalEntity snapshots applied on Governed promotion; merged with static registries at runtime.';
