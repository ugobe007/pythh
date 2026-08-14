-- Timestamped forward-only foundation for startup/investor video evidence.
-- Store source metadata and transcript-derived evidence only. Never store
-- third-party audiovisual bytes unless rights_status is owned or licensed.

create table if not exists public.profile_video_sources (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('startup', 'investor')),
  entity_id uuid not null,
  platform text not null check (platform in ('youtube', 'vimeo', 'owned')),
  external_video_id text not null,
  source_url text not null,
  embed_url text,
  title text,
  channel_name text,
  thumbnail_url text,
  published_at timestamptz,
  duration_seconds integer,
  content_type text not null check (content_type in ('demo', 'founder_interview', 'investor_interview', 'investment_thesis', 'portfolio_commentary', 'other')),
  rights_status text not null default 'embed_only' check (rights_status in ('embed_only', 'owned', 'licensed')),
  resolution_status text not null default 'candidate' check (resolution_status in ('candidate', 'verified', 'rejected', 'stale')),
  resolution_confidence numeric(4,3) not null default 0 check (resolution_confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  last_refreshed_at timestamptz not null default now(),
  refresh_due_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, external_video_id, entity_type, entity_id)
);

create table if not exists public.profile_video_snippets (
  id uuid primary key default gen_random_uuid(),
  video_source_id uuid not null references public.profile_video_sources(id) on delete cascade,
  entity_type text not null check (entity_type in ('startup', 'investor')),
  entity_id uuid not null,
  start_seconds integer not null check (start_seconds >= 0),
  end_seconds integer not null check (end_seconds > start_seconds and end_seconds - start_seconds <= 90),
  transcript_excerpt text not null check (char_length(transcript_excerpt) between 1 and 1200),
  evidence_type text not null check (evidence_type in (
    'product_demo', 'product_capability', 'customer_problem', 'traction_claim',
    'team_claim', 'market_claim', 'fundraising_claim', 'investment_thesis',
    'stage_preference', 'sector_preference', 'check_size', 'geography_preference',
    'portfolio_reasoning', 'timing_signal', 'other'
  )),
  normalized_claim jsonb not null default '{}'::jsonb,
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  verification_status text not null default 'pending' check (verification_status in ('pending', 'verified', 'rejected', 'superseded')),
  extractor_version text not null,
  evidence_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profile_video_sources_entity
  on public.profile_video_sources (entity_type, entity_id, resolution_status, published_at desc);
create index if not exists idx_profile_video_sources_refresh
  on public.profile_video_sources (refresh_due_at) where resolution_status in ('candidate', 'verified');
create index if not exists idx_profile_video_snippets_entity
  on public.profile_video_snippets (entity_type, entity_id, evidence_type, verification_status);
create index if not exists idx_profile_video_snippets_claim
  on public.profile_video_snippets using gin (normalized_claim);

alter table public.profile_video_sources enable row level security;
alter table public.profile_video_snippets enable row level security;

drop policy if exists profile_video_sources_public_verified_read on public.profile_video_sources;
create policy profile_video_sources_public_verified_read on public.profile_video_sources
  for select using (resolution_status = 'verified');

drop policy if exists profile_video_snippets_public_verified_read on public.profile_video_snippets;
create policy profile_video_snippets_public_verified_read on public.profile_video_snippets
  for select using (verification_status = 'verified');

comment on table public.profile_video_sources is
  'Fresh, attributable video metadata for startup and investor profiles. Third-party audiovisual content remains on the source platform.';
comment on table public.profile_video_snippets is
  'Timestamped transcript-derived evidence and normalized graph claims; not stored video clips.';
