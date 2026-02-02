/**
 * ⛔ DEPRECATED - DO NOT USE IN GOD SCORING
 * ============================================
 * 
 * This file was created by AI copilot WITHOUT admin approval (Dec 27, 2025).
 * It was incorrectly injected into GOD scoring as a component.
 * 
 * CORRECT USAGE: This logic should be part of SIGNAL dimensions, not GOD.
 * The Signal Application Service already handles execution_velocity.
 * 
 * This file is kept for reference but should NOT be imported into:
 *   - startupScoringService.ts
 *   - recalculate-scores.ts
 *   - Any GOD scoring calculation
 * 
 * See: GOD_SCORING_AUDIT_JAN_2026.md for full details.
 * 
 * ORIGINAL DESCRIPTION:
 * Measures founder execution speed - a leading indicator of success.
 * Key insight: Solo founders with AI leverage are shipping faster than ever.
 * Speed to market + iteration velocity predicts success better than team size.
 */

interface VelocityProfile {
  founded_date?: string | Date;
  launched?: boolean;
  is_launched?: boolean;
  launch_date?: string | Date;
  team_size?: number;
  founders_count?: number;
  has_demo?: boolean;
  demo_available?: boolean;
  mrr?: number;
  revenue?: number;
  funding_amount?: number;
  tagline?: string;
  pitch?: string;
  description?: string;
}

interface VelocityResult {
  score: number;  // 0-1.5
  breakdown: {
    launchSpeed: number;
    soloLeverage: number;
    tractionVelocity: number;
    aiNativeSignals: number;
  };
  signals: string[];
}

/**
 * Calculate velocity score (0-1.5 points)
 * 
 * Components:
 * - Launch speed: How fast from founding to launch (0-0.5)
 * - Solo leverage: Small team + high output (0-0.4)
 * - Traction velocity: Revenue/users with minimal time (0-0.3)
 * - AI-native signals: Evidence of AI-powered building (0-0.3)
 */
export function scoreVelocity(profile: VelocityProfile): VelocityResult {
  const signals: string[] = [];
  let launchSpeed = 0;
  let soloLeverage = 0;
  let tractionVelocity = 0;
  let aiNativeSignals = 0;
  
  // Combine text for pattern matching
  const allText = [
    profile.tagline || '',
    profile.pitch || '',
    profile.description || ''
  ].join(' ').toLowerCase();
  
  // ==========================================================================
  // 1. LAUNCH SPEED (0-0.5 points)
  // ==========================================================================
  const isLaunched = profile.launched || profile.is_launched || 
                     profile.has_demo || profile.demo_available;
  
  if (isLaunched && profile.founded_date) {
    const foundedDate = new Date(profile.founded_date);
    const now = new Date();
    const monthsSinceFounded = (now.getTime() - foundedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsSinceFounded <= 3) {
      launchSpeed = 0.5;
      signals.push('Launched within 3 months of founding');
    } else if (monthsSinceFounded <= 6) {
      launchSpeed = 0.4;
      signals.push('Launched within 6 months');
    } else if (monthsSinceFounded <= 12) {
      launchSpeed = 0.25;
      signals.push('Launched within 1 year');
    } else {
      launchSpeed = 0.1;
    }
  } else if (isLaunched) {
    // Launched but no founded date - give partial credit
    launchSpeed = 0.2;
    signals.push('Product launched');
  }
  
  // ==========================================================================
  // 2. SOLO LEVERAGE (0-0.4 points)
  // ==========================================================================
  // Small team + evidence of output = AI-powered velocity
  const teamSize = profile.team_size || profile.founders_count || 1;
  const hasRevenue = (profile.mrr && profile.mrr > 0) || (profile.revenue && profile.revenue > 0);
  const hasTraction = hasRevenue || isLaunched;
  
  if (teamSize === 1 && hasTraction) {
    soloLeverage = 0.4;
    signals.push('Solo founder with traction (AI leverage)');
  } else if (teamSize <= 2 && hasTraction) {
    soloLeverage = 0.3;
    signals.push('Tiny team (<=2) with traction');
  } else if (teamSize <= 5 && hasRevenue) {
    soloLeverage = 0.2;
    signals.push('Small team with revenue');
  } else if (teamSize <= 3) {
    soloLeverage = 0.1;
    signals.push('Lean team');
  }
  
  // ==========================================================================
  // 3. TRACTION VELOCITY (0-0.3 points)
  // ==========================================================================
  // Revenue achieved quickly = strong signal
  if (hasRevenue && profile.founded_date) {
    const foundedDate = new Date(profile.founded_date);
    const now = new Date();
    const monthsSinceFounded = (now.getTime() - foundedDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    
    if (monthsSinceFounded <= 6 && hasRevenue) {
      tractionVelocity = 0.3;
      signals.push('Revenue within 6 months');
    } else if (monthsSinceFounded <= 12 && hasRevenue) {
      tractionVelocity = 0.2;
      signals.push('Revenue within 1 year');
    } else if (hasRevenue) {
      tractionVelocity = 0.1;
    }
  } else if (hasRevenue) {
    tractionVelocity = 0.15;
  }
  
  // Bootstrapped bonus - revenue without significant funding
  const fundingAmount = profile.funding_amount || 0;
  if (hasRevenue && fundingAmount < 100000) {
    tractionVelocity += 0.1;
    signals.push('Bootstrapped with revenue');
  }
  
  // ==========================================================================
  // 4. AI-NATIVE SIGNALS (0-0.3 points)
  // ==========================================================================
  const aiNativePatterns = [
    /\b(built with ai|ai-powered|ai-native|using ai|ai tools)/i,
    /\b(cursor|v0|replit|bolt|lovable|windsurf)/i,
    /\b(no-code|low-code|rapid prototyp)/i,
    /\b(shipped|launched|built)\s+(in|within)\s+\d+\s*(day|week|hour)/i,
    /\b(solo|indie|bootstrapped|self-funded)/i,
    /\b(mvp|prototype|beta)\s+(in|within)\s+\d+/i
  ];
  
  const aiMatches = aiNativePatterns.filter(p => p.test(allText)).length;
  
  if (aiMatches >= 3) {
    aiNativeSignals = 0.3;
    signals.push('Strong AI-native building signals');
  } else if (aiMatches >= 2) {
    aiNativeSignals = 0.2;
    signals.push('AI-native building patterns');
  } else if (aiMatches >= 1) {
    aiNativeSignals = 0.1;
    signals.push('Some AI-native indicators');
  }
  
  // ==========================================================================
  // TOTAL
  // ==========================================================================
  const score = Math.min(launchSpeed + soloLeverage + tractionVelocity + aiNativeSignals, 2.0);
  
  return {
    score,
    breakdown: {
      launchSpeed,
      soloLeverage,
      tractionVelocity,
      aiNativeSignals
    },
    signals
  };
}

export default { scoreVelocity };
