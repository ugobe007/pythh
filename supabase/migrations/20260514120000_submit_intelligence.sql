-- Submit Intelligence Log
-- Captures every URL submission outcome for ML learning and anomaly detection.
-- Used by server/services/submitUrlIntelligence.js

create table if not exists submit_intelligence_log (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),

  -- Input
  url              text not null,
  domain           text not null,
  tld              text,
  url_normalized   text,

  -- Resolution outcome
  endpoint         text not null,          -- 'instant' | 'discovery'
  resolver_tier    text,                   -- 'exact' | 'rpc' | 'fuzzy' | 'new'
  startup_id       uuid,
  is_new           boolean not null default false,

  -- Quality signals
  latency_ms       int,
  match_count      int default 0,
  god_score        numeric,
  data_completeness numeric,

  -- Error tracking
  error_code       text,
  error_msg        text,

  -- ML labels (set later via feedback or automated scoring)
  was_correct      boolean,               -- null = unlabeled
  feedback_at      timestamptz,
  feedback_source  text,                  -- 'user' | 'watchdog' | 'auto'

  -- Feature vector (JSON snapshot for offline training)
  features         jsonb default '{}'::jsonb
);

create index if not exists sil_domain_idx   on submit_intelligence_log (domain);
create index if not exists sil_created_idx  on submit_intelligence_log (created_at desc);
create index if not exists sil_endpoint_idx on submit_intelligence_log (endpoint);
create index if not exists sil_tier_idx     on submit_intelligence_log (resolver_tier);
create index if not exists sil_correct_idx  on submit_intelligence_log (was_correct) where was_correct is not null;

-- Watchdog event log — records every probe run and any self-heal actions
create table if not exists submit_watchdog_events (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  probe_url    text not null,
  status       text not null,   -- 'pass' | 'fail' | 'warn'
  latency_ms   int,
  startup_id   uuid,
  match_count  int,
  error        text,
  action_taken text,            -- 'none' | 'alert_sent' | 'restart_triggered' | 'retry_succeeded'
  details      jsonb default '{}'::jsonb
);

create index if not exists swe_created_idx on submit_watchdog_events (created_at desc);
create index if not exists swe_status_idx  on submit_watchdog_events (status);

-- Domain resolver stats — running ML weights per domain pattern
create table if not exists domain_resolver_stats (
  id              uuid primary key default gen_random_uuid(),
  domain_pattern  text not null unique,   -- root domain, e.g. 'stripe.com'
  tld             text,
  attempts        int default 0,
  successes       int default 0,
  avg_latency_ms  numeric default 0,
  best_tier       text,                   -- tier that succeeds most often
  tier_weights    jsonb default '{}'::jsonb,  -- { exact: 0.9, fuzzy: 0.4, new: 0.1 }
  last_seen       timestamptz,
  last_outcome    text,                   -- 'success' | 'failure'
  updated_at      timestamptz default now()
);

create index if not exists drs_domain_idx on domain_resolver_stats (domain_pattern);
create index if not exists drs_tld_idx    on domain_resolver_stats (tld);
