-- Migration: Oracle System Tables
-- Creates tables for Oracle wizard sessions, actions, and insights
-- Run in Supabase SQL Editor

-- ============================================================
-- ORACLE SESSIONS TABLE
-- Stores wizard session state and progress
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
    
    -- Session metadata
    status TEXT NOT NULL DEFAULT 'in_progress' 
        CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    current_step INTEGER DEFAULT 1 CHECK (current_step >= 1 AND current_step <= 8),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    
    -- Wizard step data (JSONB for flexibility)
    step_1_stage JSONB,          -- Stage selection
    step_2_problem JSONB,         -- Problem definition
    step_3_solution JSONB,        -- Solution description
    step_4_traction JSONB,        -- Traction metrics
    step_5_team JSONB,            -- Team details
    step_6_pitch JSONB,           -- Pitch refinement
    step_7_vision JSONB,          -- Vision statement
    step_8_market JSONB,          -- Market analysis
    
    -- Computed outputs
    signal_score NUMERIC(4,2) CHECK (signal_score >= 0 AND signal_score <= 10),
    strengths TEXT[],             -- Array of strength statements
    weaknesses TEXT[],            -- Array of weakness statements
    recommendations TEXT[],       -- Array of recommendations
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    last_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for oracle_sessions
CREATE INDEX IF NOT EXISTS idx_oracle_sessions_user_id ON public.oracle_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_sessions_startup_id ON public.oracle_sessions(startup_id);
CREATE INDEX IF NOT EXISTS idx_oracle_sessions_status ON public.oracle_sessions(status);
CREATE INDEX IF NOT EXISTS idx_oracle_sessions_started_at ON public.oracle_sessions(started_at DESC);

-- RLS for oracle_sessions
ALTER TABLE public.oracle_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own sessions" ON public.oracle_sessions;
CREATE POLICY "Users can view own sessions" ON public.oracle_sessions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON public.oracle_sessions;
CREATE POLICY "Users can create own sessions" ON public.oracle_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.oracle_sessions;
CREATE POLICY "Users can update own sessions" ON public.oracle_sessions
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.oracle_sessions;
CREATE POLICY "Users can delete own sessions" ON public.oracle_sessions
    FOR DELETE USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_oracle_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    NEW.last_updated_at = NOW();
    
    -- Update progress percentage based on completed steps
    NEW.progress_percentage = (
        (CASE WHEN NEW.step_1_stage IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.step_2_problem IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.step_3_solution IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.step_4_traction IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.step_5_team IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.step_6_pitch IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.step_7_vision IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN NEW.step_8_market IS NOT NULL THEN 1 ELSE 0 END) * 100 / 8
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oracle_sessions_updated_at ON public.oracle_sessions;
CREATE TRIGGER oracle_sessions_updated_at
    BEFORE UPDATE ON public.oracle_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_oracle_sessions_updated_at();

-- Comments
COMMENT ON TABLE public.oracle_sessions IS 'Oracle wizard session data and progress tracking';
COMMENT ON COLUMN public.oracle_sessions.status IS 'Session status: in_progress, completed, abandoned';
COMMENT ON COLUMN public.oracle_sessions.current_step IS 'Current wizard step (1-8)';
COMMENT ON COLUMN public.oracle_sessions.signal_score IS 'Computed signal score (0-10 scale)';

-- ============================================================
-- ORACLE ACTIONS TABLE
-- Stores recommended actions and their completion status
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.oracle_sessions(id) ON DELETE CASCADE,
    
    -- Action details
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'traction', 'team', 'product', 'market', 'fundraising', 
        'signals', 'positioning', 'strategy', 'execution', 'other'
    )),
    
    -- Status and priority
    status TEXT NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'blocked')),
    priority TEXT NOT NULL DEFAULT 'medium' 
        CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Impact and effort
    impact_score INTEGER CHECK (impact_score >= 1 AND impact_score <= 10),
    effort_estimate TEXT CHECK (effort_estimate IN ('quick', 'hours', 'days', 'weeks', 'months')),
    
    -- Tracking
    assigned_to TEXT,             -- Person responsible
    due_date DATE,
    completed_at TIMESTAMPTZ,
    blocked_reason TEXT,
    notes TEXT,
    
    -- Order for display
    display_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for oracle_actions
CREATE INDEX IF NOT EXISTS idx_oracle_actions_user_id ON public.oracle_actions(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_actions_startup_id ON public.oracle_actions(startup_id);
CREATE INDEX IF NOT EXISTS idx_oracle_actions_session_id ON public.oracle_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_oracle_actions_status ON public.oracle_actions(status);
CREATE INDEX IF NOT EXISTS idx_oracle_actions_priority ON public.oracle_actions(priority);
CREATE INDEX IF NOT EXISTS idx_oracle_actions_due_date ON public.oracle_actions(due_date)
    WHERE status NOT IN ('completed', 'skipped');

-- RLS for oracle_actions
ALTER TABLE public.oracle_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own actions" ON public.oracle_actions;
CREATE POLICY "Users can view own actions" ON public.oracle_actions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own actions" ON public.oracle_actions;
CREATE POLICY "Users can create own actions" ON public.oracle_actions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own actions" ON public.oracle_actions;
CREATE POLICY "Users can update own actions" ON public.oracle_actions
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own actions" ON public.oracle_actions;
CREATE POLICY "Users can delete own actions" ON public.oracle_actions
    FOR DELETE USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_oracle_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set completed_at when status changes to completed
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        NEW.completed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oracle_actions_updated_at ON public.oracle_actions;
CREATE TRIGGER oracle_actions_updated_at
    BEFORE UPDATE ON public.oracle_actions
    FOR EACH ROW EXECUTE FUNCTION public.update_oracle_actions_updated_at();

-- Comments
COMMENT ON TABLE public.oracle_actions IS 'Oracle recommended actions and task tracking';
COMMENT ON COLUMN public.oracle_actions.impact_score IS 'Estimated impact on signal score (1-10)';
COMMENT ON COLUMN public.oracle_actions.effort_estimate IS 'Time estimate: quick, hours, days, weeks, months';

-- ============================================================
-- ORACLE INSIGHTS TABLE
-- Stores AI-generated insights and coaching
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.oracle_sessions(id) ON DELETE SET NULL,
    
    -- Insight details
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'strength', 'weakness', 'opportunity', 'threat', 'prediction', 
        'recommendation', 'warning', 'coaching', 'vc_alignment', 'market_timing'
    )),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    
    -- Metadata
    confidence NUMERIC(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category TEXT,               -- Related category (traction, team, etc.)
    
    -- Source information
    source TEXT NOT NULL DEFAULT 'oracle_ai',  -- Where insight came from
    model_version TEXT,          -- AI model version used
    
    -- Display settings
    is_dismissed BOOLEAN DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    is_pinned BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    
    -- Tracking
    viewed_at TIMESTAMPTZ,
    acted_on BOOLEAN DEFAULT false,
    related_action_id UUID REFERENCES public.oracle_actions(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for oracle_insights
CREATE INDEX IF NOT EXISTS idx_oracle_insights_user_id ON public.oracle_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_oracle_insights_startup_id ON public.oracle_insights(startup_id);
CREATE INDEX IF NOT EXISTS idx_oracle_insights_session_id ON public.oracle_insights(session_id);
CREATE INDEX IF NOT EXISTS idx_oracle_insights_type ON public.oracle_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_oracle_insights_created_at ON public.oracle_insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_insights_active ON public.oracle_insights(user_id, is_dismissed)
    WHERE is_dismissed = false;

-- RLS for oracle_insights
ALTER TABLE public.oracle_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own insights" ON public.oracle_insights;
CREATE POLICY "Users can view own insights" ON public.oracle_insights
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own insights" ON public.oracle_insights;
CREATE POLICY "Users can create own insights" ON public.oracle_insights
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own insights" ON public.oracle_insights;
CREATE POLICY "Users can update own insights" ON public.oracle_insights
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own insights" ON public.oracle_insights;
CREATE POLICY "Users can delete own insights" ON public.oracle_insights
    FOR DELETE USING (auth.uid() = user_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_oracle_insights_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    
    -- Set dismissed_at when is_dismissed changes to true
    IF NEW.is_dismissed = true AND OLD.is_dismissed = false THEN
        NEW.dismissed_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS oracle_insights_updated_at ON public.oracle_insights;
CREATE TRIGGER oracle_insights_updated_at
    BEFORE UPDATE ON public.oracle_insights
    FOR EACH ROW EXECUTE FUNCTION public.update_oracle_insights_updated_at();

-- Comments
COMMENT ON TABLE public.oracle_insights IS 'Oracle AI-generated insights and coaching recommendations';
COMMENT ON COLUMN public.oracle_insights.confidence IS 'AI confidence score (0-1)';
COMMENT ON COLUMN public.oracle_insights.insight_type IS 'Type of insight: strength, weakness, opportunity, threat, prediction, etc.';

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON public.oracle_sessions TO authenticated;
GRANT ALL ON public.oracle_actions TO authenticated;
GRANT ALL ON public.oracle_insights TO authenticated;

-- ============================================================
-- COMPLETE
-- ============================================================

-- Verify tables created
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oracle_sessions') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oracle_actions') AND
       EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'oracle_insights') THEN
        RAISE NOTICE '✅ Oracle tables created successfully';
    ELSE
        RAISE EXCEPTION '❌ Oracle tables creation failed - check errors above';
    END IF;
END $$;
