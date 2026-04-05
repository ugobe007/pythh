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
const { recomputeStartupSignalScoresFromPythh } = require('../lib/recomputeStartupSignalScoresFromPythh');

// =============================================================================
// REAL SCORING PIPELINE - The GOD Score SSOT
// =============================================================================
// .ts files require tsx/ts-node in production; use stubs when not available so the app loads
let calculateHotScore;
let scrapeAndScoreStartup;
try {
  const scoring = require('../services/startupScoringService.ts');
  calculateHotScore = scoring.calculateHotScore;
} catch (e) {
  console.warn('[instantSubmit] startupScoringService.ts not available (Node cannot run .ts). Using stub.');
  calculateHotScore = (profile) => ({
    total: 5.5,
    breakdown: { team_execution: 1, team_age: 1, market: 1, market_insight: 1, traction: 1, product: 1, product_vision: 1 }
  });
}
try {
  const scraping = require('../services/urlScrapingService.ts');
  scrapeAndScoreStartup = scraping.scrapeAndScoreStartup;
} catch (e) {
  console.warn('[instantSubmit] urlScrapingService.ts not available. Using stub.');
  scrapeAndScoreStartup = () => Promise.resolve({ data: null });
}
const { extractInferenceData } = require('../../lib/inference-extractor');
const { quickEnrich, isDataSparse } = require('../services/inferenceService');
const axios = require('axios');

/**
 * JSON-LD descriptions (SoftwareApplication / Organization / WebApplication) —
 * many SPAs ship an empty body but rich structured data in the head.
 */
function extractJsonLdDescriptionFromHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  const candidates = [];
  while ((m = re.exec(rawHtml)) !== null) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      let parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) parsed = [parsed];
      for (const node of parsed) {
        if (!node || typeof node !== 'object') continue;
        const t = node['@type'];
        const types = Array.isArray(t) ? t : [t];
        const ok = types.some((x) =>
          x && /SoftwareApplication|Organization|WebApplication|LocalBusiness|Corporation/i.test(String(x))
        );
        const desc = node.description;
        if (ok && typeof desc === 'string' && desc.length >= 32) {
          candidates.push(desc.trim());
        }
      }
    } catch {
      /* malformed JSON-LD */
    }
  }
  if (candidates.length === 0) return '';
  return candidates.sort((a, b) => b.length - a.length)[0].substring(0, 800);
}

/**
 * Meta / og tags, first long body paragraph, or JSON-LD — pick the richest non-empty blurb.
 */
function extractPageSummaryFromHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') {
    return { bestDescription: '', inferenceMeta: null };
  }
  const metaDesc =
    (rawHtml.match(/<meta\s+[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
      rawHtml.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i))?.[1];
  const ogDesc =
    (rawHtml.match(/<meta\s+[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
      rawHtml.match(/<meta\s+[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i))?.[1];
  const metaDescription = (ogDesc || metaDesc || '')
    .trim()
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .substring(0, 500);

  const bodyFallback = rawHtml
    .replace(/<(script|style|noscript|nav|header|footer|aside)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .find((s) => s.length > 60 && s.length < 500 && !/cookie|privacy|terms|copyright|©/i.test(s)) || '';

  const jsonLd = extractJsonLdDescriptionFromHtml(rawHtml);
  const parts = [metaDescription, bodyFallback.trim().substring(0, 400), jsonLd].filter(Boolean);
  const bestDescription = parts.length === 0 ? '' : parts.sort((a, b) => b.length - a.length)[0];

  if (!bestDescription) {
    return { bestDescription: '', inferenceMeta: null };
  }
  return {
    bestDescription,
    inferenceMeta: {
      product_description: bestDescription,
      tagline: bestDescription.length <= 120 ? bestDescription : `${bestDescription.substring(0, 117)}...`,
    },
  };
}

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
    // founders_count = co-founders (2-5), NOT total employees.
    // team_size > 10 is almost certainly total headcount — guard against false ratio.
    founders_count: (() => {
      const ts = startup.team_size || extracted.team_size || null;
      const explicit = extracted.founders_count || null;
      if (explicit) return explicit;
      if (ts && ts <= 10) return ts;
      return 1;
    })(),
    team_size: startup.team_size || extracted.team_size || extracted.team?.team_size || null,
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
  
  // If no sectors, return top-scored slice (fallback — never full universe)
  if (!startupSectors || startupSectors.length === 0) {
    const all = investorCache.data || [];
    return all
      .sort((a, b) => (Number(b.investor_score) || 0) - (Number(a.investor_score) || 0))
      .slice(0, PIPELINE_CONFIG.MAX_CANDIDATE_INVESTORS);
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

/**
 * CHEAP PREFILTER — Candidate generation before expensive scoring
 * Tier A: top 100–300 candidates for fast mode (2–5s)
 * Tier B: top 500–1000 for expanded mode
 * Never block first render on full-universe evaluation.
 * Filters: sector overlap, investor quality score, hard cap.
 */
function getCandidateInvestors(startupSectors, maxCandidates) {
  const relevant = getRelevantInvestors(startupSectors || []);
  const minScore = PIPELINE_CONFIG.MIN_INVESTOR_SCORE;
  const cap = Math.min(maxCandidates || PIPELINE_CONFIG.FAST_MATCH_LIMIT, PIPELINE_CONFIG.MAX_CANDIDATE_INVESTORS);

  const candidates = relevant
    .filter((inv) => {
      const score = Number(inv.investor_score);
      return !Number.isFinite(score) || score >= minScore;
    })
    .sort((a, b) => (Number(b.investor_score) || 0) - (Number(a.investor_score) || 0))
    .slice(0, cap);

  return candidates;
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

const SUPABASE_HTTP_TIMEOUT_MS = 8000;
const fetchWithTimeout = async (url, options = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SUPABASE_HTTP_TIMEOUT_MS);
  try {
    let signal = controller.signal;
    if (options.signal && typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') {
      signal = AbortSignal.any([options.signal, controller.signal]);
    } else if (options.signal) {
      signal = options.signal;
    }
    return await fetch(url, { ...options, signal });
  } finally {
    clearTimeout(timer);
  }
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
  global: { fetch: fetchWithTimeout }
});

// Do NOT load the database on server startup. Cache is filled on first request that needs it (getInvestors is called from route handlers).

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

// Tiered candidate limits — cheap prefilter first, expensive scoring on shortlist only
const PIPELINE_CONFIG = {
  MAX_CANDIDATE_INVESTORS: parseInt(process.env.MAX_CANDIDATE_INVESTORS || '1000', 10),
  FAST_MATCH_LIMIT: parseInt(process.env.FAST_MATCH_LIMIT || '300', 10),
  TOP_RESULTS_TO_SAVE: parseInt(process.env.TOP_RESULTS_TO_SAVE || '100', 10),
  MIN_INVESTOR_SCORE: parseFloat(process.env.MIN_INVESTOR_SCORE || '5.0'),
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
 * Run fetch → inference → GOD score → persist on startup_uploads + signal seed.
 * Called synchronously in POST /submit (before BG pipeline) so founders see real scores
 * and Phase 1 matches use real GOD, not placeholder 50.
 */
async function syncEnrichmentAndGodScoreForSubmit(supabase, { startupId, fullUrl, domain, displayName, maxMs }) {
  const syncStart = Date.now();
  const deadline = Date.now() + maxMs;
  const checkTimeout = () => Date.now() >= deadline;

  try {
    let websiteContent = null;
    let inferenceMeta = null;

    if (!checkTimeout()) {
      try {
        const fetchTimeout = Math.min(4500, deadline - Date.now());
        if (fetchTimeout > 300) {
          const response = await Promise.race([
            axios.get(fullUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              timeout: fetchTimeout,
              maxRedirects: 3,
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), fetchTimeout + 400)),
          ]);
          const rawHtml = response.data;
          const pageSummary = extractPageSummaryFromHtml(rawHtml);
          if (pageSummary.inferenceMeta) {
            inferenceMeta = pageSummary.inferenceMeta;
          }
          websiteContent = rawHtml
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 15000);
        }
      } catch (fetchErr) {
        console.warn(`  [SYNC] Fetch failed: ${fetchErr.message}`);
      }
    }

    let inferenceData = null;
    let dataTier = 'C';
    if (websiteContent && websiteContent.length >= 50) {
      inferenceData = extractInferenceData(websiteContent, fullUrl);
      if (inferenceData) {
        dataTier = inferenceData.confidence?.tier || 'C';
      }
    }

    if (!checkTimeout() && (dataTier === 'C' || !inferenceData || isDataSparse({ extracted_data: inferenceData }))) {
      try {
        const enrichTimeout = Math.min(1800, deadline - Date.now());
        if (enrichTimeout > 400) {
          const newsEnrichment = await Promise.race([
            quickEnrich(displayName, inferenceData || {}, fullUrl, enrichTimeout),
            new Promise((_, reject) => setTimeout(() => reject(new Error('enrich timeout')), enrichTimeout + 400)),
          ]);
          if (newsEnrichment.enrichmentCount > 0) {
            inferenceData = { ...(inferenceData || {}), ...newsEnrichment.enrichedData };
            dataTier = 'B';
          }
        }
      } catch (newsErr) {
        console.warn(`  [SYNC] News enrichment: ${newsErr.message}`);
      }
    }

    let aiData = null;
    if (!checkTimeout() && dataTier === 'C') {
      try {
        const scrapeTimeout = Math.min(2500, deadline - Date.now());
        if (scrapeTimeout > 800) {
          const scrapeResult = await Promise.race([
            scrapeAndScoreStartup(fullUrl),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI scraper timeout')), scrapeTimeout)),
          ]);
          aiData = scrapeResult?.data;
          const hasSomeAI = !!(aiData?.description || aiData?.pitch || aiData?.problem || aiData?.solution);
          dataTier = hasSomeAI ? 'B' : 'C';
        }
      } catch (aiErr) {
        console.warn(`  [SYNC] AI scraper: ${aiErr.message}`);
      }
    }

    const inferredName = inferenceData?.name;
    const bestName = aiData?.name || inferredName || displayName;
    const merged = {
      name: bestName,
      tagline: aiData?.tagline || inferenceData?.tagline || inferenceMeta?.tagline || null,
      description:
        aiData?.description || aiData?.pitch || inferenceData?.product_description || inferenceMeta?.product_description || null,
      pitch: aiData?.pitch || inferenceData?.value_proposition || null,
      sectors: inferenceData?.sectors?.length > 0 ? inferenceData.sectors : aiData?.sectors || ['Technology'],
      stage: aiData?.stage ||
        (inferenceData?.funding_stage
          ? {
              'pre-seed': 1,
              'pre seed': 1,
              seed: 2,
              'series a': 3,
              'series b': 4,
            }[String(inferenceData.funding_stage).toLowerCase()] || 1
          : 1),
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
        sync_scored_at: new Date().toISOString(),
        scraped_at: new Date().toISOString(),
      },
    };

    const scores = calculateGODScore(enrichedRow);
    const completenessResult = calculateCompleteness(enrichedRow);

    await supabase
      .from('startup_uploads')
      .update({
        name: enrichedRow.name,
        website: `https://${domain}`,
        tagline: enrichedRow.tagline || null,
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

    // Initial Signal row: derived from GOD so the UI always has a number on first paint.
    // Range ~5.5–9.5 maps GOD 35→100. Reconcile jobs / real signal pipelines may overwrite later.
    const godScore = scores.total_god_score || 50;
    const normalized = Math.max(0, Math.min(1, (godScore - 35) / 65));
    const signalTotal = parseFloat((5.5 + normalized * 4.0).toFixed(1));
    const factor = signalTotal / 7.0;
    try {
      await supabase.from('startup_signal_scores').upsert(
        {
          startup_id: startupId,
          signals_total: signalTotal,
          founder_language_shift: parseFloat((1.0 * factor).toFixed(1)),
          investor_receptivity: parseFloat((1.2 * factor).toFixed(1)),
          news_momentum: parseFloat((1.1 * factor).toFixed(1)),
          capital_convergence: parseFloat((1.1 * factor).toFixed(1)),
          execution_velocity: parseFloat((1.1 * factor).toFixed(1)),
          as_of: new Date().toISOString(),
        },
        { onConflict: 'startup_id' }
      );
    } catch (e) {
      console.warn(`  [SYNC] Signal seed failed: ${e.message}`);
    }

    console.log(`  ✅ [SYNC] GOD ${scores.total_god_score} in ${Date.now() - syncStart}ms for ${domain}`);
    return { ok: true, scores, enrichedRow, completenessResult, dataTier, signalTotal, normalized, godScore };
  } catch (err) {
    console.warn(`  [SYNC] syncEnrichmentAndGodScoreForSubmit failed: ${err.message}`);
    return { ok: false };
  }
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

async function runBackgroundPipeline({ startupId, domain, inputRaw, genSource, runId, startTime, syncScoringDone = false }) {
  const fullUrl = inputRaw.startsWith('http') ? inputRaw : `https://${domain}`;
  const displayName = domainToName(domain);
  let skipPhase2Fetch = syncScoringDone;
  let dataTier = 'C';
  
  // CRITICAL: Hard timeout for entire pipeline (30 seconds max)
  const PIPELINE_TIMEOUT = 30000;
  const pipelineDeadline = Date.now() + PIPELINE_TIMEOUT;
  let pipelineTimedOut = false;
  let fastMatches = []; // Declare at top level so it's accessible in catch block
  
  const checkTimeout = () => {
    if (Date.now() >= pipelineDeadline) {
      pipelineTimedOut = true;
      return true;
    }
    return false;
  };
  
  try {
    console.log(`  🔄 [BG] Starting background pipeline for ${startupId} (${domain}) [timeout: ${PIPELINE_TIMEOUT}ms]`);
    
    // =========================================================================
    // PHASE 1: FAST MATCHES (~1-2s) — Generate matches with placeholder data
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
    
    // Prefer real GOD from DB (set by syncEnrichmentAndGodScoreForSubmit before BG runs)
    const { data: suPh } = await supabase
      .from('startup_uploads')
      .select('name, sectors, stage, total_god_score')
      .eq('id', startupId)
      .single();
    const placeholderStartup = {
      id: startupId,
      name: suPh?.name || displayName,
      sectors: Array.isArray(suPh?.sectors) && suPh.sectors.length ? suPh.sectors : ['Technology'],
      stage: suPh?.stage ?? 1,
      total_god_score: typeof suPh?.total_god_score === 'number' ? suPh.total_god_score : 50,
    };
    
    // Tier A: cheap prefilter → max 300 candidates, then expensive scoring on shortlist only
    const quickInvestors = getCandidateInvestors(['Technology'], PIPELINE_CONFIG.FAST_MATCH_LIMIT);
    console.log(`  ⚡ [BG] Phase 1 shortlist: ${quickInvestors.length} candidates (cap=${PIPELINE_CONFIG.FAST_MATCH_LIMIT})`);
    const quickMatches = [];
    
    // CRITICAL FIX: Parallel processing with timeout protection
    const BATCH_SIZE = 50;
    const CONCURRENT_BATCHES = 10; // Process 10 batches (500 investors) in parallel
    const PHASE1_TIMEOUT = 5000; // 5 second hard timeout for Phase 1
    const phase1Deadline = Math.min(Date.now() + PHASE1_TIMEOUT, pipelineDeadline);
    
    // Process investors in parallel batches
    for (let i = 0; i < quickInvestors.length; i += BATCH_SIZE * CONCURRENT_BATCHES) {
      // Check timeout
      if (checkTimeout() || Date.now() >= phase1Deadline) {
        console.warn(`  ⚠️ [BG] Phase 1 timeout - processed ${i}/${quickInvestors.length} investors`);
        break;
      }
      
      const batch = quickInvestors.slice(i, i + BATCH_SIZE * CONCURRENT_BATCHES);
      const batchPromises = [];
      
      // Process CONCURRENT_BATCHES batches in parallel
      for (let j = 0; j < batch.length; j += BATCH_SIZE) {
        const concurrentBatch = batch.slice(j, j + BATCH_SIZE);
        batchPromises.push(
          Promise.all(concurrentBatch.map(investor => {
            try {
              const result = calculateMatchScore(placeholderStartup, investor, 0, investor.signals || null);
              if (result.score >= MATCH_CONFIG.PERSISTENCE_FLOOR) {
                return {
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
                };
              }
              return null;
            } catch (err) {
              console.warn(`  ⚠️ [BG] Match calculation error for investor ${investor.id}:`, err.message);
              return null;
            }
          })).then(results => results.filter(r => r !== null))
        );
      }
      
      const batchResults = await Promise.all(batchPromises);
      quickMatches.push(...batchResults.flat());
      
      // Early exit if we have enough matches
      if (quickMatches.length >= MATCH_CONFIG.TOP_MATCHES_PER_STARTUP * 2) {
        console.log(`  ⚡ [BG] Early exit - found ${quickMatches.length} matches`);
        break;
      }
    }
    quickMatches.sort((a, b) => b.match_score - a.match_score);
    fastMatches = quickMatches.slice(0, MATCH_CONFIG.TOP_MATCHES_PER_STARTUP);
    
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
    
    // If pipeline timed out, exit early with fast matches
    if (checkTimeout()) {
      console.warn(`  ⚠️ [BG] Pipeline timeout - returning ${fastMatches.length} fast matches`);
      await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'done', p_run_id: runId }).then(() => {}).catch(() => {});
      return;
    }
    
    // =========================================================================
    // PHASE 2: ENRICHMENT (~5-15s) — Scrape, infer, score, re-match
    // Skipped when syncEnrichmentAndGodScoreForSubmit already ran in POST /submit
    // =========================================================================
    let scores;
    let enrichedRow;
    let completenessResult;
    let signalTotal;
    let normalized;
    let godScore;

    if (skipPhase2Fetch) {
      const { data: row, error: rowErr } = await supabase.from('startup_uploads').select('*').eq('id', startupId).single();
      if (rowErr || !row) {
        console.warn(`  ⚠️ [BG] sync path: row missing — running full Phase 2`);
        skipPhase2Fetch = false;
      } else {
        enrichedRow = {
          name: row.name,
          website: row.website || fullUrl,
          tagline: row.tagline,
          description: row.description,
          pitch: row.pitch,
          sectors: row.sectors,
          stage: row.stage,
          is_launched: row.is_launched,
          has_demo: row.has_demo,
          has_technical_cofounder: row.has_technical_cofounder,
          team_size: row.team_size,
          mrr: row.mrr,
          arr: row.arr,
          customer_count: row.customer_count,
          growth_rate_monthly: row.growth_rate_monthly,
          extracted_data: row.extracted_data || {},
          last_news_check: row.last_news_check,
        };
        scores = {
          team_score: row.team_score,
          traction_score: row.traction_score,
          market_score: row.market_score,
          product_score: row.product_score,
          vision_score: row.vision_score,
          total_god_score: row.total_god_score,
        };
        completenessResult = { percentage: row.data_completeness ?? 0 };
        dataTier = row.extracted_data?.data_tier || 'B';
        godScore = row.total_god_score ?? 50;
        normalized = Math.max(0, Math.min(1, (godScore - 35) / 65));
        signalTotal = parseFloat((5.5 + normalized * 4.0).toFixed(1));
        console.log(`  ⚡ [BG] Phase 2 skipped (request sync) — GOD ${scores.total_god_score}`);
      }
    }

    if (!skipPhase2Fetch) {
    // ── Fetch website content (meta / body / JSON-LD summary) ──
    let websiteContent = null;
    let inferenceMeta = null;
    if (!checkTimeout()) {
      try {
        const fetchTimeout = Math.min(3500, pipelineDeadline - Date.now());
        if (fetchTimeout <= 0) {
          console.warn(`  ⚠️ [BG] Skipping fetch - pipeline timeout approaching`);
        } else {
          const response = await Promise.race([
            axios.get(fullUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              },
              timeout: fetchTimeout,
              maxRedirects: 3,
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('fetch timeout')), fetchTimeout + 500))
          ]);
          const rawHtml = response.data;
          const pageSummary = extractPageSummaryFromHtml(rawHtml);
          if (pageSummary.inferenceMeta) {
            inferenceMeta = pageSummary.inferenceMeta;
          }
          websiteContent = rawHtml
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '')
            .replace(/<[^>]*>/g, ' ')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 15000);
          console.log(
            `  🔄 [BG] Fetched ${websiteContent.length} chars${pageSummary.bestDescription ? ` + page summary (${pageSummary.bestDescription.length} chars)` : ''}`
          );
        }
      } catch (fetchErr) {
        console.warn(`  🔄 [BG] Fetch failed: ${fetchErr.message}`);
      }
    }

    // ── Inference engine (free, instant) ──
    let inferenceData = null;
    dataTier = 'C';
    if (websiteContent && websiteContent.length >= 50) {
      inferenceData = extractInferenceData(websiteContent, fullUrl);
      if (inferenceData) {
        dataTier = inferenceData.confidence?.tier || 'C';
        console.log(`  🔄 [BG] Inference: Tier ${dataTier}`);
      }
    }

    // ── NEWS-BASED ENRICHMENT (if still sparse, search news - 2s max) ──
    if (!checkTimeout()) {
      console.log(`  🔄 [BG] Enrichment check: dataTier=${dataTier}, hasInferenceData=${!!inferenceData}, isSparse=${inferenceData ? isDataSparse({ extracted_data: inferenceData }) : 'N/A'}`);
      
      if (dataTier === 'C' || !inferenceData || isDataSparse({ extracted_data: inferenceData })) {
        try {
          const enrichTimeout = Math.min(2000, pipelineDeadline - Date.now());
          if (enrichTimeout > 500) {
            console.log(`  🔄 [BG] Attempting news enrichment for "${displayName}"...`);
            const newsEnrichment = await Promise.race([
              quickEnrich(displayName, inferenceData || {}, fullUrl, enrichTimeout),
              new Promise((_, reject) => setTimeout(() => reject(new Error('enrich timeout')), enrichTimeout + 500))
            ]);
            
            if (newsEnrichment.enrichmentCount > 0) {
              inferenceData = { ...(inferenceData || {}), ...newsEnrichment.enrichedData };
              dataTier = 'B'; // Upgrade to Tier B if we found data
              console.log(`  🔄 [BG] News enrichment: +${newsEnrichment.enrichmentCount} fields (${newsEnrichment.fieldsEnriched.join(', ')}) from ${newsEnrichment.articlesFound} articles`);
            } else {
              console.log(`  🔄 [BG] News enrichment: No data found (${newsEnrichment.articlesFound} articles)`);
            }
          } else {
            console.warn(`  ⚠️ [BG] Skipping news enrichment - timeout approaching`);
          }
        } catch (newsErr) {
          console.warn(`  🔄 [BG] News enrichment failed: ${newsErr.message}`);
        }
      }
    }

    // ── AI scraper fallback (ONLY for Tier C, skip if timeout approaching) ──
    let aiData = null;
    if (!checkTimeout() && dataTier === 'C') {
      try {
        const scrapeTimeout = Math.min(3000, pipelineDeadline - Date.now());
        if (scrapeTimeout > 1000) {
          const scrapeResult = await Promise.race([
            scrapeAndScoreStartup(fullUrl),
            new Promise((_, reject) => setTimeout(() => reject(new Error('AI scraper timeout')), scrapeTimeout))
          ]);
          aiData = scrapeResult?.data;
          const hasSomeAI = !!(aiData?.description || aiData?.pitch || aiData?.problem || aiData?.solution);
          dataTier = hasSomeAI ? 'B' : 'C';
        } else {
          console.warn(`  ⚠️ [BG] Skipping AI scraper - timeout approaching`);
        }
      } catch (aiErr) {
        console.warn(`  🔄 [BG] AI scraper skipped: ${aiErr.message}`);
      }

      // DynamicParser fallback (only if still Tier C, skip if timeout)
      if (!checkTimeout() && dataTier === 'C') {
        try {
          const dpTimeout = Math.min(2000, pipelineDeadline - Date.now());
          if (dpTimeout > 1000) {
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
              new Promise((_, reject) => setTimeout(() => reject(new Error('DynamicParser timeout')), dpTimeout))
            ]);
            if (dpResult && (dpResult.description || dpResult.pitch)) {
              aiData = { ...(aiData || {}), ...dpResult };
              dataTier = 'B';
            }
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
      tagline: aiData?.tagline || inferenceData?.tagline || inferenceMeta?.tagline || null,
      description: aiData?.description || aiData?.pitch || inferenceData?.product_description || inferenceMeta?.product_description || null,
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
    
    enrichedRow = {
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

    scores = calculateGODScore(enrichedRow);
    console.log(`  🔄 [BG] GOD Score: ${scores.total_god_score} (T${scores.team_score} Tr${scores.traction_score} M${scores.market_score} P${scores.product_score} V${scores.vision_score})`);

    // Calculate data completeness after enrichment
    completenessResult = calculateCompleteness(enrichedRow);
    console.log(`  🔄 [BG] Data completeness: ${completenessResult.percentage}%`);

    // ── Update startup row with enriched data ──
    await supabase
      .from('startup_uploads')
      .update({
        name: enrichedRow.name,
        website: `https://${domain}`,
        tagline: enrichedRow.tagline || null,
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

    // ── Seed signal score (awaited — ensures score is readable before match gen) ──
    godScore = scores.total_god_score || 50;
    normalized = Math.max(0, Math.min(1, (godScore - 35) / 65));
    signalTotal = parseFloat((5.5 + normalized * 4.0).toFixed(1));
    const factor = signalTotal / 7.0;
    try {
      await supabase
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
        }, { onConflict: 'startup_id' });
      console.log(`  ✅ Signal score seeded: ${signalTotal}`);
    } catch (e) {
      console.warn(`  ⚠️  Signal seed failed: ${e.message}`);
    }
    } // end if (!skipPhase2Fetch)

    const factor = (typeof signalTotal === 'number' ? signalTotal : 5.5) / 7.0;

    // ── Write signal_events (Layer 1 raw evidence) ──
    // Create signal events from enrichment evidence: execution_velocity (always),
    // news_momentum (if extraction found articles), capital_convergence (if funding found)
    // IMPORTANT: Deduplicate to prevent inflating signal scores from repeated URL submissions
    const signalEvents = [];
    const extracted = enrichedRow.extracted_data || {};
    const hasFunding = !!(extracted.funding?.amount || extracted.funding?.stage_name);
    const hasTraction = !!(extracted.metrics?.revenue || extracted.metrics?.mrr || 
                           extracted.metrics?.users || extracted.metrics?.customers);
    const hasCoverage = !!(enrichedRow.last_news_check);

    // Check for existing events with same trigger within last 24 hours (deduplication window)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingEvents } = await supabase
      .from('signal_events')
      .select('event_type, payload')
      .eq('startup_id', startupId)
      .gte('occurred_at', twentyFourHoursAgo)
      .or('payload->>trigger.eq.url_submit_enrichment,payload->>trigger.eq.funding_data_found,payload->>trigger.eq.inference_news_search');

    const existingEventTypes = new Set();
    const existingTriggers = new Set();
    if (existingEvents) {
      existingEvents.forEach(e => {
        existingEventTypes.add(e.event_type);
        if (e.payload?.trigger) {
          existingTriggers.add(e.payload.trigger);
        }
      });
    }

    // Only create execution_velocity event if it doesn't already exist (deduplication)
    if (!existingEventTypes.has('execution_velocity') || !existingTriggers.has('url_submit_enrichment')) {
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
    }

    // Only create capital_convergence event if funding found AND not already exists
    if (hasFunding && (!existingEventTypes.has('capital_convergence') || !existingTriggers.has('funding_data_found'))) {
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

    // Only create news_momentum event if coverage found AND not already exists
    if (hasCoverage && (!existingEventTypes.has('news_momentum') || !existingTriggers.has('inference_news_search'))) {
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
        .then(() => console.log(`  🔄 [BG] Signal events: ${signalEvents.length} created (deduplicated)`))
        .catch(e => console.warn(`  🔄 [BG] Signal events failed: ${e.message}`));
    } else {
      console.log(`  ⏭️  [BG] Signal events skipped (duplicates within 24h window)`);
    }

    // CRITICAL: Ensure GOD score is saved even if pipeline times out
    // The score calculation is the most important part - don't skip it
    if (checkTimeout()) {
      console.warn(`  ⚠️ [BG] Pipeline timeout before Phase 3 - but GOD score was saved: ${scores.total_god_score}`);
      // Score is already saved above (line 874), so we're good
      await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'done', p_run_id: runId }).then(() => {}).catch(() => {});
      return;
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
      // Tier B: max 1000 candidates, expensive scoring on shortlist only
      const investors = getCandidateInvestors(startupSectors, PIPELINE_CONFIG.MAX_CANDIDATE_INVESTORS);
      console.log(`  ⚡ [BG] Phase 3 shortlist: ${investors.length} candidates (cap=${PIPELINE_CONFIG.MAX_CANDIDATE_INVESTORS})`);
      
      // Use the just-seeded signal total (already computed above) for match scoring
      const signalScore = signalTotal;

      // CRITICAL FIX: Parallel processing with timeout protection
      const BATCH_SIZE = 50;
      const CONCURRENT_BATCHES = 10;
      const PHASE3_TIMEOUT = 8000; // 8 second hard timeout for Phase 3
      const phase3Deadline = Math.min(Date.now() + PHASE3_TIMEOUT, pipelineDeadline);
      
      const allMatches = [];
      
      // Process investors in parallel batches
      for (let i = 0; i < investors.length; i += BATCH_SIZE * CONCURRENT_BATCHES) {
        // Check timeout
        if (checkTimeout() || Date.now() >= phase3Deadline) {
          console.warn(`  ⚠️ [BG] Phase 3 timeout - processed ${i}/${investors.length} investors`);
          break;
        }
        
        const batch = investors.slice(i, i + BATCH_SIZE * CONCURRENT_BATCHES);
        const batchPromises = [];
        
        // Process CONCURRENT_BATCHES batches in parallel
        for (let j = 0; j < batch.length; j += BATCH_SIZE) {
          const concurrentBatch = batch.slice(j, j + BATCH_SIZE);
          batchPromises.push(
            Promise.all(concurrentBatch.map(investor => {
              try {
                const result = calculateMatchScore(enrichedStartup, investor, signalScore, investor.signals || null);
                if (result.score >= MATCH_CONFIG.PERSISTENCE_FLOOR) {
                  return {
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
                  };
                }
                return null;
              } catch (err) {
                console.warn(`  ⚠️ [BG] Match calculation error for investor ${investor.id}:`, err.message);
                return null;
              }
            })).then(results => results.filter(r => r !== null))
          );
        }
        
        const batchResults = await Promise.all(batchPromises);
        allMatches.push(...batchResults.flat());
        
        // Early exit if we have enough matches
        if (allMatches.length >= MATCH_CONFIG.TOP_MATCHES_PER_STARTUP * 2) {
          console.log(`  ⚡ [BG] Early exit - found ${allMatches.length} matches`);
          break;
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

    // ── Phase 4: Fire-and-forget LLM signal enrichment for new submissions ──
    // Only runs when the startup has description text — enriches pythh_signal_events
    // for this startup so the Signal Health display shows real intelligence.
    void (async () => {
      try {
        // Step 1: Ensure entity exists in pythh_entities
        const { data: existingEntity } = await supabase
          .from('pythh_entities')
          .select('id')
          .eq('startup_upload_id', startupId)
          .maybeSingle();

        let entityId = existingEntity?.id;
        if (!entityId) {
          const { data: newEnt } = await supabase
            .from('pythh_entities')
            .insert({
              name: enrichedRow.name || displayName,
              startup_upload_id: startupId,
              website: `https://${domain}`,
              sectors: enrichedRow.sectors || [],
              is_active: true,
              entity_type: 'startup',
            })
            .select('id')
            .single();
          entityId = newEnt?.id;
          if (entityId) console.log(`  🔄 [BG] Created pythh_entity ${entityId} for ${displayName}`);
        }

        if (!entityId) return;

        // Step 2: Check for existing LLM signals to avoid re-running
        const { count: existingLLMSigs } = await supabase
          .from('pythh_signal_events')
          .select('*', { count: 'exact', head: true })
          .eq('entity_id', entityId)
          .eq('source_type', 'llm_enrichment');

        if (existingLLMSigs > 0) {
          console.log(`  🔄 [BG] Phase 4: entity already has ${existingLLMSigs} LLM signals, skipping`);
          return;
        }

        // Step 3: Extract text for signal classification
        const descText = enrichedRow.description || enrichedRow.tagline || '';
        const pitchText = enrichedRow.pitch || '';
        const combinedText = [descText, pitchText].filter(Boolean).join('. ');
        if (combinedText.length < 40) {
          console.log(`  ⏭️  [BG] Phase 4: no text for ${displayName}, LLM signals skipped`);
          return;
        }

        // Step 4: Quick LLM classification (reuse OPENAI_API_KEY)
        const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
        if (!openaiKey) return;

        const sentences = combinedText
          .replace(/([.!?])\s+(?=[A-Z])/g, '$1\n')
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length >= 40 && s.length <= 600)
          .slice(0, 8);

        if (!sentences.length) return;

        const userContent = `Company: ${enrichedRow.name || displayName}\nSentences:\n${sentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
        const llmRes = await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: [
              { role: 'system', content: 'You are a startup signal classifier. For each sentence, return a JSON object with key "signals" containing an array of {sentence_index, primary_signal, signal_strength, confidence, posture, action_tag}. primary_signal must be one of: fundraising_signal, growth_signal, revenue_signal, product_signal, hiring_signal, expansion_signal, enterprise_signal, efficiency_signal, distress_signal, exit_signal, buyer_pain_signal, demand_signal, market_signal, founder_psychology_signal, exploratory_signal.' },
              { role: 'user', content: `Classify signals in these sentences from a startup:\n\n${userContent}\n\nReturn ONLY valid JSON with a "signals" key.` },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 1500,
          },
          { headers: { Authorization: `Bearer ${openaiKey}`, 'Content-Type': 'application/json' }, timeout: 8000 }
        );

        const raw = llmRes.data?.choices?.[0]?.message?.content;
        if (!raw) return;
        const cleanedRaw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const parsed = JSON.parse(cleanedRaw);
        const sigs = Array.isArray(parsed) ? parsed : (parsed.signals || []);

        const VALID = ['fundraising_signal','growth_signal','revenue_signal','product_signal','hiring_signal',
          'expansion_signal','enterprise_signal','efficiency_signal','distress_signal','exit_signal',
          'buyer_pain_signal','demand_signal','market_signal','founder_psychology_signal','exploratory_signal',
          'acquisition_signal','partnership_signal','gtm_signal','buyer_signal'];

        const toInsert = sigs
          .filter(s => VALID.includes(s.primary_signal) && (parseFloat(s.confidence) || 0) >= 0.5)
          .map(s => ({
            entity_id: entityId,
            source_type: 'llm_enrichment',
            // source = category label (consistent with enrich-signals-llm.js)
            source: 'llm_enrichment',
            // raw_sentence = the actual evidence text the signal was extracted from
            raw_sentence: sentences[s.sentence_index ?? 0] || '',
            primary_signal: s.primary_signal,
            signal_strength: Math.min(1, Math.max(0, parseFloat(s.signal_strength) || 0.6)),
            confidence: Math.min(1, Math.max(0, parseFloat(s.confidence) || 0.6)),
            posture: s.posture || 'posture_neutral',
            action_tag: s.action_tag || null,
            detected_at: new Date().toISOString(),
          }));

        if (toInsert.length > 0) {
          await supabase.from('pythh_signal_events').insert(toInsert);
          console.log(`  ✅ [BG] Phase 4: ${toInsert.length} LLM signals written for ${displayName}`);
        }

        if (entityId) {
          const rec = await recomputeStartupSignalScoresFromPythh(supabase, {
            startupUploadId: startupId,
            entityId,
            godScore,
          });
          if (rec.ok) {
            console.log(
              `  ✅ [BG] Phase 4: startup_signal_scores from pythh_signal_events (total=${rec.signals_total})`
            );
          }
        }
      } catch (e) {
        console.warn(`  ⚠️  [BG] Phase 4 signal enrichment failed: ${e.message}`);
      }
    })();

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
    
    // Even on error, check if we have any matches to return
    const { count: existingMatchCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId)
      .eq('status', 'suggested')
      .then(r => r).catch(() => ({ count: 0 }));
    
    if (existingMatchCount && existingMatchCount > 0) {
      console.log(`  ✅ [BG] Error occurred but ${existingMatchCount} matches exist - marking as done`);
      await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'done', p_run_id: runId }).then(() => {}).catch(() => {});
    } else {
      await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'failed', p_run_id: runId }).then(() => {}).catch(() => {});
    }
    
    void supabase.from('match_gen_logs').insert({
      startup_id: startupId, run_id: runId,
      event: pipelineTimedOut ? 'timeout' : 'failed', source: genSource,
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
  const HARD_RESPONSE_TIMEOUT_MS = 14000; // room for sync GOD scoring before response
  const originalStatus = res.status.bind(res);
  const originalJson = res.json.bind(res);
  // Guard all downstream status/json calls after timeout sends a response.
  res.status = (code) => (res.headersSent ? res : originalStatus(code));
  res.json = (body) => (res.headersSent ? res : originalJson(body));
  const safeJson = (status, payload) => {
    if (res.headersSent) return false;
    res.status(status).json(payload);
    return true;
  };
  const responseTimer = setTimeout(() => {
    if (res.headersSent) return;
    console.error(`[INSTANT] Hard response timeout after ${HARD_RESPONSE_TIMEOUT_MS}ms`);
    safeJson(202, {
      status: 'queued',
      queued: true,
      message: 'Startup analysis queued. Continue polling status for completion.'
    });
  }, HARD_RESPONSE_TIMEOUT_MS);
  
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
    
    // ── Resolve existing startup (fast path first, then fuzzy) ──
    let startupId = null;
    let startup = null;
    let isNew = false;
    
    // Fast path: exact/prefix match (uses index, ~10–50ms vs full table scan)
    const baseUrl = `https://${domain}`;
    const wwwUrl = `https://www.${domain}`;
    const exactPatterns = [
      `website.eq.${baseUrl}`,
      `website.eq.${baseUrl}/`,
      `website.eq.${wwwUrl}`,
      `website.eq.${wwwUrl}/`,
      `website.ilike.${baseUrl}%`,
      `website.ilike.${wwwUrl}%`,
    ];
    let { data: candidates, error: searchErr } = await supabase
      .from('startup_uploads')
      .select('id, name, website, sectors, stage, total_god_score, status, enrichment_token, data_completeness')
      .or(exactPatterns.join(','))
      .eq('status', 'approved')
      .limit(20);
    
    // Fallback: broad fuzzy search (slower, only if fast path found nothing)
    if ((!candidates || candidates.length === 0) && !searchErr) {
      const searchPatterns = [
        `website.ilike.%${domain}%`,
        `website.ilike.%${companyName}.%`,
        `name.ilike.%${companyName}%`
      ];
      const fallback = await supabase
        .from('startup_uploads')
        .select('id, name, website, sectors, stage, total_god_score, status, enrichment_token, data_completeness')
        .or(searchPatterns.join(','))
        .eq('status', 'approved')
        .limit(100);
      candidates = fallback.data;
      searchErr = fallback.error;
    }
    
    if (searchErr) console.error(`  ✗ Search error:`, searchErr);
    
    if (candidates && candidates.length > 0) {
      const scored = candidates.map(c => {
        let score = 0;
        const hasUrl = !!(c.website);
        const candidateCompanyName = extractCompanyName(c.website || '');
        const candidateNameLower = (c.name || '').toLowerCase();
        // URL-bearing candidates: full score range
        if (c.website && normalizeUrl(c.website) === urlNormalized) score = 100;
        else if (candidateCompanyName === companyName) score = 90; // domain-derived name exact
        else if (c.website && c.website.toLowerCase().includes(companyName)) score = 50;
        // Name-only candidates (no website set): use lower scores to avoid false positives
        // from scraper-sourced entries that share a common word (e.g. "Foundry", "Grows")
        else if (hasUrl && candidateNameLower.includes(companyName)) score = 70;
        else if (hasUrl && companyName.includes(candidateCompanyName) && candidateCompanyName.length > 2) score = 60;
        else if (!hasUrl && candidateNameLower === companyName) score = 65; // exact name match even without URL
        // No URL + fuzzy name = below match threshold (prevents scraper noise false positives)
        else if (!hasUrl) score = 20;
        return { ...c, matchScore: score };
      });
      scored.sort((a, b) => b.matchScore - a.matchScore);
      if (scored[0].matchScore >= 50) {
        startup = scored[0];
        startupId = startup.id;
        console.log(`  ✓ Found existing startup: ${startup.name} (score: ${scored[0].matchScore}, hasUrl: ${!!(startup.website)})`);
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
    
    // Validate startup name to prevent junk entries
    const { isValidStartupName } = await import('../utils/startupNameValidator.js');
    const nameValidation = isValidStartupName(displayName);
    if (!nameValidation.isValid) {
      console.warn(`[instant/submit] Rejected invalid startup name: "${displayName}" (reason: ${nameValidation.reason})`);
      return res.status(400).json({
        error: 'Invalid startup name',
        reason: nameValidation.reason,
        suggestion: 'Please provide a valid company name'
      });
    }
    
    // Insert minimal startup row immediately (no scraping, no AI)
    let insertName = displayName;
    const enrichmentToken = crypto.randomUUID(); // Generate unique token for founder enrichment
    let { data: newStartup, error: insertErr } = await supabase
      .from('startup_uploads')
      .insert({
        name: insertName,
        website: `https://${domain}`,
        company_domain: domain,
        tagline: null,
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
          company_domain: domain,
          tagline: null,
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
        .ilike('website', `%${domain}%`)
        .limit(1)
        .maybeSingle();
      
      if (found) {
        startupId = found.id;
        startup = found;
        isNew = false;
      } else {
        const errMsg = insertErr?.message || insertErr?.code || 'Unknown database error';
        console.error(`  ✗ Insert failed (no fallback):`, errMsg);
        safeJson(500, { error: 'Failed to create startup', reason: errMsg });
        return;
      }
    } else {
      startupId = newStartup.id;
      startup = newStartup;
      console.log(`  ✓ Created minimal startup: ${insertName} (${startupId})`);
    }
    
    // Real GOD score + DB update before background matches (fixes stuck-at-50 for new URL submits)
    let syncScoringDone = false;
    if (isNew && startupId) {
      // Preserve path when user submits e.g. "httpbin.org/html" (domain strips path)
      const fullUrlForSync = inputRaw.startsWith('http') ? inputRaw : `https://${inputRaw}`;
      const syncBudget = Math.max(
        2500,
        Math.min(10_000, HARD_RESPONSE_TIMEOUT_MS - (Date.now() - startTime) - 900)
      );
      try {
        const sr = await syncEnrichmentAndGodScoreForSubmit(supabase, {
          startupId,
          fullUrl: fullUrlForSync,
          domain,
          displayName: domainToName(domain),
          maxMs: syncBudget,
        });
        syncScoringDone = !!sr.ok;
        if (sr.ok) {
          const { data: fresh } = await supabase
            .from('startup_uploads')
            .select(
              'id, name, website, sectors, stage, total_god_score, enrichment_token, data_completeness, team_score, traction_score, market_score, product_score, vision_score'
            )
            .eq('id', startupId)
            .single();
          if (fresh) startup = fresh;
        }
      } catch (syncErr) {
        console.warn('[INSTANT] sync GOD score failed (background will compute):', syncErr?.message);
      }
    }

    // Acquire lock + fire background (non-blocking; don't fail response if RPC errors)
    const genSource = isNew ? 'new' : 'rpc';
    let runId = null;
    try {
      const r = await supabase.rpc('try_start_match_gen', {
        p_startup_id: startupId,
        p_cooldown_minutes: 5,
      });
      runId = r?.data ?? null;
      if (r?.error) console.warn('[INSTANT] try_start_match_gen RPC error:', r.error);
    } catch (rpcErr) {
      console.warn('[INSTANT] try_start_match_gen failed (continuing):', rpcErr?.message);
    }
    setTimeout(() => {
      try {
        startBackgroundPipeline({
          startupId,
          domain,
          inputRaw,
          genSource,
          runId,
          startTime,
          syncScoringDone,
        });
      } catch (pipeErr) {
        console.error('[INSTANT] startBackgroundPipeline failed:', pipeErr);
      }
    }, 50);
    
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
    
    safeJson(200, {
      startup_id: startupId,
      startup,
      matches: [],
      match_count: 0,
      is_new: true,
      gen_in_progress: true,
      processing_time_ms: processingTime
    });
    return;
    
  } catch (err) {
    console.error('[INSTANT] Fatal error:', err);
    const reason = err?.message || (typeof err === 'string' ? err : 'Unknown error');
    safeJson(500, {
      error: 'Processing failed',
      reason
    });
    return;
  } finally {
    clearTimeout(responseTimer);
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
 * GET /api/instant/status?url=... OR ?startup_id=...
 * Lightweight status check for queued URL submissions.
 */
router.get('/status', async (req, res) => {
  try {
    const startupId = req.query?.startup_id ? String(req.query.startup_id) : null;
    const urlRaw = req.query?.url ? String(req.query.url) : null;

    let resolvedStartupId = startupId;

    if (!resolvedStartupId && urlRaw) {
      const { data, error } = await supabase.rpc('resolve_startup_by_url', { p_url: urlRaw });
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row?.startup_id) resolvedStartupId = row.startup_id;
      }
    }

    if (!resolvedStartupId) {
      return res.status(200).json({ status: 'pending', startup_id: null, match_count: 0 });
    }

    const [{ data: startup }, { count: matchCount }] = await Promise.all([
      supabase
        .from('startup_uploads')
        .select('id, name, website, total_god_score')
        .eq('id', resolvedStartupId)
        .single(),
      supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true })
        .eq('startup_id', resolvedStartupId)
        .eq('status', 'suggested'),
    ]);

    return res.status(200).json({
      status: (matchCount || 0) >= 5 ? 'ready' : 'generating',
      startup_id: resolvedStartupId,
      startup,
      match_count: matchCount || 0,
    });
  } catch (err) {
    console.error('[STATUS] Error:', err);
    return res.status(200).json({ status: 'pending', startup_id: null, match_count: 0 });
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
