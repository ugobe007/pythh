-- =====================================================
-- PHASE-CHANGE DETECTOR (Event-Based Momentum)
-- =====================================================
-- Purpose: Detect startup acceleration from behavioral signals
-- Replaces: GOD-based static phase_change with dynamic events

-- =====================================================
-- 1. STARTUP SIGNALS TABLE (Raw Events)
-- =====================================================

CREATE TABLE IF NOT EXISTS startup_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id uuid REFERENCES startup_uploads(id) ON DELETE CASCADE,
  signal_type text NOT NULL,
  weight numeric DEFAULT 1.0,
  occurred_at timestamptz DEFAULT now(),
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_startup_signals_startup_occurred 
  ON startup_signals(startup_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_startup_signals_type 
  ON startup_signals(signal_type);

CREATE INDEX IF NOT EXISTS idx_startup_signals_occurred 
  ON startup_signals(occurred_at DESC);

-- Signal types we track (enumerated for reference):
COMMENT ON TABLE startup_signals IS 
  'Behavioral signal events: website_diff, hiring, revenue_hint, api_launch, funding_rumor, press, forum_post, customer_proof, github_activity, portfolio_overlap, browse_similar, search, partner_view, news';

-- =====================================================
-- 2. ROLLING SIGNAL INTENSITY (Aggregates)
-- =====================================================

CREATE OR REPLACE VIEW startup_signal_rolling AS
SELECT
  startup_id,

  -- 24 hour window
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '24 hours') AS events_24h,
  COALESCE(SUM(weight) FILTER (WHERE occurred_at > now() - interval '24 hours'), 0) AS signal_24h,

  -- 7 day window
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '7 days') AS events_7d,
  COALESCE(SUM(weight) FILTER (WHERE occurred_at > now() - interval '7 days'), 0) AS signal_7d,

  -- 30 day baseline
  COUNT(*) FILTER (WHERE occurred_at > now() - interval '30 days') AS events_30d,
  COALESCE(SUM(weight) FILTER (WHERE occurred_at > now() - interval '30 days'), 0) AS signal_30d,

  MAX(occurred_at) AS last_signal_at

FROM startup_signals
GROUP BY startup_id;

COMMENT ON VIEW startup_signal_rolling IS 
  'Rolling time-window aggregates of startup signals (24h, 7d, 30d)';

-- =====================================================
-- 3. PHASE-CHANGE SCORE (0-1 with State Classification)
-- =====================================================

CREATE OR REPLACE VIEW startup_phase_change AS
WITH base AS (
  SELECT
    r.*,
    EXTRACT(EPOCH FROM (now() - r.last_signal_at))/3600.0 AS age_hours
  FROM startup_signal_rolling r
),
diversity AS (
  SELECT
    startup_id,
    COUNT(DISTINCT signal_type) FILTER (WHERE occurred_at > now() - interval '7 days') AS types_7d
  FROM startup_signals
  GROUP BY startup_id
),
scored AS (
  SELECT
    b.startup_id,
    b.signal_24h,
    b.signal_7d,
    b.signal_30d,
    b.events_7d,
    b.age_hours,
    COALESCE(d.types_7d, 0) AS types_7d,

    -- Intensity: compare recent vs baseline
    (b.signal_7d / NULLIF((b.signal_30d / 4.2857), 0)) AS intensity_ratio,

    -- Acceleration: 24h spike vs 7d average
    (b.signal_24h / NULLIF(b.signal_7d, 0)) AS accel_ratio,

    -- Recency decay (half-life ~72h)
    EXP(-LN(2) * (b.age_hours / 72.0)) AS recency_decay

  FROM base b
  LEFT JOIN diversity d ON d.startup_id = b.startup_id
)
SELECT
  startup_id,

  -- Phase-change score (0-1, weighted components)
  LEAST(1.0,
    GREATEST(0.0,
      (
        0.45 * LEAST(2.0, COALESCE(intensity_ratio, 0.0)) / 2.0 +
        0.25 * LEAST(1.0, COALESCE(accel_ratio, 0.0) * 2.0) +
        0.20 * recency_decay +
        0.10 * LEAST(1.0, types_7d / 6.0)
      )
    )
  ) AS phase_change_score,

  -- State classification (explainable)
  CASE
    WHEN (COALESCE(intensity_ratio,0) > 1.8 AND COALESCE(accel_ratio,0) > 0.35) THEN 'breakout'
    WHEN (COALESCE(intensity_ratio,0) > 1.3 AND types_7d >= 3) THEN 'inflecting'
    WHEN (COALESCE(intensity_ratio,0) > 1.0 AND types_7d >= 2) THEN 'forming'
    ELSE 'quiet'
  END AS phase_state,

  -- Raw components (for explainability)
  intensity_ratio,
  accel_ratio,
  recency_decay,
  types_7d,
  signal_7d,
  signal_24h

FROM scored;

COMMENT ON VIEW startup_phase_change IS 
  'Event-based phase change detection: intensity, acceleration, diversity, recency';

-- =====================================================
-- 4. OBSERVER EVENT INSERT FUNCTION (Canonical Interface)
-- =====================================================

CREATE OR REPLACE FUNCTION insert_observer_event(
  p_investor_id uuid,
  p_startup_id uuid,
  p_source text,
  p_weight numeric DEFAULT 1.0,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
  v_last_event timestamptz;
BEGIN
  -- Dedup check: max 1 event per investor+startup+source per 6 hours
  SELECT occurred_at INTO v_last_event
  FROM investor_startup_observers
  WHERE investor_id = p_investor_id
    AND startup_id = p_startup_id
    AND source = p_source
  ORDER BY occurred_at DESC
  LIMIT 1;

  -- If last event was < 6 hours ago, skip insert
  IF v_last_event IS NOT NULL AND v_last_event > now() - interval '6 hours' THEN
    RETURN NULL;
  END IF;

  -- Insert observer event
  INSERT INTO investor_startup_observers (
    investor_id,
    startup_id,
    source,
    weight,
    occurred_at,
    meta
  )
  VALUES (
    p_investor_id,
    p_startup_id,
    p_source,
    p_weight,
    now(),
    p_meta
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

COMMENT ON FUNCTION insert_observer_event IS 
  'Canonical observer event insert with 6-hour dedup window';

-- =====================================================
-- 5. STARTUP SIGNAL INSERT FUNCTION (For Scrapers)
-- =====================================================

CREATE OR REPLACE FUNCTION insert_startup_signal(
  p_startup_id uuid,
  p_signal_type text,
  p_weight numeric DEFAULT 1.0,
  p_meta jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_signal_id uuid;
BEGIN
  INSERT INTO startup_signals (
    startup_id,
    signal_type,
    weight,
    occurred_at,
    meta
  )
  VALUES (
    p_startup_id,
    p_signal_type,
    p_weight,
    now(),
    p_meta
  )
  RETURNING id INTO v_signal_id;

  RETURN v_signal_id;
END;
$$;

COMMENT ON FUNCTION insert_startup_signal IS 
  'Insert startup signal event (website_diff, hiring, press, etc.)';

-- =====================================================
-- 6. GRANT PERMISSIONS
-- =====================================================

GRANT SELECT ON startup_signals TO anon, authenticated;
GRANT SELECT ON startup_signal_rolling TO anon, authenticated;
GRANT SELECT ON startup_phase_change TO anon, authenticated;

-- Service role can insert
GRANT ALL ON startup_signals TO service_role;
GRANT EXECUTE ON FUNCTION insert_observer_event TO service_role;
GRANT EXECUTE ON FUNCTION insert_startup_signal TO service_role;
