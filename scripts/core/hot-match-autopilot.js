#!/usr/bin/env node
/**
 * PYTH AI AUTOPILOT
 * ===================
 * Master automation script that runs the entire data pipeline:
 * 
 * 1. RSS Discovery - Fetch new startups from feeds
 * 2. Inference Enrichment - Fill gaps without API calls
 * 3. GOD Scoring - Score all startups
 * 4. Match Generation - Create startup-investor matches
 * 5. Data Validation - Ensure DB↔UI field alignment
 * 
 * Usage:
 *   node scripts/hot-match-autopilot.js           # Run full pipeline
 *   node scripts/hot-match-autopilot.js --quick   # Skip discovery, just score/match
 *   node scripts/hot-match-autopilot.js --daemon  # Run continuously
 * 
 * PM2:
 *   pm2 start scripts/hot-match-autopilot.js --name autopilot -- --daemon
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Configuration
const CONFIG = {
  DISCOVERY_INTERVAL: 15 * 60 * 1000,    // 15 minutes (increased frequency for 200-500 startups/day)
  ENRICHMENT_INTERVAL: 60 * 60 * 1000,   // 1 hour
  SCORING_INTERVAL: 2 * 60 * 60 * 1000,  // 2 hours
  MATCHING_INTERVAL: 4 * 60 * 60 * 1000, // 4 hours
  VALIDATION_INTERVAL: 24 * 60 * 60 * 1000, // Daily
  SOCIAL_SIGNALS_INTERVAL: 7 * 24 * 60 * 60 * 1000, // Weekly (7 days)
  FULL_SCORE_RECALC_INTERVAL: 7 * 24 * 60 * 60 * 1000, // Weekly (7 days)
  ML_TRAINING_INTERVAL: 24 * 60 * 60 * 1000, // Daily (24 hours)
};

// Timestamps for daemon mode
let lastDiscovery = 0;
let lastEnrichment = 0;
let lastScoring = 0;
let lastMatching = 0;
let lastValidation = 0;
let lastSocialSignals = 0;
let lastFullRecalc = 0;
let lastMLTraining = 0;

// Colors for logging
const c = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(emoji, msg, color = '') {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`${c.dim}[${timestamp}]${c.reset} ${emoji} ${color}${msg}${c.reset}`);
}

function section(title) {
  console.log(`\n${c.cyan}${'━'.repeat(60)}${c.reset}`);
  console.log(`${c.cyan}  ${title}${c.reset}`);
  console.log(`${c.cyan}${'━'.repeat(60)}${c.reset}\n`);
}

/**
 * Run a script and capture output
 */
function runScript(scriptPath, args = [], timeout = 5 * 60 * 1000) {
  const fullPath = path.join(process.cwd(), scriptPath);
  if (!fs.existsSync(fullPath)) {
    log('⚠️', `Script not found: ${scriptPath}`, c.yellow);
    return { success: false, error: 'Script not found' };
  }
  
  try {
    const output = execSync(`node ${fullPath} ${args.join(' ')}`, {
      encoding: 'utf-8',
      timeout,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    });
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

/**
 * STEP 1: RSS Discovery
 */
async function runDiscovery() {
  section('📡 STEP 1: RSS DISCOVERY');
  
  // Check RSS sources
  const { data: sources } = await supabase
    .from('rss_sources')
    .select('id, name, url')
    .eq('active', true);
  
  log('📊', `Active RSS sources: ${sources?.length || 0}`);
  
  // Run simple RSS scraper first (no AI, fast)
  // Increased timeout to 30 minutes (84 feeds × 30s timeout = ~42 min worst case, but most finish in 10-15 min)
  log('🔄', 'Running simple RSS scraper...');
  const rssResult = runScript('scripts/core/simple-rss-scraper.js', [], 30 * 60 * 1000);
  
  if (rssResult.success) {
    log('✅', 'RSS scrape complete', c.green);
  } else {
    log('⚠️', 'RSS scrape had issues (continuing anyway)', c.yellow);
  }
  
  // Check discovered startups
  const { count: discoveredCount } = await supabase
    .from('discovered_startups')
    .select('id', { count: 'exact', head: true });
  
  log('📦', `Discovered startups pending: ${discoveredCount}`);
  
  // Auto-import high-confidence discoveries
  if (discoveredCount > 0) {
    log('🔄', 'Importing high-confidence discoveries...');
    // Note: import-discovered-startups.js may not exist, skip if missing
    const importResult = runScript('scripts/core/auto-import-pipeline.js', [], 5 * 60 * 1000);
    if (importResult.success) {
      log('✅', 'Import complete', c.green);
    }
  }
  
  return true;
}

/**
 * STEP 2: Inference Enrichment (No API calls!)
 */
async function runInferenceEnrichment() {
  section('🧠 STEP 2: INFERENCE ENRICHMENT');
  
  // Count startups needing enrichment
  const { data: needsEnrichment } = await supabase
    .from('startup_uploads')
    .select('id')
    .or('extracted_data.is.null,total_god_score.is.null')
    .limit(100);
  
  log('📊', `Startups needing enrichment: ${needsEnrichment?.length || 0}`);
  
  if (needsEnrichment?.length > 0) {
    // Run startup inference engine
    log('🔄', 'Running startup inference engine...');
    const startupResult = runScript('scripts/core/startup-inference-engine.js', ['--limit', '50'], 10 * 60 * 1000);
    if (startupResult.success) {
      log('✅', 'Startup inference complete', c.green);
    }
  }
  
  // Check investors needing enrichment
  const { data: investorsNeedEnrich } = await supabase
    .from('investors')
    .select('id')
    .or('sectors.is.null,check_size_min.is.null')
    .limit(100);
  
  log('📊', `Investors needing enrichment: ${investorsNeedEnrich?.length || 0}`);
  
  if (investorsNeedEnrich?.length > 0) {
    log('🔄', 'Running investor inference engine...');
    const investorResult = runScript('scripts/core/investor-inference-engine.js', ['--limit', '50'], 10 * 60 * 1000);
    if (investorResult.success) {
      log('✅', 'Investor inference complete', c.green);
    }
  }
  
  return true;
}

/**
 * STEP 3: GOD Scoring
 * 
 * ⚠️ CRITICAL FIX (Jan 31, 2026): Switched from god-score-v5-tiered.js to recalculate-scores.ts
 * 
 * The legacy god-score-v5-tiered.js had its own scoring algorithm that:
 * - Capped Tier C (sparse data) startups at 40 points max
 * - Capped Tier B (some data) startups at 55 points max
 * - Used different scoring formulas than the official GOD algorithm
 * - Was overwriting scores from the official startupScoringService.ts
 * 
 * Now using: scripts/recalculate-scores.ts (SINGLE SOURCE OF TRUTH)
 * - Uses the official startupScoringService.ts with 23 GOD algorithms
 * - Proper normalization and weighting
 * - No artificial tier caps
 */
async function runGODScoring() {
  section('⚡ STEP 3: GOD SCORING (Official Algorithm)');
  
  // Count unscored startups
  const { data: unscored } = await supabase
    .from('startup_uploads')
    .select('id')
    .is('total_god_score', null)
    .limit(200);
  
  log('📊', `Unscored startups: ${unscored?.length || 0}`);
  
  if (unscored?.length > 0) {
    log('🔄', 'Running official GOD scoring (recalculate-scores.ts)...');
    // Use npx tsx to run TypeScript directly
    const scoreResult = runScript('npx', ['tsx', 'scripts/recalculate-scores.ts'], 20 * 60 * 1000);
    if (scoreResult.success) {
      log('✅', 'GOD scoring complete (official algorithm)', c.green);
      
      // Show distribution
      const { data: dist } = await supabase.rpc('get_score_distribution');
      if (dist) {
        log('📈', `Score distribution: ${JSON.stringify(dist)}`);
      }
    } else {
      log('⚠️', 'GOD scoring had issues - check logs', c.yellow);
    }
  } else {
    log('✅', 'All startups scored', c.green);
  }
  
  return true;
}

/**
 * STEP 4: Match Generation
 */
async function runMatchGeneration() {
  section('🔗 STEP 4: MATCH GENERATION');
  
  // Check current match count
  const { count: matchCount } = await supabase
    .from('startup_investor_matches')
    .select('id', { count: 'exact', head: true });
  
  log('📊', `Current matches: ${matchCount || 0}`);
  
  // Check if we need to generate matches
  const { count: startupCount } = await supabase
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .not('total_god_score', 'is', null);
  
  const { count: investorCount } = await supabase
    .from('investors')
    .select('id', { count: 'exact', head: true });
  
  const expectedMatches = Math.min(startupCount * 10, 50000); // ~10 matches per startup, cap at 50k
  
  if (!matchCount || matchCount < expectedMatches * 0.5) {
    log('🔄', 'Running queue processor to generate matches...');
    const matchResult = runScript('scripts/core/queue-processor-v16.js', [], 30 * 60 * 1000);
    if (matchResult.success) {
      log('✅', 'Match generation complete', c.green);
    }
  } else {
    log('✅', `Matches look good (${matchCount} existing)`, c.green);
  }
  
  return true;
}

/**
 * STEP 5: Data Validation
 */
async function runDataValidation() {
  section('🔍 STEP 5: DATA VALIDATION');
  
  // Check for data mismatches
  const checks = [];
  
  // Check startups with missing critical fields
  const { data: missingTagline } = await supabase
    .from('startup_uploads')
    .select('id')
    .is('tagline', null)
    .limit(100);
  checks.push({ field: 'tagline', missing: missingTagline?.length || 0 });
  
  const { data: missingSectors } = await supabase
    .from('startup_uploads')
    .select('id')
    .is('sectors', null)
    .limit(100);
  checks.push({ field: 'sectors', missing: missingSectors?.length || 0 });
  
  const { data: missingExtracted } = await supabase
    .from('startup_uploads')
    .select('id')
    .is('extracted_data', null)
    .limit(100);
  checks.push({ field: 'extracted_data', missing: missingExtracted?.length || 0 });
  
  // Check investors
  const { data: investorMissingBio } = await supabase
    .from('investors')
    .select('id')
    .is('bio', null)
    .limit(100);
  checks.push({ field: 'investor.bio', missing: investorMissingBio?.length || 0 });
  
  const { data: investorMissingCheck } = await supabase
    .from('investors')
    .select('id')
    .is('check_size_min', null)
    .limit(100);
  checks.push({ field: 'investor.check_size', missing: investorMissingCheck?.length || 0 });
  
  log('📊', 'Data completeness check:');
  checks.forEach(({ field, missing }) => {
    const status = missing === 0 ? '✅' : missing < 50 ? '⚠️' : '❌';
    console.log(`   ${status} ${field}: ${missing} missing`);
  });
  
  // If too many missing, trigger enrichment
  const totalMissing = checks.reduce((sum, c) => sum + c.missing, 0);
  if (totalMissing > 100) {
    log('⚠️', `High missing data (${totalMissing}), triggering enrichment...`, c.yellow);
    await runInferenceEnrichment();
  }
  
  return true;
}

/**
 * Get current stats
 */
async function getStats() {
  const [startups, investors, matches, discovered, rss] = await Promise.all([
    supabase.from('startup_uploads').select('id', { count: 'exact', head: true }),
    supabase.from('investors').select('id', { count: 'exact', head: true }),
    supabase.from('startup_investor_matches').select('id', { count: 'exact', head: true }),
    supabase.from('discovered_startups').select('id', { count: 'exact', head: true }),
    supabase.from('rss_sources').select('id', { count: 'exact', head: true }).eq('active', true),
  ]);
  
  return {
    startups: startups.count || 0,
    investors: investors.count || 0,
    matches: matches.count || 0,
    discovered: discovered.count || 0,
    rssSources: rss.count || 0,
  };
}

/**
 * Run full pipeline
 */
async function runFullPipeline(skipDiscovery = false) {
  console.log(`
${c.magenta}╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔥 PYTH AI AUTOPILOT                                  ║
║   Automated Data Pipeline                                 ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝${c.reset}
`);
  
  const startTime = Date.now();
  const initialStats = await getStats();
  
  log('📊', `Starting stats: ${initialStats.startups} startups, ${initialStats.investors} investors, ${initialStats.matches} matches`);
  
  try {
    if (!skipDiscovery) {
      await runDiscovery();
      lastDiscovery = Date.now();
    }
    
    await runInferenceEnrichment();
    lastEnrichment = Date.now();
    
    await runGODScoring();
    lastScoring = Date.now();
    
    await runMatchGeneration();
    lastMatching = Date.now();
    
    await runDataValidation();
    lastValidation = Date.now();
    
    const finalStats = await getStats();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    section('✅ PIPELINE COMPLETE');
    log('⏱️', `Duration: ${duration}s`);
    log('📊', `Final stats: ${finalStats.startups} startups (+${finalStats.startups - initialStats.startups}), ${finalStats.investors} investors, ${finalStats.matches} matches`);
    
    return true;
  } catch (error) {
    log('❌', `Pipeline error: ${error.message}`, c.red);
    return false;
  }
}

/**
 * Daemon mode - run continuously
 */
/**
 * Run weekly social signals collection
 */
async function runSocialSignalsCollection() {
  section('📱 WEEKLY: SOCIAL SIGNALS COLLECTION');
  
  log('📱', 'Collecting social media mentions for all startups...', c.cyan);
  const result = runScript('scripts/enrichment/social-signals-scraper.js', [], 60 * 60 * 1000); // 1 hour timeout
  
  if (result.success) {
    log('✅', 'Social signals collection complete', c.green);
    return true;
  } else {
    log('❌', 'Social signals collection failed', c.red);
    return false;
  }
}

/**
 * Run weekly full GOD score recalculation
 */
async function runFullScoreRecalculation() {
  section('🎯 WEEKLY: FULL GOD SCORE RECALCULATION');
  
  log('🎯', 'Running full GOD score recalculation (recalculate-scores.ts SSOT)...', c.cyan);
  const result = runScript('npx', ['tsx', 'scripts/recalculate-scores.ts'], 45 * 60 * 1000);
  
  if (result.success) {
    log('✅', 'Full score recalculation complete', c.green);
    return true;
  } else {
    log('❌', 'Full score recalculation failed', c.red);
    return false;
  }
}

/**
 * Run ML training cycle
 */
async function runMLTraining() {
  section('🤖 ML TRAINING CYCLE');
  
  log('🤖', 'Running ML training to generate algorithm optimization recommendations...', c.cyan);
  const result = runScript('run-ml-training.js', [], 10 * 60 * 1000); // 10 min timeout
  
  if (result.success) {
    log('✅', 'ML training complete', c.green);
    return true;
  } else {
    log('❌', 'ML training failed', c.red);
    return false;
  }
}

async function runDaemon() {
  log('🚀', 'Starting autopilot in daemon mode...', c.green);
  log('📅', `Discovery every ${CONFIG.DISCOVERY_INTERVAL / 60000} min`);
  log('📅', `Enrichment every ${CONFIG.ENRICHMENT_INTERVAL / 60000} min`);
  log('📅', `Scoring every ${CONFIG.SCORING_INTERVAL / 60000} min`);
  log('📅', `Matching every ${CONFIG.MATCHING_INTERVAL / 60000} min`);
  log('📅', `ML Training daily (every ${CONFIG.ML_TRAINING_INTERVAL / (60 * 60 * 1000)} hours)`);
  log('📅', `Social Signals weekly (every ${CONFIG.SOCIAL_SIGNALS_INTERVAL / (24 * 60 * 60 * 1000)} days)`);
  log('📅', `Full Recalc weekly (every ${CONFIG.FULL_SCORE_RECALC_INTERVAL / (24 * 60 * 60 * 1000)} days)`);
  
  // Initial run
  await runFullPipeline();
  
  // Continuous loop
  setInterval(async () => {
    const now = Date.now();
    
    if (now - lastDiscovery >= CONFIG.DISCOVERY_INTERVAL) {
      await runDiscovery();
      lastDiscovery = now;
    }
    
    if (now - lastEnrichment >= CONFIG.ENRICHMENT_INTERVAL) {
      await runInferenceEnrichment();
      lastEnrichment = now;
    }
    
    if (now - lastScoring >= CONFIG.SCORING_INTERVAL) {
      await runGODScoring();
      lastScoring = now;
    }
    
    if (now - lastMatching >= CONFIG.MATCHING_INTERVAL) {
      await runMatchGeneration();
      lastMatching = now;
    }
    
    if (now - lastValidation >= CONFIG.VALIDATION_INTERVAL) {
      await runDataValidation();
      lastValidation = now;
    }
    
    // Daily: ML Training (runs once per day, prefer 3 AM hour)
    if (now - lastMLTraining >= CONFIG.ML_TRAINING_INTERVAL) {
      const hour = new Date(now).getHours();
      if (hour === 3 || hour === 4) { // Run between 3-4 AM
        await runMLTraining();
        lastMLTraining = now;
      }
    }
    
    // Weekly: Social Signals Collection (Sunday 2 AM equivalent)
    if (now - lastSocialSignals >= CONFIG.SOCIAL_SIGNALS_INTERVAL) {
      const hour = new Date(now).getHours();
      if (hour === 2 || hour === 3) { // Run between 2-3 AM
        await runSocialSignalsCollection();
        lastSocialSignals = now;
      }
    }
    
    // Weekly: Full Score Recalculation (Sunday 3 AM equivalent, after social signals)
    if (now - lastFullRecalc >= CONFIG.FULL_SCORE_RECALC_INTERVAL) {
      const hour = new Date(now).getHours();
      if (hour === 3 || hour === 4) { // Run between 3-4 AM
        await runFullScoreRecalculation();
        lastFullRecalc = now;
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

// Main
const args = process.argv.slice(2);

if (args.includes('--daemon')) {
  runDaemon();
} else if (args.includes('--quick')) {
  runFullPipeline(true); // Skip discovery
} else if (args.includes('--stats')) {
  getStats().then(stats => {
    console.log('\n📊 Current Stats:');
    console.log(`   Startups: ${stats.startups}`);
    console.log(`   Investors: ${stats.investors}`);
    console.log(`   Matches: ${stats.matches}`);
    console.log(`   Discovered (pending): ${stats.discovered}`);
    console.log(`   RSS Sources: ${stats.rssSources}`);
    process.exit(0);
  });
} else {
  runFullPipeline().then(success => {
    process.exit(success ? 0 : 1);
  });
}

