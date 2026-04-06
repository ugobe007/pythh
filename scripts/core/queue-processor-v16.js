#!/usr/bin/env node
/**
 * QUEUE PROCESSOR v16
 * ===================
 * Uses intelligent-matching-v16 algorithm
 * Processes startup queue and creates matches with all active investors
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
const { buildMatchFeatureSnapshot } = require('../../lib/matchFeatureSnapshot');

// ============ V16 MATCHING ALGORITHM ============

const SECTOR_SYNONYMS = {
  'ai': ['artificial intelligence', 'machine learning', 'ml', 'deep learning', 'generative ai', 'gen ai', 'ai/ml', 'aiml'],
  'fintech': ['financial technology', 'financial services', 'payments', 'banking', 'insurtech', 'insurance', 'lending', 'credit'],
  'healthtech': ['health tech', 'healthcare', 'digital health', 'medtech', 'medical technology', 'biotech', 'health', 'medical', 'life sciences'],
  'edtech': ['education', 'education technology', 'e-learning', 'learning'],
  'saas': ['software as a service', 'b2b saas', 'enterprise saas', 'software', 'cloud'],
  'enterprise': ['b2b', 'enterprise software', 'business software', 'business'],
  'consumer': ['b2c', 'consumer tech', 'consumer products', 'd2c', 'direct to consumer', 'consumer software', 'cpg'],
  'marketplace': ['marketplaces', 'platform', 'two-sided marketplace'],
  'devtools': ['developer tools', 'dev tools', 'infrastructure', 'developer infrastructure', 'api', 'developer'],
  'climatetech': ['climate tech', 'cleantech', 'clean tech', 'sustainability', 'green tech', 'energy', 'renewable'],
  'crypto': ['web3', 'blockchain', 'defi', 'cryptocurrency', 'nft'],
  'gaming': ['games', 'game tech', 'esports', 'game'],
  'ecommerce': ['e-commerce', 'retail tech', 'commerce', 'retail', 'shopping'],
  'proptech': ['real estate tech', 'property tech', 'real estate', 'housing'],
  'logistics': ['supply chain', 'fulfillment', 'shipping', 'transportation', 'delivery'],
  'foodtech': ['food tech', 'food & beverage', 'agtech', 'agriculture', 'food', 'restaurant'],
  'robotics': ['robots', 'automation', 'industrial automation', 'manufacturing'],
  'technology': ['tech', 'it', 'information technology'],
  'marketing': ['martech', 'marketing tech', 'advertising', 'adtech', 'ad tech', 'digital marketing', 'growth'],
  'legaltech': ['legal tech', 'legal', 'law', 'compliance', 'regtech'],
  'hrtech': ['hr tech', 'human resources', 'recruiting', 'talent', 'workforce', 'hiring'],
  'security': ['cybersecurity', 'cyber security', 'infosec', 'information security', 'data security'],
  'data': ['data analytics', 'analytics', 'big data', 'business intelligence', 'bi'],
  'media': ['entertainment', 'content', 'streaming', 'video', 'audio', 'music', 'publishing'],
  'travel': ['hospitality', 'tourism', 'travel tech', 'booking'],
  'social': ['social media', 'social network', 'community', 'networking'],
  'hardware': ['devices', 'iot', 'internet of things', 'electronics', 'sensors'],
  'femtech': ['female founders', 'women', 'womens health']
};

const SECTOR_ADJACENCY = {
  'ai': ['devtools', 'enterprise', 'saas', 'healthtech', 'fintech', 'robotics', 'technology', 'data', 'security'],
  'fintech': ['crypto', 'enterprise', 'saas', 'consumer', 'data', 'security'],
  'healthtech': ['ai', 'consumer', 'enterprise', 'data', 'femtech'],
  'edtech': ['consumer', 'saas', 'ai', 'enterprise', 'media'],
  'saas': ['enterprise', 'devtools', 'ai', 'technology', 'data', 'security', 'marketing', 'hrtech'],
  'enterprise': ['saas', 'ai', 'devtools', 'fintech', 'technology', 'security', 'data'],
  'consumer': ['marketplace', 'ecommerce', 'gaming', 'foodtech', 'edtech', 'fintech', 'media', 'social', 'travel'],
  'marketplace': ['consumer', 'saas', 'ecommerce', 'logistics', 'travel'],
  'devtools': ['ai', 'saas', 'enterprise', 'technology', 'security', 'data'],
  'climatetech': ['hardware', 'enterprise', 'logistics', 'proptech', 'foodtech'],
  'crypto': ['fintech', 'consumer', 'gaming', 'ai'],
  'gaming': ['consumer', 'crypto', 'ai', 'media', 'social'],
  'ecommerce': ['consumer', 'marketplace', 'logistics', 'marketing'],
  'proptech': ['fintech', 'marketplace', 'climatetech', 'consumer'],
  'logistics': ['enterprise', 'ecommerce', 'climatetech', 'saas', 'robotics'],
  'foodtech': ['consumer', 'climatetech', 'logistics', 'healthtech'],
  'robotics': ['ai', 'enterprise', 'logistics', 'healthtech', 'hardware'],
  'technology': ['saas', 'enterprise', 'ai', 'devtools', 'consumer', 'data'],
  'marketing': ['saas', 'consumer', 'ecommerce', 'media', 'data', 'social'],
  'legaltech': ['enterprise', 'saas', 'fintech', 'ai', 'security'],
  'hrtech': ['enterprise', 'saas', 'ai', 'marketplace'],
  'security': ['enterprise', 'saas', 'fintech', 'devtools', 'ai', 'data'],
  'data': ['ai', 'enterprise', 'saas', 'fintech', 'healthtech', 'marketing'],
  'media': ['consumer', 'gaming', 'social', 'marketing', 'edtech'],
  'travel': ['consumer', 'marketplace', 'logistics'],
  'social': ['consumer', 'media', 'gaming', 'marketing'],
  'hardware': ['robotics', 'climatetech', 'consumer'],
  'femtech': ['healthtech', 'consumer']
};

const STAGE_MAP = {
  'pre-seed': 0, 'angel': 0, 'seed': 1, 'series a': 2, 'series-a': 2,
  'series b': 3, 'series-b': 3, 'series c': 4, 'series-c': 4,
  'series d': 5, 'series-d': 5, 'growth': 5, 'late': 6, 'late stage': 6
};

function normalizeSector(sector) {
  if (!sector) return '';
  return sector.toString().toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
}

function getSectorKey(sector) {
  const normalized = normalizeSector(sector);
  if (!normalized) return '';
  if (SECTOR_SYNONYMS[normalized]) return normalized;
  for (const [key, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
    if (synonyms.some(s => normalized === s || normalized.includes(s) || s.includes(normalized))) return key;
  }
  for (const key of Object.keys(SECTOR_SYNONYMS)) {
    if (normalized.includes(key) || key.includes(normalized)) return key;
  }
  return normalized;
}

function getInvestorStageNums(stages) {
  if (!stages) return [];
  const stageArray = Array.isArray(stages) ? stages : [stages];
  return stageArray.map(s => STAGE_MAP[normalizeSector(s)]).filter(n => n !== undefined);
}

function calculateVelocity(s) {
  let bonus = 0;
  if (s.days_from_idea_to_mvp > 0 && s.days_from_idea_to_mvp <= 90) bonus += 3;
  if (s.time_to_first_revenue_months > 0 && s.time_to_first_revenue_months <= 6) bonus += 2;
  if (s.deployment_frequency === 'daily' || s.deployment_frequency === 'weekly') bonus += 2;
  if ((s.growth_rate_monthly || s.arr_growth_rate || 0) >= 15) bonus += 2;
  if (s.pivot_speed_days > 0 && s.pivot_speed_days <= 30) bonus += 1;
  return 5 + bonus;
}

function calculatePMFScore(startup) {
  let pmf = 0;

  // CORE PMF (0-25)
  if (startup.has_revenue) {
    pmf += 10;
    if (startup.mrr >= 50000) pmf += 5;
    else if (startup.mrr >= 10000) pmf += 3;
    else if (startup.mrr > 0) pmf += 1;
  }
  if (startup.has_customers) pmf += 5;
  if (startup.is_launched) pmf += 2;

  // GROWTH (0-12)
  const growth = startup.growth_rate_monthly || 0;
  if (growth >= 20) pmf += 8;
  else if (growth >= 10) pmf += 5;
  else if (growth >= 5) pmf += 2;

  const custGrowth = startup.customer_growth_monthly || 0;
  if (custGrowth >= 20) pmf += 4;
  else if (custGrowth >= 10) pmf += 2;

  // RETENTION/LOVE (0-17)
  const nps = startup.nps_score || 0;
  if (nps >= 70) pmf += 6;
  else if (nps >= 50) pmf += 4;
  else if (nps >= 30) pmf += 2;

  const disappointed = startup.users_who_would_be_very_disappointed || 0;
  if (disappointed >= 40) pmf += 6;
  else if (disappointed >= 25) pmf += 3;

  const nrr = startup.nrr || 0;
  if (nrr >= 120) pmf += 5;
  else if (nrr >= 100) pmf += 2;

  // ORGANIC (0-5)
  const organic = startup.organic_referral_rate || 0;
  if (organic >= 30) pmf += 5;
  else if (organic >= 15) pmf += 3;
  else if (organic >= 5) pmf += 1;

  // PENALTY for no PMF data
  if (!startup.has_revenue && !startup.has_customers && !startup.is_launched && growth === 0) {
    pmf = -5;
  }

  return Math.max(-10, Math.min(50, pmf));
}

function calculateMatchScore(startup, investor) {
  let score = 0;
  
  const sSectors = (startup.sectors || []).map(getSectorKey).filter(Boolean);
  const iSectors = (investor.sectors || []).map(getSectorKey).filter(Boolean);
  
  // SECTOR (0-30)
  let sectorType = 'unknown';
  if (sSectors.length === 0 || iSectors.length === 0) {
    score += 12; sectorType = 'unknown';
  } else {
    const exact = sSectors.some(ss => iSectors.includes(ss));
    if (exact) {
      score += 30; sectorType = 'exact';
    } else {
      let adj = false;
      for (const ss of sSectors) {
        if ((SECTOR_ADJACENCY[ss] || []).some(a => iSectors.includes(a))) { adj = true; break; }
        for (const is of iSectors) {
          if ((SECTOR_ADJACENCY[is] || []).includes(ss)) { adj = true; break; }
        }
      }
      if (adj) { score += 20; sectorType = 'adjacent'; }
      else { score += 5; sectorType = 'none'; }
    }
  }
  
  // STAGE (0-30)
  const sStage = startup.stage;
  const iStages = getInvestorStageNums(investor.stage);
  let stageType = 'unknown';
  
  if (sStage === null || sStage === undefined) {
    score += 12; stageType = 'unknown';
  } else if (iStages.length === 0) {
    score += 18; stageType = 'agnostic';
  } else if (iStages.includes(sStage)) {
    score += 30; stageType = 'exact';
  } else if (iStages.includes(sStage + 1)) {
    score += 24; stageType = 'next';
  } else {
    const diff = Math.min(...iStages.map(n => Math.abs(n - sStage)));
    if (diff === 1) { score += 14; stageType = 'off1'; }
    else if (diff === 2) { score += 8; stageType = 'off2'; }
    else { score += 3; stageType = 'far'; }
  }
  
  // VELOCITY (5-15)
  score += calculateVelocity(startup);
  
  // PMF - PRODUCT/MARKET FIT (0-50, scaled to 0-25)
  const pmfRaw = calculatePMFScore(startup);
  const pmfScaled = Math.round(pmfRaw / 2); // Scale 0-50 to 0-25
  score += pmfScaled;
  
  // GOD (0-10) - more conservative
  const god = startup.total_god_score || 0;
  if (god >= 65) score += 8;
  else if (god >= 55) score += 5;
  else if (god >= 45) score += 3;
  else if (god >= 35) score += 1;
  
  // Apply penalties for poor fits to create better distribution
  if (sectorType === 'none') score -= 5; // Penalty for no sector match
  if (stageType === 'far') score -= 5;   // Penalty for far stage mismatch
  
  // FIXED: Better score distribution to avoid clustering
  // Raw score range: ~15-110 (after all bonuses)
  // Target: Wide distribution from 20-95 with proper bell curve
  // We want: ~20% poor, ~40% fair, ~30% good, ~10% excellent
  let final;
  
  // Ensure minimum base score
  const baseScore = Math.max(15, score);
  
  if (baseScore <= 25) {
    // Poor matches: 15-25 -> 20-35 (20% of matches)
    final = Math.round(20 + (baseScore - 15) * 1.5);
  } else if (baseScore <= 50) {
    // Fair matches: 25-50 -> 35-55 (40% of matches)
    final = Math.round(35 + (baseScore - 25) * 0.8);
  } else if (baseScore <= 75) {
    // Good matches: 50-75 -> 55-75 (30% of matches)
    final = Math.round(55 + (baseScore - 50) * 0.8);
  } else if (baseScore <= 95) {
    // Very good matches: 75-95 -> 75-88 (8% of matches)
    final = Math.round(75 + (baseScore - 75) * 0.65);
  } else {
    // Excellent matches: 95+ -> 88-95 (2% of matches - rare)
    final = Math.round(88 + Math.min(7, (baseScore - 95) * 0.5));
  }
  
  // Final clamp to ensure valid range
  final = Math.min(95, Math.max(20, final));
  
  const confidence = (sectorType === 'exact' && (stageType === 'exact' || stageType === 'next')) ? 'high' :
                     (sectorType === 'none' || stageType === 'far') ? 'low' : 'medium';
  
  return { score: final, confidence };
}

// ============ QUEUE PROCESSOR ============

let investorCache = null;
let cacheTime = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

async function getInvestors() {
  if (investorCache && Date.now() - cacheTime < CACHE_TTL) return investorCache;
  
  let all = [], offset = 0;
  while (true) {
    const { data } = await supabase.from('investors')
      .select('id, name, sectors, stage, check_size_min, check_size_max, geography_focus, investor_score, investor_tier')
      .eq('status', 'active')
      .range(offset, offset + 999);
    if (!data || !data.length) break;
    all = all.concat(data);
    offset += 1000;
    if (data.length < 1000) break;
  }
  
  investorCache = all;
  cacheTime = Date.now();
  console.log('📦 Cached ' + all.length + ' investors');
  return all;
}

async function processStartup(startupId) {
  // Get startup (with PMF fields)
  const { data: startup } = await supabase.from('startup_uploads')
    .select(
      'id, name, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score, maturity_level, data_completeness, has_revenue, has_customers, is_launched, raise_amount, days_from_idea_to_mvp, time_to_first_revenue_months, deployment_frequency, growth_rate_monthly, arr_growth_rate, pivot_speed_days, mrr, arr, customer_count, customer_growth_monthly, nps_score, users_who_would_be_very_disappointed, nrr, organic_referral_rate, customer_interviews_conducted',
    )
    .eq('id', startupId)
    .single();
  
  if (!startup) {
    console.log('❌ Startup not found: ' + startupId);
    return 0;
  }
  
  const investors = await getInvestors();

  const startupSnap = {
    id: startup.id,
    sectors: startup.sectors,
    stage: startup.stage,
    total_god_score: startup.total_god_score,
    team_score: startup.team_score,
    traction_score: startup.traction_score,
    market_score: startup.market_score,
    product_score: startup.product_score,
    vision_score: startup.vision_score,
    maturity_level: startup.maturity_level,
    data_completeness: startup.data_completeness,
    has_revenue: startup.has_revenue,
    has_customers: startup.has_customers,
    is_launched: startup.is_launched,
    mrr: startup.mrr,
    arr: startup.arr,
    customer_count: startup.customer_count,
    growth_rate_monthly: startup.growth_rate_monthly,
  };

  // Calculate matches for all investors
  const allMatches = investors.map(inv => {
    const result = calculateMatchScore(startup, inv);
    return {
      startup_id: startup.id,
      investor_id: inv.id,
      match_score: result.score,
      confidence_level: result.confidence,
      status: 'suggested',
      feature_snapshot: buildMatchFeatureSnapshot({
        engine: 'queue_v16',
        startup: startupSnap,
        investor: inv,
      }),
    };
  });
  
  // FILTER: Lower threshold to allow better distribution (was 35, now 20)
  // This allows poor/fair matches through so distribution isn't all clustered in "good"
  const MIN_MATCH_SCORE = 20;
  const MAX_MATCHES_PER_STARTUP = 100; // Limit to top 100 matches
  
  const qualityMatches = allMatches
    .filter(m => m.match_score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.match_score - a.match_score) // Sort by score descending
    .slice(0, MAX_MATCHES_PER_STARTUP); // Take top N
  
  if (qualityMatches.length === 0) {
    console.log('⚠️  ' + startup.name + ': No quality matches (all scores < ' + MIN_MATCH_SCORE + ')');
    return 0;
  }
  
  // Insert in smaller batches to avoid timeouts
  let inserted = 0;
  const batchSize = 50; // Reduced from 500 to prevent timeouts
  
  for (let i = 0; i < qualityMatches.length; i += batchSize) {
    const batch = qualityMatches.slice(i, i + batchSize);
    
    try {
      const { error } = await supabase.from('startup_investor_matches')
        .upsert(batch, { onConflict: 'startup_id,investor_id' });
      
      if (error) {
        console.log('⚠️  Batch error: ' + error.message);
      } else {
        inserted += batch.length;
      }
    } catch (err) {
      console.log('⚠️  Batch exception: ' + err.message);
    }
  }
  
  console.log('✅ ' + startup.name + ': ' + inserted + ' quality matches (filtered from ' + allMatches.length + ', top ' + MAX_MATCHES_PER_STARTUP + ')');
  return inserted;
}

async function processQueue() {
  const runOnce = process.argv.includes('--run-once');
  console.log('🚀 Queue Processor v16 started' + (runOnce ? ' (run-once mode)' : '') + '\n');
  
  while (true) {
    // Get next pending job - FIXED: Use 'matching_queue' not 'startup_matching_queue'
    const { data: jobs } = await supabase.from('matching_queue')
      .select('id, startup_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1);
    
    if (!jobs || jobs.length === 0) {
      if (runOnce) {
        console.log('✅ No pending jobs — exiting');
        process.exit(0);
      }
      console.log('💤 No pending jobs, waiting 30s...');
      await new Promise(r => setTimeout(r, 30000));
      continue;
    }
    
    const job = jobs[0];
    
    // Mark as processing
    await supabase.from('matching_queue')
      .update({ status: 'processing' })
      .eq('id', job.id);
    
    try {
      const count = await processStartup(job.startup_id);
      
      // Mark complete
      await supabase.from('matching_queue')
        .update({ status: 'completed' })
        .eq('id', job.id);
        
    } catch (err) {
      console.error('❌ Error processing ' + job.startup_id + ': ' + err.message);
      
      await supabase.from('matching_queue')
        .update({ status: 'failed' })
        .eq('id', job.id);
    }
    
    // Small delay between jobs
    await new Promise(r => setTimeout(r, 1000));
  }
}

processQueue().catch(console.error);
