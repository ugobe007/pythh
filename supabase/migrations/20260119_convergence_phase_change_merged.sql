-- ============================================================
-- PYTH CONVERGENCE + PHASE-CHANGE ENGINE (MERGED)
-- ============================================================
-- Purpose: Complete behavioral physics infrastructure
-- Date: January 19, 2026
-- Idempotent: Can be safely re-applied
-- ============================================================

-- ============================================================
-- PART 1: CONVERGENCE ENGINE (Observer Tracking)
-- ============================================================

-- 1. INVESTOR STARTUP OBSERVERS (already exists, skip if present)
CREATE TABLE IF NOT EXISTS investor_startup_observers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  source text NOT NULL,
  weight numeric NOT NULL DEFAULT 1.0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb,
  CONSTRAINT valid_source CHECK (source IN (
    'browse_similar', 'portfolio_overlap', 'search', 
    'partner_view', 'forum', 'news', 'referral', 'direct'
  ))
);

-- Indexes (safe if already exist)
CREATE INDEX IF NOT EXISTS idx_observers_startup_time 
  ON investor_startup_observers (startup_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_observers_investor_time 
  ON investor_startup_observers (investor_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_observers_source 
  ON investor_startup_observers (source, occurred_at DESC);

-- 2. PORTFOLIO ADJACENCY
CREATE TABLE IF NOT EXISTS investor_portfolio_adjacency (
  investor_id uuid NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  overlap_score numeric CHECK (overlap_score >= 0 AND overlap_score <= 1),
  adjacent_companies int DEFAULT 0,
  shared_sectors text[],
  last_updated timestamptz DEFAULT now(),
  PRIMARY KEY (investor_id, startup_id)
);

CREATE INDEX IF NOT EXISTS idx_adj_lookup 
  ON investor_portfolio_adjacency (startup_id, overlap_score DESC);

CREATE INDEX IF NOT EXISTS idx_adj_investor 
  ON investor_portfolio_adjacency (investor_id, overlap_score DESC);

-- 3. INVESTOR BEHAVIOR SUMMARY
CREATE TABLE IF NOT EXISTS investor_behavior_summary (
  investor_id uuid NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  recent_views int DEFAULT 0,
  similar_startups_viewed int DEFAULT 0,
  portfolio_page_visits int DEFAULT 0,
  last_viewed_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (investor_id, startup_id)
);

CREATE INDEX IF NOT EXISTS idx_behavior_lookup 
  ON investor_behavior_summary (startup_id, recent_views DESC);

CREATE INDEX IF NOT EXISTS idx_behavior_investor 
  ON investor_behavior_summary (investor_id, last_viewed_at DESC);

-- ============================================================
-- PART 2: PHASE-CHANGE DETECTOR (Startup Signals)
-- ============================================================

-- 4. STARTUP SIGNALS (new table for phase-change tracking)
CREATE TABLE IF NOT EXISTS startup_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES startup_uploads(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  weight numeric DEFAULT 1.0,
  occurred_at timestamptz DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_startup_signals_startup_occurred 
  ON startup_signals(startup_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_startup_signals_type 
  ON startup_signals(signal_type);

CREATE INDEX IF NOT EXISTS idx_startup_signals_occurred 
  ON startup_signals(occurred_at DESC);

-- ============================================================
-- PART 3: VIEWS (Convergence + Phase-Change)
-- ============================================================

-- View: Investor-Startup FOMO Aggregates
CREATE OR REPLACE VIEW investor_startup_fomo AS
SELECT
  o.investor_id,
  o.startup_id,
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '24 hours') AS events_24h,
  SUM(weight) FILTER (WHERE occurred_at > now() - interval '24 hours') AS signal_24h,
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '7 days') AS events_7d,
  SUM(weight) FILTER (WHERE occurred_at > now() - interval '7 days') AS signal_7d,
  MAX(occurred_at) AS last_signal_at
FROM investor_startup_observers o
GROUP BY investor_id, startup_id;

-- View: FOMO State Classification
CREATE OR REPLACE VIEW investor_startup_fomo_triggers AS
SELECT
  f.*,
  (f.signal_24h / NULLIF(f.signal_7d, 0)) AS fomo_ratio,
  CASE
    WHEN f.signal_24h > 10 AND (f.signal_24h / NULLIF(f.signal_7d, 0)) > 0.6 THEN 'breakout'
    WHEN f.signal_24h > 5  AND (f.signal_24h / NULLIF(f.signal_7d, 0)) > 0.3 THEN 'surge'
    WHEN f.signal_7d  > 3                                                       THEN 'warming'
    ELSE 'watch'
  END AS fomo_state
FROM investor_startup_fomo f;

-- View: Observers (7d) per startup
CREATE OR REPLACE VIEW startup_observers_7d AS
SELECT
  startup_id,
  COUNT(DISTINCT investor_id) AS observers_7d,
  SUM(weight) AS total_observer_weight,
  MAX(occurred_at) AS latest_observation
FROM investor_startup_observers
WHERE occurred_at > now() - interval '7 days'
GROUP BY startup_id;

-- View: Startup Signal Rolling Aggregates
CREATE OR REPLACE VIEW startup_signal_rolling AS
SELECT
  startup_id,
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '24 hours') AS events_24h,
  COALESCE(SUM(weight) FILTER (WHERE occurred_at > now() - interval '24 hours'), 0) AS signal_24h,
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '7 days') AS events_7d,
  COALESCE(SUM(weight) FILTER (WHERE occurred_at > now() - interval '7 days'), 0) AS signal_7d,
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '30 days') AS events_30d,
  COALESCE(SUM(weight) FILTER (WHERE occurred_at > now() - interval '30 days'), 0) AS signal_30d,
  MAX(occurred_at) AS last_signal_at
FROM startup_signals
GROUP BY startup_id;

-- View: Phase-Change Score (dynamic acceleration detection)
CREATE OR REPLACE VIEW startup_phase_change AS
WITH base AS (
  SELECT r.*, EXTRACT(EPOCH FROM (now() - r.last_signal_at))/3600.0 AS age_hours
  FROM startup_signal_rolling r
),
diversity AS (
  SELECT startup_id, COUNT(DISTINCT signal_type) FILTER (WHERE occurred_at > now() - interval '7 days') AS types_7d
  FROM startup_signals GROUP BY startup_id
),
scored AS (
  SELECT b.startup_id, b.signal_24h, b.signal_7d, b.signal_30d, b.events_7d, b.age_hours,
    COALESCE(d.types_7d, 0) AS types_7d,
    (b.signal_7d / NULLIF((b.signal_30d / 4.2857), 0)) AS intensity_ratio,
    (b.signal_24h / NULLIF(b.signal_7d, 0)) AS accel_ratio,
    EXP(-LN(2) * (b.age_hours / 72.0)) AS recency_decay
  FROM base b LEFT JOIN diversity d ON d.startup_id = b.startup_id
)
SELECT startup_id,
  LEAST(1.0, GREATEST(0.0, (0.45 * LEAST(2.0, COALESCE(intensity_ratio, 0.0)) / 2.0 + 0.25 * LEAST(1.0, COALESCE(accel_ratio, 0.0) * 2.0) + 0.20 * recency_decay + 0.10 * LEAST(1.0, types_7d / 6.0)))) AS phase_change_score,
  CASE WHEN (COALESCE(intensity_ratio,0) > 1.8 AND COALESCE(accel_ratio,0) > 0.35) THEN 'breakout'
       WHEN (COALESCE(intensity_ratio,0) > 1.3 AND types_7d >= 3) THEN 'inflecting'
       WHEN (COALESCE(intensity_ratio,0) > 1.0 AND types_7d >= 2) THEN 'forming'
       ELSE 'quiet' END AS phase_state,
  intensity_ratio, accel_ratio, recency_decay, types_7d, signal_7d, signal_24h
FROM scored;

-- View: Convergence Candidates (THE MONEY VIEW)
CREATE OR REPLACE VIEW convergence_candidates AS
SELECT
  i.id AS investor_id,
  s.id AS startup_id,
  i.name AS firm_name,
  i.firm,
  i.stage AS stage_focus,
  i.sectors AS sector_focus,
  i.check_size_min,
  i.check_size_max,
  COALESCE(f.signal_7d, 0) AS signal_7d,
  COALESCE(f.signal_24h, 0) AS signal_24h,
  COALESCE(f.fomo_state, 'watch') AS fomo_state,
  f.last_signal_at,
  COALESCE(adj.overlap_score, 0) AS overlap_score,
  COALESCE(adj.adjacent_companies, 0) AS adjacent_companies,
  adj.shared_sectors,
  COALESCE(beh.recent_views, 0) AS recent_views,
  COALESCE(beh.similar_startups_viewed, 0) AS similar_startups_viewed,
  beh.last_viewed_at,
  s.total_god_score,
  s.team_score,
  s.market_score,
  s.product_score AS execution_score,
  EXTRACT(EPOCH FROM (now() - COALESCE(f.last_signal_at, s.created_at))) / 3600 AS signal_age_hours,
  m.match_score
FROM startup_uploads s
CROSS JOIN investors i
LEFT JOIN investor_startup_fomo_triggers f ON f.investor_id = i.id AND f.startup_id = s.id
LEFT JOIN investor_portfolio_adjacency adj ON adj.investor_id = i.id AND adj.startup_id = s.id
LEFT JOIN investor_behavior_summary beh ON beh.investor_id = i.id AND beh.startup_id = s.id
LEFT JOIN startup_investor_matches m ON m.investor_id = i.id AND m.startup_id = s.id
WHERE s.status = 'approved'
  AND (f.signal_7d > 0 OR adj.overlap_score > 0.3 OR beh.recent_views > 0 OR m.match_score >= 50);

-- View: Comparable Startups (social proof)
CREATE OR REPLACE VIEW comparable_startups AS
SELECT
  s1.id AS for_startup_id,
  s2.id AS comparable_id,
  s2.name,
  s2.total_god_score,
  (SELECT COUNT(*) FROM startup_investor_matches m WHERE m.startup_id = s2.id AND m.match_score >= 60) AS matched_investors_count,
  ABS(s1.total_god_score - s2.total_god_score) AS god_score_delta,
  ARRAY_REMOVE(ARRAY[CASE WHEN ABS(s1.total_god_score - s2.total_god_score) < 10 THEN 'comparable_velocity' END], NULL) AS reason_tags
FROM startup_uploads s1
JOIN startup_uploads s2 ON ABS(s1.total_god_score - s2.total_god_score) < 15 AND s1.id <> s2.id AND s2.status = 'approved'
WHERE s1.status = 'approved';

-- ============================================================
-- PART 4: FUNCTIONS (Canonical Interfaces)
-- ============================================================

-- Function: Insert observer event (with 6h dedup)
CREATE OR REPLACE FUNCTION insert_observer_event(p_investor_id uuid, p_startup_id uuid, p_source text, p_weight numeric DEFAULT 1.0, p_meta jsonb DEFAULT '{}'::jsonb) 
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_event_id uuid; v_last_event timestamptz;
BEGIN
  SELECT occurred_at INTO v_last_event FROM investor_startup_observers
  WHERE investor_id = p_investor_id AND startup_id = p_startup_id AND source = p_source
  ORDER BY occurred_at DESC LIMIT 1;
  
  IF v_last_event IS NOT NULL AND v_last_event > now() - interval '6 hours' THEN RETURN NULL; END IF;
  
  INSERT INTO investor_startup_observers (investor_id, startup_id, source, weight, occurred_at, meta)
  VALUES (p_investor_id, p_startup_id, p_source, p_weight, now(), p_meta)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END; $$;

-- Function: Insert startup signal
CREATE OR REPLACE FUNCTION insert_startup_signal(p_startup_id uuid, p_signal_type text, p_weight numeric DEFAULT 1.0, p_meta jsonb DEFAULT '{}'::jsonb) 
RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE v_signal_id uuid;
BEGIN
  INSERT INTO startup_signals (startup_id, signal_type, weight, occurred_at, meta)
  VALUES (p_startup_id, p_signal_type, p_weight, now(), p_meta)
  RETURNING id INTO v_signal_id;
  RETURN v_signal_id;
END; $$;

-- Function: Get observer count (7d)
CREATE OR REPLACE FUNCTION get_observers_7d(p_startup_id uuid) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT COALESCE(observers_7d, 0) FROM startup_observers_7d WHERE startup_id = p_startup_id;
$$;

-- Function: Get FOMO state
CREATE OR REPLACE FUNCTION get_startup_fomo_state(p_startup_id uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN MAX(total_god_score) >= 80 THEN 'breakout'
    WHEN MAX(total_god_score) >= 70 THEN 'surge'
    WHEN MAX(total_god_score) >= 60 THEN 'warming'
    ELSE 'watch' END
  FROM startup_uploads WHERE id = p_startup_id;
$$;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
