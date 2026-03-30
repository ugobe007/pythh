-- ============================================================
-- Pythh Signal Intelligence Platform — Core Schema
-- Migration: 20260327120000_signal_intelligence_schema
--
-- Tables created:
--   1. pythh_entities         — companies, investors, buyers, partners
--   2. pythh_signal_events    — individual parsed signal objects
--   3. pythh_trajectories     — company trajectory snapshots (per entity per window)
--   4. pythh_entity_needs     — inferred need objects per entity
--   5. pythh_candidates       — investor / vendor / partner / acquirer profiles
--   6. pythh_matches          — ranked match results per entity
--   7. pythh_signal_timeline  — append-only event log for entity signal history
-- ============================================================

-- ────────────────────────────────────────────────────────────────────────────
-- 1. ENTITIES
-- The primary subject of intelligence: startups, investors, buyers, partners.
-- Can be linked to existing startup_uploads / startup_profiles records.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pythh_entities (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now(),

  -- Identity
  name             text            NOT NULL,
  entity_type      text            NOT NULL CHECK (entity_type IN (
                     'startup', 'investor', 'corporate', 'buyer', 'partner', 'unknown'
                   )),
  description      text,
  website          text,
  linkedin_url     text,

  -- Classification (arrays for multi-sector / multi-geo)
  sectors          text[]          DEFAULT '{}',
  geographies      text[]          DEFAULT '{}',
  stage            text,           -- ideation | product_build | go_to_market | enterprise_scale | ...
  business_model   text,           -- saas | marketplace | hardware | services | ...
  employee_count   int,
  founding_year    int,

  -- Signal metadata
  first_signal_date date,
  last_signal_date  date,
  total_signals    int             DEFAULT 0,
  signal_velocity  numeric(5,2)   DEFAULT 0,

  -- Links to existing tables
  startup_upload_id    uuid        REFERENCES startup_uploads(id) ON DELETE SET NULL,
  startup_profile_id   uuid,       -- FK to startup_profiles if that table exists

  -- Flags
  is_active        boolean         DEFAULT true,
  is_verified      boolean         DEFAULT false,

  -- Raw metadata
  metadata         jsonb           DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pythh_entities_name         ON pythh_entities (name);
CREATE INDEX IF NOT EXISTS idx_pythh_entities_entity_type  ON pythh_entities (entity_type);
CREATE INDEX IF NOT EXISTS idx_pythh_entities_stage        ON pythh_entities (stage);
CREATE INDEX IF NOT EXISTS idx_pythh_entities_sectors      ON pythh_entities USING gin (sectors);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. SIGNAL EVENTS
-- Each row is one parsed signal object from the signal grammar engine.
-- This is the raw intelligence layer — every signal ever observed.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pythh_signal_events (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz     NOT NULL DEFAULT now(),
  detected_at      timestamptz     NOT NULL DEFAULT now(),

  -- Source
  entity_id        uuid            REFERENCES pythh_entities(id) ON DELETE CASCADE,
  source           text,           -- LinkedIn, TechCrunch, SEC filing, ...
  source_type      text,           -- news | press_release | linkedin | sec_filing | podcast | ...
  source_url       text,
  source_reliability numeric(4,2), -- 0.0–1.0

  -- Raw text
  raw_sentence     text            NOT NULL,
  raw_context      text,           -- surrounding paragraph / article body

  -- Signal Grammar output (full object stored as jsonb for flexibility)
  signal_object    jsonb           NOT NULL DEFAULT '{}',

  -- Top-level signal classification (denormalized for fast querying)
  primary_signal   text,           -- hiring_signal | fundraising_signal | distress_signal | ...
  signal_type      text,           -- intent | event | posture | demand | distress | investor | buyer | talent | ...
  signal_strength  numeric(4,2),   -- 0.0–1.0
  confidence       numeric(4,2),   -- 0.0–1.0 (6-dimensional model)
  evidence_quality text,           -- confirmed | strong | moderate | weak | low-information

  -- Grammar elements (denormalized for filtering)
  actor_type       text,           -- startup | investor | company | buyer
  action_tag       text,           -- action_hiring | action_fundraising | ...
  modality         text,           -- active | hedged | exploratory | negative
  intensity        text[],         -- aggressively | quickly | cautiously | ...
  posture          text,           -- confident | cautious | distressed

  -- Flags
  is_costly_action boolean         DEFAULT false,
  is_ambiguous     boolean         DEFAULT false,
  is_multi_signal  boolean         DEFAULT false,
  has_negation     boolean         DEFAULT false,

  -- Sub-signals (from parseMultiSignal)
  sub_signals      jsonb           DEFAULT '[]',

  -- Who should care
  who_cares        jsonb           DEFAULT '{}', -- {investors, vendors, acquirers, recruiters, partners}

  -- Inference
  likely_stage     text,
  likely_needs     text[],
  urgency          text            CHECK (urgency IN ('low', 'medium', 'high', null))
);

CREATE INDEX IF NOT EXISTS idx_signal_events_entity_id      ON pythh_signal_events (entity_id);
CREATE INDEX IF NOT EXISTS idx_signal_events_detected_at    ON pythh_signal_events (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_signal_events_primary_signal ON pythh_signal_events (primary_signal);
CREATE INDEX IF NOT EXISTS idx_signal_events_confidence     ON pythh_signal_events (confidence DESC);
CREATE INDEX IF NOT EXISTS idx_signal_events_signal_type    ON pythh_signal_events (signal_type);
CREATE INDEX IF NOT EXISTS idx_signal_events_source_type    ON pythh_signal_events (source_type);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. TRAJECTORIES
-- Trajectory snapshots computed by trajectoryEngine.buildTrajectory().
-- Stored per entity per time window (30/90/180/365 days).
-- Recomputed periodically by a background job.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pythh_trajectories (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now(),
  computed_at      timestamptz     NOT NULL DEFAULT now(),

  entity_id        uuid            NOT NULL REFERENCES pythh_entities(id) ON DELETE CASCADE,
  time_window_days int             NOT NULL DEFAULT 90,
  window_start     date,
  window_end       date,

  -- Core trajectory classification
  dominant_trajectory   text,      -- fundraising | expansion | distress | exit | product | buying | ...
  trajectory_label      text,      -- human label, e.g. "GTM Expansion"
  trajectory_type       text,      -- same as dominant_trajectory type
  trajectory_confidence numeric(4,2),

  -- Velocity & momentum
  velocity_score        numeric(4,2),
  momentum              numeric(4,2),
  acceleration          text        CHECK (acceleration IN ('accelerating', 'stable', 'decelerating', 'insufficient_data', null)),

  -- Consistency
  consistency_score     numeric(4,2),

  -- Stage
  current_stage         text,
  stage_from            text,      -- detected from early half of window
  stage_to              text,      -- detected from recent half of window
  stage_transition_detected boolean DEFAULT false,

  -- Signals
  dominant_signal       text,
  supporting_signals    text[]      DEFAULT '{}',
  contradictory_signals text[]      DEFAULT '{}',
  signal_class_counts   jsonb       DEFAULT '{}',

  -- Predictions
  predicted_next_moves  text[]      DEFAULT '{}',
  prediction            text,
  who_cares             jsonb       DEFAULT '{}',

  -- Anomalies (array of anomaly objects from detectAnomalies)
  anomalies             jsonb       DEFAULT '[]',

  -- Matched patterns (array of {pattern_id, match_score, matched_dates})
  matched_patterns      jsonb       DEFAULT '[]',
  primary_pattern_id    text,

  -- Rolling windows snapshot
  rolling_windows       jsonb       DEFAULT '{}',

  -- Signal counts
  total_signals         int         DEFAULT 0,
  first_signal_date     date,
  last_signal_date      date,

  UNIQUE (entity_id, time_window_days, window_end)
);

CREATE INDEX IF NOT EXISTS idx_trajectories_entity_id            ON pythh_trajectories (entity_id);
CREATE INDEX IF NOT EXISTS idx_trajectories_dominant_trajectory  ON pythh_trajectories (dominant_trajectory);
CREATE INDEX IF NOT EXISTS idx_trajectories_window               ON pythh_trajectories (time_window_days, window_end DESC);
CREATE INDEX IF NOT EXISTS idx_trajectories_velocity             ON pythh_trajectories (velocity_score DESC);
CREATE INDEX IF NOT EXISTS idx_trajectories_confidence           ON pythh_trajectories (trajectory_confidence DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- 4. ENTITY NEEDS
-- Inferred canonical need objects from needsInference.inferNeeds().
-- Updated whenever the trajectory is recomputed.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pythh_entity_needs (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now(),

  entity_id        uuid            NOT NULL REFERENCES pythh_entities(id) ON DELETE CASCADE,
  trajectory_id    uuid            REFERENCES pythh_trajectories(id) ON DELETE SET NULL,

  need_class       text            NOT NULL,
  label            text,
  category         text,           -- capital | gtm | product | buying | strategic | talent
  description      text,

  confidence       numeric(4,2),   -- 0.0–1.0
  urgency          text            CHECK (urgency IN ('low', 'medium', 'high')),

  who_provides     text[]          DEFAULT '{}',
  signal_sources   text[]          DEFAULT '{}',
  trajectory_boost boolean         DEFAULT false,
  evidence_count   int             DEFAULT 1,

  -- Validity window
  valid_from       date,
  valid_until      date,           -- needs expire; recomputed from fresh trajectory

  UNIQUE (entity_id, need_class, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_entity_needs_entity_id  ON pythh_entity_needs (entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_needs_need_class ON pythh_entity_needs (need_class);
CREATE INDEX IF NOT EXISTS idx_entity_needs_urgency    ON pythh_entity_needs (urgency);
CREATE INDEX IF NOT EXISTS idx_entity_needs_category   ON pythh_entity_needs (category);


-- ────────────────────────────────────────────────────────────────────────────
-- 5. CANDIDATES
-- Investors, vendors, partners, acquirers, advisors, and recruiters
-- that can be matched against entities with inferred needs.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pythh_candidates (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now(),

  -- Identity
  name             text            NOT NULL,
  candidate_type   text            NOT NULL CHECK (candidate_type IN (
                     'investor', 'vendor', 'partner', 'recruiter', 'acquirer', 'advisor', 'buyer'
                   )),
  description      text,
  website          text,
  linkedin_url     text,

  -- Focus
  sectors          text[]          DEFAULT '{}',
  geographies      text[]          DEFAULT '{}',
  stages           text[]          DEFAULT '{}',     -- pre_seed | seed | series_a | series_b | growth | any
  business_model_fit text[]        DEFAULT '{}',     -- saas | marketplace | hardware | services | any

  -- For investors
  check_size_min   numeric(15,0),                   -- USD
  check_size_max   numeric(15,0),
  check_size_label text,                             -- e.g. "500K–3M"
  portfolio_focus  text[],
  typical_round_types text[]       DEFAULT '{}',

  -- Matching configuration
  need_classes_supported  text[]   DEFAULT '{}',     -- canonical need_class values this candidate serves
  buying_signals_supported text[]  DEFAULT '{}',     -- signal classes this candidate engages with
  trajectory_preferences   text[]  DEFAULT '{}',     -- trajectory types this candidate prefers

  -- Exclusions
  negative_filters text[]          DEFAULT '{}',     -- sectors / stages to exclude

  -- Evidence / sourcing
  evidence         jsonb           DEFAULT '[]',     -- [{source, url, note, date}]

  -- Status
  is_active        boolean         DEFAULT true,
  is_verified      boolean         DEFAULT false,

  metadata         jsonb           DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_candidates_candidate_type  ON pythh_candidates (candidate_type);
CREATE INDEX IF NOT EXISTS idx_candidates_sectors         ON pythh_candidates USING gin (sectors);
CREATE INDEX IF NOT EXISTS idx_candidates_need_classes    ON pythh_candidates USING gin (need_classes_supported);
CREATE INDEX IF NOT EXISTS idx_candidates_stages          ON pythh_candidates USING gin (stages);
CREATE INDEX IF NOT EXISTS idx_candidates_geographies     ON pythh_candidates USING gin (geographies);


-- ────────────────────────────────────────────────────────────────────────────
-- 6. MATCHES
-- Ranked match results from matchEngine.rankMatches().
-- Stored per entity × candidate × trajectory snapshot.
-- Matches are time-aware and expire as the trajectory evolves.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pythh_matches (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz     NOT NULL DEFAULT now(),
  updated_at       timestamptz     NOT NULL DEFAULT now(),
  matched_at       timestamptz     NOT NULL DEFAULT now(),

  entity_id        uuid            NOT NULL REFERENCES pythh_entities(id) ON DELETE CASCADE,
  candidate_id     uuid            NOT NULL REFERENCES pythh_candidates(id) ON DELETE CASCADE,
  trajectory_id    uuid            REFERENCES pythh_trajectories(id) ON DELETE SET NULL,

  -- Match classification
  match_type       text            NOT NULL CHECK (match_type IN (
                     'capital_match', 'vendor_match', 'buyer_match', 'partner_match',
                     'talent_match',  'acquirer_match', 'advisor_match'
                   )),

  -- Scores (0.0–1.0)
  match_score      numeric(4,2)    NOT NULL,
  timing_score     numeric(4,2),
  confidence       numeric(4,2),

  -- Dimension breakdown (for transparency / UI drill-down)
  dimension_scores jsonb           DEFAULT '{}',

  -- Context
  urgency          text            CHECK (urgency IN ('low', 'medium', 'high')),
  trajectory_used  text,
  dominant_signal  text,
  supporting_signals text[]        DEFAULT '{}',
  predicted_need   text[]          DEFAULT '{}',

  -- Explanation layer
  explanation      text[]          DEFAULT '{}',   -- human-readable reasons
  recommended_action text,

  -- Lifecycle
  status           text            DEFAULT 'active' CHECK (status IN ('active', 'actioned', 'dismissed', 'expired')),
  actioned_at      timestamptz,
  actioned_by      uuid,           -- user_id of who actioned it
  action_taken     text,           -- 'reached_out' | 'passed' | 'intro_made' | ...
  expires_at       timestamptz,    -- matches expire when trajectory is recomputed

  -- Notes
  admin_notes      text,

  UNIQUE (entity_id, candidate_id, trajectory_id)
);

CREATE INDEX IF NOT EXISTS idx_matches_entity_id    ON pythh_matches (entity_id);
CREATE INDEX IF NOT EXISTS idx_matches_candidate_id ON pythh_matches (candidate_id);
CREATE INDEX IF NOT EXISTS idx_matches_match_type   ON pythh_matches (match_type);
CREATE INDEX IF NOT EXISTS idx_matches_match_score  ON pythh_matches (match_score DESC);
CREATE INDEX IF NOT EXISTS idx_matches_urgency      ON pythh_matches (urgency);
CREATE INDEX IF NOT EXISTS idx_matches_status       ON pythh_matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_matched_at   ON pythh_matches (matched_at DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- 7. SIGNAL TIMELINE
-- Append-only log of signal class events per entity, optimized for
-- trajectory computation and feed rendering.
-- Lightweight companion to pythh_signal_events for time-series queries.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pythh_signal_timeline (
  id               uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz     NOT NULL DEFAULT now(),

  entity_id        uuid            NOT NULL REFERENCES pythh_entities(id) ON DELETE CASCADE,
  signal_event_id  uuid            REFERENCES pythh_signal_events(id) ON DELETE SET NULL,

  -- Denormalized for fast time-series queries
  event_date       date            NOT NULL,
  signal_class     text            NOT NULL,
  signal_type      text,
  signal_strength  numeric(4,2),
  confidence       numeric(4,2),
  evidence_quality text,
  is_costly_action boolean         DEFAULT false,
  summary          text,           -- short human description of the event

  -- Source
  source           text,
  source_type      text,
  source_url       text
);

CREATE INDEX IF NOT EXISTS idx_timeline_entity_id   ON pythh_signal_timeline (entity_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_event_date  ON pythh_signal_timeline (event_date DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_signal_class ON pythh_signal_timeline (signal_class);


-- ────────────────────────────────────────────────────────────────────────────
-- HELPER VIEWS
-- ────────────────────────────────────────────────────────────────────────────

-- Active high-confidence matches ranked by score
CREATE OR REPLACE VIEW pythh_top_matches AS
SELECT
  m.id,
  m.matched_at,
  e.name              AS entity_name,
  e.stage             AS entity_stage,
  e.sectors           AS entity_sectors,
  c.name              AS candidate_name,
  c.candidate_type,
  m.match_type,
  m.match_score,
  m.timing_score,
  m.confidence,
  m.urgency,
  m.trajectory_used,
  m.explanation,
  m.recommended_action,
  m.status
FROM    pythh_matches    m
JOIN    pythh_entities   e ON e.id = m.entity_id
JOIN    pythh_candidates c ON c.id = m.candidate_id
WHERE   m.status = 'active'
ORDER BY m.urgency DESC, m.match_score DESC;


-- Active trajectories with entity context
CREATE OR REPLACE VIEW pythh_active_trajectories AS
SELECT
  t.id,
  t.computed_at,
  e.name                    AS entity_name,
  e.entity_type,
  e.stage                   AS entity_stage,
  t.time_window_days,
  t.dominant_trajectory,
  t.trajectory_label,
  t.trajectory_confidence,
  t.velocity_score,
  t.momentum,
  t.acceleration,
  t.consistency_score,
  t.current_stage,
  t.stage_transition_detected,
  t.dominant_signal,
  t.predicted_next_moves,
  t.prediction,
  t.anomalies,
  t.total_signals,
  t.last_signal_date
FROM    pythh_trajectories t
JOIN    pythh_entities     e ON e.id = t.entity_id
WHERE   t.time_window_days = 90
ORDER BY t.velocity_score DESC, t.trajectory_confidence DESC;


-- Signal feed: high-confidence recent signals across all entities
CREATE OR REPLACE VIEW pythh_signal_feed AS
SELECT
  s.id,
  s.detected_at,
  e.name              AS entity_name,
  e.entity_type,
  s.source,
  s.source_type,
  s.primary_signal,
  s.signal_type,
  s.signal_strength,
  s.confidence,
  s.evidence_quality,
  s.actor_type,
  s.modality,
  s.posture,
  s.is_costly_action,
  s.urgency,
  s.who_cares,
  s.raw_sentence,
  s.source_url
FROM    pythh_signal_events s
JOIN    pythh_entities       e ON e.id = s.entity_id
WHERE   s.confidence >= 0.55
ORDER BY s.detected_at DESC;


-- High-urgency entity needs
CREATE OR REPLACE VIEW pythh_urgent_needs AS
SELECT
  n.id,
  e.name              AS entity_name,
  e.entity_type,
  e.stage             AS entity_stage,
  n.need_class,
  n.label,
  n.category,
  n.confidence,
  n.urgency,
  n.who_provides,
  n.signal_sources,
  n.valid_from,
  n.valid_until
FROM    pythh_entity_needs n
JOIN    pythh_entities     e ON e.id = n.entity_id
WHERE   n.urgency = 'high'
  AND   (n.valid_until IS NULL OR n.valid_until >= CURRENT_DATE)
ORDER BY n.confidence DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'pythh_entities', 'pythh_trajectories', 'pythh_entity_needs',
    'pythh_candidates', 'pythh_matches'
  ]
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I;
       CREATE TRIGGER trg_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;

-- ────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- Enable RLS on all tables. Policies should be defined per-app.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE pythh_entities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pythh_signal_events  ENABLE ROW LEVEL SECURITY;
ALTER TABLE pythh_trajectories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pythh_entity_needs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE pythh_candidates     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pythh_matches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pythh_signal_timeline ENABLE ROW LEVEL SECURITY;

-- Service role bypass (for backend scripts / cron jobs)
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'pythh_entities', 'pythh_signal_events', 'pythh_trajectories',
    'pythh_entity_needs', 'pythh_candidates', 'pythh_matches', 'pythh_signal_timeline'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS service_role_all ON %I;
       CREATE POLICY service_role_all ON %I
         USING (true)
         WITH CHECK (true);',
      tbl, tbl
    );
  END LOOP;
END;
$$;
