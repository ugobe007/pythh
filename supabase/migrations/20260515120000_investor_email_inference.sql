-- Investor Email Inference
-- Adds structured email candidate storage to the investors table.
-- Columns are additive (never drop existing data).

alter table public.investors
  add column if not exists email_domain        text,
  add column if not exists email_candidates    jsonb  default '[]'::jsonb,
  add column if not exists email_status        text   default 'pending',
  add column if not exists email_best_guess    text,
  add column if not exists email_has_mx        boolean,
  add column if not exists email_verified_at   timestamptz,
  add column if not exists email_enriched_at   timestamptz;

-- email_status values: 'pending' | 'inferred' | 'verified' | 'bounced' | 'unreachable'

create index if not exists idx_investors_email_status  on public.investors (email_status);
create index if not exists idx_investors_email_domain  on public.investors (email_domain);
create index if not exists idx_investors_email_pending on public.investors (email_status)
  where email_status = 'pending';

comment on column public.investors.email_domain     is 'Root sending domain extracted from investor URL';
comment on column public.investors.email_candidates is 'Ordered array of email candidate objects: [{address, type, confidence}]';
comment on column public.investors.email_status     is 'pending | inferred | verified | bounced | unreachable';
comment on column public.investors.email_best_guess is 'Top candidate address to use for outreach';
comment on column public.investors.email_has_mx     is 'True if domain has MX records (domain accepts email at all)';
comment on column public.investors.email_verified_at is 'Timestamp when email was confirmed deliverable (manual or SMTP check)';
comment on column public.investors.email_enriched_at is 'Timestamp when email inference last ran for this record';

-- Outreach tracking table — one row per startup-investor outreach attempt
create table if not exists public.investor_outreach (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  startup_id        uuid not null references public.startup_uploads(id) on delete cascade,
  investor_id       uuid not null references public.investors(id) on delete cascade,
  outreach_email    text not null,
  email_type        text not null default 'inferred',  -- 'inferred' | 'verified' | 'intake'
  subject           text,
  body_preview      text,                              -- first 500 chars of the email body
  resend_message_id text,                              -- Resend message ID for tracking
  status            text not null default 'draft',     -- 'draft' | 'approved' | 'sent' | 'opened' | 'replied' | 'bounced' | 'unsubscribed'
  opened_at         timestamptz,
  replied_at        timestamptz,
  bounced_at        timestamptz,
  sequence_step     int default 1,                     -- 1 = initial, 2 = follow-up 1, etc.
  parent_id         uuid references public.investor_outreach(id),  -- for follow-up threading
  approved_by       text,                              -- founder who approved the send
  approved_at       timestamptz,
  notes             text,
  metadata          jsonb default '{}'::jsonb
);

create index if not exists idx_outreach_startup   on public.investor_outreach (startup_id);
create index if not exists idx_outreach_investor  on public.investor_outreach (investor_id);
create index if not exists idx_outreach_status    on public.investor_outreach (status);
create index if not exists idx_outreach_created   on public.investor_outreach (created_at desc);

comment on table public.investor_outreach is
  'Tracks every outreach attempt from a startup to an investor — draft through reply';
