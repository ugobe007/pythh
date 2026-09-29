-- Rotating investor quotes for the homepage, Daily Signal, and founder outreach.
-- Filled from investment_thesis and notable_investments. No model writes these rows.

create table if not exists public.investor_quotes (
  id uuid primary key default gen_random_uuid(),
  investor_id uuid,
  firm text not null,
  speaker text,
  kind text not null check (kind in ('investing_in', 'invested_in', 'looking_for')),
  quote text not null,
  source text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (investor_id, kind, quote)
);

create index if not exists investor_quotes_active_created_idx
  on public.investor_quotes (created_at desc)
  where active;

alter table public.investor_quotes enable row level security;

drop policy if exists investor_quotes_public_read on public.investor_quotes;
create policy investor_quotes_public_read
  on public.investor_quotes
  for select
  to anon, authenticated
  using (active = true);
