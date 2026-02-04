#!/usr/bin/env node
/**
 * HOT MATCH SYSTEM GUARDIAN
 * =========================
 * Master health monitoring system that checks ALL critical components
 * and provides a single dashboard view + auto-healing capabilities.
 * 
 * Run: node system-guardian.js
 * PM2: pm2 start system-guardian.js --cron "* /10 * * * *" (remove space)
 * 
 * Monitors:
 * 1. Scraper health (error rates, stuck processes)
 * 2. GOD Score distribution (bias detection)
 * 3. Database schema integrity
 * 4. Match quality (low-score flooding)
 * 5. ML pipeline status
 * 6. Frontend data freshness
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { execSync, spawn } = require('child_process');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * THRESHOLD CONFIGURATION
 * =======================
 * These thresholds control when the Guardian triggers warnings/errors.
 * 
 * Adjust based on:
 * - Data volume (more data = stricter thresholds)
 * - Growth phase (startup phase = looser, mature = stricter)
 * - Data quality (high-quality sources = stricter GOD score thresholds)
 * 
 * See SYSTEM_GUARDIAN.md for detailed documentation.
 */
const THRESHOLDS = {
  // ─── SCRAPER HEALTH ───────────────────────────────────────────────────
  SCRAPER_ERROR_RATE_MAX: 0.3,        // Max 30% RSS sources can fail
  SCRAPER_STUCK_MINUTES: 60,          // Alert if no discoveries for 60 min
  SCRAPER_RESTART_WARN: 50,           // Warn if PM2 restart count > 50
  
  // ─── GOD SCORES ───────────────────────────────────────────────────────
  // GOD = GRIT + Opportunity + Determination
  // Current reality: avg ~49, with distribution across 40-85 range
  // Philosophy: Scores reflect data quality - sparse data = lower scores
  GOD_SCORE_MIN_AVG: 45,              // Avg below this = scoring too harsh
  GOD_SCORE_MAX_AVG: 75,              // Avg above this = score inflation
  GOD_SCORE_LOW_PERCENT_MAX: 0.55,    // Max 55% can score below 50 (current: 51%)
  GOD_SCORE_ELITE_MIN_PERCENT: 0.0,   // Elite (85+) is rare, 0% is acceptable
  
  // ─── MATCH QUALITY ────────────────────────────────────────────────────
  // Match scores depend on sector alignment (rare perfect matches)
  MATCH_MIN_COUNT: 5000,              // Error if fewer matches than this
  MATCH_CRITICAL_COUNT: 1000,         // Trigger auto-regen below this
  MATCH_HIGH_QUALITY_MIN: 0.002,      // At least 0.2% should score 70+
  MATCH_LOW_QUALITY_MAX: 0.95,        // Max 95% can score below 50
  
  // ─── DATA FRESHNESS ───────────────────────────────────────────────────
  STALE_STARTUP_HOURS: 48,            // No new startups for 48h = stale
  STALE_INVESTOR_HOURS: 72,           // Investor data can be older
  STALE_MATCH_HOURS: 6,               // Matches refresh every 4h
  
  // ─── ML PIPELINE ──────────────────────────────────────────────────────
  ML_STARTUP_EMBEDDING_MIN: 0.1,      // 10% startups should have embeddings
  ML_INVESTOR_EMBEDDING_MIN: 0.1,     // 10% investors should have embeddings
  
  // ─── DATABASE INTEGRITY ───────────────────────────────────────────────
  DB_REQUIRED_TABLES: [
    'startup_uploads',
    'investors', 
    'startup_investor_matches',
    'discovered_startups',
    'rss_sources'
  ],
};

const COLORS = {
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m'
};

function log(level, message) {
  const colors = { 
    INFO: COLORS.BLUE, 
    OK: COLORS.GREEN, 
    WARN: COLORS.YELLOW, 
    ERROR: COLORS.RED 
  };
  console.log(`${colors[level] || ''}[${level}]${COLORS.RESET} ${message}`);
}

// ============================================================================
// 1. SCRAPER HEALTH CHECK
// ============================================================================
async function checkScraperHealth() {
  const issues = [];
  
  try {
    // Check PM2 process status
    const pm2Status = execSync('pm2 jlist 2>/dev/null || echo "[]"').toString();
    const processes = JSON.parse(pm2Status);
    
    // Updated to match ecosystem.config.js process names (Feb 4, 2026)
    const scrapers = ['rss-scraper', 'simple-rss-discovery', 'high-volume-discovery'];
    
    for (const name of scrapers) {
      const proc = processes.find(p => p.name === name);
      if (!proc) {
        issues.push(`${name}: NOT FOUND`);
        continue;
      }
      
      if (proc.pm2_env.status !== 'online') {
        issues.push(`${name}: ${proc.pm2_env.status.toUpperCase()}`);
      }
      
      // Check restart count (too many = problems)
      if (proc.pm2_env.restart_time > 50) {
        issues.push(`${name}: HIGH RESTARTS (${proc.pm2_env.restart_time})`);
      }
    }
    
    // Check RSS source success rate
    const { data: rssSources } = await supabase
      .from('rss_sources')
      .select('name, active, last_fetched, error_count')
      .eq('active', true);
    
    if (rssSources) {
      const errorSources = rssSources.filter(s => (s.error_count || 0) > 5);
      if (errorSources.length > rssSources.length * 0.3) {
        issues.push(`RSS: ${errorSources.length}/${rssSources.length} sources failing`);
      }
    }
    
    // Check recent discoveries
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentDiscoveries } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneDayAgo);
    
    if ((recentDiscoveries || 0) < 5) {
      issues.push(`LOW DISCOVERY: Only ${recentDiscoveries} startups in 24h`);
    }
    
  } catch (err) {
    issues.push(`Check failed: ${err.message}`);
  }
  
  return {
    name: 'Scraper Health',
    status: issues.length === 0 ? 'OK' : issues.length < 3 ? 'WARN' : 'ERROR',
    issues
  };
}

// ============================================================================
// 2. GOD SCORE BIAS DETECTION
// ============================================================================
async function checkGodScoreBias() {
  const issues = [];
  
  try {
    // Get score distribution
    const { data: stats } = await supabase.rpc('exec_sql_rows', {
      sql_query: `
        SELECT 
          COUNT(*) as total,
          AVG(total_god_score) as avg_score,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_god_score) as median,
          COUNT(*) FILTER (WHERE total_god_score < 30) as very_low,
          COUNT(*) FILTER (WHERE total_god_score >= 30 AND total_god_score < 50) as low,
          COUNT(*) FILTER (WHERE total_god_score >= 50 AND total_god_score < 70) as medium,
          COUNT(*) FILTER (WHERE total_god_score >= 70 AND total_god_score < 85) as high,
          COUNT(*) FILTER (WHERE total_god_score >= 85) as elite
        FROM startup_uploads
        WHERE status = 'approved' AND total_god_score IS NOT NULL
      `
    });
    
    if (stats && stats[0]) {
      const s = stats[0];
      const avg = parseFloat(s.avg_score) || 0;
      const total = parseInt(s.total) || 1;
      
      // Check average score
      if (avg < THRESHOLDS.GOD_SCORE_MIN_AVG) {
        issues.push(`AVG SCORE TOO LOW: ${avg.toFixed(1)} (min: ${THRESHOLDS.GOD_SCORE_MIN_AVG})`);
      }
      if (avg > THRESHOLDS.GOD_SCORE_MAX_AVG) {
        issues.push(`AVG SCORE TOO HIGH: ${avg.toFixed(1)} (max: ${THRESHOLDS.GOD_SCORE_MAX_AVG}) - possible inflation`);
      }
      
      // Check distribution skew
      const lowPercent = (parseInt(s.very_low) + parseInt(s.low)) / total;
      if (lowPercent > THRESHOLDS.GOD_SCORE_LOW_PERCENT_MAX) {
        issues.push(`TOO MANY LOW SCORES: ${(lowPercent * 100).toFixed(0)}% below 50 (max: ${THRESHOLDS.GOD_SCORE_LOW_PERCENT_MAX * 100}%)`);
      }
      
      // Check for elite drought (only if threshold > 0)
      const elitePercent = parseInt(s.elite) / total;
      if (THRESHOLDS.GOD_SCORE_ELITE_MIN_PERCENT > 0 && elitePercent < THRESHOLDS.GOD_SCORE_ELITE_MIN_PERCENT && total > 100) {
        issues.push(`ELITE DROUGHT: Only ${(elitePercent * 100).toFixed(1)}% scoring 85+`);
      }
      
      // Store for dashboard
      this.godScoreStats = s;
    }
    
  } catch (err) {
    issues.push(`Score analysis failed: ${err.message}`);
  }
  
  return {
    name: 'GOD Score Health',
    status: issues.length === 0 ? 'OK' : issues.length < 2 ? 'WARN' : 'ERROR',
    issues,
    stats: this.godScoreStats
  };
}

// ============================================================================
// 3. DATABASE SCHEMA INTEGRITY
// ============================================================================
async function checkDatabaseIntegrity() {
  const issues = [];
  
  try {
    // Check startup_uploads has required columns
    const { data: startupCols } = await supabase.rpc('exec_sql_rows', {
      sql_query: `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'startup_uploads'
      `
    });
    
    const requiredStartupCols = ['id', 'name', 'status', 'total_god_score', 'sectors', 'stage'];
    const existingCols = (startupCols || []).map(c => c.column_name);
    
    for (const col of requiredStartupCols) {
      if (!existingCols.includes(col)) {
        issues.push(`startup_uploads missing column: ${col}`);
      }
    }
    
    // Check investors has required columns
    const { data: investorCols } = await supabase.rpc('exec_sql_rows', {
      sql_query: `
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'investors'
      `
    });
    
    const requiredInvestorCols = ['id', 'name', 'sectors', 'stage', 'investor_score'];
    const existingInvCols = (investorCols || []).map(c => c.column_name);
    
    for (const col of requiredInvestorCols) {
      if (!existingInvCols.includes(col)) {
        issues.push(`investors missing column: ${col}`);
      }
    }
    
    // Check for orphaned data
    const { data: orphanCheck } = await supabase.rpc('exec_sql_rows', {
      sql_query: `
        SELECT 
          (SELECT COUNT(*) FROM startup_uploads WHERE status IS NULL) as null_status,
          (SELECT COUNT(*) FROM startup_uploads WHERE name IS NULL OR name = '') as null_name,
          (SELECT COUNT(*) FROM investors WHERE name IS NULL OR name = '') as null_inv_name
      `
    });
    
    if (orphanCheck && orphanCheck[0]) {
      const o = orphanCheck[0];
      if (parseInt(o.null_status) > 0) issues.push(`${o.null_status} startups with NULL status`);
      if (parseInt(o.null_name) > 0) issues.push(`${o.null_name} startups with no name`);
      if (parseInt(o.null_inv_name) > 0) issues.push(`${o.null_inv_name} investors with no name`);
    }
    
  } catch (err) {
    issues.push(`Schema check failed: ${err.message}`);
  }
  
  return {
    name: 'Database Integrity',
    status: issues.length === 0 ? 'OK' : issues.length < 3 ? 'WARN' : 'ERROR',
    issues
  };
}

// ============================================================================
// 4. MATCH QUALITY CHECK
// ============================================================================
async function checkMatchQuality() {
  const issues = [];
  
  try {
    const { data: matchStats } = await supabase.rpc('exec_sql_rows', {
      sql_query: `
        SELECT 
          COUNT(*) as total,
          AVG(match_score) as avg_score,
          COUNT(*) FILTER (WHERE match_score >= 70) as high_quality,
          COUNT(*) FILTER (WHERE match_score >= 50 AND match_score < 70) as medium_quality,
          COUNT(*) FILTER (WHERE match_score < 50) as low_quality,
          COUNT(*) FILTER (WHERE confidence_level = 'high') as high_confidence
        FROM startup_investor_matches
      `
    });
    
    if (matchStats && matchStats[0]) {
      const m = matchStats[0];
      const total = parseInt(m.total) || 1;
      
      // Check total matches
      if (total < THRESHOLDS.MATCH_MIN_COUNT) {
        issues.push(`LOW MATCH COUNT: ${total} (min: ${THRESHOLDS.MATCH_MIN_COUNT})`);
      }
      
      // Check high quality percentage
      const highPercent = parseInt(m.high_quality) / total;
      if (highPercent < THRESHOLDS.MATCH_HIGH_QUALITY_MIN) {
        issues.push(`LOW HIGH-QUALITY: ${(highPercent * 100).toFixed(1)}% at 70+ (min: ${THRESHOLDS.MATCH_HIGH_QUALITY_MIN * 100}%)`);
      }
      
      // Check low quality flooding
      const lowPercent = parseInt(m.low_quality) / total;
      if (lowPercent > THRESHOLDS.MATCH_LOW_QUALITY_MAX) {
        issues.push(`TOO MANY LOW-QUALITY: ${(lowPercent * 100).toFixed(0)}% below 50 (max: ${THRESHOLDS.MATCH_LOW_QUALITY_MAX * 100}%)`);
      }
      
      this.matchStats = m;
    }
    
  } catch (err) {
    issues.push(`Match analysis failed: ${err.message}`);
  }
  
  return {
    name: 'Match Quality',
    status: issues.length === 0 ? 'OK' : issues.length < 2 ? 'WARN' : 'ERROR',
    issues,
    stats: this.matchStats
  };
}

// ============================================================================
// 5. ML PIPELINE CHECK
// ============================================================================
async function checkMLPipeline() {
  const issues = [];
  
  try {
    // Check embedding coverage
    const { data: embeddingStats } = await supabase.rpc('exec_sql_rows', {
      sql_query: `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding
        FROM startup_uploads
        WHERE status = 'approved'
      `
    });
    
    if (embeddingStats && embeddingStats[0]) {
      const e = embeddingStats[0];
      const coverage = parseInt(e.with_embedding) / (parseInt(e.total) || 1);
      
      if (coverage < THRESHOLDS.ML_EMBEDDING_MIN_PERCENT) {
        issues.push(`LOW EMBEDDING COVERAGE: ${(coverage * 100).toFixed(0)}% (min: ${THRESHOLDS.ML_EMBEDDING_MIN_PERCENT * 100}%)`);
      }
    }
    
    // Check investor embeddings
    const { data: invEmbStats } = await supabase.rpc('exec_sql_rows', {
      sql_query: `
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE embedding IS NOT NULL) as with_embedding
        FROM investors
      `
    });
    
    if (invEmbStats && invEmbStats[0]) {
      const e = invEmbStats[0];
      const coverage = parseInt(e.with_embedding) / (parseInt(e.total) || 1);
      
      if (coverage < THRESHOLDS.ML_EMBEDDING_MIN_PERCENT) {
        issues.push(`LOW INVESTOR EMBEDDING: ${(coverage * 100).toFixed(0)}%`);
      }
    }
    
  } catch (err) {
    issues.push(`ML check failed: ${err.message}`);
  }
  
  return {
    name: 'ML Pipeline',
    status: issues.length === 0 ? 'OK' : 'WARN',
    issues
  };
}

// ============================================================================
// 6. DATA FRESHNESS CHECK  
// ============================================================================
async function checkDataFreshness() {
  const issues = [];
  
  try {
    const staleThreshold = new Date(Date.now() - THRESHOLDS.STALE_STARTUP_HOURS * 60 * 60 * 1000).toISOString();
    
    // Check last startup discovery
    const { data: lastStartup } = await supabase
      .from('startup_uploads')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (lastStartup) {
      const hoursAgo = (Date.now() - new Date(lastStartup.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > THRESHOLDS.STALE_STARTUP_HOURS) {
        issues.push(`NO NEW STARTUPS: Last added ${hoursAgo.toFixed(0)}h ago`);
      }
    }
    
    // Check last investor update
    const { data: lastInvestor } = await supabase
      .from('investors')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (lastInvestor) {
      const hoursAgo = (Date.now() - new Date(lastInvestor.updated_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 48) {
        issues.push(`STALE INVESTORS: Last updated ${hoursAgo.toFixed(0)}h ago`);
      }
    }
    
    // Check match freshness
    const { data: lastMatch } = await supabase
      .from('startup_investor_matches')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (lastMatch) {
      const hoursAgo = (Date.now() - new Date(lastMatch.created_at).getTime()) / (1000 * 60 * 60);
      if (hoursAgo > 6) {
        issues.push(`STALE MATCHES: Last generated ${hoursAgo.toFixed(0)}h ago`);
      }
    }
    
  } catch (err) {
    issues.push(`Freshness check failed: ${err.message}`);
  }
  
  return {
    name: 'Data Freshness',
    status: issues.length === 0 ? 'OK' : issues.length < 2 ? 'WARN' : 'ERROR',
    issues
  };
}

// ============================================================================
// AUTO-HEALING ACTIONS
// ============================================================================
async function performAutoHealing(checks) {
  const actions = [];
  
  // Check if scraper needs restart
  const scraperCheck = checks.find(c => c.name === 'Scraper Health');
  if (scraperCheck?.status === 'ERROR') {
    try {
      execSync('pm2 restart scraper rss-scraper 2>/dev/null || true');
      actions.push('Restarted stuck scrapers');
    } catch (e) {}
  }
  
  // Check if matches need regeneration
  const matchCheck = checks.find(c => c.name === 'Match Quality');
  if (matchCheck?.status === 'ERROR' || (matchCheck?.stats?.total || 0) < 1000) {
    try {
      spawn('node', ['match-regenerator.js'], {
        cwd: process.cwd(),
        detached: true,
        stdio: 'ignore'
      }).unref();
      actions.push('Triggered match regeneration');
    } catch (e) {}
  }
  
  return actions;
}

// ============================================================================
// MAIN DASHBOARD
// ============================================================================
async function runGuardian() {
  console.log('\n' + '═'.repeat(70));
  console.log(`${COLORS.BOLD}🛡️  HOT MATCH SYSTEM GUARDIAN${COLORS.RESET}`);
  console.log('═'.repeat(70));
  console.log(`⏰ ${new Date().toISOString()}\n`);
  
  const checks = [];
  
  // Run all checks
  console.log('Running health checks...\n');
  
  checks.push(await checkScraperHealth());
  checks.push(await checkGodScoreBias());
  checks.push(await checkDatabaseIntegrity());
  checks.push(await checkMatchQuality());
  checks.push(await checkMLPipeline());
  checks.push(await checkDataFreshness());
  
  // Display results
  console.log('─'.repeat(70));
  console.log(`${COLORS.BOLD}HEALTH STATUS${COLORS.RESET}`);
  console.log('─'.repeat(70));
  
  let overallStatus = 'OK';
  
  for (const check of checks) {
    const statusColor = check.status === 'OK' ? COLORS.GREEN : 
                       check.status === 'WARN' ? COLORS.YELLOW : COLORS.RED;
    const icon = check.status === 'OK' ? '✅' : check.status === 'WARN' ? '⚠️' : '❌';
    
    console.log(`\n${icon} ${COLORS.BOLD}${check.name}${COLORS.RESET}: ${statusColor}${check.status}${COLORS.RESET}`);
    
    if (check.issues.length > 0) {
      check.issues.forEach(issue => console.log(`   → ${issue}`));
    }
    
    if (check.status === 'ERROR') overallStatus = 'ERROR';
    else if (check.status === 'WARN' && overallStatus === 'OK') overallStatus = 'WARN';
  }
  
  // Auto-healing
  console.log('\n' + '─'.repeat(70));
  console.log(`${COLORS.BOLD}AUTO-HEALING${COLORS.RESET}`);
  console.log('─'.repeat(70));
  
  const actions = await performAutoHealing(checks);
  if (actions.length > 0) {
    actions.forEach(a => console.log(`   🔧 ${a}`));
  } else {
    console.log('   No actions needed');
  }
  
  // Create data integrity snapshot
  console.log('\n' + '─'.repeat(70));
  console.log(`${COLORS.BOLD}DATA INTEGRITY SNAPSHOT${COLORS.RESET}`);
  console.log('─'.repeat(70));
  
  try {
    const { data: snapshot } = await supabase.rpc('create_integrity_snapshot');
    const { data: latestSnapshot } = await supabase
      .from('data_integrity_snapshots')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (latestSnapshot) {
      console.log(`   📊 Startups: ${latestSnapshot.approved_startups} (${latestSnapshot.startups_delta >= 0 ? '+' : ''}${latestSnapshot.startups_delta})`);
      console.log(`   📊 Investors: ${latestSnapshot.total_investors} (${latestSnapshot.investors_delta >= 0 ? '+' : ''}${latestSnapshot.investors_delta})`);
      console.log(`   📊 Matches: ${latestSnapshot.total_matches} (${latestSnapshot.matches_delta >= 0 ? '+' : ''}${latestSnapshot.matches_delta})`);
      console.log(`   📊 Avg GOD Score: ${latestSnapshot.avg_god_score?.toFixed(1) || 'N/A'}`);
      
      if (latestSnapshot.has_deviation) {
        console.log(`   ${COLORS.RED}⚠️ DEVIATION DETECTED: ${latestSnapshot.deviation_notes}${COLORS.RESET}`);
      }
    }
  } catch (e) {
    console.log(`   ⚠️ Could not create snapshot: ${e.message}`);
  }
  
  // Summary
  console.log('\n' + '═'.repeat(70));
  const summaryColor = overallStatus === 'OK' ? COLORS.GREEN : 
                      overallStatus === 'WARN' ? COLORS.YELLOW : COLORS.RED;
  console.log(`${COLORS.BOLD}OVERALL STATUS: ${summaryColor}${overallStatus}${COLORS.RESET}`);
  console.log('═'.repeat(70) + '\n');
  
  // Log to database
  try {
    await supabase.from('ai_logs').insert({
      type: 'guardian',
      input: { timestamp: new Date().toISOString() },
      output: { 
        overall: overallStatus, 
        checks: checks.map(c => ({ name: c.name, status: c.status, issues: c.issues })),
        actions
      },
      status: overallStatus === 'OK' ? 'success' : overallStatus === 'WARN' ? 'warning' : 'error'
    });
  } catch (e) {}
  
  // Exit with appropriate code
  if (overallStatus === 'ERROR') process.exit(1);
}

// Run
runGuardian().catch(err => {
  console.error('Guardian failed:', err);
  process.exit(1);
});
