/**
 * INSTANT URL SUBMIT - The Pythh Fast Path
 * 
 * POST /api/instant/submit
 * 
 * Purpose: Accept URL → Scrape → Score → Match → Return results
 * Goal: Complete processing in under 3 seconds (vs 30+ seconds with polling)
 * 
 * Flow:
 * 1. Normalize URL and check for existing startup
 * 2. Create startup if needed (with default GOD score)
 * 3. Trigger instant match generation
 * 4. Return matches immediately (no polling needed)
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');
const { normalizeUrl, generateLookupVariants } = require('../utils/urlNormalizer');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

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
    
    // 2. Create new startup if not found
    if (!startupId) {
      isNew = true;
      const displayName = domainToName(domain);
      
      // Generate unique name to avoid constraint violations
      const timestamp = Date.now().toString(36);
      const uniqueName = `${displayName}-${timestamp}`;
      
      const { data: newStartup, error: insertErr } = await supabase
        .from('startup_uploads')
        .insert({
          name: uniqueName,
          website: `https://${domain}`,
          tagline: `Startup at ${domain}`,
          sectors: ['Technology'],
          stage: 1,
          status: 'approved',
          source_type: 'url', // Valid: url, deck, manual
          total_god_score: 65, // Default GOD score
          created_at: new Date().toISOString()
        })
        .select('id, name, website, sectors, stage, total_god_score')
        .single();
      
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
        console.log(`  ✓ Created new startup: ${newStartup.name} (${newStartup.id})`);
      }
    }
    
    // 3. Check for existing matches
    const { count: existingMatchCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startupId)
      .eq('status', 'suggested');
    
    if (existingMatchCount && existingMatchCount >= 100 && !isNew) {
      // Already has matches - return quickly
      const { data: existingMatches } = await supabase
        .from('startup_investor_matches')
        .select(`
          id, match_score, reasoning, created_at,
          investors:investor_id (
            id, name, firm, website, sectors, stage,
            portfolio_count, aum, description
          )
        `)
        .eq('startup_id', startupId)
        .eq('status', 'suggested')
        .order('match_score', { ascending: false })
        .limit(50);
      
      const processingTime = Date.now() - startTime;
      console.log(`  ⚡ Returned ${existingMatchCount} existing matches in ${processingTime}ms`);
      
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
    
    // 4. Generate matches INSTANTLY
    console.log(`  ⚡ Generating instant matches...`);
    
    // Get all active investors
    const { data: investors, error: invErr } = await supabase
      .from('investors')
      .select('*')
      .eq('status', 'active');
    
    if (invErr || !investors) {
      return res.status(500).json({
        error: 'Failed to load investors',
        details: invErr?.message
      });
    }
    
    console.log(`  ✓ Loaded ${investors.length} active investors`);
    
    // Calculate matches
    const matches = [];
    for (const investor of investors) {
      const score = calculateMatchScore(startup, investor);
      
      if (score >= 20) {
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
    
    console.log(`  ✓ Generated ${matches.length} matches`);
    
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
      input_data: { url, urlNormalized, domain },
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

module.exports = router;
