#!/usr/bin/env node
/**
 * FUND SIZE INFERENCE ENGINE
 * ===========================
 * Reusable module that classifies investor capital types, infers fund sizes
 * when official numbers are missing, and computes capital power scores.
 *
 * Can be used standalone or imported by enrich-investor-data.js
 *
 * USAGE (standalone):
 *   node scripts/fund-size-inference.js                  # Analyze all investors, dry-run
 *   node scripts/fund-size-inference.js --apply          # Write inferred data to DB
 *   node scripts/fund-size-inference.js --id=UUID        # Analyze single investor
 *   node scripts/fund-size-inference.js --report         # Generate CSV report
 *
 * USAGE (as module):
 *   const { inferFundSize, classifyCapitalType, computeCapitalPower } = require('./fund-size-inference');
 *   const result = inferFundSize(investorRow);
 *   // result = { fund_size_estimate_usd, fund_size_confidence, capital_type, estimation_method, capital_power_score }
 */

// ─── CAPITAL TYPE TAXONOMY ───────────────────────────────────────────────────
const CAPITAL_TYPES = {
  SINGLE_FUND: 'single_fund',           // $250M Fund II — one active vehicle
  TOTAL_AUM: 'total_aum',               // $4B AUM — multi-fund platform
  PLATFORM_CAPITAL: 'platform_capital',  // Corporate VC, sovereign wealth (balance-sheet backed)
  MICRO_VC: 'micro_vc',                 // $20M — rolling or small early-stage fund
};

// ─── KNOWN CORPORATE / SOVEREIGN / NON-TRADITIONAL ENTITIES ──────────────────
const PLATFORM_CAPITAL_KEYWORDS = [
  'ventures', // only when combined with corporate parent
  'corporate', 'cvc', 'strategic',
  'sovereign', 'wealth fund', 'investment authority',
  'pension', 'endowment',
];

const KNOWN_PLATFORM_CAPITAL = [
  // Corporate VCs
  'mckesson ventures', 'google ventures', 'gv', 'intel capital',
  'salesforce ventures', 'microsoft ventures', 'm12',
  'qualcomm ventures', 'samsung next', 'comcast ventures',
  'paypal', 'paypal ventures',
  // Sovereign / quasi-sovereign
  'qatar wealth fund', 'qatar investment authority', 'qia',
  'temasek', 'gic', 'mubadala', 'adia',
  'british patient capital', 'british business bank',
  // Operators / non-VC
  'kitopi', 'quantum commodity intelligence',
];

const KNOWN_TOTAL_AUM = [
  // Multi-fund platforms where AUM ≠ single fund
  'sofinnova partners', 'peak xv', 'sequoia', 'a16z', 'andreessen horowitz',
  'dst global', 'prosus', 'softbank', 'tiger global',
  'westbridge capital', 'sofina', 'plug and play',
  'blue venture fund',
];

// ─── STAGE-BASED HEURISTICS ──────────────────────────────────────────────────
const STAGE_PORTFOLIO_SIZE = {
  'pre-seed': { avgCompanies: 35, avgCheckUsd: 200_000 },
  'seed': { avgCompanies: 28, avgCheckUsd: 750_000 },
  'series a': { avgCompanies: 20, avgCheckUsd: 5_000_000 },
  'series b': { avgCompanies: 15, avgCheckUsd: 15_000_000 },
  'growth': { avgCompanies: 12, avgCheckUsd: 30_000_000 },
  'late-stage': { avgCompanies: 10, avgCheckUsd: 50_000_000 },
  'early-stage': { avgCompanies: 25, avgCheckUsd: 1_500_000 },
  'mid-stage': { avgCompanies: 15, avgCheckUsd: 10_000_000 },
  'venture': { avgCompanies: 20, avgCheckUsd: 5_000_000 },
};

// Geography-based fund size ranges — UPDATED Feb 15 with tighter medians to reduce $75-250M clustering
// Pre-seed added. Emerging markets split more granularly.
const GEO_FUND_RANGES = {
  'us':             { preSeedMedian:  30_000_000, seedMedian:  75_000_000, seriesAMedian: 150_000_000, growthMedian: 400_000_000 },
  'europe':         { preSeedMedian:  22_000_000, seedMedian:  60_000_000, seriesAMedian: 125_000_000, growthMedian: 350_000_000 },
  'uk':             { preSeedMedian:  20_000_000, seedMedian:  55_000_000, seriesAMedian: 120_000_000, growthMedian: 300_000_000 },
  'india':          { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  80_000_000, growthMedian: 200_000_000 },
  'southeast asia': { preSeedMedian:  12_000_000, seedMedian:  35_000_000, seriesAMedian:  70_000_000, growthMedian: 180_000_000 },
  'mena':           { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  80_000_000, growthMedian: 200_000_000 },
  'africa':         { preSeedMedian:  10_000_000, seedMedian:  25_000_000, seriesAMedian:  50_000_000, growthMedian: 120_000_000 },
  'israel':         { preSeedMedian:  25_000_000, seedMedian:  65_000_000, seriesAMedian: 140_000_000, growthMedian: 350_000_000 },
  'latam':          { preSeedMedian:  12_000_000, seedMedian:  35_000_000, seriesAMedian:  70_000_000, growthMedian: 180_000_000 },
  'nordics':        { preSeedMedian:  18_000_000, seedMedian:  45_000_000, seriesAMedian: 100_000_000, growthMedian: 250_000_000 },
  'philippines':    { preSeedMedian:   8_000_000, seedMedian:  20_000_000, seriesAMedian:  45_000_000, growthMedian: 120_000_000 },
  'china':          { preSeedMedian:  20_000_000, seedMedian:  60_000_000, seriesAMedian: 130_000_000, growthMedian: 350_000_000 },
  'japan':          { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  90_000_000, growthMedian: 250_000_000 },
  'korea':          { preSeedMedian:  15_000_000, seedMedian:  40_000_000, seriesAMedian:  90_000_000, growthMedian: 250_000_000 },
  'australia':      { preSeedMedian:  18_000_000, seedMedian:  50_000_000, seriesAMedian: 110_000_000, growthMedian: 280_000_000 },
  'canada':         { preSeedMedian:  20_000_000, seedMedian:  55_000_000, seriesAMedian: 120_000_000, growthMedian: 300_000_000 },
  'dach':           { preSeedMedian:  22_000_000, seedMedian:  55_000_000, seriesAMedian: 120_000_000, growthMedian: 300_000_000 },
  'global':         { preSeedMedian:  25_000_000, seedMedian:  60_000_000, seriesAMedian: 130_000_000, growthMedian: 350_000_000 },
};

// ─── CORE INFERENCE FUNCTIONS ────────────────────────────────────────────────

// ─── STEP 1: REPORTED SIZE EXTRACTION LAYER ──────────────────────────────────
// Before inference, attempt to extract explicitly reported fund/AUM numbers
// from text fields (bio, investment_thesis, portfolio_performance).
//
// Patterns detected:
//   "Raised $1.5B fund"
//   "$9.2B under management"
//   "Fund II at $75M"
//   "$301 billion in AUM"
//   "closed a $150M fund"
//   "$200B+ market cap" (careful — market cap, not fund)
//
// Must EXCLUDE check size references like "Typical check: $500K-$10.0M"

/**
 * Extract reported fund/AUM size from investor text fields.
 * @param {Object} investor - Full investor DB row
 * @returns {{ reported_amount: number|null, is_aum: boolean, is_single_fund: boolean, source_field: string, context: string }|null}
 */
function extractReportedFundSize(investor) {
  const fields = [
    { name: 'bio', text: investor.bio || '' },
    { name: 'investment_thesis', text: investor.investment_thesis || '' },
    { name: 'portfolio_performance', text: typeof investor.portfolio_performance === 'string' ? investor.portfolio_performance : '' },
  ];

  // Skip patterns — these are NOT fund sizes
  const skipPatterns = [
    /typical\s+check/i,
    /check\s*(?:size)?[\s:$]/i,
    /invests?\s+(?:\$|€|£)/i,
    /market\s+cap/i,
    /valuation/i,
    /revenue/i,
    /raised\s+(?:by|from)\s+(?:startups|portfolio|companies)/i,
  ];

  // Fund size patterns — ordered by specificity (most specific = most reliable)
  const fundPatterns = [
    // Explicit single-fund patterns
    {
      regex: /(?:closed|raising|raised|launched|announced)\s+(?:a\s+)?(?:new\s+)?\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)\s*(?:\+\s*)?(?:fund|vehicle)/i,
      type: 'single_fund', confidence: 1.0,
    },
    {
      regex: /fund\s*(?:I{1,4}V?|[1-9]\d?)\s*(?:at|of|with|:)?\s*\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)/i,
      type: 'single_fund', confidence: 1.0,
    },
    {
      regex: /\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)\s*(?:\+\s*)?(?:fund|vehicle|vintage)/i,
      type: 'single_fund', confidence: 0.9,
    },
    // AUM / total capital patterns
    {
      regex: /\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)\s*(?:\+\s*)?(?:in\s+)?(?:AUM|assets?\s+under\s+management|under\s+management)/i,
      type: 'aum', confidence: 0.95,
    },
    {
      regex: /(?:AUM|assets\s+under\s+management)\s*(?:of|:)?\s*\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)/i,
      type: 'aum', confidence: 0.95,
    },
    {
      regex: /(?:manag(?:es?|ing))\s*(?:over\s+)?\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)/i,
      type: 'aum', confidence: 0.85,
    },
    // Committed / deployed capital
    {
      regex: /\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)\s*(?:\+\s*)?(?:committed|deployed|capital)/i,
      type: 'single_fund', confidence: 0.8,
    },
    // "with $X" or "$X+" — weaker signal, needs context
    {
      regex: /(?:firm|fund|portfolio|investor)\s+(?:with\s+)?\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)/i,
      type: 'aum', confidence: 0.7,
    },
    // Sovereign wealth fund AUM (special handling)
    {
      regex: /(?:sovereign|wealth)\s+fund\s+(?:with\s+)?\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)\s*(?:\+\s*)?(?:in\s+)?(?:AUM|assets?)?/i,
      type: 'aum', confidence: 0.95,
    },
    // Generic "$XB AUM" standalone
    {
      regex: /\$?([\d,.]+)\s*(B|billion|bn)\s*\+?\s*AUM/i,
      type: 'aum', confidence: 0.9,
    },
    // Funding provided (e.g., "provided over $125 million in funding")
    {
      regex: /(?:provided|invested|deployed)\s+(?:over\s+)?\$?([\d,.]+)\s*(M|B|million|billion|mn|bn)\s*(?:\+\s*)?(?:in\s+)?(?:funding|capital|investments?)/i,
      type: 'aum', confidence: 0.7,
    },
  ];

  for (const field of fields) {
    const text = field.text;
    if (!text || text.length < 10) continue;

    // Check if this text is just a check-size template (very common in scraped data)
    if (skipPatterns.some(sp => sp.test(text))) {
      // Only skip if the ENTIRE match context is a check reference
      // Allow if there's also a fund reference elsewhere
      const hasNonCheckDollar = text.replace(/typical\s+check[^.]*\./gi, '').match(/\$[\d,.]+\s*(M|B|million|billion|mn|bn)/i);
      if (!hasNonCheckDollar) continue;
    }

    for (const pattern of fundPatterns) {
      const match = text.match(pattern.regex);
      if (!match) continue;

      // Parse the dollar amount
      const numStr = match[1].replace(/,/g, '');
      let amount = parseFloat(numStr);
      const suffix = (match[2] || '').toLowerCase();

      if (['b', 'billion', 'bn'].includes(suffix)) amount *= 1_000_000_000;
      else if (['m', 'million', 'mn'].includes(suffix)) amount *= 1_000_000;

      if (amount <= 0) continue;

      // Extract surrounding context for logging
      const matchIdx = text.indexOf(match[0]);
      const contextStart = Math.max(0, matchIdx - 30);
      const contextEnd = Math.min(text.length, matchIdx + match[0].length + 30);
      const context = text.substring(contextStart, contextEnd).replace(/\n/g, ' ');

      return {
        reported_amount: amount,
        is_aum: pattern.type === 'aum',
        is_single_fund: pattern.type === 'single_fund',
        source_field: field.name,
        context: context,
        confidence: pattern.confidence,
      };
    }
  }

  return null;
}

/**
 * Classify an investor into one of 4 capital types.
 * @param {Object} investor - Full investor DB row
 * @returns {{ capital_type: string, confidence: number, reason: string }}
 */
function classifyCapitalType(investor) {
  const name = (investor.name || '').toLowerCase().trim();
  const firm = (investor.firm || '').toLowerCase().trim();
  const type = (investor.type || '').toLowerCase();
  const thesis = (investor.investment_thesis || '').toLowerCase();
  const combined = `${name} ${firm} ${thesis}`;

  // 1) Check known platform capital entities
  for (const kw of KNOWN_PLATFORM_CAPITAL) {
    if (name.includes(kw) || firm.includes(kw)) {
      return {
        capital_type: CAPITAL_TYPES.PLATFORM_CAPITAL,
        confidence: 0.9,
        reason: `Known platform/corporate entity: ${kw}`,
      };
    }
  }

  // 2) Check type field
  if (type === 'cvc' || type === 'corporate vc') {
    return {
      capital_type: CAPITAL_TYPES.PLATFORM_CAPITAL,
      confidence: 0.85,
      reason: 'Type is CVC/Corporate VC',
    };
  }

  // 3) Check for sovereign/pension/strategic keywords in thesis
  const platformHits = PLATFORM_CAPITAL_KEYWORDS.filter(kw => combined.includes(kw));
  if (platformHits.length >= 2 ||
      combined.includes('sovereign') ||
      combined.includes('balance sheet') ||
      combined.includes('pension fund')) {
    return {
      capital_type: CAPITAL_TYPES.PLATFORM_CAPITAL,
      confidence: 0.7,
      reason: `Platform capital signals: ${platformHits.join(', ')}`,
    };
  }

  // 4) Check known total AUM firms
  for (const kw of KNOWN_TOTAL_AUM) {
    if (name.includes(kw) || firm.includes(kw)) {
      return {
        capital_type: CAPITAL_TYPES.TOTAL_AUM,
        confidence: 0.85,
        reason: `Known multi-fund platform: ${kw}`,
      };
    }
  }

  // 5) Use fund size to distinguish single_fund vs micro_vc
  const fundSize = investor.active_fund_size || 0;
  if (fundSize > 0) {
    if (fundSize < 30_000_000) {
      return {
        capital_type: CAPITAL_TYPES.MICRO_VC,
        confidence: 0.8,
        reason: `Fund size ${formatAmount(fundSize)} < $30M threshold`,
      };
    }
    return {
      capital_type: CAPITAL_TYPES.SINGLE_FUND,
      confidence: 0.8,
      reason: `Known fund size: ${formatAmount(fundSize)}`,
    };
  }

  // 6) Infer from check size
  const avgCheck = getAverageCheck(investor);
  if (avgCheck > 0) {
    if (avgCheck < 500_000) {
      return {
        capital_type: CAPITAL_TYPES.MICRO_VC,
        confidence: 0.6,
        reason: `Avg check ${formatAmount(avgCheck)} suggests micro-VC`,
      };
    }
    if (avgCheck > 15_000_000) {
      return {
        capital_type: CAPITAL_TYPES.TOTAL_AUM,
        confidence: 0.5,
        reason: `Large avg check ${formatAmount(avgCheck)} suggests multi-fund platform`,
      };
    }
    return {
      capital_type: CAPITAL_TYPES.SINGLE_FUND,
      confidence: 0.5,
      reason: `Avg check ${formatAmount(avgCheck)} consistent with single fund`,
    };
  }

  // 7) Default: single_fund with low confidence
  return {
    capital_type: CAPITAL_TYPES.SINGLE_FUND,
    confidence: 0.3,
    reason: 'Default classification — insufficient signals',
  };
}

/**
 * Infer fund size using structural clues when official numbers are missing.
 * 
 * PRIORITY ORDER (Step 1: Reported > Known > Inferred):
 *   1. Reported in text fields (bio, thesis) → confidence 1.0
 *   2. active_fund_size DB field → confidence 1.0
 *   3. Multi-signal inference → confidence 0.35-0.70 (Step 3: Data Density Multiplier)
 *
 * @param {Object} investor - Full investor DB row
 * @returns {{ fund_size_estimate_usd: number|null, fund_size_confidence: number, estimation_method: string, signals_used: string[] }}
 */
function inferFundSize(investor) {
  const signals = [];
  const estimates = [];

  const knownFundSize = investor.active_fund_size || 0;

  // ── STEP 1: Try text extraction FIRST ──
  const extracted = extractReportedFundSize(investor);
  if (extracted) {
    signals.push(`reported(${extracted.source_field}): ${formatAmount(extracted.reported_amount)} [${extracted.context}]`);

    if (extracted.is_aum) {
      // AUM reported — this is total AUM, not single fund
      // Estimate single fund ≈ AUM / estimated_fund_count
      // Heuristic: large AUM firms typically have 3-8 active funds
      const estimatedFunds = extracted.reported_amount > 10_000_000_000 ? 6 :
                             extracted.reported_amount > 1_000_000_000 ? 4 : 2;
      const singleFundEstimate = Math.round(extracted.reported_amount / estimatedFunds);
      
      return {
        fund_size_estimate_usd: extracted.reported_amount,
        fund_size_confidence: extracted.confidence,
        estimation_method: 'reported_aum',
        signals_used: [...signals, `AUM→single_fund: ${formatAmount(extracted.reported_amount)}/${estimatedFunds} ≈ ${formatAmount(singleFundEstimate)}`],
        reported_aum: extracted.reported_amount,
        estimated_single_fund: singleFundEstimate,
      };
    } else {
      // Single fund explicitly reported
      return {
        fund_size_estimate_usd: extracted.reported_amount,
        fund_size_confidence: extracted.confidence,
        estimation_method: 'reported',
        signals_used: signals,
      };
    }
  }

  // ── Known fund size from DB field ──
  if (knownFundSize > 0) {
    return {
      fund_size_estimate_usd: knownFundSize,
      fund_size_confidence: 1.0,
      estimation_method: 'reported',
      signals_used: ['active_fund_size field'],
    };
  }

  // ── Signal 1: Check size × portfolio heuristic ──
  const avgCheck = getAverageCheck(investor);
  const portfolioCount = investor.total_investments || 0;
  const primaryStage = getPrimaryStage(investor);

  if (avgCheck > 0 && portfolioCount > 0) {
    // Estimated Fund Size ≈ avgCheck × portfolioCount × 1.5 (reserve ratio)
    const estimate = avgCheck * portfolioCount * 1.5;
    estimates.push({ value: estimate, weight: 0.8 });
    signals.push(`check×portfolio: ${formatAmount(avgCheck)}×${portfolioCount}×1.5 = ${formatAmount(estimate)}`);
  } else if (avgCheck > 0 && primaryStage) {
    // Use stage-based portfolio size estimate
    const stageData = STAGE_PORTFOLIO_SIZE[primaryStage];
    if (stageData) {
      const estimate = avgCheck * stageData.avgCompanies * 1.5;
      estimates.push({ value: estimate, weight: 0.6 });
      signals.push(`check×stage(${primaryStage}): ${formatAmount(avgCheck)}×${stageData.avgCompanies}×1.5 = ${formatAmount(estimate)}`);
    }
  }

  // ── Signal 2: Portfolio count alone ──
  if (portfolioCount > 0 && avgCheck === 0) {
    let estimate;
    if (portfolioCount <= 15) estimate = portfolioCount * 1_500_000; // micro
    else if (portfolioCount <= 30) estimate = portfolioCount * 2_500_000;
    else if (portfolioCount <= 80) estimate = portfolioCount * 3_000_000;
    else estimate = portfolioCount * 4_000_000; // large platform

    estimates.push({ value: estimate, weight: 0.4 });
    signals.push(`portfolio_count(${portfolioCount}): ${formatAmount(estimate)}`);
  }

  // ── Signal 3: Stage × geography median (UPDATED with tighter medians) ──
  if (primaryStage) {
    const primaryGeo = getPrimaryGeo(investor);
    const geoRange = GEO_FUND_RANGES[primaryGeo] || GEO_FUND_RANGES['global'];

    let geoEstimate;
    if (primaryStage === 'pre-seed') {
      geoEstimate = geoRange.preSeedMedian;
    } else if (['seed', 'early-stage'].includes(primaryStage)) {
      geoEstimate = geoRange.seedMedian;
    } else if (['series a', 'series b', 'mid-stage', 'venture'].includes(primaryStage)) {
      geoEstimate = geoRange.seriesAMedian;
    } else {
      geoEstimate = geoRange.growthMedian;
    }

    estimates.push({ value: geoEstimate, weight: 0.3 });
    signals.push(`geo×stage(${primaryGeo}/${primaryStage}): ${formatAmount(geoEstimate)}`);
  }

  // ── Signal 4: Check size alone (most common inference path) ──
  if (avgCheck > 0 && estimates.length < 2) {
    // Rough heuristic: fund ≈ avgCheck × typical_portfolio × 1.5
    const typicalPortfolio = primaryStage
      ? (STAGE_PORTFOLIO_SIZE[primaryStage]?.avgCompanies || 20)
      : 20;
    const estimate = avgCheck * typicalPortfolio * 1.5;
    estimates.push({ value: estimate, weight: 0.5 });
    signals.push(`check_size_heuristic: ${formatAmount(avgCheck)}×${typicalPortfolio}×1.5 = ${formatAmount(estimate)}`);
  }

  if (estimates.length === 0) {
    return {
      fund_size_estimate_usd: null,
      fund_size_confidence: 0,
      estimation_method: 'none',
      signals_used: ['No inference signals available'],
    };
  }

  // Weighted average of estimates
  const totalWeight = estimates.reduce((s, e) => s + e.weight, 0);
  const weightedAvg = estimates.reduce((s, e) => s + e.value * e.weight, 0) / totalWeight;

  // ── STEP 3: Data Density Multiplier ──
  // Confidence is based on WHICH signals were available, not just count
  //   geo × stage only         → 0.35
  //   portfolio count + stage  → 0.55
  //   check size + portfolio   → 0.70
  //   check + portfolio + geo  → 0.75
  //   reported                 → 1.0  (handled above)
  const hasCheck = avgCheck > 0;
  const hasPortfolio = portfolioCount > 0;
  const hasStage = !!primaryStage;

  let confidence;
  if (hasCheck && hasPortfolio) {
    confidence = hasStage ? 0.75 : 0.70;
  } else if (hasCheck && hasStage) {
    confidence = 0.60;
  } else if (hasPortfolio && hasStage) {
    confidence = 0.55;
  } else if (hasCheck) {
    confidence = 0.50;
  } else if (hasPortfolio) {
    confidence = 0.40;
  } else {
    confidence = 0.35;
  }

  // Determine method label
  let method = 'multi_signal';
  if (estimates.length === 1) {
    if (signals.find(s => s.startsWith('check×portfolio'))) method = 'check_portfolio_inference';
    else if (signals.find(s => s.startsWith('portfolio_count'))) method = 'portfolio_count_inference';
    else if (signals.find(s => s.startsWith('geo×stage'))) method = 'geo_stage_inference';
    else if (signals.find(s => s.startsWith('check_size'))) method = 'check_size_inference';
  }

  return {
    fund_size_estimate_usd: Math.round(weightedAvg),
    fund_size_confidence: Math.round(confidence * 100) / 100,
    estimation_method: method,
    signals_used: signals,
  };
}

/**
 * Compute capital power score.
 * log10 scale: $20M=1, $75M=2, $250M=3, $1B=4, $10B=5
 * Linear interpolation on log scale for smooth curves.
 * @param {number} fundSizeUsd
 * @returns {number} 0-5 score
 */
function computeCapitalPower(fundSizeUsd) {
  if (!fundSizeUsd || fundSizeUsd <= 0) return 0;

  // log10 scale: 7 (10M) → ~1, 7.875 (75M) → 2, 8.4 (250M) → 3, 9 (1B) → 4, 10 (10B) → 5
  const log = Math.log10(fundSizeUsd);

  // Anchor points for the mapping
  const anchors = [
    { log: 7.0, score: 0.5 },   // $10M
    { log: 7.3, score: 1.0 },   // $20M
    { log: 7.875, score: 2.0 }, // $75M
    { log: 8.4, score: 3.0 },   // $250M
    { log: 9.0, score: 4.0 },   // $1B
    { log: 10.0, score: 5.0 },  // $10B
  ];

  if (log <= anchors[0].log) return Math.max(0, anchors[0].score * (log / anchors[0].log));
  if (log >= anchors[anchors.length - 1].log) return 5.0;

  // Linear interpolation between anchor points
  for (let i = 0; i < anchors.length - 1; i++) {
    if (log >= anchors[i].log && log < anchors[i + 1].log) {
      const t = (log - anchors[i].log) / (anchors[i + 1].log - anchors[i].log);
      return Math.round((anchors[i].score + t * (anchors[i + 1].score - anchors[i].score)) * 100) / 100;
    }
  }

  return 0;
}

/**
 * Run full inference pipeline on a single investor row.
 * Returns all computed fields ready for DB update.
 * @param {Object} investor - Full investor DB row
 * @returns {Object} Computed fields: capital_type, fund_size_estimate_usd, fund_size_confidence, estimation_method, capital_power_score, effective_capital_power, deployment_velocity_index
 */
function runInferencePipeline(investor) {
  const classification = classifyCapitalType(investor);
  const inference = inferFundSize(investor);
  const effectiveFundSize = inference.fund_size_estimate_usd || 0;
  const capitalPower = computeCapitalPower(effectiveFundSize);

  // ── STEP 3: Effective Capital Power (confidence-weighted) ──
  // effective_capital_power = capital_power_score × fund_size_confidence
  // Inferred capital is less dominant than verified capital in matching
  const effectiveCapitalPower = Math.round(capitalPower * inference.fund_size_confidence * 100) / 100;

  // ── STEP 4: Capital Velocity Signal ──
  const velocity = computeDeploymentVelocity(investor, effectiveFundSize);

  // Use text extraction to refine capital_type if needed
  const extracted = extractReportedFundSize(investor);
  let finalCapitalType = classification.capital_type;
  if (extracted) {
    if (extracted.is_aum && classification.capital_type === CAPITAL_TYPES.SINGLE_FUND) {
      finalCapitalType = CAPITAL_TYPES.TOTAL_AUM;
    } else if (extracted.is_single_fund) {
      finalCapitalType = CAPITAL_TYPES.SINGLE_FUND;
    }
  }

  return {
    capital_type: finalCapitalType,
    capital_type_confidence: classification.confidence,
    capital_type_reason: classification.reason,
    fund_size_estimate_usd: inference.fund_size_estimate_usd,
    fund_size_confidence: inference.fund_size_confidence,
    estimation_method: inference.estimation_method,
    estimation_signals: inference.signals_used,
    capital_power_score: capitalPower,
    effective_capital_power: effectiveCapitalPower,
    deployment_velocity_index: velocity.deployment_velocity_index,
    deployment_velocity_label: velocity.label,
    deployment_velocity_signals: velocity.signals,
  };
}

// ─── STEP 4: CAPITAL VELOCITY SIGNAL ──────────────────────────────────────────
// Measures how aggressively an investor deploys capital.
// A $200M fund with 8 investments = slow deployer (5/yr)
// A $200M fund with 40 investments in 2 years = aggressive (20/yr)
//
// Index scale: 0-5
//   0 = No data
//   1 = Very conservative (< 3 deals/year)
//   2 = Conservative (3-8 deals/year)
//   3 = Moderate (8-15 deals/year)
//   4 = Active (15-30 deals/year)
//   5 = Hyper-active (30+ deals/year)
//
// Why this matters for founder matching:
//   - Hyper-active deployers → more likely to move fast on deals
//   - Conservative deployers → higher conviction per deal, more support
//   - Mismatch signals: $200M fund with 3 deals → very selective, founders need to be exceptional

/**
 * Compute deployment velocity index for an investor.
 * @param {Object} investor - Investor DB row
 * @param {number} fundSizeUsd - Estimated or known fund size
 * @returns {{ deployment_velocity_index: number, label: string, signals: string[] }}
 */
function computeDeploymentVelocity(investor, fundSizeUsd) {
  const totalInvestments = investor.total_investments || 0;
  const signals = [];

  if (totalInvestments === 0) {
    return { deployment_velocity_index: 0, label: 'unknown', signals: ['No investment count data'] };
  }

  // Estimate years active from bio or founded date
  let yearsActive = 5; // default assumption
  const bio = (investor.bio || '').toLowerCase();
  const foundedMatch = bio.match(/(?:founded|established|started|launched)\s+(?:in\s+)?(\d{4})/i);
  if (foundedMatch) {
    yearsActive = Math.max(1, 2026 - parseInt(foundedMatch[1]));
    signals.push(`founded: ${foundedMatch[1]} (${yearsActive}yr)`);
  } else {
    // Secondary: check for year references like "since 2015"
    const sinceMatch = bio.match(/since\s+(\d{4})/i);
    if (sinceMatch) {
      yearsActive = Math.max(1, 2026 - parseInt(sinceMatch[1]));
      signals.push(`since: ${sinceMatch[1]} (${yearsActive}yr)`);
    } else {
      signals.push('years_active: estimated 5yr (default)');
    }
  }

  const dealsPerYear = totalInvestments / yearsActive;
  signals.push(`deals/year: ${totalInvestments}/${yearsActive} = ${dealsPerYear.toFixed(1)}`);

  // Average check size relative to fund (capital intensity)
  if (fundSizeUsd > 0) {
    const capitalDeployed = totalInvestments * (getAverageCheck(investor) || 0);
    if (capitalDeployed > 0) {
      const deploymentRatio = capitalDeployed / fundSizeUsd;
      signals.push(`deployment_ratio: ${(deploymentRatio * 100).toFixed(0)}% of fund deployed`);
    }
  }

  // Classify velocity
  let index, label;
  if (dealsPerYear < 3) {
    index = 1; label = 'very_conservative';
  } else if (dealsPerYear < 8) {
    index = 2; label = 'conservative';
  } else if (dealsPerYear < 15) {
    index = 3; label = 'moderate';
  } else if (dealsPerYear < 30) {
    index = 4; label = 'active';
  } else {
    index = 5; label = 'hyper_active';
  }

  // Smooth the index using continuous scale
  const continuousIndex = Math.min(5, Math.max(0.5,
    dealsPerYear < 3 ? 0.5 + (dealsPerYear / 3) * 0.5 :
    dealsPerYear < 8 ? 1 + ((dealsPerYear - 3) / 5) * 1 :
    dealsPerYear < 15 ? 2 + ((dealsPerYear - 8) / 7) * 1 :
    dealsPerYear < 30 ? 3 + ((dealsPerYear - 15) / 15) * 1 :
    4 + Math.min(1, (dealsPerYear - 30) / 30)
  ));

  return {
    deployment_velocity_index: Math.round(continuousIndex * 100) / 100,
    label,
    signals,
  };
}

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────

function getAverageCheck(investor) {
  const min = investor.check_size_min || 0;
  const max = investor.check_size_max || 0;
  if (min > 0 && max > 0) return (min + max) / 2;
  if (max > 0) return max;
  if (min > 0) return min;
  return 0;
}

function getPrimaryStage(investor) {
  const stages = investor.stage || [];
  if (stages.length === 0) return null;
  // Normalize and pick the earliest/primary stage
  const normalized = stages.map(s => s.toLowerCase().trim());
  const stageOrder = ['pre-seed', 'seed', 'early-stage', 'series a', 'series b', 'mid-stage', 'venture', 'growth', 'late-stage'];
  for (const s of stageOrder) {
    if (normalized.includes(s)) return s;
  }
  return normalized[0];
}

function getPrimaryGeo(investor) {
  const geos = investor.geography_focus || [];
  if (geos.length === 0) return 'global';
  // Normalize and pick the primary geography
  const normalized = geos.map(g => g.toLowerCase().trim());
  // Check known geo keys
  for (const geo of normalized) {
    if (GEO_FUND_RANGES[geo]) return geo;
    // Fuzzy match sub-strings
    for (const key of Object.keys(GEO_FUND_RANGES)) {
      if (geo.includes(key) || key.includes(geo)) return key;
    }
  }
  return 'global';
}

function formatAmount(n) {
  if (!n) return 'N/A';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

// ─── STANDALONE CLI ──────────────────────────────────────────────────────────

async function main() {
  require('dotenv').config();
  const { createClient } = require('@supabase/supabase-js');

  const args = process.argv.slice(2);
  const doApply = args.includes('--apply');
  const doReport = args.includes('--report');
  const idArg = args.find(a => a.startsWith('--id='));
  const investorId = idArg ? idArg.split('=')[1] : null;

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  FUND SIZE INFERENCE ENGINE                  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  if (!doApply) console.log('🔍 DRY RUN MODE — use --apply to write to database\n');

  // Fetch investors
  let query = supabase.from('investors').select('*');
  if (investorId) {
    query = query.eq('id', investorId);
  }
  query = query.order('investor_score', { ascending: true });

  const { data: investors, error } = await query;
  if (error) { console.error('DB Error:', error.message); return; }

  console.log(`📦 Analyzing ${investors.length} investors\n`);

  const results = [];
  let inferred = 0;
  let reported = 0;
  let noData = 0;
  let applied = 0;

  for (const inv of investors) {
    const result = runInferencePipeline(inv);
    results.push({ investor: inv, ...result });

    if (result.estimation_method === 'reported') {
      reported++;
    } else if (result.fund_size_estimate_usd) {
      inferred++;
    } else {
      noData++;
    }

    // Apply to DB if requested
    if (doApply && result.fund_size_estimate_usd) {
      const updateData = {
        capital_type: result.capital_type,
        fund_size_estimate_usd: result.fund_size_estimate_usd,
        fund_size_confidence: result.fund_size_confidence,
        estimation_method: result.estimation_method,
        capital_power_score: result.capital_power_score,
      };

      const { error: updateError } = await supabase
        .from('investors')
        .update(updateData)
        .eq('id', inv.id);

      if (updateError) {
        console.log(`   ❌ ${inv.name}: Update failed — ${updateError.message}`);
      } else {
        applied++;
      }
    }
  }

  // Print detailed results for small batches or single ID
  if (investors.length <= 30 || investorId) {
    for (const r of results) {
      const inv = r.investor;
      const known = inv.active_fund_size ? `(known: ${formatAmount(inv.active_fund_size)})` : '(no fund size)';
      console.log(`━━━ ${inv.name} ${known} ━━━`);
      console.log(`   Capital type:   ${r.capital_type} (${(r.capital_type_confidence * 100).toFixed(0)}% conf)`);
      console.log(`   Reason:         ${r.capital_type_reason}`);
      if (r.fund_size_estimate_usd) {
        console.log(`   Estimated size: ${formatAmount(r.fund_size_estimate_usd)} (${(r.fund_size_confidence * 100).toFixed(0)}% conf)`);
        console.log(`   Method:         ${r.estimation_method}`);
        console.log(`   Capital power:  ${r.capital_power_score.toFixed(2)}/5.0`);
        console.log(`   Effective pwr:  ${r.effective_capital_power.toFixed(2)}/5.0 (power × confidence)`);
      } else {
        console.log(`   Estimated size: Unable to infer — no signals`);
      }
      if (r.deployment_velocity_index > 0) {
        console.log(`   Deploy velocity: ${r.deployment_velocity_index.toFixed(2)}/5.0 (${r.deployment_velocity_label})`);
      }
      for (const s of r.estimation_signals || []) {
        console.log(`   📐 ${s}`);
      }
      if (r.deployment_velocity_signals) {
        for (const s of r.deployment_velocity_signals) {
          console.log(`   🚀 ${s}`);
        }
      }
      console.log('');
    }
  }

  // Summary
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  SUMMARY${doApply ? '' : ' (DRY RUN)'}                                ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Total investors:    ${investors.length}`);
  console.log(`  Known fund size:    ${reported} (${(reported / investors.length * 100).toFixed(1)}%)`);
  console.log(`  Inferred fund size: ${inferred} (${(inferred / investors.length * 100).toFixed(1)}%)`);
  console.log(`  No data available:  ${noData} (${(noData / investors.length * 100).toFixed(1)}%)`);
  if (doApply) console.log(`  Applied to DB:      ${applied}`);

  // Capital type distribution
  const typeDistrib = {};
  for (const r of results) {
    typeDistrib[r.capital_type] = (typeDistrib[r.capital_type] || 0) + 1;
  }
  console.log('\n  Capital Type Distribution:');
  for (const [type, count] of Object.entries(typeDistrib).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${type.padEnd(20)} ${count} (${(count / investors.length * 100).toFixed(1)}%)`);
  }

  // Capital power distribution
  const powerBuckets = { '0 (unknown)': 0, '0-1 (<$20M)': 0, '1-2 ($20-75M)': 0, '2-3 ($75-250M)': 0, '3-4 ($250M-1B)': 0, '4-5 ($1B+)': 0 };
  for (const r of results) {
    const p = r.capital_power_score;
    if (p === 0) powerBuckets['0 (unknown)']++;
    else if (p < 1) powerBuckets['0-1 (<$20M)']++;
    else if (p < 2) powerBuckets['1-2 ($20-75M)']++;
    else if (p < 3) powerBuckets['2-3 ($75-250M)']++;
    else if (p < 4) powerBuckets['3-4 ($250M-1B)']++;
    else powerBuckets['4-5 ($1B+)']++;
  }
  console.log('\n  Capital Power Score Distribution:');
  for (const [bucket, count] of Object.entries(powerBuckets)) {
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${bucket.padEnd(16)} ${count.toString().padStart(4)} ${bar}`);
  }

  // Generate CSV report if requested
  if (doReport) {
    const fs = require('fs');
    const path = require('path');
    const csvDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(csvDir)) fs.mkdirSync(csvDir, { recursive: true });

    const csvPath = path.join(csvDir, 'fund-size-inference-report.csv');
    const header = 'Name,Firm,Known Fund Size,Estimated Fund Size,Confidence,Method,Capital Type,Capital Power Score,Investor Score,Tier\n';
    const rows = results.map(r => {
      const inv = r.investor;
      return [
        `"${(inv.name || '').replace(/"/g, '""')}"`,
        `"${(inv.firm || '').replace(/"/g, '""')}"`,
        inv.active_fund_size || '',
        r.fund_size_estimate_usd || '',
        r.fund_size_confidence,
        r.estimation_method,
        r.capital_type,
        r.capital_power_score,
        inv.investor_score || 0,
        inv.investor_tier || '',
      ].join(',');
    }).join('\n');

    fs.writeFileSync(csvPath, header + rows);
    console.log(`\n✅ Report exported to: data/fund-size-inference-report.csv`);
  }

  console.log('');
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
module.exports = {
  CAPITAL_TYPES,
  classifyCapitalType,
  extractReportedFundSize,
  inferFundSize,
  computeCapitalPower,
  computeDeploymentVelocity,
  runInferencePipeline,
  formatAmount,
};

// Run standalone if called directly
if (require.main === module) {
  main().catch(console.error);
}
