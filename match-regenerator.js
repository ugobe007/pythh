#!/usr/bin/env node
/**
 * AUTO MATCH REGENERATION
 * =======================
 * Two modes:
 *   --full     : Re-score ALL startups × ALL investors (weekly, Sunday 2AM)
 *   --delta    : Re-score only startups updated in last 2 days (every 2 days)
 *   (default)  : --delta if no flag provided
 *
 * PM2 schedule: see ecosystem.config.js
 * Manual:  node match-regenerator.js --full
 *          node match-regenerator.js --delta
 */

// Use shared Supabase client (same as server)
const { supabase } = require('./server/lib/supabaseClient');

// Matching configuration
// ═══════════════════════════════════════════════════════════════════════════
// RECALIBRATED (Feb 16, 2026) — "Pythh Smart" matching
// Previous: 7 components summed to ~150, capped at 100 → everything hit cap
// New: Weights sum to exactly 100. Quality gates prevent weak-fit inflation.
// Philosophy: A match is about FIT, not just "good startup + good investor"
// ═══════════════════════════════════════════════════════════════════════════
const CONFIG = {
  // CORE FIT (60 pts) — these determine if the match makes sense at all
  SECTOR_MATCH: 30,      // Sector alignment is the #1 signal (was 40)
  STAGE_MATCH: 20,       // Stage fit is #2 — continuous, not binary (was 20 but binary)
  SEMANTIC_MATCH: 10,    // Embedding similarity captures thesis nuance (was 15)
  
  // QUALITY SIGNALS (25 pts) — how good are the parties independently
  STARTUP_QUALITY: 15,   // GOD score contribution (was 25)
  INVESTOR_QUALITY: 10,  // Investor tier/score contribution (was 20)
  
  // CONTEXTUAL SIGNALS (15 pts) — additional signal layers
  SIGNAL_BONUS: 5,       // Market momentum signals (was 10)
  FAITH_ALIGNMENT: 5,    // Investor conviction alignment (was 15)
  GEO_MATCH: 5,          // Geographic proximity (unchanged)
  
  // QUALITY GATES — weak core fit caps the total score
  // If sector match < gate threshold, total score is capped regardless of other signals
  SECTOR_GATE_THRESHOLD: 5,    // Below this = weak sector fit
  STAGE_GATE_THRESHOLD: 5,     // Below this = weak stage fit
  WEAK_FIT_CAP: 45,            // Max score when one core dimension is weak
  VERY_WEAK_FIT_CAP: 30,       // Max score when BOTH core dimensions are weak
  
  SUPER_MATCH_THRESHOLD: 4,    // Faith alignment >= 4 = SUPER MATCH (was 12, scaled down)
  MIN_MATCH_SCORE: 45,
  TOP_MATCHES_PER_STARTUP: 50,
  BATCH_SIZE: 500,
  DELTA_LOOKBACK_HOURS: 48,
};

/**
 * Cosine similarity between two embedding vectors.
 * Returns 0-1 (1 = identical, 0 = orthogonal).
 * Returns 0 if either vector is missing or malformed.
 */
function cosineSimilarity(a, b) {
  if (!a || !b || !Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// Use centralized sector taxonomy
const { 
  SECTOR_SYNONYMS,
  RELATED_SECTORS,
  normalizeSectors,
  expandRelatedSectors,
  calculateSectorMatchScore,
} = require('./server/lib/sectorTaxonomy');

// NORMALIZATION UTILITIES (centralized, run once)
function normToken(s) {
  if (s == null) return null;
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

function normTokenList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normToken).filter(Boolean);
}

function normalizeStr(s) {
  if (!s) return '';
  if (typeof s === 'string') return s.toLowerCase().trim();
  if (Array.isArray(s)) return s.map(x => String(x).toLowerCase().trim());
  return String(s).toLowerCase().trim();
}

/**
 * Calculate sector match with reasoning (uses centralized taxonomy)
 * Recalibrated: max 30 points, no fallback points for missing data
 * @param {string[]} startupSectors - normalized sector list
 * @param {string[]} investorSectors - normalized sector list
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (0-30)
 */
function calculateSectorMatch(startupSectors, investorSectors, reasons = []) {
  if (!startupSectors || !investorSectors || !startupSectors.length || !investorSectors.length) {
    reasons.push({ key: 'sector', points: 0, note: 'Missing sector data → no match credit' });
    return 0; // No free points for missing data
  }
  
  // Use centralized taxonomy for matching (includes cross-matching)
  const result = calculateSectorMatchScore(startupSectors, investorSectors, true);
  
  if (result.score > 0) {
    // Scale from taxonomy's 0-40 range down to our 0-30 range
    const scaled = Math.min(Math.round(result.score * (30 / 40)), CONFIG.SECTOR_MATCH);
    const matchType = result.isRelated ? 'RELATED' : 'DIRECT';
    const note = `${matchType}: ${result.matches.join(', ')}`;
    reasons.push({ key: 'sector', points: scaled, note });
    return scaled;
  }
  
  // No match found
  reasons.push({ 
    key: 'sector', 
    points: 0, 
    note: `No sector overlap (startup: ${startupSectors.join(', ')} | investor: ${investorSectors.join(', ')})` 
  });
  return 0;
}

// Map numeric stages to string stages
const STAGE_MAP = {
  0: 'Pre-Seed',
  1: 'Seed',
  2: 'Series A',
  3: 'Series B',
  4: 'Series C',
  5: 'Growth'
};

/**
 * Normalize startup data and detect missing fields
 */
function normalizeStartup(s, flags = []) {
  const sectors = normTokenList(s.sectors);
  if (!sectors.length) flags.push('startup_sectors_missing');

  const stage = (typeof s.stage === 'number') ? STAGE_MAP[s.stage] : s.stage;
  const stageNorm = normToken(stage);
  if (!stageNorm) flags.push('startup_stage_missing');

  const godScore = Number.isFinite(Number(s.total_god_score)) ? Number(s.total_god_score) : null;
  if (godScore == null) flags.push('startup_god_score_missing');

  return {
    id: s.id,
    name: s.name,
    sectors,
    stage: stageNorm,
    geo: normToken(s.location || s.region || s.geography),
    godScore,
  };
}

/**
 * Normalize investor data and detect missing fields
 */
function normalizeInvestor(i, flags = []) {
  const sectors = normTokenList(i.sectors);
  if (!sectors.length) flags.push('investor_sectors_missing');

  // investor.stage could be string or array; normalize to list
  const stagesRaw = Array.isArray(i.stage) ? i.stage : (i.stage ? [i.stage] : []);
  const stages = stagesRaw
    .map(x => (typeof x === 'number' ? STAGE_MAP[x] : x))
    .map(normToken)
    .filter(Boolean);

  if (!stages.length) flags.push('investor_stages_missing');

  return {
    id: i.id,
    name: i.name,
    sectors,
    stages,
    geo: normToken(i.geography || i.location || i.region),
    score: Number.isFinite(Number(i.investor_score)) ? Number(i.investor_score) : null,
    tier: normToken(i.investor_tier),
  };
}

// Stage ordering for proximity calculation
const STAGE_ORDER = ['pre-seed', 'preseed', 'seed', 'seriesa', 'seriesb', 'seriesc', 'growth', 'late'];

/**
 * Calculate stage match with continuous proximity scoring
 * Recalibrated: exact match = 20, adjacent = 12, 2-away = 5, distant = 0
 * No free points for missing data.
 * @param {string} startupStage - normalized stage token
 * @param {string[]} investorStages - normalized stage list
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (0-20)
 */
function calculateStageMatch(startupStage, investorStages, reasons = []) {
  const s = normToken(startupStage);
  const iStages = Array.isArray(investorStages) ? investorStages.map(normToken).filter(Boolean) : [];
  
  if (!s || !iStages.length) {
    reasons.push({ key: 'stage', points: 0, note: 'Missing stage data → no match credit' });
    return 0; // No free points for missing data
  }
  
  // Normalize for comparison (remove hyphens/spaces)
  const sNorm = s.replace(/[-_\s]/g, '');
  const iNorms = iStages.map(x => x.replace(/[-_\s]/g, ''));
  
  // Exact match check
  if (iNorms.some(is => is === sNorm || is.includes(sNorm) || sNorm.includes(is))) {
    reasons.push({ key: 'stage', points: CONFIG.STAGE_MATCH, note: `${s} ↔ ${iStages.join('|')} ✓ (exact)` });
    return CONFIG.STAGE_MATCH;
  }
  
  // Proximity-based scoring: find closest stage distance
  const sIdx = STAGE_ORDER.findIndex(x => sNorm.includes(x) || x.includes(sNorm));
  let closestDist = Infinity;
  for (const iNorm of iNorms) {
    const iIdx = STAGE_ORDER.findIndex(x => iNorm.includes(x) || x.includes(iNorm));
    if (sIdx >= 0 && iIdx >= 0) {
      closestDist = Math.min(closestDist, Math.abs(sIdx - iIdx));
    }
  }
  
  let score = 0;
  if (closestDist === 1) {
    score = 12; // Adjacent stage (e.g., Seed investor, Pre-Seed startup)
    reasons.push({ key: 'stage', points: score, note: `${s} ↔ ${iStages.join('|')} (adjacent, -1 stage)` });
  } else if (closestDist === 2) {
    score = 5; // Two stages away (e.g., Series A investor, Pre-Seed startup)
    reasons.push({ key: 'stage', points: score, note: `${s} ↔ ${iStages.join('|')} (2 stages apart)` });
  } else {
    score = 0; // Too far apart — not a fit
    reasons.push({ key: 'stage', points: 0, note: `Stage mismatch: ${s} vs ${iStages.join('|')} (distant)` });
  }
  
  return score;
}

/**
 * Calculate investor quality with reasoning
 * Recalibrated: max 10 points. Match is about FIT, not just investor prestige.
 * No fallback for missing scores — unknown investors get 0.
 * @param {number} score - investor score (0-10)
 * @param {string} tier - investor tier
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (0-10)
 */
function calculateInvestorQuality(score, tier, reasons = []) {
  if (!score && !tier) {
    reasons.push({ key: 'investor_quality', points: 0, note: 'No investor quality data' });
    return 0;
  }
  const baseScore = (score || 0); // Raw 0-10 score
  const tierBonus = { elite: 2, strong: 1, solid: 0, emerging: 0 }[tier] || 0;
  const total = Math.min(Math.round(baseScore + tierBonus), CONFIG.INVESTOR_QUALITY);
  
  const note = tier ? `Tier: ${tier} (+${tierBonus}) + score ${score}/10` : `Score: ${score}/10`;
  reasons.push({ key: 'investor_quality', points: total, note });
  return total;
}

/**
 * Calculate startup quality from GOD score with reasoning
 * Recalibrated: max 15 points. Non-linear curve rewards higher GOD scores more.
 * GOD 40→2, GOD 55→5, GOD 65→8, GOD 75→11, GOD 85→15
 * @param {number} godScore - GOD score (40-85)
 * @param {object[]} reasons - array to push match reasons
 * @returns {number} score (0-15)
 */
function calculateStartupQuality(godScore, reasons = []) {
  if (!godScore || godScore < 40) {
    reasons.push({ key: 'startup_quality', points: 0, note: 'GOD score missing/low → no quality credit' });
    return 0;
  }
  // Non-linear mapping: use power curve so higher GOD scores earn disproportionately more
  // This creates meaningful separation between a 50 and a 75 GOD score
  const normalized = Math.max(0, Math.min((godScore - 40) / 45, 1)); // 0-1 scale (40-85 range)
  const curved = Math.pow(normalized, 1.3); // Slight power curve — rewards excellence
  const quality = Math.round(curved * CONFIG.STARTUP_QUALITY); // 0-15
  
  reasons.push({ key: 'startup_quality', points: quality, note: `GOD ${godScore} → quality ${quality}/${CONFIG.STARTUP_QUALITY}` });
  return quality;
}

/**
 * Generate human-readable reasoning for why this match works
 */
function generateReasoning(startup, investor, fitAnalysis) {
  const reasons = [];
  
  // Sector alignment reasoning (rescaled: 0-30)
  if (fitAnalysis.sector >= 22) {
    reasons.push(`Strong sector alignment: ${investor.name} actively invests in ${formatSectors(startup.sectors)}`);
  } else if (fitAnalysis.sector >= 12) {
    reasons.push(`Good sector fit: Investment focus overlaps with ${startup.name}'s market`);
  } else if (fitAnalysis.sector >= 5) {
    reasons.push(`Adjacent sector interest detected`);
  }
  
  // Stage reasoning (rescaled: 0-20)
  if (fitAnalysis.stage >= 20) {
    reasons.push(`Stage match: ${investor.name} targets ${startup.stage || 'early'}-stage companies`);
  } else if (fitAnalysis.stage >= 12) {
    reasons.push(`Adjacent stage — investor may stretch for the right deal`);
  }
  
  // Investor quality reasoning (rescaled: 0-10)
  if (fitAnalysis.investor_quality >= 9) {
    reasons.push(`Top-tier investor with strong track record`);
  } else if (fitAnalysis.investor_quality >= 7) {
    reasons.push(`Established investor with relevant portfolio`);
  }
  
  // Startup quality reasoning (rescaled: 0-15)
  if (fitAnalysis.startup_quality >= 13) {
    reasons.push(`Exceptional startup fundamentals (GOD Score: ${startup.total_god_score || 'N/A'})`);
  } else if (fitAnalysis.startup_quality >= 9) {
    reasons.push(`Strong startup metrics and team`);
  }
  
  // Signal reasoning (rescaled: 0-5)
  if (fitAnalysis.signal >= 4) {
    reasons.push(`Strong market signal: momentum and interest detected`);
  } else if (fitAnalysis.signal >= 2) {
    reasons.push(`Emerging market signal: positive indicators`);
  }
  
  // 🔥 Faith alignment reasoning (rescaled: 0-5)
  if (fitAnalysis.is_super_match) {
    const themes = fitAnalysis.faith_themes ? fitAnalysis.faith_themes.join(', ') : 'multiple areas';
    reasons.push(`🔥 SUPER MATCH: Investor conviction deeply aligned with ${themes}`);
  } else if (fitAnalysis.faith >= 3) {
    const themes = fitAnalysis.faith_themes ? fitAnalysis.faith_themes.join(', ') : 'aligned areas';
    reasons.push(`Strong conviction alignment: investor thesis in ${themes}`);
  } else if (fitAnalysis.faith >= 1) {
    reasons.push(`Conviction signal detected: investor thesis partially aligns`);
  }
  
  // Tier-specific reasoning
  if (fitAnalysis.tier === 'elite') {
    reasons.push(`Elite investor match - high-conviction opportunity`);
  }
  
  return reasons.slice(0, 5).join('. ') + '.';
}

function formatSectors(sectors) {
  if (!sectors) return 'their target sectors';
  if (Array.isArray(sectors)) return sectors.slice(0, 3).join(', ');
  return sectors;
}

/**
 * Generate why_you_match array for UI display
 */
function generateWhyYouMatch(startup, investor, fitAnalysis) {
  const matches = [];
  
  if (fitAnalysis.sector >= 20) {
    matches.push(`Sector: ${formatSectors(startup.sectors)}`);
  }
  
  if (fitAnalysis.stage >= 10) {
    matches.push(`Stage: ${startup.stage || 'Early'}`);
  }
  
  if (fitAnalysis.investor_quality >= 7) {
    matches.push(`Investor Tier: ${investor.investor_tier || 'Active'}`);
  }
  
  if (fitAnalysis.startup_quality >= 10) {
    matches.push(`GOD Score: ${startup.total_god_score || 'N/A'}`);
  }
  
  if (fitAnalysis.signal >= 4) {
    matches.push(`Signal: Strong (${fitAnalysis.signal}/${CONFIG.SIGNAL_BONUS})`);
  } else if (fitAnalysis.signal >= 2) {
    matches.push(`Signal: Emerging (${fitAnalysis.signal}/${CONFIG.SIGNAL_BONUS})`);
  }
  
  // Faith alignment / SUPER MATCH (rescaled: 0-5)
  if (fitAnalysis.is_super_match) {
    const themes = fitAnalysis.faith_themes ? fitAnalysis.faith_themes.slice(0, 3).join(', ') : 'aligned thesis';
    matches.unshift(`🔥 SUPER MATCH: ${themes}`);
  } else if (fitAnalysis.faith >= 3) {
    const themes = fitAnalysis.faith_themes ? fitAnalysis.faith_themes.slice(0, 2).join(', ') : 'thesis match';
    matches.push(`Conviction: ${themes}`);
  } else if (fitAnalysis.faith >= 1) {
    matches.push(`Conviction signal detected`);
  }
  
  return matches.length > 0 ? matches : ['Algorithmic match'];
}

// ============================================
// FAITH ALIGNMENT: Theme → Sector crosswalk
// ============================================
// Maps investor faith themes (from vc_faith_signals) to canonical sector names.
// Uses the same SECTOR_SYNONYMS from sectorTaxonomy but adds extra faith-specific mappings.

// Build a reverse lookup: lowered synonym → canonical sector
const THEME_TO_SECTOR = {};
for (const [canonical, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
  for (const syn of synonyms) {
    THEME_TO_SECTOR[syn] = canonical;
  }
  // Also map the canonical name itself (lowered)
  THEME_TO_SECTOR[canonical.toLowerCase()] = canonical;
}
// Extra faith-specific theme mappings not covered by sector taxonomy
const FAITH_EXTRA_MAPPINGS = {
  'climate tech': 'CleanTech',
  'climate adaptation': 'CleanTech',
  'carbon removal': 'CleanTech',
  'environmental technology': 'CleanTech',
  'clean energy': 'CleanTech',
  'cleantech': 'CleanTech',
  'rare diseases': 'Biotech',
  'life sciences': 'Biotech',
  'biomedical': 'Biotech',
  'biotechnology': 'Biotech',
  'developer tools': 'Developer Tools',
  'software development': 'Developer Tools',
  'platforms': 'Infrastructure',
  'industrial innovation': 'DeepTech',
  'defense': 'Defense',
  'security': 'Cybersecurity',
  'blockchain': 'Crypto/Web3',
  'consumer technology': 'Consumer',
  'consumer': 'Consumer',
  'education': 'EdTech',
  'scalability': 'Infrastructure',
  'vertical markets': 'SaaS',
  'automation': 'Robotics',
};
Object.assign(THEME_TO_SECTOR, FAITH_EXTRA_MAPPINGS);

/**
 * Resolve a faith theme string to a canonical sector (or null if generic/non-sector)
 */
function resolveThemeToSector(theme) {
  if (!theme) return null;
  const lower = theme.toLowerCase().trim();
  // Direct lookup
  if (THEME_TO_SECTOR[lower]) return THEME_TO_SECTOR[lower];
  // Partial match: check if theme contains any synonym
  for (const [syn, canonical] of Object.entries(THEME_TO_SECTOR)) {
    if (lower.includes(syn) || syn.includes(lower)) return canonical;
  }
  return null; // Generic themes like 'innovation', 'entrepreneurship' → no sector
}

/**
 * Load investor faith themes from investors.signals jsonb column.
 * Returns Map<investor_id, { themes: string[], sectors: string[], avgConviction: number }>
 */
async function loadFaithThemes() {
  console.log('🔮 Loading investor faith themes...');
  
  let allInvestors = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('investors')
      .select('id, signals')
      .not('signals', 'is', null)
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.log(`   Error fetching faith themes page ${page}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    allInvestors = allInvestors.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  
  const themeMap = new Map();
  
  for (const inv of allInvestors) {
    if (!inv.signals || !inv.signals.top_themes) continue;
    const themes = Array.isArray(inv.signals.top_themes) ? inv.signals.top_themes : [];
    if (themes.length === 0) continue;
    
    // Resolve themes to canonical sectors
    const resolvedSectors = new Set();
    for (const t of themes) {
      const sector = resolveThemeToSector(t);
      if (sector) resolvedSectors.add(sector.toLowerCase());
    }
    
    themeMap.set(inv.id, {
      themes,
      sectors: [...resolvedSectors],
      avgConviction: parseFloat(inv.signals.avg_conviction) || 0.7,
      totalSignals: parseInt(inv.signals.total_signals) || 0,
    });
  }
  
  console.log(`   ✅ Loaded faith themes for ${themeMap.size} investors (${allInvestors.length} total with signals)`);
  return themeMap;
}

/**
 * Calculate faith alignment score between startup sectors and investor faith themes.
 * Returns { score: 0-15, matchingThemes: string[], isSuperMatch: boolean }
 */
function calculateFaithAlignment(startupSectors, investorFaith, reasons = []) {
  if (!investorFaith || investorFaith.sectors.length === 0) {
    // No faith data for this investor → 0 points (no penalty)
    return { score: 0, matchingThemes: [], isSuperMatch: false };
  }
  
  if (!startupSectors || startupSectors.length === 0) {
    return { score: 0, matchingThemes: [], isSuperMatch: false };
  }
  
  // Normalize startup sectors for comparison
  const startupNorm = startupSectors.map(s => s.toLowerCase().trim());
  
  // Find matching themes: investor faith sectors that overlap with startup sectors
  const matchingThemes = [];
  for (const faithSector of investorFaith.sectors) {
    // Check if any startup sector matches this faith sector
    const faithNorm = faithSector.toLowerCase().trim();
    for (const startupSec of startupNorm) {
      // Use the sector taxonomy's own matching (handles synonyms)
      const result = calculateSectorMatchScore([startupSec], [faithNorm], false);
      if (result.score > 0) {
        matchingThemes.push(faithSector);
        break; // Only count each faith sector once
      }
      // Also check direct contains (for cases taxonomy misses)
      if (faithNorm.includes(startupSec) || startupSec.includes(faithNorm)) {
        matchingThemes.push(faithSector);
        break;
      }
    }
  }
  
  if (matchingThemes.length === 0) {
    return { score: 0, matchingThemes: [], isSuperMatch: false };
  }
  
  // Recalibrated scoring: max 5 points (was 15)
  const conviction = investorFaith.avgConviction || 0.7;
  let score = 0;
  
  if (matchingThemes.length >= 3) {
    // Deep alignment: 3+ themes match → 4-5 points
    score = conviction >= 0.85 ? 5 : 4;
  } else if (matchingThemes.length === 2) {
    // Good alignment: 2 themes match → 3-4 points
    score = conviction >= 0.85 ? 4 : 3;
  } else {
    // Single theme: 1 match → 1-2 points
    score = conviction >= 0.85 ? 2 : 1;
  }
  
  // Cap at CONFIG max
  score = Math.min(score, CONFIG.FAITH_ALIGNMENT);
  
  const isSuperMatch = score >= CONFIG.SUPER_MATCH_THRESHOLD;
  
  // Add to reasoning
  if (isSuperMatch) {
    reasons.push({
      key: 'faith',
      points: score,
      note: `🔥 SUPER MATCH: Deep conviction alignment (${matchingThemes.join(', ')}) — conviction ${(conviction * 100).toFixed(0)}%`
    });
  } else if (score >= 7) {
    reasons.push({
      key: 'faith',
      points: score,
      note: `Strong conviction alignment (${matchingThemes.join(', ')}) — conviction ${(conviction * 100).toFixed(0)}%`
    });
  } else if (score > 0) {
    reasons.push({
      key: 'faith',
      points: score,
      note: `Conviction signal (${matchingThemes.join(', ')}) — conviction ${(conviction * 100).toFixed(0)}%`
    });
  }
  
  return { score, matchingThemes, isSuperMatch };
}

/**
 * Load signal scores for all startups (from startup_signal_scores table)
 * Returns Map<startup_id, signal_score_0_10>
 */
async function loadSignalScores() {
  console.log('📡 Loading signal scores...');
  
  // Read from pre-aggregated startup_signal_scores table (5k+ rows)
  // Use pagination to handle Supabase 1000 row limit
  let allScores = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_signal_scores')
      .select('startup_id, signals_total')
      .order('startup_id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (error) {
      console.log(`   Error fetching signal scores page ${page}: ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;
    
    allScores = allScores.concat(data);
    
    if (data.length < pageSize) break;
    page++;
  }
  
  if (allScores.length === 0) {
    console.log('   ⚠️ No signal scores available');
    return new Map();
  }
  
  const scoreMap = new Map();
  for (const row of allScores) {
    scoreMap.set(row.startup_id, parseFloat(row.signals_total) || 0);
  }
  
  const avgScore = scoreMap.size > 0 
    ? (Array.from(scoreMap.values()).reduce((a,b) => a+b, 0) / scoreMap.size).toFixed(1) 
    : 0;
  console.log(`   ✅ Loaded ${scoreMap.size} signal scores (avg: ${avgScore}/10)`);
  return scoreMap;
}

async function regenerateMatches() {
  const startTime = Date.now();
  
  // Parse CLI flags
  const args = process.argv.slice(2);
  const isFullRun = args.includes('--full');
  const isDelta = !isFullRun; // Default to delta mode
  const mode = isFullRun ? 'FULL' : 'DELTA';
  
  console.log('\n' + '═'.repeat(60));
  console.log(`🔄 AUTO MATCH REGENERATION [${mode}] (with Signal + Faith Scoring)`);
  console.log('═'.repeat(60));
  console.log(`⏰ Started: ${new Date().toISOString()}`);
  if (isDelta) console.log(`📋 Delta mode: only startups updated in last ${CONFIG.DELTA_LOOKBACK_HOURS}h`);
  console.log();
  
  try {
    // Load signal scores and faith themes in parallel
    const [signalScores, faithThemes] = await Promise.all([
      loadSignalScores(),
      loadFaithThemes(),
    ]);
    
    // Fetch startups — full or delta
    console.log(`📥 Fetching ${isDelta ? 'recently updated' : 'all'} startups...`);
    let allStartups = [];
    let page = 0;
    const pageSize = 1000;
    
    // Build query
    const deltaThreshold = isDelta 
      ? new Date(Date.now() - CONFIG.DELTA_LOOKBACK_HOURS * 3600 * 1000).toISOString()
      : null;
    
    while (true) {
      let query = supabase
        .from('startup_uploads')
        .select('id, name, sectors, stage, total_god_score, embedding')
        .eq('status', 'approved');
      
      // In delta mode, only fetch startups updated since the lookback window
      if (deltaThreshold) {
        query = query.gte('updated_at', deltaThreshold);
      }
      
      const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw new Error(`Startup fetch error: ${error.message}`);
      if (!data || data.length === 0) break;
      
      allStartups = allStartups.concat(data);
      console.log(`   Fetched ${allStartups.length} startups...`);
      
      if (data.length < pageSize) break; // Last page
      page++;
    }
    
    if (isDelta && allStartups.length === 0) {
      console.log('   No startups updated in the lookback window. Nothing to do.');
      console.log('🏁 Done (no-op delta)');
      return;
    }
    
    // Fetch ALL investors (paginated)
    console.log('📥 Fetching all investors...');
    let allInvestors = [];
    page = 0;
    
    while (true) {
      const { data, error } = await supabase
        .from('investors')
        .select('id, name, sectors, stage, investor_score, investor_tier, embedding')
        .range(page * pageSize, (page + 1) * pageSize - 1);
      
      if (error) throw new Error(`Investor fetch error: ${error.message}`);
      if (!data || data.length === 0) break;
      
      allInvestors = allInvestors.concat(data);
      console.log(`   Fetched ${allInvestors.length} investors...`);
      
      if (data.length < pageSize) break; // Last page
      page++;
    }
    
    const startups = allStartups;
    const investors = allInvestors;
    
    // Count embedding coverage
    const startupsWithEmb = startups.filter(s => s.embedding && Array.isArray(s.embedding) && s.embedding.length > 0).length;
    const investorsWithEmb = investors.filter(i => i.embedding && Array.isArray(i.embedding) && i.embedding.length > 0).length;
    
    console.log(`\n📊 Found ${startups.length} startups × ${investors.length} investors`);
    console.log(`🧠 Embedding coverage: ${startupsWithEmb}/${startups.length} startups, ${investorsWithEmb}/${investors.length} investors`);
    
    if (startups.length === 0 || investors.length === 0) {
      console.log('⚠️  No data to match');
      return;
    }
    
    // NOTE: DO NOT DELETE existing matches - use upsert to update them instead
    // This preserves matches for startups not in the current run
    console.log('💾 Using upsert to update existing matches (preserving all matches)\n');
    
    // ✅ RANK-FIRST PATTERN: score all, sort, save top N
    const allMatches = [];
    let processed = 0;
    const PERSISTENCE_FLOOR = 30; // Very low floor to avoid garbage
    
    for (const startup of startups) {
      // Normalize startup once
      const flags = [];
      const startupNorm = normalizeStartup(startup, flags);
      
      // Get signal score for this startup (0-10)
      const signalScore = signalScores.get(startup.id) || 0;
      
      // Score ALL investors for this startup
      const scoredMatches = [];
      
      for (const investor of investors) {
        // Normalize investor once
        const investorNorm = normalizeInvestor(investor, flags);
        
        // Calculate scores with Match Trace
        const reasons = [];
        const terms = {};
        
        // ═══════════════════════════════════════════════════════════════
        // CORE FIT (60 pts max) — determines if match makes sense at all
        // ═══════════════════════════════════════════════════════════════
        terms.sector = calculateSectorMatch(startupNorm.sectors, investorNorm.sectors, reasons);
        terms.stage = calculateStageMatch(startupNorm.stage, investorNorm.stages, reasons);
        
        // 🧠 SEMANTIC SIMILARITY: captures thesis nuance beyond keyword matching
        const similarity = cosineSimilarity(startup.embedding, investor.embedding);
        terms.semantic = Math.round(Math.max(0, similarity) * CONFIG.SEMANTIC_MATCH);
        if (terms.semantic >= 7) {
          reasons.push({ key: 'semantic', points: terms.semantic, note: `Strong semantic alignment (${(similarity * 100).toFixed(0)}%)` });
        } else if (terms.semantic >= 4) {
          reasons.push({ key: 'semantic', points: terms.semantic, note: `Moderate semantic alignment (${(similarity * 100).toFixed(0)}%)` });
        } else if (terms.semantic > 0) {
          reasons.push({ key: 'semantic', points: terms.semantic, note: `Weak semantic alignment (${(similarity * 100).toFixed(0)}%)` });
        }

        // ═══════════════════════════════════════════════════════════════
        // QUALITY SIGNALS (25 pts max)
        // ═══════════════════════════════════════════════════════════════
        terms.startup_quality = calculateStartupQuality(startupNorm.godScore, reasons);
        terms.investor_quality = calculateInvestorQuality(investorNorm.score, investorNorm.tier, reasons);
        
        // ═══════════════════════════════════════════════════════════════
        // CONTEXTUAL SIGNALS (15 pts max)
        // ═══════════════════════════════════════════════════════════════
        // Signal bonus: scale 0-10 input → 0-5 output
        const rawSignal = signalScore || 0;
        terms.signal = Math.min(Math.round(rawSignal / 2), CONFIG.SIGNAL_BONUS);
        if (rawSignal >= 7) {
          reasons.push({ key: 'signal', points: terms.signal, note: `Strong market signal (${rawSignal.toFixed(1)}/10)` });
        } else if (rawSignal >= 4) {
          reasons.push({ key: 'signal', points: terms.signal, note: `Emerging signal (${rawSignal.toFixed(1)}/10)` });
        } else if (rawSignal > 0) {
          reasons.push({ key: 'signal', points: terms.signal, note: `Early signal (${rawSignal.toFixed(1)}/10)` });
        }
        
        // 🔮 FAITH ALIGNMENT: investor conviction alignment
        const investorFaith = faithThemes.get(investor.id) || null;
        const faithResult = calculateFaithAlignment(startupNorm.sectors, investorFaith, reasons);
        terms.faith = faithResult.score;
        
        // 🌍 GEO MATCH
        terms.geo = 0;
        if (startupNorm.geo && investorNorm.geo) {
          if (startupNorm.geo === investorNorm.geo) {
            terms.geo = CONFIG.GEO_MATCH;
            reasons.push({ key: 'geo', points: CONFIG.GEO_MATCH, note: `Geographic match: ${startupNorm.geo}` });
          }
        }
        
        // ═══════════════════════════════════════════════════════════════
        // RAW TOTAL + QUALITY GATES
        // Weights sum to exactly 100. Quality gates cap score when
        // core fit dimensions are weak — prevents "good startup + good
        // investor" from scoring high without actual fit.
        // ═══════════════════════════════════════════════════════════════
        let rawTotal = terms.sector + terms.stage + terms.semantic + 
                        terms.startup_quality + terms.investor_quality + 
                        terms.signal + terms.faith + terms.geo;
        
        // Quality gate: apply caps for weak core fit
        const weakSector = terms.sector <= CONFIG.SECTOR_GATE_THRESHOLD;
        const weakStage = terms.stage <= CONFIG.STAGE_GATE_THRESHOLD;
        
        if (weakSector && weakStage) {
          rawTotal = Math.min(rawTotal, CONFIG.VERY_WEAK_FIT_CAP);
          reasons.push({ key: 'gate', points: 0, note: `⚠️ Both sector + stage weak → capped at ${CONFIG.VERY_WEAK_FIT_CAP}` });
        } else if (weakSector || weakStage) {
          rawTotal = Math.min(rawTotal, CONFIG.WEAK_FIT_CAP);
          reasons.push({ key: 'gate', points: 0, note: `⚠️ ${weakSector ? 'Sector' : 'Stage'} weak → capped at ${CONFIG.WEAK_FIT_CAP}` });
        }
        
        // No need to cap at 100 — weights naturally sum to 100 max
        const finalScore = Math.round(rawTotal);
        
        // Store raw similarity for the similarity_score column
        const rawSimilarity = similarity > 0 ? parseFloat(similarity.toFixed(4)) : null;
        
        // Generate human-readable fields
        const fitAnalysis = { ...terms, is_super_match: faithResult.isSuperMatch };
        if (faithResult.matchingThemes.length > 0) {
          fitAnalysis.faith_themes = faithResult.matchingThemes;
        }
        const reasoning = generateReasoning(startup, investor, terms);
        const whyYouMatch = generateWhyYouMatch(startup, investor, terms);
        
        scoredMatches.push({
          startup_id: startup.id,
          investor_id: investor.id,
          match_score: finalScore,
          similarity_score: rawSimilarity,
          algorithm_version: 'v3.0-pythh',
          status: 'suggested',
          confidence_level: finalScore >= 70 ? 'high' : finalScore >= 45 ? 'medium' : 'low',
          fit_analysis: fitAnalysis,
          reasoning: reasoning,
          why_you_match: whyYouMatch
        });
      }
      
      // ✅ STABLE SORT: (-score, investor_id)
      scoredMatches.sort((a, b) => {
        if (b.match_score !== a.match_score) return b.match_score - a.match_score;
        return String(a.investor_id).localeCompare(String(b.investor_id));
      });
      
      // ✅ RANK-FIRST: filter low floor, then take top N
      const topMatches = scoredMatches
        .filter(m => m.match_score >= PERSISTENCE_FLOOR)
        .slice(0, CONFIG.TOP_MATCHES_PER_STARTUP);
      
      allMatches.push(...topMatches);
      
      processed++;
      if (processed % 100 === 0) {
        process.stdout.write(`\r   Processed ${processed}/${startups.length} startups...`);
      }
    }
    
    console.log(`\n\n📦 Saving ${allMatches.length} matches...`);
    
    // Batch insert
    let saved = 0;
    for (let i = 0; i < allMatches.length; i += CONFIG.BATCH_SIZE) {
      const batch = allMatches.slice(i, i + CONFIG.BATCH_SIZE);
      
      // Use upsert to handle any duplicate key conflicts
      const { error: insErr } = await supabase
        .from('startup_investor_matches')
        .upsert(batch, { 
          onConflict: 'startup_id,investor_id',
          ignoreDuplicates: false 
        });
      
      if (insErr) {
        console.error(`   Batch ${Math.floor(i/CONFIG.BATCH_SIZE)+1} error:`, insErr.message);
      } else {
        saved += batch.length;
      }
      
      process.stdout.write(`\r   Saved ${saved}/${allMatches.length}`);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log('\n\n' + '═'.repeat(60));
    console.log(`✅ MATCH REGENERATION COMPLETE [${mode}] — v3.0-pythh`);
    console.log('═'.repeat(60));
    console.log(`   Mode: ${mode}`);
    console.log(`   Algorithm: v3.0-pythh (weights sum to 100, quality gates)`);
    console.log(`   Startups: ${startups.length}`);
    console.log(`   Investors: ${investors.length}`);
    console.log(`   Matches saved: ${saved} (cap: ${CONFIG.TOP_MATCHES_PER_STARTUP}/startup)`);
    console.log(`   High confidence (70+): ${allMatches.filter(m => m.confidence_level === 'high').length}`);
    console.log(`   Medium confidence (45-69): ${allMatches.filter(m => m.confidence_level === 'medium').length}`);
    console.log(`   Low confidence (<45): ${allMatches.filter(m => m.confidence_level === 'low').length}`);
    console.log(`   Quality-gated (capped): ${allMatches.filter(m => m.fit_analysis && m.fit_analysis.gate).length}`);
    console.log(`   Faith-boosted: ${allMatches.filter(m => m.fit_analysis && m.fit_analysis.faith > 0).length}`);
    console.log(`   🧠 Semantic-boosted: ${allMatches.filter(m => m.fit_analysis && m.fit_analysis.semantic > 0).length}`);
    console.log(`   🔥 SUPER MATCHES: ${allMatches.filter(m => m.fit_analysis && m.fit_analysis.is_super_match).length}`);
    // Score distribution
    const mScores = allMatches.map(m => m.match_score).sort((a,b) => a-b);
    if (mScores.length > 0) {
      const p10 = mScores[Math.floor(mScores.length*0.1)];
      const p50 = mScores[Math.floor(mScores.length*0.5)];
      const p90 = mScores[Math.floor(mScores.length*0.9)];
      const avg = Math.round(mScores.reduce((a,b)=>a+b,0)/mScores.length);
      console.log(`   📊 Score distribution: min=${mScores[0]} P10=${p10} median=${p50} P90=${p90} max=${mScores[mScores.length-1]} avg=${avg}`);
    }
    console.log(`   Time: ${elapsed}s`);
    console.log('═'.repeat(60) + '\n');
    
    // Log to monitoring table (ignore errors)
    await supabase.from('system_logs').insert({
      event: 'match_regeneration',
      details: {
        mode,
        startups: startups.length,
        investors: investors.length,
        matches: saved,
        top_n: CONFIG.TOP_MATCHES_PER_STARTUP,
        elapsed_seconds: parseFloat(elapsed)
      }
    }).then(() => {}).catch(() => {}); // Ignore if table doesn't exist
    
  } catch (error) {
    console.error('❌ Match regeneration failed:', error.message);
    process.exit(1);
  }
}

// Run
regenerateMatches().then(() => {
  console.log('🏁 Done');
  process.exit(0);
}).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
