create table if not exists public.angel_source_state (
  id uuid primary key default gen_random_uuid(),
  organization_slug text not null,
  source_url text not null unique,
  source_kind text not null default 'official_website',
  content_hash text,
  page_title text,
  text_excerpt text,
  etag text,
  last_modified text,
  http_status integer,
  checked_at timestamptz not null default now(),
  changed_at timestamptz,
  next_check_at timestamptz,
  failure_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.angel_intelligence_signals (
  id uuid primary key default gen_random_uuid(),
  organization_slug text not null,
  signal_type text not null,
  signal_date date,
  headline text not null,
  evidence_excerpt text,
  source_url text not null,
  evidence_hash text not null unique,
  confidence numeric(4,3) not null default 0.700,
  verification_status text not null default 'candidate',
  detected_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.angel_intelligence_review_queue (
  id uuid primary key default gen_random_uuid(),
  organization_slug text not null,
  candidate_type text not null,
  candidate_key text not null,
  candidate_payload jsonb not null default '{}'::jsonb,
  source_url text not null,
  evidence_excerpt text,
  confidence numeric(4,3) not null default 0.500,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'superseded')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_slug, candidate_type, candidate_key)
);

create index if not exists angel_source_state_next_check_idx
  on public.angel_source_state(next_check_at, failure_count);
create index if not exists angel_signals_org_date_idx
  on public.angel_intelligence_signals(organization_slug, signal_date desc);
create index if not exists angel_review_queue_status_idx
  on public.angel_intelligence_review_queue(status, created_at desc);

alter table public.angel_source_state enable row level security;
alter table public.angel_intelligence_signals enable row level security;
alter table public.angel_intelligence_review_queue enable row level security;

create policy "verified angel signals are publicly readable"
  on public.angel_intelligence_signals for select
  using (verification_status = 'verified');

comment on table public.angel_source_state is
  'One compact current snapshot per approved public source; never stores raw page HTML.';
comment on table public.angel_intelligence_review_queue is
  'Human verification gate for newly detected people, roles, contacts, dates, and relationships.';
