-- ================================================================
-- STARTUP SIGNAL HISTORY (Daily Progress Visibility)
-- ================================================================
-- Purpose: Track Power Score, Signal Strength, Readiness, Window over time
-- Enables: "+4 today" deltas, sparklines, "Forming → Prime" transitions
-- Addiction mechanic: Founders check every morning to see progress

-- 1) Create table
create table if not exists public.startup_signal_history (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startup_uploads(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  
  -- Core metrics
  signal_strength int not null check (signal_strength >= 0 and signal_strength <= 100),
  readiness int not null check (readiness >= 0 and readiness <= 100),
  power_score int not null check (power_score >= 0 and power_score <= 100),
  fundraising_window text not null check (fundraising_window in ('Too Early','Forming','Prime','Cooling')),
  
  -- Metadata
  source text not null default 'scan', -- 'scan' | 'cron' | 'admin'
  meta jsonb not null default '{}'::jsonb
);

-- 2) Indexes for fast queries
create index if not exists startup_signal_history_startup_id_recorded_at_idx
  on public.startup_signal_history (startup_id, recorded_at desc);

-- 3) Create immutable function for date truncation (required for unique index)
create or replace function public.immutable_date_trunc_day(timestamptz)
returns date as $$
  select date_trunc('day', $1)::date;
$$ language sql immutable;

-- 4) Dedupe rule: Only 1 entry per day per startup
-- This prevents spam if founder scans 12 times/day
-- Note: If you want multiple points per day later, remove this index
create unique index if not exists startup_signal_history_unique_day
  on public.startup_signal_history (startup_id, immutable_date_trunc_day(recorded_at));

-- 5) Row Level Security (RLS)
alter table public.startup_signal_history enable row level security;

-- Allow founder to read their own startup history
create policy "read own startup history"
on public.startup_signal_history
for select
using (
  exists (
    select 1
    from public.startup_uploads s
    where s.id = startup_signal_history.startup_id
      and s.submitted_by = auth.uid()
  )
);

-- Allow founder to insert history rows for their own startup
create policy "insert own startup history"
on public.startup_signal_history
for insert
with check (
  exists (
    select 1
    from public.startup_uploads s
    where s.id = startup_signal_history.startup_id
      and s.submitted_by = auth.uid()
  )
);

-- 6) Helper function for server-side upsert (prevents duplicates)
-- Usage: SELECT upsert_signal_history($1, $2, $3, $4, $5, $6, $7);
create or replace function public.upsert_signal_history(
  p_startup_id uuid,
  p_signal_strength int,
  p_readiness int,
  p_power_score int,
  p_fundraising_window text,
  p_source text default 'scan',
  p_meta jsonb default '{}'::jsonb
) returns uuid as $$
declare
  v_id uuid;
begin
  insert into public.startup_signal_history (
    startup_id, signal_strength, readiness, power_score, 
    fundraising_window, source, meta
  )
  values (
    p_startup_id, p_signal_strength, p_readiness, p_power_score,
    p_fundraising_window, p_source, p_meta
  )
  on conflict (startup_id, immutable_date_trunc_day(recorded_at))
  do update set
    signal_strength = excluded.signal_strength,
    readiness = excluded.readiness,
    power_score = excluded.power_score,
    fundraising_window = excluded.fundraising_window,
    source = excluded.source,
    meta = excluded.meta,
    recorded_at = now()
  returning id into v_id;
  
  return v_id;
end;
$$ language plpgsql security definer;

-- ================================================================
-- DONE: Run this in Supabase SQL Editor
-- Next: Create GET /api/startups/:id/signal-history endpoint
-- ================================================================
