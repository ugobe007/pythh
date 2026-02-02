#!/usr/bin/env node
/**
 * UNIFIED SCRAPER ORCHESTRATOR
 * ============================
 * 
 * Single source of truth for all scraping operations.
 * Replaces: automation-engine.js, hot-match-autopilot.js, launch-scrapers.sh
 * 
 * Features:
 * - Only calls scripts that actually exist
 * - Proper error handling and retries
 * - Integrates: Parse.bot parser, inference engine, all scrapers
 * - Clear logging and monitoring
 * 
 * Usage:
 *   node unified-scraper-orchestrator.js           # Run once
 *   node unified-scraper-orchestrator.js --daemon  # Run continuously
 *   node unified-scraper-orchestrator.js --quick   # Skip discovery, just enrich/score
 * 
 * PM2:
 *   pm2 start unified-scraper-orchestrator.js --name scraper-orchestrator -- --daemon
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

// ============================================================================
// CONFIGURATION
// ============================================================================
const CONFIG = {
  // Intervals (in minutes)
  intervals: {
    discovery: 30,        // RSS + intelligent scraping
    inference: 60,        // Inference enrichment
    enrichment: 360,      // Tiered enrichment (every 6 hours)
    scoring: 120,        // GOD scoring
    matching: 240,       // Match generation
    validation: 1440,    // Daily validation
  },
  
  // Retry configuration
  retries: {
    maxAttempts: 3,
    delayMs: 5000,       // 5 seconds between retries
  },
  
  // Timeouts (in milliseconds)
  timeouts: {
    discovery: 15 * 60 * 1000,   // 15 minutes
    inference: 10 * 60 * 1000,   // 10 minutes
    enrichment: 20 * 60 * 1000,  // 20 minutes (can process many startups)
    scoring: 15 * 60 * 1000,    // 15 minutes
    matching: 30 * 60 * 1000,   // 30 minutes
    validation: 5 * 60 * 1000,  // 5 minutes
  },
  
  // Logging
  logDir: './logs',
  logFile: 'unified-orchestrator.log',
};

// ============================================================================
// SCRIPT MAPPINGS (Only scripts that actually exist)
// ============================================================================
const SCRIPTS = {
  // Discovery (RSS + Intelligent)
  rss: {
    path: 'simple-rss-scraper.js',
    exists: () => fs.existsSync('simple-rss-scraper.js'),
    description: 'RSS feed scraper (fast, no AI)',
  },
  
  rssAlternative: {
    path: 'run-rss-scraper.js',
    exists: () => fs.existsSync('run-rss-scraper.js'),
    description: 'Alternative RSS scraper',
  },
  
  intelligent: {
    path: 'intelligent-scraper.js',
    exists: () => fs.existsSync('intelligent-scraper.js'),
    description: 'AI-powered scraper (Wellfound, etc.)',
    args: ['"https://wellfound.com/discover/startups?stage=seed"', 'startups'],
  },
  
  speedrun: {
    path: 'speedrun-full.mjs',
    exists: () => fs.existsSync('speedrun-full.mjs'),
    description: 'Speedrun scraper (high quality)',
    args: ['--save'],
  },
  
  ycCompanies: {
    path: 'yc-companies-scraper.js',
    exists: () => fs.existsSync('yc-companies-scraper.js'),
    description: 'YC company directory scraper',
    timeout: 3 * 60 * 1000, // 3 minutes (includes browser + API)
  },
  
  sequoia: {
    path: 'sequoia-scraper.js',
    exists: () => fs.existsSync('sequoia-scraper.js'),
    description: 'Sequoia Capital scraper',
  },
  
  hax: {
    path: 'hax-scraper.js',
    exists: () => fs.existsSync('hax-scraper.js'),
    description: 'HAX accelerator scraper',
  },
  
  mega: {
    path: 'mega-scraper.js',
    exists: () => fs.existsSync('mega-scraper.js'),
    description: 'Mega scraper (bulk discovery)',
  },
  
  discoverMore: {
    path: 'discover-more-startups.js',
    exists: () => fs.existsSync('discover-more-startups.js'),
    description: 'Multi-source startup discovery',
  },
  
  // Inference & Enrichment
  startupInference: {
    path: 'startup-inference-engine.js',
    exists: () => fs.existsSync('startup-inference-engine.js'),
    description: 'Startup inference engine (fill gaps)',
    args: ['--limit', '50'],
  },
  
  investorInference: {
    path: 'investor-inference-engine.js',
    exists: () => fs.existsSync('investor-inference-engine.js'),
    description: 'Investor inference engine (fill gaps)',
    args: ['--limit', '50'],
  },
  
  // Enrichment (Tiered gating matrix)
  enrichment: {
    path: 'enrichment-orchestrator.js',
    exists: () => fs.existsSync('enrichment-orchestrator.js'),
    description: 'Tiered enrichment orchestrator (Tier 0/1/2/3)',
    args: ['--limit', '50'],
  },
  
  // Scoring - FIXED Jan 31, 2026: Use official recalculate-scores.ts instead of legacy tiered script
  // The old god-score-v5-tiered.js was capping scores and using different algorithms
  godScoring: {
    path: 'npx',
    args: ['tsx', 'scripts/recalculate-scores.ts'],
    exists: () => fs.existsSync('scripts/recalculate-scores.ts'),
    description: 'GOD Score calculation (official algorithm)',
  },
  
  // DEPRECATED - DO NOT USE
  // godScoringLegacy: {
  //   path: 'scripts/core/god-score-v5-tiered.js',
  //   exists: () => fs.existsSync('scripts/core/god-score-v5-tiered.js'),
  //   description: 'DEPRECATED - was capping scores at tier limits (40/55)',
  // },
  
  // Matching
  matchGeneration: {
    path: 'queue-processor-v16.js',
    exists: () => fs.existsSync('queue-processor-v16.js'),
    description: 'Match generation (queue processor)',
  },
  
  // Import
  importDiscovered: {
    path: 'import-discovered-startups.js',
    exists: () => fs.existsSync('import-discovered-startups.js'),
    description: 'Import discovered startups',
    args: ['--auto'],
  },
  
  autoImport: {
    path: 'auto-import-pipeline.js',
    exists: () => fs.existsSync('auto-import-pipeline.js'),
    description: 'Auto-import pipeline',
  },
  
  // Validation
  dataValidation: {
    path: 'data-quality-audit.mjs',
    exists: () => fs.existsSync('data-quality-audit.mjs'),
    description: 'Data quality audit',
  },
};

// ============================================================================
// STATE TRACKING
// ============================================================================
const state = {
  lastRun: {},
  stats: {
    started: new Date(),
    jobsCompleted: 0,
    jobsFailed: 0,
    errors: [],
  },
};

// ============================================================================
// LOGGING
// ============================================================================
function ensureLogDir() {
  if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
  }
}

function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const emoji = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️',
    debug: '🔍',
  }[level] || '•';
  
  const logLine = `[${timestamp}] ${emoji} ${message}`;
  console.log(logLine);
  if (data) console.log('  ', JSON.stringify(data, null, 2));
  
  // Write to file
  try {
    ensureLogDir();
    const fileLine = data 
      ? `${logLine}\n  ${JSON.stringify(data)}\n`
      : `${logLine}\n`;
    fs.appendFileSync(path.join(CONFIG.logDir, CONFIG.logFile), fileLine);
  } catch (e) {
    // Ignore file errors
  }
}

function section(title) {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70) + '\n');
}

// ============================================================================
// SCRIPT RUNNER (with retries)
// ============================================================================
async function runScript(scriptKey, defaultTimeout = 5 * 60 * 1000) {
  const script = SCRIPTS[scriptKey];
  if (!script) {
    log('error', `Unknown script: ${scriptKey}`);
    return { success: false, error: 'Unknown script' };
  }
  
  if (!script.exists()) {
    log('warn', `Script not found: ${script.path}`);
    return { success: false, error: 'Script not found' };
  }
  
  // Use script-specific timeout if provided, otherwise use default
  const timeout = script.timeout || defaultTimeout;
  
  const args = script.args || [];
  const command = `node ${script.path} ${args.join(' ')}`;
  
  log('info', `Running: ${script.description}`);
  log('debug', `Command: ${command}`);
  log('debug', `Timeout: ${(timeout / 1000).toFixed(0)}s`);
  
  let lastError;
  for (let attempt = 1; attempt <= CONFIG.retries.maxAttempts; attempt++) {
    try {
      // Use spawn instead of execSync to show real-time output
      const { spawn } = require('child_process');
      const parts = command.split(' ');
      const cmd = parts[0];
      const cmdArgs = parts.slice(1);
      
      return new Promise((resolve) => {
        log('debug', `Spawning: ${cmd} ${cmdArgs.join(' ')}`);
        
        const proc = spawn(cmd, cmdArgs, {
          cwd: process.cwd(),
          stdio: 'inherit', // Show output in real-time
          shell: true, // Allow shell commands
        });
        
        let output = '';
        let errorOutput = '';
        
        // Capture output for logging (but also show in real-time via stdio: 'inherit')
        if (proc.stdout) {
          proc.stdout.on('data', (data) => {
            output += data.toString();
          });
        }
        
        if (proc.stderr) {
          proc.stderr.on('data', (data) => {
            errorOutput += data.toString();
          });
        }
        
        const timeoutId = setTimeout(() => {
          proc.kill('SIGTERM');
          log('error', `Script timed out after ${(timeout / 1000).toFixed(0)}s: ${script.description}`);
          resolve({ success: false, error: 'Timeout' });
        }, timeout);
        
        proc.on('close', (code) => {
          clearTimeout(timeoutId);
          
          if (code === 0) {
            log('success', `✅ Completed: ${script.description}`);
            state.stats.jobsCompleted++;
            state.lastRun[scriptKey] = new Date();
            resolve({ success: true, output });
          } else {
            const error = errorOutput || `Exit code ${code}`;
            log('error', `❌ Failed: ${script.description}`, { error: error.substring(0, 200) });
            state.stats.jobsFailed++;
            state.stats.errors.push({
              script: scriptKey,
              error: error.substring(0, 200),
              time: new Date(),
            });
            resolve({ success: false, error });
          }
        });
        
        proc.on('error', (err) => {
          clearTimeout(timeoutId);
          log('error', `Process error: ${script.description}`, { error: err.message });
          resolve({ success: false, error: err.message });
        });
      });
    } catch (error) {
      lastError = error;
      const isTimeout = error.message?.includes('timeout') || error.signal === 'SIGTERM';
      
      if (attempt < CONFIG.retries.maxAttempts) {
        log('warn', `Attempt ${attempt} failed, retrying...`, {
          error: error.message?.substring(0, 100),
          timeout: isTimeout,
        });
        await new Promise(r => setTimeout(r, CONFIG.retries.delayMs));
      } else {
        log('error', `Failed after ${CONFIG.retries.maxAttempts} attempts: ${script.description}`, {
          error: error.message?.substring(0, 200),
          timeout: isTimeout,
        });
        state.stats.jobsFailed++;
        state.stats.errors.push({
          script: scriptKey,
          error: error.message?.substring(0, 200),
          time: new Date(),
        });
        return { success: false, error: lastError?.message };
      }
    }
  }
  
  return { success: false, error: lastError?.message };
}

// ============================================================================
// PIPELINE STEPS
// ============================================================================

/**
 * STEP 1: Discovery (RSS + Intelligent Scraping)
 */
async function runDiscovery() {
  section('📡 STEP 1: DISCOVERY');
  
  const results = [];
  
  // RSS Scraper (fast, free) - try both versions
  if (SCRIPTS.rss.exists()) {
    const result = await runScript('rss', CONFIG.timeouts.discovery);
    results.push({ name: 'RSS Scraper', ...result });
  } else if (SCRIPTS.rssAlternative.exists()) {
    const result = await runScript('rssAlternative', CONFIG.timeouts.discovery);
    results.push({ name: 'RSS Scraper (Alt)', ...result });
  }
  
  // Intelligent Scraper (Wellfound - best source)
  if (SCRIPTS.intelligent.exists()) {
    const result = await runScript('intelligent', CONFIG.timeouts.discovery);
    results.push({ name: 'Intelligent Scraper', ...result });
  }
  
  // Speedrun (high quality, but mostly duplicates)
  if (SCRIPTS.speedrun.exists()) {
    const result = await runScript('speedrun', CONFIG.timeouts.discovery);
    results.push({ name: 'Speedrun Scraper', ...result });
  }
  
  // YC Company Directory
  if (SCRIPTS.ycCompanies.exists()) {
    // YC scraper has its own timeout (3 min), use that or discovery timeout
    const ycTimeout = SCRIPTS.ycCompanies?.timeout || CONFIG.timeouts.discovery;
    const result = await runScript('ycCompanies', ycTimeout);
    results.push({ name: 'YC Companies', ...result });
  }
  
  // Sequoia Capital
  if (SCRIPTS.sequoia.exists()) {
    const result = await runScript('sequoia', CONFIG.timeouts.discovery);
    results.push({ name: 'Sequoia Capital', ...result });
  }
  
  // HAX Accelerator
  if (SCRIPTS.hax.exists()) {
    const result = await runScript('hax', CONFIG.timeouts.discovery);
    results.push({ name: 'HAX Accelerator', ...result });
  }
  
  // Check discovered count
  const { count: discoveredCount } = await supabase
    .from('discovered_startups')
    .select('id', { count: 'exact', head: true });
  
  log('info', `Discovered startups pending: ${discoveredCount || 0}`);
  
  // Auto-import if script exists (try both versions)
  if (discoveredCount > 0) {
    if (SCRIPTS.autoImport.exists()) {
      log('info', 'Auto-importing discovered startups (pipeline)...');
      await runScript('autoImport', CONFIG.timeouts.discovery);
    } else if (SCRIPTS.importDiscovered.exists()) {
      log('info', 'Auto-importing discovered startups...');
      await runScript('importDiscovered', CONFIG.timeouts.discovery);
    }
  }
  
  return results;
}

/**
 * STEP 2: Inference Enrichment
 */
async function runInference() {
  section('🧠 STEP 2: INFERENCE ENRICHMENT');
  
  const results = [];
  
  // Startup inference
  if (SCRIPTS.startupInference.exists()) {
    const result = await runScript('startupInference', CONFIG.timeouts.inference);
    results.push({ name: 'Startup Inference', ...result });
  }
  
  // Investor inference
  if (SCRIPTS.investorInference.exists()) {
    const result = await runScript('investorInference', CONFIG.timeouts.inference);
    results.push({ name: 'Investor Inference', ...result });
  }
  
  return results;
}

/**
 * STEP 3: Enrichment (Tiered gating matrix)
 */
async function runEnrichment() {
  section('✨ STEP 3: TIERED ENRICHMENT');
  
  if (!SCRIPTS.enrichment.exists()) {
    log('warn', 'Enrichment orchestrator not found');
    return { success: false, error: 'Script not found' };
  }
  
  return await runScript('enrichment', CONFIG.timeouts.enrichment);
}

/**
 * STEP 4: GOD Scoring
 */
async function runScoring() {
  section('⚡ STEP 4: GOD SCORING');
  
  if (!SCRIPTS.godScoring.exists()) {
    log('warn', 'GOD scoring script not found');
    return { success: false, error: 'Script not found' };
  }
  
  return await runScript('godScoring', CONFIG.timeouts.scoring);
}

/**
 * STEP 5: Match Generation
 */
async function runMatching() {
  section('🔗 STEP 5: MATCH GENERATION');
  
  if (!SCRIPTS.matchGeneration.exists()) {
    log('warn', 'Match generation script not found');
    return { success: false, error: 'Script not found' };
  }
  
  return await runScript('matchGeneration', CONFIG.timeouts.matching);
}

/**
 * STEP 6: Data Validation
 */
async function runValidation() {
  section('🔍 STEP 6: DATA VALIDATION');
  
  if (!SCRIPTS.dataValidation.exists()) {
    log('warn', 'Data validation script not found');
    return { success: false, error: 'Script not found' };
  }
  
  return await runScript('dataValidation', CONFIG.timeouts.validation);
}

// ============================================================================
// FULL PIPELINE
// ============================================================================
async function runFullPipeline(skipDiscovery = false) {
  section('🚀 UNIFIED SCRAPER ORCHESTRATOR');
  
  const startTime = Date.now();
  
  try {
    // Step 1: Discovery
    if (!skipDiscovery) {
      await runDiscovery();
      state.lastRun.discovery = new Date();
    }
    
    // Step 2: Inference
    await runInference();
    state.lastRun.inference = new Date();
    
    // Step 3: Enrichment (tiered gating matrix)
    const lastEnrichment = state.lastRun.enrichment;
    const shouldEnrich = !lastEnrichment || 
      (Date.now() - lastEnrichment.getTime()) >= CONFIG.intervals.enrichment * 60 * 1000;
    
    if (shouldEnrich) {
      await runEnrichment();
      state.lastRun.enrichment = new Date();
    } else {
      log('info', `Enrichment skipped (last run: ${Math.round((Date.now() - lastEnrichment.getTime()) / 60000)} min ago)`);
    }
    
    // Step 4: Scoring
    await runScoring();
    state.lastRun.scoring = new Date();
    
    // Step 5: Matching
    await runMatching();
    state.lastRun.matching = new Date();
    
    // Step 6: Validation (only if enough time has passed)
    const lastValidation = state.lastRun.validation;
    const shouldValidate = !lastValidation || 
      (Date.now() - lastValidation.getTime()) >= CONFIG.intervals.validation * 60 * 1000;
    
    if (shouldValidate) {
      await runValidation();
      state.lastRun.validation = new Date();
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log('success', `Pipeline complete in ${duration}s`);
    
    // Get stats
    const [startups, investors, matches, discovered] = await Promise.all([
      supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
      supabase.from('investors').select('id', { count: 'exact', head: true }),
      supabase.from('startup_investor_matches').select('id', { count: 'exact', head: true }),
      supabase.from('discovered_startups').select('id', { count: 'exact', head: true }),
    ]);
    
    log('info', 'System Stats', {
      startups: startups.count || 0,
      investors: investors.count || 0,
      matches: matches.count || 0,
      discovered: discovered.count || 0,
    });
    
    return true;
  } catch (error) {
    log('error', `Pipeline error: ${error.message}`);
    return false;
  }
}

// ============================================================================
// DAEMON MODE
// ============================================================================
async function runDaemon() {
  log('info', 'Starting in daemon mode...');
  
  // Initial run
  await runFullPipeline();
  
  // Continuous loop
  setInterval(async () => {
    const now = Date.now();
    
    // Discovery
    const lastDiscovery = state.lastRun.discovery?.getTime() || 0;
    if (now - lastDiscovery >= CONFIG.intervals.discovery * 60 * 1000) {
      await runDiscovery();
      state.lastRun.discovery = new Date();
    }
    
    // Inference
    const lastInference = state.lastRun.inference?.getTime() || 0;
    if (now - lastInference >= CONFIG.intervals.inference * 60 * 1000) {
      await runInference();
      state.lastRun.inference = new Date();
    }
    
    // Enrichment
    const lastEnrichment = state.lastRun.enrichment?.getTime() || 0;
    if (now - lastEnrichment >= CONFIG.intervals.enrichment * 60 * 1000) {
      await runEnrichment();
      state.lastRun.enrichment = new Date();
    }
    
    // Scoring
    const lastScoring = state.lastRun.scoring?.getTime() || 0;
    if (now - lastScoring >= CONFIG.intervals.scoring * 60 * 1000) {
      await runScoring();
      state.lastRun.scoring = new Date();
    }
    
    // Matching
    const lastMatching = state.lastRun.matching?.getTime() || 0;
    if (now - lastMatching >= CONFIG.intervals.matching * 60 * 1000) {
      await runMatching();
      state.lastRun.matching = new Date();
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--daemon')) {
    await runDaemon();
    // Keep process alive
    process.stdin.resume();
  } else if (args.includes('--quick')) {
    await runFullPipeline(true); // Skip discovery
  } else {
    await runFullPipeline();
    process.exit(0);
  }
}

// Run
if (require.main === module) {
  main().catch(error => {
    log('error', `Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runFullPipeline, runDiscovery, runInference, runScoring, runMatching };

