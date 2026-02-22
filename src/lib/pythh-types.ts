// ============================================================================
// Pythh Founder UI Types
// ============================================================================
// These types match the RPC return shapes exactly.
// Frontend stays dead simple - no logic drift.
// ============================================================================

// -----------------------------------------------------------------------------
// MATCH TABLE ROW
// -----------------------------------------------------------------------------
// From: get_live_match_table RPC
// Used by: /app/matches

export interface MatchRow {
  rank: number;
  investor_id: string;
  investor_name: string | null;  // null if locked
  fit_bucket: 'early' | 'good' | 'high';
  momentum_bucket: 'cooling' | 'neutral' | 'emerging' | 'strong' | 'cold';
  signal_score: number;  // 0-10, 1 decimal
  why_summary: string;
  is_locked: boolean;
  is_fallback?: boolean;  // NEW: marks warming-up matches from Tier B
  actions_allowed: ('view' | 'unlock')[];
}

// UI display helpers
export const FIT_DISPLAY: Record<MatchRow['fit_bucket'], string> = {
  early: 'Early',
  good: 'Good',
  high: 'High',
};

export const MOMENTUM_DISPLAY: Record<MatchRow['momentum_bucket'], { label: string; icon: string }> = {
  strong: { label: 'Strong', icon: '▲' },
  emerging: { label: 'Emerging', icon: '▲' },
  neutral: { label: 'Neutral', icon: '■' },
  cooling: { label: 'Cooling', icon: '▼' },
  cold: { label: 'Cold', icon: '⊘' },
};

// -----------------------------------------------------------------------------
// INVESTOR REVEAL
// -----------------------------------------------------------------------------
// From: get_investor_reveal RPC
// Used by: /app/investors/:id

export interface InvestorReveal {
  unlock_required: boolean;
  investor_id?: string;
  investor?: {
    id: string;
    name: string;
    firm: string | null;
    title: string | null;
    email: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    photo_url: string | null;
    stage: string[] | null;
    sectors: string[] | null;
    geography_focus: string[] | null;
    check_size_min: number | null;
    check_size_max: number | null;
    investment_thesis: string | null;
    bio: string | null;
    notable_investments: unknown;
    portfolio_companies: string[] | null;
  };
  match?: {
    score: number;
    reasoning: string;
    confidence: string;
    fit_analysis: unknown;
  };
  fit?: {
    bucket: 'early' | 'good' | 'high';
    score: number | null;
  };
}

// -----------------------------------------------------------------------------
// UNLOCK RESPONSE
// -----------------------------------------------------------------------------
// From: perform_unlock RPC

export interface UnlockResponse {
  success: boolean;
  already_unlocked?: boolean;  // true if was already unlocked (idempotent)
  error?: 'daily_limit_reached';
  unlocks_remaining?: number;
  resets_at?: string;  // ISO timestamp
}

// -----------------------------------------------------------------------------
// STARTUP CONTEXT
// -----------------------------------------------------------------------------
// From: get_startup_context RPC
// Used by: /app/startup

export interface StartupContext {
  startup: {
    id: string | null;
    name: string;
    website: string;
    /** Verified company homepage (not a publisher/scraped URL) */
    company_website: string | null;
    /** Original scraped/publisher URL when website was not the company homepage */
    source_url: string | null;
    tagline: string | null;
    description: string | null;
    stage: number | null;
    sectors: string[];
    extracted_data: any | null;
  };
  god: {
    total: number;
    team: number;
    traction: number;
    market: number;
    product: number;
    vision: number;
  };
  signals: {
    total: number;
    founder_language_shift: number;
    investor_receptivity: number;
    news_momentum: number;
    capital_convergence: number;
    execution_velocity: number;
  };
  comparison: {
    industry_avg: number;
    top_quartile: number;
    percentile: number;
    sectors: string[];
  };
  entitlements: {
    plan: 'free' | 'pro' | 'team';
    daily_unlock_limit: number;
    unlocks_used_today: number;
    unlocks_remaining: number;
  } | null;
}

// GOD component max scores (for bar visualization)
export const GOD_MAX_SCORES = {
  team: 25,
  traction: 25,
  market: 20,
  product: 15,
  vision: 15,
} as const;

// Signal weights (for tooltip/methodology)
export const SIGNAL_WEIGHTS = {
  founder_language_shift: { weight: 0.20, max: 2.0 },
  investor_receptivity: { weight: 0.25, max: 2.5 },
  news_momentum: { weight: 0.15, max: 1.5 },
  capital_convergence: { weight: 0.20, max: 2.0 },
  execution_velocity: { weight: 0.20, max: 2.0 },
} as const;

// -----------------------------------------------------------------------------
// REALTIME UPDATE
// -----------------------------------------------------------------------------
// From: Supabase realtime subscription

export interface MatchRowUpdate {
  investor_id: string;
  changed_fields: ('momentum' | 'rank' | 'fit' | 'signal_score')[];
  previous_bucket: MatchRow['momentum_bucket'];
  new_bucket: MatchRow['momentum_bucket'];
  rank_delta: number;  // positive = moved up, negative = moved down
}

// Frontend only reacts if:
// new_bucket !== previous_bucket || rank_delta !== 0
export function shouldUpdateRow(update: MatchRowUpdate): boolean {
  return update.new_bucket !== update.previous_bucket || update.rank_delta !== 0;
}

// -----------------------------------------------------------------------------
// API SERVICE
// -----------------------------------------------------------------------------
// Typed Supabase RPC calls

import { supabase } from './supabase';

export const pythhApi = {
  // /app/matches
  async getMatchTable(startupId: string, limitUnlocked = 5, limitLocked = 50): Promise<MatchRow[]> {
    const { data, error } = await supabase.rpc('get_live_match_table', {
      p_startup_id: startupId,
      p_limit_unlocked: limitUnlocked,
      p_limit_locked: limitLocked,
    });
    if (error) throw error;
    return data as MatchRow[];
  },

  // /app/investors/:id
  async getInvestorReveal(startupId: string, investorId: string): Promise<InvestorReveal> {
    const { data, error } = await supabase.rpc('get_investor_reveal', {
      p_startup_id: startupId,
      p_investor_id: investorId,
    });
    if (error) throw error;
    return data as InvestorReveal;
  },

  // Unlock action
  async unlockInvestor(startupId: string, investorId: string, source = 'free_daily'): Promise<UnlockResponse> {
    const { data, error } = await supabase.rpc('perform_unlock', {
      p_startup_id: startupId,
      p_investor_id: investorId,
      p_source: source,
    });
    if (error) throw error;
    return data as UnlockResponse;
  },

  // /app/startup
  async getStartupContext(startupId: string): Promise<StartupContext> {
    const { data, error } = await supabase.rpc('get_startup_context', {
      p_startup_id: startupId,
    });
    if (error) throw error;
    return data as StartupContext;
  },
};

// -----------------------------------------------------------------------------
// TOOLTIPS (Methodology copy)
// -----------------------------------------------------------------------------

export const TOOLTIPS = {
  fit: 'Fit reflects timing + appetite, not quality.',
  momentum: 'Momentum reflects recent signal movement.',
  signals: 'Signal score summarizes market behavior. Max contribution: 10.',
  god: 'GOD reflects fundamentals only. Team · Traction · Market · Product · Vision.',
  locked: 'Reveals investor identity and outreach context.',
} as const;
