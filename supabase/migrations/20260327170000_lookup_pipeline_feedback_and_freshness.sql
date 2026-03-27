-- Founder lookup pipeline + feedback + stale-data queue

create table if not exists public.founder_investor_pipeline (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investor_id uuid not null,
  state text not null check (state in ('Target', 'Contacted', 'Replied', 'Meeting')),
  note text,
  reminder_at timestamptz,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, investor_id)
);

create table if not exists public.founder_investor_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investor_id uuid not null,
  feedback text not null check (feedback in ('useful', 'not_useful')),
  context_sector text,
  created_at timestamptz not null default now(),
  unique(user_id, investor_id)
);

create table if not exists public.stale_data_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('investor', 'startup')),
  entity_id uuid not null,
  reason text not null,
  stale_days int not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  first_detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_type, entity_id, reason)
);

create table if not exists public.freshness_sla_targets (
  entity_type text primary key,
  max_age_days int not null,
  updated_at timestamptz not null default now()
);

insert into public.freshness_sla_targets(entity_type, max_age_days)
values ('investor', 30), ('startup', 14)
on conflict (entity_type) do update set
  max_age_days = excluded.max_age_days,
  updated_at = now();

alter table public.founder_investor_pipeline enable row level security;
alter table public.founder_investor_feedback enable row level security;
alter table public.stale_data_queue enable row level security;
alter table public.freshness_sla_targets enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='founder_investor_pipeline' and policyname='pipeline_select_own'
  ) then
    create policy pipeline_select_own on public.founder_investor_pipeline for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='founder_investor_pipeline' and policyname='pipeline_insert_own'
  ) then
    create policy pipeline_insert_own on public.founder_investor_pipeline for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='founder_investor_pipeline' and policyname='pipeline_update_own'
  ) then
    create policy pipeline_update_own on public.founder_investor_pipeline for update using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='founder_investor_feedback' and policyname='feedback_select_own'
  ) then
    create policy feedback_select_own on public.founder_investor_feedback for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='founder_investor_feedback' and policyname='feedback_insert_own'
  ) then
    create policy feedback_insert_own on public.founder_investor_feedback for insert with check (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='founder_investor_feedback' and policyname='feedback_update_own'
  ) then
    create policy feedback_update_own on public.founder_investor_feedback for update using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stale_data_queue' and policyname='stale_data_select_auth'
  ) then
    create policy stale_data_select_auth on public.stale_data_queue for select to authenticated using (true);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='stale_data_queue' and policyname='stale_data_write_service'
  ) then
    create policy stale_data_write_service on public.stale_data_queue for all to authenticated using (false) with check (false);
  end if;
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='freshness_sla_targets' and policyname='freshness_sla_select_auth'
  ) then
    create policy freshness_sla_select_auth on public.freshness_sla_targets for select to authenticated using (true);
  end if;
end $$;

grant select, insert, update on public.founder_investor_pipeline to authenticated;
grant select, insert, update on public.founder_investor_feedback to authenticated;
grant select on public.stale_data_queue to authenticated;
grant select on public.freshness_sla_targets to authenticated;
