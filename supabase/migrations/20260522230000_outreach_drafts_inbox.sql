-- Outreach drafts, web inbox, and reply tracking

alter table public.pythh_prospecting_log
  add column if not exists status text not null default 'sent',
  add column if not exists html_body text,
  add column if not exists text_body text,
  add column if not exists actual_recipient text,
  add column if not exists target_name text,
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by text;

comment on column public.pythh_prospecting_log.status is
  'draft = awaiting review; sent = delivered; failed = send error';

-- Allow multiple drafts per campaign; dedup only on sent rows
drop index if exists idx_prosp_log_unique_send;
create unique index if not exists idx_prosp_log_unique_send
  on public.pythh_prospecting_log (email, email_type, coalesce(campaign_slug, ''))
  where status = 'sent';

create index if not exists idx_prosp_log_status
  on public.pythh_prospecting_log (status, sent_at desc);

-- Inbound replies (Resend inbound webhook or manual forward)
create table if not exists public.pythh_outreach_replies (
  id                      uuid primary key default gen_random_uuid(),
  created_at              timestamptz not null default now(),
  from_email              text not null,
  to_email                text,
  subject                 text,
  text_body               text,
  html_body               text,
  in_reply_to_message_id  text,
  prospecting_log_id      uuid references public.pythh_prospecting_log(id) on delete set null,
  read_at                 timestamptz
);

create index if not exists idx_outreach_replies_created
  on public.pythh_outreach_replies (created_at desc);

create index if not exists idx_outreach_replies_unread
  on public.pythh_outreach_replies (read_at) where read_at is null;
