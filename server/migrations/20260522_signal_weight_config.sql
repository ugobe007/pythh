-- Signal weight admin config — dimension caps, class weights, feed priority
-- Single-row active config + append-only history

create table if not exists public.signal_weight_config (
  id int primary key default 1 check (id = 1),
  config jsonb not null default '{}'::jsonb,
  version text not null default 'signals_v1',
  updated_at timestamptz not null default now(),
  updated_by text
);

insert into public.signal_weight_config (id, config, version)
values (1, '{}'::jsonb, 'signals_v1')
on conflict (id) do nothing;

create table if not exists public.signal_weight_history (
  id bigserial primary key,
  config jsonb not null,
  version text,
  comment text,
  created_at timestamptz not null default now(),
  created_by text
);

create index if not exists idx_signal_weight_history_created
  on public.signal_weight_history (created_at desc);
