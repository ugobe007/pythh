/**
 * INSTANT URL SUBMIT - The Pythh Fast Path
 * 
 * POST /api/instant/submit
 * 
 * Purpose: Accept URL → Scrape → REAL GOD Score → Match → Return results
 * Goal: Complete processing in under 10 seconds (scrape + AI score + match)
 * 
 * Flow:
 * 1. Normalize URL and check for existing startup
 * 2. If NEW: Scrape website → AI-enrich → Calculate REAL GOD score
 * 3. Store real scores in database
 * 4. Generate matches using REAL GOD score (matches ONLY after scoring)
 * 5. Return results
 * 
 * IMPORTANT: GOD scores are calculated using the OFFICIAL scoring service
 * (startupScoringService.ts). NO hardcoded scores. NO placeholders.
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const log = require('../logger').forComponent('instant-submit');
const { createClient } = require('@supabase/supabase-js');
const { normalizeUrl, generateLookupVariants } = require('../utils/urlNormalizer');
const { 
  normalizeSectors, 
  expandRelatedSectors,
  getExpandedInvestorSectors,
  calculateSectorMatchScore,
  SECTOR_SYNONYMS,
} = require('../lib/sectorTaxonomy');
const { calculateCompleteness } = require('../services/dataCompletenessService');

// =============================================================================
// REAL SCORING PIPELINE - The GOD Score SSOT
// =============================================================================
// Node.js v24 can require .ts files directly
const { calculateHotScore } = require('../services/startupScoringService.ts');
const { scrapeAndScoreStartup } = require('../services/urlScrapingService.ts');
const { extractInferenceData } = require('../../lib/inference-extractor');
const { quickEnrich, isDataSparse } = require('../services/inferenceService');
const axios = require('axios');

/**
 * Transform a DB startup row into a scoring profile.
 * Ported from scripts/recalculate-scores.ts (SSOT).
 */
function toScoringProfile(startup) {
  const extracted = startup.extracted_data || {};
  return {
    tagline: startup.tagline || extracted.tagline,
    pitch: startup.description || startup.pitch || extracted.pitch || extracted.description,
    problem: startup.problem || extracted.problem,
    solution: startup.solution || extracted.solution,
    market_size: startup.market_size || extracted.market_size,
    industries: startup.industries || startup.sectors || extracted.industries || extracted.sectors || [],
    team: startup.team_companies ? startup.team_companies.map(c => ({
      name: 'Team Member',
      previousCompanies: [c]
    })) : (extracted.team || []),
    founders_count: startup.team_size || extracted.team_size || 1,
    technical_cofounders: (startup.has_technical_cofounder ? 1 : 0) || (extracted.has_technical_cofounder ? 1 : 0),
    // Numeric traction values
    mrr: startup.mrr || extracted.mrr,
    revenue: startup.arr || startup.revenue || extracted.revenue || extracted.arr,
    growth_rate: startup.growth_rate_monthly || extracted.growth_rate || extracted.growth_rate_monthly,
    customers: startup.customer_count || extracted.customers || extracted.customer_count,
    active_users: extracted.active_users || extracted.users,
    gmv: extracted.gmv,
    retention_rate: extracted.retention_rate,
    churn_rate: extracted.churn_rate,
    prepaying_customers: extracted.prepaying_customers,
    signed_contracts: extracted.signed_contracts,
    // Boolean inference signals
    has_revenue: extracted.has_revenue,
    has_customers: extracted.has_customers,
    execution_signals: extracted.execution_signals || [],
    team_signals: extracted.team_signals || [],
    funding_amount: extracted.funding_amount,
    funding_stage: extracted.funding_stage,
    // Product signals
    launched: startup.is_launched || extracted.is_launched || extracted.launched,
    demo_available: startup.has_demo || extracted.has_demo || extracted.demo_available,
    unique_ip: extracted.unique_ip,
    defensibility: extracted.defensibility,
    mvp_stage: extracted.mvp_stage,
    // Other fields
    founded_date: startup.founded_date || startup.created_at || extracted.founded_date,
    value_proposition: startup.value_proposition || startup.tagline || extracted.value_proposition,
    backed_by: startup.backed_by || extracted.backed_by || extracted.investors,
    // Pass through all fields
    ...startup,
    ...extracted
  };
}

/**
 * Calculate REAL GOD score using the official scoring service.
 * Ported from scripts/recalculate-scores.ts (SSOT).
 * Returns 0-100 total score + component breakdowns.
 */
function calculateGODScore(startup) {
  const profile = toScoringProfile(startup);
  const result = calculateHotScore(profile);
  
  // Convert from 10-point scale to 100-point scale
  const total = Math.round(result.total * 10);
  
  // Map breakdown to 0-100 using data-driven practical maximums
  const teamCombined = (result.breakdown.team_execution || 0) + (result.breakdown.team_age || 0);
  const marketCombined = (result.breakdown.market || 0) + (result.breakdown.market_insight || 0);
  
  return {
    team_score: Math.round((teamCombined / 3.5) * 100),
    traction_score: Math.round(((result.breakdown.traction || 0) / 3.0) * 100),
    market_score: Math.round((marketCombined / 2.0) * 100),
    product_score: Math.round(((result.breakdown.product || 0) / 1.3) * 100),
    vision_score: Math.round(((result.breakdown.product_vision || 0) / 1.3) * 100),
    total_god_score: total
  };
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// ============================================================================
// INVESTOR CACHE - Avoid loading 3700+ investors on every request
// ============================================================================
let investorCache = {
  data: null,
  loadedAt: 0,
  loading: false,
  TTL: 5 * 60 * 1000, // 5 minutes
  
  // Sector index for fast matching
  bySector: new Map(),
};

async function getInvestors(supabase) {
  const now = Date.now();
  
  // Return cached if fresh
  if (investorCache.data && (now - investorCache.loadedAt) < investorCache.TTL) {
    return investorCache.data;
  }
  
  // Prevent concurrent loads
  if (investorCache.loading) {
    // Wait for existing load
    while (investorCache.loading) {
      await new Promise(r => setTimeout(r, 50));
    }
    return investorCache.data;
  }
  
  investorCache.loading = true;
  
  try {
    console.log(`  📦 Loading investors into cache...`);
    const { data: investors, error } = await supabase
      .from('investors')
      .select('id, name, firm, url, sectors, stage, total_investments, active_fund_size, investment_thesis, type, investor_score, investor_tier, signals')
      .eq('status', 'active');
    
    if (error) throw error;
    
    // Build sector index with NORMALIZED sectors for better matching
    // Uses centralized taxonomy for cross-matching
    const bySector = new Map();
    for (const inv of investors) {
      const rawSectors = Array.isArray(inv.sectors) ? inv.sectors : [];
      // Normalize to canonical sectors + expand to related sectors
      const expandedSectors = getExpandedInvestorSectors(rawSectors);
      
      for (const sector of expandedSectors) {
        if (!bySector.has(sector)) bySector.set(sector, []);
        bySector.get(sector).push(inv);
      }
    }
    
    investorCache.data = investors;
    investorCache.bySector = bySector;
    investorCache.loadedAt = now;
    
    console.log(`  ✓ Cached ${investors.length} investors (${bySector.size} sectors with cross-matching)`);
    return investors;
  } finally {
    investorCache.loading = false;
  }
}

// Get investors matching startup sectors (uses taxonomy for cross-matching)
function getRelevantInvestors(startupSectors) {
  if (!investorCache.data) return [];
  
  // If no sectors, return all (fallback)
  if (!startupSectors || startupSectors.length === 0) {
    return investorCache.data;
  }
  
  // Normalize startup sectors and expand to related sectors
  const normalizedSectors = normalizeSectors(startupSectors);
  const expandedSectors = expandRelatedSectors(normalizedSectors);
  
  // Collect investors from matching sectors (with deduplication)
  const seen = new Set();
  const relevant = [];
  
  for (const sector of expandedSectors) {
    const sectorInvestors = investorCache.bySector.get(sector) || [];
    for (const inv of sectorInvestors) {
      if (!seen.has(inv.id)) {
        seen.add(inv.id);
        relevant.push(inv);
      }
    }
  }
  
  // If too few sector matches, include some generic investors
  if (relevant.length < 50) {
    for (const inv of investorCache.data) {
      if (!seen.has(inv.id)) {
        relevant.push(inv);
        if (relevant.length >= 500) break; // Cap at 500 for performance
      }
    }
  }
  
  return relevant;
}
// ============================================================================

// Fail fast if no config
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('[instantSubmit] CRITICAL: Missing Supabase credentials');
  const errorRouter = express.Router();
  errorRouter.all('*', (req, res) => res.status(503).json({ error: 'Service unavailable' }));
  module.exports = errorRouter;
  return;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// Warm investor cache on module load so first request isn't penalized
setTimeout(() => {
  getInvestors(supabase)
    .then(inv => console.log(`[instantSubmit] Investor cache warmed: ${inv?.length || 0} investors`))
    .catch(e => console.warn(`[instantSubmit] Cache warm failed (non-fatal): ${e.message}`));
}, 1000);

/**
 * URL Normalization - FAULT TOLERANT
 * Handles: lovable.com, www.lovable.com, https://lovable.com, lovable, etc.
 */
function extractDomain(url) {
  let input = String(url || '').trim().toLowerCase();
  
  // Remove protocol
  input = input.replace(/^https?:\/\//i, '');
  // Remove www.
  input = input.replace(/^www\./i, '');
  // Remove trailing slashes and paths
  input = input.split('/')[0];
  // Remove query strings
  input = input.split('?')[0];
  
  return input;
}

/**
 * Extract company name from any input
 * "stripe.com" → "stripe"
 * "www.stripe.com" → "stripe"
 * "stripe" → "stripe"
 */
function extractCompanyName(input) {
  const domain = extractDomain(input);
  // Get the part before the first dot (or the whole thing if no dot)
  return domain.split('.')[0].toLowerCase();
}

/**
 * Generate company name from domain
 */
function domainToName(domain) {
  const base = extractCompanyName(domain);
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// ============================================================================
// MATCH SCORING — Full 6-component model (ported from match-regenerator.js)
// ============================================================================

const MATCH_CONFIG = {
  SECTOR_MATCH: 40,
  STAGE_MATCH: 20,
  INVESTOR_QUALITY: 20,
  STARTUP_QUALITY: 25,
  SIGNAL_BONUS: 10,
  FAITH_ALIGNMENT: 15,
  SUPER_MATCH_THRESHOLD: 12,
  PERSISTENCE_FLOOR: 30,
  TOP_MATCHES_PER_STARTUP: 50,
};

const STAGE_MAP = {
  0: 'Pre-Seed', 1: 'Seed', 2: 'Series A', 3: 'Series B', 4: 'Series C', 5: 'Growth'
};

function normToken(s) {
  if (s == null) return null;
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

function normTokenList(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(normToken).filter(Boolean);
}

function normalizeStartupForScoring(s) {
  const sectors = normTokenList(s.sectors);
  const stage = (typeof s.stage === 'number') ? STAGE_MAP[s.stage] : s.stage;
  const stageNorm = normToken(stage);
  const godScore = Number.isFinite(Number(s.total_god_score)) ? Number(s.total_god_score) : null;
  return { id: s.id, name: s.name, sectors, stage: stageNorm, godScore };
}

function normalizeInvestorForScoring(i) {
  const sectors = normTokenList(i.sectors);
  const stagesRaw = Array.isArray(i.stage) ? i.stage : (i.stage ? [i.stage] : []);
  const stages = stagesRaw
    .map(x => (typeof x === 'number' ? STAGE_MAP[x] : x))
    .map(normToken)
    .filter(Boolean);
  return {
    id: i.id, name: i.name, sectors, stages,
    score: Number.isFinite(Number(i.investor_score)) ? Number(i.investor_score) : null,
    tier: normToken(i.investor_tier),
  };
}

function scoreSectorMatch(startupSectors, investorSectors) {
  if (!startupSectors?.length || !investorSectors?.length) return 5;
  const result = calculateSectorMatchScore(startupSectors, investorSectors, true);
  return result.score > 0 ? result.score : 0;
}

function scoreStageMatch(startupStage, investorStages) {
  const s = normToken(startupStage);
  const iStages = Array.isArray(investorStages) ? investorStages.map(normToken).filter(Boolean) : [];
  if (!s || !iStages.length) return 5;
  const sNorm = s.replace(/[-_\s]/g, '');
  const iNorms = iStages.map(x => x.replace(/[-_\s]/g, ''));
  if (iNorms.some(is => is === sNorm || is.includes(sNorm) || sNorm.includes(is))) {
    return MATCH_CONFIG.STAGE_MATCH;
  }
  return 5;
}

function scoreInvestorQuality(score, tier) {
  const baseScore = (score || 5) * 2;
  const tierBonus = { elite: 5, strong: 3, solid: 1, emerging: 0 }[tier] || 0;
  return Math.min(baseScore + tierBonus, MATCH_CONFIG.INVESTOR_QUALITY);
}

function scoreStartupQuality(godScore) {
  if (!godScore || godScore < 40) return 8;
  const normalized = Math.max(0, (godScore - 40) / 60);
  return Math.round(10 + normalized * 15);
}

// Faith alignment: investor conviction themes × startup sectors
// Build theme→sector reverse lookup
const THEME_TO_SECTOR = {};
for (const [canonical, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
  for (const syn of synonyms) THEME_TO_SECTOR[syn] = canonical;
  THEME_TO_SECTOR[canonical.toLowerCase()] = canonical;
}
Object.assign(THEME_TO_SECTOR, {
  'climate tech': 'CleanTech', 'climate adaptation': 'CleanTech', 'clean energy': 'CleanTech',
  'rare diseases': 'Biotech', 'life sciences': 'Biotech', 'biotechnology': 'Biotech',
  'developer tools': 'Developer Tools', 'defense': 'Defense', 'security': 'Cybersecurity',
  'blockchain': 'Crypto/Web3', 'consumer': 'Consumer', 'education': 'EdTech',
  'automation': 'Robotics', 'platforms': 'Infrastructure',
});

function resolveThemeToSector(theme) {
  if (!theme) return null;
  const lower = theme.toLowerCase().trim();
  if (THEME_TO_SECTOR[lower]) return THEME_TO_SECTOR[lower];
  for (const [syn, canonical] of Object.entries(THEME_TO_SECTOR)) {
    if (lower.includes(syn) || syn.includes(lower)) return canonical;
  }
  return null;
}

function scoreFaithAlignment(startupSectors, investorSignals) {
  if (!investorSignals?.top_themes?.length || !startupSectors?.length) {
    return { score: 0, matchingThemes: [], isSuperMatch: false };
  }
  const resolvedSectors = new Set();
  for (const t of investorSignals.top_themes) {
    const sector = resolveThemeToSector(t);
    if (sector) resolvedSectors.add(sector.toLowerCase());
  }
  if (resolvedSectors.size === 0) return { score: 0, matchingThemes: [], isSuperMatch: false };

  const startupNorm = startupSectors.map(s => s.toLowerCase().trim());
  const matchingThemes = [];
  for (const faithSector of resolvedSectors) {
    for (const startupSec of startupNorm) {
      const result = calculateSectorMatchScore([startupSec], [faithSector], false);
      if (result.score > 0 || faithSector.includes(startupSec) || startupSec.includes(faithSector)) {
        matchingThemes.push(faithSector);
        break;
      }
    }
  }
  if (matchingThemes.length === 0) return { score: 0, matchingThemes: [], isSuperMatch: false };

  const conviction = parseFloat(investorSignals.avg_conviction) || 0.7;
  let score = 0;
  if (matchingThemes.length >= 3) score = conviction >= 0.85 ? 15 : conviction >= 0.7 ? 12 : 10;
  else if (matchingThemes.length === 2) score = conviction >= 0.85 ? 10 : conviction >= 0.7 ? 8 : 7;
  else score = conviction >= 0.85 ? 7 : conviction >= 0.7 ? 5 : 3;
  score = Math.min(score, MATCH_CONFIG.FAITH_ALIGNMENT);
  return { score, matchingThemes, isSuperMatch: score >= MATCH_CONFIG.SUPER_MATCH_THRESHOLD };
}

/**
 * Full 6-component match scoring (same as match-regenerator.js)
 */
function calculateMatchScore(startup, investor, signalScore, investorSignals) {
  const sNorm = normalizeStartupForScoring(startup);
  const iNorm = normalizeInvestorForScoring(investor);

  const sector = scoreSectorMatch(sNorm.sectors, iNorm.sectors);
  const stage = scoreStageMatch(sNorm.stage, iNorm.stages);
  const invQ = scoreInvestorQuality(iNorm.score, iNorm.tier);
  const startQ = scoreStartupQuality(sNorm.godScore);
  const signal = Math.round(signalScore || 0);
  const faith = scoreFaithAlignment(sNorm.sectors, investorSignals);

  const total = sector + stage + invQ + startQ + signal + faith.score;
  return {
    score: Math.min(total, 100),
    fitAnalysis: {
      sector, stage, investor_quality: invQ, startup_quality: startQ,
      signal, faith: faith.score, is_super_match: faith.isSuperMatch,
      faith_themes: faith.matchingThemes,
    },
    confidence: total >= 75 ? 'high' : total >= 55 ? 'medium' : 'low',
  };
}

function formatSectors(sectors) {
  if (!sectors) return 'their target sectors';
  if (Array.isArray(sectors)) return sectors.slice(0, 3).join(', ');
  return sectors;
}

/**
 * Generate human-readable reasoning (same as match-regenerator.js)
 */
function generateReasoning(startup, investor, fitAnalysis) {
  const reasons = [];
  if (fitAnalysis.sector >= 30) reasons.push(`Strong sector alignment: ${investor.name || investor.firm} actively invests in ${formatSectors(startup.sectors)}`);
  else if (fitAnalysis.sector >= 20) reasons.push(`Good sector fit: Investment focus overlaps with ${startup.name}'s market`);
  else if (fitAnalysis.sector >= 10) reasons.push(`Adjacent sector interest detected`);
  if (fitAnalysis.stage >= 15) reasons.push(`Stage match: ${investor.name || investor.firm} targets ${startup.stage || 'early'}-stage companies`);
  if (fitAnalysis.investor_quality >= 18) reasons.push(`Top-tier investor with strong track record`);
  else if (fitAnalysis.investor_quality >= 15) reasons.push(`Established investor with relevant portfolio`);
  if (fitAnalysis.startup_quality >= 22) reasons.push(`Exceptional startup fundamentals (GOD Score: ${startup.total_god_score || 'N/A'})`);
  else if (fitAnalysis.startup_quality >= 18) reasons.push(`Strong startup metrics and team`);
  if (fitAnalysis.signal >= 8) reasons.push(`High market signal: strong momentum and investor interest detected`);
  else if (fitAnalysis.signal >= 5) reasons.push(`Emerging market signal: positive momentum building`);
  if (fitAnalysis.is_super_match) {
    const themes = fitAnalysis.faith_themes?.join(', ') || 'multiple areas';
    reasons.push(`🔥 SUPER MATCH: Deep conviction in ${themes} — directly aligned with this startup`);
  } else if (fitAnalysis.faith >= 7) {
    reasons.push(`Strong conviction alignment: investor thesis aligns`);
  } else if (fitAnalysis.faith >= 3) {
    reasons.push(`Conviction signal detected`);
  }
  return reasons.length > 0 ? reasons.slice(0, 5).join('. ') + '.' : `Match score: ${fitAnalysis.sector + fitAnalysis.stage + fitAnalysis.investor_quality + fitAnalysis.startup_quality}/100`;
}

function generateWhyYouMatch(startup, investor, fitAnalysis) {
  const matches = [];
  if (fitAnalysis.is_super_match) {
    const themes = fitAnalysis.faith_themes?.slice(0, 3).join(', ') || 'aligned thesis';
    matches.unshift(`🔥 SUPER MATCH: ${themes}`);
  }
  if (fitAnalysis.sector >= 20) matches.push(`Sector: ${formatSectors(startup.sectors)}`);
  if (fitAnalysis.stage >= 10) matches.push(`Stage: ${startup.stage || 'Early'}`);
  if (fitAnalysis.investor_quality >= 15) matches.push(`Investor Tier: ${investor.investor_tier || 'Active'}`);
  if (fitAnalysis.signal >= 7) matches.push(`Signal: Strong (${fitAnalysis.signal}/10)`);
  else if (fitAnalysis.signal >= 5) matches.push(`Signal: Emerging (${fitAnalysis.signal}/10)`);
  if (fitAnalysis.faith >= 7 && !fitAnalysis.is_super_match) matches.push(`Conviction: thesis match`);
  if (fitAnalysis.startup_quality >= 18) matches.push(`GOD Score: ${startup.total_god_score || 'N/A'}`);
  return matches.length > 0 ? matches : ['Algorithmic match'];
}

/**
 * POST /api/instant/submit
 * 
 * Body: { url: string }
 * Returns: { startup_id, matches, match_count, processing_time_ms }
 */
// ============================================================================
// BACKGROUND PIPELINE — heavy work runs AFTER HTTP response
// ============================================================================
// Concurrency limiter: max 1 pipeline at a time to avoid event loop starvation
let activePipelineCount = 0;
const MAX_CONCURRENT_PIPELINES = 1;
const pipelineQueue = [];

function startBackgroundPipeline(args) {
  if (activePipelineCount >= MAX_CONCURRENT_PIPELINES) {
    console.log(`  ⏳ [BG] Pipeline queued for ${args.domain} (active=${activePipelineCount})`);
    pipelineQueue.push(args);
    return;
  }
  activePipelineCount++;
  runBackgroundPipeline(args)
    .catch(e => console.error(`[BG] Pipeline error: ${e.message}`))
    .finally(() => {
      activePipelineCount--;
      if (pipelineQueue.length > 0) {
        const next = pipelineQueue.shift();
        console.log(`  ▶️ [BG] Dequeuing pipeline for ${next.domain}`);
        setTimeout(() => startBackgroundPipeline(next), 100);
      }
    });
}

async function runBackgroundPipeline({ startupId, domain, inputRaw, genSource, runId, startTime }) {
  const fullUrl = inputRaw.startsWith('http') ? inputRaw : `https://${domain}`;
  const displayName = domainToName(domain);
  
  try {
    console.log(`  🔄 [BG] Starting background pipeline for ${startupId} (${domain})`);
    
    // =========================================================================
    // PHASE 1: FAST MATCHES (~3-5s) — Generate matches with placeholder data
    // so the user sees results immediately while enrichment runs
    // =========================================================================
    const phase1Start = Date.now();
    
    // Load investors (cached after first call)
    const allInvestors = await getInvestors(supabase);
    if (!allInvestors || allInvestors.length === 0) {
      console.error(`  🔄 [BG] No investors loaded — aborting`);
      await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'failed', p_run_id: runId }).then(() => {}).catch(() => {});
      return;
    }
    
    // Quick match with placeholder data (sectors=['Technology'], god_score=50)
    const placeholderStartup = {
      id: startupId,
      name: displayName,
      sectors: ['Technology'],
      stage: 1,
      total_god_score: 50,
    };
    
    const quickInvestors = getRelevantInvestors(['Technology']);
    const quickMatches = [];
    for (let idx = 0; idx < quickInvestors.length; idx++) {
      const investor = quickInvestors[idx];
      // Yield event loop every 100 investors so server stays responsive
      if (idx > 0 && idx % 100 === 0) await new Promise(r => setImmediate(r));
      const result = calculateMatchScore(placeholderStartup, investor, 0, investor.signals || null);
      if (result.score >= MATCH_CONFIG.PERSISTENCE_FLOOR) {
        quickMatches.push({
          startup_id: startupId,
          investor_id: investor.id,
          match_score: result.score,
          reasoning: generateReasoning(placeholderStartup, investor, result.fitAnalysis),
          fit_analysis: result.fitAnalysis,
          confidence_level: result.confidence,
          why_you_match: generateWhyYouMatch(placeholderStartup, investor, result.fitAnalysis),
          status: 'suggested',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    }
    quickMatches.sort((a, b) => b.match_score - a.match_score);
    const fastMatches = quickMatches.slice(0, MATCH_CONFIG.TOP_MATCHES_PER_STARTUP);
    
    // Insert fast matches so frontend picks them up on next poll (~3s)
    // Uses unique(startup_id, investor_id) constraint for proper deduplication
    if (fastMatches.length > 0) {
      // Delete existing matches for this startup first, then insert fresh set
      await supabase.from('startup_investor_matches').delete().eq('startup_id', startupId);
      const batchSize = 500;
      for (let i = 0; i < fastMatches.length; i += batchSize) {
        const batch = fastMatches.slice(i, i + batchSize);
        const { error: batchErr } = await supabase
          .from('startup_investor_matches')
          .upsert(batch, { onConflict: 'startup_id,investor_id', ignoreDuplicates: false });
        if (batchErr) {
          console.error(`  🔄 [BG] Fast match batch ${i} upsert error: ${batchErr.message}`);
        }
      }
    }
    
    console.log(`  ⚡ [BG] PHASE 1 DONE: ${fastMatches.length} fast matches in ${Date.now() - phase1Start}ms`);
    
    // =========================================================================
    // PHASE 2: ENRICHMENT (~5-15s) — Scrape, infer, score, re-match
    // Matches are already visible; this refines them with real data
    // =========================================================================
    
    // ── Fetch website content (3s hard timeout) ──
    let websiteContent = null;
    try {
      const response = await Promise.race([
        axios.get(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 3000,
          maxRedirects: 3,
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), 3500))
      ]);
      websiteContent = response.data
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 15000);
      console.log(`  🔄 [BG] Fetched ${websiteContent.length} chars`);
    } catch (fetchErr) {
      console.warn(`  🔄 [BG] Fetch failed: ${fetchErr.message}`);
    }

    // ── Inference engine (free, instant) ──
    let inferenceData = null;
    let dataTier = 'C';
    if (websiteContent && websiteContent.length >= 50) {
      inferenceData = extractInferenceData(websiteContent, fullUrl);
      if (inferenceData) {
        dataTier = inferenceData.confidence?.tier || 'C';
        console.log(`  🔄 [BG] Inference: Tier ${dataTier}`);
      }
    }

    // ── NEWS-BASED ENRICHMENT (if still sparse, search news - 2-3s) ──
    console.log(`  🔄 [BG] Enrichment check: dataTier=${dataTier}, hasInferenceData=${!!inferenceData}, isSparse=${inferenceData ? isDataSparse({ extracted_data: inferenceData }) : 'N/A'}`);
    
    if (dataTier === 'C' || !inferenceData || isDataSparse({ extracted_data: inferenceData })) {
      try {
        console.log(`  🔄 [BG] Attempting news enrichment for "${displayName}"...`);
        const newsEnrichment = await quickEnrich(displayName, inferenceData || {}, fullUrl, 3000);
        
        if (newsEnrichment.enrichmentCount > 0) {
          inferenceData = { ...(inferenceData || {}), ...newsEnrichment.enrichedData };
          dataTier = 'B'; // Upgrade to Tier B if we found data
          console.log(`  🔄 [BG] News enrichment: +${newsEnrichment.enrichmentCount} fields (${newsEnrichment.fieldsEnriched.join(', ')}) from ${newsEnrichment.articlesFound} articles`);
        } else {
          console.log(`  🔄 [BG] News enrichment: No data found (${newsEnrichment.articlesFound} articles)`);
        }
      } catch (newsErr) {
        console.warn(`  🔄 [BG] News enrichment failed: ${newsErr.message}`);
      }
    }

    // ── AI scraper fallback (ONLY for Tier C, hard 5s race timeout) ──
    let aiData = null;
    if (dataTier === 'C') {
      try {
        const scrapeResult = await Promise.race([
          scrapeAndScoreStartup(fullUrl),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI scraper timeout (5s)')), 5000))
        ]);
        aiData = scrapeResult?.data;
        const hasSomeAI = !!(aiData?.description || aiData?.pitch || aiData?.problem || aiData?.solution);
        dataTier = hasSomeAI ? 'B' : 'C';
      } catch (aiErr) {
        console.warn(`  🔄 [BG] AI scraper skipped: ${aiErr.message}`);
      }

      // DynamicParser fallback (only if still Tier C, 5s)
      if (dataTier === 'C') {
        try {
          const DynamicParser = require('../../lib/dynamic-parser');
          const parser = new DynamicParser();
          const dpResult = await Promise.race([
            parser.parse(fullUrl, {
              extractionSchema: {
                name: 'string', description: 'string', pitch: 'string',
                problem: 'string', solution: 'string', sectors: 'array',
                funding_amount: 'number', funding_stage: 'string',
                founders: 'array', team_size: 'number',
              }
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('DynamicParser timeout')), 5000))
          ]);
          if (dpResult && (dpResult.description || dpResult.pitch)) {
            aiData = { ...(aiData || {}), ...dpResult };
            dataTier = 'B';
          }
        } catch (dpErr) {
          console.warn(`  🔄 [BG] DynamicParser skipped: ${dpErr.message}`);
        }
      }
    }

    // ── Merge data + calculate GOD score ──
    const inferredName = inferenceData?.name;
    const bestName = aiData?.name || inferredName || displayName;
    const merged = {
      name: bestName,
      tagline: aiData?.tagline || inferenceData?.tagline || null,
      description: aiData?.description || aiData?.pitch || inferenceData?.product_description || null,
      pitch: aiData?.pitch || inferenceData?.value_proposition || null,
      sectors: inferenceData?.sectors?.length > 0 ? inferenceData.sectors : (aiData?.sectors || ['Technology']),
      stage: aiData?.stage || (inferenceData?.funding_stage ?
        ({'pre-seed': 1, 'pre seed': 1, 'seed': 2, 'series a': 3, 'series b': 4}[inferenceData.funding_stage.toLowerCase()] || 1) : 1),
      is_launched: inferenceData?.is_launched || aiData?.is_launched || false,
      has_demo: inferenceData?.has_demo || aiData?.has_demo || false,
      has_technical_cofounder: inferenceData?.has_technical_cofounder || aiData?.has_technical_cofounder || false,
      team_size: inferenceData?.team_size || aiData?.founders_count || null,
      mrr: aiData?.mrr || null,
      arr: aiData?.arr || null,
      customer_count: inferenceData?.customer_count || aiData?.customer_count || null,
      growth_rate_monthly: inferenceData?.growth_rate || aiData?.growth_rate || null,
    };
    
    const enrichedRow = {
      ...merged,
      name: merged.name || displayName,
      website: `https://${domain}`,
      extracted_data: {
        ...(inferenceData || {}),
        ...(aiData || {}),
        data_tier: dataTier,
        enrichment_method: aiData ? 'inference+ai' : 'inference_only',
        scraped_at: new Date().toISOString(),
      },
    };

    const scores = calculateGODScore(enrichedRow);
    console.log(`  🔄 [BG] GOD Score: ${scores.total_god_score} (T${scores.team_score} Tr${scores.traction_score} M${scores.market_score} P${scores.product_score} V${scores.vision_score})`);

    // Calculate data completeness after enrichment
    const completenessResult = calculateCompleteness(enrichedRow);
    console.log(`  🔄 [BG] Data completeness: ${completenessResult.percentage}%`);

    // ── Update startup row with enriched data ──
    await supabase
      .from('startup_uploads')
      .update({
        name: enrichedRow.name,
        tagline: enrichedRow.tagline || `Startup at ${domain}`,
        description: enrichedRow.description,
        pitch: enrichedRow.pitch,
        sectors: enrichedRow.sectors,
        stage: enrichedRow.stage,
        is_launched: enrichedRow.is_launched,
        has_demo: enrichedRow.has_demo,
        has_technical_cofounder: enrichedRow.has_technical_cofounder,
        team_size: enrichedRow.team_size,
        mrr: enrichedRow.mrr,
        arr: enrichedRow.arr,
        customer_count: enrichedRow.customer_count,
        growth_rate_monthly: enrichedRow.growth_rate_monthly,
        extracted_data: enrichedRow.extracted_data,
        data_completeness: completenessResult.percentage,
        total_god_score: scores.total_god_score,
        team_score: scores.team_score,
        traction_score: scores.traction_score,
        market_score: scores.market_score,
        product_score: scores.product_score,
        vision_score: scores.vision_score,
      })
      .eq('id', startupId);

    // ── Seed signal score ──
    const godScore = scores.total_god_score || 50;
    const normalized = Math.max(0, Math.min(1, (godScore - 35) / 65));
    const signalTotal = parseFloat((5.5 + normalized * 4.0).toFixed(1));
    const factor = signalTotal / 7.0;
    void supabase
      .from('startup_signal_scores')
      .upsert({
        startup_id: startupId,
        signals_total: signalTotal,
        founder_language_shift: parseFloat((1.0 * factor).toFixed(1)),
        investor_receptivity: parseFloat((1.2 * factor).toFixed(1)),
        news_momentum: parseFloat((1.1 * factor).toFixed(1)),
        capital_convergence: parseFloat((1.1 * factor).toFixed(1)),
        execution_velocity: parseFloat((1.1 * factor).toFixed(1)),
        as_of: new Date().toISOString(),
      }, { onConflict: 'startup_id' })
      .then(() => console.log(`  🔄 [BG] Signal score: ${signalTotal}`))
      .catch(e => console.warn(`  🔄 [BG] Signal seed failed: ${e.message}`));

    // ── Write signal_events (Layer 1 raw evidence) ──
    // Create signal events from enrichment evidence: execution_velocity (always),
    // news_momentum (if extraction found articles), capital_convergence (if funding found)
    const signalEvents = [];
    const extracted = enrichedRow.extracted_data || {};
    const hasFunding = !!(extracted.funding?.amount || extracted.funding?.stage_name);
    const hasTraction = !!(extracted.metrics?.revenue || extracted.metrics?.mrr || 
                           extracted.metrics?.users || extracted.metrics?.customers);
    const hasCoverage = !!(enrichedRow.last_news_check);

    // Always: execution_velocity — we just enriched this startup
    signalEvents.push({
      startup_id: startupId,
      event_type: 'execution_velocity',
      source_type: 'enrichment',
      source_url: enrichedRow.website || null,
      confidence: Math.min(0.5 + normalized * 0.4, 0.95).toFixed(2),
      magnitude: parseFloat((1.1 * factor).toFixed(2)),
      payload: { 
        trigger: 'url_submit_enrichment', 
        god_score: godScore,
        has_traction: hasTraction,
        data_completeness: completenessResult?.percentage || 0
      }
    });

    // If funding info found: capital_convergence
    if (hasFunding) {
      signalEvents.push({
        startup_id: startupId,
        event_type: 'capital_convergence',
        source_type: 'enrichment',
        source_url: enrichedRow.website || null,
        confidence: Math.min(0.6 + normalized * 0.3, 0.95).toFixed(2),
        magnitude: parseFloat((1.1 * factor).toFixed(2)),
        payload: { 
          trigger: 'funding_data_found',
          funding_stage: extracted.funding?.stage_name || null,
          funding_amount: extracted.funding?.amount || null
        }
      });
    }

    // If recent news discovered: news_momentum
    if (hasCoverage) {
      signalEvents.push({
        startup_id: startupId,
        event_type: 'news_momentum',
        source_type: 'web',
        source_url: enrichedRow.website || null,
        confidence: Math.min(0.55 + normalized * 0.35, 0.90).toFixed(2),
        magnitude: parseFloat((1.1 * factor).toFixed(2)),
        payload: { trigger: 'inference_news_search', coverage_found: true }
      });
    }

    if (signalEvents.length > 0) {
      void supabase
        .from('signal_events')
        .insert(signalEvents)
        .then(() => console.log(`  🔄 [BG] Signal events: ${signalEvents.length} created`))
        .catch(e => console.warn(`  🔄 [BG] Signal events failed: ${e.message}`));
    }

    // =========================================================================
    // PHASE 3: RE-GENERATE MATCHES with enriched data (only if sectors changed)
    // =========================================================================
    const sectorsChanged = JSON.stringify(enrichedRow.sectors) !== JSON.stringify(['Technology']);
    
    if (sectorsChanged || scores.total_god_score !== 50) {
      const enrichedStartup = {
        id: startupId,
        name: enrichedRow.name,
        sectors: enrichedRow.sectors,
        stage: enrichedRow.stage,
        total_god_score: scores.total_god_score,
      };

      const startupSectors = Array.isArray(enrichedStartup.sectors) ? enrichedStartup.sectors : [];
      const investors = getRelevantInvestors(startupSectors);
      
      let signalScore = 0;
      try {
        const { data: sigData } = await supabase
          .from('startup_signal_scores')
          .select('signal_score')
          .eq('startup_id', startupId)
          .single();
        signalScore = sigData?.signal_score || 0;
      } catch (_) { /* optional */ }

      const allMatches = [];
      for (let idx = 0; idx < investors.length; idx++) {
        const investor = investors[idx];
        // Yield event loop every 100 investors so server stays responsive
        if (idx > 0 && idx % 100 === 0) await new Promise(r => setImmediate(r));
        const result = calculateMatchScore(enrichedStartup, investor, signalScore, investor.signals || null);
        if (result.score >= MATCH_CONFIG.PERSISTENCE_FLOOR) {
          allMatches.push({
            startup_id: startupId,
            investor_id: investor.id,
            match_score: result.score,
            reasoning: generateReasoning(enrichedStartup, investor, result.fitAnalysis),
            fit_analysis: result.fitAnalysis,
            confidence_level: result.confidence,
            why_you_match: generateWhyYouMatch(enrichedStartup, investor, result.fitAnalysis),
            status: 'suggested',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }

      allMatches.sort((a, b) => b.match_score - a.match_score);
      const matches = allMatches.slice(0, MATCH_CONFIG.TOP_MATCHES_PER_STARTUP);
      
      if (matches.length > 0) {
        // Delete old matches, then insert enriched set (deduped by unique constraint)
        await supabase.from('startup_investor_matches').delete().eq('startup_id', startupId);
        const batchSize = 500;
        for (let i = 0; i < matches.length; i += batchSize) {
          const batch = matches.slice(i, i + batchSize);
          const { error: batchErr } = await supabase
            .from('startup_investor_matches')
            .upsert(batch, { onConflict: 'startup_id,investor_id', ignoreDuplicates: false });
          if (batchErr) {
            console.error(`  🔄 [BG] Batch ${i} upsert error: ${batchErr.message}`);
          }
        }
      }
      console.log(`  🔄 [BG] PHASE 3: Re-generated ${matches.length} enriched matches (${investors.length} evaluated)`);
    } else {
      console.log(`  🔄 [BG] PHASE 3: Skipped — no enrichment data changed`);
    }

    // ── Complete lock + log ──
    await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'done', p_run_id: runId }).then(() => {}).catch(() => {});
    const duration = Date.now() - startTime;
    console.log(`  🔄 [BG] COMPLETE in ${duration}ms (phase1: ${Date.now() - phase1Start}ms)`);
    void supabase.from('match_gen_logs').insert({
      startup_id: startupId, run_id: runId,
      event: 'completed', source: genSource,
      candidate_investor_count: allInvestors.length,
      inserted_count: fastMatches.length,
      duration_ms: duration,
    }).then(() => {}).catch(() => {});

    void supabase.from('ai_logs').insert({
      log_type: 'instant_submit',
      action_type: 'background_complete',
      input_data: { url: inputRaw, domain },
      output_data: { startup_id: startupId, match_count: fastMatches.length, duration_ms: duration, data_tier: dataTier },
      created_at: new Date().toISOString()
    }).then(() => {}).catch(() => {});

  } catch (err) {
    console.error(`  🔄 [BG] FATAL: ${err.message}`);
    await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'failed', p_run_id: runId }).then(() => {}).catch(() => {});
    void supabase.from('match_gen_logs').insert({
      startup_id: startupId, run_id: runId,
      event: 'failed', source: genSource,
      reason: err.message,
      duration_ms: Date.now() - startTime,
    }).then(() => {}).catch(() => {});
  }
}

// ============================================================================
// POST /api/instant/submit — PHASE A: fast resolve + create + early return
// ============================================================================
router.post('/submit', async (req, res) => {
  console.error(`🔥 [DEBUG] POST /submit HIT at ${new Date().toISOString()}`); // FORCE DEBUG OUTPUT
  const startTime = Date.now();
  
  try {
    const urlRaw = req.body?.url;
    if (!urlRaw) {
      return res.status(400).json({ error: 'URL required' });
    }
    
    // FAULT TOLERANT INPUT PARSING
    const inputRaw = String(urlRaw).trim();
    const companyName = extractCompanyName(inputRaw);
    const domain = extractDomain(inputRaw);
    const urlNormalized = normalizeUrl(inputRaw);
    
    console.error(`🔥 [DEBUG] Parsed: "${companyName}" / "${domain}"`); // FORCE DEBUG OUTPUT
    console.log(`⚡ [INSTANT] Processing: "${inputRaw}" → company="${companyName}" domain="${domain}"`);
    
    if (!companyName || companyName.length < 2) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please enter a valid company website (e.g., stripe.com)'
      });
    }
    
    // ── Resolve existing startup (fuzzy match) ──
    let startupId = null;
    let startup = null;
    let isNew = false;
    
    const searchPatterns = [
      `website.ilike.%${domain}%`,
      `website.ilike.%${companyName}.%`,
      `name.ilike.%${companyName}%`
    ];
    
    const { data: candidates, error: searchErr } = await supabase
      .from('startup_uploads')
      .select('id, name, website, sectors, stage, total_god_score, status, enrichment_token, data_completeness')
      .or(searchPatterns.join(','))
      .eq('status', 'approved')
      .limit(100);
    
    if (searchErr) console.error(`  ✗ Search error:`, searchErr);
    
    if (candidates && candidates.length > 0) {
      const scored = candidates.map(c => {
        let score = 0;
        const candidateCompanyName = extractCompanyName(c.website || '');
        const candidateNameLower = (c.name || '').toLowerCase();
        if (c.website && normalizeUrl(c.website) === urlNormalized) score = 100;
        else if (candidateCompanyName === companyName) score = 90;
        else if (candidateNameLower.includes(companyName)) score = 70;
        else if (companyName.includes(candidateCompanyName) && candidateCompanyName.length > 2) score = 60;
        else if (c.website && c.website.toLowerCase().includes(companyName)) score = 50;
        return { ...c, matchScore: score };
      });
      scored.sort((a, b) => b.matchScore - a.matchScore);
      if (scored[0].matchScore >= 50) {
        startup = scored[0];
        startupId = startup.id;
        console.log(`  ✓ Found existing startup: ${startup.name} (score: ${scored[0].matchScore})`);
      }
    }
    
    // ── EXISTING STARTUP: check for cached matches ──
    if (startupId) {
      const forceGenerate = req.body?.force_generate === true || req.query?.regen === '1';
      const { count: existingMatchCount } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true })
        .eq('startup_id', startupId)
        .eq('status', 'suggested');
      
      if (existingMatchCount && existingMatchCount >= 20 && !forceGenerate) {
        const { data: existingMatches } = await supabase
          .from('startup_investor_matches')
          .select(`
            id, match_score, reasoning, fit_analysis, confidence_level, why_you_match, created_at,
            investors:investor_id (
              id, name, firm, url, sectors, stage,
              total_investments, active_fund_size, investment_thesis
            )
          `)
          .eq('startup_id', startupId)
          .eq('status', 'suggested')
          .order('match_score', { ascending: false })
          .limit(50);
        
        // Detect stale matches (old scorer = no fit_analysis)
        const staleCount = (existingMatches || []).filter(m => !m.fit_analysis).length;
        const isStale = staleCount > (existingMatches || []).length * 0.5;
        if (isStale) {
          console.log(`  🔄 Stale matches detected (${staleCount}/${existingMatches?.length} without fit_analysis) — triggering background regen`);
          const { data: runId } = await supabase.rpc('try_start_match_gen', {
            p_startup_id: startupId,
            p_cooldown_minutes: 5,
          });
          if (runId) {
            // Defer so HTTP response flushes first
            setTimeout(() => startBackgroundPipeline({
              startupId, domain, inputRaw, genSource: 'stale_regen', runId, startTime
            }), 50);
          }
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`  ⚡ Returned ${existingMatchCount} cached matches in ${processingTime}ms${isStale ? ' (regen queued)' : ''}`);
        
        void supabase.from('match_gen_logs').insert({
          startup_id: startupId, event: 'skipped',
          source: 'rpc', reason: 'existing_matches',
          existing_match_count: existingMatchCount,
          duration_ms: processingTime,
        }).then(() => {}).catch(() => {});
        
        return res.json({
          startup_id: startupId,
          startup,
          matches: existingMatches || [],
          match_count: existingMatchCount,
          is_new: false,
          cached: true,
          regen_queued: isStale,
          processing_time_ms: processingTime
        });
      }
      
      // Has startup but needs match generation — fire background + return
      if (forceGenerate || !existingMatchCount || existingMatchCount < 20) {
        const genSource = forceGenerate ? 'force' : 'rpc';
        const { data: runId } = await supabase.rpc('try_start_match_gen', {
          p_startup_id: startupId,
          p_cooldown_minutes: 5,
        });
        
        if (runId || forceGenerate) {
          // Defer so HTTP response flushes first
          setTimeout(() => startBackgroundPipeline({
            startupId, domain, inputRaw, genSource, runId, startTime
          }), 50);
        }
        
        const processingTime = Date.now() - startTime;
        console.log(`  ⚡ Early return (existing, needs regen) in ${processingTime}ms`);
        
        return res.json({
          startup_id: startupId,
          startup,
          matches: [],
          match_count: existingMatchCount || 0,
          is_new: false,
          gen_in_progress: true,
          processing_time_ms: processingTime
        });
      }
    }
    
    // ── NEW STARTUP: create minimal row + fire background ──
    isNew = true;
    const displayName = domainToName(domain);
    
    // Insert minimal startup row immediately (no scraping, no AI)
    let insertName = displayName;
    const enrichmentToken = crypto.randomUUID(); // Generate unique token for founder enrichment
    let { data: newStartup, error: insertErr } = await supabase
      .from('startup_uploads')
      .insert({
        name: insertName,
        website: `https://${domain}`,
        tagline: `Startup at ${domain}`,
        sectors: ['Technology'],
        stage: 1,
        status: 'approved',
        source_type: 'url',
        enrichment_token: enrichmentToken,
        data_completeness: 15, // Minimal data initially
        // Placeholder GOD score (will be updated by background pipeline)
        total_god_score: 50,
        team_score: 50,
        traction_score: 50,
        market_score: 50,
        product_score: 50,
        vision_score: 50,
        created_at: new Date().toISOString()
      })
      .select('id, name, website, sectors, stage, total_god_score, enrichment_token, data_completeness')
      .single();
    
    // Handle name conflict
    if (insertErr && (insertErr.message?.includes('unique') || insertErr.code === '23505')) {
      insertName = `${displayName} (${domain})`;
      const retry = await supabase
        .from('startup_uploads')
        .insert({
          name: insertName,
          website: `https://${domain}`,
          tagline: `Startup at ${domain}`,
          sectors: ['Technology'],
          stage: 1,
          status: 'approved',
          source_type: 'url',
          enrichment_token: enrichmentToken,
          data_completeness: 15,
          total_god_score: 50,
          team_score: 50,
          traction_score: 50,
          market_score: 50,
          product_score: 50,
          vision_score: 50,
          created_at: new Date().toISOString()
        })
        .select('id, name, website, sectors, stage, total_god_score, enrichment_token, data_completeness')
        .single();
      newStartup = retry.data;
      insertErr = retry.error;
    }
    
    // Race condition fallback — find existing
    if (insertErr) {
      console.error(`  ✗ Insert error: ${insertErr.message}`);
      const { data: found } = await supabase
        .from('startup_uploads')
        .select('id, name, website, sectors, stage, total_god_score, enrichment_token, data_completeness')
        .or(`website.ilike.%${domain}%`)
        .limit(1)
        .single();
      
      if (found) {
        startupId = found.id;
        startup = found;
        isNew = false;
      } else {
        return res.status(500).json({ error: 'Failed to create startup' });
      }
    } else {
      startupId = newStartup.id;
      startup = newStartup;
      console.log(`  ✓ Created minimal startup: ${insertName} (${startupId})`);
    }
    
    // Acquire lock + fire background
    const genSource = isNew ? 'new' : 'rpc';
    const { data: runId } = await supabase.rpc('try_start_match_gen', {
      p_startup_id: startupId,
      p_cooldown_minutes: 5,
    });
    
    // Defer so HTTP response flushes first
    setTimeout(() => startBackgroundPipeline({
      startupId, domain, inputRaw, genSource, runId, startTime
    }), 50);
    
    // Save session pointer
    const sessionId = req.body?.session_id || req.headers['x-session-id'];
    if (sessionId) {
      void supabase.from('temp_match_sessions').insert({
        session_id: sessionId,
        startup_id: startupId,
        startup_name: startup?.name,
        startup_website: startup?.website,
        input_url: inputRaw,
        matches: [],
        match_count: 0,
        top_5_investor_ids: [],
        top_5_investor_names: [],
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }).then(() => {}).catch(() => {});
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`  ⚡ Early return (new startup) in ${processingTime}ms — background pipeline started`);
    
    return res.json({
      startup_id: startupId,
      startup,
      matches: [],
      match_count: 0,
      is_new: true,
      gen_in_progress: true,
      processing_time_ms: processingTime
    });
    
  } catch (err) {
    console.error('[INSTANT] Fatal error:', err);
    return res.status(500).json({
      error: 'Processing failed'
    });
  }
});

/**
 * GET /api/instant/health
 * Quick health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const { count } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    
    res.json({
      status: 'ok',
      active_investors: count,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

/**
 * GET /api/instant/session/:sessionId
 * Retrieve saved match session for returning users
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId || sessionId.length < 10) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }
    
    const { data: sessions, error } = await supabase
      .from('temp_match_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('[SESSION] Retrieval error:', error);
      return res.status(500).json({ error: 'Failed to retrieve session' });
    }
    
    if (!sessions || sessions.length === 0) {
      return res.status(404).json({ error: 'Session not found or expired' });
    }
    
    // Return all sessions for this session ID (user may have scanned multiple startups)
    return res.json({
      session_id: sessionId,
      sessions: sessions.map(s => ({
        startup_id: s.startup_id,
        startup_name: s.startup_name,
        startup_website: s.startup_website,
        input_url: s.input_url,
        matches: s.matches,
        match_count: s.match_count,
        top_5_investor_ids: s.top_5_investor_ids,
        top_5_investor_names: s.top_5_investor_names,
        created_at: s.created_at,
        expires_at: s.expires_at
      })),
      total_scans: sessions.length
    });
    
  } catch (err) {
    console.error('[SESSION] Fatal error:', err);
    return res.status(500).json({ error: 'Session retrieval failed' });
  }
});

/**
 * POST /api/instant/claim-session
 * Associate session matches with authenticated user after signup
 */
router.post('/claim-session', async (req, res) => {
  try {
    const { session_id, user_id } = req.body;
    
    if (!session_id || !user_id) {
      return res.status(400).json({ error: 'session_id and user_id required' });
    }
    
    // Update session with user_id to claim ownership
    const { data, error } = await supabase
      .from('temp_match_sessions')
      .update({ claimed_by_user_id: user_id, claimed_at: new Date().toISOString() })
      .eq('session_id', session_id)
      .is('claimed_by_user_id', null) // Only claim unclaimed sessions
      .select();
    
    if (error) {
      console.error('[CLAIM] Error:', error);
      return res.status(500).json({ error: 'Failed to claim session' });
    }
    
    return res.json({
      success: true,
      claimed_sessions: data?.length || 0,
      message: data?.length > 0 ? 'Session claimed successfully' : 'No unclaimed sessions found'
    });
    
  } catch (err) {
    console.error('[CLAIM] Fatal error:', err);
    return res.status(500).json({ error: 'Claim failed' });
  }
});

module.exports = router;
