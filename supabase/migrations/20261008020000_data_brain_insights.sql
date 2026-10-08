-- Daily insight pack from the data brain.
-- One row per UTC day. The matcher reads the newest pack.
-- GOD component weights are not stored here and are not changed by this table.

create table if not exists public.data_brain_insights (
  insight_date date primary key,
  pack jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.data_brain_insights enable row level security;

notify pgrst, 'reload schema';

comment on table public.data_brain_insights is
  'Daily trends, keywords, and match terms learned from stored startups, signals, and spoken quotes.';
