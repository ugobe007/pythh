create table if not exists public.angel_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  network_type text not null default 'angel_group',
  city text,
  state text,
  metro_area text,
  region text,
  website text,
  application_url text,
  meeting_frequency text,
  typical_check_min bigint,
  typical_check_max bigint,
  syndicate_size_min bigint,
  syndicate_size_max bigint,
  member_count integer,
  industries text[] not null default '{}',
  preferred_stages text[] not null default '{}',
  geographic_preference text,
  due_diligence_days_min integer,
  due_diligence_days_max integer,
  leads_investments boolean,
  notes text,
  verification_status text not null default 'research_queue',
  confidence numeric(4,3),
  source_url text,
  last_verified_at timestamptz,
  next_verify_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.angel_people (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  linkedin_url text,
  personal_thesis text,
  industries text[] not null default '{}',
  check_size_min bigint,
  check_size_max bigint,
  previous_exits jsonb not null default '[]'::jsonb,
  university_affiliations text[] not null default '{}',
  board_memberships text[] not null default '{}',
  source_url text,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (full_name, linkedin_url)
);

create table if not exists public.angel_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.angel_organizations(id) on delete cascade,
  person_id uuid not null references public.angel_people(id) on delete cascade,
  role_type text not null,
  title text,
  sector_focus text[] not null default '{}',
  started_at date,
  ended_at date,
  is_current boolean not null default true,
  source_url text not null,
  last_verified_at timestamptz,
  unique (organization_id, person_id, role_type, started_at)
);

create table if not exists public.angel_pitch_cycles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.angel_organizations(id) on delete cascade,
  name text not null,
  meeting_date timestamptz,
  application_deadline timestamptz,
  application_fee_cents integer,
  application_url text,
  deck_requirements jsonb not null default '{}'::jsonb,
  eligibility jsonb not null default '{}'::jsonb,
  schedule_status text not null default 'verification_required',
  source_url text not null,
  last_verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.angel_investments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.angel_organizations(id) on delete cascade,
  person_id uuid references public.angel_people(id) on delete set null,
  startup_id uuid references public.startup_uploads(id) on delete set null,
  startup_name text not null,
  announced_at date,
  round_stage text,
  amount_usd bigint,
  lead_investor boolean,
  co_investors text[] not null default '{}',
  source_url text not null,
  confidence numeric(4,3),
  created_at timestamptz not null default now()
);

create table if not exists public.angel_relationships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.angel_organizations(id) on delete cascade,
  related_type text not null,
  related_name text not null,
  relationship_type text not null,
  evidence_date date,
  source_url text not null,
  confidence numeric(4,3),
  created_at timestamptz not null default now(),
  unique (organization_id, related_type, related_name, relationship_type, source_url)
);

create index if not exists angel_organizations_geo_idx on public.angel_organizations(state, region);
create index if not exists angel_organizations_industries_idx on public.angel_organizations using gin(industries);
create index if not exists angel_organizations_stages_idx on public.angel_organizations using gin(preferred_stages);
create index if not exists angel_roles_org_current_idx on public.angel_roles(organization_id, is_current);
create index if not exists angel_pitch_cycles_deadline_idx on public.angel_pitch_cycles(application_deadline);
create index if not exists angel_investments_org_date_idx on public.angel_investments(organization_id, announced_at desc);

alter table public.angel_organizations enable row level security;
alter table public.angel_people enable row level security;
alter table public.angel_roles enable row level security;
alter table public.angel_pitch_cycles enable row level security;
alter table public.angel_investments enable row level security;
alter table public.angel_relationships enable row level security;

create policy "verified angel organizations are publicly readable" on public.angel_organizations
  for select using (verification_status = 'source_backed');
create policy "verified angel pitch cycles are publicly readable" on public.angel_pitch_cycles
  for select using (schedule_status <> 'unverified');
