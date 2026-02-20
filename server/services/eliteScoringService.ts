/**
 * Tiered Elite Scoring Service
 * ============================================================================
 * 
 * "Just like in school, not everyone is an A student. We cannot be handing out
 *  A's to all the students, only the students who deserve it."
 * 
 * This service implements a quality multiplier that rewards startups demonstrating
 * excellence across multiple dimensions. It takes the intermediate GOD score
 * (after all additive bonuses) and applies a multiplicative boost for truly
 * exceptional startups, creating natural separation in the 70-95+ range.
 * 
 * ============================================================================
 * TIER SYSTEM (GPA-inspired)
 * ============================================================================
 * 
 * | Tier      | Score Range | Multiplier | Description                        |
 * |-----------|------------|------------|-------------------------------------|
 * | Freshman  | 40-49      | 1.00x      | No boost — prove yourself first     |
 * | Sophomore | 50-59      | 1.00x      | No boost — still building credibility|
 * | Junior    | 60-69      | 1.05x      | Small boost if fundamentals shine   |
 * | Senior    | 70-79      | 1.10x      | Strong boost for high performers    |
 * | Dean's    | 80-89      | 1.15x      | Significant boost for elite players |
 * | PhD       | 90-100     | 1.18x      | Maximum recognition, approach 100   |
 * 
 * The multiplier is NOT automatic — it requires evidence across multiple
 * "excellence dimensions". A high-scoring startup with weak fundamentals
 * gets no boost. This prevents inflation while rewarding genuine quality.
 * 
 * ============================================================================
 * EXCELLENCE DIMENSIONS (what makes an "A student")
 * ============================================================================
 * 
 * 1. TRACTION EXCELLENCE (0-2 pts)
 *    Real revenue, real customers, real growth. Not just "we have users."
 *    - MRR > $10K or ARR > $100K: +1.0
 *    - Customer count > 50 or active users > 1000: +0.5
 *    - Growth rate > 20% monthly: +0.5
 * 
 * 2. TEAM PEDIGREE (0-2 pts)
 *    Founders who've been there before. Track record matters.
 *    - FAANG/top-tier company background: +0.8
 *    - Serial founders: +0.6
 *    - Elite school (Stanford/MIT/Harvard): +0.3
 *    - Technical co-founder: +0.3
 * 
 * 3. INVESTOR VALIDATION (0-2 pts)
 *    Smart money doesn't chase bad bets.
 *    - Tier 1 VC backing (YC, Sequoia, a16z, etc.): +1.0
 *    - Tier 2 VC or notable angels: +0.5
 *    - Multiple institutional investors: +0.5
 * 
 * 4. PRODUCT MATURITY (0-2 pts)
 *    Shipped product with real traction signals.
 *    - Launched product: +0.5
 *    - Demo available: +0.3
 *    - Strong value proposition clarity: +0.4
 *    - Multiple sectors/verticals: +0.3
 *    - Unique IP / defensibility: +0.5
 * 
 * 5. DATA COMPLETENESS (0-2 pts)
 *    How much do we actually know? More data = more confidence.
 *    - Has problem + solution: +0.4
 *    - Has pitch/description > 200 chars: +0.3
 *    - Has team info: +0.3
 *    - Has financial data (MRR/ARR/funding): +0.5
 *    - Has market/sector classification: +0.3
 *    - Website present: +0.2
 * 
 * MINIMUM REQUIREMENT: Must score >= 3.0 excellence points (out of 10 max)
 *   to receive ANY boost. This ensures only well-evidenced startups benefit.
 *   At 3.0, the boost is mild. At 6+, it's significant.
 * 
 * ============================================================================
 * BOOST CALCULATION
 * ============================================================================
 * 
 * excellenceScore = sum of all dimension points (0-10)
 * 
 * if excellenceScore < 3.0: boost = 0 (no boost, not enough evidence)
 * 
 * Boost formula (for scores 60+):
 *   baseMultiplier = lookupTierMultiplier(intermediateScore)
 *   excellenceRatio = (excellenceScore - 3.0) / 7.0  // 0.0 to 1.0
 *   effectiveMultiplier = 1.0 + (baseMultiplier - 1.0) * excellenceRatio
 *   boost = intermediateScore * (effectiveMultiplier - 1.0)
 * 
 * This means:
 *   - A 65-score startup with 5.0 excellence → 65 * 1.029 = ~66.9 (+1.9)
 *   - A 72-score startup with 7.0 excellence → 72 * 1.071 = ~77.1 (+5.1)
 *   - A 75-score startup with 9.0 excellence → 75 * 1.100 = ~82.5 (+7.5)
 *   - A 78-score startup with 10.0 excellence → 78 * 1.100 = ~85.8 (+7.8)
 *   - A 82-score startup with 8.0 excellence → 82 * 1.107 = ~90.8 (+8.8)
 *   - A 85-score startup with 10.0 excellence → 85 * 1.150 = ~97.8 (+12.8)
 *   - A 92-score startup with 10.0 excellence → 92 * 1.180 = ~108.6 → capped at 100
 * 
 * Maximum possible boost: ~18 points (for a 92+ startup with perfect excellence)
 * This enables the top 3-5% to break into 80-95 range and the very best to reach 100.
 * 
 * ============================================================================
 */

// ── Tier 1 investors (smart money) ──
const TIER1_INVESTORS = [
  'y combinator', 'yc', 'sequoia', 'a16z', 'andreessen horowitz', 'founders fund',
  'benchmark', 'greylock', 'accel', 'kleiner perkins', 'lightspeed', 'index ventures',
  'general catalyst', 'bessemer', 'insight partners', 'tiger global', 'coatue',
  'ribbit capital', 'paradigm', 'thrive capital', 'lux capital', 'first round',
  'khosla ventures', 'redpoint', 'spark capital', 'union square', 'craft ventures',
  'softbank', 'dragoneer', 'flagship pioneering', 'nea', 'ivp', 'felicis',
  'initialized capital', 'slow ventures', 'floodgate', 'sv angel', 'techstars', '500 startups',
  'foundry group', 'matrix partners', 'battery ventures', 'dfw capital'
];

const TIER2_INVESTORS = [
  'seedcamp', 'plug and play', 'antler', 'entrepreneur first', 'ef',
  'soma capital', 'hustle fund', 'precursor', 'backstage capital',
  'village global', 'pioneer fund', 'betaworks'
];

const ROCKSTAR_COMPANIES = [
  'google', 'meta', 'facebook', 'apple', 'amazon', 'microsoft', 'tesla', 'spacex',
  'openai', 'stripe', 'airbnb', 'uber', 'netflix', 'palantir', 'coinbase',
  'databricks', 'snowflake', 'figma', 'notion', 'vercel', 'anthropic',
  'linkedin', 'twitter', 'x.com', 'salesforce', 'oracle', 'intel', 'nvidia',
  'doordash', 'instacart', 'robinhood', 'plaid', 'square', 'block'
];

const ELITE_SCHOOLS = [
  'stanford', 'mit', 'harvard', 'yale', 'princeton', 'caltech', 'carnegie mellon',
  'berkeley', 'oxford', 'cambridge', 'wharton', 'columbia', 'cornell', 'upenn',
  'georgia tech', 'university of waterloo', 'eth zurich', 'imperial college'
];

// ── Tier multiplier table ──
// RECALIBRATED (Feb 19, 2026 v2): Increased multipliers for proper Elite separation (ADMIN APPROVED)
// Reason: 1.05x was too conservative - only 1% reached Elite tier, compressed at 80-86 range.
// New multipliers create natural 80-95+ distribution for exceptional startups with evidence.
// At 1.10-1.15x: a 72 with perfect excellence → 79, a 78 → 86, an 82 → 94.
const TIER_MULTIPLIERS: { min: number; max: number; multiplier: number }[] = [
  { min: 0,  max: 59, multiplier: 1.00 },  // No boost for Freshman/Sophomore
  { min: 60, max: 69, multiplier: 1.05 },  // Junior: +3 to +3.5 pts
  { min: 70, max: 79, multiplier: 1.10 },  // Senior: +7 to +7.9 pts (lifts strong → excellent)
  { min: 80, max: 89, multiplier: 1.15 },  // Dean's List: +12 to +13.3 pts (elite range)
  { min: 90, max: 100, multiplier: 1.18 }, // PhD: +16.2 to +18 pts (approach 100)
];

function getTierMultiplier(score: number): number {
  for (const tier of TIER_MULTIPLIERS) {
    if (score >= tier.min && score <= tier.max) return tier.multiplier;
  }
  return 1.0;
}

export interface EliteBoostResult {
  boost: number;  // Points to add
  excellenceScore: number;  // 0-10
  multiplier: number; // Effective multiplier applied
  dimensions: {
    traction: number;     // 0-2
    team: number;         // 0-2
    investors: number;    // 0-2
    product: number;      // 0-2
    dataCompleteness: number; // 0-2
  };
  tier: string;  // Descriptive tier name
  applied: boolean;  // Whether any boost was applied
}

/**
 * Calculate the tiered elite scoring boost.
 * 
 * @param startup - The startup object (from DB row)
 * @param intermediateScore - The score BEFORE this boost (GOD + bootstrap + signals + momentum + AP)
 * @returns EliteBoostResult with the points to add
 */
export function calculateEliteBoost(startup: any, intermediateScore: number): EliteBoostResult {
  const extracted = startup.extracted_data || {};
  
  // ═══════════════════════════════════════
  // DIMENSION 1: TRACTION EXCELLENCE (0-2)
  // ═══════════════════════════════════════
  let tractionPts = 0;
  
  const mrr = startup.mrr || extracted.mrr || 0;
  const arr = startup.arr || startup.revenue || extracted.arr || extracted.revenue || 0;
  const customers = startup.customer_count || extracted.customers || extracted.customer_count || 0;
  const activeUsers = extracted.active_users || extracted.users || 0;
  const growthRate = startup.growth_rate_monthly || extracted.growth_rate || extracted.growth_rate_monthly || 0;
  
  // Revenue evidence
  if (mrr > 10000 || arr > 100000) tractionPts += 1.0;
  else if (mrr > 1000 || arr > 10000) tractionPts += 0.5;
  else if (mrr > 0 || arr > 0 || extracted.has_revenue) tractionPts += 0.2;
  
  // Customer evidence
  if (customers > 50 || activeUsers > 1000) tractionPts += 0.5;
  else if (customers > 10 || activeUsers > 100 || extracted.has_customers) tractionPts += 0.2;
  
  // Growth evidence
  if (growthRate > 20) tractionPts += 0.5;
  else if (growthRate > 10) tractionPts += 0.3;
  else if (growthRate > 0) tractionPts += 0.1;
  
  tractionPts = Math.min(tractionPts, 2.0);
  
  // ═══════════════════════════════════════
  // DIMENSION 2: TEAM PEDIGREE (0-2)
  // ═══════════════════════════════════════
  let teamPts = 0;
  
  const teamCompanies = startup.team_companies || extracted.team_companies || [];
  const teamText = [
    ...(Array.isArray(teamCompanies) ? teamCompanies : []),
    startup.team || '',
    extracted.team_signals?.join(' ') || '',
    startup.description || '',
  ].join(' ').toLowerCase();
  
  // FAANG/Top-tier background
  if (ROCKSTAR_COMPANIES.some(c => teamText.includes(c))) teamPts += 0.8;
  
  // Serial founders
  if (/serial founder|second.?time|previously founded|exited/i.test(teamText)) teamPts += 0.6;
  
  // Elite school
  if (ELITE_SCHOOLS.some(s => teamText.includes(s))) teamPts += 0.3;
  
  // Technical co-founder
  if (startup.has_technical_cofounder || extracted.has_technical_cofounder ||
      /CTO|technical co.?found|engineering lead/i.test(teamText)) teamPts += 0.3;
  
  teamPts = Math.min(teamPts, 2.0);
  
  // ═══════════════════════════════════════
  // DIMENSION 3: INVESTOR VALIDATION (0-2)
  // ═══════════════════════════════════════
  let investorPts = 0;
  
  const backedBy = [
    startup.backed_by || '',
    extracted.backed_by || '',
    extracted.investors || '',
    startup.description || '',
  ].join(' ').toLowerCase();
  
  // Tier 1 VC
  if (TIER1_INVESTORS.some(inv => backedBy.includes(inv))) investorPts += 1.0;
  // Tier 2 VC
  else if (TIER2_INVESTORS.some(inv => backedBy.includes(inv))) investorPts += 0.5;
  
  // Multiple investors signal
  const fundingAmount = startup.funding_amount || extracted.funding_amount || 0;
  if (fundingAmount > 1000000) investorPts += 0.5;
  else if (fundingAmount > 100000) investorPts += 0.3;
  else if (/funded|raised|investment|seed round|series/i.test(backedBy)) investorPts += 0.2;
  
  // Conviction from follow-on data
  if (startup.conviction_signal_strength > 0.5) investorPts += 0.3;
  
  investorPts = Math.min(investorPts, 2.0);
  
  // ═══════════════════════════════════════
  // DIMENSION 4: PRODUCT MATURITY (0-2)
  // ═══════════════════════════════════════
  let productPts = 0;
  
  if (startup.is_launched || extracted.is_launched || extracted.launched) productPts += 0.5;
  if (startup.has_demo || extracted.has_demo || extracted.demo_available) productPts += 0.3;
  
  // Value proposition clarity
  const vp = startup.value_proposition || startup.tagline || extracted.value_proposition || '';
  if (vp.length > 50) productPts += 0.4;
  else if (vp.length > 20) productPts += 0.2;
  
  // Multi-sector reach
  const sectors = startup.sectors || startup.industries || [];
  if (Array.isArray(sectors) && sectors.length >= 3) productPts += 0.3;
  else if (Array.isArray(sectors) && sectors.length >= 2) productPts += 0.15;
  
  // Defensibility / IP
  if (extracted.unique_ip || extracted.defensibility ||
      /patent|proprietar|defensib|moat/i.test(startup.description || '')) productPts += 0.5;
  
  productPts = Math.min(productPts, 2.0);
  
  // ═══════════════════════════════════════
  // DIMENSION 5: DATA COMPLETENESS (0-2)
  // ═══════════════════════════════════════
  let dataPts = 0;
  
  if ((startup.problem || extracted.problem) && (startup.solution || extracted.solution)) dataPts += 0.4;
  
  const descLen = (startup.description || startup.pitch || extracted.description || '').length;
  if (descLen > 200) dataPts += 0.3;
  else if (descLen > 50) dataPts += 0.15;
  
  if (startup.team_size > 0 || teamCompanies.length > 0 || startup.team) dataPts += 0.3;
  
  if (mrr > 0 || arr > 0 || fundingAmount > 0) dataPts += 0.5;
  else if (extracted.has_revenue || extracted.funding_amount) dataPts += 0.2;
  
  if (Array.isArray(sectors) && sectors.length > 0) dataPts += 0.3;
  
  if (startup.website) dataPts += 0.2;
  
  dataPts = Math.min(dataPts, 2.0);
  
  // ═══════════════════════════════════════
  // BOOST CALCULATION
  // ═══════════════════════════════════════
  const excellenceScore = tractionPts + teamPts + investorPts + productPts + dataPts;
  
  // Minimum threshold: need at least 3.0 excellence points to get ANY boost
  const EXCELLENCE_THRESHOLD = 3.0;
  const EXCELLENCE_RANGE = 7.0; // max 10 - threshold 3 = 7 range
  
  let boost = 0;
  let effectiveMultiplier = 1.0;
  let tier = 'none';
  
  if (intermediateScore < 60 || excellenceScore < EXCELLENCE_THRESHOLD) {
    // No boost for scores below 60 or insufficient evidence
    tier = intermediateScore < 50 ? 'Freshman' : 'Sophomore';
    effectiveMultiplier = 1.0;
    boost = 0;
  } else {
    const baseMultiplier = getTierMultiplier(intermediateScore);
    const excellenceRatio = Math.min((excellenceScore - EXCELLENCE_THRESHOLD) / EXCELLENCE_RANGE, 1.0);
    effectiveMultiplier = 1.0 + (baseMultiplier - 1.0) * excellenceRatio;
    boost = Math.min(Math.round(intermediateScore * (effectiveMultiplier - 1.0)), 15); // Cap: +15 max (Admin recalibrated Feb 20, 2026)
    
    // Assign tier label
    if (intermediateScore >= 90) tier = 'PhD';
    else if (intermediateScore >= 80) tier = "Dean's List";
    else if (intermediateScore >= 70) tier = 'Senior';
    else tier = 'Junior';
  }
  
  return {
    boost,
    excellenceScore,
    multiplier: effectiveMultiplier,
    dimensions: {
      traction: tractionPts,
      team: teamPts,
      investors: investorPts,
      product: productPts,
      dataCompleteness: dataPts,
    },
    tier,
    applied: boost > 0,
  };
}
