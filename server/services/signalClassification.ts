/**
 * SIGNAL CLASSIFICATION & WEIGHTING SYSTEM
 * =========================================
 * 
 * Not all signals are created equal. This module classifies signals by:
 * - Tier (Gold, Silver, Bronze, Noise)
 * - Confidence (High, Medium, Low)
 * - Impact (how much it should move the score)
 * 
 * Used by GOD scoring to properly weight signal contributions.
 */

export interface SignalClassification {
  tier: 'gold' | 'silver' | 'bronze' | 'noise';
  confidence: 'high' | 'medium' | 'low';
  weight: number; // Multiplier (0.1 - 1.0)
  description: string;
}

/**
 * SIGNAL TIERS
 * =============
 * 
 * GOLD (Weight: 0.8-1.0) - Hard evidence, extremely reliable
 * - Confirmed revenue numbers ($X ARR/MRR)
 * - Tier 1 investor backing (Sequoia, a16z, YC)
 * - Named paying enterprise customers
 * - Product actually launched and in market
 * - Technical cofounder with FAANG background
 * 
 * SILVER (Weight: 0.5-0.7) - Strong signals, moderately reliable
 * - Growth rates (with caveats)
 * - User counts (can be gamed)
 * - Tier 2/3 investor backing
 * - Demo available (but not launched)
 * - Team from good companies (non-FAANG)
 * 
 * BRONZE (Weight: 0.2-0.4) - Weak signals, low confidence
 * - Inferred metrics (has_revenue but no amount)
 * - Vague market size claims
 * - Generic press mentions
 * - Self-reported traction
 * - Unverified partnerships
 * 
 * NOISE (Weight: 0-0.1) - Unreliable, filter out
 * - Marketing fluff
 * - Buzzword presence
 * - Website exists
 * - Logo uploaded
 * - Social media presence
 */

export const SIGNAL_CLASSIFICATIONS: Record<string, SignalClassification> = {
  // ============ GOLD TIER SIGNALS ============
  'confirmed_revenue_1m+': {
    tier: 'gold',
    confidence: 'high',
    weight: 1.0,
    description: 'ARR/MRR >= $1M (verified)'
  },
  'confirmed_revenue_100k+': {
    tier: 'gold',
    confidence: 'high',
    weight: 0.9,
    description: 'ARR/MRR >= $100K (verified)'
  },
  'tier1_investor': {
    tier: 'gold',
    confidence: 'high',
    weight: 1.0,
    description: 'Backed by Sequoia, a16z, YC, etc.'
  },
  'named_enterprise_customer': {
    tier: 'gold',
    confidence: 'high',
    weight: 0.9,
    description: 'Named Fortune 500 customer'
  },
  'product_launched_live': {
    tier: 'gold',
    confidence: 'high',
    weight: 0.8,
    description: 'Product live and accessible'
  },
  'faang_technical_cofounder': {
    tier: 'gold',
    confidence: 'high',
    weight: 0.9,
    description: 'CTO/Engineer from FAANG'
  },
  'growth_30_percent_mom': {
    tier: 'gold',
    confidence: 'high',
    weight: 0.85,
    description: '30%+ MoM growth (verified)'
  },

  // ============ SILVER TIER SIGNALS ============
  'confirmed_revenue_10k+': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.7,
    description: 'ARR/MRR >= $10K'
  },
  'growth_15_percent_mom': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.6,
    description: '15%+ MoM growth'
  },
  'users_10k+': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.6,
    description: '10K+ active users'
  },
  'tier2_investor': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.7,
    description: 'Backed by known VC (non-tier1)'
  },
  'demo_available': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.5,
    description: 'Working demo/beta available'
  },
  'team_good_companies': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.6,
    description: 'Team from respected companies'
  },
  'stanford_mit_berkeley': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.5,
    description: 'Founder from top university'
  },
  'paying_customers_10+': {
    tier: 'silver',
    confidence: 'medium',
    weight: 0.6,
    description: '10+ paying customers'
  },

  // ============ BRONZE TIER SIGNALS ============
  'has_revenue_unspecified': {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.3,
    description: 'Mentions revenue but no amount'
  },
  'has_users_unspecified': {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.25,
    description: 'Mentions users but no count'
  },
  'market_size_claim': {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.2,
    description: 'Self-reported TAM'
  },
  'press_mention': {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.3,
    description: 'Mentioned in press'
  },
  'partnership_claimed': {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.25,
    description: 'Unverified partnership'
  },
  'growth_5_percent_mom': {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.3,
    description: '5%+ MoM growth (self-reported)'
  },
  'users_100+': {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.2,
    description: '100+ users (unverified)'
  },

  // ============ NOISE SIGNALS ============
  'website_exists': {
    tier: 'noise',
    confidence: 'low',
    weight: 0.0,
    description: 'Has a website (table stakes)'
  },
  'buzzword_ai_ml': {
    tier: 'noise',
    confidence: 'low',
    weight: 0.0,
    description: 'Mentions AI/ML (marketing)'
  },
  'social_media_presence': {
    tier: 'noise',
    confidence: 'low',
    weight: 0.0,
    description: 'Has Twitter/LinkedIn'
  },
  'pitch_deck_exists': {
    tier: 'noise',
    confidence: 'low',
    weight: 0.05,
    description: 'Has pitch deck (basic)'
  },
  'founded_date': {
    tier: 'noise',
    confidence: 'low',
    weight: 0.05,
    description: 'Company incorporation date'
  },
  'logo_uploaded': {
    tier: 'noise',
    confidence: 'low',
    weight: 0.0,
    description: 'Has logo (cosmetic)'
  }
};

/**
 * Calculate weighted score for a signal
 */
export function getSignalWeight(signalType: string, rawValue: number = 1): number {
  const classification = SIGNAL_CLASSIFICATIONS[signalType];
  if (!classification) {
    // Unknown signal - treat as bronze tier
    return rawValue * 0.3;
  }
  
  return rawValue * classification.weight;
}

/**
 * Classify a signal into tier
 */
export function classifySignal(
  signalType: string,
  value?: number | string | boolean
): SignalClassification {
  // Check if we have a predefined classification
  if (SIGNAL_CLASSIFICATIONS[signalType]) {
    return SIGNAL_CLASSIFICATIONS[signalType];
  }
  
  // Infer tier from signal characteristics
  // Revenue signals
  if (signalType.includes('revenue') || signalType.includes('arr') || signalType.includes('mrr')) {
    if (typeof value === 'number') {
      if (value >= 1000000) return SIGNAL_CLASSIFICATIONS['confirmed_revenue_1m+'];
      if (value >= 100000) return SIGNAL_CLASSIFICATIONS['confirmed_revenue_100k+'];
      if (value >= 10000) return SIGNAL_CLASSIFICATIONS['confirmed_revenue_10k+'];
    }
    return SIGNAL_CLASSIFICATIONS['has_revenue_unspecified'];
  }
  
  // Growth signals
  if (signalType.includes('growth')) {
    if (typeof value === 'number') {
      if (value >= 30) return SIGNAL_CLASSIFICATIONS['growth_30_percent_mom'];
      if (value >= 15) return SIGNAL_CLASSIFICATIONS['growth_15_percent_mom'];
      if (value >= 5) return SIGNAL_CLASSIFICATIONS['growth_5_percent_mom'];
    }
  }
  
  // User signals
  if (signalType.includes('users') || signalType.includes('active_users')) {
    if (typeof value === 'number') {
      if (value >= 10000) return SIGNAL_CLASSIFICATIONS['users_10k+'];
      if (value >= 100) return SIGNAL_CLASSIFICATIONS['users_100+'];
    }
    return SIGNAL_CLASSIFICATIONS['has_users_unspecified'];
  }
  
  // Default: treat as bronze tier
  return {
    tier: 'bronze',
    confidence: 'low',
    weight: 0.3,
    description: 'Unknown signal type'
  };
}

/**
 * Get aggregate weight for multiple signals of the same type
 * Uses diminishing returns - 5 bronze signals != 1 gold signal
 */
export function aggregateSignalWeights(weights: number[]): number {
  if (weights.length === 0) return 0;
  if (weights.length === 1) return weights[0];
  
  // Sort descending
  const sorted = [...weights].sort((a, b) => b - a);
  
  // First signal: full weight
  // Second signal: 50% weight
  // Third signal: 25% weight
  // Fourth+: 10% weight each
  let total = sorted[0];
  if (sorted.length > 1) total += sorted[1] * 0.5;
  if (sorted.length > 2) total += sorted[2] * 0.25;
  for (let i = 3; i < sorted.length; i++) {
    total += sorted[i] * 0.1;
  }
  
  return total;
}

/**
 * Summary stats for signal quality
 */
export function analyzeSignalQuality(signals: Array<{type: string, value?: any}>): {
  goldCount: number;
  silverCount: number;
  bronzeCount: number;
  noiseCount: number;
  avgWeight: number;
  qualityScore: number; // 0-100
} {
  const classifications = signals.map(s => classifySignal(s.type, s.value));
  
  const goldCount = classifications.filter(c => c.tier === 'gold').length;
  const silverCount = classifications.filter(c => c.tier === 'silver').length;
  const bronzeCount = classifications.filter(c => c.tier === 'bronze').length;
  const noiseCount = classifications.filter(c => c.tier === 'noise').length;
  
  const totalWeight = classifications.reduce((sum, c) => sum + c.weight, 0);
  const avgWeight = signals.length > 0 ? totalWeight / signals.length : 0;
  
  // Quality score: weighted by tier
  // Gold = 10 points, Silver = 5, Bronze = 2, Noise = 0
  const qualityScore = Math.min(100, (
    goldCount * 10 +
    silverCount * 5 +
    bronzeCount * 2
  ));
  
  return {
    goldCount,
    silverCount,
    bronzeCount,
    noiseCount,
    avgWeight,
    qualityScore
  };
}
