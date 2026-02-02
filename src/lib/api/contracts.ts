/**
 * ============================================================================
 * API CONTRACT LAYER
 * ============================================================================
 * TypeScript types for all Hot Honey API endpoints.
 * Guarantees frontend/backend stay in sync.
 * 
 * Pattern:
 *   - Request types: *Request
 *   - Response types: *Response
 *   - Fetchers: fetch*()
 * ============================================================================
 */

// ============================================================================
// STARTUP RESOLUTION (URL → ID)
// ============================================================================

/**
 * POST /api/resolve
 * 
 * Resolves a URL to a startup_id. Creates discovery job if needed.
 * Idempotent: safe to call multiple times with same URL.
 */
export type ResolveStartupRequest = {
  /** Raw URL (will be normalized server-side) */
  url: string;
};

export type ResolveStartupResponse =
  | {
      /** Success: found existing approved startup */
      status: 'found';
      startup_id: string;
      name: string;
      /** Normalized URL used for lookup */
      url_normalized: string;
    }
  | {
      /** In progress: startup exists but not yet approved */
      status: 'pending';
      startup_id: string;
      /** When approval decision expected */
      estimated_ready_at?: string;
    }
  | {
      /** Created: new discovery job initiated */
      status: 'created';
      startup_id: string;
      job_id: string;
      /** Poll this URL for status */
      poll_url: string;
    }
  | {
      /** Error: invalid URL or system failure */
      status: 'error';
      code: 'invalid_url' | 'not_found' | 'system_error';
      message: string;
    };

/**
 * Resolve URL to startup ID (with optional discovery)
 */
export async function resolveStartup(url: string): Promise<ResolveStartupResponse> {
  const response = await fetch('/api/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url } satisfies ResolveStartupRequest),
  });
  
  if (!response.ok) {
    return {
      status: 'error',
      code: 'system_error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    };
  }
  
  return response.json();
}

// ============================================================================
// PIPELINE DIAGNOSTICS (Debug Info)
// ============================================================================

/**
 * GET /api/discovery/diagnose?startup_id=...
 * 
 * Returns real-time pipeline state for debugging.
 * Shows: queue status, match counts, system state.
 */
export type PipelineDiagnosticRequest = {
  startup_id: string;
};

export type PipelineDiagnosticResponse = {
  startup_id: string;
  queue_status: string;
  queue_attempts: number;
  queue_updated_at: string | null;
  last_error: string | null;
  match_count: number;
  active_match_count: number;
  last_match_at: string | null;
  system_state: 'ready' | 'matching' | 'partial' | 'needs_queue';
  diagnosis: string;
};

/**
 * Diagnose pipeline state for a startup
 */
export async function diagnosePipeline(startupId: string): Promise<PipelineDiagnosticResponse> {
  const response = await fetch(`/api/discovery/diagnose?startup_id=${encodeURIComponent(startupId)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to diagnose pipeline: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// MATCH COUNTS (Threshold Checks)
// ============================================================================

/**
 * GET /api/matches/count?startup_id=...
 * 
 * Fast count check without fetching full match data.
 * Used for "ready vs matching" decision.
 */
export type MatchCountRequest = {
  startup_id: string;
};

export type MatchCountResponse = {
  startup_id: string;
  total: number;
  active: number;
  is_ready: boolean;  // true if total >= 1000
  last_match_at: string | null;
};

/**
 * Get match counts for a startup
 */
export async function getMatchCount(startupId: string): Promise<MatchCountResponse> {
  const response = await fetch(`/api/matches/count?startup_id=${encodeURIComponent(startupId)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get match count: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// TOP MATCHES (Paginated Results)
// ============================================================================

/**
 * GET /api/matches/top?startup_id=...&page=1&per_page=50
 * 
 * Returns top investor matches, sorted by match_score DESC.
 * Only returns data if match_count >= 1000.
 */
export type TopMatchesRequest = {
  startup_id: string;
  page?: number;
  per_page?: number;
};

export type InvestorMatch = {
  investor_id: string;
  name: string;
  match_score: number;
  firm?: string;
  location?: string;
  sectors: string[];
  stage: string;
  check_size_min?: number;
  check_size_max?: number;
  portfolio_count?: number;
  recent_investments?: string[];
  /** Why this is a good match */
  match_reasons?: string[];
};

export type TopMatchesResponse = {
  startup_id: string;
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
  matches: InvestorMatch[];
};

/**
 * Get top matches for a startup (paginated)
 */
export async function getTopMatches(
  startupId: string,
  page: number = 1,
  perPage: number = 50
): Promise<TopMatchesResponse> {
  const params = new URLSearchParams({
    startup_id: startupId,
    page: page.toString(),
    per_page: perPage.toString(),
  });
  
  const response = await fetch(`/api/matches/top?${params}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get matches: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// SIGNAL PROFILE (Startup Data)
// ============================================================================

/**
 * GET /api/signals/:startup_id
 * 
 * Returns startup's signal profile (what VCs see).
 * Includes: GOD score, sectors, stage, traction signals.
 */
export type SignalProfileResponse = {
  startup_id: string;
  name: string;
  tagline?: string;
  website?: string;
  linkedin?: string;
  
  /** Sectors (normalized) */
  sectors: string[];
  
  /** Stage (0-4) */
  stage: number;
  
  /** GOD Score components (0-100) */
  total_god_score: number;
  team_score: number;
  traction_score: number;
  market_score: number;
  product_score: number;
  vision_score: number;
  
  /** Signal strength (derived from GOD score) */
  signal_strength: number;
  signal_band: 'low' | 'med' | 'high';
  
  /** Traction signals */
  revenue_annual?: number;
  mrr?: number;
  arr?: number;
  growth_rate_monthly?: number;
  customer_count?: number;
  team_size?: number;
  
  /** Funding */
  latest_funding_amount?: string;
  latest_funding_round?: string;
  latest_funding_date?: string;
  
  /** Metadata */
  created_at: string;
  updated_at: string;
};

/**
 * Get signal profile for a startup
 */
export async function getSignalProfile(startupId: string): Promise<SignalProfileResponse> {
  const response = await fetch(`/api/signals/${encodeURIComponent(startupId)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get signal profile: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// GUIDANCE (Improvement Recommendations)
// ============================================================================

/**
 * GET /api/signals/:startup_id/guidance
 * 
 * AI-generated advice for improving signal strength.
 * Based on current scores + industry benchmarks.
 */
export type GuidancePayload = {
  startup_id: string;
  
  /** Current state */
  current_signal_strength: number;
  current_band: 'low' | 'med' | 'high';
  
  /** Weakest areas (sorted by improvement potential) */
  improvement_areas: Array<{
    category: 'team' | 'traction' | 'market' | 'product' | 'vision';
    current_score: number;
    target_score: number;
    impact: 'high' | 'medium' | 'low';
    recommendations: string[];
  }>;
  
  /** Next milestone */
  next_milestone?: {
    description: string;
    estimated_signal_increase: number;
    timeframe: string;
  };
};

/**
 * Get improvement guidance for a startup
 */
export async function getGuidance(startupId: string): Promise<GuidancePayload> {
  const response = await fetch(`/api/signals/${encodeURIComponent(startupId)}/guidance`);
  
  if (!response.ok) {
    throw new Error(`Failed to get guidance: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// INVESTOR PROFILE
// ============================================================================

/**
 * GET /api/investors/:investor_id
 * 
 * Returns investor profile (safe for public viewing).
 */
export type InvestorProfileResponse = {
  investor_id: string;
  name: string;
  firm?: string;
  title?: string;
  location?: string;
  linkedin?: string;
  twitter?: string;
  
  /** Investment criteria */
  sectors: string[];
  stage: string;
  check_size_min?: number;
  check_size_max?: number;
  geography_focus?: string[];
  
  /** Portfolio */
  portfolio_count?: number;
  notable_investments?: Array<{
    startup_name: string;
    logo_url?: string;
    description?: string;
  }>;
  
  /** Recent activity */
  recent_investments?: Array<{
    startup_name: string;
    amount?: string;
    date?: string;
  }>;
  
  /** Bio */
  bio?: string;
  investment_thesis?: string;
};

/**
 * Get investor profile
 */
export async function getInvestorProfile(investorId: string): Promise<InvestorProfileResponse> {
  const response = await fetch(`/api/investors/${encodeURIComponent(investorId)}`);
  
  if (!response.ok) {
    throw new Error(`Failed to get investor profile: ${response.status} ${response.statusText}`);
  }
  
  return response.json();
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standard error response shape
 */
export type APIError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
};

/**
 * Check if response is an API error
 */
export function isAPIError(data: any): data is APIError {
  return data && typeof data === 'object' && 'error' in data;
}
