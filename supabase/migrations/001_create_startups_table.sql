-- Version 001 / create_startups_table (legacy; listed on production migration history).
-- Supabase Dashboard often has no stored SQL for these rows ("View migration SQL" → undefined).
-- Source: earliest `startups` definition in repo `supabase-complete-schema.sql` (Part 1 core tables).
-- Audit: idempotent CREATE only; safe if production already applied 001; aligns GitHub branching with remote version.

CREATE TABLE IF NOT EXISTS public.startups (
  id TEXT PRIMARY KEY DEFAULT (gen_random_uuid()::text),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  validated BOOLEAN NOT NULL DEFAULT false
);
