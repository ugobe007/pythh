-- Founder-advice quotes and the page they came from.
-- Spoken lines only. Generated "Invested in A and B" rows stay out.

alter table public.investor_quotes drop constraint if exists investor_quotes_kind_check;

alter table public.investor_quotes
  add constraint investor_quotes_kind_check
  check (kind in ('investing_in', 'invested_in', 'looking_for', 'founder_advice'));

alter table public.investor_quotes
  add column if not exists source_url text;
