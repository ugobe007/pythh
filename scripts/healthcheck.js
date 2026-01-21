#!/usr/bin/env node
/**
 * 🏥 Hot Honey Health Check
 * 
 * Comprehensive system health check for all critical components
 * Run: node scripts/healthcheck.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function pass(msg) {
  console.log(`${colors.green}✅${colors.reset} ${msg}`);
}

function fail(msg) {
  console.log(`${colors.red}❌${colors.reset} ${msg}`);
}

function warn(msg) {
  console.log(`${colors.yellow}⚠️${colors.reset}  ${msg}`);
}

function info(msg) {
  console.log(`${colors.blue}ℹ${colors.reset}  ${msg}`);
}

let failureCount = 0;

// =============================================================================
// 1. FRONTEND SANITY
// =============================================================================
async function checkFrontend() {
  console.log('\n🎨 FRONTEND SANITY\n');
  
  // Check package.json
  try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    pass('package.json exists');
    
    if (pkg.scripts?.build) {
      pass('Build script configured');
    } else {
      fail('Build script missing in package.json');
      failureCount++;
    }
  } catch (err) {
    fail(`package.json error: ${err.message}`);
    failureCount++;
  }
  
  // Check critical files
  const criticalFiles = [
    'src/App.tsx',
    'src/pages/InstantMatches.tsx',
    'src/hooks/useSignalHistory.ts',
    'src/components/PowerScoreSparkline.tsx',
    'src/lib/supabase.ts',
    'vite.config.ts',
    'index.html'
  ];
  
  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      pass(file);
    } else {
      fail(`Missing: ${file}`);
      failureCount++;
    }
  }
  
  // Check dist/ (build output)
  if (fs.existsSync('dist/index.html')) {
    pass('dist/index.html (build output exists)');
  } else {
    warn('dist/index.html missing (run npm run build)');
  }
}

// =============================================================================
// 2. SERVER SANITY
// =============================================================================
async function checkServer() {
  console.log('\n🚀 SERVER SANITY\n');
  
  // Check server files
  const serverFiles = [
    'server/index.js',
    'server/routes/startups.js',
    'server/routes/matches.js'
  ];
  
  for (const file of serverFiles) {
    if (fs.existsSync(file)) {
      pass(file);
    } else {
      fail(`Missing: ${file}`);
      failureCount++;
    }
  }
  
  // Check if server is running
  try {
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('http://localhost:3002/api/health', { timeout: 3000 });
    
    if (response.ok) {
      pass('Server responding at http://localhost:3002');
      
      // Test matches endpoint
      const matchTest = await fetch('http://localhost:3002/api/matches?startup_id=test');
      if (matchTest.status === 404 || matchTest.status === 400) {
        pass('/api/matches endpoint exists (404/400 expected with bad ID)');
      } else {
        warn(`/api/matches returned status ${matchTest.status}`);
      }
    } else {
      fail(`Server health check failed: ${response.status}`);
      failureCount++;
    }
  } catch (err) {
    fail(`Server not reachable: ${err.message}`);
    warn('Start server: pm2 restart api-server');
    failureCount++;
  }
}

// =============================================================================
// 3. SUPABASE SANITY
// =============================================================================
async function checkSupabase() {
  console.log('\n🗄️  SUPABASE SANITY\n');
  
  // Check env vars
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    fail('SUPABASE_URL not configured in .env');
    failureCount++;
    return;
  }
  pass('SUPABASE_URL configured');
  
  if (!supabaseKey) {
    fail('SUPABASE_SERVICE_KEY not configured in .env');
    failureCount++;
    return;
  }
  pass('SUPABASE_SERVICE_KEY configured');
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Test connection
  try {
    const { error } = await supabase.from('startup_uploads').select('id').limit(1);
    if (error) {
      fail(`Supabase connection error: ${error.message}`);
      failureCount++;
      return;
    }
    pass('Supabase connection working');
  } catch (err) {
    fail(`Supabase connection failed: ${err.message}`);
    failureCount++;
    return;
  }
  
  // Check critical tables exist
  const tables = [
    'startup_uploads',
    'investors',
    'startup_investor_matches',
    'startup_signal_history'
  ];
  
  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        fail(`Table ${table}: ${error.message}`);
        failureCount++;
      } else {
        pass(`Table: ${table}`);
      }
    } catch (err) {
      fail(`Table ${table} check failed: ${err.message}`);
      failureCount++;
    }
  }
  
  // Check RPC function exists
  try {
    const { error } = await supabase.rpc('upsert_signal_history', {
      p_startup_id: '00000000-0000-0000-0000-000000000000',
      p_signal_strength: 50,
      p_readiness: 50,
      p_power_score: 25,
      p_fundraising_window: 'Too Early',
      p_source: 'healthcheck',
      p_meta: {}
    });
    
    // We expect this to fail (bad startup_id), but function should exist
    if (error && error.code === '23503') {
      // Foreign key violation = function exists, just bad data
      pass('RPC: upsert_signal_history (function exists)');
    } else if (error) {
      warn(`RPC upsert_signal_history: ${error.message}`);
    } else {
      pass('RPC: upsert_signal_history (working)');
    }
  } catch (err) {
    fail(`RPC check failed: ${err.message}`);
    failureCount++;
  }
  
  // Check RLS ownership column
  try {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, submitted_by')
      .limit(1);
    
    if (error) {
      fail(`Ownership column check failed: ${error.message}`);
      failureCount++;
    } else if (data && data.length > 0 && data[0].submitted_by !== undefined) {
      pass('Ownership column: submitted_by exists');
    } else {
      warn('No data in startup_uploads to verify submitted_by');
    }
  } catch (err) {
    fail(`Ownership check failed: ${err.message}`);
    failureCount++;
  }
}

// =============================================================================
// 4. PIPELINE SANITY
// =============================================================================
async function checkPipeline() {
  console.log('\n⚙️  PIPELINE SANITY\n');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    warn('Supabase not configured, skipping pipeline checks');
    return;
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Check data freshness
  try {
    // Check for recent startups
    const { data: recentStartups, error: startupsError } = await supabase
      .from('startup_uploads')
      .select('id, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    
    if (startupsError) {
      warn(`Recent startups check: ${startupsError.message}`);
    } else if (recentStartups && recentStartups.length > 0) {
      pass('Data freshness: Recent startups found (last 7 days)');
    } else {
      warn('No startups created in last 7 days');
    }
  } catch (err) {
    warn(`Data freshness check failed: ${err.message}`);
  }
  
  // Check signal history writes
  try {
    const { data: recentHistory, error: historyError } = await supabase
      .from('startup_signal_history')
      .select('id, recorded_at')
      .gte('recorded_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    
    if (historyError) {
      warn(`Signal history check: ${historyError.message}`);
    } else if (recentHistory && recentHistory.length > 0) {
      pass('Signal history: Recent entries (last 24 hours)');
    } else {
      warn('No signal history entries in last 24 hours (expected if no scans)');
    }
  } catch (err) {
    warn(`Signal history check failed: ${err.message}`);
  }
  
  // Check match generation
  try {
    const { count, error: matchError } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    if (matchError) {
      warn(`Match count check: ${matchError.message}`);
    } else if (count > 1000) {
      pass(`Match generation: ${count.toLocaleString()} matches exist`);
    } else if (count > 0) {
      warn(`Only ${count} matches exist (expected > 1000)`);
    } else {
      fail('No matches found in database');
      failureCount++;
    }
  } catch (err) {
    warn(`Match check failed: ${err.message}`);
  }
}

// =============================================================================
// 4. GUARDRAILS SANITY
// =============================================================================
async function checkGuardrails() {
  console.log('\n🛡️  GUARDRAILS SANITY\n');
  
  const serverUrl = process.env.SERVER_URL || 'http://localhost:3002';
  const http = require('http');
  const https = require('https');
  
  // Helper to make requests
  function makeRequest(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      client.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
      }).on('error', reject);
    });
  }
  
  // Check request ID middleware
  try {
    const response = await makeRequest(`${serverUrl}/api/health`);
    if (response.headers['x-request-id']) {
      pass('Request ID middleware active');
    } else {
      fail('Request ID middleware missing');
      failureCount++;
    }
  } catch (err) {
    fail(`Could not verify request ID middleware: ${err.message}`);
    failureCount++;
  }
  
  // Check rate limiting headers
  try {
    const response = await makeRequest(`${serverUrl}/api/health`);
    if (response.headers['x-ratelimit-limit']) {
      pass('Rate limiting active');
    } else {
      warn('Rate limiting headers not detected (might be endpoint-specific)');
    }
  } catch (err) {
    warn(`Could not verify rate limiting: ${err.message}`);
  }
  
  // Check cache headers on a real endpoint (if we can access it)
  try {
    // This will likely fail without auth, but we can check headers
    const testStartupId = '11cd88ad-d464-4f5c-9e65-82da8ffe7e8a';
    const response = await makeRequest(`${serverUrl}/api/matches?startup_id=${testStartupId}`);
    
    // Even if 401/429, we can check headers
    if (response.headers['cache-control']) {
      pass('Cache-Control headers set');
    } else {
      warn('Cache-Control headers not found');
    }
  } catch (err) {
    warn(`Could not verify cache (endpoint might be protected): ${err.message}`);
  }
  
  // Check timeout configuration exists
  try {
    const timeoutFile = fs.readFileSync('server/utils/withTimeout.js', 'utf8');
    if (timeoutFile.includes('TIMEOUTS') && timeoutFile.includes('SUPABASE_READ')) {
      pass('Timeout configuration exists');
    } else {
      fail('Timeout configuration incomplete');
      failureCount++;
    }
  } catch (err) {
    fail(`Could not verify timeout configuration: ${err.message}`);
    failureCount++;
  }
  
  // Check safe logger exists
  try {
    const logFile = fs.readFileSync('server/utils/safeLog.js', 'utf8');
    if (logFile.includes('redact') && logFile.includes('maskEmail')) {
      pass('Safe logger with redaction exists');
    } else {
      fail('Safe logger incomplete');
      failureCount++;
    }
  } catch (err) {
    fail(`Could not verify safe logger: ${err.message}`);
    failureCount++;
  }
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
  console.log('🏥 Hot Honey Health Check');
  console.log('='.repeat(50));
  
  await checkFrontend();
  await checkServer();
  await checkSupabase();
  await checkGuardrails();
  await checkPipeline();
  
  console.log('\n' + '='.repeat(50));
  if (failureCount === 0) {
    console.log(`${colors.green}✅ ALL CHECKS PASSED${colors.reset}`);
    console.log('System is healthy and ready to use.');
    process.exit(0);
  } else {
    console.log(`${colors.red}❌ ${failureCount} CHECK(S) FAILED${colors.reset}`);
    console.log('Review failures above and fix before deploying.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Health check crashed:', err);
  process.exit(1);
});
