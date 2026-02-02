/**
 * ⛔ DEPRECATED - DO NOT USE IN GOD SCORING
 * ============================================
 * 
 * This file was created by AI copilot WITHOUT admin approval (Dec 27, 2025).
 * It was incorrectly injected into GOD scoring as a component.
 * 
 * CORRECT USAGE: This logic should be part of SIGNAL dimensions, not GOD.
 * The Signal Application Service already handles funding_acceleration.
 * 
 * This file is kept for reference but should NOT be imported into:
 *   - startupScoringService.ts
 *   - recalculate-scores.ts
 *   - Any GOD scoring calculation
 * 
 * See: GOD_SCORING_AUDIT_JAN_2026.md for full details.
 * 
 * ORIGINAL DESCRIPTION:
 * Measures how efficiently a startup converts capital into results.
 * Key insight: In 2025, bootstrapped and capital-efficient startups 
 * are outperforming over-funded competitors. VCs are wary of "pilot purgatory"
 * and demanding proof of sustainable unit economics.
 */

interface EfficiencyProfile {
  mrr?: number;
  revenue?: number;
  arr?: number;
  funding_amount?: number;
  funding_raised?: number;
  team_size?: number;
  founders_count?: number;
  burn_rate?: number;
  runway_months?: number;
  stage?: string | number;  // Allow both string and number for compatibility
  has_revenue?: boolean;
  has_customers?: boolean;
  customer_count?: number;
  tagline?: string;
  pitch?: string;
  description?: string;
}

interface EfficiencyResult {
  score: number;  // 0-1.0
  breakdown: {
    revenuePerCapital: number;
    teamEfficiency: number;
    bootstrapBonus: number;
    sustainabilitySignals: number;
  };
  signals: string[];
  antiSignals: string[];
}

/**
 * Calculate capital efficiency score (0-1.0 points)
 * 
 * Components:
 * - Revenue per capital: Revenue relative to funding (0-0.35)
 * - Team efficiency: Output relative to team size (0-0.25)
 * - Bootstrap bonus: Revenue without external funding (0-0.25)
 * - Sustainability signals: Profit, margins, runway (0-0.15)
 */
export function scoreCapitalEfficiency(profile: EfficiencyProfile): EfficiencyResult {
  const signals: string[] = [];
  const antiSignals: string[] = [];
  
  let revenuePerCapital = 0;
  let teamEfficiency = 0;
  let bootstrapBonus = 0;
  let sustainabilitySignals = 0;
  
  // Calculate key metrics
  const annualRevenue = profile.arr || (profile.mrr ? profile.mrr * 12 : 0) || profile.revenue || 0;
  const funding = profile.funding_amount || profile.funding_raised || 0;
  const teamSize = profile.team_size || profile.founders_count || 1;
  const hasRevenue = profile.has_revenue || annualRevenue > 0;
  const hasCustomers = profile.has_customers || (profile.customer_count && profile.customer_count > 0);
  
  // Combine text for pattern matching
  const allText = [
    profile.tagline || '',
    profile.pitch || '',
    profile.description || ''
  ].join(' ').toLowerCase();
  
  // ==========================================================================
  // 1. REVENUE PER CAPITAL (0-0.35 points)
  // ==========================================================================
  if (annualRevenue > 0 && funding > 0) {
    const revenueToFundingRatio = annualRevenue / funding;
    
    if (revenueToFundingRatio >= 1.0) {
      // Revenue >= funding raised - exceptional efficiency
      revenuePerCapital = 0.35;
      signals.push('Revenue exceeds total funding (capital efficient)');
    } else if (revenueToFundingRatio >= 0.5) {
      revenuePerCapital = 0.25;
      signals.push('Strong revenue/funding ratio (>50%)');
    } else if (revenueToFundingRatio >= 0.2) {
      revenuePerCapital = 0.15;
      signals.push('Healthy revenue/funding ratio (>20%)');
    } else if (revenueToFundingRatio >= 0.1) {
      revenuePerCapital = 0.1;
    }
  } else if (annualRevenue > 0 && funding === 0) {
    // Revenue with no funding = very efficient
    revenuePerCapital = 0.3;
    signals.push('Revenue without external funding');
  }
  
  // Anti-signal: Over-funded with no revenue
  if (funding >= 5000000 && !hasRevenue) {
    antiSignals.push('Raised $5M+ with no revenue');
    revenuePerCapital -= 0.1;
  }
  
  // ==========================================================================
  // 2. TEAM EFFICIENCY (0-0.25 points)
  // ==========================================================================
  // Revenue per employee is a strong efficiency signal
  if (annualRevenue > 0 && teamSize > 0) {
    const revenuePerEmployee = annualRevenue / teamSize;
    
    if (revenuePerEmployee >= 500000) {
      teamEfficiency = 0.25;
      signals.push('$500K+ revenue per team member');
    } else if (revenuePerEmployee >= 200000) {
      teamEfficiency = 0.2;
      signals.push('$200K+ revenue per team member');
    } else if (revenuePerEmployee >= 100000) {
      teamEfficiency = 0.15;
      signals.push('$100K+ revenue per team member');
    } else if (revenuePerEmployee >= 50000) {
      teamEfficiency = 0.1;
    }
  }
  
  // Small team with traction = efficient
  if (teamSize <= 3 && (hasRevenue || hasCustomers)) {
    teamEfficiency += 0.1;
    signals.push('Lean team with traction');
  }
  
  // Anti-signal: Large team without revenue
  if (teamSize >= 10 && !hasRevenue) {
    antiSignals.push('Large team (10+) without revenue');
    teamEfficiency -= 0.1;
  }
  
  // ==========================================================================
  // 3. BOOTSTRAP BONUS (0-0.25 points)
  // ==========================================================================
  // Bootstrapped companies show discipline and product-market fit
  if (hasRevenue && funding < 50000) {
    bootstrapBonus = 0.25;
    signals.push('Bootstrapped to revenue');
  } else if (hasRevenue && funding < 500000) {
    bootstrapBonus = 0.15;
    signals.push('Minimal funding to revenue');
  } else if (hasCustomers && funding < 100000) {
    bootstrapBonus = 0.1;
    signals.push('Customers with minimal funding');
  }
  
  // Pattern matching for bootstrap signals
  const bootstrapPatterns = [
    /\b(bootstrapped|self-funded|profitable|cash-flow positive)/i,
    /\b(no external|no funding|no investors|indie)/i,
    /\b(ramen profitable|default alive)/i
  ];
  
  const bootstrapMatches = bootstrapPatterns.filter(p => p.test(allText)).length;
  if (bootstrapMatches >= 1) {
    bootstrapBonus += 0.1;
    signals.push('Bootstrap signals in description');
  }
  
  // ==========================================================================
  // 4. SUSTAINABILITY SIGNALS (0-0.15 points)
  // ==========================================================================
  // Runway, burn rate, profitability signals
  if (profile.runway_months && profile.runway_months >= 18) {
    sustainabilitySignals += 0.1;
    signals.push('18+ months runway');
  }
  
  const sustainabilityPatterns = [
    /\b(profitable|profitability|margin|unit economics)/i,
    /\b(sustainable|efficient|lean|disciplined)/i,
    /\b(recurring revenue|subscription|saas|arr|mrr)/i
  ];
  
  const sustainabilityMatches = sustainabilityPatterns.filter(p => p.test(allText)).length;
  if (sustainabilityMatches >= 2) {
    sustainabilitySignals += 0.1;
    signals.push('Strong sustainability language');
  } else if (sustainabilityMatches >= 1) {
    sustainabilitySignals += 0.05;
  }
  
  // ==========================================================================
  // TOTAL
  // ==========================================================================
  const rawScore = revenuePerCapital + teamEfficiency + bootstrapBonus + sustainabilitySignals;
  const score = Math.max(Math.min(rawScore, 1.0), 0);
  
  return {
    score,
    breakdown: {
      revenuePerCapital: Math.max(revenuePerCapital, 0),
      teamEfficiency: Math.max(teamEfficiency, 0),
      bootstrapBonus,
      sustainabilitySignals
    },
    signals,
    antiSignals
  };
}

export default { scoreCapitalEfficiency };
