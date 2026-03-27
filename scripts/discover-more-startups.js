#!/usr/bin/env node
/**
 * DISCOVER MORE STARTUPS
 * 
 * Uses pattern-based extraction to find startups from RSS articles
 * NO API CALLS - uses regex patterns to extract funding information
 * 
 * Usage:
 *   node scripts/discover-more-startups.js                    # Discover from all recent articles
 *   node scripts/discover-more-startups.js --days=7          # Last 7 days (default)
 *   node scripts/discover-more-startups.js --days=30         # Last 30 days
 *   node scripts/discover-more-startups.js --series-a-b      # Only Series A/B (faster)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');
const { extractCompanyName } = require('../lib/headlineExtractor');
const { extractCompanyNameFromHeadline, extractInferenceData, extractSectors } = require('../lib/inference-extractor');
const { insertDiscovered, setSupabase } = require('../lib/startupInsertGate');

// Get Supabase credentials with validation
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ Error: SUPABASE_URL or VITE_SUPABASE_URL not found in environment variables');
  console.error('   Please check your .env file in the project root');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Error: SUPABASE_SERVICE_KEY or VITE_SUPABASE_ANON_KEY not found in environment variables');
  console.error('   Please check your .env file in the project root');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const parser = new Parser({
  timeout: 30000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (compatible; HotMatchBot/1.0)',
  }
});

// Parse command line args
const args = process.argv.slice(2);
const daysArg = args.find(a => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1]) : 7;
const seriesABOnly = args.includes('--series-a-b');

// Funding stage keywords
const SERIES_A_KEYWORDS = ['series a', 'series-a', 'seriesa', 'series a round'];
const SERIES_B_KEYWORDS = ['series b', 'series-b', 'seriesb', 'series b round'];
const SERIES_C_KEYWORDS = ['series c', 'series-c', 'seriesc', 'series c round'];
const SEED_KEYWORDS = ['seed', 'seed round', 'seed funding'];
const SERIES_ANY = [...SERIES_A_KEYWORDS, ...SERIES_B_KEYWORDS, ...SERIES_C_KEYWORDS, ...SEED_KEYWORDS];

/**
 * Extract funding amount
 */
function extractFundingAmount(text) {
  const patterns = [
    /\$([\d.]+)\s*([BMKkmbillionmillion]*)/i,
    /([\d.]+)\s*([bmkm]illion)/i,
    /([\d.]+)\s*([bmkm])/i
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let amount = parseFloat(match[1]);
      const unit = (match[2] || '').toLowerCase();
      
      if (unit.includes('billion') || unit === 'b') amount *= 1000;
      else if (unit.includes('million') || unit === 'm') amount *= 1;
      else if (unit === 'k' || unit === 'thousand') amount /= 1000;
      
      return `$${amount}${unit.includes('billion') || unit === 'b' ? 'B' : unit.includes('million') || unit === 'm' ? 'M' : 'K'}`;
    }
  }
  
  return null;
}

/**
 * Extract funding stage
 */
function extractFundingStage(text) {
  const lower = text.toLowerCase();
  
  if (SERIES_A_KEYWORDS.some(k => lower.includes(k))) return 'Series A';
  if (SERIES_B_KEYWORDS.some(k => lower.includes(k))) return 'Series B';
  if (SERIES_C_KEYWORDS.some(k => lower.includes(k))) return 'Series C';
  if (SEED_KEYWORDS.some(k => lower.includes(k))) return 'Seed';
  
  return null;
}

/**
 * Extract investor names
 */
function extractInvestors(text) {
  const investors = [];
  
  // Common patterns for investor mentions
  const patterns = [
    /led by\s+([A-Z][a-zA-Z\s&.-]+?)(?:,|\s+and|$)/i,
    /from\s+([A-Z][a-zA-Z\s&.-]+?)(?:,|\s+and|$)/i,
    /investors?\s+include\s+([A-Z][a-zA-Z\s&.-]+?)(?:,|\s+and|$)/i,
    /(?:backed|funded|invested)\s+by\s+([A-Z][a-zA-Z\s&.-]+?)(?:,|\s+and|$)/i
  ];
  
  for (const pattern of patterns) {
    const matches = text.matchAll(new RegExp(pattern.source, 'gi'));
    for (const match of matches) {
      if (match[1] && match[1].length > 2 && match[1].length < 100) {
        investors.push(match[1].trim());
      }
    }
  }
  
  return investors.slice(0, 5); // Limit to 5 investors
}

/**
 * Extract startup info from article
 */
function extractStartupInfo(article) {
  const title = article.title || '';
  const content = article.contentSnippet || article.content || '';
  const combined = `${title} ${content}`.substring(0, 2000);
  
  // Skip if series-a-b only and doesn't mention Series A/B
  if (seriesABOnly) {
    const lower = combined.toLowerCase();
    if (!SERIES_A_KEYWORDS.some(k => lower.includes(k)) && 
        !SERIES_B_KEYWORDS.some(k => lower.includes(k))) {
      return null;
    }
  }
  
  let companyName = extractCompanyName(title) || extractCompanyName(combined);
  if (!companyName || companyName.length < 3) {
    companyName = extractCompanyNameFromHeadline(title) || extractCompanyNameFromHeadline(combined);
  }
  if (!companyName || companyName.length < 3) return null;
  
  // Skip obvious non-companies
  const skipPatterns = [
    /^(how|what|why|when|where|the|a|an|this|that|these|those)/i,
    /^[a-z]/,
    /^[0-9]/,
    /^(january|february|march|april|may|june|july|august|september|october|november|december)/i
  ];
  
  if (skipPatterns.some(pattern => pattern.test(companyName))) {
    return null;
  }
  
  let fundingAmount = extractFundingAmount(combined);
  const fundingStage = extractFundingStage(combined);
  const investors = extractInvestors(combined);

  // Inference parsing: extract sectors, funding, investors from article content
  let sectors = null;
  let inferenceData = null;
  try {
    inferenceData = extractInferenceData(combined, article.link || '');
    if (inferenceData && inferenceData.sectors && inferenceData.sectors.length > 0) {
      sectors = inferenceData.sectors;
    }
    if (inferenceData && inferenceData.funding_amount && !fundingAmount) {
      const amt = inferenceData.funding_amount;
      fundingAmount = amt >= 1000000000
        ? `$${(amt / 1000000000).toFixed(1)}B`
        : amt >= 1000000
          ? `$${(amt / 1000000).toFixed(1)}M`
          : amt >= 1000
            ? `$${(amt / 1000).toFixed(0)}K`
            : `$${amt}`;
    }
    if (inferenceData && inferenceData.investors_mentioned && inferenceData.investors_mentioned.length > 0) {
      for (const inv of inferenceData.investors_mentioned) {
        if (inv && !investors.some(i => String(i).toLowerCase() === String(inv).toLowerCase())) {
          investors.push(inv);
        }
      }
    }
  } catch (_) { /* inference optional */ }
  if (!sectors) {
    try {
      const inferred = extractSectors(combined);
      if (inferred && inferred.length > 0) sectors = inferred;
    } catch (_) { /* optional */ }
  }

  // Extract description (first sentence or snippet)
  let description = content.substring(0, 500);
  if (title.length > 20) {
    description = `${title}. ${description}`;
  }
  description = description.substring(0, 500);

  return {
    name: companyName,
    description: description,
    funding_amount: fundingAmount,
    funding_stage: fundingStage,
    investors_mentioned: investors.length > 0 ? investors.slice(0, 10) : null,
    sectors,
    article_url: article.link,
    article_title: title
  };
}

/**
 * Main discovery function
 */
async function discoverStartups() {
  console.log('\n🚀 DISCOVERING MORE STARTUPS');
  console.log('═'.repeat(70));
  console.log(`Days: ${days} | Series A/B Only: ${seriesABOnly ? 'Yes' : 'No'}\n`);
  
  // Get active RSS sources
  const { data: sources, error: sourcesError } = await supabase
    .from('rss_sources')
    .select('*')
    .eq('active', true);
  
  if (sourcesError) {
    console.error('❌ Error fetching RSS sources:', sourcesError);
    if (sourcesError.message && sourcesError.message.includes('API key')) {
      console.error('\n💡 This usually means:');
      console.error('   1. SUPABASE_SERVICE_KEY is not set in .env file');
      console.error('   2. The key is incorrect or has expired');
      console.error('   3. The key doesn\'t have service role permissions');
      console.error('\n   Check your .env file and ensure you have:');
      console.error('   SUPABASE_SERVICE_KEY=your_service_role_key_here');
      console.error('   (This is different from VITE_SUPABASE_ANON_KEY)');
    }
    return;
  }
  
  if (!sources || sources.length === 0) {
    console.log('⚠️  No active RSS sources found!');
    return;
  }
  
  console.log(`📡 Found ${sources.length} active RSS sources\n`);
  
  const allStartups = [];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  // Pre-fetch all existing startups to avoid duplicate queries (only once at start)
  console.log('🔍 Fetching existing startups for duplicate checking...');
  const { data: existingStartups } = await supabase
    .from('discovered_startups')
    .select('name, website');
  
  const existingSet = new Set(
    (existingStartups || []).map(e => {
      const name = (e.name || '').toLowerCase().trim();
      const website = ((e.website || '').toLowerCase().trim() || '');
      return `${name}|${website}`;
    })
  );
  console.log(`   Found ${existingSet.size} existing startups\n`);
  
  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    console.log(`[${i + 1}/${sources.length}] Processing: ${source.name}`);
    
    try {
      const feed = await parser.parseURL(source.url);
      
      // Filter recent articles
      const recentArticles = feed.items.filter(item => {
        const pubDate = item.pubDate ? new Date(item.pubDate) : null;
        return !pubDate || pubDate >= cutoffDate;
      });
      
      console.log(`  📰 Found ${recentArticles.length} recent articles`);
      
      // Extract startups from articles
      let extracted = 0;
      
      for (const article of recentArticles) {
        const startupInfo = extractStartupInfo(article);
        if (startupInfo) {
          // Check for duplicate using name + website (matching unique constraint)
          const name = (startupInfo.name || '').toLowerCase().trim();
          const website = ((startupInfo.website || '').toLowerCase().trim() || '');
          const key = `${name}|${website}`;
          
          if (!existingSet.has(key)) {
            // Add to both allStartups and existingSet to prevent duplicates within this run
            existingSet.add(key);
            allStartups.push({
              ...startupInfo,
              rss_source: source.name,
              discovered_at: new Date().toISOString()
            });
            extracted++;
          }
        }
      }
      
      console.log(`  ✅ Extracted ${extracted} new startups\n`);
      
      // Small delay between sources
      await new Promise(r => setTimeout(r, 500));
      
    } catch (error) {
      console.error(`  ❌ Error processing ${source.name}:`, error.message);
    }
  }
  
  if (allStartups.length === 0) {
    console.log('⚠️  No new startups found!');
    return;
  }
  
  console.log(`\n📊 Total new startups found: ${allStartups.length}\n`);
  
  // Save via insert gate (validates names, handles duplicates)
  console.log('💾 Saving to database...');
  setSupabase(supabase);
  const BATCH_SIZE = 50;
  let saved = 0;
  let skipped = 0;

  for (let i = 0; i < allStartups.length; i += BATCH_SIZE) {
    const batch = allStartups.slice(i, i + BATCH_SIZE);
    let batchSaved = 0;
    let batchSkipped = 0;

    for (const s of batch) {
      const r = await insertDiscovered({
        name: s.name,
        website: s.website || null,
        description: s.description,
        funding_amount: s.funding_amount,
        funding_stage: s.funding_stage,
        investors_mentioned: s.investors_mentioned,
        sectors: s.sectors || null,
        article_url: s.article_url,
        article_title: s.article_title,
        rss_source: s.rss_source,
        discovered_at: s.discovered_at,
      });

      if (r.ok) {
        if (r.skipped) batchSkipped++;
        else batchSaved++;
      } else {
        batchSkipped++;
      }
    }

    saved += batchSaved;
    skipped += batchSkipped;
    console.log(`  ✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(allStartups.length / BATCH_SIZE)}: ${batchSaved} saved, ${batchSkipped} skipped (${saved}/${allStartups.length} total saved)`);
  }
  
  console.log(`\n✅ Discovery complete!`);
  console.log(`   📊 ${saved} startups saved to discovered_startups`);
  if (skipped > 0) {
    console.log(`   ⏭️  ${skipped} duplicates skipped`);
  }
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Review: http://localhost:5173/admin/discovered-startups`);
  console.log(`   2. Approve: node scripts/approve-all-discovered-startups.js`);
  console.log(`   3. Generate matches: node scripts/core/queue-processor-v16.js`);
}

discoverStartups().catch(console.error);
