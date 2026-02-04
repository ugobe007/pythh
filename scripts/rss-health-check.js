#!/usr/bin/env node
/**
 * RSS Feed Health Monitor & Auto-Healer
 * 
 * Checks RSS feed health and auto-fixes common issues:
 * 1. Validates all active RSS feeds are reachable
 * 2. Marks broken feeds as inactive
 * 3. Retries never-scraped feeds
 * 4. Reports on feed quality
 * 
 * Usage:
 *   node scripts/rss-health-check.js           # Check only
 *   node scripts/rss-health-check.js --fix     # Auto-fix broken feeds
 *   node scripts/rss-health-check.js --test    # Test specific feeds
 */

require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotMatchBot/2.0)',
    'Accept': 'application/rss+xml, application/xml, text/xml'
  }
});

const args = process.argv.slice(2);
const FIX_MODE = args.includes('--fix');
const TEST_MODE = args.includes('--test');

// Colors
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Stats
const stats = {
  total: 0,
  healthy: 0,
  broken: 0,
  stale: 0,
  neverScraped: 0,
  fixed: 0,
  errors: []
};

async function testFeed(source) {
  try {
    const feedPromise = parser.parseURL(source.url);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('timeout')), 15000)
    );
    
    const feed = await Promise.race([feedPromise, timeoutPromise]);
    const itemCount = feed.items?.length || 0;
    
    return {
      success: true,
      itemCount,
      title: feed.title || source.name,
      lastUpdated: feed.lastBuildDate || feed.items?.[0]?.pubDate
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'unknown error'
    };
  }
}

async function checkRssHealth() {
  console.log(`\n${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${CYAN}                    RSS HEALTH CHECK                        ${RESET}`);
  console.log(`${BOLD}${CYAN}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`Mode: ${FIX_MODE ? 'Fix' : 'Check only'}\n`);
  
  // Get all active RSS sources
  const { data: sources, error } = await supabase
    .from('rss_sources')
    .select('id, name, url, active, last_scraped, category')
    .eq('active', true)
    .order('last_scraped', { ascending: true, nullsFirst: true });
  
  if (error) {
    console.log(`${RED}Failed to fetch RSS sources: ${error.message}${RESET}`);
    return;
  }
  
  stats.total = sources.length;
  console.log(`Found ${stats.total} active RSS sources\n`);
  
  // Categorize sources
  const neverScraped = sources.filter(s => !s.last_scraped);
  const stale = sources.filter(s => {
    if (!s.last_scraped) return false;
    const hoursSince = (Date.now() - new Date(s.last_scraped).getTime()) / (1000 * 60 * 60);
    return hoursSince > 48;
  });
  const recent = sources.filter(s => {
    if (!s.last_scraped) return false;
    const hoursSince = (Date.now() - new Date(s.last_scraped).getTime()) / (1000 * 60 * 60);
    return hoursSince <= 48;
  });
  
  stats.neverScraped = neverScraped.length;
  stats.stale = stale.length;
  
  console.log(`${BOLD}━━━ SOURCE BREAKDOWN ━━━${RESET}`);
  console.log(`${GREEN}✓${RESET} Recently scraped (≤48h): ${recent.length}`);
  console.log(`${YELLOW}⚠${RESET} Never scraped: ${neverScraped.length}`);
  console.log(`${YELLOW}⚠${RESET} Stale (>48h): ${stale.length}`);
  
  // Test problem feeds
  const problemFeeds = [...neverScraped.slice(0, 10), ...stale.slice(0, 10)];
  
  if (problemFeeds.length > 0) {
    console.log(`\n${BOLD}━━━ TESTING PROBLEM FEEDS ━━━${RESET}`);
    
    for (const source of problemFeeds) {
      process.stdout.write(`  ${source.name.substring(0, 40).padEnd(40)} `);
      
      const result = await testFeed(source);
      
      if (result.success) {
        console.log(`${GREEN}✓${RESET} ${result.itemCount} items`);
        stats.healthy++;
        
        // If in fix mode, try to scrape it now
        if (FIX_MODE && !source.last_scraped) {
          // Mark as ready for next scrape cycle
          console.log(`    ${CYAN}→ Will be scraped on next cycle${RESET}`);
        }
      } else {
        console.log(`${RED}✗${RESET} ${result.error}`);
        stats.broken++;
        stats.errors.push({ name: source.name, url: source.url, error: result.error });
        
        // If in fix mode, disable broken feeds
        if (FIX_MODE) {
          const { error: updateError } = await supabase
            .from('rss_sources')
            .update({ active: false })
            .eq('id', source.id);
          
          if (!updateError) {
            console.log(`    ${CYAN}→ Disabled broken feed${RESET}`);
            stats.fixed++;
          }
        }
      }
      
      // Rate limit
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  // Test a sample of recently scraped feeds to ensure they're still working
  console.log(`\n${BOLD}━━━ SPOT CHECK RECENT FEEDS ━━━${RESET}`);
  const sampleRecent = recent.slice(0, 5);
  
  for (const source of sampleRecent) {
    process.stdout.write(`  ${source.name.substring(0, 40).padEnd(40)} `);
    
    const result = await testFeed(source);
    
    if (result.success) {
      console.log(`${GREEN}✓${RESET} ${result.itemCount} items`);
      stats.healthy++;
    } else {
      console.log(`${RED}✗${RESET} ${result.error}`);
      stats.broken++;
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  // Summary
  console.log(`\n${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}                       SUMMARY                              ${RESET}`);
  console.log(`${BOLD}═══════════════════════════════════════════════════════════${RESET}`);
  
  console.log(`Total active sources:  ${stats.total}`);
  console.log(`${GREEN}Healthy (tested):${RESET}      ${stats.healthy}`);
  console.log(`${RED}Broken (tested):${RESET}       ${stats.broken}`);
  console.log(`${YELLOW}Never scraped:${RESET}         ${stats.neverScraped}`);
  console.log(`${YELLOW}Stale (>48h):${RESET}          ${stats.stale}`);
  
  if (FIX_MODE && stats.fixed > 0) {
    console.log(`${CYAN}Fixed/Disabled:${RESET}        ${stats.fixed}`);
  }
  
  // Health score
  const healthScore = Math.round((stats.healthy / (stats.healthy + stats.broken)) * 100) || 0;
  
  if (healthScore >= 80) {
    console.log(`\n${GREEN}${BOLD}✅ RSS Health Score: ${healthScore}%${RESET}`);
  } else if (healthScore >= 50) {
    console.log(`\n${YELLOW}${BOLD}⚠️  RSS Health Score: ${healthScore}%${RESET}`);
  } else {
    console.log(`\n${RED}${BOLD}❌ RSS Health Score: ${healthScore}%${RESET}`);
  }
  
  // List broken feeds
  if (stats.errors.length > 0) {
    console.log(`\n${BOLD}━━━ BROKEN FEEDS ━━━${RESET}`);
    stats.errors.forEach(e => {
      console.log(`  ${RED}✗${RESET} ${e.name}`);
      console.log(`    URL: ${e.url}`);
      console.log(`    Error: ${e.error}`);
    });
  }
  
  // Recommendations
  console.log(`\n${BOLD}━━━ RECOMMENDATIONS ━━━${RESET}`);
  
  if (stats.neverScraped > 20) {
    console.log(`  • Run scraper more frequently to catch up on ${stats.neverScraped} unscraped sources`);
    console.log(`    → Increase LIMIT in ssot-rss-scraper.js or reduce cron interval`);
  }
  
  if (stats.broken > 5) {
    console.log(`  • ${stats.broken} feeds are broken - run with --fix to disable them`);
  }
  
  if (stats.stale > 30) {
    console.log(`  • ${stats.stale} feeds are stale - check PM2 rss-scraper status`);
  }
}

// Run
checkRssHealth().catch(e => {
  console.error(`${RED}RSS health check failed: ${e.message}${RESET}`);
  process.exit(1);
});
