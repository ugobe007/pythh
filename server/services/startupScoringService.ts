/**
 * ============================================================================
 * GOD SCORING SERVICE - LOCKED SYSTEM
 * ============================================================================
 * 
 * ⛔ AUTHORIZATION REQUIRED ⛔
 * 
 * This system can ONLY be modified by:
 *   1. ADMIN (manual approval required)
 *   2. ML AGENT (componentWeights only, via approved training pipeline)
 * 
 * NO AI COPILOT may modify this file without explicit admin approval.
 * 
 * ============================================================================
 * ARCHITECTURE (IMMUTABLE)
 * ============================================================================
 * 
 * GOD SCORE = 23 weighted algorithms evaluating:
 *   - Team, Traction, Market, Product, Vision, Ecosystem, Grit, Problem Validation
 *   - Based on YC, Sequoia, Founders Fund, First Round, a16z criteria
 * 
 * SIGNALS = Layered ON TOP (separate system, see signalClassification.ts)
 *   - Expected boost: 1-3 points typical, 7+ rare, 10 max
 *   - 50% change threshold for stability (no noise)
 *   - Signals read MARKET (predictive intelligence)
 *   - Signals DO NOT modify GOD algorithms
 * 
 * FINAL SCORE = GOD base (0-100) + Signals bonus (0-10, applied separately)
 * 
 * ============================================================================
 * FOUNDER CRITERIA
 * ============================================================================
 * 
 * FOUNDER AGE FACTOR: Younger founders (under 30) get bonus points for adaptability,
 * coachability, and hunger. This reflects real VC preferences (YC, Thiel Fellowship, etc.)
 * 
 * FOUNDER COURAGE & INTELLIGENCE: Based on Ben Horowitz (a16z) framework.
 * Great founders need both courage (hard decisions, persist through adversity)
 * and intelligence (strategic thinking, problem-solving, fast learning).
 */

// ============================================================================
// ⛔ REMOVED: Unauthorized scoring components (Jan 30, 2026)
// The following were incorrectly added by AI copilot without admin approval:
//   - velocityScoring.ts
//   - capitalEfficiencyScoring.ts  
//   - marketTimingScoring.ts
// These concepts should be SIGNALS (layered), not GOD components.
// ============================================================================

// ============================================================================
// GOD SCORE CALIBRATION SETTINGS (TypeScript Configuration Object)
// ============================================================================
// ⚠️  THIS IS TYPESCRIPT CODE - DO NOT EXECUTE AS SQL
// 
// ⚠️  CRITICAL: DO NOT MAKE ARBITRARY ADJUSTMENTS TO THIS SYSTEM
// 
// The GOD scoring system is based on REAL VC criteria (YC, Sequoia, Founders Fund, 
// First Round, Seed/Angel, a16z) and must reflect actual investor preferences and 
// deal quality. Arbitrary normalization changes corrupt the logic.
// 
// PROPER CALIBRATION METHOD:
// 1. Run: npx tsx scripts/calibrate-god-scores.ts
// 2. Analyze REAL investment outcomes (funded vs passed deals)
// 3. Review ML recommendations from server/services/mlTrainingService.ts
// 4. Adjust based on ACTUAL data, not arbitrary normalization
// 
// Expected Score Ranges (from validation criteria):
// - High-quality startups: 78-98 (should receive funding)
// - Low-quality startups: 30-48 (should be passed)
// - Average startups: 50-77 (varies by investor)
// 
// Current Configuration:
// - normalizationDivisor: Controls overall score scaling (DO NOT CHANGE ARBITRARILY)
// - baseBoostMinimum: Minimum baseline score (preserves market signal sensitivity)
// - vibeBonusCap: Qualitative bonus cap (based on VC preferences)
// 
// How it works:
// - rawTotal = baseBoost (min 3.5) + component scores (max ~17.5) = max ~21.0
// - Component scores reflect REAL investor criteria (team, traction, market, etc.)
// - total (0-10 scale) = (rawTotal / normalizationDivisor) * 10
// - Final score (0-100) = total * 10 (done in recalculate-scores.ts)
// 
// ⚠️  IF SCORES ARE TOO HIGH/LOW:
// 1. First, analyze REAL outcomes using calibrate-god-scores.ts
// 2. Check if component weights need adjustment (not normalization)
// 3. Verify market signals (funding velocity) are properly weighted
// 4. Review ML recommendations for data-driven adjustments
// 5. Only adjust normalization as LAST RESORT, with clear justification

// ============================================================================
// GOD SCORE CONFIG - ADMIN + ML AGENT ONLY
// ============================================================================
// ⛔ DO NOT MODIFY without admin approval or ML training pipeline
// 
// CHANGE LOG:
//   - Jan 31, 2026: Admin approved - 19.5 → 17.5 to lift avg from 47 → ~54
//     (Bootstrap scoring handles sparse-data startups separately now)
//   - Jan 30, 2026 (4): Admin fine-tuned - 62.9 avg → target 57-59
//   - Jan 30, 2026 (3): Admin adjusted - lower avg but respect 40 floor trigger
//   - Jan 30, 2026 (2): Admin adjusted - avg 66.5 too high, target 55-60
//   - Jan 30, 2026: Reverted to proper calibration after unauthorized changes
//   - Original: normalizationDivisor=17, baseBoostMinimum=3.5
//   - Corrupted: normalizationDivisor=23 (crushed scores to 38 avg)
//   - Calibrated: normalizationDivisor=19.5, baseBoostMinimum=4.2 (admin approved)
//   - Note: Database has CHECK constraint preventing scores < 40
// ============================================================================

const GOD_SCORE_CONFIG = {
  // Normalization divisor - controls overall score scaling
  // ⛔ LOCKED: Only admin or ML agent can modify
  // Math: rawTotal (~17.5 max) / 17.5 * 10 = ~10.0 → 100 max, ~54-57 avg target
  // Reduced from 19.5 to lift scores (bootstrap scoring now handles sparse data)
  normalizationDivisor: 17.5,  // Admin calibrated Jan 31 - lifted to target ~54-57 avg
  
  // Base boost minimum - floor for data-poor startups
  // ⛔ LOCKED: Only admin or ML agent can modify
  // Note: Must keep scores above 40 (database trigger constraint)
  baseBoostMinimum: 4.2,  // Admin calibrated Jan 30 - ensures min ~43 after normalization
  
  // Vibe bonus cap - qualitative signal boost
  vibeBonusCap: 1.0,
  
  // Final score multiplier (converts 0-10 to 0-100)
  finalScoreMultiplier: 10,
  
  // Alert thresholds for auto-monitoring
  averageScoreAlertHigh: 70,
  averageScoreAlertLow: 50,
} as const;

// Export for use in other TypeScript files if needed
export { GOD_SCORE_CONFIG };

interface StartupProfile {
  // Basic info
  name?: string;
  website?: string;
  value_proposition?: string;
  
  // Team
  team?: Array<{
    name: string;
    role: string;
    background?: string;
    previousCompanies?: string[];
    education?: string;
    age?: number; // Founder age if known
  }>;
  founders_count?: number;
  technical_cofounders?: number;
  
  // Founder Age (NEW)
  founder_avg_age?: number;
  founder_youngest_age?: number;
  founders_under_30?: number;
  founders_under_25?: number;
  first_time_founders?: boolean;
  
  // Founder Attributes (NEW)
  founder_courage?: 'low' | 'moderate' | 'high' | 'exceptional'; // Risk-taking, bold decisions, resilience
  founder_intelligence?: 'low' | 'moderate' | 'high' | 'exceptional'; // Problem-solving, strategic thinking, learning ability
  // Indicators for courage
  bold_decisions_made?: number; // Number of significant risky decisions
  times_rejected_but_persisted?: number; // Rejections overcome
  high_risk_opportunities_pursued?: number; // Risky bets taken
  resilience_demonstrated?: boolean; // Evidence of bouncing back from setbacks
  // Indicators for intelligence
  strategic_thinking_evidence?: string; // Examples of strategic decisions
  problem_solving_examples?: string[]; // Complex problems solved
  learning_velocity_evidence?: string; // Fast adaptation to new information
  analytical_depth?: 'surface' | 'moderate' | 'deep'; // Depth of analysis
  
  // Traction
  revenue?: number;
  mrr?: number;
  active_users?: number;
  growth_rate?: number; // Monthly % growth
  customers?: number;
  signed_contracts?: number;
  
  // Boolean inference signals (from pattern-matching extraction)
  // These are used when we know something exists but don't have exact numbers
  has_revenue?: boolean; // Inferred: startup mentions revenue but amount unknown
  has_customers?: boolean; // Inferred: startup has customers but count unknown
  execution_signals?: string[]; // e.g., ['Product Launched', 'Has Revenue', 'Has Customers']
  team_signals?: string[]; // e.g., ['Ex-Google', 'Stanford MBA', 'Serial Founder']
  funding_amount?: number; // Extracted funding amount
  funding_stage?: string; // e.g., 'Seed', 'Series A'
  
  // Seed/Angel specific metrics
  churn_rate?: number; // Monthly churn %
  retention_rate?: number; // Monthly retention %
  prepaying_customers?: number; // Customers who paid upfront
  gmv?: number; // Gross merchandise value
  
  // Sales Velocity Metrics (NEW)
  arr?: number; // Annual Recurring Revenue
  arr_growth_rate?: number; // YoY ARR growth %
  customer_count?: number; // Total customers
  customer_growth_monthly?: number; // MoM customer growth %
  sales_cycle_days?: number; // Average sales cycle length
  cac?: number; // Customer Acquisition Cost
  ltv?: number; // Lifetime Value
  ltv_cac_ratio?: number; // LTV/CAC ratio (>3 is healthy)
  nrr?: number; // Net Revenue Retention % (>100 is expansion)
  time_to_first_revenue_months?: number; // Months from founding to first $
  months_to_1m_arr?: number; // Months to reach $1M ARR
  
  // Product
  demo_available?: boolean;
  launched?: boolean;
  unique_ip?: boolean;
  defensibility?: string; // 'high', 'medium', 'low'
  mvp_stage?: boolean; // Has moved beyond concept to tangible MVP
  
  // Market
  market_size?: number | string; // TAM in billions (can be string like "$10B")
  industries?: string[];
  problem?: string;
  solution?: string;
  
  // First Round Capital criteria
  contrarian_insight?: string; // What do they understand differently?
  creative_strategy?: string; // Unique go-to-market or product approach
  passionate_customers?: number; // Small group of early advocates
  vision_statement?: string; // Founder's unique vision
  
  // NEW: Ecosystem & Partnerships (Mitsubishi Chemical VC criteria)
  strategic_partners?: Array<{
    name: string;
    type: 'distribution' | 'technology' | 'referral' | 'integration' | 'supplier';
    relationship_stage: 'prospect' | 'pilot' | 'signed' | 'revenue_generating';
    description?: string;
  }>;
  advisors?: Array<{
    name: string;
    background: string;
    role: string;
  }>;
  platform_dependencies?: string[]; // e.g., ['OpenAI', 'AWS', 'Stripe']
  
  // NEW: Grit & Adaptability
  pivots_made?: number; // How many times they've pivoted
  pivot_history?: Array<{
    from: string;
    to: string;
    reason: string;
    months_ago: number;
  }>;
  customer_feedback_frequency?: 'daily' | 'weekly' | 'monthly' | 'rarely'; // How often they talk to customers
  time_to_iterate_days?: number; // How fast they ship updates based on feedback
  
  // NEW: Deep Customer Problem Validation (Your #1 criterion)
  customer_interviews_conducted?: number;
  customer_pain_data?: {
    cost_of_problem?: number; // $ impact on customer
    time_wasted_hours?: number; // Time impact
    frequency?: 'daily' | 'weekly' | 'monthly'; // How often pain occurs
    willingness_to_pay_validated?: boolean; // Do customers say they'll pay?
  };
  icp_clarity?: 'vague' | 'moderate' | 'crystal_clear'; // How well-defined is ideal customer profile
  problem_discovery_depth?: 'surface' | 'moderate' | 'deep'; // How well do they understand the problem
  
  // YC-STYLE METRICS (Fund founders, not ideas)
  // Speed & Execution
  weeks_since_idea?: number; // How long since they started
  features_shipped_last_month?: number; // Velocity of shipping
  days_from_idea_to_mvp?: number; // Speed to first product
  deployment_frequency?: 'daily' | 'weekly' | 'monthly' | 'rarely'; // How often they ship
  
  // Unique Insight (Non-obvious thesis)
  contrarian_belief?: string; // What do they believe that others don't?
  why_now?: string; // Why is this the right time?
  unfair_advantage?: string; // What makes them uniquely suited?
  
  // User Love (Quality > Quantity)
  nps_score?: number; // Net Promoter Score (0-100)
  users_who_would_be_very_disappointed?: number; // Sean Ellis test %
  organic_referral_rate?: number; // % of users from word of mouth
  daily_active_users?: number; // DAU
  weekly_active_users?: number; // WAU
  dau_wau_ratio?: number; // DAU/WAU engagement ratio
  
  // Learning Velocity
  experiments_run_last_month?: number; // How many tests they ran
  hypotheses_validated?: number; // Learnings captured
  pivot_speed_days?: number; // How fast they adapt
  
  // Stage & Funding
  stage?: number;
  previous_funding?: number;
  backed_by?: string[]; // Other investors
  
  // Seed/Angel specific - Financial planning
  funding_needed?: number; // How much they're raising
  runway_months?: number; // How long current funding lasts
  burn_rate?: number; // Monthly expenses
  use_of_funds?: string; // Clear plan for capital deployment
  next_milestone?: string; // What they'll achieve with this funding
  
  // Metadata
  founded_date?: string;
  tagline?: string;
  pitch?: string;
  
  // ============================================================================
  // PSYCHOLOGICAL SIGNALS (Phase 1 - Feb 12, 2026)
  // ============================================================================
  // ADMIN APPROVED: Behavioral intelligence layer
  // These are SIGNALS (layered on top), not GOD components
  // Ref: PSYCHOLOGICAL_SIGNALS_PHASE1_COMPLETE.md
  // Ref: BEHAVIORAL_SIGNAL_AUDIT.md
  // ============================================================================
  
  // Oversubscription Signal (FOMO indicator)
  is_oversubscribed?: boolean;
  oversubscription_multiple?: number; // 2x, 3x, 5x, etc.
  fomo_signal_strength?: number; // 0-1.0
  
  // Follow-On Signal (Conviction indicator)
  has_followon?: boolean;
  followon_investors?: string[]; // ['Sequoia Capital', 'Greylock Partners']
  conviction_signal_strength?: number; // 0-1.0
  
  // Competitive Signal (Urgency indicator)
  is_competitive?: boolean;
  term_sheet_count?: number; // Number of term sheets received
  urgency_signal_strength?: number; // 0-1.0
  
  // Bridge Round Signal (Risk indicator)
  is_bridge_round?: boolean;
  risk_signal_strength?: number; // 0-1.0
  
  // Calculated bonus (additive to base GOD score)
  psychological_bonus?: number; // -3 to +10 points (additive)
  enhanced_god_score?: number; // total_god_score + psychological_bonus (capped at 100)
}

interface HotScore {
  total: number; // 1-10 (rebalanced scoring)
  breakdown: {
    team_execution: number; // 0-3
    product_vision: number; // 0-2 (RESTORED)
    founder_courage: number; // 0-1.5
    market_insight: number; // 0-1.5
    team_age: number; // 0-1
    traction: number; // 0-3
    market: number; // 0-2
    product: number; // 0-2 (RESTORED)
    // ⛔ REMOVED: velocity, capital_efficiency, market_timing
    // These belong in SIGNALS layer, not GOD scoring
  };
  matchCount: number; // How many investors to match (5-20)
  reasoning: string[];
  tier: 'hot' | 'warm' | 'cold';
  // ⛔ REMOVED: velocitySignals, efficiencySignals, timingSignals, matchedSectors
  // These concepts should be in SIGNAL layer
  
  // ============================================================================
  // PSYCHOLOGICAL SIGNALS (Phase 1 - Feb 12, 2026) - ADMIN APPROVED
  // ============================================================================
  psychological_bonus?: number; // -0.3 to +1.0 (on 0-10 scale)
  enhanced_total?: number; // total + psychological_bonus (on 0-10 scale)
  psychological_signals?: {
    fomo?: number; // 0-1.0
    conviction?: number; // 0-1.0
    urgency?: number; // 0-1.0
    risk?: number; // 0-1.0
  };
}

/**
 * Main scoring function - evaluates startup quality
 */
export function calculateHotScore(startup: StartupProfile): HotScore {
    // --- Funding Velocity Bonus ---
    // If a startup raised their first round quickly after founding, add a bonus to team execution
    let fundingVelocityBonus = 0;
    if (startup.founded_date && startup.previous_funding && typeof startup.previous_funding === 'number') {
      const founded = new Date(startup.founded_date);
      const now = new Date();
      const monthsSinceFounding = (now.getTime() - founded.getTime()) / (1000 * 60 * 60 * 24 * 30);
      // If raised any funding within 6 months of founding, strong signal
      if (monthsSinceFounding <= 6) {
        fundingVelocityBonus = 0.4;
      } else if (monthsSinceFounding <= 12) {
        fundingVelocityBonus = 0.2;
      }
    }

  /**
   * RED FLAGS SCORING (0 to -1.5 points)
   * Negative signals that predict funding failure
   */
  function scoreRedFlags(startup: StartupProfile): number {
    let penalty = 0;
    
    if (startup.platform_dependencies && startup.platform_dependencies.length >= 3) {
      penalty -= 0.3;
    }
    
    if (startup.defensibility === 'low') {
      penalty -= 0.3;
    }
    
    if (startup.name && startup.name.toLowerCase().includes('clone')) {
      penalty -= 0.5;
    }
    
    if (startup.pivots_made && startup.pivots_made >= 4) {
      penalty -= 0.3;
    }
    
    if (startup.first_time_founders && !startup.mrr && !startup.revenue) {
      penalty -= 0.2;
    }
    
    return Math.max(penalty, -1.5);
  }

  // QUICK FIX: Base score boost for all startups with ANY content
  // This prevents scores of 0/100 and gives credit for basic presence
  let baseBoost = 0;
  
  // 🔥 VIBE SCORE - Qualitative story/narrative bonus (RESTORED WEIGHT)
  // VIBE = Value proposition + Insight + Business model + Execution + market
  // This measures "fundability" - the intangibles that make VCs say yes
  let vibeBonus = 0;
  const startupAny = startup as any; // Cast to access VIBE fields
  
  // 1. Problem/Value Proposition (0-0.6 points) - THE HOOK
  // Elite VCs need to understand the problem in 30 seconds
  if (startupAny.value_proposition || startupAny.problem) {
    const problemText = startupAny.value_proposition || startupAny.problem || '';
    const problemLength = problemText.length;
    if (problemLength > 200) vibeBonus += 0.6; // Deep understanding
    else if (problemLength > 100) vibeBonus += 0.4; // Good clarity
    else if (problemLength > 50) vibeBonus += 0.2;
    else if (problemLength > 0) vibeBonus += 0.1;
  }
  
  // 2. Solution Clarity (0-0.6 points) - THE AHA MOMENT
  // Does the solution feel inevitable? Is it 10x better?
  if (startupAny.solution) {
    const solutionLength = startupAny.solution.length;
    if (solutionLength > 200) vibeBonus += 0.6; // Clear, detailed solution
    else if (solutionLength > 100) vibeBonus += 0.4;
    else if (solutionLength > 50) vibeBonus += 0.2;
    else if (solutionLength > 0) vibeBonus += 0.1;
  }
  
  // 3. Market Understanding (0-0.5 points) - KNOWS THE BATTLEFIELD
  // Do they understand TAM/SAM/SOM? Market dynamics?
  if (startupAny.market_size) {
    if (typeof startupAny.market_size === 'string' && startupAny.market_size.length > 50) {
      vibeBonus += 0.5; // Detailed market analysis
    } else if (startupAny.market_size) {
      vibeBonus += 0.3; // Basic market understanding
    }
  }
  
  // 4. Team Pedigree (0-0.8 points) - THE RIGHT STUFF
  // FAANG, Stanford, YC alumni, serial founders = instant credibility
  if (startupAny.team_companies && Array.isArray(startupAny.team_companies)) {
    const topCompanies = ['google', 'meta', 'apple', 'amazon', 'microsoft', 'stripe', 'airbnb', 'uber'];
    const teamComps = startupAny.team_companies.map((c: string) => c.toLowerCase());
    const hasTopTier = teamComps.some((c: string) => topCompanies.some(t => c.includes(t)));
    
    if (hasTopTier) vibeBonus += 0.8; // Tier 1 pedigree
    else if (startupAny.team_companies.length >= 3) vibeBonus += 0.5;
    else if (startupAny.team_companies.length >= 1) vibeBonus += 0.3;
  }
  
  // 5. Pitch Quality (0-0.5 points) - STORYTELLING MATTERS
  // Can they communicate their vision compellingly?
  if (startupAny.pitch) {
    const pitchLength = startupAny.pitch.length;
    if (pitchLength > 300) vibeBonus += 0.5; // Compelling narrative
    else if (pitchLength > 150) vibeBonus += 0.3;
    else if (pitchLength > 50) vibeBonus += 0.15;
  }
  
  // 6. Investment Clarity (0-0.3 points) - KNOWS WHAT THEY NEED
  if (startupAny.raise_amount || startupAny.funding_needed) {
    vibeBonus += 0.3;
  }
  
  // 7. Technical Cofounder (0-0.7 points) - CRITICAL FOR TECH STARTUPS
  // a16z, Sequoia etc. almost never fund non-technical tech teams
  if (startupAny.technical_cofounders > 0 || startupAny.has_technical_cofounder) {
    vibeBonus += 0.7;
  }
  
  // Total VIBE bonus: up to configured cap (reduced impact on final score)
  // VIBE is now ~12% of total possible score (2.5 out of 21 points)
  baseBoost += Math.min(vibeBonus, GOD_SCORE_CONFIG.vibeBonusCap);

  // Give points for having basic content
  if (startup.team && startup.team.length > 0) baseBoost += 1;
  if (startup.launched || startup.demo_available) baseBoost += 1;
  if (startup.industries && startup.industries.length > 0) baseBoost += 0.5;
  if (startup.problem || startup.solution) baseBoost += 0.5;
  if (startup.tagline || startup.pitch) baseBoost += 0.5;
  if (startup.founded_date) baseBoost += 0.5;

  // Lower minimum base boost to configured value so sparse startups score appropriately
  // Math: baseBoost / normalizationDivisor * 10 = score on 0-10 scale
  baseBoost = Math.max(baseBoost, GOD_SCORE_CONFIG.baseBoostMinimum);
  
  // (Old variable declarations removed; only new streamlined block below is used)
  // --- REBALANCED SCORING ---
  // Core founder/team variables:
  // Team Execution (scoreTeam + scoreFounderSpeed): 3.0
  // Product Vision (scoreVision): 2.0
  // Founder Courage (scoreFounderCourage): 1.5
  // Market Insight (scoreUniqueInsight): 1.5
  // Team Age/Adaptability (scoreFounderAge): 1.0
  // (Team Dynamics merged into Team Execution)
  // Traction, Market, Product remain as is

  const teamScore = scoreTeam(startup); // 0-2
  const founderSpeedScore = scoreFounderSpeed(startup); // 0-1
  const teamExecutionScore = Math.min(teamScore + founderSpeedScore + fundingVelocityBonus, 3.0); // Cap at 3
  const productVisionScore = Math.min(scoreVision(startup), 2.0);  // RESTORED to 2.0
  const founderCourageScore = Math.min(scoreFounderCourage(startup), 1.5);
  const marketInsightScore = Math.min(scoreUniqueInsight(startup), 1.5);
  const teamAgeScore = Math.min(scoreFounderAge(startup), 1.0);

  // Traction, Market, Product Performance (keep as is)
  const tractionScore = scoreTraction(startup); // 0-3
  const marketScore = scoreMarket(startup); // 0-2
  const productScore = Math.min(scoreProduct(startup), 2.0); // 0-2 (RESTORED - was incorrectly changed to 0-3)

  // ============================================================================
  // ⛔ REMOVED: Unauthorized forward-looking scores (Jan 30, 2026)
  // These were incorrectly added as GOD components. They belong in SIGNALS.
  // - velocityScore (0-1.5) → should be signal dimension
  // - capitalEfficiencyScore (0-1.0) → should be signal dimension
  // - marketTimingScore (0-1.5) → should be signal dimension
  // ============================================================================

  // GOD SCORE = 23 ALGORITHMS ONLY
  // Total possible: 3 (team exec) + 2 (vision) + 1.5 (courage) + 1.5 (insight) + 1 (age) + 3 (traction) + 2 (market) + 2 (product) = 16
  // Plus baseBoost (minimum 3.5, can go higher with vibe bonus up to 1.0) = ~17.5 max raw
  const redFlagsScore = scoreRedFlags(startup);
  const rawTotal = baseBoost + teamExecutionScore + productVisionScore + founderCourageScore + marketInsightScore + teamAgeScore + tractionScore + marketScore + productScore + redFlagsScore;
  // ⛔ REMOVED: + velocityScore + capitalEfficiencyScore + marketTimingScore
  // Normalize to 10-point scale using configured divisor (higher divisor = lower scores)
  const total = Math.min((rawTotal / GOD_SCORE_CONFIG.normalizationDivisor) * 10, 10);
  /**
   * GOD Score Bias Monitor (auto-healing system)
   * Call this from System Guardian or batch scoring scripts
   */
  (globalThis as any).godScoreMonitor = function(rawTotal: number, total: number) {
    // This is a stub; real implementation should aggregate scores and check distribution
    // Example: If average < 45 or > 75, log and recommend recalibration
    if (!(globalThis as any).godScoreStats) (globalThis as any).godScoreStats = { sum: 0, count: 0 };
    (globalThis as any).godScoreStats.sum += total * 10; // Convert to 0-100 scale
    (globalThis as any).godScoreStats.count++;
    if ((globalThis as any).godScoreStats.count % 100 === 0) {
      const avg = (globalThis as any).godScoreStats.sum / (globalThis as any).godScoreStats.count;
      if (avg < GOD_SCORE_CONFIG.averageScoreAlertLow || avg > GOD_SCORE_CONFIG.averageScoreAlertHigh) {
        console.warn(`[GOD SCORE ALERT] Average GOD score is ${avg.toFixed(2)}. Recommend recalibration!`);
        console.warn(`[GOD SCORE ALERT] Current config: normalizationDivisor=${GOD_SCORE_CONFIG.normalizationDivisor}, baseBoostMinimum=${GOD_SCORE_CONFIG.baseBoostMinimum}, vibeBonusCap=${GOD_SCORE_CONFIG.vibeBonusCap}`);
        // Optionally trigger auto-healing: run recalculation script, notify admin, etc.
      }
    }
  };
  
  // Dynamic match count based on score
  let matchCount = 5; // Default
  if (total >= 9) matchCount = 20; // Super hot - maximum matches
  else if (total >= 7) matchCount = 15; // Hot - many matches
  else if (total >= 5) matchCount = 10; // Warm - more matches
  
  const tier = total >= 7 ? 'hot' : total >= 4 ? 'warm' : 'cold';
  
  // ============================================================================
  // PSYCHOLOGICAL BONUS (Phase 1 - Feb 12, 2026) - ADMIN APPROVED
  // ============================================================================
  // Apply behavioral intelligence bonus (ADDITIVE, not multiplicative)
  // Per architecture spec: "FINAL SCORE = GOD base + Signals bonus (0-10)"
  // Expected: 1-3 points typical, 7+ rare, 10 max
  // Ref: PSYCHOLOGICAL_SIGNALS_PHASE1_COMPLETE.md
  // ============================================================================
  const psychologicalBonus = calculatePsychologicalBonus(startup);
  const enhancedTotal = Math.min(total + psychologicalBonus, 10); // Cap at 10 (0-10 scale)
  
  return {
    total,
    breakdown: {
      team_execution: teamExecutionScore,
      product_vision: productVisionScore,
      founder_courage: founderCourageScore,
      market_insight: marketInsightScore,
      team_age: teamAgeScore,
      traction: tractionScore,
      market: marketScore,
      product: productScore,
      // ⛔ REMOVED: velocity, capital_efficiency, market_timing (these belong in SIGNALS, not GOD)
    },
    // ⛔ REMOVED: velocitySignals, efficiencySignals, timingSignals, matchedSectors
    // These concepts should be in the SIGNAL layer, not GOD scoring
    matchCount,
    reasoning: generateReasoning(startup, { 
      baseBoost,
      teamExecutionScore,
      productVisionScore,
      founderCourageScore,
      marketInsightScore,
      teamAgeScore,
      tractionScore,
      marketScore,
      productScore
    }),
    tier,
    // Psychological signals (LAYERED ON TOP, ADDITIVE)
    // Note: Column still named psychological_multiplier in DB, but we use it for additive bonus
    psychological_multiplier: psychologicalBonus, // Storing additive bonus (0-1.0 scale)
    enhanced_total: enhancedTotal,
    psychological_signals: {
      fomo: startup.fomo_signal_strength || 0,
      conviction: startup.conviction_signal_strength || 0,
      urgency: startup.urgency_signal_strength || 0,
      risk: startup.risk_signal_strength || 0
    }
  };
}

// ============================================================================
// PSYCHOLOGICAL BONUS CALCULATION (Phase 1 - Feb 12, 2026)
// ============================================================================
// ADMIN APPROVED: Behavioral intelligence layer (ADDITIVE, not multiplicative)
// Per architecture spec: "FINAL SCORE = GOD base + Signals bonus (0-10)"
// Expected: 1-3 points typical, 7+ rare, 10 max
// 
// Core philosophy: "Investors are humans showing human behavior, psychology,
// greed, pride, and ego. We listen to those signals to predict their actions."
// 
// Ref: PSYCHOLOGICAL_SIGNALS_PHASE1_COMPLETE.md
// Ref: BEHAVIORAL_SIGNAL_AUDIT.md
// ============================================================================

/**
 * Calculate psychological bonus points based on behavioral signals
 * 
 * Formula: (FOMO bonus) + (Conviction bonus) + (Urgency bonus) - (Risk penalty)
 * 
 * Components (on 0-10 point scale):
 * - FOMO (oversubscription): 0-5 points - scarcity drives action
 * - Conviction (follow-on): 0-5 points - highest trust signal
 * - Urgency (competitive): 0-3 points - social proof cascade
 * - Risk (bridge): 0-3 points penalty - negative signal
 * 
 * Range: -3 (high risk) to +10 (maximum boost, capped)
 * 
 * Examples:
 * - Baseline (no signals): 0 points (no change)
 * - 3x oversubscribed (0.60 strength): +3.0 points
 * - Sequoia follow-on (0.68 strength): +3.4 points
 * - 3x oversubscribed + Sequoia + competitive: +6-9 points
 * - Bridge round (0.75 strength): -2.25 points
 * 
 * @param startup StartupProfile with psychological signal fields
 * @returns bonus points (-3 to +10)
 */
function calculatePsychologicalBonus(startup: StartupProfile): number {
  let bonus = 0; // Baseline
  
  // FOMO Bonus (Oversubscription)
  // When a round is "3x oversubscribed", it signals high demand and market validation
  // Psychology: Scarcity drives action, fast movers win
  // Max: 5 points (on 0-10 scale)
  if (startup.is_oversubscribed && startup.fomo_signal_strength) {
    const fomoBonus = startup.fomo_signal_strength * 0.5; // 0-0.5 on 0-10 scale
    bonus += fomoBonus;
  }
  
  // Conviction Bonus (Follow-On Investment)
  // Existing investors doubling down is THE strongest trust signal
  // They have inside information, board access, and are risking reputation
  // Psychology: Follow the smart money, especially Tier 1 firms
  // Max: 5 points (on 0-10 scale)
  if (startup.has_followon && startup.conviction_signal_strength) {
    const convictionBonus = startup.conviction_signal_strength * 0.5; // 0-0.5 on 0-10 scale
    bonus += convictionBonus;
  }
  
  // Urgency Bonus (Competitive Round)
  // Multiple term sheets = social proof cascade
  // Psychology: FOMO amplified by scarcity, decision paralysis breaks → rapid action
  // Max: 3 points (on 0-10 scale)
  if (startup.is_competitive && startup.urgency_signal_strength) {
    const urgencyBonus = startup.urgency_signal_strength * 0.3; // 0-0.3 on 0-10 scale
    bonus += urgencyBonus;
  }
  
  // Risk Penalty (Bridge Round)
  // Bridge financing = struggle signal
  // Startup missed milestones, buyer for next round at risk
  // Psychology: Flight, not fight (existing investors trapped, new investors cautious)
  // Max penalty: 3 points (on 0-10 scale)
  if (startup.is_bridge_round && startup.risk_signal_strength) {
    const riskPenalty = startup.risk_signal_strength * 0.3; // 0-0.3 on 0-10 scale
    bonus -= riskPenalty;
  }
  
  // Cap bonus between -3 and +10 (on 0-10 scale)
  // -3 = high risk (bridge + no positive signals)
  // +10 = maximum boost (capped at 1.0, which becomes 10 points on 0-100 scale)
  bonus = Math.max(-0.3, Math.min(1.0, bonus));
  
  return bonus;
}

/**
 * TEAM SCORING (0-3 points)
 * Based on YC/Sequoia/Founders Fund criteria
 */
function scoreTeam(startup: StartupProfile): number {
  let score = 0;
  const reasons: string[] = [];
  
  // Technical co-founders (YC priority)
  if (startup.technical_cofounders && startup.founders_count) {
    const techRatio = startup.technical_cofounders / startup.founders_count;
    if (techRatio >= 0.5) {
      score += 1;
      reasons.push('Strong technical team');
    }
  }
  
  // Pedigree & experience (Sequoia/FF)
  if (startup.team && Array.isArray(startup.team) && startup.team.length > 0) {
    const hasTopTierBackground = startup.team.some(member => 
      member.previousCompanies?.some(company => 
        ['Google', 'Meta', 'Apple', 'Amazon', 'Microsoft', 'Tesla', 'SpaceX', 'Stripe', 'OpenAI'].some(
          topCo => company.toLowerCase().includes(topCo.toLowerCase())
        )
      ) ||
      member.education?.toLowerCase().includes('stanford') ||
      member.education?.toLowerCase().includes('mit') ||
      member.education?.toLowerCase().includes('harvard')
    );
    
    if (hasTopTierBackground) {
      score += 1;
      reasons.push('Top-tier founder pedigree');
    }
    
    // Domain expertise
    const hasRelevantExperience = startup.team.some(member =>
      member.background && startup.industries?.some(industry =>
        member.background?.toLowerCase().includes(industry.toLowerCase())
      )
    );
    
    if (hasRelevantExperience) {
      score += 0.5;
      reasons.push('Domain expertise');
    }
  }
  
  // Young founders (under 30) - "chip on shoulder" mentality
  // If we had age data, would add 0.5 points
  
  return Math.min(score, 3);
}

/**
 * TRACTION SCORING (0-3 points)
 * YC: "Proof of progress and traction"
 * Sequoia: "Measurable progress, growth, and social proof"
 * Seed/Angel: "Early traction with repeatability indicators"
 * 
 * IMPORTANT: This function must differentiate between startups even with minimal data.
 * If all startups score 0, the component cannot differentiate quality.
 */
function scoreTraction(startup: StartupProfile): number {
  let score = 0;
  
  // Combine all available text for pattern-based analysis
  const allText = [
    startup.pitch || '',
    startup.tagline || '',
    startup.value_proposition || '',
    (startup as any).description || '',
    (startup as any).name || ''
  ].join(' ').toLowerCase();
  
  // ============================================================================
  // SECTION 1: QUANTITATIVE TRACTION (when data exists)
  // ============================================================================
  
  // Revenue traction (strongest signal)
  if (startup.revenue || startup.mrr || startup.gmv) {
    const annualRevenue = startup.revenue || (startup.mrr! * 12);
    const gmv = startup.gmv || 0;
    const bestMetric = Math.max(annualRevenue, gmv);
    
    if (bestMetric >= 1000000) score += 1.5; // $1M+ ARR/GMV
    else if (bestMetric >= 100000) score += 1; // $100K+ ARR/GMV
    else if (bestMetric >= 10000) score += 0.75; // $10K+ ARR/GMV
    else if (bestMetric > 0) score += 0.5; // Any revenue
  }
  
  // Growth rate (critical for Sequoia & Seed investors)
  if (startup.growth_rate) {
    if (startup.growth_rate >= 30) score += 1; // 30%+ MoM - exceptional
    else if (startup.growth_rate >= 20) score += 0.75; // 20%+ MoM - great
    else if (startup.growth_rate >= 15) score += 0.5; // 15%+ MoM - seed benchmark
    else if (startup.growth_rate >= 10) score += 0.25; // 10%+ MoM - decent
    else if (startup.growth_rate >= 5) score += 0.15; // 5%+ MoM - some growth
  }
  
  // Retention & churn (Seed/Angel: "evidence of repeatability")
  if (startup.retention_rate && startup.retention_rate >= 80) {
    score += 0.5; // High retention = product-market fit
  } else if (startup.churn_rate && startup.churn_rate <= 5) {
    score += 0.5; // Low churn = sticky product
  }
  
  // User/customer traction
  if (startup.active_users) {
    if (startup.active_users >= 10000) score += 0.5;
    else if (startup.active_users >= 1000) score += 0.25;
    else if (startup.active_users >= 100) score += 0.15;
  }
  
  // Pre-paying customers (Seed/Angel: "leading indicator")
  if (startup.prepaying_customers) {
    if (startup.prepaying_customers >= 10) score += 0.5;
    else if (startup.prepaying_customers >= 3) score += 0.25;
    else if (startup.prepaying_customers >= 1) score += 0.15;
  } else if (startup.customers || startup.signed_contracts) {
    const customerCount = startup.customers || startup.signed_contracts || 0;
    if (customerCount >= 10) score += 0.5;
    else if (customerCount >= 5) score += 0.25;
    else if (customerCount >= 1) score += 0.15;
  }
  
  // Social proof - backed by reputable investors
  if (startup.backed_by && startup.backed_by.length > 0) {
    const hasTopInvestor = startup.backed_by.some(inv =>
      ['yc', 'y combinator', 'sequoia', 'a16z', 'andreessen', 'founders fund'].some(
        top => inv.toLowerCase().includes(top)
      )
    );
    if (hasTopInvestor) score += 0.5;
    else score += 0.2;
  }
  
  // ============================================================================
  // SECTION 2: PATTERN-BASED TRACTION (ALWAYS derive from text)
  // This runs for ALL startups to ensure sparse-data startups get scored
  // ============================================================================
  
  // --- 2A. Revenue/Business Model Signals ---
  const revenuePatterns = [
    /\b(revenue|profitable|monetiz|paying customers|subscription|saas|arr|mrr)/i,
    /\b(\$\d+[KMB]|\d+\s*(million|billion)|raised\s*\$)/i,
    /\b(enterprise|b2b|sales|contracts|deals|clients)/i,
    /\b(funded|backed by|investors|seed|series [a-d]|pe funding|vc)/i
  ];
  const revenueMatches = revenuePatterns.filter(p => p.test(allText)).length;
  if (revenueMatches >= 3) score += 0.5;
  else if (revenueMatches >= 2) score += 0.35;
  else if (revenueMatches >= 1) score += 0.2;
  
  // --- 2B. User/Customer Traction Signals ---
  const userPatterns = [
    /\b(\d+[KM]?\+?\s*(users|customers|clients|downloads|installs|subscribers))/i,
    /\b(growing|growth|viral|adoption|traction|scale|scaling)/i,
    /\b(waitlist|beta|early access|pilot|launch)/i,
    /\b(active|daily|monthly|engagement|retention)/i
  ];
  const userMatches = userPatterns.filter(p => p.test(allText)).length;
  if (userMatches >= 3) score += 0.4;
  else if (userMatches >= 2) score += 0.3;
  else if (userMatches >= 1) score += 0.15;
  
  // --- 2C. Product Maturity Signals ---
  const productMaturityPatterns = [
    /\b(launched|live|production|deployed|shipped|available)/i,
    /\b(customers using|in use|adopted by|trusted by|powers|powering)/i,
    /\b(integration|api|sdk|platform|app store|marketplace)/i
  ];
  const maturityMatches = productMaturityPatterns.filter(p => p.test(allText)).length;
  if (maturityMatches >= 2) score += 0.35;
  else if (maturityMatches >= 1) score += 0.15;
  
  // --- 2D. Market Validation Signals ---
  const validationPatterns = [
    /\b(partnership|partner with|partnered|strategic)/i,
    /\b(award|winner|recognized|featured|press|media)/i,
    /\b(accelerator|incubator|program|yc|techstars|500)/i
  ];
  const validationMatches = validationPatterns.filter(p => p.test(allText)).length;
  if (validationMatches >= 2) score += 0.3;
  else if (validationMatches >= 1) score += 0.1;
  
  // --- 2E. Technology/Innovation Signals (NEW - catches AI/ML, fintech, etc.) ---
  const techInnovationPatterns = [
    /\b(ai|artificial intelligence|machine learning|ml|deep learning|neural|gpt|llm)/i,
    /\b(fintech|fin-tech|financial technology|payment|banking|lending|credit)/i,
    /\b(blockchain|crypto|web3|defi|smart contract)/i,
    /\b(biotech|therapeutics|clinical|drug discovery|genomics)/i,
    /\b(revolutioniz|transform|disrupt|innovati|cutting-edge|next.?gen)/i
  ];
  const techMatches = techInnovationPatterns.filter(p => p.test(allText)).length;
  if (techMatches >= 3) score += 0.4;
  else if (techMatches >= 2) score += 0.25;
  else if (techMatches >= 1) score += 0.1;
  
  // --- 2F. Company Existence Signals (baseline for minimal data) ---
  const existencePatterns = [
    /\b(company|startup|business|firm|venture|develops|provides|offers|building)/i,
    /\b(technology|tech|software|application|tool|solution|service)/i,
    /\b(health|healthcare|medical|enterprise|consumer|b2c)/i
  ];
  const existenceMatches = existencePatterns.filter(p => p.test(allText)).length;
  if (existenceMatches >= 2 && score < 0.2) score += 0.15; // Floor for identified companies
  
  // ============================================================================
  // SECTION 3: BOOLEAN FLAGS (direct from database)
  // ============================================================================
  
  if ((startup as any).has_revenue) score += 1.0; // Revenue = major traction signal
  if ((startup as any).has_customers) score += 0.6; // Customers = strong signal
  if (startup.launched || (startup as any).is_launched) score += 0.4; // Launched = baseline signal
  if (startup.demo_available || (startup as any).has_demo) score += 0.15;
  
  return Math.min(score, 3);
}

/**
 * MARKET SCORING (0-2 points)
 * YC: "Solving a real problem"
 * Sequoia: "Important problem in a market with massive growth potential"
 * Seed/Angel: "Large market opportunity with competitive edge"
 * 
 * IMPORTANT: Must differentiate even when market_size data is missing.
 * Use sectors, problem/solution clarity, and other available signals.
 */
function scoreMarket(startup: StartupProfile): number {
  let score = 0;
  
  // Hot sectors (fintech, AI, biotech, deep tech, climate)
  // This is available for 100% of startups, so it's a key differentiator
  const hotSectors = ['ai', 'artificial intelligence', 'fintech', 'biotech', 'climate', 'deep tech', 'crypto', 'web3', 'saas', 'enterprise', 'healthcare', 'edtech'];
  const industries = startup.industries || [];
  const isHotSector = industries.some(industry =>
    hotSectors.some(hot => industry.toLowerCase().includes(hot))
  );
  
  if (isHotSector) {
    score += 1; // Hot sector = strong market signal
  } else if (industries.length > 0) {
    score += 0.3; // Any sector defined = basic market clarity
  }
  
  // Market size (TAM) - Seed/Angel: "sufficiently large market"
  // Handle both numeric and string market_size
  let marketSizeNum = 0;
  if (typeof startup.market_size === 'number') {
    marketSizeNum = startup.market_size;
  } else if (typeof startup.market_size === 'string') {
    // Try to extract number from string like "$10B", "10 billion", etc.
    const match = startup.market_size.match(/(\d+(?:\.\d+)?)\s*(b|billion|m|million|t|trillion)/i);
    if (match) {
      const num = parseFloat(match[1]);
      const unit = match[2].toLowerCase();
      marketSizeNum = unit.startsWith('b') ? num : unit.startsWith('t') ? num * 1000 : num / 1000;
    }
  }
  
  if (marketSizeNum >= 10) score += 1; // $10B+ TAM - massive
  else if (marketSizeNum >= 1) score += 0.5; // $1B+ TAM - substantial
  else if (marketSizeNum >= 0.1) score += 0.25; // $100M+ TAM - viable for seed
  else if (marketSizeNum > 0) score += 0.15; // Any market size mentioned
  
  // Clear problem/solution articulation (Seed: "compelling story")
  // This is a key differentiator when market_size is missing
  if (startup.problem && startup.solution) {
    const problemLength = startup.problem.length;
    const solutionLength = startup.solution.length;
    if (problemLength > 100 && solutionLength > 100) {
      score += 0.5; // Well-articulated
    } else if (problemLength > 50 && solutionLength > 50) {
      score += 0.3; // Adequately articulated
    } else if (problemLength > 0 || solutionLength > 0) {
      score += 0.15; // Some articulation
    }
  } else if (startup.problem || startup.solution) {
    score += 0.1; // Partial articulation
  }
  
  // FALLBACK: Use value proposition or pitch as market signal
  if (score === 0 && (startup.value_proposition || startup.pitch)) {
    const text = (startup.value_proposition || startup.pitch || '').toLowerCase();
    // Check for market-related keywords
    const marketKeywords = ['market', 'billion', 'million', 'industry', 'sector', 'tam', 'opportunity'];
    if (marketKeywords.some(keyword => text.includes(keyword))) {
      score += 0.2; // Minimal market signal
    }
  }
  
  return Math.min(score, 2);
}

/**
 * PRODUCT SCORING (0-3 points)
 * YC: "Having a working demo"
 * FF: "Cool IP or new business model"
 * Seed/Angel: "MVP demonstrates idea has moved beyond conceptual stage"
 * 
 * IMPORTANT: Must differentiate even when launch/demo flags are missing.
 * Use available signals to assess product maturity.
 */
function scoreProduct(startup: StartupProfile): number {
  let score = 0;
  
  // Combine all available text for pattern-based analysis
  const allText = [
    startup.pitch || '',
    startup.tagline || '',
    startup.value_proposition || '',
    startup.solution || '',
    (startup as any).description || ''
  ].join(' ').toLowerCase();
  
  // ============================================================================
  // SECTION 1: STRUCTURED PRODUCT DATA
  // ============================================================================
  
  // MVP stage (Seed/Angel: critical indicator)
  const isLaunched = startup.launched || startup.mvp_stage || (startup as any).is_launched;
  const hasDemo = startup.demo_available || (startup as any).has_demo;
  
  if (isLaunched) {
    score += 0.5; // Launched = product exists
  }
  if (hasDemo) {
    score += 0.5; // Demo = can show product
  }
  
  // Unique IP / defensibility
  if (startup.unique_ip || (startup as any).unique_ip) {
    score += 0.5;
  }
  if (startup.defensibility === 'high') {
    score += 0.5;
  } else if (startup.defensibility === 'medium') {
    score += 0.25;
  }
  
  // ============================================================================
  // SECTION 2: PATTERN-BASED PRODUCT SIGNALS (when structured data missing)
  // ============================================================================
  
  if (score < 0.5) {
    // --- 2A. Product Maturity Stage ---
    const maturityPatterns = [
      /\b(launched|live|production|shipped|released|available)/i,
      /\b(beta|alpha|mvp|prototype|working product)/i,
      /\b(app|platform|software|tool|solution|product)/i
    ];
    const maturityMatches = maturityPatterns.filter(p => p.test(allText)).length;
    if (maturityMatches >= 2) score += 0.5;
    else if (maturityMatches >= 1) score += 0.3;
    
    // --- 2B. Technical Sophistication ---
    const techPatterns = [
      /\b(ai|ml|machine learning|deep learning|neural|gpt|llm)/i,
      /\b(algorithm|proprietary|patent|ip|breakthrough|novel)/i,
      /\b(api|sdk|integration|developer|open.?source)/i,
      /\b(blockchain|crypto|web3|smart contract|defi)/i,
      /\b(cloud|saas|infrastructure|platform|engine)/i
    ];
    const techMatches = techPatterns.filter(p => p.test(allText)).length;
    if (techMatches >= 3) score += 0.5;
    else if (techMatches >= 2) score += 0.35;
    else if (techMatches >= 1) score += 0.2;
    
    // --- 2C. Product Category Signals ---
    const categoryPatterns = [
      /\b(b2b|enterprise|smb|consumer|prosumer)/i,
      /\b(marketplace|e-?commerce|fintech|healthtech|edtech)/i,
      /\b(automation|workflow|productivity|collaboration)/i,
      /\b(analytics|insights|dashboard|reporting|data)/i
    ];
    const categoryMatches = categoryPatterns.filter(p => p.test(allText)).length;
    if (categoryMatches >= 2) score += 0.3;
    else if (categoryMatches >= 1) score += 0.15;
    
    // --- 2D. Defensibility Signals ---
    const defensibilityPatterns = [
      /\b(proprietary|moat|defensible|unique|first.?mover)/i,
      /\b(patent|ip|intellectual property|trade secret)/i,
      /\b(network effect|viral|switching cost|lock.?in)/i,
      /\b(data advantage|exclusive|partnership|license)/i
    ];
    const defensibilityMatches = defensibilityPatterns.filter(p => p.test(allText)).length;
    if (defensibilityMatches >= 2) score += 0.4;
    else if (defensibilityMatches >= 1) score += 0.2;
  }
  
  // ============================================================================
  // SECTION 3: FALLBACK SIGNALS
  // ============================================================================
  
  if (score < 0.3) {
    // Check if they have a website (indicates some product presence)
    if (startup.website || (startup as any).website) {
      score += 0.2;
    }
    // Check stage - later stages imply product exists
    if (startup.stage) {
      const stageNum = typeof startup.stage === 'number' ? startup.stage : 
        ['pre-seed', 'seed', 'series a', 'series b'].indexOf(String(startup.stage).toLowerCase());
      if (stageNum >= 2) score += 0.3;
      else if (stageNum >= 1) score += 0.2;
      else if (stageNum >= 0) score += 0.1;
    }
    // Check if they have a solution description
    if (startup.solution && startup.solution.length > 50) {
      score += 0.15;
    }
  }
  
  return Math.min(score, 3);
}

/**
 * VISION SCORING (0-1.5 BONUS points)
 * First Round Capital: Contrarian insight, creative strategy, passionate early customers
 * Seed/Angel: Clear go-to-market strategy, financial planning
 * This allows pre-revenue startups to score high based on unique vision & planning
 */
function scoreVision(startup: StartupProfile): number {
  let score = 0;
  
  // Combine all available text for analysis
  const allText = [
    startup.pitch || '',
    startup.tagline || '',
    startup.value_proposition || '',
    startup.problem || '',
    startup.solution || '',
    startup.contrarian_insight || '',
    startup.contrarian_belief || '',
    startup.vision_statement || '',
    startup.why_now || ''
  ].join(' ').toLowerCase();
  
  // ============================================================================
  // VISION SCORING FROM AVAILABLE DATA (0-2 points)
  // Derives vision signals from tagline, pitch, description using pattern matching
  // ============================================================================
  
  // --- 1. Contrarian/Disruptive Vision (0-0.5 points) ---
  // Look for signals of contrarian thinking or market disruption
  const contrarianPatterns = [
    /\b(disrupt|revolutioniz|transform|reinvent|redefin|paradigm shift)/i,
    /\b(unlike|different from|not like|versus traditional|vs\.? traditional)/i,
    /\b(first|only|pioneer|novel|breakthrough|innovative approach)/i,
    /\b(challenge|rethink|reimagin|new way|better way)/i,
    /\b(outdated|broken|inefficient|legacy|old-fashioned)/i  // Criticizing status quo
  ];
  
  // Explicit contrarian fields (legacy support)
  if (startup.contrarian_insight && startup.contrarian_insight.length > 100) {
    score += 0.5;
  } else if (startup.contrarian_belief && startup.contrarian_belief.length > 50) {
    score += 0.4;
  } else {
    // Pattern-based detection from available text
    const contrarianMatches = contrarianPatterns.filter(p => p.test(allText)).length;
    if (contrarianMatches >= 3) {
      score += 0.5; // Strong contrarian signals
    } else if (contrarianMatches >= 2) {
      score += 0.35;
    } else if (contrarianMatches >= 1) {
      score += 0.2;
    }
  }
  
  // --- 2. Ambitious Scale/Impact Vision (0-0.5 points) ---
  // VCs want "big if it works" - look for ambitious language
  const ambitionPatterns = [
    /\b(billion|trillion|\$\d+[BT]|massive market|huge opportunity)/i,
    /\b(global|worldwide|international|cross-border|multi-country)/i,
    /\b(platform|ecosystem|marketplace|infrastructure|operating system)/i,
    /\b(every|all|entire|universal|ubiquitous)/i,  // Scope words
    /\b(category.?defining|market.?leading|industry.?standard)/i,
    /\b(10x|100x|exponential|scale|scalable)/i
  ];
  
  const ambitionMatches = ambitionPatterns.filter(p => p.test(allText)).length;
  if (ambitionMatches >= 3) {
    score += 0.5;
  } else if (ambitionMatches >= 2) {
    score += 0.35;
  } else if (ambitionMatches >= 1) {
    score += 0.2;
  }
  
  // --- 3. Creative/Unique Strategy (0-0.4 points) ---
  // First Round: "thoughtful, creative go-to-market and product strategy"
  const strategyPatterns = [
    /\b(viral|word.?of.?mouth|organic growth|community.?driven|network effect)/i,
    /\b(flywheel|compounding|moat|defensib|lock.?in|switching cost)/i,
    /\b(land.?and.?expand|bottom.?up|top.?down|product.?led|sales.?led)/i,
    /\b(freemium|self.?serve|enterprise|SMB|prosumer)/i,
    /\b(API.?first|developer.?first|B2B2C|embedded|white.?label)/i
  ];
  
  // Explicit creative strategy field (legacy support)
  if (startup.creative_strategy && startup.creative_strategy.length > 100) {
    score += 0.4;
  } else {
    const strategyMatches = strategyPatterns.filter(p => p.test(allText)).length;
    if (strategyMatches >= 2) {
      score += 0.4;
    } else if (strategyMatches >= 1) {
      score += 0.2;
    }
  }
  
  // --- 4. Clear Value Proposition (0-0.35 points) ---
  // Having a clear, compelling pitch is a vision signal
  const tagline = startup.tagline || '';
  const pitch = startup.pitch || '';
  
  // Good tagline: concise (under 100 chars) and specific (not generic)
  const genericTaglines = [
    /^a company in the/i,
    /^we are a/i,
    /^startup that/i,
    /^building/i
  ];
  const isGenericTagline = genericTaglines.some(p => p.test(tagline));
  
  if (tagline.length > 10 && tagline.length < 100 && !isGenericTagline) {
    score += 0.2; // Clear, non-generic tagline
  }
  
  // Good pitch: substantive (100+ chars) and contains specifics
  if (pitch.length > 100) {
    const hasSpecifics = /\d+%|\$\d+|saves?\s+\d+|reduces?\s+\d+/i.test(pitch);
    if (hasSpecifics) {
      score += 0.15; // Pitch with quantified claims
    }
  }
  
  // --- 5. Why Now / Timing Insight (0-0.25 points) ---
  // Good founders understand market timing
  const timingPatterns = [
    /\b(why now|right time|timing|inflection point|tipping point)/i,
    /\b(AI|GPT|LLM|machine learning|generative)/i,  // Current tech waves
    /\b(post.?covid|hybrid work|remote|new normal)/i,
    /\b(regulation|compliance|new law|mandate)/i,
    /\b(gen.?z|millennial|demographic shift)/i
  ];
  
  if (startup.why_now && startup.why_now.length > 50) {
    score += 0.25; // Explicit why-now
  } else {
    const timingMatches = timingPatterns.filter(p => p.test(allText)).length;
    if (timingMatches >= 2) {
      score += 0.25;
    } else if (timingMatches >= 1) {
      score += 0.1;
    }
  }
  
  // --- Legacy: Financial Planning (still check if data exists) ---
  const hasFinancialPlan = startup.use_of_funds && startup.use_of_funds.length > 50;
  const hasRunway = startup.runway_months && startup.runway_months >= 12 && startup.runway_months <= 18;
  const knowsBurnRate = startup.burn_rate && startup.burn_rate > 0;
  
  if (hasFinancialPlan && (hasRunway || knowsBurnRate)) {
    score += 0.3;
  } else if (hasFinancialPlan || hasRunway) {
    score += 0.15;
  }
  
  // --- Legacy: Passionate Customers ---
  if (startup.passionate_customers && startup.passionate_customers >= 3) {
    score += 0.2;
  }
  
  return Math.min(score, 2); // Cap at 2.0 points max
}

/**
 * ECOSYSTEM SCORING (0-1.5 points) - NEW
 * Mitsubishi Chemical VC criterion: "Who they partner with to deliver their product/services"
 * Strong ecosystem = faster GTM, lower CAC, higher defensibility
 */
function scoreEcosystem(startup: StartupProfile): number {
  let score = 0;
  
  // Strategic partnerships (0-0.75 points)
  if (startup.strategic_partners && startup.strategic_partners.length > 0) {
    const activePartners = startup.strategic_partners.filter(p => 
      p.relationship_stage === 'signed' || p.relationship_stage === 'revenue_generating'
    );
    
    // Revenue-generating partnerships are GOLD
    const revenuePartners = activePartners.filter(p => p.relationship_stage === 'revenue_generating');
    if (revenuePartners.length >= 2) {
      score += 0.75; // Multiple partners driving revenue = exceptional
    } else if (revenuePartners.length === 1) {
      score += 0.5; // One partner driving revenue = strong
    } else if (activePartners.length >= 3) {
      score += 0.4; // Multiple signed partnerships = good
    } else if (activePartners.length >= 1) {
      score += 0.25; // Some partnerships = moderate
    }
    
    // Distribution partnerships are especially valuable
    const distributionPartners = activePartners.filter(p => p.type === 'distribution');
    if (distributionPartners.some(p => p.relationship_stage === 'revenue_generating')) {
      score += 0.25; // Bonus: someone is selling for them
    }
  }
  
  // Advisor quality (0-0.5 points)
  if (startup.advisors && startup.advisors.length > 0) {
    // Check for notable advisors (Fortune 500 execs, successful founders, domain experts)
    const notableKeywords = ['ceo', 'cto', 'founder', 'vp', 'director', 'professor', 'phd'];
    const hasNotableAdvisors = startup.advisors.some(advisor =>
      notableKeywords.some(kw => 
        advisor.background.toLowerCase().includes(kw) || 
        advisor.role.toLowerCase().includes(kw)
      )
    );
    
    if (startup.advisors.length >= 3 && hasNotableAdvisors) {
      score += 0.5; // Strong advisory board
    } else if (hasNotableAdvisors) {
      score += 0.3; // Some notable advisors
    } else if (startup.advisors.length >= 2) {
      score += 0.2; // Has advisors
    }
  }
  
  // Platform dependency risk (0 to -0.25 penalty)
  if (startup.platform_dependencies && startup.platform_dependencies.length > 0) {
    // Heavy dependency on external platforms is risky
    const riskPlatforms = ['openai', 'chatgpt', 'aws', 'google cloud'];
    const highRiskDependencies = startup.platform_dependencies.filter(dep =>
      riskPlatforms.some(risk => dep.toLowerCase().includes(risk))
    );
    
    if (highRiskDependencies.length >= 3) {
      score -= 0.25; // Too dependent on external platforms
    } else if (highRiskDependencies.length >= 2) {
      score -= 0.15;
    }
  }
  
  return Math.max(Math.min(score, 1.5), 0);
}

/**
 * GRIT & ADAPTABILITY SCORING (0-1.5 points) - NEW
 * Mitsubishi Chemical VC criterion: "How well they adapt and pivot to customer/market needs"
 * Measures founder resilience, customer obsession, speed of iteration
 */
function scoreGrit(startup: StartupProfile): number {
  let score = 0;
  let hasAnyData = false;
  
  // Pivot history - intelligent pivots are GOOD (0-0.7 points)
  if (startup.pivots_made !== undefined && startup.pivot_history) {
    hasAnyData = true;
    if (startup.pivots_made === 1 || startup.pivots_made === 2) {
      score += 0.7;
    } else if (startup.pivots_made === 0 && startup.founded_date) {
      const founded = new Date(startup.founded_date);
      const monthsOld = (Date.now() - founded.getTime()) / (1000 * 60 * 60 * 24 * 30);
      if (monthsOld > 12 && startup.customers && startup.customers > 10) {
        score += 0.5;
      }
    } else if (startup.pivots_made && startup.pivots_made >= 3) {
      score += 0.3;
    }
  }

  // Customer feedback frequency (0-0.7 points)
  if (startup.customer_feedback_frequency) {
    hasAnyData = true;
    if (startup.customer_feedback_frequency === 'daily') {
      score += 0.7;
    } else if (startup.customer_feedback_frequency === 'weekly') {
      score += 0.5;
    } else if (startup.customer_feedback_frequency === 'monthly') {
      score += 0.3;
    }
  }

  // Speed of iteration (0-0.6 points)
  if (startup.time_to_iterate_days !== undefined) {
    hasAnyData = true;
    if (startup.time_to_iterate_days <= 7) {
      score += 0.6;
    } else if (startup.time_to_iterate_days <= 14) {
      score += 0.4;
    } else if (startup.time_to_iterate_days <= 30) {
      score += 0.2;
    }
  }

  // DEFAULT: If no GRIT data, assume average resilience (unknown ≠ bad)
  if (!hasAnyData) {
    return 0.3; // Lowered default GRIT score for missing data
  }

  return Math.min(score, 2.0);
}

/**
 * PROBLEM VALIDATION SCORING (0-2 points) - NEW
 * YOUR #1 CRITERION: "Properly identify the customer problem and if it's worth solving"
 * This is THE most important filter - more than team, traction, or technology
 */
function scoreProblemValidation(startup: StartupProfile): number {
  let score = 0;
  
  // Customer interviews conducted (0-0.75 points)
  if (startup.customer_interviews_conducted !== undefined) {
    if (startup.customer_interviews_conducted >= 50) {
      score += 0.75; // 50+ interviews = exceptional discovery
    } else if (startup.customer_interviews_conducted >= 20) {
      score += 0.6; // 20+ = strong
    } else if (startup.customer_interviews_conducted >= 10) {
      score += 0.4; // 10+ = moderate
    } else if (startup.customer_interviews_conducted >= 5) {
      score += 0.2; // 5+ = some validation
    }
  }
  
  // Customer pain data - quantified impact (0-0.5 points)
  if (startup.customer_pain_data) {
    const pain = startup.customer_pain_data;
    
    // Do they have NUMBERS on the pain?
    if (pain.cost_of_problem && pain.cost_of_problem > 100000) {
      score += 0.3; // $100K+ pain = significant
    } else if (pain.cost_of_problem && pain.cost_of_problem > 10000) {
      score += 0.2; // $10K+ pain = moderate
    }
    
    // Frequency matters
    if (pain.frequency === 'daily') {
      score += 0.1; // Daily pain = urgent
    }
    
    // Willingness to pay validation (CRITICAL)
    if (pain.willingness_to_pay_validated) {
      score += 0.1; // They've confirmed customers will pay
    }
  }
  
  // ICP (Ideal Customer Profile) clarity (0-0.4 points)
  if (startup.icp_clarity === 'crystal_clear') {
    score += 0.4; // Know EXACTLY who they're targeting
  } else if (startup.icp_clarity === 'moderate') {
    score += 0.2; // Some clarity
  }
  
  // Problem discovery depth (0-0.35 points)
  if (startup.problem_discovery_depth === 'deep') {
    score += 0.35; // Deep understanding of root causes, market implications
  } else if (startup.problem_discovery_depth === 'moderate') {
    score += 0.2; // Some understanding
  } else if (startup.problem_discovery_depth === 'surface') {
    score += 0.05; // Surface-level only
  }
  
  // DEFAULT: If no problem validation data, assume some baseline validation
  // (most startups that get funding news have SOME customer validation)
  if (score === 0 && !startup.customer_interviews_conducted && !startup.customer_pain_data && 
      !startup.icp_clarity && !startup.problem_discovery_depth) {
    return 0.6; // Benefit of the doubt - assume basic validation
  }
  
  return Math.min(score, 2);
}

/**
 * FOUNDER AGE SCORING (0-1.5 points) - NEW
 * Philosophy: Younger founders have more adaptability, hunger, and runway
 * 
 * Evidence:
 * - Average age of successful tech founders: 31-34 (but varies by sector)
 * - YC preference for young founders (Paul Graham essays)
 * - Thiel Fellowship: Under 22
 * - Young founders: More willing to take risks, less to lose, more energy
 * - BUT: Not always better - domain expertise matters too
 * 
 * Scoring:
 * - Under 25: Maximum bonus (Zuckerberg, Gates, Jobs era)
 * - 25-30: Strong bonus (peak startup energy)
 * - 30-35: Moderate bonus (balanced experience/energy)
 * - 35-40: Small bonus (domain expertise trade-off)
 * - 40+: No penalty, but no youth bonus
 */
function scoreFounderAge(startup: StartupProfile): number {
  let score = 0;
  const startupAny = startup as any;
  
  // Method 1: Direct age data
  if (startupAny.founder_avg_age) {
    const avgAge = startupAny.founder_avg_age;
    
    if (avgAge < 25) {
      score += 1.5; // Maximum youth bonus - exceptional hunger
    } else if (avgAge <= 28) {
      score += 1.2; // Very young - prime startup age
    } else if (avgAge <= 32) {
      score += 0.9; // Young - balanced energy/experience
    } else if (avgAge <= 36) {
      score += 0.5; // Moderate - likely has domain expertise
    } else if (avgAge <= 40) {
      score += 0.25; // Older - must compensate with experience
    }
    // 40+ = no youth bonus (but no penalty)
  }
  
  // Method 2: Count of young founders
  if (startupAny.founders_under_25 && startupAny.founders_under_25 > 0) {
    score += 0.3 * Math.min(startupAny.founders_under_25, 2); // Up to 0.6 bonus for under-25 founders
  } else if (startupAny.founders_under_30 && startupAny.founders_under_30 > 0) {
    score += 0.2 * Math.min(startupAny.founders_under_30, 2); // Up to 0.4 bonus for under-30 founders
  }
  
  // Method 3: Youngest founder age (if team has one young dynamo)
  if (startupAny.founder_youngest_age) {
    const youngest = startupAny.founder_youngest_age;
    if (youngest < 22) {
      score += 0.4; // Exceptionally young - high energy
    } else if (youngest < 26) {
      score += 0.25; // Very young
    } else if (youngest < 30) {
      score += 0.15; // Young
    }
  }
  
  // Method 4: First-time founders (often younger, more hungry)
  if (startupAny.first_time_founders === true) {
    score += 0.2; // First-time = hungry, something to prove
  }
  
  // Method 5: Estimate from founded_year + team education (heuristic)
  // If company was founded recently and founders have recent graduation, they're likely young
  if (!startupAny.founder_avg_age && startup.founded_date && startup.team && Array.isArray(startup.team)) {
    const foundedYear = new Date(startup.founded_date).getFullYear();
    const hasRecentGrad = startup.team.some(member => {
      const edu = member.education?.toLowerCase() || '';
      // If they mention current year or recent years, likely young
      return edu.includes('2024') || edu.includes('2023') || edu.includes('2022') || 
             edu.includes('student') || edu.includes('dropout');
    });
    
    if (hasRecentGrad && foundedYear >= 2023) {
      score += 0.5; // Likely young founders
    } else if (hasRecentGrad) {
      score += 0.3;
    }
  }
  
  // DEFAULT: If no age data, assume median founder age (~32 = balanced energy/experience)
  if (score === 0 && !startupAny.founder_avg_age && !startupAny.founders_under_25 && 
      !startupAny.founders_under_30 && !startupAny.founder_youngest_age) {
    return 0.5; // Benefit of the doubt - assume ~32 years old
  }
  
  return Math.min(score, 1.5);
}

/**
 * SALES VELOCITY SCORING (0-2 points) - NEW
 * Measures speed of customer adoption and revenue growth
 * 
 * VCs love "rocketships" - startups that acquire customers fast.
 * Key metrics:
 * - Time to first revenue (faster = better product-market fit)
 * - ARR growth rate (100%+ YoY is great)
 * - Customer acquisition rate (MoM growth)
 * - LTV/CAC ratio (>3 = efficient growth)
 * - NRR (>100% = expansion revenue)
 * - Sales cycle length (shorter = easier sale)
 */
function scoreSalesVelocity(startup: StartupProfile): number {
  let score = 0;
  const startupAny = startup as any;
  
  // 1. ARR Growth Rate (0-0.5 points)
  // Triple digit growth = exceptional
  if (startupAny.arr_growth_rate) {
    const arrGrowth = startupAny.arr_growth_rate;
    if (arrGrowth >= 200) {
      score += 0.5; // 3x YoY growth = exceptional
    } else if (arrGrowth >= 100) {
      score += 0.4; // 2x YoY = great
    } else if (arrGrowth >= 50) {
      score += 0.25; // 50% YoY = good
    } else if (arrGrowth >= 25) {
      score += 0.1; // 25% YoY = okay
    }
  }
  
  // 2. Customer Growth Rate (0-0.4 points)
  // Fast customer acquisition = product-market fit
  if (startupAny.customer_growth_monthly) {
    const custGrowth = startupAny.customer_growth_monthly;
    if (custGrowth >= 30) {
      score += 0.4; // 30%+ MoM customer growth = viral
    } else if (custGrowth >= 20) {
      score += 0.3; // 20%+ MoM = excellent
    } else if (custGrowth >= 10) {
      score += 0.2; // 10%+ MoM = solid
    } else if (custGrowth >= 5) {
      score += 0.1; // 5%+ MoM = okay
    }
  }
  
  // 3. Time to First Revenue (0-0.3 points)
  // Faster = better validation
  if (startupAny.time_to_first_revenue_months) {
    const months = startupAny.time_to_first_revenue_months;
    if (months <= 3) {
      score += 0.3; // Revenue in 3 months = instant product-market fit
    } else if (months <= 6) {
      score += 0.2; // 6 months = fast
    } else if (months <= 12) {
      score += 0.1; // 12 months = normal
    }
  }
  
  // 4. Time to $1M ARR (0-0.3 points)
  // The "magic number" milestone
  if (startupAny.months_to_1m_arr) {
    const months = startupAny.months_to_1m_arr;
    if (months <= 12) {
      score += 0.3; // $1M ARR in 12 months = exceptional (Notion-like)
    } else if (months <= 18) {
      score += 0.2; // 18 months = fast
    } else if (months <= 24) {
      score += 0.1; // 2 years = normal
    }
  }
  
  // 5. LTV/CAC Ratio (0-0.25 points)
  // Unit economics efficiency
  if (startupAny.ltv_cac_ratio) {
    const ratio = startupAny.ltv_cac_ratio;
    if (ratio >= 5) {
      score += 0.25; // 5:1 = exceptional efficiency
    } else if (ratio >= 3) {
      score += 0.15; // 3:1 = healthy
    } else if (ratio >= 2) {
      score += 0.05; // 2:1 = marginal
    }
    // Below 2:1 = concerning (burn rate too high)
  }
  
  // 6. Net Revenue Retention (0-0.25 points)
  // Expansion revenue = land and expand working
  if (startupAny.nrr) {
    const nrr = startupAny.nrr;
    if (nrr >= 130) {
      score += 0.25; // 130%+ NRR = exceptional (Snowflake-like)
    } else if (nrr >= 120) {
      score += 0.2; // 120%+ = great
    } else if (nrr >= 110) {
      score += 0.15; // 110%+ = good
    } else if (nrr >= 100) {
      score += 0.1; // 100%+ = no churn
    }
    // Below 100% = net churn (warning sign)
  }
  
  // 7. Sales Cycle Length (0-0.15 points)
  // Shorter = easier product to sell
  if (startupAny.sales_cycle_days) {
    const days = startupAny.sales_cycle_days;
    if (days <= 14) {
      score += 0.15; // 2 weeks = self-serve/product-led
    } else if (days <= 30) {
      score += 0.1; // 1 month = efficient
    } else if (days <= 60) {
      score += 0.05; // 2 months = normal
    }
    // 90+ days = enterprise, slower but okay for right companies
  }
  
  // 8. Proxy from existing metrics
  // If we have MRR and growth_rate, estimate velocity
  if (score === 0 && startup.mrr && startup.growth_rate) {
    // High MRR + high growth = fast sales
    if (startup.mrr >= 50000 && startup.growth_rate >= 20) {
      score += 0.4; // $50K+ MRR with 20%+ MoM growth
    } else if (startup.mrr >= 10000 && startup.growth_rate >= 15) {
      score += 0.25; // $10K+ MRR with 15%+ MoM growth
    } else if (startup.mrr > 0 && startup.growth_rate >= 10) {
      score += 0.1; // Any MRR with 10%+ growth
    }
  }
  
  // 9. Proxy from revenue_annual (ARR estimate)
  if (score === 0 && startup.revenue) {
    // Assume revenue is annual
    if (startup.revenue >= 1000000) {
      score += 0.3; // $1M+ ARR
    } else if (startup.revenue >= 500000) {
      score += 0.2; // $500K+ ARR
    } else if (startup.revenue >= 100000) {
      score += 0.1; // $100K+ ARR
    }
  }
  
  // DEFAULT: If no sales velocity data AND no proxy data, assume average velocity
  // (unknown ≠ slow)
  if (score === 0 && !startup.mrr && !startup.revenue) {
    return 0.5; // Benefit of the doubt - assume average sales velocity
  }
  
  return Math.min(score, 2);
}

/**
 * FOUNDER COURAGE SCORING (0-1.5 points) - NEW
 * Based on Ben Horowitz (Andreessen Horowitz / a16z) framework
 * 
 * Ben Horowitz emphasizes that courage is critical for founders:
 * - The ability to make hard decisions when others won't
 * - Persistence through adversity and rejection
 * - Willingness to take calculated risks
 * - Resilience in the face of setbacks
 * - Boldness to pursue contrarian paths
 * 
 * Courage indicators:
 * - Bold decisions made (risky bets, contrarian moves)
 * - Persistence through rejections
 * - High-risk opportunities pursued
 * - Resilience demonstrated (bouncing back from setbacks)
 * - Willingness to pivot when needed
 */
function scoreFounderCourage(startup: StartupProfile): number {
  let score = 0;
  const startupAny = startup as any;
  
  // Direct courage rating (if provided)
  if (startupAny.founder_courage) {
    switch (startupAny.founder_courage) {
      case 'exceptional':
        score += 1.5;
        break;
      case 'high':
        score += 1.0;
        break;
      case 'moderate':
        score += 0.5;
        break;
      case 'low':
        score += 0.1;
        break;
    }
  }
  
  // Bold decisions made (0-0.4 points)
  if (startupAny.bold_decisions_made !== undefined) {
    if (startupAny.bold_decisions_made >= 5) {
      score += 0.4; // Many bold decisions = exceptional courage
    } else if (startupAny.bold_decisions_made >= 3) {
      score += 0.3; // Several bold decisions = high courage
    } else if (startupAny.bold_decisions_made >= 1) {
      score += 0.15; // Some bold decisions = moderate courage
    }
  }
  
  // Persistence through rejections (0-0.3 points)
  if (startupAny.times_rejected_but_persisted !== undefined) {
    if (startupAny.times_rejected_but_persisted >= 10) {
      score += 0.3; // 10+ rejections overcome = exceptional persistence
    } else if (startupAny.times_rejected_but_persisted >= 5) {
      score += 0.2; // 5+ rejections = strong persistence
    } else if (startupAny.times_rejected_but_persisted >= 2) {
      score += 0.1; // 2+ rejections = some persistence
    }
  }
  
  // High-risk opportunities pursued (0-0.3 points)
  if (startupAny.high_risk_opportunities_pursued !== undefined) {
    if (startupAny.high_risk_opportunities_pursued >= 3) {
      score += 0.3; // Multiple high-risk bets = exceptional courage
    } else if (startupAny.high_risk_opportunities_pursued >= 2) {
      score += 0.2; // Several risky bets = high courage
    } else if (startupAny.high_risk_opportunities_pursued >= 1) {
      score += 0.1; // Some risky bets = moderate courage
    }
  }
  
  // Resilience demonstrated (0-0.2 points)
  if (startupAny.resilience_demonstrated === true) {
    score += 0.2; // Evidence of bouncing back from setbacks
  }
  
  // Pivot history as courage indicator (0-0.2 points)
  // Pivoting shows courage to admit mistakes and change direction
  if (startup.pivots_made !== undefined && startup.pivots_made > 0) {
    if (startup.pivots_made >= 2) {
      score += 0.2; // Multiple pivots = courage to change
    } else if (startup.pivots_made === 1) {
      score += 0.1; // One pivot = some courage
    }
  }
  
  // Contrarian insight as courage indicator (0-0.1 points)
  // Going against conventional wisdom requires courage
  if (startup.contrarian_insight && startup.contrarian_insight.length > 50) {
    score += 0.1; // Has contrarian beliefs = courage to be different
  }
  
  // DEFAULT: If no courage data, assume moderate courage
  // (most founders who start companies have some courage)
  if (score === 0 && !startupAny.founder_courage && !startupAny.bold_decisions_made && 
      !startupAny.times_rejected_but_persisted && !startupAny.high_risk_opportunities_pursued &&
      !startupAny.resilience_demonstrated) {
    return 0.5; // Benefit of the doubt - assume moderate courage
  }
  
  return Math.min(score, 1.5);
}

/**
 * FOUNDER INTELLIGENCE SCORING (0-1.5 points) - NEW
 * Based on Ben Horowitz (Andreessen Horowitz / a16z) framework
 * 
 * Ben Horowitz values intelligence in founders as:
 * - Strategic thinking and long-term vision
 * - Ability to solve complex problems
 * - Fast learning and adaptation
 * - Deep analytical thinking
 * - Understanding of market dynamics and timing
 * 
 * Intelligence indicators:
 * - Strategic thinking evidence (long-term planning, complex decisions)
 * - Problem-solving examples (complex problems solved)
 * - Learning velocity evidence (fast adaptation to new information)
 * - Analytical depth (depth of analysis in decisions)
 * - Education background (pedigree can indicate intelligence)
 */
function scoreFounderIntelligence(startup: StartupProfile): number {
  let score = 0;
  const startupAny = startup as any;
  
  // Direct intelligence rating (if provided)
  if (startupAny.founder_intelligence) {
    switch (startupAny.founder_intelligence) {
      case 'exceptional':
        score += 1.5;
        break;
      case 'high':
        score += 1.0;
        break;
      case 'moderate':
        score += 0.5;
        break;
      case 'low':
        score += 0.1;
        break;
    }
  }
  
  // Strategic thinking evidence (0-0.4 points)
  if (startupAny.strategic_thinking_evidence && startupAny.strategic_thinking_evidence.length > 100) {
    score += 0.4; // Strong evidence of strategic thinking
  } else if (startupAny.strategic_thinking_evidence && startupAny.strategic_thinking_evidence.length > 50) {
    score += 0.2; // Some evidence of strategic thinking
  }
  
  // Problem-solving examples (0-0.3 points)
  if (startupAny.problem_solving_examples && Array.isArray(startupAny.problem_solving_examples)) {
    if (startupAny.problem_solving_examples.length >= 5) {
      score += 0.3; // Many complex problems solved = exceptional intelligence
    } else if (startupAny.problem_solving_examples.length >= 3) {
      score += 0.2; // Several problems solved = high intelligence
    } else if (startupAny.problem_solving_examples.length >= 1) {
      score += 0.1; // Some problems solved = moderate intelligence
    }
  }
  
  // Learning velocity evidence (0-0.3 points)
  if (startupAny.learning_velocity_evidence && startupAny.learning_velocity_evidence.length > 50) {
    score += 0.3; // Evidence of fast learning and adaptation
  }
  
  // Analytical depth (0-0.2 points)
  if (startupAny.analytical_depth) {
    switch (startupAny.analytical_depth) {
      case 'deep':
        score += 0.2; // Deep analysis = high intelligence
        break;
      case 'moderate':
        score += 0.1; // Moderate analysis = some intelligence
        break;
      case 'surface':
        score += 0.05; // Surface analysis = minimal
        break;
    }
  }
  
  // Education background as proxy (0-0.2 points)
  if (startup.team && Array.isArray(startup.team) && startup.team.length > 0) {
    const hasTopEducation = startup.team.some(member => {
      const edu = member.education?.toLowerCase() || '';
      return edu.includes('stanford') || edu.includes('mit') || 
             edu.includes('harvard') || edu.includes('berkeley') ||
             edu.includes('caltech') || edu.includes('princeton') ||
             edu.includes('yale') || edu.includes('phd') ||
             edu.includes('mba');
    });
    
    if (hasTopEducation) {
      score += 0.2; // Top-tier education = likely high intelligence
    }
  }
  
  // Contrarian insight as intelligence indicator (0-0.1 points)
  // Understanding something others don't requires intelligence
  if (startup.contrarian_insight && startup.contrarian_insight.length > 100) {
    score += 0.1; // Deep contrarian insight = intelligence
  }
  
  // Problem discovery depth as intelligence indicator (0-0.1 points)
  if (startup.problem_discovery_depth === 'deep') {
    score += 0.1; // Deep problem understanding = intelligence
  }
  
  // DEFAULT: If no intelligence data, assume moderate intelligence
  // (most founders who start companies have some intelligence)
  if (score === 0 && !startupAny.founder_intelligence && !startupAny.strategic_thinking_evidence && 
      !startupAny.problem_solving_examples && !startupAny.learning_velocity_evidence &&
      !startupAny.analytical_depth) {
    return 0.5; // Benefit of the doubt - assume moderate intelligence
  }
  
  return Math.min(score, 1.5);
}

/**
 * Generate human-readable reasoning
 */
function generateReasoning(startup: StartupProfile, scores: any): string[] {
  const reasons: string[] = [];
  
  // Base boost acknowledgment
  if (scores.baseBoost && scores.baseBoost >= 2) {
    reasons.push('✅ Startup profile active with basic information');
  }
  
  // Team highlights
  if (scores.teamScore >= 2) {
    reasons.push('🔥 Exceptional founding team with strong technical background and pedigree');
  } else if (scores.teamScore >= 1) {
    reasons.push('✅ Solid team with relevant experience');
  }
  
  // Traction highlights (includes Seed/Angel metrics)
  if (scores.tractionScore >= 2) {
    const hasRetention = startup.retention_rate && startup.retention_rate >= 80;
    const hasLowChurn = startup.churn_rate && startup.churn_rate <= 5;
    const hasPayingCustomers = startup.prepaying_customers && startup.prepaying_customers >= 3;
    
    if (hasRetention || hasLowChurn || hasPayingCustomers) {
      reasons.push('📈 Strong product-market fit with excellent retention and paying customers');
    } else {
      reasons.push('📈 Strong traction with revenue and rapid growth');
    }
  } else if (scores.tractionScore >= 1) {
    reasons.push('📊 Early traction signals');
  }
  
  // Market highlights
  if (scores.marketScore >= 1.5) {
    reasons.push('🎯 Hot market with massive TAM');
  } else if (scores.marketScore >= 1) {
    reasons.push('🌐 Compelling market opportunity');
  }
  
  // Product highlights
  if (scores.productScore >= 1.5) {
    reasons.push('💎 Unique product with strong defensibility');
  } else if (scores.productScore >= 0.5) {
    reasons.push('🛠️ Product in market with demo');
  }
  
  // Vision-specific highlights (First Round & Seed/Angel criteria)
  if (scores.visionScore >= 1.5) {
    reasons.push('💡 Exceptional vision: contrarian insight, creative strategy, and solid financial planning');
  } else if (scores.visionScore >= 0.75) {
    const hasFinancialPlanning = startup.use_of_funds || startup.runway_months;
    if (hasFinancialPlanning) {
      reasons.push('💡 Strong contrarian insight with clear financial planning (Seed/Angel fit)');
    } else {
      reasons.push('💡 Strong contrarian insight and creative strategy (First Round fit)');
    }
  }
  
  // NEW: Problem validation highlights (YOUR #1 CRITERION)
  if (scores.problemValidationScore >= 1.5) {
    reasons.push('🎯 EXCEPTIONAL problem validation: 20+ customer interviews, quantified pain, crystal-clear ICP');
  } else if (scores.problemValidationScore >= 1) {
    reasons.push('✅ Strong customer problem validation with clear pain points');
  } else if (scores.problemValidationScore < 0.5) {
    reasons.push('⚠️  Weak problem validation - needs more customer discovery');
  }
  
  // NEW: Ecosystem highlights
  if (scores.ecosystemScore >= 1) {
    const hasRevenuePartners = startup.strategic_partners?.some(p => 
      p.relationship_stage === 'revenue_generating'
    );
    if (hasRevenuePartners) {
      reasons.push('🤝 Strong ecosystem: Partners driving revenue + quality advisors');
    } else {
      reasons.push('🤝 Solid partnerships and advisory board');
    }
  }
  
  // NEW: Grit highlights
  if (scores.gritScore >= 1) {
    const fastIteration = startup.time_to_iterate_days && startup.time_to_iterate_days <= 7;
    const dailyCustomerContact = startup.customer_feedback_frequency === 'daily';
    if (fastIteration && dailyCustomerContact) {
      reasons.push('💪 Exceptional grit: Daily customer contact + weekly iteration velocity');
    } else {
      reasons.push('💪 Strong adaptability and customer obsession');
    }
  }
  
  // NEW: Founder age highlights
  if (scores.founderAgeScore >= 1.2) {
    reasons.push('🚀 Young founding team: Exceptional adaptability and hunger');
  } else if (scores.founderAgeScore >= 0.8) {
    reasons.push('⚡ Young founders: High energy and willingness to learn');
  } else if (scores.founderAgeScore >= 0.4) {
    reasons.push('✅ Founders with balanced age/experience profile');
  }
  
  // NEW: Sales velocity highlights
  if (scores.salesVelocityScore >= 1.5) {
    reasons.push('🚀 EXCEPTIONAL sales velocity: Rapid customer acquisition, efficient unit economics');
  } else if (scores.salesVelocityScore >= 1) {
    reasons.push('📈 Strong sales velocity: Fast-growing with healthy metrics');
  } else if (scores.salesVelocityScore >= 0.5) {
    reasons.push('✅ Solid sales traction with growth momentum');
  }
  
  // YC-STYLE: Founder Speed highlights
  if (scores.founderSpeedScore >= 2.5) {
    reasons.push('⚡ ROCKET SHIP: Ships daily, moved from idea to MVP in weeks');
  } else if (scores.founderSpeedScore >= 1.5) {
    reasons.push('🏃 Fast executor: High deployment velocity, rapid iteration');
  } else if (scores.founderSpeedScore >= 0.5) {
    reasons.push('✅ Decent execution speed');
  }
  
  // YC-STYLE: Unique Insight highlights
  if (scores.uniqueInsightScore >= 2) {
    reasons.push('💡 NON-OBVIOUS INSIGHT: Contrarian belief + clear "why now" + unfair advantage');
  } else if (scores.uniqueInsightScore >= 1) {
    reasons.push('🔮 Has unique insight or timing thesis');
  }
  
  // YC-STYLE: User Love highlights
  if (scores.userLoveScore >= 1.5) {
    reasons.push('❤️ USERS LOVE THIS: High engagement, organic referrals, "very disappointed" test passed');
  } else if (scores.userLoveScore >= 0.8) {
    reasons.push('😍 Strong user engagement and retention');
  }
  
  // YC-STYLE: Learning Velocity highlights
  if (scores.learningVelocityScore >= 1.2) {
    reasons.push('🧪 RAPID LEARNER: Multiple experiments, fast pivots, validated hypotheses');
  } else if (scores.learningVelocityScore >= 0.6) {
    reasons.push('📚 Good learning velocity and adaptation');
  }
  
  // FOUNDER ATTRIBUTES: Courage highlights
  if (scores.founderCourageScore >= 1.2) {
    reasons.push('🦁 EXCEPTIONAL COURAGE: Bold decisions, high-risk bets, resilient through setbacks');
  } else if (scores.founderCourageScore >= 0.8) {
    reasons.push('💪 High courage: Willing to take risks and persist through challenges');
  } else if (scores.founderCourageScore >= 0.5) {
    reasons.push('✅ Moderate courage: Shows resilience and willingness to pivot');
  }
  
  // FOUNDER ATTRIBUTES: Intelligence highlights
  if (scores.founderIntelligenceScore >= 1.2) {
    reasons.push('🧠 EXCEPTIONAL INTELLIGENCE: Strategic thinking, complex problem-solving, rapid learning');
  } else if (scores.founderIntelligenceScore >= 0.8) {
    reasons.push('🎓 High intelligence: Strong analytical depth and strategic planning');
  } else if (scores.founderIntelligenceScore >= 0.5) {
    reasons.push('✅ Solid intelligence: Good problem-solving and learning ability');
  }
  
  return reasons;
}

// ============================================
// YC-STYLE SCORING FUNCTIONS
// "We fund founders, not ideas" - YC
// ============================================

/**
 * FOUNDER SPEED SCORING (0-3 points) ⭐⭐⭐⭐⭐
 * YC's #1 criterion: How fast do they build, ship, and iterate?
 * 
 * "A startup that has shipped a broken product to real users
 * is more impressive than one still perfecting their MVP."
 */
function scoreFounderSpeed(startup: StartupProfile): number {
  let score = 0;
  
  // 1. Time from idea to MVP (0-1 points)
  // YC loves founders who built something in weeks, not months
  if (startup.days_from_idea_to_mvp !== undefined) {
    if (startup.days_from_idea_to_mvp <= 14) score += 1;        // 2 weeks = amazing
    else if (startup.days_from_idea_to_mvp <= 30) score += 0.8; // 1 month = great
    else if (startup.days_from_idea_to_mvp <= 60) score += 0.5; // 2 months = okay
    else if (startup.days_from_idea_to_mvp <= 90) score += 0.2; // 3 months = slow
  }
  
  // 2. Features shipped last month (0-0.8 points)
  // Velocity of shipping matters
  if (startup.features_shipped_last_month !== undefined) {
    if (startup.features_shipped_last_month >= 10) score += 0.8; // Ship machines
    else if (startup.features_shipped_last_month >= 5) score += 0.6;
    else if (startup.features_shipped_last_month >= 2) score += 0.3;
    else if (startup.features_shipped_last_month >= 1) score += 0.1;
  }
  
  // 3. Deployment frequency (0-0.7 points)
  // Daily shipping is a strong signal
  if (startup.deployment_frequency === 'daily') score += 0.7;
  else if (startup.deployment_frequency === 'weekly') score += 0.5;
  else if (startup.deployment_frequency === 'monthly') score += 0.2;
  
  // 4. Time to iterate (from grit score) (0-0.5 points)
  if (startup.time_to_iterate_days !== undefined) {
    if (startup.time_to_iterate_days <= 3) score += 0.5;
    else if (startup.time_to_iterate_days <= 7) score += 0.3;
    else if (startup.time_to_iterate_days <= 14) score += 0.1;
  }
  
  // PROXY: If we don't have direct speed data, infer from:
  // - Having a launched product is a good sign
  // - Having a demo shows they built something
  // - Having customers means they shipped
  if (score === 0) {
    if (startup.launched) score += 0.8;
    if (startup.demo_available) score += 0.4;
    if (startup.customers && startup.customers > 0) score += 0.3;
    if (startup.active_users && startup.active_users > 0) score += 0.3;
    
    // Technical co-founders build faster
    if (startup.technical_cofounders && startup.technical_cofounders > 0) {
      score += 0.4;
    }
  }
  
  // DEFAULT: If still no score after proxies, assume they're shipping (they exist, after all)
  if (score === 0) {
    return 0.8; // Benefit of the doubt - assume they're executing
  }
  
  return Math.min(score, 3);
}

/**
 * UNIQUE INSIGHT SCORING (0-2.5 points) ⭐⭐⭐⭐
 * YC asks: "Why is this a good idea now, and why are YOU the right people?"
 * 
 * They want non-obvious insights, not "$100B TAM" decks.
 * "This is broken and here's why" > "This market is huge"
 */
function scoreUniqueInsight(startup: StartupProfile): number {
  let score = 0;
  
  // 1. Contrarian belief (0-1 points)
  // What do they believe that others don't?
  if (startup.contrarian_belief) {
    const length = startup.contrarian_belief.length;
    if (length > 200) score += 1;       // Deep contrarian thinking
    else if (length > 100) score += 0.7;
    else if (length > 50) score += 0.4;
    else score += 0.2;
  }
  
  // Also check contrarian_insight (legacy field)
  if (score === 0 && startup.contrarian_insight) {
    const length = startup.contrarian_insight.length;
    if (length > 200) score += 1;
    else if (length > 100) score += 0.7;
    else if (length > 50) score += 0.4;
    else score += 0.2;
  }
  
  // 2. "Why now?" timing (0-0.8 points)
  // Great startups have a clear reason why THIS moment is right
  if (startup.why_now) {
    const length = startup.why_now.length;
    if (length > 150) score += 0.8;
    else if (length > 75) score += 0.5;
    else if (length > 25) score += 0.2;
  }
  
  // 3. Unfair advantage / Founder-market fit (0-0.7 points)
  // Why are THEY the right people to solve this?
  if (startup.unfair_advantage) {
    const length = startup.unfair_advantage.length;
    if (length > 150) score += 0.7;
    else if (length > 75) score += 0.4;
    else if (length > 25) score += 0.2;
  }
  
  // PROXY: If we don't have direct insight data, infer from problem clarity
  if (score === 0) {
    // Deep problem understanding implies unique insight
    if (startup.problem_discovery_depth === 'deep') score += 0.8;
    else if (startup.problem_discovery_depth === 'moderate') score += 0.4;
    
    // Crystal clear ICP means they know their customer
    if (startup.icp_clarity === 'crystal_clear') score += 0.5;
    else if (startup.icp_clarity === 'moderate') score += 0.2;
    
    // Customer interviews reveal insight
    if (startup.customer_interviews_conducted && startup.customer_interviews_conducted >= 50) {
      score += 0.5;
    } else if (startup.customer_interviews_conducted && startup.customer_interviews_conducted >= 20) {
      score += 0.3;
    }
  }
  
  // DEFAULT: If still no score, assume some thesis exists (they got funding news for a reason)
  if (score === 0) {
    return 0.6; // Benefit of the doubt - assume they have some insight
  }
  
  return Math.min(score, 2.5);
}

/**
 * USER LOVE SCORING (0-2 points) ⭐⭐⭐
 * YC: "A few users who love your product is better than thousands who don't care."
 * 
 * Quality of engagement > quantity of users
 * Organic growth > paid acquisition
 */
function scoreUserLove(startup: StartupProfile): number {
  let score = 0;
  
  // 1. Sean Ellis test: "Very disappointed" users (0-0.6 points)
  // If 40%+ would be "very disappointed" without your product, you have PMF
  if (startup.users_who_would_be_very_disappointed !== undefined) {
    if (startup.users_who_would_be_very_disappointed >= 40) score += 0.6;
    else if (startup.users_who_would_be_very_disappointed >= 25) score += 0.4;
    else if (startup.users_who_would_be_very_disappointed >= 15) score += 0.2;
  }
  
  // 2. NPS Score (0-0.5 points)
  // High NPS = users love you
  if (startup.nps_score !== undefined) {
    if (startup.nps_score >= 70) score += 0.5;       // World class
    else if (startup.nps_score >= 50) score += 0.4;  // Excellent
    else if (startup.nps_score >= 30) score += 0.25; // Good
    else if (startup.nps_score >= 0) score += 0.1;   // Okay
  }
  
  // 3. Organic referral rate (0-0.4 points)
  // Word of mouth = true product love
  if (startup.organic_referral_rate !== undefined) {
    if (startup.organic_referral_rate >= 50) score += 0.4; // Viral
    else if (startup.organic_referral_rate >= 30) score += 0.3;
    else if (startup.organic_referral_rate >= 15) score += 0.2;
    else if (startup.organic_referral_rate >= 5) score += 0.1;
  }
  
  // 4. DAU/WAU ratio (0-0.5 points)
  // High ratio = sticky product, daily engagement
  if (startup.dau_wau_ratio !== undefined) {
    if (startup.dau_wau_ratio >= 0.6) score += 0.5;  // Extremely sticky
    else if (startup.dau_wau_ratio >= 0.4) score += 0.35;
    else if (startup.dau_wau_ratio >= 0.25) score += 0.2;
    else if (startup.dau_wau_ratio >= 0.15) score += 0.1;
  }
  
  // PROXY: If we don't have direct user love data
  if (score === 0) {
    // Retention rate indicates love
    if (startup.retention_rate && startup.retention_rate >= 80) {
      score += 0.6;
    } else if (startup.retention_rate && startup.retention_rate >= 60) {
      score += 0.4;
    }
    
    // Low churn = users stay = love
    if (startup.churn_rate !== undefined && startup.churn_rate <= 5) {
      score += 0.4;
    } else if (startup.churn_rate !== undefined && startup.churn_rate <= 10) {
      score += 0.2;
    }
    
    // Prepaying customers = they really want it
    if (startup.prepaying_customers && startup.prepaying_customers > 0) {
      score += 0.3;
    }
    
    // Passionate early customers (First Round criteria)
    if (startup.passionate_customers && startup.passionate_customers >= 10) {
      score += 0.4;
    } else if (startup.passionate_customers && startup.passionate_customers >= 5) {
      score += 0.2;
    }
  }
  
  // DEFAULT: If still no score, assume some user engagement (unknown ≠ unloved)
  if (score === 0) {
    return 0.5; // Benefit of the doubt - assume average engagement
  }
  
  return Math.min(score, 2);
}

/**
 * LEARNING VELOCITY SCORING (0-1.5 points)
 * YC: "How fast they learn from users and adapt"
 * 
 * This is what separates good founders from great ones.
 * Speed of learning > being right the first time.
 */
function scoreLearningVelocity(startup: StartupProfile): number {
  let score = 0;
  
  // 1. Experiments run last month (0-0.5 points)
  // Great founders are constantly testing
  if (startup.experiments_run_last_month !== undefined) {
    if (startup.experiments_run_last_month >= 10) score += 0.5;
    else if (startup.experiments_run_last_month >= 5) score += 0.35;
    else if (startup.experiments_run_last_month >= 2) score += 0.2;
    else if (startup.experiments_run_last_month >= 1) score += 0.1;
  }
  
  // 2. Hypotheses validated (0-0.4 points)
  // Do they capture what they learn?
  if (startup.hypotheses_validated !== undefined) {
    if (startup.hypotheses_validated >= 20) score += 0.4;
    else if (startup.hypotheses_validated >= 10) score += 0.3;
    else if (startup.hypotheses_validated >= 5) score += 0.2;
    else if (startup.hypotheses_validated >= 1) score += 0.1;
  }
  
  // 3. Pivot speed (0-0.3 points)
  // How fast do they adapt when something isn't working?
  if (startup.pivot_speed_days !== undefined) {
    if (startup.pivot_speed_days <= 7) score += 0.3;   // Rapid adaptation
    else if (startup.pivot_speed_days <= 14) score += 0.2;
    else if (startup.pivot_speed_days <= 30) score += 0.1;
  }
  
  // 4. Customer feedback frequency (0-0.3 points) 
  // From grit score - how often they talk to customers
  if (startup.customer_feedback_frequency === 'daily') score += 0.3;
  else if (startup.customer_feedback_frequency === 'weekly') score += 0.2;
  else if (startup.customer_feedback_frequency === 'monthly') score += 0.1;
  
  // PROXY: If we don't have direct learning data
  if (score === 0) {
    // Pivots made indicate willingness to learn
    if (startup.pivots_made && startup.pivots_made >= 2) {
      score += 0.4; // Multiple pivots = they're learning
    } else if (startup.pivots_made && startup.pivots_made >= 1) {
      score += 0.25;
    }
    
    // Customer interviews indicate learning mindset
    if (startup.customer_interviews_conducted && startup.customer_interviews_conducted >= 30) {
      score += 0.4;
    } else if (startup.customer_interviews_conducted && startup.customer_interviews_conducted >= 10) {
      score += 0.2;
    }
    
    // Problem discovery depth indicates learning
    if (startup.problem_discovery_depth === 'deep') score += 0.3;
    else if (startup.problem_discovery_depth === 'moderate') score += 0.15;
  }
  
  // DEFAULT: If still no score, assume average learning velocity
  if (score === 0) {
    return 0.4; // Benefit of the doubt - assume they're learning
  }
  
  return Math.min(score, 1.5);
}

/**
 * Quick qualification check - should this startup get matched at all?
 */
export function qualifiesForMatching(startup: StartupProfile): boolean {
  const score = calculateHotScore(startup);
  return score.total >= 2; // Minimum score of 2/10 to get any matches
}
