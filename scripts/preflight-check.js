#!/usr/bin/env node
/**
 * PREFLIGHT CHECK - Run BEFORE any PM2 process starts
 * 
 * This script validates ALL dependencies before processes start:
 * 1. Environment variables exist and are not placeholders
 * 2. API keys actually work (makes real API calls)
 * 3. Database schema has required columns
 * 4. Critical tables exist
 * 
 * Usage:
 *   node scripts/preflight-check.js           # Full check
 *   node scripts/preflight-check.js --quick   # Skip API calls (faster)
 *   node scripts/preflight-check.js --fix     # Attempt auto-fixes
 * 
 * Exit codes:
 *   0 = All checks passed
 *   1 = Critical failure (do not start processes)
 *   2 = Warnings only (can start but issues exist)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse args
const args = process.argv.slice(2);
const QUICK_MODE = args.includes('--quick');
const FIX_MODE = args.includes('--fix');

// Colors for terminal
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Track results
const results = {
  passed: [],
  warnings: [],
  failures: [],
  fixes: []
};

function pass(msg) {
  results.passed.push(msg);
  console.log(`${GREEN}✓${RESET} ${msg}`);
}

function warn(msg) {
  results.warnings.push(msg);
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

function fail(msg) {
  results.failures.push(msg);
  console.log(`${RED}✗${RESET} ${msg}`);
}

function fix(msg) {
  results.fixes.push(msg);
  console.log(`${CYAN}🔧${RESET} ${msg}`);
}

function header(title) {
  console.log(`\n${BOLD}━━━ ${title} ━━━${RESET}`);
}

// ============================================================================
// CHECK 1: Environment Variables
// ============================================================================

const REQUIRED_ENV = {
  // Supabase
  'VITE_SUPABASE_URL': { 
    pattern: /^https:\/\/[a-z]+\.supabase\.co$/,
    placeholder: 'https://your-project.supabase.co'
  },
  'VITE_SUPABASE_ANON_KEY': { 
    pattern: /^eyJ/,
    placeholder: 'your-anon-key'
  },
  'SUPABASE_SERVICE_KEY': { 
    pattern: /^eyJ/,
    placeholder: 'your-service-key'
  },
  // OpenAI
  'OPENAI_API_KEY': { 
    pattern: /^sk-(?:proj-)?[A-Za-z0-9_-]{20,}/,
    placeholder: 'sk-your-openai-key'
  },
};

const OPTIONAL_ENV = {
  'SUPABASE_URL': { pattern: /^https:\/\/[a-z]+\.supabase\.co$/ },
  'VITE_OPENAI_API_KEY': { pattern: /^sk-/ },
};

async function checkEnvironment() {
  header('ENVIRONMENT VARIABLES');
  
  // Load .env
  const envPath = path.join(process.cwd(), '.env');
  const envBakPath = path.join(process.cwd(), '.env.bak');
  
  if (!fs.existsSync(envPath)) {
    fail('.env file does not exist');
    if (fs.existsSync(envBakPath) && FIX_MODE) {
      fs.copyFileSync(envBakPath, envPath);
      fix('Copied .env.bak to .env');
    }
    return;
  }
  
  require('dotenv').config({ path: envPath });
  
  // Check required vars
  for (const [key, config] of Object.entries(REQUIRED_ENV)) {
    const value = process.env[key];
    
    if (!value) {
      fail(`${key} is not set`);
      continue;
    }
    
    if (value === config.placeholder || value.includes('your-')) {
      fail(`${key} is a placeholder value: "${value.substring(0, 30)}..."`);
      
      // Try to fix from .env.bak
      if (FIX_MODE && fs.existsSync(envBakPath)) {
        const bakContent = fs.readFileSync(envBakPath, 'utf8');
        const match = bakContent.match(new RegExp(`^${key}=(.+)$`, 'm'));
        if (match && match[1] !== config.placeholder && !match[1].includes('your-')) {
          // Update .env with value from .env.bak
          let envContent = fs.readFileSync(envPath, 'utf8');
          envContent = envContent.replace(
            new RegExp(`^${key}=.*$`, 'm'),
            `${key}=${match[1]}`
          );
          fs.writeFileSync(envPath, envContent);
          fix(`Fixed ${key} from .env.bak`);
        }
      }
      continue;
    }
    
    if (!config.pattern.test(value)) {
      warn(`${key} format looks unusual: "${value.substring(0, 20)}..."`);
      continue;
    }
    
    pass(`${key} is set and valid format`);
  }
  
  // Check optional vars
  for (const [key, config] of Object.entries(OPTIONAL_ENV)) {
    const value = process.env[key];
    if (value && config.pattern.test(value)) {
      pass(`${key} (optional) is set`);
    }
  }
}

// ============================================================================
// CHECK 2: API Key Validation (actual API calls)
// ============================================================================

async function checkAPIs() {
  if (QUICK_MODE) {
    console.log(`\n${YELLOW}Skipping API checks (--quick mode)${RESET}`);
    return;
  }
  
  header('API CONNECTIVITY');
  
  // Test Supabase
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { count, error } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      fail(`Supabase connection failed: ${error.message}`);
    } else {
      pass(`Supabase connected (${count} startups)`);
    }
  } catch (e) {
    fail(`Supabase error: ${e.message}`);
  }
  
  // Test OpenAI
  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY
    });
    
    // Make a minimal API call
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Say "ok"' }],
      max_tokens: 5
    });
    
    if (response.choices?.[0]?.message) {
      pass('OpenAI API key is valid');
    } else {
      warn('OpenAI responded but format unexpected');
    }
  } catch (e) {
    if (e.status === 401) {
      fail(`OpenAI API key is INVALID: ${e.message}`);
    } else if (e.status === 429) {
      warn('OpenAI rate limited (key is valid but at limit)');
    } else {
      fail(`OpenAI error: ${e.message}`);
    }
  }
}

// ============================================================================
// CHECK 3: Database Schema
// ============================================================================

const REQUIRED_SCHEMA = {
  'startup_uploads': [
    'id', 'name', 'status', 'total_god_score', 'sectors',
    'team_score', 'traction_score', 'market_score', 'product_score', 'vision_score',
    'signals_bonus', 'created_at', 'updated_at'
  ],
  'investors': [
    'id', 'name', 'sectors', 'stage', 'created_at'
  ],
  'startup_investor_matches': [
    'id', 'startup_id', 'investor_id', 'match_score', 'created_at'
  ],
  'discovered_startups': [
    'id', 'name', 'source', 'created_at'
  ],
  'startup_signal_scores': [
    'startup_id', 'signals_total', 'as_of'
  ],
  'rss_sources': [
    'id', 'url', 'name', 'active'
  ]
};

async function checkSchema() {
  header('DATABASE SCHEMA');
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
      // Check if table exists by querying it
      const { data, error } = await supabase
        .from(table)
        .select(columns.join(','))
        .limit(1);
      
      if (error) {
        if (error.message.includes('does not exist')) {
          fail(`Table '${table}' does not exist`);
        } else if (error.message.includes('column')) {
          // Extract missing column from error
          const match = error.message.match(/column ['"]?(\w+)['"]?/i);
          if (match) {
            fail(`Table '${table}' missing column: ${match[1]}`);
          } else {
            fail(`Table '${table}' schema error: ${error.message}`);
          }
        } else {
          warn(`Table '${table}' query issue: ${error.message}`);
        }
      } else {
        pass(`Table '${table}' has all ${columns.length} required columns`);
      }
    }
  } catch (e) {
    fail(`Schema check failed: ${e.message}`);
  }
}

// ============================================================================
// CHECK 4: Data Health
// ============================================================================

async function checkDataHealth() {
  header('DATA HEALTH');
  
  try {
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    // Check startup count
    const { count: startupCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    if (startupCount === 0) {
      warn('No approved startups found');
    } else if (startupCount < 100) {
      warn(`Only ${startupCount} approved startups (expected 100+)`);
    } else {
      pass(`${startupCount} approved startups`);
    }
    
    // Check investor count
    const { count: investorCount } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true });
    
    if (investorCount === 0) {
      fail('No investors found');
    } else if (investorCount < 100) {
      warn(`Only ${investorCount} investors (expected 100+)`);
    } else {
      pass(`${investorCount} investors`);
    }
    
    // Check match count
    const { count: matchCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    if (matchCount === 0) {
      fail('No matches found - run match-regenerator.js');
    } else if (matchCount < 10000) {
      warn(`Only ${matchCount} matches (expected 10000+)`);
    } else {
      pass(`${matchCount} matches`);
    }
    
    // Check GOD score distribution
    const { data: scoreStats } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null);
    
    if (scoreStats?.length) {
      const scores = scoreStats.map(s => s.total_god_score);
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const min = Math.min(...scores);
      const max = Math.max(...scores);
      
      if (avg < 40 || avg > 80) {
        warn(`GOD score average is ${avg.toFixed(1)} (expected 40-80)`);
      } else {
        pass(`GOD scores: avg=${avg.toFixed(1)}, range=${min}-${max}`);
      }
    }
    
    // Check RSS freshness
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentStarts } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);
    
    if (recentStarts === 0) {
      warn('No new startups discovered in last 24h - check scrapers');
    } else {
      pass(`${recentStarts} new startups discovered in last 24h`);
    }
    
    // Check RSS source health
    const { data: rssStats } = await supabase.rpc('get_rss_health_stats').catch(() => ({ data: null }));
    
    if (!rssStats) {
      // Fallback: manual query
      const { count: neverScraped } = await supabase
        .from('rss_sources')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .is('last_scraped', null);
      
      const { count: staleScraped } = await supabase
        .from('rss_sources')
        .select('*', { count: 'exact', head: true })
        .eq('active', true)
        .lt('last_scraped', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());
      
      if (neverScraped > 20) {
        warn(`${neverScraped} RSS sources have NEVER been scraped`);
      } else if (neverScraped > 0) {
        pass(`${neverScraped} RSS sources pending first scrape`);
      }
      
      if (staleScraped > 50) {
        warn(`${staleScraped} RSS sources stale (>48h since scrape)`);
      }
    }
    
  } catch (e) {
    fail(`Data health check failed: ${e.message}`);
  }
}

// ============================================================================
// CHECK 5: PM2 Process Config
// ============================================================================

async function checkPM2Config() {
  header('PM2 CONFIGURATION');
  
  const ecoPath = path.join(process.cwd(), 'ecosystem.config.js');
  
  if (!fs.existsSync(ecoPath)) {
    warn('ecosystem.config.js not found');
    return;
  }
  
  try {
    const eco = require(ecoPath);
    const apps = eco.apps || [];
    
    pass(`Found ${apps.length} PM2 app configurations`);
    
    // Check for dangerous configs
    for (const app of apps) {
      if (app.autorestart === true && !app.max_restarts) {
        warn(`${app.name}: autorestart=true but no max_restarts limit`);
      }
      
      if (app.watch === true && app.ignore_watch?.length === 0) {
        warn(`${app.name}: watch=true with no ignore patterns`);
      }
      
      // Check script exists
      const scriptPath = path.join(process.cwd(), app.args || app.script);
      if (!fs.existsSync(scriptPath.replace('node ', ''))) {
        warn(`${app.name}: script may not exist: ${app.script} ${app.args || ''}`);
      }
    }
    
  } catch (e) {
    fail(`PM2 config error: ${e.message}`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}                    PREFLIGHT CHECK                         ${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`Mode: ${QUICK_MODE ? 'Quick' : 'Full'}${FIX_MODE ? ' + Auto-fix' : ''}`);
  
  await checkEnvironment();
  await checkAPIs();
  await checkSchema();
  await checkDataHealth();
  await checkPM2Config();
  
  // Summary
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}                       SUMMARY                              ${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
  
  console.log(`${GREEN}Passed:${RESET}   ${results.passed.length}`);
  console.log(`${YELLOW}Warnings:${RESET} ${results.warnings.length}`);
  console.log(`${RED}Failures:${RESET} ${results.failures.length}`);
  if (results.fixes.length) {
    console.log(`${CYAN}Fixed:${RESET}    ${results.fixes.length}`);
  }
  
  // Exit code
  if (results.failures.length > 0) {
    console.log(`\n${RED}${BOLD}❌ PREFLIGHT FAILED - Do NOT start processes${RESET}`);
    console.log(`\nFailures:`);
    results.failures.forEach(f => console.log(`  • ${f}`));
    process.exit(1);
  } else if (results.warnings.length > 0) {
    console.log(`\n${YELLOW}${BOLD}⚠️  PREFLIGHT PASSED WITH WARNINGS${RESET}`);
    process.exit(2);
  } else {
    console.log(`\n${GREEN}${BOLD}✅ PREFLIGHT PASSED - Safe to start processes${RESET}`);
    process.exit(0);
  }
}

main().catch(e => {
  console.error(`${RED}Preflight check crashed: ${e.message}${RESET}`);
  process.exit(1);
});
