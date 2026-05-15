-- =============================================================================
-- VC INTELLIGENCE — thesis profiling, deal positioning, hot startup discovery
-- =============================================================================

-- ─── VC Intelligence Profiles ───────────────────────────────────────────────
-- Stores scraped + LLM-extracted thesis profiles for VC firms and partners.
-- Think: FBI profile dossiers on how each investor thinks.
CREATE TABLE IF NOT EXISTS public.vc_intelligence (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id         uuid REFERENCES public.investors(id) ON DELETE CASCADE,
  firm_name           text NOT NULL,
  firm_url            text,

  -- Raw scraped data
  blog_posts          jsonb DEFAULT '[]'::jsonb,   -- [{title, url, date, excerpt, signals[]}]
  rss_articles        jsonb DEFAULT '[]'::jsonb,   -- [{title, url, date, summary}]
  social_signals      jsonb DEFAULT '[]'::jsonb,   -- [{platform, text, date, engagement}]
  portfolio_signals   jsonb DEFAULT '[]'::jsonb,   -- inferred patterns from known portfolio

  -- LLM-extracted thesis profile
  thesis_summary      text,                         -- 2-3 sentence synthesis of investment thesis
  sector_preferences  text[]  DEFAULT '{}',         -- sectors they clearly favor
  stage_preferences   text[]  DEFAULT '{}',         -- seed, series-a, growth, etc.
  check_size_range    jsonb   DEFAULT '{}'::jsonb,  -- {min_usd, max_usd}
  investment_signals  jsonb   DEFAULT '[]'::jsonb,  -- [{signal, weight, evidence_quote}]
  red_flags           text[]  DEFAULT '{}',         -- things they explicitly avoid
  value_add_claims    text[]  DEFAULT '{}',         -- what they claim to offer beyond capital
  language_patterns   jsonb   DEFAULT '[]'::jsonb,  -- [{phrase, frequency, context}] — how they talk

  -- Personality / communication profile
  personality_profile text,                         -- analytical|storyteller|contrarian|operator|thesis-driven
  communication_style text,                         -- dense|accessible|metrics-first|narrative-first
  key_themes          text[]  DEFAULT '{}',         -- recurring investment theses

  -- Sourcing intelligence
  typical_intro_path  text,                         -- warm intro, cold email, conference, etc.
  best_outreach_hook  text,                         -- what angle resonates most based on signals

  -- Meta
  scraped_at          timestamptz,
  profiled_at         timestamptz,
  profile_version     int     DEFAULT 1,
  confidence          numeric DEFAULT 0,            -- 0.0–1.0, based on content richness
  source_count        int     DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vc_intel_investor  ON public.vc_intelligence (investor_id) WHERE investor_id IS NOT NULL;
CREATE        INDEX IF NOT EXISTS idx_vc_intel_firm      ON public.vc_intelligence (firm_name);
CREATE        INDEX IF NOT EXISTS idx_vc_intel_profiled  ON public.vc_intelligence (profiled_at DESC);
CREATE        INDEX IF NOT EXISTS idx_vc_intel_conf      ON public.vc_intelligence (confidence DESC);

ALTER TABLE public.vc_intelligence ENABLE ROW LEVEL SECURITY;
CREATE POLICY vc_intel_read  ON public.vc_intelligence FOR SELECT USING (true);
CREATE POLICY vc_intel_write ON public.vc_intelligence FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.vc_intelligence IS
  'FBI-style VC dossiers: scraped thesis, language patterns, red flags, personality profiles.';

-- ─── Deal Positioning ────────────────────────────────────────────────────────
-- For each startup × investor pair, stores AI-generated deal positioning.
-- Tells you exactly how to pitch startup X to VC Y based on their thesis.
CREATE TABLE IF NOT EXISTS public.vc_deal_positioning (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  startup_id          uuid NOT NULL REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
  investor_id         uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  intel_id            uuid REFERENCES public.vc_intelligence(id) ON DELETE SET NULL,

  -- Match quality
  thesis_alignment    numeric DEFAULT 0,   -- 0–100: how well startup fits VC thesis
  sector_fit          text,                -- 'perfect' | 'strong' | 'adjacent' | 'stretch'
  stage_fit           text,                -- 'on-target' | 'early' | 'late'

  -- AI-generated positioning strategy
  positioning_angle   text,               -- the hook: what makes this compelling for THIS VC
  key_signals         text[] DEFAULT '{}', -- 3-5 things to emphasize
  signals_to_avoid    text[] DEFAULT '{}', -- things that conflict with their thesis
  suggested_subject   text,               -- subject line optimized for this investor
  suggested_opening   text,               -- opening paragraph
  talking_points      jsonb DEFAULT '[]'::jsonb, -- [{point, evidence, investor_resonance}]

  -- Metadata
  model_used          text DEFAULT 'gpt-4o',
  created_at          timestamptz DEFAULT now(),
  refreshed_at        timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_positioning_pair ON public.vc_deal_positioning (startup_id, investor_id);
CREATE        INDEX IF NOT EXISTS idx_positioning_startup   ON public.vc_deal_positioning (startup_id);
CREATE        INDEX IF NOT EXISTS idx_positioning_investor  ON public.vc_deal_positioning (investor_id);
CREATE        INDEX IF NOT EXISTS idx_positioning_align     ON public.vc_deal_positioning (thesis_alignment DESC);

ALTER TABLE public.vc_deal_positioning ENABLE ROW LEVEL SECURITY;
CREATE POLICY pos_read  ON public.vc_deal_positioning FOR SELECT USING (true);
CREATE POLICY pos_write ON public.vc_deal_positioning FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.vc_deal_positioning IS
  'AI-generated deal positioning: how to pitch startup X to investor Y based on their thesis profile.';

-- ─── Hot Startup Discoveries ─────────────────────────────────────────────────
-- Automated discovery queue: startups found by the intelligence agent
-- from RSS feeds, ProductHunt, Hacker News, VC tweets, etc.
CREATE TABLE IF NOT EXISTS public.hot_startup_discoveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discovered_at   timestamptz NOT NULL DEFAULT now(),
  source          text NOT NULL,          -- 'producthunt'|'hackernews'|'vc_rss'|'techcrunch'|'crunchbase'|'twitter'
  source_url      text,
  company_name    text,
  company_url     text,
  headline        text,
  summary         text,
  signals         text[] DEFAULT '{}',    -- extracted signal types: 'funding','launch','hiring'
  sector_guess    text,
  stage_guess     text,
  heat_score      int DEFAULT 0,          -- 0-100: virality/signal strength
  vc_mentioned    text[] DEFAULT '{}',    -- VC names mentioned in coverage
  startup_id      uuid REFERENCES public.startup_uploads(id), -- linked if already in DB
  status          text DEFAULT 'queued'   -- 'queued'|'submitted'|'skipped'|'duplicate'
    CHECK (status IN ('queued','submitted','skipped','duplicate')),
  submitted_at    timestamptz,
  notes           text
);

CREATE INDEX IF NOT EXISTS idx_hot_disc_source    ON public.hot_startup_discoveries (source);
CREATE INDEX IF NOT EXISTS idx_hot_disc_status    ON public.hot_startup_discoveries (status);
CREATE INDEX IF NOT EXISTS idx_hot_disc_heat      ON public.hot_startup_discoveries (heat_score DESC);
CREATE INDEX IF NOT EXISTS idx_hot_disc_date      ON public.hot_startup_discoveries (discovered_at DESC);

ALTER TABLE public.hot_startup_discoveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY hot_disc_read  ON public.hot_startup_discoveries FOR SELECT USING (true);
CREATE POLICY hot_disc_write ON public.hot_startup_discoveries FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMENT ON TABLE public.hot_startup_discoveries IS
  'Automated startup discovery queue: companies surfaced by intelligence agent from web sources.';

-- ─── Updated_at trigger for vc_intelligence ──────────────────────────────────
CREATE OR REPLACE FUNCTION update_vc_intel_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vc_intel_updated_at ON public.vc_intelligence;
CREATE TRIGGER trg_vc_intel_updated_at
  BEFORE UPDATE ON public.vc_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_vc_intel_updated_at();

-- Grant service role full access
GRANT ALL ON public.vc_intelligence         TO service_role;
GRANT ALL ON public.vc_deal_positioning     TO service_role;
GRANT ALL ON public.hot_startup_discoveries TO service_role;
GRANT SELECT ON public.vc_intelligence         TO anon, authenticated;
GRANT SELECT ON public.vc_deal_positioning     TO anon, authenticated;
GRANT SELECT ON public.hot_startup_discoveries TO anon, authenticated;
