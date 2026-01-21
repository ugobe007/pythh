-- ============================================================
-- PYTH CONVERGENCE DATA ENGINE V1
-- ============================================================
-- Purpose: Capital field dynamics + behavioral gravity
-- Date: January 19, 2026
-- Scope: Observer tracking, FOMO acceleration, portfolio adjacency
-- ============================================================

-- ============================================================
-- 1. INVESTOR STARTUP OBSERVERS (Behavioral Gravity Layer)
-- ============================================================
-- This is the single most important behavioral table
-- Tracks discovery events: browsing, portfolio overlap, searches, partner views

CREATE TABLE IF NOT EXISTS investor_startup_observers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  investor_id uuid NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  source text NOT NULL,
  -- 'browse_similar' | 'portfolio_overlap' | 'search' | 'partner_view' | 'forum' | 'news'
  
  weight numeric NOT NULL DEFAULT 1.0,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  
  meta jsonb,
  
  CONSTRAINT valid_source CHECK (source IN (
    'browse_similar', 'portfolio_overlap', 'search', 
    'partner_view', 'forum', 'news', 'referral', 'direct'
  ))
);

-- Performance indexes
CREATE INDEX idx_observers_startup_time 
  ON investor_startup_observers (startup_id, occurred_at DESC);

CREATE INDEX idx_observers_investor_time 
  ON investor_startup_observers (investor_id, occurred_at DESC);

CREATE INDEX idx_observers_source 
  ON investor_startup_observers (source, occurred_at DESC);

COMMENT ON TABLE investor_startup_observers IS 
  'Behavioral gravity layer - tracks all investor discovery events per startup';

-- ============================================================
-- 2. PORTFOLIO ADJACENCY (Explainability Layer)
-- ============================================================
-- Precomputed similarity: industry, founders, customers, tech stack
-- Powers fit.portfolio_adjacency and "why" bullets

CREATE TABLE IF NOT EXISTS investor_portfolio_adjacency (
  investor_id uuid NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  startup_id uuid NOT NULL REFERENCES startup_uploads(id) ON DELETE CASCADE,
  
  overlap_score numeric CHECK (overlap_score >= 0 AND overlap_score <= 1),
  adjacent_companies int DEFAULT 0,
  shared_sectors text[],
  
  last_updated timestamptz DEFAULT now(),
  
  PRIMARY KEY (investor_id, startup_id)
);

CREATE INDEX idx_adj_lookup 
  ON investor_portfolio_adjacency (startup_id, overlap_score DESC);

CREATE INDEX idx_adj_investor 
  ON investor_portfolio_adjacency (investor_id, overlap_score DESC);

COMMENT ON TABLE investor_portfolio_adjacency IS 
  'Precomputed portfolio similarity scores for explainable matching';

-- ============================================================
-- 3. INVESTOR BEHAVIOR SUMMARY (Discovery Layer)
-- ============================================================
-- Rolling behavioral aggregates per investor-startup pair
-- Updated by scrapers, UI logs, email tracking

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

CREATE INDEX idx_behavior_lookup 
  ON investor_behavior_summary (startup_id, recent_views DESC);

CREATE INDEX idx_behavior_investor 
  ON investor_behavior_summary (investor_id, last_viewed_at DESC);

COMMENT ON TABLE investor_behavior_summary IS 
  'Rolling discovery behavior metrics per investor-startup pair';

-- ============================================================
-- 4. ROLLING FOMO + ACCELERATION (Timing Intelligence)
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

COMMENT ON VIEW investor_startup_fomo IS 
  'Rolling 24h/7d event aggregates for FOMO detection';

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

COMMENT ON VIEW investor_startup_fomo_triggers IS 
  'FOMO state classification: breakout/surge/warming/watch';

-- ============================================================
-- 5. OBSERVER ROLLUPS (Status Bar Metrics)
-- ============================================================

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

COMMENT ON VIEW startup_observers_7d IS 
  'Distinct investor count observing each startup in last 7 days';

-- ============================================================
-- 6. CONVERGENCE CANDIDATE POOL (CORE VIEW)
-- ============================================================
-- This is the engine. Everything the API consumes comes from here.

CREATE OR REPLACE VIEW convergence_candidates AS
SELECT
  i.id                  AS investor_id,
  s.id                  AS startup_id,
  
  -- Investor metadata
  i.name                AS firm_name,
  i.firm,
  i.stage               AS stage_focus,
  i.sectors             AS sector_focus,
  i.check_size_min,
  i.check_size_max,
  
  -- FOMO + timing
  COALESCE(f.signal_7d, 0)      AS signal_7d,
  COALESCE(f.signal_24h, 0)     AS signal_24h,
  COALESCE(f.fomo_state, 'watch') AS fomo_state,
  f.last_signal_at,
  
  -- Portfolio adjacency
  COALESCE(adj.overlap_score, 0)      AS overlap_score,
  COALESCE(adj.adjacent_companies, 0) AS adjacent_companies,
  adj.shared_sectors,
  
  -- Behavior
  COALESCE(beh.recent_views, 0)            AS recent_views,
  COALESCE(beh.similar_startups_viewed, 0) AS similar_startups_viewed,
  beh.last_viewed_at,
  
  -- Startup intelligence
  s.total_god_score,
  s.team_score,
  s.market_score,
  s.product_score         AS execution_score,
  
  -- Timing calculation
  EXTRACT(EPOCH FROM (now() - COALESCE(f.last_signal_at, s.created_at))) / 3600 AS signal_age_hours,
  
  -- Match score (from precomputed matches if exists)
  m.match_score
  
FROM startup_uploads s
CROSS JOIN investors i

LEFT JOIN investor_startup_fomo_triggers f
  ON f.investor_id = i.id AND f.startup_id = s.id

LEFT JOIN investor_portfolio_adjacency adj
  ON adj.investor_id = i.id AND adj.startup_id = s.id

LEFT JOIN investor_behavior_summary beh
  ON beh.investor_id = i.id AND beh.startup_id = s.id

LEFT JOIN startup_investor_matches m
  ON m.investor_id = i.id AND m.startup_id = s.id

WHERE
  s.status = 'approved'
  AND (
    f.signal_7d > 0 
    OR adj.overlap_score > 0.3
    OR beh.recent_views > 0
    OR m.match_score >= 50
  );

CREATE INDEX idx_convergence_startup 
  ON startup_uploads (id) WHERE status = 'approved';

COMMENT ON VIEW convergence_candidates IS 
  'Complete convergence candidate pool with timing, FOMO, behavior, and adjacency signals';

-- ============================================================
-- 7. COMPARABLE STARTUPS (Social Proof Engine)
-- ============================================================

CREATE OR REPLACE VIEW comparable_startups AS
SELECT
  s1.id              AS for_startup_id,
  s2.id              AS comparable_id,
  s2.name,
  s2.total_god_score,
  
  -- Match count from precomputed matches
  (SELECT COUNT(*) 
   FROM startup_investor_matches m 
   WHERE m.startup_id = s2.id AND m.match_score >= 60
  ) AS matched_investors_count,
  
  -- Similarity score
  ABS(s1.total_god_score - s2.total_god_score) AS god_score_delta,
  
  -- Reason tags
  ARRAY_REMOVE(ARRAY[
    CASE WHEN ABS(s1.total_god_score - s2.total_god_score) < 10 THEN 'comparable_velocity' END
  ], NULL) AS reason_tags

FROM startup_uploads s1
JOIN startup_uploads s2
  ON ABS(s1.total_god_score - s2.total_god_score) < 15
  AND s1.id <> s2.id
  AND s2.status = 'approved'

WHERE s1.status = 'approved';

COMMENT ON VIEW comparable_startups IS 
  'Similar startups for social proof calibration';

-- ============================================================
-- 8. HELPER FUNCTIONS
-- ============================================================

-- Function: Get startup observer count (7d)
CREATE OR REPLACE FUNCTION get_observers_7d(p_startup_id uuid)
RETURNS int
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(observers_7d, 0)
  FROM startup_observers_7d
  WHERE startup_id = p_startup_id;
$$;

-- Function: Get startup FOMO state
CREATE OR REPLACE FUNCTION get_startup_fomo_state(p_startup_id uuid)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT 
    CASE
      WHEN MAX(total_god_score) >= 80 THEN 'breakout'
      WHEN MAX(total_god_score) >= 70 THEN 'surge'
      WHEN MAX(total_god_score) >= 60 THEN 'warming'
      ELSE 'watch'
    END
  FROM startup_uploads
  WHERE id = p_startup_id;
$$;

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
-- Next steps:
-- 1. Wire backend service to use convergence_candidates view
-- 2. Track observer events in scrapers (use scripts/seed-observer-clusters.js first)
-- 3. Populate portfolio_adjacency via nightly job
-- 4. Replace mock observer counts with real data
-- 
-- For production optimization at scale:
-- 1. Materialize convergence_candidates view (refresh every 5 min)
-- 2. Add Redis caching for hot startups
-- 3. Partition observer table by month
-- ============================================================
