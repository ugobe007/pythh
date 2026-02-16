/**
 * AP & Promising Student Scoring Service
 * ============================================================================
 * 
 * Two-tier bonus system for identifying premium startups stuck below their tier:
 * 
 * 1. AP BACHELOR BONUS (GOD 45-59 → potential Masters)
 *    Max: +6 points. Rewards quality differentiation.
 *    Dimensions:
 *      - Product × Demand Alignment: +1.5 max (has product AND customer evidence)
 *      - Funding Velocity: +1.5 max (funded, round stage, amount)
 *      - Rock Star Team: +2.0 max (FAANG/top schools, serial founders, tech CTO)
 *      - Smart Money / Advisors: +2.0 max (Tier 1 VCs, notable advisors, conviction)
 *    Requirement: 2+ dimensions must be active. Total capped at +6.
 *    Philosophy: "Smart money follows smart people"
 * 
 * 2. PROMISING FRESHMAN BONUS (GOD 40-44 → potential Bachelor)
 *    Max: +4 points. Rewards any sign of substance in sparse data.
 *    Dimensions:
 *      - Hot Sector: +1.0 (AI, fintech, biotech, climate, healthcare, etc.)
 *      - Product Evidence: +1.0 (launched, MVP, beta, demo)
 *      - Funding Traction: +1.0 (any funding signal)
 *      - Story Clarity: +1.0 (clear VP + problem/solution articulation)
 *      - Team Quality: +1.0 (bonus — stacks on top if present)
 *    Requirement: 2+ dimensions must be active. Total capped at +4.
 *    Philosophy: "Even with sparse data, some students show promise"
 * 
 * ============================================================================
 * ADMIN APPROVED: [pending]
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

// ── Tier 2 investors (still very good) ──
const TIER2_INVESTORS = [
  'seedcamp', 'plug and play', 'antler', 'entrepreneur first', 'ef',
  'soma capital', 'hustle fund', 'precursor', 'backstage capital',
  'village global', 'pioneer fund', 'betaworks'
];

// ── Rock star company backgrounds ──
const ROCKSTAR_COMPANIES = [
  'google', 'meta', 'facebook', 'apple', 'amazon', 'microsoft', 'tesla', 'spacex',
  'openai', 'stripe', 'airbnb', 'uber', 'netflix', 'palantir', 'coinbase',
  'databricks', 'snowflake', 'figma', 'notion', 'vercel', 'anthropic',
  'linkedin', 'twitter', 'x.com', 'salesforce', 'oracle', 'intel', 'nvidia',
  'doordash', 'instacart', 'robinhood', 'plaid', 'square', 'block'
];

// ── Elite school backgrounds ──
const ROCKSTAR_SCHOOLS = [
  'stanford', 'mit', 'harvard', 'yale', 'princeton', 'caltech', 'carnegie mellon',
  'berkeley', 'oxford', 'cambridge', 'wharton', 'columbia', 'cornell', 'upenn',
  'georgia tech', 'university of waterloo', 'eth zurich', 'imperial college'
];

// ── Hot sectors ──
const HOT_SECTORS = [
  'ai', 'ai/ml', 'artificial intelligence', 'machine learning',
  'fintech', 'fin-tech', 'financial technology',
  'biotech', 'bio-tech', 'biotechnology', 'therapeutics', 'drug discovery',
  'climate', 'climate tech', 'cleantech', 'clean energy', 'sustainability',
  'healthcare', 'healthtech', 'health tech', 'digital health',
  'saas', 'enterprise saas',
  'cybersecurity', 'cyber security', 'infosec',
  'deep tech', 'deeptech',
  'robotics', 'autonomous', 'self-driving',
  'quantum', 'quantum computing',
  'space', 'space tech', 'aerospace'
];

// ── Config ──
export const AP_SCORING_CONFIG = {
  // Bachelor AP — RECALIBRATED (Feb 16, 2026): 6 → 3 (ADMIN APPROVED)
  bachelorMinGod: 45,
  bachelorMaxGod: 59,
  bachelorMaxBonus: 3,
  bachelorMinDimensions: 2,
  
  // Freshman Promising — RECALIBRATED (Feb 16, 2026): 4 → 2 (ADMIN APPROVED)
  freshmanMinGod: 40,
  freshmanMaxGod: 44,
  freshmanMaxBonus: 2,
  freshmanMinDimensions: 2,
} as const;

/**
 * Calculate AP bonus for a Bachelor-tier startup (45-59)
 * Returns { bonus, dimensions, breakdown }
 */
export function calculateAPBonus(startup: any): {
  bonus: number;
  dimensions: number;
  breakdown: {
    productDemand: number;
    fundingVelocity: number;
    rockstarTeam: number;
    smartMoney: number;
  };
  flags: string[];
} {
  const ed = startup.extracted_data || {};
  const allText = buildAllText(startup, ed);
  
  let productDemand = 0;
  let fundingVelocity = 0;
  let rockstarTeam = 0;
  let smartMoney = 0;
  const flags: string[] = [];

  // ── D1: Product × Demand Alignment (max +1.5) ──
  // Product thesis aligned with customer demand evidence
  const hasProduct = startup.is_launched || startup.has_demo || ed.is_launched || ed.has_demo ||
    allText.match(/\b(launched|live|mvp|beta|shipped|product|platform|app)\b/);
  
  const hasCustomerEvidence = startup.has_customers || startup.has_revenue || startup.customer_count > 0 ||
    ed.has_revenue || ed.has_customers ||
    allText.match(/\b(customer|user|client|paying|subscriber|revenue|mrr|arr|contract)\b/);
  
  const hasDemandSignal = startup.is_oversubscribed || 
    (startup.fomo_signal_strength && startup.fomo_signal_strength > 0) ||
    (startup.growth_rate && startup.growth_rate > 0) ||
    allText.match(/\b(demand|waitlist|pre-order|oversubscribed|inbound|organic|adoption|traction)\b/);

  if (hasProduct && hasCustomerEvidence) {
    productDemand = 1.0;
    if (hasDemandSignal) productDemand = 1.5; // Full marks if all three
    flags.push('📋Product×Demand');
  } else if (hasProduct && hasDemandSignal) {
    productDemand = 0.75;
    flags.push('📋Product+Demand');
  }

  // ── D2: Funding Velocity (max +1.5) ──
  const fundingAmount = startup.latest_funding_amount || ed.funding_amount;
  const fundingRound = startup.latest_funding_round || ed.funding_stage || ed.funding_round;
  const hasFundingMention = allText.match(/\b(raised|funded|seed|series\s*[a-d]|pre-seed|angel|round|backed)\b/);
  
  if (fundingAmount && fundingAmount >= 5000000) {
    fundingVelocity = 1.5; // $5M+ = strong signal
  } else if (fundingAmount && fundingAmount >= 1000000) {
    fundingVelocity = 1.2;
  } else if (fundingAmount && fundingAmount > 0) {
    fundingVelocity = 1.0;
  } else if (fundingRound) {
    const round = String(fundingRound).toLowerCase();
    if (round.includes('series')) fundingVelocity = 1.2;
    else if (round.includes('seed')) fundingVelocity = 0.8;
    else if (round.includes('pre-seed')) fundingVelocity = 0.5;
    else fundingVelocity = 0.5;
  } else if (hasFundingMention) {
    fundingVelocity = 0.3; // Just a mention, weakest signal
  }
  
  if (fundingVelocity > 0) flags.push('💰Funding');

  // ── D3: Rock Star Team (max +2.0) ──
  const teamText = buildTeamText(startup, ed);
  
  let teamPoints = 0;
  
  // FAANG/top company alumni
  if (ROCKSTAR_COMPANIES.some(c => teamText.includes(c))) {
    teamPoints += 0.8;
  }
  
  // Elite school backgrounds
  if (ROCKSTAR_SCHOOLS.some(s => teamText.includes(s))) {
    teamPoints += 0.5;
  }
  
  // Serial founder / exits
  if (teamText.match(/\b(serial founder|ex-founder|exited|previous exit|ipo|acquisition)\b/)) {
    teamPoints += 0.7;
  }
  
  // Technical cofounder
  if (startup.has_technical_cofounder || ed.has_technical_cofounder) {
    teamPoints += 0.3;
  }
  
  // PhD / domain expertise
  if (teamText.match(/\b(phd|ph\.d|doctorate|professor|researcher)\b/)) {
    teamPoints += 0.3;
  }
  
  // MBA from top school
  if (teamText.match(/\b(mba|wharton|hbs|insead|kellogg|booth)\b/)) {
    teamPoints += 0.2;
  }

  rockstarTeam = Math.min(teamPoints, 2.0);
  if (rockstarTeam > 0) flags.push('⭐Team');

  // ── D4: Smart Money / Advisors (max +2.0) ──
  const investorText = buildInvestorText(startup, ed);
  
  let moneyPoints = 0;
  
  // Tier 1 investor
  if (TIER1_INVESTORS.some(inv => investorText.includes(inv))) {
    moneyPoints += 1.5;
  }
  // Tier 2 investor
  else if (TIER2_INVESTORS.some(inv => investorText.includes(inv))) {
    moneyPoints += 0.8;
  }
  
  // Follow-on conviction
  if (startup.conviction_signal_strength && startup.conviction_signal_strength > 0) {
    moneyPoints += 0.5;
  }
  if (startup.followon_investors && startup.followon_investors.length > 0) {
    moneyPoints += 0.3;
  }
  
  // Notable advisors
  if ((startup.advisors && startup.advisors.length > 0) || (ed.advisors && ed.advisors.length > 0)) {
    moneyPoints += 0.3;
  }

  smartMoney = Math.min(moneyPoints, 2.0);
  if (smartMoney > 0) flags.push('🏆SmartMoney');

  // ── Combine ──
  const activeDimensions = [productDemand, fundingVelocity, rockstarTeam, smartMoney].filter(d => d > 0).length;
  
  let bonus = 0;
  if (activeDimensions >= AP_SCORING_CONFIG.bachelorMinDimensions) {
    bonus = Math.min(productDemand + fundingVelocity + rockstarTeam + smartMoney, AP_SCORING_CONFIG.bachelorMaxBonus);
  }

  return {
    bonus: Math.round(bonus * 10) / 10, // 1 decimal
    dimensions: activeDimensions,
    breakdown: { productDemand, fundingVelocity, rockstarTeam, smartMoney },
    flags
  };
}

/**
 * Calculate Promising bonus for a Freshman-tier startup (40-44)
 * Returns { bonus, dimensions, breakdown }
 */
export function calculatePromisingBonus(startup: any): {
  bonus: number;
  dimensions: number;
  breakdown: {
    hotSector: number;
    productEvidence: number;
    fundingTraction: number;
    storyClarity: number;
    teamQuality: number;
  };
  flags: string[];
} {
  const ed = startup.extracted_data || {};
  const allText = buildAllText(startup, ed);
  
  let hotSector = 0;
  let productEvidence = 0;
  let fundingTraction = 0;
  let storyClarity = 0;
  let teamQuality = 0;
  const flags: string[] = [];

  // ── P1: Hot Sector (max +1.0) ──
  const sectors = (startup.sectors || []).map((x: string) => x.toLowerCase());
  const inHotSector = HOT_SECTORS.some(h => sectors.some((sec: string) => sec.includes(h))) ||
    allText.match(/\b(artificial intelligence|machine learning|fintech|biotech|climate tech|cybersecurity|quantum|robotics)\b/);
  
  if (inHotSector) {
    hotSector = 1.0;
    flags.push('🔥Sector');
  }

  // ── P2: Product Evidence (max +1.0) ──
  const hasProduct = startup.is_launched || startup.has_demo || ed.is_launched || ed.has_demo ||
    allText.match(/\b(launched|live|mvp|beta|prototype|shipped|deployed|working product)\b/);
  
  if (hasProduct) {
    productEvidence = 1.0;
    flags.push('🚀Product');
  }

  // ── P3: Funding Traction (max +1.0) ──
  const hasFunding = startup.latest_funding_amount || startup.latest_funding_round ||
    ed.funding_amount || ed.funding_stage ||
    allText.match(/\b(raised|funded|seed|series|pre-seed|angel|backed|investment)\b/);
  
  if (hasFunding) {
    fundingTraction = 1.0;
    flags.push('💰Funded');
  }

  // ── P4: Story Clarity (max +1.0) ──
  // Does this startup articulate a clear thesis despite sparse data?
  const vpLength = (ed.value_proposition || '').length;
  const pitchLength = (startup.pitch || '').length;
  const hasProblemSolution = (ed.problem && ed.problem.length > 20) && (ed.solution && ed.solution.length > 20);
  
  if (vpLength > 80 || pitchLength > 100 || hasProblemSolution) {
    storyClarity = 1.0;
    flags.push('📝Story');
  } else if (vpLength > 30 || pitchLength > 50) {
    storyClarity = 0.5;
    flags.push('📝Story~');
  }

  // ── P5: Team Quality (bonus, max +1.0) ──
  // Very rare in Freshman but highly valuable when present
  const teamText = buildTeamText(startup, ed);
  
  if (ROCKSTAR_COMPANIES.some(c => teamText.includes(c)) ||
      ROCKSTAR_SCHOOLS.some(s => teamText.includes(s)) ||
      startup.has_technical_cofounder ||
      teamText.match(/\b(serial founder|phd|mba|ex-founder)\b/)) {
    teamQuality = 1.0;
    flags.push('⭐Team');
  }

  // ── Combine ──
  const activeDimensions = [hotSector, productEvidence, fundingTraction, storyClarity, teamQuality].filter(d => d > 0).length;
  
  let bonus = 0;
  if (activeDimensions >= AP_SCORING_CONFIG.freshmanMinDimensions) {
    bonus = Math.min(hotSector + productEvidence + fundingTraction + storyClarity + teamQuality, AP_SCORING_CONFIG.freshmanMaxBonus);
  }

  return {
    bonus: Math.round(bonus * 10) / 10,
    dimensions: activeDimensions,
    breakdown: { hotSector, productEvidence, fundingTraction, storyClarity, teamQuality },
    flags
  };
}

/**
 * Universal AP/Promising calculator — picks the right function based on GOD score
 */
export function calculateAPOrPromisingBonus(startup: any): {
  type: 'ap' | 'promising' | 'none';
  bonus: number;
  dimensions: number;
  flags: string[];
} {
  const god = startup.total_god_score || 0;
  
  if (god >= AP_SCORING_CONFIG.bachelorMinGod && god <= AP_SCORING_CONFIG.bachelorMaxGod) {
    const result = calculateAPBonus(startup);
    return { type: 'ap', bonus: result.bonus, dimensions: result.dimensions, flags: result.flags };
  }
  
  if (god >= AP_SCORING_CONFIG.freshmanMinGod && god <= AP_SCORING_CONFIG.freshmanMaxGod) {
    const result = calculatePromisingBonus(startup);
    return { type: 'promising', bonus: result.bonus, dimensions: result.dimensions, flags: result.flags };
  }
  
  return { type: 'none', bonus: 0, dimensions: 0, flags: [] };
}

// ── Helper functions ──

function buildAllText(startup: any, ed: any): string {
  return [
    startup.pitch || '', startup.tagline || '', startup.description || '',
    ed.value_proposition || '', ed.problem || '', ed.solution || '',
    startup.name || '', ...(ed.fivePoints || [])
  ].join(' ').toLowerCase();
}

function buildTeamText(startup: any, ed: any): string {
  return [
    JSON.stringify(startup.team_signals || []),
    JSON.stringify(startup.credential_signals || []),
    JSON.stringify(startup.founders || []),
    JSON.stringify(ed.team || {}),
    JSON.stringify(ed.founders || []),
    JSON.stringify(ed.team_signals || []),
    JSON.stringify(ed.credential_signals || [])
  ].join(' ').toLowerCase();
}

function buildInvestorText(startup: any, ed: any): string {
  return [
    startup.lead_investor || '',
    JSON.stringify(startup.followon_investors || []),
    JSON.stringify(ed.investors_mentioned || []),
    JSON.stringify(startup.advisors || []),
    JSON.stringify(ed.advisors || []),
    ed.lead_investor || ''
  ].join(' ').toLowerCase();
}
