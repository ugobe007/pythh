#!/usr/bin/env node
/**
 * Comprehensive System Health Check
 * Checks health of: Scraper, Database, GOD Scoring, Matching Engine
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const HEALTH_STATUS = {
  HEALTHY: '✅ HEALTHY',
  WARNING: '⚠️ WARNING',
  CRITICAL: '❌ CRITICAL',
  UNKNOWN: '❓ UNKNOWN'
};

async function checkDatabaseHealth() {
  console.log('\n📊 DATABASE HEALTH CHECK\n');
  console.log('═'.repeat(60));

  try {
    // Check startup_uploads
    const { count: totalStartups, error: startupsError } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true });

    const { count: approvedStartups } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: pendingStartups } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Check investors
    const { count: totalInvestors, error: investorsError } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true });

    const { count: activeInvestors } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Check matches
    const { count: totalMatches, error: matchesError } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });

    // Check discovered startups
    const { count: discoveredCount } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true });

    // Check matching queue
    const { count: queuePending } = await supabase
      .from('matching_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // GOD Score statistics
    const { data: godScores } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .limit(1000);

    const avgGODScore = godScores && godScores.length > 0
      ? godScores.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / godScores.length
      : 0;

    // Status assessment
    let status = HEALTH_STATUS.HEALTHY;
    const issues = [];

    if (startupsError || investorsError || matchesError) {
      status = HEALTH_STATUS.CRITICAL;
      issues.push('Database connection errors detected');
    }

    if ((totalStartups || 0) < 100) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`Low startup count: ${totalStartups || 0} (expected >100)`);
    }

    if ((totalInvestors || 0) < 100) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`Low investor count: ${totalInvestors || 0} (expected >100)`);
    }

    if ((totalMatches || 0) === 0) {
      status = HEALTH_STATUS.CRITICAL;
      issues.push('No matches found - queue processor needs to run');
    }

    if ((queuePending || 0) > 100) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`Large queue backlog: ${queuePending || 0} pending startups`);
    }

    // Display results
    console.log(`Status: ${status}`);
    console.log(`\n📈 Statistics:`);
    console.log(`  Startups:`);
    console.log(`    Total: ${totalStartups || 0}`);
    console.log(`    Approved: ${approvedStartups || 0}`);
    console.log(`    Pending: ${pendingStartups || 0}`);
    console.log(`  Investors:`);
    console.log(`    Total: ${totalInvestors || 0}`);
    console.log(`    Active: ${activeInvestors || 0}`);
    console.log(`  Matches:`);
    console.log(`    Total: ${totalMatches || 0}`);
    console.log(`  Queue:`);
    console.log(`    Pending: ${queuePending || 0}`);
    console.log(`  Discovered Startups:`);
    console.log(`    Waiting: ${discoveredCount || 0}`);
    console.log(`  GOD Scores:`);
    console.log(`    Average: ${avgGODScore.toFixed(1)} (${godScores?.length || 0} startups with scores)`);

    if (issues.length > 0) {
      console.log(`\n⚠️ Issues:`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return { status, totalStartups, totalInvestors, totalMatches, issues };

  } catch (error) {
    console.error(`\n❌ Error checking database health:`, error.message);
    return { status: HEALTH_STATUS.CRITICAL, error: error.message };
  }
}

async function checkScraperHealth() {
  console.log('\n🕷️ SCRAPER HEALTH CHECK\n');
  console.log('═'.repeat(60));

  try {
    // Check recent scraper activity
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count: recentLogs } = await supabase
      .from('scraper_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h);

    const { data: recentJobs } = await supabase
      .from('scraper_jobs')
      .select('*')
      .gte('created_at', last24h)
      .order('created_at', { ascending: false })
      .limit(10);

    // Check RSS articles
    const { count: recentArticles } = await supabase
      .from('rss_articles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h);

    // Check discovered startups (recent) — simple-rss-scraper
    const { count: recentDiscovered } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h);

    // Check startup_events (last 24h) — ssot-rss-scraper writes here (primary RSS pipeline)
    const { count: recentEvents } = await supabase
      .from('startup_events')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h);

    let status = HEALTH_STATUS.HEALTHY;
    const issues = [];

    // Primary signal: ssot-rss-scraper writes to startup_events; simple-rss writes to discovered_startups
    const hasRssActivity = (recentEvents || 0) > 0 || (recentDiscovered || 0) > 0;
    if (!hasRssActivity) {
      status = HEALTH_STATUS.WARNING;
      issues.push('No RSS activity in last 24h (startup_events or discovered_startups)');
    }
    // Legacy tables — warn only if we have no activity anywhere
    if ((recentLogs || 0) === 0 && !hasRssActivity) {
      issues.push('No scraper_logs in last 24 hours (optional — main scrapers use startup_events/discovered_startups)');
    }
    if ((recentArticles || 0) === 0 && !hasRssActivity) {
      issues.push('No rss_articles in last 24 hours (optional — ssot/simple-rss use other tables)');
    }

    console.log(`Status: ${status}`);
    console.log(`\n📈 Last 24 Hours:`);
    console.log(`  Startup Events (ssot-rss): ${recentEvents || 0}`);
    console.log(`  Discovered Startups (simple-rss): ${recentDiscovered || 0}`);
    console.log(`  Scraper Logs: ${recentLogs || 0}`);
    console.log(`  RSS Articles: ${recentArticles || 0}`);
    console.log(`  Scraper Jobs: ${recentJobs?.length || 0}`);

    if (recentJobs && recentJobs.length > 0) {
      console.log(`\n📋 Recent Jobs:`);
      recentJobs.slice(0, 5).forEach(job => {
        const status = job.status || 'unknown';
        const icon = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⏳';
        console.log(`  ${icon} ${job.name || 'Unknown'} - ${status} (${new Date(job.created_at).toLocaleString()})`);
      });
    }

    if (issues.length > 0) {
      console.log(`\n⚠️ Issues:`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return { status, recentEvents, recentLogs, recentArticles, recentDiscovered, issues };

  } catch (error) {
    console.error(`\n❌ Error checking scraper health:`, error.message);
    return { status: HEALTH_STATUS.UNKNOWN, error: error.message };
  }
}

async function checkGODScoringHealth() {
  console.log('\n🎯 GOD SCORING SYSTEM HEALTH CHECK\n');
  console.log('═'.repeat(60));

  try {
    // Check approved startups with/without GOD scores
    const { count: approvedTotal } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    const { count: withGODScore } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .not('total_god_score', 'is', null);

    const { count: withoutGODScore } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .is('total_god_score', null);

    // Check score distribution
    const { data: scores } = await supabase
      .from('startup_uploads')
      .select('total_god_score')
      .eq('status', 'approved')
      .not('total_god_score', 'is', null)
      .limit(1000);

    const scoreDistribution = {
      excellent: scores?.filter(s => s.total_god_score >= 80).length || 0,
      good: scores?.filter(s => s.total_god_score >= 60 && s.total_god_score < 80).length || 0,
      fair: scores?.filter(s => s.total_god_score >= 40 && s.total_god_score < 60).length || 0,
      poor: scores?.filter(s => s.total_god_score < 40).length || 0
    };

    const avgScore = scores && scores.length > 0
      ? scores.reduce((sum, s) => sum + (s.total_god_score || 0), 0) / scores.length
      : 0;

    // Check score history
    const { count: scoreHistoryCount } = await supabase
      .from('score_history')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Check algorithm weight history
    const { data: recentWeights } = await supabase
      .from('algorithm_weight_history')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1);

    let status = HEALTH_STATUS.HEALTHY;
    const issues = [];

    const scoreCoverage = (withGODScore || 0) / (approvedTotal || 1) * 100;
    if (scoreCoverage < 50) {
      status = HEALTH_STATUS.CRITICAL;
      issues.push(`Low GOD score coverage: ${scoreCoverage.toFixed(1)}% (${withGODScore || 0}/${approvedTotal || 0})`);
    } else if (scoreCoverage < 80) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`GOD score coverage: ${scoreCoverage.toFixed(1)}% (${withGODScore || 0}/${approvedTotal || 0})`);
    }

    if (avgScore < 40) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`Low average GOD score: ${avgScore.toFixed(1)}`);
    }

    if ((withoutGODScore || 0) > 100) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`${withoutGODScore || 0} approved startups missing GOD scores`);
    }

    console.log(`Status: ${status}`);
    console.log(`\n📈 Statistics:`);
    console.log(`  Approved Startups: ${approvedTotal || 0}`);
    console.log(`  With GOD Score: ${withGODScore || 0} (${scoreCoverage.toFixed(1)}%)`);
    console.log(`  Without GOD Score: ${withoutGODScore || 0}`);
    console.log(`  Average Score: ${avgScore.toFixed(1)}`);
    console.log(`\n📊 Score Distribution:`);
    console.log(`  Excellent (80+): ${scoreDistribution.excellent}`);
    console.log(`  Good (60-79): ${scoreDistribution.good}`);
    console.log(`  Fair (40-59): ${scoreDistribution.fair}`);
    console.log(`  Poor (<40): ${scoreDistribution.poor}`);
    console.log(`\n📝 Activity (Last 7 days):`);
    console.log(`  Score History Entries: ${scoreHistoryCount || 0}`);
    if (recentWeights && recentWeights.length > 0) {
      console.log(`  Last Weight Update: ${new Date(recentWeights[0].created_at).toLocaleString()}`);
    } else {
      console.log(`  Last Weight Update: Never`);
    }

    if (issues.length > 0) {
      console.log(`\n⚠️ Issues:`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return { status, scoreCoverage, avgScore, withoutGODScore, issues };

  } catch (error) {
    console.error(`\n❌ Error checking GOD scoring health:`, error.message);
    return { status: HEALTH_STATUS.UNKNOWN, error: error.message };
  }
}

async function checkMatchingEngineHealth() {
  console.log('\n🎯 MATCHING ENGINE HEALTH CHECK\n');
  console.log('═'.repeat(60));

  try {
    // Check matches
    const { count: totalMatches } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });

    // Check recent matches
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: matches24h } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', last24h);

    // Check match quality distribution
    const { data: recentMatches } = await supabase
      .from('startup_investor_matches')
      .select('match_score')
      .order('created_at', { ascending: false })
      .limit(1000);

    const qualityDistribution = {
      excellent: recentMatches?.filter(m => (m.match_score || 0) >= 80).length || 0,
      good: recentMatches?.filter(m => (m.match_score || 0) >= 60 && (m.match_score || 0) < 80).length || 0,
      fair: recentMatches?.filter(m => (m.match_score || 0) >= 40 && (m.match_score || 0) < 60).length || 0,
      poor: recentMatches?.filter(m => (m.match_score || 0) < 40).length || 0
    };

    const avgMatchScore = recentMatches && recentMatches.length > 0
      ? recentMatches.reduce((sum, m) => sum + (m.match_score || 0), 0) / recentMatches.length
      : 0;

    // Check matching queue
    const { count: queuePending } = await supabase
      .from('matching_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: queueProcessing } = await supabase
      .from('matching_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const { count: queueCompleted } = await supabase
      .from('matching_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    const { count: queueFailed } = await supabase
      .from('matching_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed');

    let status = HEALTH_STATUS.HEALTHY;
    const issues = [];

    if ((totalMatches || 0) === 0) {
      status = HEALTH_STATUS.CRITICAL;
      issues.push('No matches found - queue processor needs to run');
    } else if ((totalMatches || 0) < 1000) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`Low match count: ${totalMatches || 0} (expected >1000)`);
    }

    if ((matches24h || 0) === 0 && (queuePending || 0) > 0) {
      status = HEALTH_STATUS.WARNING;
      issues.push('No matches created in last 24h but queue has pending items');
    }

    if ((queueFailed || 0) > 10) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`${queueFailed || 0} failed queue items need attention`);
    }

    if ((queuePending || 0) > 500) {
      status = HEALTH_STATUS.WARNING;
      issues.push(`Large queue backlog: ${queuePending || 0} pending startups`);
    }

    console.log(`Status: ${status}`);
    console.log(`\n📈 Statistics:`);
    console.log(`  Total Matches: ${totalMatches || 0}`);
    console.log(`  Matches (Last 24h): ${matches24h || 0}`);
    console.log(`  Average Match Score: ${avgMatchScore.toFixed(1)}`);
    console.log(`\n📊 Quality Distribution (Recent 1000):`);
    console.log(`  Excellent (80+): ${qualityDistribution.excellent}`);
    console.log(`  Good (60-79): ${qualityDistribution.good}`);
    console.log(`  Fair (40-59): ${qualityDistribution.fair}`);
    console.log(`  Poor (<40): ${qualityDistribution.poor}`);
    console.log(`\n📋 Queue Status:`);
    console.log(`  Pending: ${queuePending || 0}`);
    console.log(`  Processing: ${queueProcessing || 0}`);
    console.log(`  Completed: ${queueCompleted || 0}`);
    console.log(`  Failed: ${queueFailed || 0}`);

    if (issues.length > 0) {
      console.log(`\n⚠️ Issues:`);
      issues.forEach(issue => console.log(`  - ${issue}`));
    }

    return { status, totalMatches, matches24h, avgMatchScore, queuePending, issues };

  } catch (error) {
    console.error(`\n❌ Error checking matching engine health:`, error.message);
    return { status: HEALTH_STATUS.UNKNOWN, error: error.message };
  }
}

async function runComprehensiveHealthCheck() {
  console.log('\n🏥 COMPREHENSIVE SYSTEM HEALTH CHECK');
  console.log('═'.repeat(60));
  console.log(`Started: ${new Date().toLocaleString()}\n`);

  const results = {
    database: await checkDatabaseHealth(),
    scraper: await checkScraperHealth(),
    godScoring: await checkGODScoringHealth(),
    matchingEngine: await checkMatchingEngineHealth()
  };

  // Overall summary
  console.log('\n📋 OVERALL SYSTEM HEALTH SUMMARY');
  console.log('═'.repeat(60));

  const overallStatus = [
    results.database.status,
    results.scraper.status,
    results.godScoring.status,
    results.matchingEngine.status
  ];

  const hasCritical = overallStatus.includes(HEALTH_STATUS.CRITICAL);
  const hasWarning = overallStatus.includes(HEALTH_STATUS.WARNING);

  let overall = HEALTH_STATUS.HEALTHY;
  if (hasCritical) overall = HEALTH_STATUS.CRITICAL;
  else if (hasWarning) overall = HEALTH_STATUS.WARNING;

  console.log(`\nOverall Status: ${overall}`);
  console.log(`\nComponent Status:`);
  console.log(`  📊 Database: ${results.database.status}`);
  console.log(`  🕷️ Scraper: ${results.scraper.status}`);
  console.log(`  🎯 GOD Scoring: ${results.godScoring.status}`);
  console.log(`  🔗 Matching Engine: ${results.matchingEngine.status}`);

  // Recommendations
  const recommendations = [];
  
  if (results.database.issues && results.database.issues.length > 0) {
    recommendations.push('Address database issues above');
  }

  if (results.scraper.issues && results.scraper.issues.length > 0) {
    recommendations.push('Check scraper logs and restart if needed');
  }

  if (results.godScoring.withoutGODScore > 0) {
    recommendations.push(`Run GOD scoring for ${results.godScoring.withoutGODScore} startups without scores`);
  }

  if (results.matchingEngine.queuePending > 0) {
    recommendations.push(`Run queue processor to process ${results.matchingEngine.queuePending} pending startups`);
  }

  if (recommendations.length > 0) {
    console.log(`\n💡 Recommendations:`);
    recommendations.forEach(rec => console.log(`  - ${rec}`));
  }

  console.log(`\nCompleted: ${new Date().toLocaleString()}\n`);

  return results;
}

// Run the health check
runComprehensiveHealthCheck().catch(console.error);
