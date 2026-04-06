/**
 * DATABASE TYPES - Type-safe database access
 * 
 * This file provides type-safe database access and prevents column/table name mismatches.
 * 
 * CORRECT USAGE:
 * - Table names: Use DB_TABLES constant (e.g., DB_TABLES.STARTUP_UPLOADS)
 * - Investor columns: Use investor.sectors and investor.stage (correct DB column names)
 * - Match status: Use MATCH_STATUS constant (e.g., MATCH_STATUS.FUNDED, not investment_made)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================
// TABLE NAME CONSTANTS - USE THESE EVERYWHERE
// ============================================
export const DB_TABLES = {
  // Startup related
  STARTUP_UPLOADS: 'startup_uploads',  // NOT 'startups'
  DISCOVERED_STARTUPS: 'discovered_startups',
  STARTUP_NEWS: 'startup_news',
  STARTUP_VALUATIONS: 'startup_valuations',
  STARTUP_MOMENTUM_SCORES: 'startup_momentum_scores',
  
  // Investor related
  INVESTORS: 'investors',
  INVESTOR_BEHAVIOR_PATTERNS: 'investor_behavior_patterns',
  
  // Matching related
  STARTUP_INVESTOR_MATCHES: 'startup_investor_matches',  // NOT 'matches'
  MATCH_FEEDBACK: 'match_feedback',
  MATCHING_QUEUE: 'matching_queue',
  INTRO_TIMING_RECOMMENDATIONS: 'intro_timing_recommendations',
  
  // Funding
  FUNDING_ROUNDS: 'funding_rounds',
  
  // AI/ML
  AI_LOGS: 'ai_logs',
  ML_JOBS: 'ml_jobs',
  EMBEDDING_MODEL_VERSIONS: 'embedding_model_versions',
  EMBEDDING_PERFORMANCE_METRICS: 'embedding_performance_metrics',
  
  // RSS/News
  RSS_ARTICLES: 'rss_articles',
  RSS_SOURCES: 'rss_sources',
} as const;

// Type for table names
export type TableName = typeof DB_TABLES[keyof typeof DB_TABLES];

// ============================================
// MATCH STATUS CONSTANTS - Use instead of investment_made
// ============================================
export const MATCH_STATUS = {
  SUGGESTED: 'suggested',
  VIEWED: 'viewed',
  INTRO_REQUESTED: 'intro_requested',
  INTRO_SENT: 'intro_sent',
  CONTACTED: 'contacted',
  DECLINED: 'declined',
  MEETING_SCHEDULED: 'meeting_scheduled',
  FUNDED: 'funded',  // Use this instead of investment_made=true
} as const;

export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

// ============================================
// INVESTOR TABLE - CORRECT COLUMN NAMES
// ============================================
/**
 * Database columns are:
 * - sectors (array of strings)
 * - stage (array of strings)
 * - check_size_min / check_size_max (numbers)
 */
export interface Investor {
  id: string;
  name: string;
  firm: string | null;
  type: string | null;
  
  // Correct column names
  sectors: string[] | null;       // Array of sector strings
  stage: string[] | null;         // Array of stage strings
  check_size_min: number | null;
  check_size_max: number | null;
  
  // Other fields
  bio: string | null;
  tagline: string | null;
  geography: string | null;
  location: string | null;
  website: string | null;
  linkedin: string | null;
  twitter: string | null;
  email: string | null;
  
  // Fund metrics
  fund_size: string | null;
  aum: string | null;
  portfolio_size: number | null;
  investment_pace: number | null;
  leads_rounds: boolean | null;
  
  // Performance
  exits: number | null;
  unicorns: number | null;
  board_seats: number | null;
  notable_investments: string[] | null;
  
  // Metadata
  partners: Json | null;
  embedding: string | null;
  status: string | null;
  last_investment_date: string | null;
  last_enrichment_date: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================
// STARTUP TABLE - CORRECT TABLE NAME IS startup_uploads
// ============================================
export interface Startup {
  id: string;
  name: string;
  tagline: string | null;
  pitch: string | null;
  problem: string | null;
  solution: string | null;
  value_proposition: string | null;
  
  // Sectors/Industries
  sectors: string[] | null;
  industries: string[] | null;
  
  // Stage and funding
  stage: string | null;
  raise_type: string | null;
  raise_amount: string | null;
  
  // Traction
  mrr: number | null;
  revenue_annual: number | null;
  growth_rate_monthly: number | null;
  team_size: number | null;
  
  // Scores (GOD algorithm)
  total_god_score: number | null;
  team_score: number | null;
  market_score: number | null;
  product_score: number | null;
  traction_score: number | null;
  vision_score: number | null;
  
  // Team info
  team_companies: string[] | null;
  has_technical_cofounder: boolean | null;
  
  // Other
  market_size: string | null;
  location: string | null;
  website: string | null;
  linkedin: string | null;
  is_launched: boolean | null;
  has_demo: boolean | null;
  
  // Status
  status: string | null;
  source_type: string;
  submitted_email: string | null;
  embedding: string | null;
  
  created_at: string | null;
  updated_at: string | null;
}

// ============================================
// MATCH TABLE - startup_investor_matches
// ============================================
/**
 * IMPORTANT: Use status column for tracking investments
 * - status='funded' means investment was made
 * - There is NO investment_made column!
 */
export interface StartupInvestorMatch {
  id: string;
  startup_id: string;
  investor_id: string;
  
  // Scores
  match_score: number | null;
  similarity_score: number | null;
  success_score: number | null;
  confidence_level: string | null;
  
  // Analysis
  reasoning: string | null;
  why_you_match: string[] | null;
  fit_analysis: Json | null;
  /** Point-in-time features at match generation (ML / drift). */
  feature_snapshot: Json | null;
  
  // Status - Use MATCH_STATUS constants
  status: MatchStatus | null;  // NOT investment_made
  
  // Timestamps for tracking
  viewed_at: string | null;
  intro_requested_at: string | null;
  contacted_at: string | null;
  last_interaction: string | null;
  
  // Email content
  intro_email_subject: string | null;
  intro_email_body: string | null;
  
  // Metadata
  feedback_received: boolean | null;
  user_id: string | null;
  created_by: string | null;
  created_at: string | null;
  updated_at: string | null;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize investor data. DB uses 'sectors' and 'stage' directly.
 */
export function normalizeInvestorData(rawInvestor: any): Partial<Investor> {
  return {
    ...rawInvestor,
    // Use correct column names
    sectors: rawInvestor.sectors || null,
    stage: rawInvestor.stage || null,
    check_size_min: rawInvestor.check_size_min ?? null,
    check_size_max: rawInvestor.check_size_max ?? null,
  };
}

/**
 * Check if a match is considered "funded" (investment made)
 */
export function isMatchFunded(match: StartupInvestorMatch | { status?: string }): boolean {
  return match.status === MATCH_STATUS.FUNDED;
}

/**
 * Get all successful match statuses (meeting or better)
 */
export function getSuccessfulStatuses(): MatchStatus[] {
  return [MATCH_STATUS.MEETING_SCHEDULED, MATCH_STATUS.FUNDED];
}

// ============================================
// DATABASE TYPE DEFINITIONS (from Supabase)
// ============================================

export type Database = {
  public: {
    Tables: {
      investors: {
        Row: Investor;
        Insert: Omit<Investor, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Investor>;
      };
      startup_uploads: {
        Row: Startup;
        Insert: Omit<Startup, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<Startup>;
      };
      startup_investor_matches: {
        Row: StartupInvestorMatch;
        Insert: Omit<StartupInvestorMatch, 'id' | 'created_at' | 'updated_at'> & { id?: string };
        Update: Partial<StartupInvestorMatch>;
      };
      // Add more tables as needed
    };
  };
};

// Helper type to get a table's Row type
export type TableRow<T extends keyof Database['public']['Tables']> = 
  Database['public']['Tables'][T]['Row'];

// Example usage:
// type InvestorRow = TableRow<'investors'>;
// type StartupRow = TableRow<'startup_uploads'>;
// type MatchRow = TableRow<'startup_investor_matches'>;
