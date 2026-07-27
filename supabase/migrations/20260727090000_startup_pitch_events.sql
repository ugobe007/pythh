create table if not exists public.startup_pitch_events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  organizer text not null,
  name text not null,
  description text,
  sectors text[] not null default '{}',
  stages text[] not null default '{}',
  location text,
  format text,
  schedule_status text not null default 'tba',
  schedule_label text,
  event_start_date date,
  event_end_date date,
  application_deadline timestamptz,
  application_fee_cents integer,
  application_fee_label text,
  application_url text not null,
  source_url text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'upcoming')),
  last_verified_at timestamptz,
  next_verify_at timestamptz,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists startup_pitch_events_status_deadline_idx
  on public.startup_pitch_events (status, application_deadline);
create index if not exists startup_pitch_events_sectors_idx
  on public.startup_pitch_events using gin (sectors);
create index if not exists startup_pitch_events_stages_idx
  on public.startup_pitch_events using gin (stages);

alter table public.startup_pitch_events enable row level security;

drop policy if exists "pitch events are publicly readable" on public.startup_pitch_events;
create policy "pitch events are publicly readable"
  on public.startup_pitch_events for select
  using (status in ('open', 'upcoming'));
