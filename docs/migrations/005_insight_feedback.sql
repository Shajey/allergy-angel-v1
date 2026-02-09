-- Phase 10F: Insight Feedback Loop
-- Stores per-profile votes on computed insights to adjust future ranking.
-- The unique index on (profile_id, insight_fingerprint) enables upsert so
-- only the latest vote per insight per profile is retained.

create table if not exists insight_feedback (
  id                   uuid        primary key default gen_random_uuid(),
  profile_id           text        not null,
  insight_fingerprint  text        not null,
  vote                 text        not null check (vote in ('relevant', 'not_relevant', 'unsure')),
  created_at           timestamptz not null default now()
);

-- Unique constraint enables ON CONFLICT … DO UPDATE (upsert)
create unique index if not exists idx_insight_feedback_profile_fingerprint
  on insight_feedback (profile_id, insight_fingerprint);
