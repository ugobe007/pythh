/**
 * ⛔ DEPRECATED - DO NOT USE IN GOD SCORING
 * ============================================
 * 
 * This file was created by AI copilot WITHOUT admin approval (Dec 27, 2025).
 * It was incorrectly injected into GOD scoring as a component.
 * 
 * CORRECT USAGE: This logic should be part of SIGNAL dimensions, not GOD.
 * The Signal Application Service already handles market_momentum.
 * 
 * This file is kept for reference but should NOT be imported into:
 *   - startupScoringService.ts
 *   - recalculate-scores.ts
 *   - Any GOD scoring calculation
 * 
 * See: GOD_SCORING_AUDIT_JAN_2026.md for full details.
 * 
 * ORIGINAL DESCRIPTION:
 * Scores startups based on alignment with hot/emerging sectors.
 * Uses the hot-sectors-2025.json config for dynamic updates.
 * Key insight: VCs are concentrating capital in specific sectors.
 * AI captured 50%+ of VC funding in 2025. Sector timing matters.
 */

import fs from 'fs';
import path from 'path';

interface MarketTimingProfile {
  sectors?: string[];
  industries?: string[];
  tagline?: string;
  pitch?: string;
  description?: string;
  name?: string;
  // Optional: aggregated faith-alignment signals per startup (0-100 scale)
  faithSignals?: {
    topScore?: number;       // 0-100
    avgScore?: number;       // 0-100
    count?: number;          // number of matches
    confidenceAvg?: number;  // 0-1
  };
  // Optional: reliability of VC belief signals (0-1). Default assumed.
  faithReliability?: number;
}

interface MarketTimingResult {
  score: number;  // 0-1.5
  breakdown: {
    sectorTier: number;
    emergingCategory: number;
    genZFit: number;
    antiSignalPenalty: number;
    faithBoost?: number; // Optional contribution from faith-alignment (feature-flagged)
  };
  matchedSectors: string[];
  matchedCategories: string[];
  signals: string[];
}

// Load hot sectors config
function loadHotSectorsConfig(): any {
  try {
    const configPath = path.join(process.cwd(), 'config', 'hot-sectors-2025.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.warn('Could not load hot-sectors config, using defaults');
  }
  
  // Fallback defaults
  return {
    hotSectors: {
      tier1_explosive: {
        weight: 1.5,
        sectors: ['vertical ai', 'applied ai', 'agentic ai', 'defense tech', 'robotics', 'quantum']
      },
      tier2_strong: {
        weight: 1.0,
        sectors: ['climate tech', 'healthtech', 'biotech', 'cybersecurity', 'fintech', 'defi']
      },
      tier3_emerging: {
        weight: 0.75,
        sectors: ['space tech', 'edtech', 'vertical saas', 'dev tools']
      },
      tier4_cooling: {
        weight: 0.25,
        sectors: ['social media', 'consumer apps', 'nft', 'metaverse']
      }
    },
    emergingCategories: {
      categories: []
    },
    genZMarketFit: {
      signals: ['mobile-first', 'community-led', 'creator economy'],
      bonus: 0.2
    },
    antiSignals: {
      patterns: []
    }
  };
}

/**
 * Calculate market timing score (0-1.5 points)
 */
export function scoreMarketTiming(profile: MarketTimingProfile): MarketTimingResult {
  const config = loadHotSectorsConfig();
  const signals: string[] = [];
  const matchedSectors: string[] = [];
  const matchedCategories: string[] = [];
  
  let sectorTier = 0;
  let emergingCategory = 0;
  let genZFit = 0;
  let antiSignalPenalty = 0;
  let faithBoost = 0;
  let faithAccelerator = 0;
  
  // Combine all text for matching
  const allText = [
    ...(profile.sectors || []),
    ...(profile.industries || []),
    profile.tagline || '',
    profile.pitch || '',
    profile.description || '',
    profile.name || ''
  ].join(' ').toLowerCase();
  
  // ==========================================================================
  // 1. SECTOR TIER MATCHING (0-0.8 points based on tier)
  // ==========================================================================
  const { hotSectors } = config;
  
  // Check Tier 1 (explosive)
  for (const sector of hotSectors.tier1_explosive.sectors) {
    if (allText.includes(sector.toLowerCase())) {
      sectorTier = Math.max(sectorTier, 0.8);
      matchedSectors.push(sector);
      signals.push(`Tier 1 sector: ${sector}`);
      break;
    }
  }
  
  // Check Tier 2 (strong) if no tier 1 match
  if (sectorTier === 0) {
    for (const sector of hotSectors.tier2_strong.sectors) {
      if (allText.includes(sector.toLowerCase())) {
        sectorTier = Math.max(sectorTier, 0.5);
        matchedSectors.push(sector);
        signals.push(`Tier 2 sector: ${sector}`);
        break;
      }
    }
  }
  
  // Check Tier 3 (emerging)
  if (sectorTier === 0) {
    for (const sector of hotSectors.tier3_emerging.sectors) {
      if (allText.includes(sector.toLowerCase())) {
        sectorTier = Math.max(sectorTier, 0.3);
        matchedSectors.push(sector);
        signals.push(`Tier 3 sector: ${sector}`);
        break;
      }
    }
  }
  
  // Check Tier 4 (cooling) - minimal points
  if (sectorTier === 0) {
    for (const sector of hotSectors.tier4_cooling.sectors) {
      if (allText.includes(sector.toLowerCase())) {
        sectorTier = 0.1;
        matchedSectors.push(sector);
        signals.push(`Tier 4 sector (cooling): ${sector}`);
        break;
      }
    }
  }
  
  // ==========================================================================
  // 2. EMERGING CATEGORY BONUS (0-0.4 points)
  // ==========================================================================
  if (config.emergingCategories?.categories) {
    for (const category of config.emergingCategories.categories) {
      for (const keyword of category.keywords) {
        if (allText.includes(keyword.toLowerCase())) {
          emergingCategory = Math.max(emergingCategory, category.bonus || 0.3);
          matchedCategories.push(category.name);
          signals.push(`Emerging category: ${category.name}`);
          break;
        }
      }
    }
  }
  
  // Additional emerging patterns not in config
  const emergingPatterns = [
    { pattern: /\b(ai agent|agentic|autonomous agent)/i, bonus: 0.4, name: 'AI Agents' },
    { pattern: /\b(humanoid|bipedal robot|robot arm)/i, bonus: 0.35, name: 'Humanoid Robotics' },
    { pattern: /\b(brain.?computer|neural interface|bci|neuralink)/i, bonus: 0.35, name: 'Brain-Computer Interface' },
    { pattern: /\b(solid.?state batter|quantum batter)/i, bonus: 0.3, name: 'Advanced Energy Storage' },
    { pattern: /\b(gene therap|crispr|genomic)/i, bonus: 0.3, name: 'Gene Therapy' },
    { pattern: /\b(carbon capture|direct air capture|dac)/i, bonus: 0.3, name: 'Carbon Capture' }
  ];
  
  for (const { pattern, bonus, name } of emergingPatterns) {
    if (pattern.test(allText)) {
      emergingCategory = Math.max(emergingCategory, bonus);
      if (!matchedCategories.includes(name)) {
        matchedCategories.push(name);
        signals.push(`Emerging tech: ${name}`);
      }
    }
  }
  
  // ==========================================================================
  // 3. GENZ MARKET FIT (0-0.2 points)
  // ==========================================================================
  const genZPatterns = [
    /\b(mobile.?first|app.?first)/i,
    /\b(community.?led|community.?driven|discord|telegram)/i,
    /\b(creator|influencer|ugc|user.?generated)/i,
    /\b(async|remote.?first|distributed team)/i,
    /\b(mental health|wellness|mindfulness)/i,
    /\b(sustainable|eco.?friendly|carbon.?neutral|climate)/i,
    /\b(tiktok|instagram|shorts|reels)/i
  ];
  
  const genZMatches = genZPatterns.filter(p => p.test(allText)).length;
  
  if (genZMatches >= 3) {
    genZFit = 0.2;
    signals.push('Strong GenZ market fit');
  } else if (genZMatches >= 2) {
    genZFit = 0.15;
    signals.push('GenZ market alignment');
  } else if (genZMatches >= 1) {
    genZFit = 0.1;
  }
  
  // ==========================================================================
  // 4. ANTI-SIGNAL PENALTIES (-0.3 max)
  // ==========================================================================
  const antiPatterns = [
    { pattern: /\b(chatgpt wrapper|gpt wrapper|ai wrapper)/i, penalty: -0.2, name: 'Generic AI wrapper' },
    { pattern: /\b(uber for|airbnb for|tinder for)/i, penalty: -0.15, name: 'Generic X-for-Y' },
    { pattern: /\b(nft|metaverse|web3 gaming)/i, penalty: -0.1, name: 'Cooling sector' }
  ];
  
  for (const { pattern, penalty, name } of antiPatterns) {
    if (pattern.test(allText)) {
      antiSignalPenalty += penalty;
      signals.push(`Anti-signal: ${name}`);
    }
  }
  
  antiSignalPenalty = Math.max(antiSignalPenalty, -0.3);
  
  // ==========================================================================
  // 5. FAITH-ALIGNMENT BOOST (0-0.3 points, feature-flagged)
  // ==========================================================================
  // Conservative: cap to 20% of market timing component. Scales with reliability
  // and average confidence of alignment matches.
  try {
    const ENABLED = String(process.env.GOD_FAITH_IN_MARKET_TIMING || '').toLowerCase() === '1' 
      || String(process.env.GOD_FAITH_IN_MARKET_TIMING || '').toLowerCase() === 'true';
    const WEIGHT = Math.min(Math.max(Number(process.env.GOD_FAITH_TIMING_WEIGHT || '0.35'), 0), 0.5); // default 0.35, clamp [0,0.5]
    if (ENABLED && profile.faithSignals && (profile.faithSignals.count || 0) >= 3) {
      const top = (profile.faithSignals.topScore || 0) / 100; // 0-1
      const avg = (profile.faithSignals.avgScore || 0) / 100; // 0-1
      const conf = Math.min(Math.max(profile.faithSignals.confidenceAvg ?? 0.6, 0), 1);
      const reliability = Math.min(Math.max(profile.faithReliability ?? 0.6, 0), 1);
      const blended = (0.6 * top) + (0.4 * avg);
      const scaled = blended * conf * reliability;
      faithBoost = Math.min(scaled * WEIGHT, WEIGHT); // cap by weight
      if (faithBoost > 0) {
        signals.push(`Faith-alignment boost applied (${(faithBoost).toFixed(2)})`);
      }
      // Accelerator: additional +0.08 when top alignment ≥ 90%
      const ACC_ENABLED = String(process.env.GOD_FAITH_TIMING_ACCELERATOR || '1').toLowerCase() !== '0';
      const ACC_AMOUNT = Math.min(Math.max(Number(process.env.GOD_FAITH_TIMING_ACCELERATOR_AMOUNT || '0.08'), 0), 0.2);
      const ACC_THRESHOLD = Math.min(Math.max(Number(process.env.GOD_FAITH_TIMING_ACCELERATOR_THRESHOLD || '90'), 0), 100);
      if (ACC_ENABLED && (profile.faithSignals.topScore || 0) >= ACC_THRESHOLD) {
        faithAccelerator = ACC_AMOUNT;
        signals.push(`Faith timing accelerator +${ACC_AMOUNT.toFixed(2)} (top ≥ ${ACC_THRESHOLD}%)`);
      }
    }
  } catch { /* ignore env parsing issues */ }
  
  // ==========================================================================
  // TOTAL
  // ==========================================================================
  const rawScore = sectorTier + emergingCategory + genZFit + antiSignalPenalty + faithBoost + faithAccelerator;
  const score = Math.max(Math.min(rawScore, 2.0), 0);
  
  return {
    score,
    breakdown: {
      sectorTier,
      emergingCategory,
      genZFit,
      antiSignalPenalty,
      faithBoost,
      faithAccelerator
    },
    matchedSectors,
    matchedCategories,
    signals
  };
}

export default { scoreMarketTiming };
