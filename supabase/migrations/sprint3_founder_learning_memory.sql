-- ============================================================================
-- SPRINT 3: FOUNDER LEARNING MEMORY
-- ============================================================================
-- "A private learning journal of how the market responds to me."
--
-- Three layers:
-- 1. Personal Story Library (saved patterns, stories like you, investor-linked)
-- 2. Personal Pattern Feed (new patterns, story evolution, investor alerts)
-- 3. Personal Alignment Journal (notes on stories, investors, timeline)
-- ============================================================================

-- =============================================================================
-- 1. PERSONAL LEARNING PROFILE
-- =============================================================================
-- Tracks founder's learning preferences and profile for personalization

CREATE TABLE IF NOT EXISTS founder_learning_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_id UUID REFERENCES startup_uploads(id) ON DELETE CASCADE,
  startup_url TEXT,
  founder_session_id TEXT,
  
  -- Profile dimensions (for "stories like you")
  primary_stage TEXT,          -- Pre-seed, Seed, Series A, etc.
  primary_industry TEXT,       -- SaaS, AI/ML, Fintech, etc.
  primary_signals TEXT[],      -- What signals they care about
  target_investors TEXT[],     -- Investors they're watching
  
  -- Learning preferences
  preferred_archetypes TEXT[], -- Archetypes they engage with most
  preferred_tempo TEXT,        -- slow/steady/fast
  
  -- Computed engagement metrics
  stories_viewed INTEGER DEFAULT 0,
  stories_saved INTEGER DEFAULT 0,
  patterns_discovered INTEGER DEFAULT 0,
  learning_streak_days INTEGER DEFAULT 0,
  last_learning_activity TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(startup_url)
);

-- =============================================================================
-- 2. PERSONAL PATTERN FEED
-- =============================================================================
-- Feed items for patterns relevant to this founder

CREATE TABLE IF NOT EXISTS founder_pattern_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_url TEXT,
  founder_session_id TEXT,
  
  -- Feed item content
  feed_type TEXT NOT NULL CHECK (feed_type IN (
    'new_pattern',           -- New story matches their profile
    'story_evolution',       -- Story they saved evolved
    'archetype_update',      -- Archetype they track changed
    'investor_linked',       -- Story appears for investor they track
    'similar_journey',       -- Founder at similar stage succeeded
    'path_durability_shift'  -- Path durability changed for saved archetype
  )),
  
  -- References
  story_id UUID REFERENCES alignment_stories(id) ON DELETE CASCADE,
  investor_id UUID,
  archetype TEXT,
  
  -- Feed item display
  headline TEXT NOT NULL,          -- "New alignment pattern detected"
  subheadline TEXT,                -- "Seed-stage infra startup..."
  detail_text TEXT,                -- Main description
  relevance_reason TEXT,           -- Why this is relevant to them
  
  -- Metadata
  relevance_score DECIMAL(3,2),    -- 0.00 to 1.00
  is_read BOOLEAN DEFAULT FALSE,
  is_dismissed BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Prevent duplicate feed items
  UNIQUE(startup_url, feed_type, story_id)
);

CREATE INDEX IF NOT EXISTS idx_pattern_feed_startup_url ON founder_pattern_feed(startup_url);
CREATE INDEX IF NOT EXISTS idx_pattern_feed_unread ON founder_pattern_feed(startup_url, is_read) WHERE NOT is_dismissed;
CREATE INDEX IF NOT EXISTS idx_pattern_feed_created ON founder_pattern_feed(created_at DESC);

-- =============================================================================
-- 3. PERSONAL ALIGNMENT JOURNAL
-- =============================================================================
-- Private notes on stories, investors, and timeline events

CREATE TABLE IF NOT EXISTS founder_alignment_journal (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_url TEXT,
  founder_session_id TEXT,
  
  -- What this note is attached to
  note_type TEXT NOT NULL CHECK (note_type IN (
    'story',         -- Note on an alignment story
    'investor',      -- Note on an investor
    'timeline',      -- Note on a timeline event
    'pattern',       -- Note on a pattern/archetype
    'general'        -- General learning note
  )),
  
  -- Reference IDs (nullable based on note_type)
  story_id UUID REFERENCES alignment_stories(id) ON DELETE CASCADE,
  investor_id UUID,
  event_id UUID,
  archetype TEXT,
  
  -- Note content
  note_text TEXT NOT NULL,
  note_tags TEXT[],              -- User-defined tags
  
  -- Metadata
  is_pinned BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT TRUE,  -- Always private for now
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_journal_startup_url ON founder_alignment_journal(startup_url);
CREATE INDEX IF NOT EXISTS idx_journal_note_type ON founder_alignment_journal(note_type);
CREATE INDEX IF NOT EXISTS idx_journal_story ON founder_alignment_journal(story_id) WHERE story_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_journal_investor ON founder_alignment_journal(investor_id) WHERE investor_id IS NOT NULL;

-- =============================================================================
-- 4. ENHANCED STORY BOOKMARKS
-- =============================================================================
-- Add learning context to bookmarks

ALTER TABLE story_bookmarks 
  ADD COLUMN IF NOT EXISTS startup_url TEXT,
  ADD COLUMN IF NOT EXISTS founder_session_id TEXT,
  ADD COLUMN IF NOT EXISTS save_reason TEXT,           -- Why they saved it
  ADD COLUMN IF NOT EXISTS is_studying BOOLEAN DEFAULT FALSE,  -- Actively studying
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- =============================================================================
-- 5. LEARNING ACTIVITY LOG
-- =============================================================================
-- Track learning behavior for personalization

CREATE TABLE IF NOT EXISTS founder_learning_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_url TEXT,
  founder_session_id TEXT,
  
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'story_viewed',
    'story_saved',
    'story_unsaved',
    'pattern_expanded',
    'feed_item_read',
    'note_created',
    'note_updated',
    'investor_studied',
    'archetype_explored',
    'timeline_reviewed'
  )),
  
  -- Reference (what they engaged with)
  reference_type TEXT,  -- 'story', 'investor', 'archetype', 'feed_item'
  reference_id TEXT,
  reference_data JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_activity_startup ON founder_learning_activity(startup_url);
CREATE INDEX IF NOT EXISTS idx_learning_activity_type ON founder_learning_activity(activity_type);
CREATE INDEX IF NOT EXISTS idx_learning_activity_created ON founder_learning_activity(created_at DESC);

-- =============================================================================
-- 6. INVESTOR STUDY LIST
-- =============================================================================
-- Investors the founder is actively studying

CREATE TABLE IF NOT EXISTS founder_investor_study (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  startup_url TEXT,
  founder_session_id TEXT,
  investor_id UUID NOT NULL,
  
  -- Study status
  study_status TEXT DEFAULT 'watching' CHECK (study_status IN (
    'watching',      -- Passive monitoring
    'studying',      -- Actively learning
    'preparing',     -- Prep mode active
    'engaged',       -- In conversation
    'completed'      -- Outcome reached
  )),
  
  -- Study notes
  notes TEXT,
  key_insights TEXT[],           -- Key learnings about this investor
  entry_path_preference TEXT,    -- Preferred approach
  
  -- Engagement tracking
  stories_viewed_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(startup_url, investor_id)
);

CREATE INDEX IF NOT EXISTS idx_investor_study_startup ON founder_investor_study(startup_url);
CREATE INDEX IF NOT EXISTS idx_investor_study_status ON founder_investor_study(study_status);

-- =============================================================================
-- ENABLE RLS (Row Level Security)
-- =============================================================================

ALTER TABLE founder_learning_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_pattern_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_alignment_journal ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_learning_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_investor_study ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================

GRANT ALL ON founder_learning_profiles TO authenticated;
GRANT ALL ON founder_learning_profiles TO anon;
GRANT ALL ON founder_pattern_feed TO authenticated;
GRANT ALL ON founder_pattern_feed TO anon;
GRANT ALL ON founder_alignment_journal TO authenticated;
GRANT ALL ON founder_alignment_journal TO anon;
GRANT ALL ON founder_learning_activity TO authenticated;
GRANT ALL ON founder_learning_activity TO anon;
GRANT ALL ON founder_investor_study TO authenticated;
GRANT ALL ON founder_investor_study TO anon;
