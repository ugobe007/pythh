#!/usr/bin/env node
/**
 * DAILY SYSTEM HEALTH REPORT
 * 
 * Monitors: Scrapers, Scores, Data Quality, Matches
 * Alerts: Anomalies, errors, system issues
 * Output: Console + Database log
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Try to import scoring guards (may not exist yet)
let checkDistributionHealth, detectMassChanges;
try {
  const guards = require('../server/services/scoringGuards');
  checkDistributionHealth = guards.checkDistributionHealth;
  detectMassChanges = guards.detectMassChanges;
} catch(e) {
  console.log('⚠️  Scoring guards not found, skipping those checks');
}

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function generateDailyReport() {
  const report = {
    timestamp: new Date().toISOString(),
    date: new Date().toLocaleDateString(),
    sections: {},
    alerts: [],
    summary: { working: [], needs_adjustment: [], needs_fixing: [] },
  };
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 DAILY SYSTEM HEALTH REPORT - ' + report.date);
  console.log('='.repeat(70) + '\n');
  
  // ============================================================================
  // 1. DATABASE HEALTH
  // ============================================================================
  console.log('📦 DATABASE HEALTH\n');
  
  const {count: approved_count} = await supabase
    .from('startup_uploads')
    .select('*', {count: 'exact', head: true})
    .eq('status', 'approved');
  
  const {count: discovered_count} = await supabase
    .from('discovered_startups')
    .select('*', {count: 'exact', head: true});
  
  const {count: investors_count} = await supabase
    .from('investors')
    .select('*', {count: 'exact', head: true});
  
  const {count: matches_count} = await supabase
    .from('startup_investor_matches')
    .select('*', {count: 'exact', head: true});
  
  report.sections.database = {
    approved_startups: approved_count,
    discovered_startups: discovered_count,
    investors: investors_count,
    matches: matches_count,
  };
  
  console.log(`  Approved Startups: ${approved_count}`);
  console.log(`  Discovered (pending): ${discovered_count}`);
  console.log(`  Investors: ${investors_count}`);
  console.log(`  Matches: ${matches_count}`);
  
  if (approved_count > 5000) report.summary.working.push('✅ Database: Healthy startup count');
  if (matches_count < 5000) {
    report.summary.needs_fixing.push('❌ Matches: Below 5,000 threshold');
    report.alerts.push('⚠️ Match count low - run match-regenerator.js');
  }
  
  // ============================================================================
  // 2. GOD SCORE DISTRIBUTION
  // ============================================================================
  console.log('\n🎯 GOD SCORE HEALTH\n');
  
  let scoreHealth = null;
  if (checkDistributionHealth) {
    scoreHealth = await checkDistributionHealth(supabase);
    report.sections.scores = scoreHealth;
    
    console.log(`  Average: ${scoreHealth.average} / 100`);
    console.log(`  Target: ${scoreHealth.expected}`);
    console.log(`  Status: ${scoreHealth.status}`);
    
    if (scoreHealth.healthy) {
      report.summary.working.push('✅ Scores: Distribution healthy');
    } else {
      report.summary.needs_adjustment.push(`⚠️ Scores: Avg ${scoreHealth.average} outside target range`);
      report.alerts.push(`⚠️ Score average out of range: ${scoreHealth.average}`);
    }
  }
  
  // Check for mass changes
  if (detectMassChanges) {
    const massChange = await detectMassChanges(supabase, 3600); // Last hour
    if (massChange.alert) {
      report.alerts.push(massChange.message);
      report.summary.needs_fixing.push('❌ Scores: Mass change detected');
    }
  }
  
  // Score distribution breakdown
  const {data: scores} = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .limit(1000);
  
  if (scores) {
    const distribution = {
      '< 40': scores.filter(s => s.total_god_score < 40).length,
      '40-59': scores.filter(s => s.total_god_score >= 40 && s.total_god_score < 60).length,
      '60-79': scores.filter(s => s.total_god_score >= 60 && s.total_god_score < 80).length,
      '80+': scores.filter(s => s.total_god_score >= 80).length,
    };
    
    console.log('\n  Distribution (sample 1000):');
    console.log(`    < 40: ${distribution['< 40']} (${(distribution['< 40']/10).toFixed(1)}%)`);
    console.log(`    40-59: ${distribution['40-59']} (${(distribution['40-59']/10).toFixed(1)}%)`);
    console.log(`    60-79: ${distribution['60-79']} (${(distribution['60-79']/10).toFixed(1)}%)`);
    console.log(`    80+: ${distribution['80+']} (${(distribution['80+']/10).toFixed(1)}%)`);
    
    report.sections.score_distribution = distribution;
  }
  
  // ============================================================================
  // 3. DATA QUALITY
  // ============================================================================
  console.log('\n📊 DATA QUALITY\n');
  
  const {data: sample} = await supabase
    .from('startup_uploads')
    .select('description, pitch, website, mrr, customer_count, team_size')
    .eq('status', 'approved')
    .limit(500);
  
  const quality = {
    with_website: sample.filter(s => s.website).length,
    with_pitch: sample.filter(s => s.pitch?.length > 30).length,
    with_traction: sample.filter(s => s.mrr > 0 || s.customer_count > 0).length,
    with_team_size: sample.filter(s => s.team_size > 0).length,
  };
  
  console.log(`  With website: ${quality.with_website} / 500 (${(quality.with_website/5).toFixed(1)}%)`);
  console.log(`  With pitch: ${quality.with_pitch} / 500 (${(quality.with_pitch/5).toFixed(1)}%)`);
  console.log(`  With traction: ${quality.with_traction} / 500 (${(quality.with_traction/5).toFixed(1)}%)`);
  console.log(`  With team size: ${quality.with_team_size} / 500 (${(quality.with_team_size/5).toFixed(1)}%)`);
  
  report.sections.data_quality = quality;
  
  if (quality.with_website / 5 > 70) report.summary.working.push('✅ Data Quality: Good website coverage');
  if (quality.with_traction / 5 < 10) {
    report.summary.needs_adjustment.push('⚠️ Data Quality: Low traction data (<10%)');
  }
  
  // ============================================================================
  // 4. SCRAPER HEALTH
  // ============================================================================
  console.log('\n🤖 SCRAPER HEALTH\n');
  
  const {data: recent_logs} = await supabase
    .from('ai_logs')
    .select('log_type, message, created_at')
    .in('log_type', ['scraper_run', 'data_refresh', 'inference'])
    .order('created_at', {ascending: false})
    .limit(10);
  
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent_scrapes = recent_logs?.filter(l => new Date(l.created_at) > last24h) || [];
  
  console.log(`  Recent scrapes (24h): ${recent_scrapes.length}`);
  
  if (recent_scrapes.length > 0) {
    console.log(`  Last scrape: ${new Date(recent_logs[0].created_at).toLocaleString()}`);
    report.summary.working.push('✅ Scrapers: Active in last 24h');
  } else {
    report.summary.needs_fixing.push('❌ Scrapers: No activity in 24h');
    report.alerts.push('⚠️ No scraper activity in last 24 hours');
  }
  
  report.sections.scrapers = {
    recent_activity: recent_scrapes.length,
    last_run: recent_logs?.[0]?.created_at,
  };
  
  // Self-healing metrics (failures vs recoveries)
  const { data: healingLogs } = await supabase
    .from('ai_logs')
    .select('log_type, metadata, created_at')
    .in('log_type', ['scraper_failure', 'scraper_recovery', 'scraper_non_recoverable'])
    .gte('created_at', last24h.toISOString());

  const healing = healingLogs || [];
  const failures24h = healing.filter(l => l.log_type === 'scraper_failure').length;
  const recoveries24h = healing.filter(l => l.log_type === 'scraper_recovery').length;
  const nonRecoverable24h = healing.filter(l => l.log_type === 'scraper_non_recoverable').length;
  const recoveryRate = failures24h > 0
    ? Number(((recoveries24h / failures24h) * 100).toFixed(1))
    : null;

  console.log(`  Self-healing failures (24h): ${failures24h}`);
  console.log(`  Self-healing recoveries (24h): ${recoveries24h}`);
  if (nonRecoverable24h > 0) {
    console.log(`  Non-recoverable errors (24h): ${nonRecoverable24h}`);
  }
  if (recoveryRate !== null) {
    console.log(`  Recovery rate: ${recoveryRate}%`);
  }

  report.sections.scraper_self_healing = {
    failures_24h: failures24h,
    recoveries_24h: recoveries24h,
    non_recoverable_24h: nonRecoverable24h,
    recovery_rate: recoveryRate,
  };
  
  if (failures24h > 0 && recoveryRate !== null && recoveryRate >= 50) {
    report.summary.working.push('✅ Self-healing: Active with good recovery rate');
  } else if (failures24h > 0 && recoveries24h === 0) {
    report.summary.needs_fixing.push('❌ Self-healing: Failures with no successful recoveries in last 24h');
    report.alerts.push('⚠️ Self-healing engine saw failures but no successful recoveries in last 24 hours');
  }

  // Scraper skip reasons (e.g., headline/person-like names, generic names)
  const { data: skipLogs } = await supabase
    .from('ai_logs')
    .select('metadata')
    .eq('log_type', 'scraper_skip')
    .gte('created_at', last24h.toISOString());

  const skipReasonCounts = {};
  (skipLogs || []).forEach((row) => {
    const reason = row.metadata?.reason || 'unknown';
    skipReasonCounts[reason] = (skipReasonCounts[reason] || 0) + 1;
  });

  const totalSkips = Object.values(skipReasonCounts).reduce((sum, n) => sum + n, 0);
  console.log(`  Skipped startups (24h): ${totalSkips}`);
  Object.entries(skipReasonCounts).forEach(([reason, count]) => {
    console.log(`    - ${reason}: ${count}`);
  });

  report.sections.scraper_skips = {
    total_24h: totalSkips,
    by_reason: skipReasonCounts,
  };
  
  // ============================================================================
  // 5. MATCH QUALITY
  // ============================================================================
  console.log('\n🎯 MATCH QUALITY\n');
  
  const {data: match_sample} = await supabase
    .from('startup_investor_matches')
    .select('match_score')
    .limit(500);
  
  if (match_sample && match_sample.length > 0) {
    const match_avg = match_sample.reduce((sum, m) => sum + m.match_score, 0) / match_sample.length;
    const high_quality = match_sample.filter(m => m.match_score > 70).length;
    
    console.log(`  Average match score: ${match_avg.toFixed(2)}`);
    console.log(`  High quality (>70): ${high_quality} / 500 (${(high_quality/5).toFixed(1)}%)`);
    
    report.sections.matches = {
      average_score: match_avg.toFixed(2),
      high_quality_percentage: (high_quality/5).toFixed(1),
    };
    
    if (match_avg > 60) report.summary.working.push('✅ Matches: Good average quality');
    if (high_quality / 5 < 20) {
      report.summary.needs_adjustment.push('⚠️ Matches: Low high-quality percentage (<20%)');
    }
  }
  
  // ============================================================================
  // 6. SYSTEM ERRORS
  // ============================================================================
  console.log('\n❌ ERRORS (Last 24h)\n');
  
  const {data: errors} = await supabase
    .from('ai_logs')
    .select('log_type, message, created_at')
    .eq('log_type', 'error')
    .gte('created_at', last24h.toISOString())
    .order('created_at', {ascending: false})
    .limit(10);
  
  if (errors && errors.length > 0) {
    console.log(`  Found ${errors.length} errors:`);
    errors.forEach(e => {
      console.log(`    - ${e.message} (${new Date(e.created_at).toLocaleTimeString()})`);
    });
    report.summary.needs_fixing.push(`❌ Errors: ${errors.length} in last 24h`);
  } else {
    console.log(`  ✅ No errors in last 24h`);
    report.summary.working.push('✅ System: No errors');
  }
  
  report.sections.errors = errors || [];
  
  // ============================================================================
  // SUMMARY
  // ============================================================================
  console.log('\n' + '='.repeat(70));
  console.log('📋 SUMMARY');
  console.log('='.repeat(70) + '\n');
  
  console.log('✅ WORKING:\n');
  report.summary.working.forEach(item => console.log(`  ${item}`));
  
  if (report.summary.needs_adjustment.length > 0) {
    console.log('\n⚠️ NEEDS ADJUSTMENT:\n');
    report.summary.needs_adjustment.forEach(item => console.log(`  ${item}`));
  }
  
  if (report.summary.needs_fixing.length > 0) {
    console.log('\n❌ NEEDS FIXING:\n');
    report.summary.needs_fixing.forEach(item => console.log(`  ${item}`));
  }
  
  if (report.alerts.length > 0) {
    console.log('\n🚨 ALERTS:\n');
    report.alerts.forEach(alert => console.log(`  ${alert}`));
  }
  
  console.log('\n' + '='.repeat(70));
  
  // Save report to database
  await supabase.from('ai_logs').insert({
    log_type: 'daily_health_report',
    message: `System health report: ${report.summary.working.length} working, ${report.summary.needs_adjustment.length} need adjustment, ${report.summary.needs_fixing.length} need fixing`,
    metadata: report,
  });
  
  // Save to file
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportFile = path.join(reportsDir, `daily-health-report-${new Date().toISOString().split('T')[0]}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(`\n💾 Report saved to: ${reportFile}`);
  
  return report;
}

// CLI execution
if (require.main === module) {
  generateDailyReport()
    .then(() => {
      console.log('\n✅ Daily report complete\n');
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Report failed:', error);
      process.exit(1);
    });
}

module.exports = { generateDailyReport };

