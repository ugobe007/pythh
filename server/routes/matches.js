/**
 * Match API Routes
 * 
 * Provides REST API endpoints for match search, filtering, insights, and reports
 */

const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Import services from TypeScript modules (using dynamic import for CommonJS compatibility)
// Note: These functions are loaded asynchronously on first use
let searchStartupMatches, getStartupMatchStats, getTopStartupMatches;
let searchInvestorMatches, getInvestorMatchStats, getTopInvestorMatches;
let getStartupMatchInsights, getInvestorMatchInsights, getMatchTrends;
let getMatchBreakdown, getPortfolioAnalysis, getFitAnalysis;
let generateStartupMatchReport, generateInvestorMatchReport, exportMatchesToCSV;

// Lazy load TypeScript services (ONLY for legacy endpoints - not used by bulletproof /count and /top)
async function loadServices() {
  if (!searchStartupMatches) {
    try {
      const startupMatchService = await import('../services/startupMatchSearchService.js');
      const investorMatchService = await import('../services/investorMatchSearchService.js');
      const matchReportsService = await import('../services/matchReportsService.js');
      const matchInsightsService = await import('../services/matchInsightsService.js');
      const matchInvestigationService = await import('../services/matchInvestigationService.js');
      
      searchStartupMatches = startupMatchService.searchStartupMatches;
      getStartupMatchStats = startupMatchService.getStartupMatchStats;
      getTopStartupMatches = startupMatchService.getTopStartupMatches;
      
      searchInvestorMatches = investorMatchService.searchInvestorMatches;
      getInvestorMatchStats = investorMatchService.getInvestorMatchStats;
      getTopInvestorMatches = investorMatchService.getTopInvestorMatches;
      
      getStartupMatchInsights = matchInsightsService.getStartupMatchInsights;
      getInvestorMatchInsights = matchInsightsService.getInvestorMatchInsights;
      getMatchTrends = matchInsightsService.getMatchTrends;
      
      getMatchBreakdown = matchInvestigationService.getMatchBreakdown;
      getPortfolioAnalysis = matchInvestigationService.getPortfolioAnalysis;
      getFitAnalysis = matchInvestigationService.getFitAnalysis;
      
      generateStartupMatchReport = matchReportsService.generateStartupMatchReport;
      generateInvestorMatchReport = matchReportsService.generateInvestorMatchReport;
      exportMatchesToCSV = matchReportsService.exportMatchesToCSV;
    } catch (error) {
      console.error('[matches] Failed to load TypeScript services (legacy endpoints will fail):', error.message);
      // Don't crash - bulletproof endpoints (/count, /top) don't need these
    }
  }
}

// ============================================
// MATCH GENERATION ROUTE (INSTANT)
// ============================================

/**
 * POST /api/matches/generate
 * Generate matches instantly for a startup (bypasses queue for user-submitted URLs)
 * 
 * Request body:
 * - startupId: UUID of the startup
 * - priority: 'immediate' (optional, for logging)
 * 
 * Response:
 * - success: boolean
 * - matchCount: Number of matches generated
 * - message: Status message
 */
router.post('/generate', async (req, res) => {
  try {
    const { startupId, priority = 'immediate' } = req.body;
    
    if (!startupId) {
      return res.status(400).json({
        success: false,
        error: 'startupId is required'
      });
    }
    
    console.log(`🎯 INSTANT MATCH GENERATION for startup ${startupId} (priority: ${priority})`);
    
    // Get Supabase client
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    );
    
    // Get startup data
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('id', startupId)
      .single();
    
    if (startupError || !startup) {
      return res.status(404).json({
        success: false,
        error: `Startup not found: ${startupError?.message || 'Unknown error'}`
      });
    }
    
    console.log(`  Found startup: ${startup.name || 'Unnamed'} (GOD: ${startup.total_god_score})`);
    
    // Get all active investors
    const { data: investors, error: investorsError } = await supabase
      .from('investors')
      .select('*')
      .eq('status', 'active');
    
    if (investorsError) {
      return res.status(500).json({
        success: false,
        error: `Failed to load investors: ${investorsError.message}`
      });
    }
    
    console.log(`  Loaded ${investors.length} active investors`);
    
    // Generate matches using same logic as queue processor
    const matches = [];
    for (const investor of investors) {
      const score = calculateMatchScore(startup, investor);
      
      if (score >= 20) { // MIN_MATCH_SCORE
        matches.push({
          startup_id: startupId,
          investor_id: investor.id,
          match_score: score,
          reasoning: generateReasoning(startup, investor, score),
          status: 'suggested',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }
    
    console.log(`  Generated ${matches.length} matches (score >= 20)`);
    
    if (matches.length > 0) {
      // Delete existing matches first
      await supabase
        .from('startup_investor_matches')
        .delete()
        .eq('startup_id', startupId);
      
      // Insert new matches in batches
      const batchSize = 100;
      let insertedCount = 0;
      for (let i = 0; i < matches.length; i += batchSize) {
        const batch = matches.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('startup_investor_matches')
          .insert(batch);
        
        if (insertError) {
          console.error(`  ⚠️ Batch insert error:`, insertError.message);
        } else {
          insertedCount += batch.length;
        }
      }
      
      console.log(`  ✅ Inserted ${insertedCount} matches instantly`);
      
      // Log to ai_logs
      await supabase.from('ai_logs').insert({
        log_type: 'instant_match',
        action_type: 'generate',
        input_data: { startupId, priority },
        output_data: { matchCount: insertedCount },
        created_at: new Date().toISOString()
      });
      
      return res.json({
        success: true,
        matchCount: insertedCount,
        message: `Generated ${insertedCount} matches instantly`
      });
    } else {
      return res.json({
        success: true,
        matchCount: 0,
        message: 'No matches met minimum score threshold (20)'
      });
    }
    
  } catch (error) {
    console.error('❌ Error generating instant matches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate matches'
    });
  }
});

/**
 * Calculate match score between startup and investor
 * (Same logic as process-match-queue.js)
 */
function calculateMatchScore(startup, investor) {
  let score = startup.total_god_score || 50; // Base score from GOD score
  
  // Sector alignment
  const startupSectors = Array.isArray(startup.sectors) ? startup.sectors : [];
  const investorSectors = Array.isArray(investor.sectors) ? investor.sectors : [];
  const sectorOverlap = startupSectors.filter(s => investorSectors.includes(s)).length;
  
  if (sectorOverlap > 0) score += 10 * sectorOverlap;
  
  // Stage alignment
  const startupStage = startup.stage || 'seed';
  const investorStages = Array.isArray(investor.stage) ? investor.stage : [investor.stage];
  
  if (investorStages.includes(startupStage)) score += 15;
  
  // Cap at 100
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Generate reasoning array for match
 */
function generateReasoning(startup, investor, score) {
  const reasons = [];
  
  if (score >= 70) reasons.push('Strong overall alignment');
  if (startup.total_god_score >= 70) reasons.push('High GOD score');
  
  const startupSectors = Array.isArray(startup.sectors) ? startup.sectors : [];
  const investorSectors = Array.isArray(investor.sectors) ? investor.sectors : [];
  const overlap = startupSectors.filter(s => investorSectors.includes(s));
  
  if (overlap.length > 0) {
    reasons.push(`Sector match: ${overlap.join(', ')}`);
  }
  
  return reasons;
}

// Ensure services are loaded before handling requests
router.use(async (req, res, next) => {
  await loadServices();
  next();
});

// ============================================
// STARTUP MATCH ROUTES
// ============================================

/**
 * GET /api/matches/startup/:startupId
 * Search matches for a startup with optional filters
 * 
 * Query params:
 * - minScore: Minimum match score (default: smart filter - top 25% or 60, whichever is higher)
 * - maxScore: Maximum match score (default: 100)
 * - confidenceLevel: high | medium | low
 * - investorTier: elite | strong | emerging
 * - leadsRounds: true | false
 * - activeInvestor: true | false
 * - sectors: comma-separated list
 * - stage: comma-separated list
 * - geography: comma-separated list
 * - minCheckSize: Minimum check size in USD
 * - maxCheckSize: Maximum check size in USD
 * - portfolioFit: similar | complementary | gap | any
 * - sortBy: score | recent | investor_tier | check_size
 * - sortOrder: asc | desc
 * - limit: Number of results (default: 50)
 * - offset: Pagination offset (default: 0)
 * - showAll: true to bypass smart filtering (show all matches above threshold)
 */
router.get('/startup/:startupId', async (req, res) => {
  try {
    const { startupId } = req.params;
    const {
      minScore,
      maxScore,
      confidenceLevel,
      investorTier,
      leadsRounds,
      activeInvestor,
      sectors,
      stage,
      geography,
      minCheckSize,
      maxCheckSize,
      portfolioFit,
      sortBy,
      sortOrder,
      limit,
      offset,
      showAll, // Bypass smart filtering
    } = req.query;

    const filters = {
      ...(minScore !== undefined && { minScore: parseInt(minScore) }),
      ...(maxScore !== undefined && { maxScore: parseInt(maxScore) }),
      ...(confidenceLevel && { confidenceLevel }),
      ...(investorTier && { investorTier }),
      ...(leadsRounds !== undefined && { leadsRounds: leadsRounds === 'true' }),
      ...(activeInvestor !== undefined && { activeInvestor: activeInvestor === 'true' }),
      ...(sectors && { sectors: sectors.split(',') }),
      ...(stage && { stage: stage.split(',') }),
      ...(geography && { geography: geography.split(',') }),
      ...(minCheckSize !== undefined && { minCheckSize: parseInt(minCheckSize) }),
      ...(maxCheckSize !== undefined && { maxCheckSize: parseInt(maxCheckSize) }),
      ...(portfolioFit && { portfolioFit }),
      ...(sortBy && { sortBy }),
      ...(sortOrder && { sortOrder }),
      ...(limit !== undefined && { limit: parseInt(limit) }),
      ...(offset !== undefined && { offset: parseInt(offset) }),
      // If showAll is true, bypass smart filtering
      ...(showAll === 'true' && { showAll: true }),
    };

    const result = await searchStartupMatches(startupId, filters);
    
    res.json({
      success: true,
      data: result,
      message: result.limit_applied 
        ? 'Showing top 25% of matches or matches above 60 (whichever is higher). Use showAll=true to see all matches.'
        : 'Matches retrieved successfully',
    });
  } catch (error) {
    console.error('Error searching startup matches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search matches',
    });
  }
});

/**
 * GET /api/matches/startup/:startupId/stats
 * Get match statistics for a startup
 */
router.get('/startup/:startupId/stats', async (req, res) => {
  try {
    const { startupId } = req.params;
    const stats = await getStartupMatchStats(startupId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting startup match stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get match statistics',
    });
  }
});

/**
 * GET /api/matches/startup/:startupId/top
 * Get top matches for a startup (simplified)
 */
router.get('/startup/:startupId/top', async (req, res) => {
  try {
    const { startupId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const matches = await getTopStartupMatches(startupId, limit);
    
    res.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error('Error getting top startup matches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get top matches',
    });
  }
});

// ============================================
// INVESTOR MATCH ROUTES
// ============================================

/**
 * GET /api/matches/investor/:investorId
 * Search matches for an investor with optional filters
 */
router.get('/investor/:investorId', async (req, res) => {
  try {
    const { investorId } = req.params;
    const {
      minScore,
      maxScore,
      confidenceLevel,
      minGODScore,
      maxGODScore,
      godScoreRange,
      sectors,
      stage,
      geography,
      hasRevenue,
      minMRR,
      minARR,
      minGrowthRate,
      minCustomers,
      minTeamSize,
      fundingStage,
      raiseAmountMin,
      raiseAmountMax,
      sortBy,
      sortOrder,
      limit,
      offset,
    } = req.query;

    const filters = {
      ...(minScore !== undefined && { minScore: parseInt(minScore) }),
      ...(maxScore !== undefined && { maxScore: parseInt(maxScore) }),
      ...(confidenceLevel && { confidenceLevel }),
      ...(minGODScore !== undefined && { minGODScore: parseInt(minGODScore) }),
      ...(maxGODScore !== undefined && { maxGODScore: parseInt(maxGODScore) }),
      ...(godScoreRange && { godScoreRange }),
      ...(sectors && { sectors: sectors.split(',') }),
      ...(stage && { stage: stage.split(',').map(s => parseInt(s)) }),
      ...(geography && { geography: geography.split(',') }),
      ...(hasRevenue !== undefined && { hasRevenue: hasRevenue === 'true' }),
      ...(minMRR !== undefined && { minMRR: parseInt(minMRR) }),
      ...(minARR !== undefined && { minARR: parseInt(minARR) }),
      ...(minGrowthRate !== undefined && { minGrowthRate: parseInt(minGrowthRate) }),
      ...(minCustomers !== undefined && { minCustomers: parseInt(minCustomers) }),
      ...(minTeamSize !== undefined && { minTeamSize: parseInt(minTeamSize) }),
      ...(fundingStage && { fundingStage: fundingStage.split(',') }),
      ...(raiseAmountMin !== undefined && raiseAmountMax !== undefined && {
        raiseAmount: {
          min: parseInt(raiseAmountMin),
          max: parseInt(raiseAmountMax),
        },
      }),
      ...(sortBy && { sortBy }),
      ...(sortOrder && { sortOrder }),
      ...(limit !== undefined && { limit: parseInt(limit) }),
      ...(offset !== undefined && { offset: parseInt(offset) }),
    };

    const result = await searchInvestorMatches(investorId, filters);
    
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error searching investor matches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search matches',
    });
  }
});

/**
 * GET /api/matches/investor/:investorId/stats
 * Get match statistics for an investor
 */
router.get('/investor/:investorId/stats', async (req, res) => {
  try {
    const { investorId } = req.params;
    const stats = await getInvestorMatchStats(investorId);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting investor match stats:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get match statistics',
    });
  }
});

/**
 * GET /api/matches/investor/:investorId/top
 * Get top matches for an investor (simplified)
 */
router.get('/investor/:investorId/top', async (req, res) => {
  try {
    const { investorId } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const matches = await getTopInvestorMatches(investorId, limit);
    
    res.json({
      success: true,
      data: matches,
    });
  } catch (error) {
    console.error('Error getting top investor matches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get top matches',
    });
  }
});

// ============================================
// INSIGHTS ROUTES
// ============================================

/**
 * GET /api/matches/startup/:startupId/insights
 * Get AI-powered insights for a startup's matches
 */
router.get('/startup/:startupId/insights', async (req, res) => {
  try {
    const { startupId } = req.params;
    const insights = await getStartupMatchInsights(startupId);
    
    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('Error getting startup insights:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get insights',
    });
  }
});

/**
 * GET /api/matches/investor/:investorId/insights
 * Get AI-powered insights for an investor's matches
 */
router.get('/investor/:investorId/insights', async (req, res) => {
  try {
    const { investorId } = req.params;
    const insights = await getInvestorMatchInsights(investorId);
    
    res.json({
      success: true,
      data: insights,
    });
  } catch (error) {
    console.error('Error getting investor insights:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get insights',
    });
  }
});

/**
 * GET /api/matches/:entityType/:entityId/trends
 * Get match trends over time
 */
router.get('/:entityType/:entityId/trends', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const days = parseInt(req.query.days) || 30;
    
    if (entityType !== 'startup' && entityType !== 'investor') {
      return res.status(400).json({
        success: false,
        error: 'entityType must be "startup" or "investor"',
      });
    }
    
    const trends = await getMatchTrends(entityId, entityType, days);
    
    res.json({
      success: true,
      data: trends,
    });
  } catch (error) {
    console.error('Error getting trends:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get trends',
    });
  }
});

// ============================================
// INVESTIGATION ROUTES
// ============================================

/**
 * GET /api/matches/:matchId/breakdown
 * Get detailed breakdown of a match score
 */
router.get('/:matchId/breakdown', async (req, res) => {
  try {
    const { matchId } = req.params;
    const breakdown = await getMatchBreakdown(matchId);
    
    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    console.error('Error getting match breakdown:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get match breakdown',
    });
  }
});

/**
 * GET /api/matches/:matchId/fit
 * Get comprehensive fit analysis for a match
 */
router.get('/:matchId/fit', async (req, res) => {
  try {
    const { matchId } = req.params;
    const fit = await getFitAnalysis(matchId);
    
    res.json({
      success: true,
      data: fit,
    });
  } catch (error) {
    console.error('Error getting fit analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get fit analysis',
    });
  }
});

/**
 * GET /api/matches/portfolio/:investorId/:startupId
 * Get portfolio analysis for an investor-startup pair
 */
router.get('/portfolio/:investorId/:startupId', async (req, res) => {
  try {
    const { investorId, startupId } = req.params;
    const analysis = await getPortfolioAnalysis(investorId, startupId);
    
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Error getting portfolio analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get portfolio analysis',
    });
  }
});

// ============================================
// REPORTS ROUTES
// ============================================

/**
 * GET /api/matches/startup/:startupId/report
 * Generate comprehensive match report for a startup
 */
router.get('/startup/:startupId/report', async (req, res) => {
  try {
    const { startupId } = req.params;
    const {
      includeAllMatches,
      minScore,
      format,
    } = req.query;
    
    const report = await generateStartupMatchReport(startupId, {
      includeAllMatches: includeAllMatches === 'true',
      minScore: minScore ? parseInt(minScore) : undefined,
      format: format || 'json',
    });
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating startup report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate report',
    });
  }
});

/**
 * GET /api/matches/investor/:investorId/report
 * Generate comprehensive match report for an investor
 */
router.get('/investor/:investorId/report', async (req, res) => {
  try {
    const { investorId } = req.params;
    const {
      includeAllMatches,
      minScore,
      format,
    } = req.query;
    
    const report = await generateInvestorMatchReport(investorId, {
      includeAllMatches: includeAllMatches === 'true',
      minScore: minScore ? parseInt(minScore) : undefined,
      format: format || 'json',
    });
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    console.error('Error generating investor report:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate report',
    });
  }
});

/**
 * GET /api/matches/:entityType/:entityId/export
 * Export matches to CSV
 */
router.get('/:entityType/:entityId/export', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    
    if (entityType !== 'startup' && entityType !== 'investor') {
      return res.status(400).json({
        success: false,
        error: 'entityType must be "startup" or "investor"',
      });
    }
    
    const csv = await exportMatchesToCSV(entityId, entityType);
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="matches-${entityType}-${entityId}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting matches:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to export matches',
    });
  }
});

// ============================================================================
// BULLETPROOF API ENDPOINTS (Phase 5+)
// ============================================================================

/**
 * GET /api/matches/count?startup_id=...
 * 
 * Fast count check without fetching full data.
 * Returns: total, active, is_ready, last_match_at
 */
router.get('/count', async (req, res) => {
  try {
    const { startup_id } = req.query;
    
    if (!startup_id) {
      return res.status(400).json({
        success: false,
        error: 'startup_id query parameter is required',
      });
    }
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    );
    
    // Call RPC to count matches
    const { data, error } = await supabase.rpc('count_matches', {
      p_startup_id: startup_id,
    });
    
    if (error) {
      console.error('[match-count] RPC error:', error);
      return res.status(500).json({
        success: false,
        error: error.message,
      });
    }
    
    const result = data?.[0];
    
    if (!result) {
      return res.status(500).json({
        success: false,
        error: 'RPC returned no data',
      });
    }
    
    return res.json({
      success: true,
      data: {
        startup_id: result.startup_id,
        total: parseInt(result.total, 10),
        active: parseInt(result.active, 10),
        is_ready: result.is_ready,
        last_match_at: result.last_match_at,
      },
    });
  } catch (err) {
    console.error('[match-count] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

/**
 * GET /api/matches/top?startup_id=...&page=1&per_page=50
 * 
 * Returns top investor matches (paginated).
 * Only returns data if match count >= 1000.
 */
router.get('/top', async (req, res) => {
  try {
    const {
      startup_id,
      page = '1',
      per_page = '50',
    } = req.query;
    
    if (!startup_id) {
      return res.status(400).json({
        success: false,
        error: 'startup_id query parameter is required',
      });
    }
    
    const pageNum = parseInt(page, 10) || 1;
    const perPageNum = Math.min(parseInt(per_page, 10) || 50, 100); // max 100
    const offset = (pageNum - 1) * perPageNum;
    
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
    );
    
    // First check if startup has >= 1000 matches
    const { data: countData, error: countError } = await supabase.rpc('count_matches', {
      p_startup_id: startup_id,
    });
    
    if (countError) {
      console.error('[top-matches] Count error:', countError);
      return res.status(500).json({
        success: false,
        error: countError.message,
      });
    }
    
    const count = countData?.[0];
    
    if (!count || !count.is_ready) {
      return res.status(425).json({
        success: false,
        error: 'Matches still being generated',
        match_count: count?.total || 0,
      });
    }
    
    // Fetch top matches with manual join
    const { data: matchRecords, error: matchError } = await supabase
      .from('startup_investor_matches')
      .select('investor_id, match_score')
      .eq('startup_id', startup_id)
      .order('match_score', { ascending: false })
      .range(offset, offset + perPageNum - 1);
    
    if (matchError) {
      console.error('[top-matches] Query error:', matchError);
      return res.status(500).json({
        success: false,
        error: matchError.message,
      });
    }
    
    // Get investor details
    const investorIds = matchRecords.map(m => m.investor_id);
    const { data: investorDetails, error: investorError } = await supabase
      .from('investors')
      .select('id, name, firm, geography_focus, sectors, stage, check_size_min, check_size_max, total_investments')
      .in('id', investorIds);
    
    if (investorError) {
      console.error('[top-matches] Investor query error:', investorError);
      return res.status(500).json({
        success: false,
        error: investorError.message,
      });
    }
    
    // Merge data
    const investorMap = Object.fromEntries(investorDetails.map(inv => [inv.id, inv]));
    const matches = matchRecords.map(m => ({
      ...m,
      investors: investorMap[m.investor_id],
    }));
    
    // Get total count
    const { count: totalCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .eq('startup_id', startup_id);
    
    // Transform to API contract shape
    const transformedMatches = matches.map(m => ({
      investor_id: m.investor_id,
      name: m.investors?.name || 'Unknown',
      match_score: m.match_score,
      firm: m.investors?.firm,
      geography_focus: m.investors?.geography_focus,
      sectors: m.investors?.sectors || [],
      stage: m.investors?.stage || 'unknown',
      check_size_min: m.investors?.check_size_min,
      check_size_max: m.investors?.check_size_max,
      total_investments: m.investors?.total_investments,
    }));
    
    return res.json({
      success: true,
      data: {
        startup_id,
        page: pageNum,
        per_page: perPageNum,
        total_count: totalCount || 0,
        total_pages: Math.ceil((totalCount || 0) / perPageNum),
        matches: transformedMatches,
      },
    });
  } catch (err) {
    console.error('[top-matches] Unexpected error:', err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

module.exports = router;
