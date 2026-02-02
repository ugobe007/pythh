/**
 * ============================================================================
 * SIGNAL APPLICATION SERVICE
 * ============================================================================
 * 
 * PURPOSE: Apply market signals ON TOP of GOD scores (layered architecture)
 * 
 * KEY PRINCIPLES:
 *   1. Signals DO NOT modify GOD algorithms
 *   2. Signals add 1-3 points typical (7+ rare, 10 max)
 *   3. 50% change threshold for stability (no noise)
 *   4. Signals capture MARKET PSYCHOLOGY (predictive intelligence)
 *   5. Once captured, signals remain steady until significant changes
 * 
 * ARCHITECTURE:
 *   FINAL SCORE = GOD base (0-100) + Signals bonus (0-10)
 *   Signals are stored separately for full auditability
 * 
 * ⚠️  SIGNAL CHANGES ONLY APPLY IF:
 *   - New signal value differs by ≥50% from stored value
 *   - This prevents noise/over-reaction to minor market movements
 * 
 * ============================================================================
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// SIGNAL DIMENSIONS (5 total, 10 points max)
// ============================================================================
// These capture MARKET PSYCHOLOGY, not startup fundamentals

export interface SignalDimensions {
  // Product velocity: shipping cadence, launch speed, iteration pace
  product_velocity: number;       // 0-1 normalized → max 2.0 points
  
  // Funding acceleration: investor clustering, capital convergence
  funding_acceleration: number;   // 0-1 normalized → max 2.5 points
  
  // Customer adoption: user growth velocity, retention signals
  customer_adoption: number;      // 0-1 normalized → max 2.0 points
  
  // Market momentum: news coverage, press mentions, attention
  market_momentum: number;        // 0-1 normalized → max 1.5 points
  
  // Competitive dynamics: market positioning, moat signals
  competitive_dynamics: number;   // 0-1 normalized → max 2.0 points
}

// Point allocation per dimension (sums to 10)
const SIGNAL_MAX_POINTS = {
  product_velocity: 2.0,
  funding_acceleration: 2.5,
  customer_adoption: 2.0,
  market_momentum: 1.5,
  competitive_dynamics: 2.0,
} as const;

// ============================================================================
// SIGNAL STABILITY THRESHOLD (50%)
// ============================================================================
// Signals only update when they change by ≥50%
// This prevents noise and over-reaction to minor market movements

const SIGNAL_CHANGE_THRESHOLD = 0.50; // 50%

/**
 * Check if a signal change is significant enough to apply
 * Returns true if newValue differs from storedValue by ≥50%
 */
export function isSignificantChange(storedValue: number, newValue: number): boolean {
  if (storedValue === 0) {
    // If no stored value, any new value ≥0.2 is significant
    return newValue >= 0.2;
  }
  
  const percentChange = Math.abs(newValue - storedValue) / storedValue;
  return percentChange >= SIGNAL_CHANGE_THRESHOLD;
}

// ============================================================================
// COMPUTE SIGNALS BONUS
// ============================================================================

export interface SignalsResult {
  // Total bonus to add to GOD score (0-10, typically 1-3)
  signals_bonus: number;
  
  // Individual dimension contributions
  dimension_points: {
    product_velocity: number;
    funding_acceleration: number;
    customer_adoption: number;
    market_momentum: number;
    competitive_dynamics: number;
  };
  
  // Whether this represents a significant change from stored
  is_significant_change: boolean;
  
  // Raw dimension values (0-1 normalized)
  raw_dimensions: SignalDimensions;
}

/**
 * Compute signals bonus from dimensions
 * Returns 0-10 points (typically 1-3, 7+ rare)
 */
export function computeSignalsBonus(
  dimensions: SignalDimensions,
  storedDimensions?: SignalDimensions
): SignalsResult {
  
  // Check if any dimension changed significantly
  let isSignificant = false;
  if (storedDimensions) {
    for (const key of Object.keys(dimensions) as (keyof SignalDimensions)[]) {
      if (isSignificantChange(storedDimensions[key] || 0, dimensions[key])) {
        isSignificant = true;
        break;
      }
    }
  } else {
    // No stored dimensions = first calculation, always significant
    isSignificant = true;
  }
  
  // Calculate points per dimension
  const dimension_points = {
    product_velocity: dimensions.product_velocity * SIGNAL_MAX_POINTS.product_velocity,
    funding_acceleration: dimensions.funding_acceleration * SIGNAL_MAX_POINTS.funding_acceleration,
    customer_adoption: dimensions.customer_adoption * SIGNAL_MAX_POINTS.customer_adoption,
    market_momentum: dimensions.market_momentum * SIGNAL_MAX_POINTS.market_momentum,
    competitive_dynamics: dimensions.competitive_dynamics * SIGNAL_MAX_POINTS.competitive_dynamics,
  };
  
  // Sum total (max 10)
  let signals_bonus = 
    dimension_points.product_velocity +
    dimension_points.funding_acceleration +
    dimension_points.customer_adoption +
    dimension_points.market_momentum +
    dimension_points.competitive_dynamics;
  
  // Round to 1 decimal
  signals_bonus = Math.round(signals_bonus * 10) / 10;
  
  // HARD CLAMP (defensive programming)
  signals_bonus = Math.max(0, Math.min(10, signals_bonus));
  
  // RUNTIME INVARIANT
  if (signals_bonus < 0 || signals_bonus > 10) {
    throw new Error(`SIGNALS_BONUS_OUT_OF_RANGE: ${signals_bonus}`);
  }
  
  return {
    signals_bonus,
    dimension_points,
    is_significant_change: isSignificant,
    raw_dimensions: dimensions,
  };
}

// ============================================================================
// APPLY SIGNALS TO GOD SCORE
// ============================================================================

export interface ApplySignalsInput {
  startup_id: string;
  god_base_score: number;  // 0-100 from GOD algorithms
  new_dimensions: SignalDimensions;
}

export interface ApplySignalsResult {
  final_score: number;           // god_base + signals_bonus (clamped 0-100)
  god_base_score: number;        // Original GOD score (unchanged)
  signals_bonus: number;         // 0-10 bonus applied
  signals_applied: boolean;      // True if signals were updated (passed 50% threshold)
  dimension_points: SignalsResult['dimension_points'];
}

/**
 * Apply signals bonus to a GOD score
 * 
 * ONLY updates if signals changed by ≥50% from stored values
 * Otherwise, uses stored signals bonus
 */
export async function applySignalsToGodScore(
  input: ApplySignalsInput
): Promise<ApplySignalsResult> {
  
  // Fetch stored signal state for this startup
  const { data: stored } = await supabase
    .from('startup_signals_state')
    .select('dimensions, signals_bonus')
    .eq('startup_id', input.startup_id)
    .single();
  
  const storedDimensions = stored?.dimensions as SignalDimensions | undefined;
  const storedBonus = stored?.signals_bonus ?? 0;
  
  // Compute new signals
  const result = computeSignalsBonus(input.new_dimensions, storedDimensions);
  
  let signals_bonus: number;
  let signals_applied: boolean;
  
  if (result.is_significant_change) {
    // Significant change → use new signals and update stored state
    signals_bonus = result.signals_bonus;
    signals_applied = true;
    
    // Upsert the new signal state
    await supabase
      .from('startup_signals_state')
      .upsert({
        startup_id: input.startup_id,
        dimensions: input.new_dimensions,
        signals_bonus: result.signals_bonus,
        last_significant_change: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'startup_id' });
      
    console.log(`[SIGNALS] Startup ${input.startup_id}: Significant change detected. New bonus: ${signals_bonus}`);
  } else {
    // No significant change → use stored bonus
    signals_bonus = storedBonus;
    signals_applied = false;
    
    console.log(`[SIGNALS] Startup ${input.startup_id}: No significant change. Using stored bonus: ${signals_bonus}`);
  }
  
  // Calculate final score
  const final_score = Math.min(100, input.god_base_score + signals_bonus);
  
  return {
    final_score,
    god_base_score: input.god_base_score,
    signals_bonus,
    signals_applied,
    dimension_points: result.dimension_points,
  };
}

// ============================================================================
// SIGNAL DIMENSION CALCULATORS
// ============================================================================
// These functions extract signal dimensions from startup data
// They capture MARKET PSYCHOLOGY, not fundamentals

/**
 * Calculate product velocity signal (0-1)
 * Measures: shipping cadence, launch speed, iteration pace
 */
export function calculateProductVelocity(startup: any): number {
  let score = 0;
  
  // Launched product
  if (startup.launched || startup.is_launched) {
    score += 0.3;
  }
  
  // Has demo
  if (startup.has_demo || startup.demo_available) {
    score += 0.2;
  }
  
  // Recent launch (within 6 months of founding)
  if (startup.founded_date && startup.launched) {
    const foundedDate = new Date(startup.founded_date);
    const now = new Date();
    const monthsSinceFounding = (now.getTime() - foundedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceFounding <= 6) {
      score += 0.3;
    } else if (monthsSinceFounding <= 12) {
      score += 0.15;
    }
  }
  
  // Text signals
  const text = [startup.tagline || '', startup.pitch || '', startup.description || ''].join(' ').toLowerCase();
  if (text.includes('shipped') || text.includes('launched') || text.includes('live')) {
    score += 0.1;
  }
  if (text.includes('fast') || text.includes('rapid') || text.includes('agile')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Calculate funding acceleration signal (0-1)
 * Measures: investor clustering, capital convergence, funding velocity
 */
export function calculateFundingAcceleration(startup: any): number {
  let score = 0;
  
  // Has previous funding
  if (startup.previous_funding || startup.funding_amount) {
    score += 0.3;
  }
  
  // Multiple investors interested
  if (startup.investor_interest_count && startup.investor_interest_count > 3) {
    score += 0.2;
  }
  
  // Recent funding (within last 6 months)
  if (startup.last_funding_date) {
    const fundingDate = new Date(startup.last_funding_date);
    const now = new Date();
    const monthsSinceFunding = (now.getTime() - fundingDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceFunding <= 6) {
      score += 0.3;
    }
  }
  
  // Text signals
  const text = [startup.tagline || '', startup.pitch || '', startup.description || ''].join(' ').toLowerCase();
  if (text.includes('raised') || text.includes('funded') || text.includes('investment')) {
    score += 0.1;
  }
  if (text.includes('yc') || text.includes('sequoia') || text.includes('a16z') || text.includes('tier 1')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Calculate customer adoption signal (0-1)
 * Measures: user growth velocity, retention, adoption signals
 */
export function calculateCustomerAdoption(startup: any): number {
  let score = 0;
  
  // Has customers
  if (startup.customers || startup.customer_count || startup.has_customers) {
    score += 0.3;
  }
  
  // Has revenue
  if (startup.revenue || startup.mrr || startup.arr || startup.has_revenue) {
    score += 0.3;
  }
  
  // Growth rate
  if (startup.growth_rate && startup.growth_rate > 20) {
    score += 0.2;
  }
  
  // Text signals
  const text = [startup.tagline || '', startup.pitch || '', startup.description || ''].join(' ').toLowerCase();
  if (text.includes('customers') || text.includes('users') || text.includes('clients')) {
    score += 0.1;
  }
  if (text.includes('growth') || text.includes('growing') || text.includes('traction')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Calculate market momentum signal (0-1)
 * Measures: news coverage, press mentions, market attention
 */
export function calculateMarketMomentum(startup: any): number {
  let score = 0;
  
  // Press mentions
  if (startup.press_mentions && startup.press_mentions > 0) {
    score += Math.min(0.4, startup.press_mentions * 0.1);
  }
  
  // News signals
  if (startup.news_count && startup.news_count > 0) {
    score += Math.min(0.3, startup.news_count * 0.05);
  }
  
  // Text signals
  const text = [startup.tagline || '', startup.pitch || '', startup.description || ''].join(' ').toLowerCase();
  if (text.includes('featured') || text.includes('press') || text.includes('techcrunch')) {
    score += 0.2;
  }
  if (text.includes('trending') || text.includes('viral') || text.includes('buzz')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Calculate competitive dynamics signal (0-1)
 * Measures: market positioning, moat signals, competitive edge
 */
export function calculateCompetitiveDynamics(startup: any): number {
  let score = 0;
  
  // Defensibility
  if (startup.defensibility === 'high' || startup.unique_ip) {
    score += 0.4;
  } else if (startup.defensibility === 'medium') {
    score += 0.2;
  }
  
  // Strategic partners
  if (startup.strategic_partners && startup.strategic_partners.length > 0) {
    score += Math.min(0.3, startup.strategic_partners.length * 0.1);
  }
  
  // Text signals
  const text = [startup.tagline || '', startup.pitch || '', startup.description || ''].join(' ').toLowerCase();
  if (text.includes('moat') || text.includes('defensible') || text.includes('patent')) {
    score += 0.2;
  }
  if (text.includes('network effect') || text.includes('flywheel') || text.includes('unfair advantage')) {
    score += 0.1;
  }
  
  return Math.min(1, score);
}

/**
 * Calculate all signal dimensions for a startup
 */
export function calculateAllSignalDimensions(startup: any): SignalDimensions {
  return {
    product_velocity: calculateProductVelocity(startup),
    funding_acceleration: calculateFundingAcceleration(startup),
    customer_adoption: calculateCustomerAdoption(startup),
    market_momentum: calculateMarketMomentum(startup),
    competitive_dynamics: calculateCompetitiveDynamics(startup),
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  SIGNAL_MAX_POINTS,
  SIGNAL_CHANGE_THRESHOLD,
};
