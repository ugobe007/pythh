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
const { createClient } = require('@supabase/supabase-js');
const { normalizeUrl, generateLookupVariants } = require('../utils/urlNormalizer');
const { 
  normalizeSectors, 
  expandRelatedSectors,
  getExpandedInvestorSectors,
} = require('../lib/sectorTaxonomy');

// =============================================================================
// REAL SCORING PIPELINE - The GOD Score SSOT
// =============================================================================
// Node.js v24 can require .ts files directly
const { calculateHotScore } = require('../services/startupScoringService.ts');
const { scrapeAndScoreStartup } = require('../services/urlScrapingService.ts');
const { extractInferenceData } = require('../../lib/inference-extractor');
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
      .select('id, name, firm, url, sectors, stage, total_investments, active_fund_size, investment_thesis, type')
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

/**
 * Calculate match score between startup and investor
 */
function calculateMatchScore(startup, investor) {
  let score = startup.total_god_score || 50;
  
  // Sector alignment bonus
  const startupSectors = Array.isArray(startup.sectors) ? startup.sectors : [];
  const investorSectors = Array.isArray(investor.sectors) ? investor.sectors : [];
  const sectorOverlap = startupSectors.filter(s => investorSectors.includes(s)).length;
  if (sectorOverlap > 0) score += 10 * Math.min(sectorOverlap, 3);
  
  // Stage alignment bonus
  const startupStage = startup.stage || 1;
  const investorStages = Array.isArray(investor.stage) ? investor.stage : [investor.stage];
  if (investorStages.includes(startupStage) || investorStages.includes(String(startupStage))) {
    score += 15;
  }
  
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Generate reasoning for match
 */
function generateReasoning(startup, investor, score) {
  const reasons = [];
  
  const startupSectors = Array.isArray(startup.sectors) ? startup.sectors : [];
  const investorSectors = Array.isArray(investor.sectors) ? investor.sectors : [];
  const overlap = startupSectors.filter(s => investorSectors.includes(s));
  
  if (overlap.length > 0) {
    reasons.push(`Sector alignment: ${overlap.join(', ')}`);
  }
  
  if (startup.total_god_score >= 70) {
    reasons.push(`High GOD score: ${startup.total_god_score}`);
  }
  
  reasons.push(`Match score: ${score}/100`);
  
  return reasons.join('. ');
}

/**
 * POST /api/instant/submit
 * 
 * Body: { url: string }
 * Returns: { startup_id, matches, match_count, processing_time_ms }
 */
router.post('/submit', async (req, res) => {
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
    
    console.log(`⚡ [INSTANT] Processing input: "${inputRaw}"`);
    console.log(`   → Company name: "${companyName}", Domain: "${domain}", Normalized: "${urlNormalized}"`);
    
    // Validate we got something useful
    if (!companyName || companyName.length < 2) {
      return res.status(400).json({ 
        error: 'Invalid URL',
        message: 'Please enter a valid company website (e.g., stripe.com)'
      });
    }
    
    // 1. Find existing startup with FUZZY MATCHING
    let startupId = null;
    let startup = null;
    let isNew = false;
    
    // Build flexible search query - search by:
    // - Full domain in website
    // - Company name in website (handles different TLDs)
    // - Company name in startup name
    const searchPatterns = [
      `website.ilike.%${domain}%`,
      `website.ilike.%${companyName}.%`,
      `name.ilike.%${companyName}%`
    ];
    
    const { data: candidates, error: searchErr } = await supabase
      .from('startup_uploads')
      .select('id, name, website, sectors, stage, total_god_score, status')
      .or(searchPatterns.join(','))
      .eq('status', 'approved')
      .limit(100);
    
    if (searchErr) {
      console.error(`  ✗ Search error:`, searchErr);
    }
    
    console.log(`   → Found ${candidates?.length || 0} candidate startups`);
    
    if (candidates && candidates.length > 0) {
      // Score each candidate for best match
      const scored = candidates.map(c => {
        let score = 0;
        const candidateCompanyName = extractCompanyName(c.website || '');
        const candidateNameLower = (c.name || '').toLowerCase();
        
        // Exact normalized URL match = highest priority
        if (c.website && normalizeUrl(c.website) === urlNormalized) {
          score = 100;
        }
        // Exact company name match (stripe.com → stripe.io)
        else if (candidateCompanyName === companyName) {
          score = 90;
        }
        // Company name is in startup name
        else if (candidateNameLower.includes(companyName)) {
          score = 70;
        }
        // Startup name is in company name
        else if (companyName.includes(candidateCompanyName) && candidateCompanyName.length > 2) {
          score = 60;
        }
        // Partial website match
        else if (c.website && c.website.toLowerCase().includes(companyName)) {
          score = 50;
        }
        
        return { ...c, matchScore: score };
      });
      
      // Sort by match score and take the best
      scored.sort((a, b) => b.matchScore - a.matchScore);
      
      if (scored[0].matchScore >= 50) {
        startup = scored[0];
        startupId = startup.id;
        console.log(`  ✓ Found existing startup: ${startup.name} (score: ${scored[0].matchScore})`);
      }
    }
    
    // 2. Create new startup if not found — WITH REAL SCORING
    if (!startupId) {
      isNew = true;
      const displayName = domainToName(domain);
      const fullUrl = inputRaw.startsWith('http') ? inputRaw : `https://${domain}`;
      
      // ================================================================
      // STEP A: Fetch website content (free HTTP GET, shared by both paths)
      // ================================================================
      console.log(`  🌐 Fetching ${fullUrl}...`);
      let websiteContent = null;
      try {
        const response = await axios.get(fullUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          timeout: 15000,
          maxRedirects: 5,
        });
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
        console.log(`  ✓ Fetched ${websiteContent.length} chars`);
      } catch (fetchErr) {
        console.warn(`  ⚠ Fetch failed: ${fetchErr.message}`);
      }
      
      // ================================================================
      // STEP B: Run INFERENCE ENGINE v2 first (free, instant, no API calls)
      // v2 includes: URL-based name, value proposition, confidence scoring
      // ================================================================
      let inferenceData = null;
      let dataTier = 'C';
      if (websiteContent && websiteContent.length >= 50) {
        inferenceData = extractInferenceData(websiteContent, fullUrl);
        if (inferenceData) {
          // v2: Use confidence.tier directly (replaces inline tier computation)
          dataTier = inferenceData.confidence?.tier || 'C';
          const conf = inferenceData.confidence || {};
          console.log(`  ⚡ Inference v2: Tier ${dataTier} (score: ${conf.score || 0}/100, missing: [${(conf.missing || []).join(', ')}])`);
          console.log(`    signals: ${inferenceData.execution_signals?.length || 0} exec, ${inferenceData.team_signals?.length || 0} team, sectors: ${inferenceData.sectors?.join(', ') || 'none'}`);
          if (inferenceData.value_proposition) console.log(`    value prop: "${inferenceData.value_proposition.substring(0, 80)}..."`);
        }
      }
      
      // ================================================================
      // STEP C: SCRAPER FALLBACK CHAIN — only when inference is too sparse
      // Tier A/B → use inference data as-is (no API cost)
      // Tier C → try scrapeAndScoreStartup (GPT-4o via urlScrapingService)
      //       → if that also fails → try DynamicParser (cheerio + AI)
      // ================================================================
      let aiData = null;
      if (dataTier === 'C') {
        console.log(`  🤖 Tier C → scraper fallback chain...`);
        
        // Fallback 1: GPT-4o URL scraping service
        try {
          const scrapeResult = await scrapeAndScoreStartup(fullUrl);
          aiData = scrapeResult.data;
          const hasRichAI = !!(aiData.mrr || aiData.arr || aiData.revenue || aiData.customer_count || aiData.active_users);
          const hasSomeAI = !!(aiData.description || aiData.pitch || aiData.problem || aiData.solution);
          dataTier = hasRichAI ? 'A' : (hasSomeAI ? 'B' : 'C');
          console.log(`  ✓ AI scraper: Tier ${dataTier} → "${aiData.name}"`);
        } catch (aiErr) {
          console.warn(`  ⚠ AI scraper failed: ${aiErr.message}`);
        }
        
        // Fallback 2: DynamicParser (cheerio + AI structured extraction)
        if (dataTier === 'C') {
          try {
            const DynamicParser = require('../../lib/dynamic-parser');
            const parser = new DynamicParser();
            const dpResult = await parser.parse(fullUrl, {
              extractionSchema: {
                name: 'string', description: 'string', pitch: 'string',
                problem: 'string', solution: 'string', sectors: 'array',
                funding_amount: 'number', funding_stage: 'string',
                founders: 'array', team_size: 'number',
              }
            });
            if (dpResult && (dpResult.description || dpResult.pitch)) {
              aiData = { ...(aiData || {}), ...dpResult };
              dataTier = 'B';
              console.log(`  ✓ DynamicParser fallback: Tier B → "${dpResult.name || 'unknown'}"`);
            }
          } catch (dpErr) {
            console.warn(`  ⚠ DynamicParser fallback failed: ${dpErr.message}`);
          }
        }
      } else {
        console.log(`  ✅ Inference Tier ${dataTier} — skipping scrapers (saves cost)`);
      }
      
      // ================================================================
      // STEP D: Merge inference + AI data into enriched startup row
      // ================================================================
      // v2: Name always comes from URL via parseStartupNameFromUrl (clean, reliable)
      // AI name only used if it looks more complete (e.g. "Rippling Inc" vs "Rippling")
      const inferredName = inferenceData?.name; // v2: always from URL, never from text
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
        // NOTE: team_companies column does NOT exist in startup_uploads schema
      };
      
      // Use the best available startup name
      const startupName = merged.name || displayName;
      
      const enrichedRow = {
        ...merged,
        name: startupName,
        website: `https://${domain}`,
        extracted_data: {
          // Inference signals (free)
          ...(inferenceData || {}),
          // AI data overlay (if used)
          ...(aiData || {}),
          data_tier: dataTier,
          enrichment_method: aiData ? 'inference+ai' : 'inference_only',
          scraped_at: new Date().toISOString(),
        },
      };
      
      // ================================================================
      // STEP E: Calculate REAL GOD score from enriched data
      // ================================================================
      const scores = calculateGODScore(enrichedRow);
      console.log(`  🎯 REAL GOD Score: ${scores.total_god_score} (team:${scores.team_score} traction:${scores.traction_score} market:${scores.market_score} product:${scores.product_score} vision:${scores.vision_score}) [${aiData ? 'inference+AI' : 'inference only'}]`);
      
      // ================================================================
      // STEP F: Insert startup with REAL scores
      // ================================================================
      let insertName = startupName;
      let { data: newStartup, error: insertErr } = await supabase
        .from('startup_uploads')
        .insert({
          name: insertName,
          website: `https://${domain}`,
          tagline: enrichedRow.tagline || `Startup at ${domain}`,
          description: enrichedRow.description,
          pitch: enrichedRow.pitch,
          sectors: enrichedRow.sectors,
          stage: enrichedRow.stage,
          status: 'approved',
          source_type: 'url',
          is_launched: enrichedRow.is_launched,
          has_demo: enrichedRow.has_demo,
          has_technical_cofounder: enrichedRow.has_technical_cofounder,
          team_size: enrichedRow.team_size,
          mrr: enrichedRow.mrr,
          arr: enrichedRow.arr,
          customer_count: enrichedRow.customer_count,
          growth_rate_monthly: enrichedRow.growth_rate_monthly,
          extracted_data: enrichedRow.extracted_data,
          // REAL GOD scores from the official scoring service
          total_god_score: scores.total_god_score,
          team_score: scores.team_score,
          traction_score: scores.traction_score,
          market_score: scores.market_score,
          product_score: scores.product_score,
          vision_score: scores.vision_score,
          created_at: new Date().toISOString()
        })
        .select('id, name, website, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
        .single();
      
      // If name conflict, retry with domain suffix
      if (insertErr && (insertErr.message?.includes('unique') || insertErr.code === '23505')) {
        insertName = `${startupName} (${domain})`;
        const retry2 = await supabase
          .from('startup_uploads')
          .insert({
            name: insertName,
            website: `https://${domain}`,
            tagline: enrichedRow.tagline || `Startup at ${domain}`,
            description: enrichedRow.description,
            pitch: enrichedRow.pitch,
            sectors: enrichedRow.sectors,
            stage: enrichedRow.stage,
            status: 'approved',
            source_type: 'url',
            is_launched: enrichedRow.is_launched,
            has_demo: enrichedRow.has_demo,
            has_technical_cofounder: enrichedRow.has_technical_cofounder,
            team_size: enrichedRow.team_size,
            mrr: enrichedRow.mrr,
            arr: enrichedRow.arr,
            customer_count: enrichedRow.customer_count,
            growth_rate_monthly: enrichedRow.growth_rate_monthly,
            extracted_data: enrichedRow.extracted_data,
            // REAL GOD scores
            total_god_score: scores.total_god_score,
            team_score: scores.team_score,
            traction_score: scores.traction_score,
            market_score: scores.market_score,
            product_score: scores.product_score,
            vision_score: scores.vision_score,
            created_at: new Date().toISOString()
          })
          .select('id, name, website, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
          .single();
        newStartup = retry2.data;
        insertErr = retry2.error;
      }
      
      if (insertErr) {
        console.error(`  ✗ Insert error: ${insertErr.message}`);
        
        // Handle race condition - try to find the startup again
        const { data: retry } = await supabase
          .from('startup_uploads')
          .select('id, name, website, sectors, stage, total_god_score')
          .or(`website.ilike.%${domain}%`)
          .limit(1)
          .single();
        
        if (retry) {
          startupId = retry.id;
          startup = retry;
          isNew = false;
          console.log(`  ✓ Race resolved: ${retry.name} (${retry.id})`);
        } else {
          return res.status(500).json({
            error: 'Failed to create startup',
            details: insertErr.message
          });
        }
      } else {
        startupId = newStartup.id;
        startup = newStartup;
        console.log(`  ✓ Created startup: ${newStartup.name} → GOD ${scores.total_god_score} (${newStartup.id})`);
      }
    }
    
    // 2b. Seed signal score for new startups (derived from real GOD component scores)
    if (isNew && startupId) {
      try {
        const godScore = startup?.total_god_score || 50;
        // Derive signal from real GOD score: maps 40-100 → ~3.4-8.5 range
        const signalTotal = Math.min(10, Math.max(3, parseFloat((godScore / 100 * 10 * 0.85).toFixed(1))));
        const factor = signalTotal / 5.5;
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
        console.log(`  ✓ Seeded signal score: ${signalTotal} (from real GOD ${godScore})`);
      } catch (signalErr) {
        console.warn(`  ⚠ Signal score seed failed (non-fatal):`, signalErr.message);
      }
    }

    // 3. Check for existing matches (use cache if >= 20 matches)
    const forceGenerate = req.body?.force_generate === true || req.query?.regen === '1';
    const { count: existingMatchCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId)
      .eq('status', 'suggested');
    
    // Lower threshold from 100 to 20 - if startup has 20+ matches, use them
    if (existingMatchCount && existingMatchCount >= 20 && !isNew && !forceGenerate) {
      // Already has matches - return quickly
      const { data: existingMatches } = await supabase
        .from('startup_investor_matches')
        .select(`
          id, match_score, reasoning, created_at,
          investors:investor_id (
            id, name, firm, url, sectors, stage,
            total_investments, active_fund_size, investment_thesis
          )
        `)
        .eq('startup_id', startupId)
        .eq('status', 'suggested')
        .order('match_score', { ascending: false })
        .limit(50);
      
      const processingTime = Date.now() - startTime;
      console.log(`  ⚡ Returned ${existingMatchCount} existing matches in ${processingTime}ms`);
      
      // Log: skipped (existing matches)
      supabase.from('match_gen_logs').insert({
        startup_id: startupId, event: 'skipped',
        source: forceGenerate ? 'force' : 'rpc',
        reason: 'existing_matches',
        candidate_count: existingMatchCount,
        duration_ms: processingTime,
      }).catch(() => {});
      
      return res.json({
        startup_id: startupId,
        startup,
        matches: existingMatches || [],
        match_count: existingMatchCount,
        is_new: false,
        cached: true,
        processing_time_ms: processingTime
      });
    }
    
    // 3b. Acquire idempotent lock — prevents thundering herd
    //     Returns run_id (uuid) if acquired, NULL if denied
    const genSource = forceGenerate ? 'force' : (isNew ? 'new' : 'rpc');
    const { data: runId } = await supabase.rpc('try_start_match_gen', {
      p_startup_id: startupId,
      p_cooldown_minutes: 5,
    });
    if (!runId && !forceGenerate) {
      console.log(`  ⏳ Match generation already running for ${startupId} — returning early`);
      
      // Log: skipped (cooldown/locked)
      supabase.from('match_gen_logs').insert({
        startup_id: startupId, event: 'skipped',
        source: genSource, reason: 'cooldown',
        duration_ms: Date.now() - startTime,
      }).catch(() => {});
      
      return res.json({
        startup_id: startupId,
        startup,
        matches: [],
        match_count: existingMatchCount || 0,
        is_new: false,
        gen_in_progress: true,
        processing_time_ms: Date.now() - startTime,
      });
    }
    
    // Log: started
    supabase.from('match_gen_logs').insert({
      startup_id: startupId, run_id: runId,
      event: 'started', source: genSource,
    }).catch(() => {});

    // 4. Generate matches INSTANTLY (using cached investors)
    console.log(`  ⚡ Generating instant matches...`);
    
    // Load investors into cache (fast if already cached)
    const allInvestors = await getInvestors(supabase);
    
    if (!allInvestors || allInvestors.length === 0) {
      return res.status(500).json({
        error: 'Failed to load investors',
        details: 'No active investors found'
      });
    }
    
    // Get RELEVANT investors based on startup sectors (much faster!)
    const startupSectors = Array.isArray(startup.sectors) ? startup.sectors : [];
    const investors = getRelevantInvestors(startupSectors);
    
    console.log(`  ✓ Using ${investors.length}/${allInvestors.length} relevant investors (sectors: ${startupSectors.join(', ') || 'none'})`);
    
    // Calculate matches (only keep scores >= 40 for faster processing)
    const matches = [];
    for (const investor of investors) {
      const score = calculateMatchScore(startup, investor);
      
      // Raise threshold from 20 to 40 - below 40 won't be shown anyway
      if (score >= 40) {
        matches.push({
          startup_id: startupId,
          investor_id: investor.id,
          match_score: score,
          reasoning: generateReasoning(startup, investor, score),
          status: 'suggested',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Include investor data for response
          _investor: investor
        });
      }
    }
    
    console.log(`  ✓ Generated ${matches.length} matches (score >= 40)`);
    
    // 5. Store matches in database (async - don't wait)
    if (matches.length > 0) {
      // Start background insert (non-blocking)
      const insertPromise = (async () => {
        // Delete old matches first
        await supabase
          .from('startup_investor_matches')
          .delete()
          .eq('startup_id', startupId);
        
        // Insert new matches in batches
        const dbMatches = matches.map(m => ({
          startup_id: m.startup_id,
          investor_id: m.investor_id,
          match_score: m.match_score,
          reasoning: m.reasoning,
          status: m.status,
          created_at: m.created_at,
          updated_at: m.updated_at
        }));
        
        const batchSize = 500; // Larger batches for fewer round trips
        for (let i = 0; i < dbMatches.length; i += batchSize) {
          const batch = dbMatches.slice(i, i + batchSize);
          const { error: batchErr } = await supabase
            .from('startup_investor_matches')
            .insert(batch);
          
          if (batchErr) {
            console.error(`  ⚠ Batch ${i}/${dbMatches.length} error:`, batchErr.message);
          }
        }
        console.log(`  ✓ Background insert complete: ${dbMatches.length} matches`);
        // Mark generation complete (safe: requires matching run_id)
        await supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'done', p_run_id: runId });
        // Log: completed
        const genDuration = Date.now() - startTime;
        supabase.from('match_gen_logs').insert({
          startup_id: startupId, run_id: runId,
          event: 'completed', source: genSource,
          candidate_count: investors.length,
          inserted_count: dbMatches.length,
          duration_ms: genDuration,
        }).catch(() => {});
      })();
      
      // Wait only 500ms max for inserts, then return
      // The rest will complete in background
      await Promise.race([
        insertPromise,
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
    }
    
    // 6. Log to ai_logs
    const processingTime = Date.now() - startTime;
    
    await supabase.from('ai_logs').insert({
      log_type: 'instant_submit',
      action_type: 'process',
      input_data: { url: inputRaw, urlNormalized, domain },
      output_data: {
        startup_id: startupId,
        match_count: matches.length,
        is_new: isNew,
        processing_time_ms: processingTime
      },
      created_at: new Date().toISOString()
    });
    
    // 7. Return matches with investor data (sorted by score)
    const sortedMatches = matches
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 50) // Top 50
      .map(m => ({
        id: m.investor_id, // Use investor ID as match ID for frontend
        match_score: m.match_score,
        reasoning: m.reasoning,
        created_at: m.created_at,
        investors: m._investor
      }));
    
    // 8. Save to temp_match_sessions for returning users (30 day retention)
    const sessionId = req.body?.session_id || req.headers['x-session-id'];
    if (sessionId) {
      const top5 = sortedMatches.slice(0, 5);
      const top5Ids = top5.map(m => m.investors?.id).filter(Boolean);
      const top5Names = top5.map(m => m.investors?.name || 'Unknown').filter(Boolean);
      
      // Save session (async, don't wait)
      supabase.from('temp_match_sessions').insert({
        session_id: sessionId,
        startup_id: startupId,
        startup_name: startup?.name,
        startup_website: startup?.website,
        input_url: inputRaw,
        matches: sortedMatches,
        match_count: matches.length,
        top_5_investor_ids: top5Ids,
        top_5_investor_names: top5Names,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      }).then(({ error }) => {
        if (error) console.warn(`  ⚠ Session save failed: ${error.message}`);
        else console.log(`  ✓ Session saved: ${sessionId.slice(0, 8)}...`);
      });
    }
    
    console.log(`  ⚡ COMPLETE in ${processingTime}ms - ${matches.length} matches`);
    
    return res.json({
      startup_id: startupId,
      startup,
      matches: sortedMatches,
      match_count: matches.length,
      is_new: isNew,
      cached: false,
      processing_time_ms: processingTime
    });
    
  } catch (err) {
    console.error('[INSTANT] Fatal error:', err);
    // Release idempotency lock on failure (with run_id if available)
    if (typeof startupId !== 'undefined' && startupId) {
      const failRunId = typeof runId !== 'undefined' ? runId : null;
      supabase.rpc('complete_match_gen', { p_startup_id: startupId, p_status: 'failed', p_run_id: failRunId }).catch(() => {});
      // Log: failed
      supabase.from('match_gen_logs').insert({
        startup_id: startupId, run_id: failRunId,
        event: 'failed', source: typeof genSource !== 'undefined' ? genSource : 'unknown',
        reason: err.message,
        duration_ms: Date.now() - startTime,
      }).catch(() => {});
    }
    return res.status(500).json({
      error: 'Processing failed',
      details: err.message
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
