-- Migration: Oracle Engagement & Retention System
-- Adds tables for notifications, digests, score tracking, and user engagement

-- ============================================================
-- ORACLE SCORE HISTORY
-- Track score improvements over time
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    startup_id UUID REFERENCES public.startup_uploads(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.oracle_sessions(id) ON DELETE SET NULL,
    
    -- Score data
    total_score NUMERIC(4,2) NOT NULL CHECK (total_score >= 0 AND total_score <= 100),
    breakdown JSONB,  -- { team: 85, traction: 60, market: 72, product: 68, execution: 75 }
    
    -- Context
    milestone TEXT,  -- "Completed wizard", "Added team member", "Revenue milestone"
    notes TEXT,
    
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_score_history_user_id ON public.oracle_score_history(user_id);
CREATE INDEX idx_oracle_score_history_recorded_at ON public.oracle_score_history(recorded_at DESC);
CREATE INDEX idx_oracle_score_history_startup_id ON public.oracle_score_history(startup_id);

ALTER TABLE public.oracle_score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own score history" ON public.oracle_score_history
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own score history" ON public.oracle_score_history
    FOR INSERT WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_score_history IS 'Track fundraising readiness score improvements over time';

-- ============================================================
-- ORACLE NOTIFICATIONS
-- In-app notifications for new insights, tasks, etc.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Notification details
    type TEXT NOT NULL CHECK (type IN (
        'new_insight', 'task_reminder', 'score_update', 'milestone', 
        'market_update', 'investor_activity', 'weekly_digest', 'action_due'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    
    -- Metadata
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category TEXT,  -- 'coaching', 'action', 'market', 'social'
    
    -- Links
    action_url TEXT,  -- Where to go when clicked
    related_insight_id UUID REFERENCES public.oracle_insights(id) ON DELETE SET NULL,
    related_action_id UUID REFERENCES public.oracle_actions(id) ON DELETE SET NULL,
    related_session_id UUID REFERENCES public.oracle_sessions(id) ON DELETE SET NULL,
    
    -- State
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    is_clicked BOOLEAN DEFAULT false,
    clicked_at TIMESTAMPTZ,
    
    -- Delivery
    sent_via_email BOOLEAN DEFAULT false,
    sent_via_push BOOLEAN DEFAULT false,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_notifications_user_id ON public.oracle_notifications(user_id);
CREATE INDEX idx_oracle_notifications_unread ON public.oracle_notifications(user_id, is_read) 
    WHERE is_read = false;
CREATE INDEX idx_oracle_notifications_created_at ON public.oracle_notifications(created_at DESC);
CREATE INDEX idx_oracle_notifications_type ON public.oracle_notifications(type);

ALTER TABLE public.oracle_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications" ON public.oracle_notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON public.oracle_notifications
    FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_notifications IS 'In-app notifications and alerts for Oracle users';

-- ============================================================
-- ORACLE DIGEST SCHEDULE
-- Control weekly digest delivery preferences
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_digest_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Preferences
    enabled BOOLEAN DEFAULT true,
    frequency TEXT DEFAULT 'weekly' CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
    day_of_week INTEGER DEFAULT 1 CHECK (day_of_week >= 0 AND day_of_week <= 6),  -- 0=Sunday, 1=Monday
    time_of_day TIME DEFAULT '09:00:00',
    timezone TEXT DEFAULT 'America/Los_Angeles',
    
    -- Content preferences
    include_insights BOOLEAN DEFAULT true,
    include_actions BOOLEAN DEFAULT true,
    include_market_updates BOOLEAN DEFAULT true,
    include_score_tracking BOOLEAN DEFAULT true,
    
    -- Delivery tracking
    last_sent_at TIMESTAMPTZ,
    next_scheduled_at TIMESTAMPTZ,
    consecutive_opens INTEGER DEFAULT 0,  -- Streak tracking
    total_opens INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_digest_schedule_user_id ON public.oracle_digest_schedule(user_id);
CREATE INDEX idx_oracle_digest_schedule_next_scheduled ON public.oracle_digest_schedule(next_scheduled_at)
    WHERE enabled = true;

ALTER TABLE public.oracle_digest_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own digest schedule" ON public.oracle_digest_schedule
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own digest schedule" ON public.oracle_digest_schedule
    FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_digest_schedule IS 'User preferences for Oracle weekly digest emails';

-- ============================================================
-- ORACLE ENGAGEMENT EVENTS
-- Track user interactions for analytics
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_engagement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.oracle_sessions(id) ON DELETE SET NULL,
    
    -- Event details
    event_type TEXT NOT NULL,  -- 'wizard_started', 'step_completed', 'insight_viewed', etc.
    event_data JSONB,  -- Flexible event metadata
    
    -- Context
    source TEXT,  -- 'web', 'email_link', 'push_notification'
    page_url TEXT,
    
    -- Timing
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_engagement_user_id ON public.oracle_engagement_events(user_id);
CREATE INDEX idx_oracle_engagement_timestamp ON public.oracle_engagement_events(event_timestamp DESC);
CREATE INDEX idx_oracle_engagement_type ON public.oracle_engagement_events(event_type);
CREATE INDEX idx_oracle_engagement_session_id ON public.oracle_engagement_events(session_id);

-- No RLS - allow system to write freely
GRANT INSERT ON public.oracle_engagement_events TO authenticated;

COMMENT ON TABLE public.oracle_engagement_events IS 'Track user engagement with Oracle for analytics and retention';

-- ============================================================
-- ORACLE MILESTONES
-- Define and track achievement milestones
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Milestone definition
    milestone_type TEXT NOT NULL,  -- 'wizard_complete', 'first_insight', '5_actions_done', 'score_70_plus'
    title TEXT NOT NULL,
    description TEXT,
    icon TEXT,  -- Emoji or icon identifier
    
    -- Achievement
    achieved_at TIMESTAMPTZ,
    is_celebrated BOOLEAN DEFAULT false,  -- Whether user saw celebration modal
    celebrated_at TIMESTAMPTZ,
    
    -- Rewards
    reward_text TEXT,  -- "Unlocked: Investor Matching"
    reward_action_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_milestones_user_id ON public.oracle_milestones(user_id);
CREATE INDEX idx_oracle_milestones_achieved ON public.oracle_milestones(user_id, achieved_at)
    WHERE achieved_at IS NOT NULL;

ALTER TABLE public.oracle_milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones" ON public.oracle_milestones
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create milestones" ON public.oracle_milestones
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own milestones" ON public.oracle_milestones
    FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_milestones IS 'Track and celebrate user achievements in Oracle';

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON public.oracle_score_history TO authenticated;
GRANT ALL ON public.oracle_notifications TO authenticated;
GRANT ALL ON public.oracle_digest_schedule TO authenticated;
GRANT ALL ON public.oracle_engagement_events TO authenticated;
GRANT ALL ON public.oracle_milestones TO authenticated;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION public.mark_oracle_notification_read(notification_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.oracle_notifications
    SET is_read = true, read_at = NOW()
    WHERE id = notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get unread notification count
CREATE OR REPLACE FUNCTION public.get_oracle_unread_count(p_user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.oracle_notifications
        WHERE user_id = p_user_id AND is_read = false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPLETE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Oracle engagement system tables created successfully';
    RAISE NOTICE '   - oracle_score_history: Track score improvements';
    RAISE NOTICE '   - oracle_notifications: In-app notifications';
    RAISE NOTICE '   - oracle_digest_schedule: Email preferences';
    RAISE NOTICE '   - oracle_engagement_events: Analytics tracking';
    RAISE NOTICE '   - oracle_milestones: Achievement system';
END $$;
