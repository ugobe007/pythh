-- mcp_api_keys: API keys for Pythh Connect MCP server
-- Tiers: free (20/day), pro (unlimited), enterprise (unlimited + white-label)
-- Keys are prefixed: pc_live_ (production), pc_test_ (dev/staging)

create table if not exists public.mcp_api_keys (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- The actual key value (hashed in a future iteration; plain for v1)
  key              text not null unique,

  -- Owner
  owner_email      text,
  stripe_customer_id text,

  -- Tier: free | pro | enterprise
  tier             text not null default 'free'
                   check (tier in ('free', 'pro', 'enterprise')),

  -- Daily usage tracking (reset by nightly cron or pg_cron)
  calls_today      integer not null default 0,
  daily_limit      integer not null default 20,  -- 20 for free, 0 = unlimited for pro/enterprise
  calls_total      bigint not null default 0,

  -- Status
  active           boolean not null default true,
  revoked_at       timestamptz,
  notes            text
);

-- Index for fast key lookup on every MCP request
create index if not exists mcp_api_keys_key_idx on public.mcp_api_keys (key);
create index if not exists mcp_api_keys_active_idx on public.mcp_api_keys (active) where active = true;

-- Updated_at trigger
create or replace function public.set_mcp_key_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists mcp_api_keys_updated_at on public.mcp_api_keys;
create trigger mcp_api_keys_updated_at
  before update on public.mcp_api_keys
  for each row execute function public.set_mcp_key_updated_at();

-- RPC to safely increment usage (avoids race conditions)
create or replace function public.increment_mcp_key_usage(key_id uuid)
returns void language plpgsql security definer as $$
begin
  update public.mcp_api_keys
  set
    calls_today = calls_today + 1,
    calls_total = calls_total + 1
  where id = key_id and active = true;
end;
$$;

-- RPC to reset daily counters (call via pg_cron at midnight UTC)
create or replace function public.reset_mcp_daily_usage()
returns void language plpgsql security definer as $$
begin
  update public.mcp_api_keys set calls_today = 0 where active = true;
end;
$$;

-- RLS: service role only (MCP server uses service key)
alter table public.mcp_api_keys enable row level security;

create policy "service role full access"
  on public.mcp_api_keys
  for all
  to service_role
  using (true)
  with check (true);

-- Seed a test free key for local dev
insert into public.mcp_api_keys (key, tier, owner_email, daily_limit, notes)
values ('pc_test_free_localdev', 'free', 'dev@pythh.ai', 20, 'Local development free key')
on conflict (key) do nothing;
