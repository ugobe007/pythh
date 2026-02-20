#!/usr/bin/env node
/**
 * TARGETED STARTUP ENRICHMENT - Inference Engine
 * 
 * Strategy: Instead of broad RSS scraping, search for specific startups that need data
 * 
 * Process:
 * 1. Identify Phase 4 startups (0-1 signals, scores 35-50)
 * 2. For each startup, search Google News RSS with startup name
 * 3. Extract missing data: traction, team, market, funding
 * 4. Update extracted_data JSONB field
 * 5. Mark for GOD score recalculation
 * 
 * Run: node scripts/enrich-sparse-startups.js [--limit=50]
 * Run all: node scripts/enrich-sparse-startups.js --limit=5000
 */

require('dotenv').config();
const Parser = require('rss-parser');
const { createClient } = require('@supabase/supabase-js');

// Import inference extractors
const { 
  extractFunding, 
  extractSectors, 
  extractTeamSignals, 
  extractExecutionSignals 
} = require('../lib/inference-extractor');

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const parser = new Parser({
  timeout: 20000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml, */*'
  }
});

// ============================================================================
// FAST NEWS SOURCES - Prioritize speed over depth
// ============================================================================
const FAST_SOURCES = {
  // Google News RSS - fastest, most reliable
  googleNews: (query) => `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`,
  
  // TechCrunch search (if available)
  // Note: Some sources may not have search RSS, fallback to Google News
};

// ============================================================================
// CLASSIFY DATA RICHNESS (same as recalculate-scores.ts)
// ============================================================================
function classifyDataRichness(startup) {
  let signalCount = 0;
  
  // Count available data signals (matching startup_uploads columns)
  if (startup.pitch?.length > 50) signalCount++;
  if (startup.website) signalCount++;
  if (startup.sectors?.length > 0) signalCount++;
  if (startup.stage) signalCount++;
  if (startup.raise_amount) signalCount++;
  if (startup.customer_count || startup.mrr || startup.arr) signalCount++;
  if (startup.team_size) signalCount++;
  if (startup.location) signalCount++;
  
  // Phase classification
  if (signalCount >= 8) return { phase: 1, label: 'Data Rich' };
  if (signalCount >= 5) return { phase: 2, label: 'Good Data' };
  if (signalCount >= 2) return { phase: 3, label: 'Medium' };
  return { phase: 4, label: 'Sparse' };
}

// ============================================================================
// SEARCH FOR STARTUP NEWS
// ============================================================================
async function searchStartupNews(startupName, startupWebsite) {
  const articles = [];
  
  // Build search query - try multiple variants for better results
  const queries = [
    `"${startupName}" startup funding`,
    `${startupName} raises`,
    `${startupName} series`,
  ];
  
  // If we have website, extract domain name for search
  if (startupWebsite) {
    try {
      const domain = new URL(startupWebsite).hostname.replace('www.', '');
      queries.push(`${domain} startup`);
    } catch (e) {
      // Invalid URL, skip
    }
  }
  
  // Try first query only (fast approach - avoid over-fetching)
  const query = queries[0];
  const feedUrl = FAST_SOURCES.googleNews(query);
  
  try {
    console.log(`  🔍 Searching: "${query}"`);
    const feed = await parser.parseURL(feedUrl);
    
    // Limit to 5 most recent articles (fast parsing)
    const recent = feed.items.slice(0, 5);
    
    for (const item of recent) {
      articles.push({
        title: item.title || '',
        content: item.contentSnippet || item.content || '',
        link: item.link || '',
        pubDate: item.pubDate || new Date().toISOString(),
        source: 'Google News'
      });
    }
    
    console.log(`  ✅ Found ${articles.length} articles`);
  } catch (error) {
    console.log(`  ⚠️  Search failed: ${error.message}`);
  }
  
  return articles;
}

// ============================================================================
// EXTRACT DATA FROM ARTICLES
// ============================================================================
function extractDataFromArticles(articles, currentData) {
  const enrichedData = { ...currentData };
  let enrichmentCount = 0;
  
  // Combine all article text for analysis
  const allText = articles.map(a => `${a.title} ${a.content}`).join('\n\n');
  
  // Extract funding information (maps to raise_amount)
  if (!enrichedData.raise_amount || enrichedData.raise_amount === '') {
    const funding = extractFunding(allText);
    if (funding.amount > 0) {
      enrichedData.raise_amount = `$${funding.amount}`;
      enrichedData.raise_type = funding.round;
      enrichmentCount++;
      console.log(`    💰 Found funding: $${funding.amount} ${funding.round}`);
    }
  }
  
  // Extract sectors if missing
  if (!enrichedData.sectors || enrichedData.sectors.length === 0) {
    const sectors = extractSectors(allText);
    if (sectors.length > 0) {
      enrichedData.sectors = sectors;
      enrichmentCount++;
      console.log(`    🏷️  Found sectors: ${sectors.join(', ')}`);
    }
  }
  
  // Extract execution signals (traction, customers, revenue)
  const execution = extractExecutionSignals(allText);
  
  if (execution.customer_count > 0 && !enrichedData.customer_count) {
    enrichedData.customer_count = execution.customer_count;
    enrichmentCount++;
    console.log(`    📈 Found customers: ${execution.customer_count}`);
  }
  
  if (execution.revenue > 0 && !enrichedData.arr) {
    enrichedData.arr = execution.revenue;
    enrichmentCount++;
    console.log(`    💵 Found revenue: $${execution.revenue}`);
  }
  
  if (execution.mrr > 0 && !enrichedData.mrr) {
    enrichedData.mrr = execution.mrr;
    enrichmentCount++;
  }
  
  // Store article references for transparency
  if (articles.length > 0) {
    enrichedData.enrichment_sources = articles.map(a => ({
      title: a.title,
      url: a.link,
      date: a.pubDate,
      source: a.source
    }));
    enrichedData.last_enrichment_date = new Date().toISOString();
  }
  
  return { enrichedData, enrichmentCount };
}

// ============================================================================
// MAIN ENRICHMENT PROCESS
// ============================================================================
async function enrichSparseStartups() {
  console.log('🔬 TARGETED STARTUP ENRICHMENT - Inference Engine\n');
  console.log('Strategy: Search news for specific data-sparse startups\n');
  
  // Parse command line args
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
  
  console.log(`📊 Processing up to ${limit} startups\n`);
  
  // ========================================================================
  // STEP 1: Fetch Phase 4 (Sparse) startups
  // ========================================================================
  console.log('⏳ Loading data-sparse startups...');
  
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website, pitch, sectors, stage, raise_amount, customer_count, mrr, arr, team_size, location, total_god_score, extracted_data')
    .eq('status', 'approved')
    .order('updated_at', { ascending: true }) // Oldest first - prioritize stale data
    .limit(limit * 3); // Fetch extra, filter to Phase 4
  
  if (error) {
    console.error('❌ Error loading startups:', error);
    return;
  }
  
  // Filter to Phase 3-4 (Medium to Sparse data)
  const sparseStartups = startups.filter(s => {
    const { phase } = classifyDataRichness(s);
    return phase >= 3 && s.total_god_score < 55; // Phase 3-4, scores below 55
  }).slice(0, limit);
  
  console.log(`✅ Found ${sparseStartups.length} Phase 3-4 startups (0-4 signals)\n`);
  
  if (sparseStartups.length === 0) {
    console.log('🎉 No sparse startups found! All startups have sufficient data.');
    // Debug: Show distribution
    const phases = startups.map(s => classifyDataRichness(s).phase);
    console.log('Phase distribution:', {
      phase1: phases.filter(p => p === 1).length,
      phase2: phases.filter(p => p === 2).length,
      phase3: phases.filter(p => p === 3).length,
      phase4: phases.filter(p => p === 4).length,
    });
    return;
  }
  
  // ========================================================================
  // STEP 2: Enrich each startup
  // ========================================================================
  let enriched = 0;
  let noDataFound = 0;
  let errors = 0;
  
  for (let i = 0; i < sparseStartups.length; i++) {
    const startup = sparseStartups[i];
    console.log(`\n[${i + 1}/${sparseStartups.length}] ${startup.name}`);
    console.log(`  Current score: ${startup.total_god_score}`);
    
    try {
      // Search for news articles
      const articles = await searchStartupNews(startup.name, startup.website);
      
      if (articles.length === 0) {
        console.log('  ⚠️  No articles found - startup may be very early or private');
        noDataFound++;
        continue;
      }
      
      // Extract data from articles
      const currentData = startup.extracted_data || {};
      const { enrichedData, enrichmentCount } = extractDataFromArticles(articles, currentData);
      
      if (enrichmentCount === 0) {
        console.log('  ⚠️  Articles found but no new data extracted');
        noDataFound++;
        continue;
      }
      
      // Update database
      const updatePayload = {
        extracted_data: enrichedData,
        updated_at: new Date().toISOString()
      };
      
      // If we found critical fields, promote them to top-level columns
      if (enrichedData.raise_amount && !startup.raise_amount) {
        updatePayload.raise_amount = enrichedData.raise_amount;
        updatePayload.raise_type = enrichedData.raise_type;
      }
      if (enrichedData.sectors && (!startup.sectors || startup.sectors.length === 0)) {
        updatePayload.sectors = enrichedData.sectors;
      }
      if (enrichedData.customer_count && !startup.customer_count) {
        updatePayload.customer_count = enrichedData.customer_count;
      }
      if (enrichedData.arr && !startup.arr) {
        updatePayload.arr = enrichedData.arr;
      }
      if (enrichedData.mrr && !startup.mrr) {
        updatePayload.mrr = enrichedData.mrr;
      }
      
      const { error: updateError } = await supabase
        .from('startup_uploads')
        .update(updatePayload)
        .eq('id', startup.id);
      
      if (updateError) {
        console.log(`  ❌ Update failed: ${updateError.message}`);
        errors++;
      } else {
        console.log(`  ✅ Enriched ${enrichmentCount} fields`);
        enriched++;
      }
      
      // Rate limiting - be gentle with Google News
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
      errors++;
    }
  }
  
  // ========================================================================
  // FINAL SUMMARY
  // ========================================================================
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 ENRICHMENT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Processed:     ${sparseStartups.length} startups`);
  console.log(`  ✅ Enriched:   ${enriched} (${((enriched / sparseStartups.length) * 100).toFixed(1)}%)`);
  console.log(`  ⚠️  No Data:    ${noDataFound}`);
  console.log(`  ❌ Errors:     ${errors}`);
  console.log('');
  
  if (enriched > 0) {
    console.log('🔄 Next Steps:');
    console.log('   1. Run: npx tsx scripts/recalculate-scores.ts');
    console.log('   2. Check scores: node scripts/check-god-scores.js');
    console.log('');
    console.log('   Expected: Enriched startups should score 5-10 points higher');
  }
  
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// Run
enrichSparseStartups().catch(console.error);
