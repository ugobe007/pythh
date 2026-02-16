/**
 * INVESTOR SCORING SERVICE - THE VC GOD ALGORITHM v2
 * ====================================================
 * Evaluates investors/VCs based on quality metrics.
 * Scores 0-10 where 10 = highest quality investor.
 * 
 * v2 REBALANCE: Weights aligned to data we ACTUALLY HAVE:
 *   - 78% have: check_size, bio, sectors
 *   - 98% have: stage
 *   - 100% have: leads_rounds, type
 *   - 38% have: investment_thesis
 *   - 8% have: total_investments (bonus)
 *   - 9% have: active_fund_size (bonus)
 * 
 * Scoring Dimensions (0-10 total):
 *   Profile Completeness (0-3): Data quality signals seriousness
 *   Investment Focus     (0-3): Clear thesis, focused sectors, stage clarity
 *   Capital Readiness    (0-2): Check size defined, fund size, leads rounds
 *   Track Record         (0-2): Investments, exits (bonus when available)
 */

interface InvestorProfile {
  // Identity
  id?: string;
  name?: string;
  firm?: string;
  title?: string;
  
  // Track Record
  total_investments?: number;
  successful_exits?: number;
  unicorns?: number;
  portfolio_companies?: string[];
  notable_investments?: any[];
  
  // Fund Health
  active_fund_size?: number;
  dry_powder_estimate?: number;
  investment_pace_per_year?: number;
  last_investment_date?: string | Date;
  
  // Investment Style
  leads_rounds?: boolean;
  follows_rounds?: boolean;
  typical_ownership_pct?: number;
  check_size_min?: number;
  check_size_max?: number;
  
  // Focus & Expertise
  stage?: string[];
  sectors?: string[];
  geography_focus?: string[];
  investment_thesis?: string;
  
  // Responsiveness & Access
  avg_response_time_days?: number;
  preferred_intro_method?: string;
  decision_maker?: boolean;
  board_seats?: number;
  
  // Social Proof
  linkedin_url?: string;
  twitter_url?: string;
  bio?: string;
  is_verified?: boolean;
}

interface InvestorScore {
  total: number; // 0-10 scale
  percentile: number; // 0-100 percentile among all VCs
  breakdown: {
    profile_completeness: number; // 0-3: Data quality
    investment_focus: number;     // 0-3: Thesis, sectors, stage
    capital_readiness: number;    // 0-2: Check size, fund, leads
    track_record: number;         // 0-2: Investments, exits (bonus)
  };
  tier: 'elite' | 'strong' | 'solid' | 'emerging';
  signals: string[];
  matchMultiplier: number; // 1.0-2.0x bonus for match scoring
}

/**
 * Main scoring function - evaluates investor quality
 * v2: Rebalanced to score based on data we actually have
 */
export function calculateInvestorScore(investor: InvestorProfile): InvestorScore {
  const signals: string[] = [];
  
  // ============================================
  // PROFILE COMPLETENESS (0-3 points)
  // Reward investors who provide rich data
  // ============================================
  let profileScore = 0;
  
  // Has bio (0-0.8)
  const bio = investor.bio || '';
  if (bio.length > 200) {
    profileScore += 0.8;
    signals.push('Detailed bio');
  } else if (bio.length > 50) {
    profileScore += 0.5;
    signals.push('Has bio');
  } else if (bio.length > 0) {
    profileScore += 0.2;
  }
  
  // Has name + firm (0-0.4)
  if (investor.name && investor.firm) {
    profileScore += 0.4;
  } else if (investor.name || investor.firm) {
    profileScore += 0.2;
  }
  
  // Has geography focus (0-0.5)
  const geos = investor.geography_focus || [];
  if (geos.length >= 1) {
    profileScore += 0.5;
    signals.push(`Geography: ${geos.slice(0, 2).join(', ')}`);
  }
  
  // Has investment thesis (0-0.8)
  const thesis = investor.investment_thesis || '';
  if (thesis.length > 200) {
    profileScore += 0.8;
    signals.push('Deep investment thesis');
  } else if (thesis.length > 50) {
    profileScore += 0.5;
    signals.push('Has investment thesis');
  } else if (thesis.length > 0) {
    profileScore += 0.2;
  }
  
  // Social proof / contact info (0-0.5)
  let socialCount = 0;
  if (investor.linkedin_url) socialCount++;
  if (investor.twitter_url) socialCount++;
  if (investor.is_verified) socialCount++;
  profileScore += Math.min(socialCount * 0.25, 0.5);
  
  profileScore = Math.min(profileScore, 3);
  
  // ============================================
  // INVESTMENT FOCUS (0-3 points)
  // Clear thesis + focused sectors = better matches
  // ============================================
  let focusScore = 0;
  
  // Sector focus depth (0-1.2)
  const sectors = investor.sectors || [];
  if (sectors.length >= 1 && sectors.length <= 3) {
    focusScore += 1.2;
    signals.push(`Focused expertise: ${sectors.slice(0, 3).join(', ')}`);
  } else if (sectors.length <= 6) {
    focusScore += 0.9;
    signals.push('Multi-sector investor');
  } else if (sectors.length > 6) {
    focusScore += 0.5;
    signals.push('Generalist investor');
  }
  
  // Stage clarity (0-1.0)
  const stages = investor.stage || [];
  if (stages.length >= 1 && stages.length <= 2) {
    focusScore += 1.0;
    signals.push(`Stage focus: ${stages.join(', ')}`);
  } else if (stages.length <= 4) {
    focusScore += 0.7;
    signals.push('Multi-stage investor');
  } else if (stages.length > 0) {
    focusScore += 0.4;
    signals.push('All-stage investor');
  }
  
  // Type specificity bonus (0-0.8)
  const invType = (investor as any).type || '';
  if (invType === 'VC' || invType === 'vc') {
    focusScore += 0.6;
    signals.push('Venture Capital firm');
  } else if (invType === 'Angel' || invType === 'angel') {
    focusScore += 0.5;
    signals.push('Angel investor');
  } else if (invType === 'PE' || invType === 'CVC' || invType === 'Family Office') {
    focusScore += 0.4;
  } else if (invType) {
    focusScore += 0.3;
  }
  
  focusScore = Math.min(focusScore, 3);
  
  // ============================================
  // CAPITAL READINESS (0-2 points)
  // Can they actually write a check?
  // ============================================
  let capitalScore = 0;
  
  // Check size defined (0-0.8) — 78% have this
  const minCheck = investor.check_size_min || 0;
  const maxCheck = investor.check_size_max || 0;
  if (minCheck > 0 && maxCheck > 0) {
    capitalScore += 0.8;
    signals.push(`Check: $${formatAmount(minCheck)}-$${formatAmount(maxCheck)}`);
  } else if (minCheck > 0 || maxCheck > 0) {
    capitalScore += 0.4;
  }
  
  // Fund size (0-0.7)
  const fundSize = investor.active_fund_size || 0;
  if (fundSize >= 500_000_000) {
    capitalScore += 0.7;
    signals.push('Large fund: $500M+');
  } else if (fundSize >= 100_000_000) {
    capitalScore += 0.6;
    signals.push('Mid-size fund: $100M+');
  } else if (fundSize >= 20_000_000) {
    capitalScore += 0.4;
    signals.push('Fund: $20M+');
  } else if (fundSize > 0) {
    capitalScore += 0.2;
  }
  
  // Leads rounds (0-0.5)
  if (investor.leads_rounds) {
    capitalScore += 0.5;
    signals.push('Leads rounds');
  } else if (investor.follows_rounds) {
    capitalScore += 0.2;
    signals.push('Follows rounds');
  }
  
  capitalScore = Math.min(capitalScore, 2);
  
  // ============================================
  // TRACK RECORD (0-2 points) — bonus dimension
  // Only 8% have this data, so it's additive not gating
  // ============================================
  let trackScore = 0;
  
  const investments = investor.total_investments || 0;
  if (investments >= 100) {
    trackScore += 1.0;
    signals.push('Highly experienced: 100+ investments');
  } else if (investments >= 50) {
    trackScore += 0.8;
    signals.push('Experienced: 50+ investments');
  } else if (investments >= 20) {
    trackScore += 0.6;
    signals.push('Active investor: 20+ investments');
  } else if (investments >= 5) {
    trackScore += 0.3;
    signals.push('Established: 5+ investments');
  }
  
  const exits = investor.successful_exits || 0;
  if (exits >= 10) {
    trackScore += 1.0;
    signals.push('Strong exits: 10+');
  } else if (exits >= 5) {
    trackScore += 0.6;
    signals.push('Solid exits: 5+');
  } else if (exits >= 1) {
    trackScore += 0.3;
    signals.push('Has exits');
  }
  
  trackScore = Math.min(trackScore, 2);
  
  // ============================================
  // CALCULATE TOTAL & TIER
  // ============================================
  const total = Math.min(
    profileScore + focusScore + capitalScore + trackScore,
    10
  );
  
  // Tier thresholds — recalibrated for v2 distribution
  // Expected: ~15% emerging, ~40% solid, ~35% strong, ~10% elite
  let tier: 'elite' | 'strong' | 'solid' | 'emerging';
  if (total >= 7) {
    tier = 'elite';
  } else if (total >= 5) {
    tier = 'strong';
  } else if (total >= 3) {
    tier = 'solid';
  } else {
    tier = 'emerging';
  }
  
  // Match multiplier: 1.0-2.0x
  const matchMultiplier = 1 + (total / 10);
  
  return {
    total: Math.round(total * 10) / 10,
    percentile: Math.round(total * 10),
    breakdown: {
      profile_completeness: Math.round(profileScore * 10) / 10,
      investment_focus: Math.round(focusScore * 10) / 10,
      capital_readiness: Math.round(capitalScore * 10) / 10,
      track_record: Math.round(trackScore * 10) / 10,
    },
    tier,
    signals,
    matchMultiplier: Math.round(matchMultiplier * 100) / 100,
  };
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(0) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
}

/**
 * Calculate fit score between startup and investor
 * Takes into account both investor quality AND startup-investor fit
 */
export function calculateStartupInvestorFit(
  startupProfile: any,
  investorProfile: InvestorProfile,
  verbose: boolean = false
): { fitScore: number; reasons: string[] } {
  const reasons: string[] = [];
  let fitScore = 0;
  
  // Stage alignment (0-25 points)
  const startupStage = normalizeStage(startupProfile.stage);
  const investorStages = (investorProfile.stage || []).map(s => normalizeStage(s));
  
  if (investorStages.includes(startupStage)) {
    fitScore += 25;
    reasons.push(`Stage match: ${startupStage}`);
  } else if (investorStages.some(s => isAdjacentStage(s, startupStage))) {
    fitScore += 15;
    reasons.push('Adjacent stage fit');
  }
  
  // Sector alignment (0-25 points)
  const startupSectors = normalizeSectors(startupProfile.sectors || startupProfile.industries || []);
  const investorSectors = normalizeSectors(investorProfile.sectors || []);
  
  const sectorOverlap = startupSectors.filter(s => 
    investorSectors.some(is => s.includes(is) || is.includes(s))
  );
  
  if (sectorOverlap.length >= 2) {
    fitScore += 25;
    reasons.push(`Strong sector alignment: ${sectorOverlap.slice(0, 2).join(', ')}`);
  } else if (sectorOverlap.length === 1) {
    fitScore += 18;
    reasons.push(`Sector match: ${sectorOverlap[0]}`);
  }
  
  // Check size alignment (0-20 points)
  const raiseAmount = parseRaiseAmount(startupProfile.raise || startupProfile.raise_amount);
  const minCheck = investorProfile.check_size_min || 0;
  const maxCheck = investorProfile.check_size_max || Infinity;
  
  if (raiseAmount >= minCheck && raiseAmount <= maxCheck) {
    fitScore += 20;
    reasons.push('Check size fits perfectly');
  } else if (raiseAmount >= minCheck * 0.5 && raiseAmount <= maxCheck * 1.5) {
    fitScore += 10;
    reasons.push('Check size close to range');
  }
  
  // Geography alignment (0-5 points) - Reduced importance: modern VCs invest globally
  const startupGeo = normalizeGeography(startupProfile.location || startupProfile.geography);
  const investorGeos = (investorProfile.geography_focus || []).map(g => normalizeGeography(g));
  
  if (investorGeos.length === 0 || investorGeos.includes('global')) {
    fitScore += 5;  // Small bonus for global investors
    reasons.push('Global investor - geography flexible');
  } else if (investorGeos.includes(startupGeo)) {
    fitScore += 5;  // Small bonus for exact match
    reasons.push(`Geography match: ${startupGeo}`);
  } else if (investorGeos.some(g => g.includes('us') && startupGeo.includes('us'))) {
    fitScore += 3;  // Very small bonus for regional match
    reasons.push('US-based investor');
  }
  // No penalty for geography mismatch - modern VC is global
  
  // Lead investor fit (0-15 points)
  if (investorProfile.leads_rounds && startupProfile.seeking_lead) {
    fitScore += 15;
    reasons.push('Can lead round - important for new rounds');
  } else if (investorProfile.leads_rounds) {
    fitScore += 10;
    reasons.push('Lead investor capability');
  } else if (investorProfile.follows_rounds) {
    fitScore += 5;
    reasons.push('Follows rounds - good for syndicate');
  }
  
  if (verbose) {
    console.log(`\n🎯 Fit Analysis: ${startupProfile.name} ↔ ${investorProfile.name || investorProfile.firm}`);
    console.log(`   Fit Score: ${fitScore}/100`);
    reasons.forEach(r => console.log(`   • ${r}`));
  }
  
  return { fitScore: Math.min(fitScore, 100), reasons };
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeStage(stage: any): string {
  if (!stage) return 'seed';
  const s = String(stage).toLowerCase().replace(/[^a-z0-9]/g, '');
  
  if (s.includes('preseed') || s.includes('pre')) return 'pre-seed';
  if (s.includes('seed')) return 'seed';
  if (s.includes('seriesa') || s === 'a') return 'series-a';
  if (s.includes('seriesb') || s === 'b') return 'series-b';
  if (s.includes('seriesc') || s === 'c') return 'series-c';
  if (s.includes('growth') || s.includes('late')) return 'growth';
  
  return 'seed';
}

function isAdjacentStage(investorStage: string, startupStage: string): boolean {
  const stageOrder = ['pre-seed', 'seed', 'series-a', 'series-b', 'series-c', 'growth'];
  const investorIdx = stageOrder.indexOf(investorStage);
  const startupIdx = stageOrder.indexOf(startupStage);
  
  return Math.abs(investorIdx - startupIdx) <= 1;
}

function normalizeSectors(sectors: any[]): string[] {
  if (!Array.isArray(sectors)) return [];
  return sectors.map(s => String(s).toLowerCase().replace(/[^a-z0-9]/g, ''));
}

function normalizeGeography(geo: any): string {
  if (!geo) return 'global';
  const g = String(geo).toLowerCase();
  
  if (g.includes('sf') || g.includes('bay') || g.includes('silicon')) return 'sf-bay-area';
  if (g.includes('ny') || g.includes('new york')) return 'nyc';
  if (g.includes('us') || g.includes('united states') || g.includes('america')) return 'us';
  if (g.includes('europe') || g.includes('eu')) return 'europe';
  if (g.includes('asia')) return 'asia';
  if (g.includes('global') || g.includes('worldwide')) return 'global';
  
  return g;
}

function parseRaiseAmount(raise: any): number {
  if (typeof raise === 'number') return raise;
  if (!raise) return 0;
  
  const str = String(raise).toLowerCase();
  const match = str.match(/[\d.]+/);
  if (!match) return 0;
  
  let amount = parseFloat(match[0]);
  
  if (str.includes('m')) amount *= 1000000;
  else if (str.includes('k')) amount *= 1000;
  else if (str.includes('b')) amount *= 1000000000;
  
  return amount;
}

// Export all functions
export default {
  calculateInvestorScore,
  calculateStartupInvestorFit,
};
