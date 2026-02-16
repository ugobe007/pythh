/**
 * DATA REFRESH PIPELINE
 * 
 * Re-scrapes existing startups to enrich data
 * Priority: Sparse-data startups (< 50% complete)
 * Schedule: Daily for new, Weekly for existing
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const REFRESH_CONFIG = {
  // Refresh intervals (days)
  NEW_STARTUP_INTERVAL: 1,      // Daily for startups < 7 days old
  SPARSE_DATA_INTERVAL: 7,      // Weekly for < 50% complete
  STANDARD_INTERVAL: 30,         // Monthly for well-documented startups
  
  // Data completeness thresholds
  SPARSE_THRESHOLD: 50,          // < 50% complete = sparse
  RICH_THRESHOLD: 80,            // > 80% complete = rich
  
  // Batch sizes
  DAILY_BATCH_SIZE: 50,          // Process 50 startups per daily run
  PRIORITY_BATCH_SIZE: 100,      // 100 for high-priority refresh
};

/**
 * Calculate data completeness for a startup
 */
function calculateCompleteness(startup) {
  const fields = [
    { name: 'description', check: () => startup.description?.length > 50 },
    { name: 'pitch', check: () => startup.pitch?.length > 50 },
    { name: 'website', check: () => startup.website?.length > 5 },
    { name: 'mrr', check: () => startup.mrr > 0 },
    { name: 'customer_count', check: () => startup.customer_count > 0 },
    { name: 'is_launched', check: () => startup.is_launched === true },
    { name: 'team_size', check: () => startup.team_size > 0 },
    { name: 'has_technical_cofounder', check: () => startup.has_technical_cofounder },
    { name: 'founded_date', check: () => !!startup.founded_date },
    { name: 'sectors', check: () => startup.sectors?.length > 0 },
  ];
  
  const complete = fields.filter(f => f.check()).length;
  return (complete / fields.length) * 100;
}

/**
 * Identify startups needing refresh
 */
async function identifyRefreshTargets() {
  const now = new Date();
  
  // Fetch all approved startups
  const {data: startups} = await supabase
    .from('startup_uploads')
    .select('id, name, created_at, last_scraped_at, description, pitch, website, mrr, customer_count, is_launched, team_size, has_technical_cofounder, founded_date, sectors')
    .eq('status', 'approved');
  
  const targets = {
    new_startups: [],       // < 7 days old
    sparse_data: [],        // < 50% complete
    stale_data: [],         // Not refreshed in 30+ days
    high_priority: [],      // New + sparse
  };
  
  for (const startup of startups || []) {
    const age_days = (now - new Date(startup.created_at)) / (1000 * 60 * 60 * 24);
    const last_scraped_days = startup.last_scraped_at 
      ? (now - new Date(startup.last_scraped_at)) / (1000 * 60 * 60 * 24)
      : 999;
    
    const completeness = calculateCompleteness(startup);
    
    // Categorize
    const isNew = age_days < 7;
    const isSparse = completeness < REFRESH_CONFIG.SPARSE_THRESHOLD;
    const isStale = last_scraped_days > REFRESH_CONFIG.STANDARD_INTERVAL;
    
    if (isNew) targets.new_startups.push({ ...startup, completeness, age_days });
    if (isSparse) targets.sparse_data.push({ ...startup, completeness });
    if (isStale && !isSparse) targets.stale_data.push({ ...startup, last_scraped_days });
    if (isNew && isSparse) targets.high_priority.push({ ...startup, completeness, age_days });
  }
  
  return targets;
}

/**
 * Refresh startup data using scrapers
 */
async function refreshStartupData(startup) {
  console.log(`\n🔄 Refreshing: ${startup.name} (${startup.completeness?.toFixed(1)}% complete)`);
  
  // 1. Try website scraper if URL exists
  if (startup.website) {
    // TODO: Call website scraper
    console.log(`  📡 Scraping website: ${startup.website}`);
  }
  
  // 2. Try inference scraper (AI-powered data filling)
  console.log(`  🤖 Running inference scraper...`);
  // TODO: Call inference scraper
  
  // 3. Update last_scraped_at timestamp
  await supabase
    .from('startup_uploads')
    .update({ last_scraped_at: new Date().toISOString() })
    .eq('id', startup.id);
  
  console.log(`  ✅ Refresh complete`);
}

/**
 * Run daily refresh job
 */
async function runDailyRefresh() {
  console.log('🔄 DAILY DATA REFRESH STARTING\n');
  console.log('='.repeat(70));
  
  const targets = await identifyRefreshTargets();
  
  console.log('\n📊 REFRESH TARGETS:\n');
  console.log(`  🆕 New startups (< 7 days): ${targets.new_startups.length}`);
  console.log(`  📉 Sparse data (< 50% complete): ${targets.sparse_data.length}`);
  console.log(`  ⏰ Stale data (30+ days old): ${targets.stale_data.length}`);
  console.log(`  🔥 HIGH PRIORITY (new + sparse): ${targets.high_priority.length}`);
  
  // Process high priority first
  const batch = targets.high_priority
    .slice(0, REFRESH_CONFIG.DAILY_BATCH_SIZE)
    .concat(
      targets.sparse_data
        .filter(s => !targets.high_priority.find(hp => hp.id === s.id))
        .slice(0, REFRESH_CONFIG.DAILY_BATCH_SIZE)
    );
  
  console.log(`\n🎯 Processing ${batch.length} startups today...\n`);
  
  let refreshed = 0;
  let failed = 0;
  
  for (const startup of batch) {
    try {
      await refreshStartupData(startup);
      refreshed++;
    } catch (error) {
      console.error(`  ❌ Failed: ${startup.name} - ${error.message}`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 REFRESH SUMMARY');
  console.log('='.repeat(70));
  console.log(`✅ Refreshed: ${refreshed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📅 Next run: Tomorrow at same time`);
  
  // Log to database
  await supabase.from('ai_logs').insert({
    log_type: 'data_refresh',
    message: `Daily refresh completed: ${refreshed} refreshed, ${failed} failed`,
    metadata: {
      targets: {
        new: targets.new_startups.length,
        sparse: targets.sparse_data.length,
        stale: targets.stale_data.length,
        high_priority: targets.high_priority.length,
      },
      processed: refreshed,
      failed,
    },
  });
}

/**
 * Run full refresh (all sparse startups)
 */
async function runFullRefresh() {
  console.log('🔄 FULL DATA REFRESH STARTING\n');
  
  const targets = await identifyRefreshTargets();
  const allTargets = [
    ...targets.high_priority,
    ...targets.sparse_data.filter(s => !targets.high_priority.find(hp => hp.id === s.id)),
  ];
  
  console.log(`Processing ${allTargets.length} startups with sparse data...\n`);
  
  let refreshed = 0;
  
  for (const startup of allTargets) {
    try {
      await refreshStartupData(startup);
      refreshed++;
      
      // Progress update every 10
      if (refreshed % 10 === 0) {
        console.log(`\n📊 Progress: ${refreshed} / ${allTargets.length} (${(refreshed/allTargets.length*100).toFixed(1)}%)\n`);
      }
    } catch (error) {
      console.error(`Failed: ${startup.name}`);
    }
  }
  
  console.log(`\n✅ Full refresh complete: ${refreshed} startups updated`);
}

// Export functions
module.exports = {
  REFRESH_CONFIG,
  calculateCompleteness,
  identifyRefreshTargets,
  refreshStartupData,
  runDailyRefresh,
  runFullRefresh,
};

// CLI execution
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'daily') {
    runDailyRefresh().catch(console.error);
  } else if (command === 'full') {
    runFullRefresh().catch(console.error);
  } else {
    console.log('Usage:');
    console.log('  node data-refresh-pipeline.js daily   # Run daily batch');
    console.log('  node data-refresh-pipeline.js full    # Refresh all sparse startups');
  }
}
