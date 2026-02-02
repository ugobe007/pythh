-- ============================================================================
-- GOD Guardrails v1 - Add-only, production-safe
-- Tables:
--   god_weight_versions (immutable)
--   god_runtime_config (single-row pointer + override + freeze)
--   god_score_explanations (debug payload per startup + version)
-- RPC:
--   get_god_runtime()
--   get_god_explain(startup_id, weights_version?)
-- ============================================================================

begin;

-- ---------- ENUM ----------
do $$ begin
  create type public.god_weight_status as enum ('active','deprecated','revoked');
exception when duplicate_object then null; end $$;

-- ---------- EXTENSIONS (for hashing) ----------
create extension if not exists pgcrypto;

-- ---------- TABLE: god_weight_versions ----------
create table if not exists public.god_weight_versions (
  weights_version text primary key,
  status public.god_weight_status not null default 'active',
  weights jsonb not null,
  weights_sha256 text not null,
  created_by text,
  created_at timestamptz not null default now(),
  comment text
);

-- Auto-hash weights on insert
create or replace function public.compute_god_weights_sha256()
returns trigger language plpgsql as $$
begin
  -- stable hash of the canonical json representation
  new.weights_sha256 := encode(digest(new.weights::text, 'sha256'), 'hex');
  return new;
end $$;

drop trigger if exists trg_compute_god_weights_sha256 on public.god_weight_versions;
create trigger trg_compute_god_weights_sha256
before insert on public.god_weight_versions
for each row execute function public.compute_god_weights_sha256();

-- Immutability: prevent UPDATE/DELETE
create or replace function public.guard_immutable_god_weights()
returns trigger language plpgsql as $$
begin
  raise exception 'god_weight_versions is immutable. Create a new weights_version instead.';
end $$;

drop trigger if exists trg_guard_immutable_god_weights on public.god_weight_versions;
create trigger trg_guard_immutable_god_weights
before update or delete on public.god_weight_versions
for each row execute function public.guard_immutable_god_weights();

-- ---------- TABLE: god_runtime_config ----------
create table if not exists public.god_runtime_config (
  id int primary key,
  active_weights_version text not null,
  override_weights_version text,
  "freeze" boolean not null default false,  -- quoted: reserved keyword
  updated_at timestamptz not null default now()
);

-- keep single row id=1
insert into public.god_runtime_config (id, active_weights_version)
values (1, 'god_v1_initial')
on conflict (id) do nothing;

create or replace function public.touch_updated_at_god_runtime()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_touch_updated_at_god_runtime on public.god_runtime_config;
create trigger trg_touch_updated_at_god_runtime
before update on public.god_runtime_config
for each row execute function public.touch_updated_at_god_runtime();

-- ---------- TABLE: god_score_explanations ----------
-- Stores explanation payload for each GOD score calculation
-- CRITICAL: signals_bonus has CHECK constraints enforcing [0, 10] cap
create table if not exists public.god_score_explanations (
  startup_id uuid not null,
  weights_version text not null references public.god_weight_versions(weights_version),

  total_score numeric,
  base_total_score numeric,  -- GOD from fundamentals only (no signals)
  signals_bonus numeric not null default 0,
  
  component_scores jsonb not null default '{}'::jsonb,  -- {team, traction, market, product, vision}
  top_signal_contributions jsonb not null default '[]'::jsonb,  -- [{dimension, key, confidence, recency_days, contrib_points}]
  debug jsonb not null default '{}'::jsonb,  -- {signals_dimensions: {founder_language_shift, investor_receptivity, ...}}

  computed_at timestamptz not null default now(),

  primary key (startup_id, weights_version),
  
  -- HARD CAP: signals_bonus must be in [0, 10]
  constraint chk_signals_bonus_range check (signals_bonus >= 0 and signals_bonus <= 10),
  
  -- total_score must be in [0, 100]
  constraint chk_total_score_range check (total_score is null or (total_score >= 0 and total_score <= 100)),
  
  -- base_total_score must be in [0, 100]
  constraint chk_base_total_range check (base_total_score is null or (base_total_score >= 0 and base_total_score <= 100)),
  
  -- CRITICAL: signals can never add more than 10 points
  constraint chk_signal_delta check (
    base_total_score is null
    or signals_bonus is null
    or (total_score - base_total_score) <= 10.0001
  )
);

create index if not exists idx_god_score_explanations_weights
on public.god_score_explanations (weights_version, computed_at desc);

create index if not exists idx_god_score_explanations_startup
on public.god_score_explanations (startup_id, computed_at desc);

-- ---------- RPC: get_god_runtime ----------
create or replace function public.get_god_runtime()
returns table(
  active_weights_version text,
  override_weights_version text,
  effective_weights_version text,
  "freeze" boolean,  -- quoted: reserved keyword
  updated_at timestamptz
)
language sql stable as $$
  select
    c.active_weights_version,
    c.override_weights_version,
    coalesce(c.override_weights_version, c.active_weights_version) as effective_weights_version,
    c."freeze",  -- quoted: reserved keyword
    c.updated_at
  from public.god_runtime_config c
  where c.id = 1;
$$;

-- ---------- RPC: get_god_explain ----------
create or replace function public.get_god_explain(
  p_startup_id uuid,
  p_weights_version text default null
)
returns jsonb
language plpgsql stable as $$
declare
  v_eff text;
  rec jsonb;
begin
  if p_weights_version is null then
    select effective_weights_version into v_eff
    from public.get_god_runtime()
    limit 1;
  else
    v_eff := p_weights_version;
  end if;

  select to_jsonb(e.*) into rec
  from public.god_score_explanations e
  where e.startup_id = p_startup_id
    and e.weights_version = v_eff;

  if rec is null then
    return jsonb_build_object(
      'startup_id', p_startup_id,
      'weights_version', v_eff,
      'found', false
    );
  end if;

  return jsonb_build_object(
    'found', true,
    'weights_version', v_eff,
    'explain', rec
  );
end $$;

commit;
