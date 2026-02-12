-- Migration: Oracle Advanced Email Features
-- Adds email click tracking, A/B testing, and drip campaign support

-- ============================================================
-- EMAIL CAMPAIGNS (A/B Testing & Drip Sequences)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Campaign details
    name TEXT NOT NULL,
    campaign_type TEXT NOT NULL CHECK (campaign_type IN ('digest', 'drip', 'one-off', 'ab_test')),
    description TEXT,
    
    -- A/B Testing
    variant_a_subject TEXT,
    variant_b_subject TEXT,
    variant_winner TEXT,  -- 'a', 'b', or null if not determined
    
    -- Drip campaign
    drip_sequence_day INTEGER,  -- Day 0, 3, 7, 14, 21, 30
    drip_trigger_event TEXT,  -- 'wizard_complete', 'action_reminder', 'score_update'
    
    -- Status
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    
    -- Metrics
    total_sent INTEGER DEFAULT 0,
    total_delivered INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_unsubscribed INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_email_campaigns_status ON public.oracle_email_campaigns(status);
CREATE INDEX idx_oracle_email_campaigns_type ON public.oracle_email_campaigns(campaign_type);

COMMENT ON TABLE public.oracle_email_campaigns IS 'Email campaign definitions for A/B testing and drip sequences';

-- ============================================================
-- EMAIL SENDS (Individual Send Tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.oracle_email_campaigns(id) ON DELETE SET NULL,
    
    -- Email details
    email_type TEXT NOT NULL,  -- 'weekly_digest', 'drip_day_3', 'ab_test_variant_a', etc.
    subject_line TEXT NOT NULL,
    template_variant TEXT,  -- 'a', 'b', or null
    
    -- Send metadata
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    resend_email_id TEXT,  -- Resend's email ID for tracking
    
    -- Engagement tracking
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    first_click_at TIMESTAMPTZ,
    click_count INTEGER DEFAULT 0,
    unsubscribed_at TIMESTAMPTZ,
    
    -- Timing optimization
    sent_hour INTEGER,  -- Hour of day sent (0-23)
    user_timezone TEXT DEFAULT 'America/Los_Angeles',
    
    -- Content snapshot
    content_data JSONB,  -- Store insights/actions included for analysis
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_email_sends_user_id ON public.oracle_email_sends(user_id);
CREATE INDEX idx_oracle_email_sends_campaign_id ON public.oracle_email_sends(campaign_id);
CREATE INDEX idx_oracle_email_sends_sent_at ON public.oracle_email_sends(sent_at DESC);
CREATE INDEX idx_oracle_email_sends_engagement ON public.oracle_email_sends(opened_at, first_click_at)
    WHERE opened_at IS NOT NULL;

ALTER TABLE public.oracle_email_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email sends" ON public.oracle_email_sends
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_email_sends IS 'Individual email send tracking with engagement metrics';

-- ============================================================
-- EMAIL CLICKS (Click Tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_email_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_send_id UUID NOT NULL REFERENCES public.oracle_email_sends(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Click details
    link_url TEXT NOT NULL,  -- Where user clicked
    link_type TEXT,  -- 'insight', 'action', 'dashboard', 'unsubscribe', 'cta'
    link_label TEXT,  -- Button/link text
    
    -- Context
    clicked_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address TEXT,
    
    -- Tracking
    utm_source TEXT DEFAULT 'oracle_email',
    utm_medium TEXT DEFAULT 'email',
    utm_campaign TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_email_clicks_email_send ON public.oracle_email_clicks(email_send_id);
CREATE INDEX idx_oracle_email_clicks_user_id ON public.oracle_email_clicks(user_id);
CREATE INDEX idx_oracle_email_clicks_clicked_at ON public.oracle_email_clicks(clicked_at DESC);
CREATE INDEX idx_oracle_email_clicks_link_type ON public.oracle_email_clicks(link_type);

ALTER TABLE public.oracle_email_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email clicks" ON public.oracle_email_clicks
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_email_clicks IS 'Track individual link clicks within emails for optimization';

-- ============================================================
-- SEND TIME OPTIMIZATION
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_send_time_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Optimal send time learned from engagement
    optimal_hour INTEGER,  -- 0-23
    optimal_day_of_week INTEGER,  -- 0-6 (0=Sunday)
    confidence_score NUMERIC(3,2),  -- 0.00-1.00
    
    -- Per-hour engagement rates (for ML)
    hour_engagement JSONB,  -- { "9": 0.45, "10": 0.52, ... }
    
    -- Timezone detection
    detected_timezone TEXT,
    
    -- Stats
    total_emails_analyzed INTEGER DEFAULT 0,
    last_analyzed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_send_time_user ON public.oracle_send_time_analysis(user_id);

ALTER TABLE public.oracle_send_time_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own send time analysis" ON public.oracle_send_time_analysis
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_send_time_analysis IS 'Learn optimal send times per user based on engagement';

-- ============================================================
-- DRIP CAMPAIGN STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.oracle_drip_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Drip campaign details
    drip_type TEXT NOT NULL,  -- 'onboarding', 'engagement', 'reactivation'
    current_day INTEGER NOT NULL DEFAULT 0,  -- Day in sequence
    
    -- State
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Next send
    next_email_day INTEGER,  -- Next day in sequence
    next_email_at TIMESTAMPTZ,
    
    -- Engagement
    emails_sent INTEGER DEFAULT 0,
    emails_opened INTEGER DEFAULT 0,
    emails_clicked INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_drip_state_user_id ON public.oracle_drip_state(user_id);
CREATE INDEX idx_oracle_drip_state_next_email ON public.oracle_drip_state(next_email_at)
    WHERE status = 'active';

ALTER TABLE public.oracle_drip_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own drip state" ON public.oracle_drip_state
    FOR SELECT USING (auth.uid() = user_id);

COMMENT ON TABLE public.oracle_drip_state IS 'Track user progress through drip email sequences';

-- ============================================================
-- GRANT PERMISSIONS
-- ============================================================

GRANT SELECT ON public.oracle_email_campaigns TO authenticated;
GRANT ALL ON public.oracle_email_sends TO authenticated;
GRANT ALL ON public.oracle_email_clicks TO authenticated;
GRANT ALL ON public.oracle_send_time_analysis TO authenticated;
GRANT ALL ON public.oracle_drip_state TO authenticated;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to record email click and update counts
CREATE OR REPLACE FUNCTION public.record_oracle_email_click(
    p_email_send_id UUID,
    p_link_url TEXT,
    p_link_type TEXT DEFAULT NULL,
    p_link_label TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
    v_click_id UUID;
BEGIN
    -- Get user_id from email send
    SELECT user_id INTO v_user_id
    FROM public.oracle_email_sends
    WHERE id = p_email_send_id;

    -- Insert click record
    INSERT INTO public.oracle_email_clicks (
        email_send_id,
        user_id,
        link_url,
        link_type,
        link_label
    ) VALUES (
        p_email_send_id,
        v_user_id,
        p_link_url,
        p_link_type,
        p_link_label
    ) RETURNING id INTO v_click_id;

    -- Update email send click count and first_click_at
    UPDATE public.oracle_email_sends
    SET 
        click_count = click_count + 1,
        first_click_at = COALESCE(first_click_at, NOW())
    WHERE id = p_email_send_id;

    -- Update campaign click count
    UPDATE public.oracle_email_campaigns
    SET total_clicked = total_clicked + 1
    WHERE id = (SELECT campaign_id FROM public.oracle_email_sends WHERE id = p_email_send_id);

    RETURN v_click_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark email as opened
CREATE OR REPLACE FUNCTION public.mark_oracle_email_opened(p_email_send_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.oracle_email_sends
    SET opened_at = COALESCE(opened_at, NOW())
    WHERE id = p_email_send_id AND opened_at IS NULL;

    -- Update campaign open count
    UPDATE public.oracle_email_campaigns
    SET total_opened = total_opened + 1
    WHERE id = (SELECT campaign_id FROM public.oracle_email_sends WHERE id = p_email_send_id)
      AND NOT EXISTS (
          SELECT 1 FROM public.oracle_email_sends 
          WHERE id = p_email_send_id AND opened_at IS NOT NULL
      );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- COMPLETE
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Oracle advanced email features created successfully';
    RAISE NOTICE '   - oracle_email_campaigns: A/B testing & drip campaigns';
    RAISE NOTICE '   - oracle_email_sends: Individual send tracking';
    RAISE NOTICE '   - oracle_email_clicks: Link click tracking';
    RAISE NOTICE '   - oracle_send_time_analysis: Optimal send time learning';
    RAISE NOTICE '   - oracle_drip_state: Drip campaign progress';
END $$;
