-- Migration: Oracle Scribe Journal System
-- Allows startups to journal activities, notes, and ideas
-- Oracle analyzes entries and generates actionable guidance

-- ============================================================
-- ORACLE SCRIBE ENTRIES
-- Journal entries with AI analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_scribe_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.oracle_sessions(id) ON DELETE SET NULL,
    
    -- Entry content
    title TEXT NOT NULL,
    content TEXT NOT NULL,  -- Main journal text
    entry_type TEXT DEFAULT 'general' CHECK (entry_type IN (
        'general', 'progress', 'challenge', 'idea', 'learning', 
        'meeting', 'milestone', 'reflection'
    )),
    
    -- Tagging and categorization
    tags TEXT[],  -- Array of user-defined tags
    category TEXT,  -- 'product', 'team', 'fundraising', 'marketing', 'operations'
    
    -- Mood/sentiment tracking
    mood TEXT CHECK (mood IN ('excited', 'optimistic', 'neutral', 'concerned', 'frustrated', 'stressed')),
    energy_level INTEGER CHECK (energy_level >= 1 AND energy_level <= 5),
    
    -- Analysis state
    is_analyzed BOOLEAN DEFAULT false,
    analyzed_at TIMESTAMPTZ,
    analysis_summary TEXT,  -- AI-generated summary
    
    -- Metadata
    word_count INTEGER,
    reading_time_minutes INTEGER,
    is_private BOOLEAN DEFAULT false,  -- Private entries not shared with team
    is_pinned BOOLEAN DEFAULT false,
    
    -- Timestamps
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- User-selected date (can be backdated)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_scribe_user_id ON public.oracle_scribe_entries(user_id);
CREATE INDEX idx_oracle_scribe_startup_id ON public.oracle_scribe_entries(startup_id);
CREATE INDEX idx_oracle_scribe_entry_date ON public.oracle_scribe_entries(entry_date DESC);
CREATE INDEX idx_oracle_scribe_analyzed ON public.oracle_scribe_entries(is_analyzed, analyzed_at)
    WHERE is_analyzed = false;
CREATE INDEX idx_oracle_scribe_tags ON public.oracle_scribe_entries USING GIN(tags);
CREATE INDEX idx_oracle_scribe_type ON public.oracle_scribe_entries(entry_type);

ALTER TABLE public.oracle_scribe_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scribe entries" ON public.oracle_scribe_entries
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own scribe entries" ON public.oracle_scribe_entries
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scribe entries" ON public.oracle_scribe_entries
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scribe entries" ON public.oracle_scribe_entries
    FOR DELETE USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_scribe_entries IS 'Oracle Scribe journal entries with AI analysis';

-- ============================================================
-- ORACLE SCRIBE INSIGHTS
-- AI-generated insights from journal entries
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_scribe_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES public.oracle_scribe_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Insight details
    insight_type TEXT NOT NULL CHECK (insight_type IN (
        'action_item', 'warning', 'opportunity', 'pattern', 'suggestion', 'encouragement'
    )),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Priority and impact
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    estimated_impact INTEGER CHECK (estimated_impact >= 1 AND estimated_impact <= 5),
    
    -- Actionability
    is_actionable BOOLEAN DEFAULT false,
    suggested_due_date DATE,
    estimated_effort TEXT,  -- 'quick', 'medium', 'substantial'
    
    -- Linked actions
    action_created BOOLEAN DEFAULT false,
    action_id UUID REFERENCES public.oracle_actions(id) ON DELETE SET NULL,
    
    -- User interaction
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_at TIMESTAMPTZ,
    user_feedback TEXT,  -- User can comment on insight quality
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_scribe_insights_entry ON public.oracle_scribe_insights(entry_id);
CREATE INDEX idx_oracle_scribe_insights_user ON public.oracle_scribe_insights(user_id);
CREATE INDEX idx_oracle_scribe_insights_type ON public.oracle_scribe_insights(insight_type);
CREATE INDEX idx_oracle_scribe_insights_actionable ON public.oracle_scribe_insights(is_actionable)
    WHERE is_actionable = true AND action_created = false;

ALTER TABLE public.oracle_scribe_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scribe insights" ON public.oracle_scribe_insights
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own scribe insights" ON public.oracle_scribe_insights
    FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_scribe_insights IS 'AI-generated insights and actions from Scribe journal entries';

-- ============================================================
-- ORACLE SCRIBE PATTERNS
-- Detected patterns across journal entries
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_scribe_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
    
    -- Pattern details
    pattern_type TEXT NOT NULL,  -- 'recurring_challenge', 'growth_trend', 'energy_cycle', 'focus_area'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    
    -- Evidence
    entry_ids UUID[],  -- Array of related entry IDs
    first_detected_at TIMESTAMPTZ NOT NULL,
    last_observed_at TIMESTAMPTZ NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    
    -- Analysis
    trend_direction TEXT CHECK (trend_direction IN ('improving', 'declining', 'stable', 'cyclical')),
    confidence_score NUMERIC(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    
    -- Recommendations
    recommended_action TEXT,
    is_addressed BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_scribe_patterns_user ON public.oracle_scribe_patterns(user_id);
CREATE INDEX idx_oracle_scribe_patterns_startup ON public.oracle_scribe_patterns(startup_id);
CREATE INDEX idx_oracle_scribe_patterns_type ON public.oracle_scribe_patterns(pattern_type);
CREATE INDEX idx_oracle_scribe_patterns_unaddressed ON public.oracle_scribe_patterns(is_addressed)
    WHERE is_addressed = false;

ALTER TABLE public.oracle_scribe_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scribe patterns" ON public.oracle_scribe_patterns
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_scribe_patterns IS 'Detected patterns and trends across Scribe journal entries';

-- ============================================================
-- ORACLE SCRIBE STATISTICS
-- Journaling statistics and streaks
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_scribe_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Streak tracking
    current_streak_days INTEGER DEFAULT 0,
    longest_streak_days INTEGER DEFAULT 0,
    last_entry_date DATE,
    
    -- Volume stats
    total_entries INTEGER DEFAULT 0,
    total_words INTEGER DEFAULT 0,
    total_insights_generated INTEGER DEFAULT 0,
    total_actions_created INTEGER DEFAULT 0,
    
    -- Activity by type
    entries_by_type JSONB DEFAULT '{}'::JSONB,  -- { "general": 10, "progress": 5, ... }
    avg_words_per_entry NUMERIC(8,2),
    
    -- Engagement
    most_journaled_day_of_week INTEGER,  -- 0-6
    most_journaled_hour INTEGER,  -- 0-23
    avg_entries_per_week NUMERIC(4,2),
    
    -- Mood trends
    mood_distribution JSONB DEFAULT '{}'::JSONB,  -- { "excited": 15, "optimistic": 20, ... }
    avg_energy_level NUMERIC(3,2),
    
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_scribe_stats_user ON public.oracle_scribe_stats(user_id);

ALTER TABLE public.oracle_scribe_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scribe stats" ON public.oracle_scribe_stats
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own scribe stats" ON public.oracle_scribe_stats
    FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_scribe_stats IS 'Journaling statistics and streak tracking for Scribe';

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON public.oracle_scribe_entries TO authenticated;
GRANT ALL ON public.oracle_scribe_insights TO authenticated;
GRANT ALL ON public.oracle_scribe_patterns TO authenticated;
GRANT ALL ON public.oracle_scribe_stats TO authenticated;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to update scribe stats after new entry
CREATE OR REPLACE FUNCTION public.update_oracle_scribe_stats()
RETURNS TRIGGER AS $$
DECLARE
    v_word_count INTEGER;
    v_current_streak INTEGER;
    v_last_date DATE;
BEGIN
    -- Calculate word count
    v_word_count := array_length(string_to_array(NEW.content, ' '), 1);
    
    -- Update entry metadata
    NEW.word_count := v_word_count;
    NEW.reading_time_minutes := GREATEST(1, ROUND(v_word_count / 200.0));  -- ~200 words/min
    
    -- Upsert stats record
    INSERT INTO public.oracle_scribe_stats (user_id, total_entries, total_words, last_entry_date)
    VALUES (NEW.user_id, 1, v_word_count, NEW.entry_date)
    ON CONFLICT (user_id) DO UPDATE SET
        total_entries = oracle_scribe_stats.total_entries + 1,
        total_words = oracle_scribe_stats.total_words + v_word_count,
        last_entry_date = NEW.entry_date,
        avg_words_per_entry = (oracle_scribe_stats.total_words + v_word_count) / (oracle_scribe_stats.total_entries + 1.0),
        updated_at = NOW();
    
    -- Update streak
    SELECT last_entry_date, current_streak_days INTO v_last_date, v_current_streak
    FROM public.oracle_scribe_stats
    WHERE user_id = NEW.user_id;
    
    IF v_last_date IS NOT NULL THEN
        IF NEW.entry_date = v_last_date + INTERVAL '1 day' THEN
            -- Continue streak
            UPDATE public.oracle_scribe_stats
            SET 
                current_streak_days = current_streak_days + 1,
                longest_streak_days = GREATEST(longest_streak_days, current_streak_days + 1)
            WHERE user_id = NEW.user_id;
        ELSIF NEW.entry_date > v_last_date + INTERVAL '1 day' THEN
            -- Streak broken
            UPDATE public.oracle_scribe_stats
            SET current_streak_days = 1
            WHERE user_id = NEW.user_id;
        END IF;
    ELSE
        -- First entry
        UPDATE public.oracle_scribe_stats
        SET current_streak_days = 1, longest_streak_days = 1
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scribe_stats
    BEFORE INSERT ON public.oracle_scribe_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_oracle_scribe_stats();

-- Function to mark entry as analyzed
CREATE OR REPLACE FUNCTION public.mark_scribe_entry_analyzed(
    p_entry_id UUID,
    p_summary TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE public.oracle_scribe_entries
    SET 
        is_analyzed = true,
        analyzed_at = NOW(),
        analysis_summary = COALESCE(p_summary, analysis_summary)
    WHERE id = p_entry_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPLETE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Oracle Scribe journal system created successfully';
    RAISE NOTICE '   - oracle_scribe_entries: Journal entries with AI analysis';
    RAISE NOTICE '   - oracle_scribe_insights: Generated insights and actions';
    RAISE NOTICE '   - oracle_scribe_patterns: Detected patterns across entries';
    RAISE NOTICE '   - oracle_scribe_stats: Journaling statistics and streaks';
END $$;
