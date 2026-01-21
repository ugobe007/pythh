// THIS FILE IS AUTO-GENERATED FROM SUPABASE SCHEMA
// Last updated: 2025-12-18

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      investors: {
        Row: {
          id: string
          name: string
          firm: string | null
          title: string | null
          email: string | null
          linkedin_url: string | null
          twitter_url: string | null
          photo_url: string | null
          stage: string[] | null           // CORRECT: stage not stage_focus
          sectors: string[] | null          // CORRECT: sectors not sector_focus
          geography_focus: string[] | null
          check_size_min: number | null
          check_size_max: number | null
          investment_thesis: string | null
          bio: string | null
          notable_investments: Json | null
          portfolio_companies: string[] | null
          total_investments: number | null  // CORRECT: total_investments not portfolio_size
          successful_exits: number | null
          status: string | null
          is_verified: boolean | null
          created_at: string | null
          updated_at: string | null
          embedding: string | null
          // Additional fields from schema
          active_fund_size: number | null
          avg_response_time_days: number | null
          blog_url: string | null
          board_seats: number | null
          crunchbase_url: string | null
          decision_maker: boolean | null
          dry_powder_estimate: number | null
          focus_areas: Json | null
          follows_rounds: boolean | null
          investment_pace_per_year: number | null
          investor_score: number | null
          investor_tier: string | null
          last_enrichment_date: string | null
          last_investment_date: string | null
          last_news_update: string | null
          last_scored_at: string | null
          leads_rounds: boolean | null
          news_feed_url: string | null
          partners: Json | null
          preferred_intro_method: string | null
          score_breakdown: Json | null
          score_signals: string[] | null
          signals: Json | null
          startup_advice: Json | null
          twitter_handle: string | null
          typical_ownership_pct: number | null
        }
        Insert: {
          id?: string
          name: string
          firm?: string | null
          title?: string | null
          email?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          photo_url?: string | null
          stage?: string[] | null
          sectors?: string[] | null
          geography_focus?: string[] | null
          check_size_min?: number | null
          check_size_max?: number | null
          investment_thesis?: string | null
          bio?: string | null
          notable_investments?: Json | null
          portfolio_companies?: string[] | null
          total_investments?: number | null
          successful_exits?: number | null
          status?: string | null
          is_verified?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          embedding?: string | null
        }
        Update: {
          id?: string
          name?: string
          firm?: string | null
          title?: string | null
          email?: string | null
          linkedin_url?: string | null
          twitter_url?: string | null
          photo_url?: string | null
          stage?: string[] | null
          sectors?: string[] | null
          geography_focus?: string[] | null
          check_size_min?: number | null
          check_size_max?: number | null
          investment_thesis?: string | null
          bio?: string | null
          notable_investments?: Json | null
          portfolio_companies?: string[] | null
          total_investments?: number | null
          successful_exits?: number | null
          status?: string | null
          is_verified?: boolean | null
          created_at?: string | null
          updated_at?: string | null
          embedding?: string | null
        }
        Relationships: []
      }
      discovered_startups: {
        Row: {
          id: string
          name: string
          website: string | null
          description: string | null
          funding_amount: string | null
          funding_stage: string | null
          investors_mentioned: string[] | null
          article_url: string | null
          article_title: string | null
          article_date: string | null
          rss_source: string | null
          imported_to_startups: boolean | null
          imported_at: string | null
          startup_id: string | null
          website_verified: boolean | null
          website_status: string | null
          discovered_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          website?: string | null
          description?: string | null
          funding_amount?: string | null
          funding_stage?: string | null
          investors_mentioned?: string[] | null
          article_url?: string | null
          article_title?: string | null
          article_date?: string | null
          rss_source?: string | null
          imported_to_startups?: boolean | null
          imported_at?: string | null
          startup_id?: string | null
          website_verified?: boolean | null
          website_status?: string | null
          discovered_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          website?: string | null
          description?: string | null
          funding_amount?: string | null
          funding_stage?: string | null
          investors_mentioned?: string[] | null
          article_url?: string | null
          article_title?: string | null
          article_date?: string | null
          rss_source?: string | null
          imported_to_startups?: boolean | null
          imported_at?: string | null
          startup_id?: string | null
          website_verified?: boolean | null
          website_status?: string | null
          discovered_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      startup_uploads: {
        Row: {
          id: string
          name: string
          pitch: string | null
          description: string | null
          tagline: string | null
          website: string | null
          linkedin: string | null
          raise_amount: string | null
          raise_type: string | null
          stage: number | null
          source_type: string
          source_url: string | null
          deck_filename: string | null
          extracted_data: Json | null
          status: string | null
          admin_notes: string | null
          submitted_by: string | null
          submitted_email: string | null
          created_at: string | null
          updated_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          embedding: string | null
          // GOD Score fields
          total_god_score: number | null
          team_score: number | null
          traction_score: number | null
          market_score: number | null
          product_score: number | null
          vision_score: number | null
          // Additional metrics
          sectors: string[] | null
          location: string | null
          mrr: number | null
          arr: number | null
          team_size: number | null
          customer_count: number | null
          growth_rate_monthly: number | null
        }
        Insert: {
          id?: string
          name: string
          pitch?: string | null
          description?: string | null
          tagline?: string | null
          website?: string | null
          linkedin?: string | null
          raise_amount?: string | null
          raise_type?: string | null
          stage?: number | null
          source_type: string
          source_url?: string | null
          deck_filename?: string | null
          extracted_data?: Json | null
          status?: string | null
          admin_notes?: string | null
          submitted_by?: string | null
          submitted_email?: string | null
          created_at?: string | null
          updated_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          embedding?: string | null
          total_god_score?: number | null
          team_score?: number | null
          traction_score?: number | null
          market_score?: number | null
          product_score?: number | null
          vision_score?: number | null
          sectors?: string[] | null
          location?: string | null
          mrr?: number | null
          arr?: number | null
          team_size?: number | null
          customer_count?: number | null
          growth_rate_monthly?: number | null
        }
        Update: {
          id?: string
          name?: string
          pitch?: string | null
          description?: string | null
          tagline?: string | null
          website?: string | null
          linkedin?: string | null
          raise_amount?: string | null
          raise_type?: string | null
          stage?: number | null
          source_type?: string
          source_url?: string | null
          deck_filename?: string | null
          extracted_data?: Json | null
          status?: string | null
          admin_notes?: string | null
          submitted_by?: string | null
          submitted_email?: string | null
          created_at?: string | null
          updated_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          embedding?: string | null
          total_god_score?: number | null
          team_score?: number | null
          traction_score?: number | null
          market_score?: number | null
          product_score?: number | null
          vision_score?: number | null
          sectors?: string[] | null
          location?: string | null
          mrr?: number | null
          arr?: number | null
          team_size?: number | null
          customer_count?: number | null
          growth_rate_monthly?: number | null
        }
        Relationships: []
      }
      startup_investor_matches: {
        Row: {
          id: string
          startup_id: string | null
          investor_id: string | null
          match_score: number | null
          status: string | null
          reasoning: string | null
          confidence_level: string | null
          fit_analysis: Json | null
          viewed_at: string | null
          contacted_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          startup_id?: string | null
          investor_id?: string | null
          match_score?: number | null
          status?: string | null
          reasoning?: string | null
          confidence_level?: string | null
          fit_analysis?: Json | null
          viewed_at?: string | null
          contacted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          startup_id?: string | null
          investor_id?: string | null
          match_score?: number | null
          status?: string | null
          reasoning?: string | null
          confidence_level?: string | null
          fit_analysis?: Json | null
          viewed_at?: string | null
          contacted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      rss_sources: {
        Row: {
          id: string
          name: string
          url: string
          category: string
          active: boolean | null
          last_scraped: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          url: string
          category?: string
          active?: boolean | null
          last_scraped?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          url?: string
          category?: string
          active?: boolean | null
          last_scraped?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      alignment_stories: {
        Row: {
          id: string
          stage: string
          industry: string
          geography: string
          archetype: string | null
          alignment_state_before: string | null
          alignment_state_after: string | null
          signals_present: string[] | null
          signals_added: string[] | null
          startup_type_label: string
          what_changed_text: string
          result_text: string
          typical_investors: string[] | null
          investor_names: string[] | null
          entry_paths: string[] | null
          signal_timeline: Json | null
          investor_reactions: Json | null
          timing_context: string | null
          tempo_class: string | null
          is_canonical: boolean | null
          view_count: number | null
          bookmark_count: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          stage: string
          industry: string
          geography: string
          archetype?: string | null
          alignment_state_before?: string | null
          alignment_state_after?: string | null
          signals_present?: string[] | null
          signals_added?: string[] | null
          startup_type_label: string
          what_changed_text: string
          result_text: string
          typical_investors?: string[] | null
          investor_names?: string[] | null
          entry_paths?: string[] | null
          signal_timeline?: Json | null
          investor_reactions?: Json | null
          timing_context?: string | null
          tempo_class?: string | null
          is_canonical?: boolean | null
          view_count?: number | null
          bookmark_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          stage?: string
          industry?: string
          geography?: string
          archetype?: string | null
          alignment_state_before?: string | null
          alignment_state_after?: string | null
          signals_present?: string[] | null
          signals_added?: string[] | null
          startup_type_label?: string
          what_changed_text?: string
          result_text?: string
          typical_investors?: string[] | null
          investor_names?: string[] | null
          entry_paths?: string[] | null
          signal_timeline?: Json | null
          investor_reactions?: Json | null
          timing_context?: string | null
          tempo_class?: string | null
          is_canonical?: boolean | null
          view_count?: number | null
          bookmark_count?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      story_bookmarks: {
        Row: {
          id: string
          user_id: string
          story_id: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          story_id: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          story_id?: string
          created_at?: string | null
        }
        Relationships: []
      }
      founder_alignment_snapshots: {
        Row: {
          id: string
          startup_id: string
          startup_url: string | null
          alignment_state: string
          alignment_score: number | null
          signals_present: string[] | null
          signal_count: number | null
          investor_count: number | null
          active_investors: number | null
          monitoring_investors: number | null
          new_investors_this_week: number | null
          team_score: number | null
          traction_score: number | null
          market_score: number | null
          product_score: number | null
          snapshot_date: string
          created_at: string | null
        }
        Insert: {
          id?: string
          startup_id: string
          startup_url?: string | null
          alignment_state: string
          alignment_score?: number | null
          signals_present?: string[] | null
          signal_count?: number | null
          investor_count?: number | null
          active_investors?: number | null
          monitoring_investors?: number | null
          new_investors_this_week?: number | null
          team_score?: number | null
          traction_score?: number | null
          market_score?: number | null
          product_score?: number | null
          snapshot_date?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          startup_id?: string
          startup_url?: string | null
          alignment_state?: string
          alignment_score?: number | null
          signals_present?: string[] | null
          signal_count?: number | null
          investor_count?: number | null
          active_investors?: number | null
          monitoring_investors?: number | null
          new_investors_this_week?: number | null
          team_score?: number | null
          traction_score?: number | null
          market_score?: number | null
          product_score?: number | null
          snapshot_date?: string
          created_at?: string | null
        }
        Relationships: []
      }
      alignment_events: {
        Row: {
          id: string
          startup_id: string
          startup_url: string | null
          event_type: string
          event_title: string
          event_description: string | null
          old_value: string | null
          new_value: string | null
          signal_name: string | null
          investor_type: string | null
          investor_count: number | null
          impact: string | null
          importance: string | null
          event_date: string
          created_at: string | null
        }
        Insert: {
          id?: string
          startup_id: string
          startup_url?: string | null
          event_type: string
          event_title: string
          event_description?: string | null
          old_value?: string | null
          new_value?: string | null
          signal_name?: string | null
          investor_type?: string | null
          investor_count?: number | null
          impact?: string | null
          importance?: string | null
          event_date?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          startup_id?: string
          startup_url?: string | null
          event_type?: string
          event_title?: string
          event_description?: string | null
          old_value?: string | null
          new_value?: string | null
          signal_name?: string | null
          investor_type?: string | null
          investor_count?: number | null
          impact?: string | null
          importance?: string | null
          event_date?: string
          created_at?: string | null
        }
        Relationships: []
      }
      founder_notification_prefs: {
        Row: {
          id: string
          user_id: string | null
          email: string | null
          startup_url: string | null
          weekly_digest: boolean | null
          alignment_changes: boolean | null
          investor_alerts: boolean | null
          signal_alerts: boolean | null
          is_active: boolean | null
          last_sent_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          email?: string | null
          startup_url?: string | null
          weekly_digest?: boolean | null
          alignment_changes?: boolean | null
          investor_alerts?: boolean | null
          signal_alerts?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          email?: string | null
          startup_url?: string | null
          weekly_digest?: boolean | null
          alignment_changes?: boolean | null
          investor_alerts?: boolean | null
          signal_alerts?: boolean | null
          is_active?: boolean | null
          last_sent_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      // Story Evolution Tables (Sprint 2)
      story_chapters: {
        Row: {
          id: string
          story_id: string
          chapter_number: number
          chapter_title: string
          chapter_summary: string
          alignment_state_at_chapter: string
          key_event: string | null
          investor_reaction: string | null
          time_delta_months: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          story_id: string
          chapter_number?: number
          chapter_title: string
          chapter_summary: string
          alignment_state_at_chapter: string
          key_event?: string | null
          investor_reaction?: string | null
          time_delta_months?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          story_id?: string
          chapter_number?: number
          chapter_title?: string
          chapter_summary?: string
          alignment_state_at_chapter?: string
          key_event?: string | null
          investor_reaction?: string | null
          time_delta_months?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      path_durability_stats: {
        Row: {
          id: string
          archetype: string
          stage: string | null
          industry: string | null
          total_stories: number | null
          sustained_3_months: number | null
          sustained_6_months: number | null
          faded_count: number | null
          converted_count: number | null
          durability_score: number | null
          durability_label: string | null
          last_computed_at: string | null
          sample_size: number | null
        }
        Insert: {
          id?: string
          archetype: string
          stage?: string | null
          industry?: string | null
          total_stories?: number | null
          sustained_3_months?: number | null
          sustained_6_months?: number | null
          faded_count?: number | null
          converted_count?: number | null
          durability_score?: number | null
          durability_label?: string | null
          last_computed_at?: string | null
          sample_size?: number | null
        }
        Update: {
          id?: string
          archetype?: string
          stage?: string | null
          industry?: string | null
          total_stories?: number | null
          sustained_3_months?: number | null
          sustained_6_months?: number | null
          faded_count?: number | null
          converted_count?: number | null
          durability_score?: number | null
          durability_label?: string | null
          last_computed_at?: string | null
          sample_size?: number | null
        }
        Relationships: []
      }
      story_evolution_log: {
        Row: {
          id: string
          story_id: string
          event_type: string
          previous_state: Record<string, any> | null
          new_state: Record<string, any> | null
          event_description: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          story_id: string
          event_type: string
          previous_state?: Record<string, any> | null
          new_state?: Record<string, any> | null
          event_description?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          story_id?: string
          event_type?: string
          previous_state?: Record<string, any> | null
          new_state?: Record<string, any> | null
          event_description?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}

// Helper types
export type Investor = Database['public']['Tables']['investors']['Row']
export type InvestorInsert = Database['public']['Tables']['investors']['Insert']
export type InvestorUpdate = Database['public']['Tables']['investors']['Update']

export type Startup = Database['public']['Tables']['startup_uploads']['Row']
export type StartupInsert = Database['public']['Tables']['startup_uploads']['Insert']
export type StartupUpdate = Database['public']['Tables']['startup_uploads']['Update']

export type DiscoveredStartup = Database['public']['Tables']['discovered_startups']['Row']
export type Match = Database['public']['Tables']['startup_investor_matches']['Row']

export type AlignmentStoryRow = Database['public']['Tables']['alignment_stories']['Row']
export type AlignmentStoryInsert = Database['public']['Tables']['alignment_stories']['Insert']
export type StoryBookmark = Database['public']['Tables']['story_bookmarks']['Row']

export type AlignmentSnapshot = Database['public']['Tables']['founder_alignment_snapshots']['Row']
export type AlignmentEvent = Database['public']['Tables']['alignment_events']['Row']
export type NotificationPrefs = Database['public']['Tables']['founder_notification_prefs']['Row']

// Story Evolution Types (Sprint 2)
export type StoryChapter = Database['public']['Tables']['story_chapters']['Row']
export type PathDurabilityStats = Database['public']['Tables']['path_durability_stats']['Row']
export type StoryEvolutionLog = Database['public']['Tables']['story_evolution_log']['Row']

// Action Layer Types (Action Layer Sprint)
export interface InvestorPrepProfile {
  id: string;
  investor_id: string;
  dominant_signals: string[];
  secondary_signals: string[];
  negative_signals: string[];
  entry_paths_ranked: { path: string; effectiveness: number; description?: string }[];
  typical_timing_triggers: string[];
  timing_sensitivity: 'low' | 'moderate' | 'high' | 'critical';
  engagement_triggers: string[];
  average_response_time_days?: number;
  typical_first_meeting_format?: string;
  confidence_level: 'observed' | 'inferred' | 'low';
}

export interface FounderReadinessSnapshot {
  id: string;
  startup_id?: string;
  startup_url?: string;
  founder_session_id?: string;
  investor_id: string;
  matched_signals: string[];
  missing_signals: string[];
  signal_coverage_ratio: number;
  timing_state: 'too_early' | 'early' | 'optimal' | 'late' | 'missed' | 'unknown';
  timing_reason?: string;
  readiness_score?: number;
  recommended_next_steps: string[];
  snapshot_date: string;
}

export interface EntryPathPattern {
  path_type: string;
  path_description?: string;
  success_rate: number;
  typical_time_to_meeting_days?: number;
  best_for_stages?: string[];
  rank_order: number;
}

// =============================================================================
// Sprint 4: Attention Drift Nudge Types
// =============================================================================

export type NotificationTriggerType =
  | 'investor_appeared'
  | 'investor_activated'
  | 'alignment_improved'
  | 'signal_strengthened'
  | 'milestone_detected'
  | 'investor_disappeared'
  | 'alignment_dropped'
  | 'signal_weakened';

export type NotificationCategory = 'positive' | 'negative' | 'neutral';

export interface NotificationQueueItem {
  id: string;
  startup_id?: string;
  startup_url?: string;
  founder_session_id?: string;
  trigger_type: NotificationTriggerType;
  trigger_data: Record<string, unknown>;
  priority: number;
  trigger_date: string;
  created_at: string;
  processed_at?: string;
}

export interface WeeklyDigest {
  id: string;
  startup_id?: string;
  startup_url?: string;
  founder_session_id?: string;
  founder_email?: string;
  subject: string;
  headline: string;
  bullets: DigestBullet[];
  delivery_channel: 'in_app' | 'email' | 'both';
  in_app_shown_at?: string;
  email_sent_at?: string;
  email_opened_at?: string;
  clicked_at?: string;
  status: 'pending' | 'delivered' | 'viewed' | 'clicked' | 'dismissed';
  digest_week: string;
  created_at: string;
}

export interface DigestBullet {
  type: 'positive' | 'negative' | 'neutral';
  text: string;
  trigger_type?: NotificationTriggerType;
}

export interface NotificationTrigger {
  id: string;
  trigger_type: NotificationTriggerType;
  is_enabled: boolean;
  category: NotificationCategory;
  priority: number;
  bullet_template: string;
  default_enabled: boolean;
  description?: string;
}

export interface NotificationIndicator {
  id: string;
  startup_url?: string;
  founder_session_id?: string;
  unread_count: number;
  last_seen_at?: string;
  updated_at: string;
}

// =============================================================================
// Sprint 3: Founder Learning Memory Types
// =============================================================================

export interface FounderLearningProfile {
  id: string;
  startup_id?: string;
  startup_url?: string;
  founder_session_id?: string;
  primary_stage?: string;
  primary_industry?: string;
  primary_signals?: string[];
  target_investors?: string[];
  preferred_archetypes?: string[];
  preferred_tempo?: string;
  stories_viewed: number;
  stories_saved: number;
  patterns_discovered: number;
  learning_streak_days: number;
  last_learning_activity?: string;
  created_at: string;
  updated_at: string;
}

export type PatternFeedType =
  | 'new_pattern'
  | 'story_evolution'
  | 'archetype_update'
  | 'investor_linked'
  | 'similar_journey'
  | 'path_durability_shift';

export interface PatternFeedItem {
  id: string;
  startup_url?: string;
  founder_session_id?: string;
  feed_type: PatternFeedType;
  story_id?: string;
  investor_id?: string;
  archetype?: string;
  headline: string;
  subheadline?: string;
  detail_text?: string;
  relevance_reason?: string;
  relevance_score?: number;
  is_read: boolean;
  is_dismissed: boolean;
  read_at?: string;
  created_at: string;
}

export type JournalNoteType = 'story' | 'investor' | 'timeline' | 'pattern' | 'general';

export interface AlignmentJournalEntry {
  id: string;
  startup_url?: string;
  founder_session_id?: string;
  note_type: JournalNoteType;
  story_id?: string;
  investor_id?: string;
  event_id?: string;
  archetype?: string;
  note_text: string;
  note_tags?: string[];
  is_pinned: boolean;
  is_private: boolean;
  created_at: string;
  updated_at: string;
}

export type LearningActivityType =
  | 'story_viewed'
  | 'story_saved'
  | 'story_unsaved'
  | 'pattern_expanded'
  | 'feed_item_read'
  | 'note_created'
  | 'note_updated'
  | 'investor_studied'
  | 'archetype_explored'
  | 'timeline_reviewed';

export interface LearningActivity {
  id: string;
  startup_url?: string;
  founder_session_id?: string;
  activity_type: LearningActivityType;
  reference_type?: string;
  reference_id?: string;
  reference_data?: Record<string, unknown>;
  created_at: string;
}

export type InvestorStudyStatus = 'watching' | 'studying' | 'preparing' | 'engaged' | 'completed';

export interface InvestorStudyEntry {
  id: string;
  startup_url?: string;
  founder_session_id?: string;
  investor_id: string;
  study_status: InvestorStudyStatus;
  notes?: string;
  key_insights?: string[];
  entry_path_preference?: string;
  stories_viewed_count: number;
  last_viewed_at?: string;
  added_at: string;
  updated_at: string;
}

