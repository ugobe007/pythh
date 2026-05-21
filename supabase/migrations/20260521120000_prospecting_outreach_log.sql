-- Prospecting Outreach Log
-- Tracks every marketing/prospecting email sent by the outreach agent.
-- Prevents duplicate sends and enables reporting on campaign performance.

create table if not exists public.pythh_prospecting_log (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Who we contacted
  email             text not null,
  email_type        text not null,  -- 'vc_leads' | 'startup_matches'
  target_id         text,           -- investor.id or startup.id (as text for flexibility)

  -- What we sent
  subject           text,
  resend_message_id text,
  sent_at           timestamptz not null default now(),

  -- Tracking
  opened_at         timestamptz,
  clicked_at        timestamptz,
  bounced_at        timestamptz,
  unsubscribed_at   timestamptz,

  -- Campaign metadata
  campaign_slug     text,           -- e.g. 'vc-may-2026', 'startup-weekly-01'
  notes             text
);

create index if not exists idx_prosp_log_email      on public.pythh_prospecting_log (email);
create index if not exists idx_prosp_log_type       on public.pythh_prospecting_log (email_type);
create index if not exists idx_prosp_log_sent       on public.pythh_prospecting_log (sent_at desc);
create index if not exists idx_prosp_log_campaign   on public.pythh_prospecting_log (campaign_slug);

-- Unique constraint: don't send same email type to same address more than once per campaign
create unique index if not exists idx_prosp_log_unique_send
  on public.pythh_prospecting_log (email, email_type, coalesce(campaign_slug, ''));

comment on table public.pythh_prospecting_log is
  'Tracks every prospecting email sent by the outreach agent — prevents duplicates and enables campaign analytics';
comment on column public.pythh_prospecting_log.email_type is
  'vc_leads = email to VC firm with top startup matches; startup_matches = email to startup with their investor matches';
comment on column public.pythh_prospecting_log.campaign_slug is
  'Optional slug identifying the campaign batch, e.g. vc-may-2026';
