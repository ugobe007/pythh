begin;

alter table public.pythh_pipeline_runs add column if not exists startup_id uuid references public.startup_uploads(id) on delete set null;
alter table public.pythh_outreach_emails add column if not exists startup_id uuid references public.startup_uploads(id) on delete set null;
alter table public.pythh_outreach_emails add column if not exists investor_id uuid references public.investors(id) on delete set null;
alter table public.pythh_meetings add column if not exists startup_id uuid references public.startup_uploads(id) on delete set null;
alter table public.pythh_meetings add column if not exists investor_id uuid references public.investors(id) on delete set null;
alter table public.pythh_fundraising_outcomes add column if not exists startup_id uuid references public.startup_uploads(id) on delete set null;
alter table public.pythh_fundraising_outcomes add column if not exists investor_id uuid references public.investors(id) on delete set null;

create index if not exists idx_pythh_outreach_identity on public.pythh_outreach_emails(startup_id, investor_id) where startup_id is not null and investor_id is not null;
create index if not exists idx_pythh_fundraising_identity on public.pythh_fundraising_outcomes(startup_id, investor_id, occurred_at desc) where startup_id is not null and investor_id is not null;
create unique index if not exists uq_match_outcomes_fundraising_origin
  on public.match_outcomes ((metadata->>'fundraising_outcome_id'))
  where metadata ? 'fundraising_outcome_id';

-- Existing name/firm-only records remain unlinked. Identity is never guessed.
-- A separately reviewed backfill may link historical rows only from deterministic IDs.

create or replace function public.promote_verified_fundraising_outcome()
returns trigger language plpgsql security definer set search_path=public as $$
declare mapped_type text;
begin
  if new.verified <> 1 or new.startup_id is null or new.investor_id is null then return new; end if;
  mapped_type := case new.event_type
    when 'outreach_sent' then 'outreach_sent'
    when 'reply_received' then 'replied'
    when 'meeting_confirmed' then 'meeting_booked'
    when 'diligence_started' then 'diligence'
    when 'term_sheet_received' then 'term_sheet'
    when 'capital_committed' then 'funded'
    else null end;
  if mapped_type is null then return new; end if;
  insert into public.match_outcomes(startup_id, investor_id, outcome_type, occurred_at, verified, source, metadata)
  values (new.startup_id, new.investor_id, mapped_type, new.occurred_at, true, 'pythh_fundraising_outcomes',
    jsonb_build_object('fundraising_outcome_id', new.id::text, 'event_type', new.event_type, 'source', new.source))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists trg_promote_verified_fundraising_outcome on public.pythh_fundraising_outcomes;
create trigger trg_promote_verified_fundraising_outcome
after insert or update of verified, startup_id, investor_id on public.pythh_fundraising_outcomes
for each row execute function public.promote_verified_fundraising_outcome();

create or replace view public.pythh_fundraising_movement as
select startup_id, investor_id,
  max(case event_type when 'outreach_sent' then 1 when 'reply_received' then 2 when 'meeting_confirmed' then 3 when 'diligence_started' then 4 when 'term_sheet_received' then 5 when 'capital_committed' then 6 else 0 end) as movement_stage,
  max(occurred_at) as last_movement_at,
  count(*) filter (where verified=1) as verified_events,
  bool_or(event_type='capital_committed' and verified=1) as funded
from public.pythh_fundraising_outcomes
where startup_id is not null and investor_id is not null
group by startup_id, investor_id;

commit;
