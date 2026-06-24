-- Post-preview email capture (founder_match_nudges MVP)
CREATE TABLE IF NOT EXISTS preview_lead_captures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  startup_id UUID,
  startup_url TEXT,
  startup_name TEXT,
  top_investors JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_count INT,
  source TEXT NOT NULL DEFAULT 'instant_preview',
  resend_message_id TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preview_lead_captures_email ON preview_lead_captures (email);
CREATE INDEX IF NOT EXISTS idx_preview_lead_captures_startup ON preview_lead_captures (startup_id);
CREATE INDEX IF NOT EXISTS idx_preview_lead_captures_created ON preview_lead_captures (created_at DESC);
