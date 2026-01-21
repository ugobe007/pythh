/**
 * OBSERVATORY DTO TYPES - PUBLIC BOUNDARY
 * ============================================================================
 * These types define the ONLY data shapes that can be returned to investors.
 * 
 * SECURITY ENFORCEMENT:
 * - NO god_score, sub_scores, model_confidences, rank_percentiles
 * - NO founder names, emails, domains, LinkedIn URLs
 * - NO exact metrics (ARR, MRR, headcount, funding amounts)
 * - NO city-level geography (only region buckets)
 * - NO exact timestamps (only week buckets)
 * 
 * These types are the CONTRACT between backend and frontend.
 * If a field isn't here, it CANNOT be returned to investors.
 * ============================================================================
 */

// =============================================================================
// SAFE BUCKET TYPES (coarse categories only)
// =============================================================================

export type StageBucket = 'early' | 'seed' | 'series_a' | 'growth' | 'unspecified';

export type SectorBucket = 
  | 'ai_ml' 
  | 'fintech' 
  | 'healthtech' 
  | 'climate' 
  | 'enterprise_saas' 
  | 'consumer' 
  | 'edtech' 
  | 'proptech' 
  | 'cybersecurity' 
  | 'other' 
  | 'unspecified';

export type GeoBucket = 
  | 'north_america' 
  | 'europe' 
  | 'asia_pacific' 
  | 'middle_east' 
  | 'oceania' 
  | 'latam' 
  | 'africa' 
  | 'other' 
  | 'unspecified';

export type TractionBucket = 'exceptional' | 'strong' | 'promising' | 'emerging' | 'early' | 'unscored';

// Observatory-friendly alignment labels (no score perception)
export type AlignmentState = 
  | 'strong_pattern_match'    // Was: high_alignment (75+)
  | 'multiple_signals'        // Was: moderate_alignment (65-74)
  | 'early_signals'           // Was: low_alignment (55-64)
  | 'emerging'                // Was: minimal_alignment (<55)
  // Legacy values for backwards compat:
  | 'high_alignment' | 'moderate_alignment' | 'low_alignment' | 'minimal_alignment'
  | 'forming' | 'active' | 'strong';

export type SignalType = 
  | 'strong_team' 
  | 'high_traction' 
  | 'large_market' 
  | 'innovative_product' 
  | 'compelling_vision';

export type TrendDirection = 'up' | 'down' | 'stable' | 'improving' | 'declining';

// =============================================================================
// PUBLIC DTO TYPES - SAFE FOR INVESTOR CONSUMPTION
// =============================================================================

/**
 * Anonymized flow item - CANNOT contain any identifying information
 */
export interface InvestorObservatoryFlowItemPublic {
  // Hashed ID (not the real startup ID)
  anon_id: string;
  
  // Categorical type label only (e.g., "AI-first SaaS")
  startup_type_label: string;
  
  // Coarse buckets only
  stage_bucket: StageBucket;
  sector_bucket: SectorBucket;
  geo_bucket: GeoBucket;
  
  // Alignment (categorical, not numeric)
  alignment_state: AlignmentState;
  
  // Signals present (categorical)
  signals_present: SignalType[];
  
  // Why this appeared (text explanation)
  why_appeared: string;
  
  // Trend (categorical)
  trend: 'new' | 'rising' | 'stable' | 'fading';
  
  // Week bucket only (never exact time)
  first_appeared_week: string; // ISO week format
  last_signal_week: string;
  
  // Count of signals (allowed - not identifying)
  signal_count: number;
}

/**
 * Signal distribution item - aggregated stats only
 */
export interface SignalDistributionPublic {
  signal_type: string;
  signal_label: string;
  occurrence_count: number;
  percentage: number;
  trend_direction: TrendDirection;
}

/**
 * Entry path distribution - how discovery is happening
 */
export interface EntryPathPublic {
  entry_path: string;
  path_label: string;
  occurrence_count: number;
  percentage: number;
  // Note: avg_alignment_quality is a coarse 1-5 scale, not a score
  avg_alignment_quality_bucket: 'low' | 'medium' | 'high';
}

/**
 * Quality drift week - weekly aggregates only
 */
export interface QualityDriftWeekPublic {
  week_bucket: string; // ISO week format
  total_inbound: number;
  
  // Counts by alignment state
  strong_count: number;
  active_count: number;
  forming_count: number;
  
  // Percentages (derived, not raw scores)
  strong_percentage: number;
  active_percentage: number;
  forming_percentage: number;
  
  // Trend direction (categorical)
  trend_direction: TrendDirection;
}

/**
 * Observatory summary - high-level stats only
 */
export interface ObservatorySummaryPublic {
  total_in_flow: number;
  new_this_week: number;
  strong_alignment_count: number;
  
  // Labels only, no scores
  top_signal_label: string;
  top_entry_path_label: string;
  
  // Categorical trend
  quality_trend: TrendDirection;
}

/**
 * Feedback - what investor can submit
 */
export type FeedbackType = 'good_inbound' | 'not_relevant' | 'too_early';

export interface InvestorFeedbackInput {
  flow_item_anon_id: string; // Hashed ID only
  feedback_type: FeedbackType;
}

// =============================================================================
// FIELD BLOCKLIST - THESE MUST NEVER APPEAR IN PUBLIC TYPES
// =============================================================================

/**
 * BLOCKED FIELDS - NEVER RETURN TO INVESTORS
 * 
 * Startup identification:
 * - id (real UUID)
 * - name
 * - domain, website, url
 * - founder_names, founder_emails, founder_linkedin
 * - team_member_names
 * - company_linkedin, twitter, social_urls
 * 
 * Exact metrics:
 * - god_score, total_god_score
 * - team_score, traction_score, market_score, product_score, vision_score
 * - model_confidence, rank_percentile
 * - arr, mrr, revenue
 * - headcount, employee_count
 * - funding_amount, valuation
 * - customer_count, user_count
 * 
 * Identifying location:
 * - city, address
 * - exact coordinates
 * 
 * Identifying time:
 * - exact created_at, updated_at timestamps
 * - exact funding_date
 * 
 * Internal data:
 * - extracted_data (may contain PII)
 * - raw_pitch, full_description
 */

// =============================================================================
// SANITIZATION HELPERS
// =============================================================================

/**
 * Convert alignment quality (1-100) to safe bucket
 */
export function toAlignmentQualityBucket(quality: number): 'low' | 'medium' | 'high' {
  if (quality >= 70) return 'high';
  if (quality >= 40) return 'medium';
  return 'low';
}

/**
 * Convert date to week bucket (removes exact timing)
 */
export function toWeekBucket(date: Date | string): string {
  const d = new Date(date);
  const startOfWeek = new Date(d);
  startOfWeek.setDate(d.getDate() - d.getDay());
  return startOfWeek.toISOString().split('T')[0];
}

/**
 * Validate that an object doesn't contain blocked fields
 */
export function validateNoBlockedFields(obj: Record<string, unknown>, context: string): void {
  const blockedFields = [
    'id', 'name', 'domain', 'website', 'url',
    'founder_names', 'founder_emails', 'founder_linkedin',
    'team_member_names', 'company_linkedin', 'twitter', 'social_urls',
    'god_score', 'total_god_score',
    'team_score', 'traction_score', 'market_score', 'product_score', 'vision_score',
    'model_confidence', 'rank_percentile',
    'arr', 'mrr', 'revenue',
    'headcount', 'employee_count',
    'funding_amount', 'valuation',
    'customer_count', 'user_count',
    'city', 'address', 'coordinates',
    'extracted_data', 'raw_pitch', 'full_description'
  ];
  
  const foundBlocked = Object.keys(obj).filter(k => blockedFields.includes(k.toLowerCase()));
  
  if (foundBlocked.length > 0) {
    console.error(`[SECURITY] Blocked fields detected in ${context}:`, foundBlocked);
    throw new Error(`Security violation: attempted to expose blocked fields in ${context}`);
  }
}
