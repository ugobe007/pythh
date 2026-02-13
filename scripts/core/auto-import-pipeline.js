#!/usr/bin/env node
/**
 * AUTO-IMPORT PIPELINE
 * 
 * Runs automatically via PM2 to:
 * 1. Import quality startups from discovered_startups → startup_uploads
 * 2. Assign GOD scores to new imports
 * 3. Generate matches with investors
 * 
 * Schedule: Every 2 hours via PM2 cron
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { extractInferenceData } = require('../../lib/inference-extractor.js');

// Validate environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables!');
  console.error('   Please ensure your .env file contains VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Load resilient scraper with fault tolerance (won't break if it fails to load)
let ResilientScraper = null;
try {
  const scraperPath = path.join(__dirname, '../scrapers/resilient-scraper.js');
  const scraperModule = require(scraperPath);
  ResilientScraper = scraperModule?.ResilientScraper || null;
} catch (error) {
  // Silent fail - resilient scraper is optional enhancement
  console.warn('⚠️  Resilient scraper unavailable (will use basic import):', error.message);
}

// Quality filters - reject junk names
const JUNK_PATTERNS = [
  /^[A-Z][a-z]+ [A-Z][a-z]+$/, // Personal names like "Kate Winslet"
  /^(The|A|An|In|On|At|For|With|About|This|That|These|Those)\s/i, // Articles at start
  /^(North|South|East|West)\s(Korea|America|Africa)/i, // Countries
  /^(State|Federal|Government|Department)/i, // Government entities
  /\b(ago|month|week|year|today|yesterday)\b/i, // Time references
  /^(CTO|CEO|CFO|COO|VP|Director|Manager)\s/i, // Job titles
  /^[A-Z]{2,3}$/,  // Just acronyms like "AI" or "ML"
  /^\d+/, // Starts with number
  /^\d+\+/, // Starts with number and plus (e.g., "100+")
  /^(http|www\.)/i, // URLs
  // Generic single words
  /^(Building|Modern|Inside|Outside|Show|Clicks|Click|Wellbeing|Healthcare|Fintech|Tech|AI|ML|SaaS|Data|Digital|Benefits|Tips|MVPs|MVP|Resource|Constraints|Leadership|Transit|Equity|Fusion|Dropout|Moved|Out|In|On|At|For|With|About|From|To)$/i,
  // Possessive forms of generic words
  /^(Healthcare's|Nvidia's|Obsidian's|Equity's|Sweden's|Finland's)$/i,
  // Phrases that aren't company names
  /^(MVPs out|Resource Constraints|Leadership Tips|I've Moved|Transit Tech|Nvidia's AI|Equity's 2026|Show HN:|build Givefront|College dropout|Every fusion)$/i,
  // Single generic words with punctuation
  /^(Building|Modern|Inside|Show|Clicks|Wellbeing|Healthcare|Fintech),?$/i,
];

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 50;

function isQualityStartupName(name) {
  if (!name) return false;
  
  // Length check
  if (name.length < MIN_NAME_LENGTH || name.length > MAX_NAME_LENGTH) return false;
  
  // Check against junk patterns
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(name)) return false;
  }
  
  // Must have at least one letter
  if (!/[a-zA-Z]/.test(name)) return false;
  
  return true;
}

async function importDiscoveredStartups(limit = 50) {
  console.log(`\n📥 Importing up to ${limit} quality startups...`);
  
  // Get unimported discovered startups
  const { data: discovered, error } = await supabase
    .from('discovered_startups')
    .select('id, name, website, description')
    .eq('imported_to_startups', false)
    .order('created_at', { ascending: false })
    .limit(limit * 2); // Fetch extra to filter
  
  if (error) {
    console.error('Error fetching discovered startups:', error);
    return [];
  }
  
  if (!discovered || discovered.length === 0) {
    console.log('   No new startups to import');
    return [];
  }
  
  // Filter for quality names
  const quality = discovered.filter(s => isQualityStartupName(s.name));
  const toImport = quality.slice(0, limit);
  
  console.log(`   Found ${discovered.length} unimported, ${quality.length} quality names`);
  
  
  const imported = [];
  
  for (const startup of toImport) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('startup_uploads')
      .select('id')
      .eq('name', startup.name)
      .single();
    
    if (existing) {
      // Mark as imported even if duplicate
      await supabase
        .from('discovered_startups')
        .update({ imported_to_startups: true, imported_at: new Date().toISOString() })
        .eq('id', startup.id);
      continue;
    }
    
    // Start with basic data - will enrich if resilient scraper is available
    let enrichedData = {
      name: startup.name,
      website: startup.website,
      description: startup.description || 'Startup discovered from news feeds',
      sectors: ['Technology'],
      status: 'approved',
      stage: 2, // Seed
      source_type: 'rss_discovery',
    };
    
    // FAULT-TOLERANT ENRICHMENT: Try resilient scraper, but NEVER fail the import if it errors
    // This is wrapped in extensive error handling so failures are isolated
    if (ResilientScraper && startup.website && startup.website.startsWith('http')) {
      try {
        const isArticleUrl = startup.website.match(/\/\d{4}\/\d{2}\/|article|news|blog|post|techcrunch|venturebeat/i);
        
        // Only try to scrape if it looks like a company website (not article URL)
        // Article URLs will be handled by inference engine later
        if (!isArticleUrl) {
          try {
            const scraper = new ResilientScraper({
              enableAutoRecovery: true,
              enableRateLimiting: true,
              useAI: false, // Faster, no API costs
            });
            
            const fields = {
              name: { type: 'string', required: true },
              description: { type: 'string', required: false },
              funding: { type: 'currency', required: false },
              url: { type: 'url', required: false }
            };
            
            // Add timeout to prevent hanging
            const scrapePromise = scraper.scrapeResilient(startup.website, 'startup', fields);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Scraper timeout after 10s')), 10000)
            );
            
            const result = await Promise.race([scrapePromise, timeoutPromise]);
            
            if (result && result.success && result.data) {
              // Merge scraped data safely
              if (result.data.description && result.data.description.length > 10) {
                enrichedData.description = result.data.description;
              }
              if (result.data.funding) {
                enrichedData.extracted_data = {
                  ...(enrichedData.extracted_data || {}),
                  funding_amount: result.data.funding
                };
              }
            }
          } catch (scrapeError) {
            // Completely silent - enrichment is optional, never block import
            // Log at debug level only if needed
          }
        }
      } catch (enrichError) {
        // Catch-all for any enrichment errors - never break the import
        // Continue with basic data
      }
    }
    
    // Generate GOD score (will be recalculated later, but provide initial estimate)
    const godScore = 55 + Math.floor(Math.random() * 20);
    
    // Extract psychological signals (Phase 1 + Phase 2)
    const textToAnalyze = [
      enrichedData.description,
      enrichedData.tagline,
      enrichedData.value_proposition
    ].filter(Boolean).join(' ');
    
    let psychologicalSignals = {};
    try {
      const extracted = extractInferenceData(textToAnalyze, enrichedData.website || '');
      psychologicalSignals = {
        // Phase 1 signals
        is_oversubscribed: extracted.is_oversubscribed || false,
        oversubscribed_evidence: extracted.oversubscribed_evidence || null,
        oversubscription_strength: extracted.oversubscription_strength || null,
        has_followon: extracted.has_followon || false,
        followon_lead_investor: extracted.followon_lead_investor || null,
        followon_strength: extracted.followon_strength || null,
        is_competitive: extracted.is_competitive || false,
        competitor_count: extracted.competitor_count || null,
        is_bridge_round: extracted.is_bridge_round || false,
        // Phase 2 signals
        has_sector_pivot: extracted.has_sector_pivot || false,
        pivot_investor: extracted.pivot_investor || null,
        pivot_from_sector: extracted.pivot_from_sector || null,
        pivot_to_sector: extracted.pivot_to_sector || null,
        pivot_strength: extracted.pivot_strength || null,
        has_social_proof_cascade: extracted.has_social_proof_cascade || false,
        tier1_leader: extracted.tier1_leader || null,
        follower_count: extracted.follower_count || null,
        cascade_strength: extracted.cascade_strength || null,
        is_repeat_founder: extracted.is_repeat_founder || false,
        previous_companies: extracted.previous_companies || null,
        previous_exits: extracted.previous_exits || null,
        founder_strength: extracted.founder_strength || null,
        has_cofounder_exit: extracted.has_cofounder_exit || false,
        departed_role: extracted.departed_role || null,
        departed_name: extracted.departed_name || null,
        exit_risk_strength: extracted.exit_risk_strength || null,
      };
    } catch (extractError) {
      // Silent fail - signals are optional enhancement
      console.log(`   ⚠️  Signal extraction skipped for ${startup.name}`);
    }
    
    // Insert into startup_uploads with psychological signals
    const { data: inserted, error: insertError } = await supabase
      .from('startup_uploads')
      .insert({
        ...enrichedData,
        ...psychologicalSignals,
        total_god_score: godScore,
        team_score: 50 + Math.floor(Math.random() * 20),
        traction_score: 45 + Math.floor(Math.random() * 25),
        market_score: 50 + Math.floor(Math.random() * 20),
        product_score: 50 + Math.floor(Math.random() * 20),
        vision_score: 50 + Math.floor(Math.random() * 20),
      })
      .select('id, name, total_god_score')
      .single();
    
    if (insertError) {
      console.error(`   ❌ Failed to import ${startup.name}:`, insertError.message);
      continue;
    }
    
    // Log psychological signals detected
    const detectedSignals = [];
    if (psychologicalSignals.is_oversubscribed) detectedSignals.push('🚀 Oversubscribed');
    if (psychologicalSignals.has_followon) detectedSignals.push('💎 Follow-on');
    if (psychologicalSignals.is_competitive) detectedSignals.push('⚡ Competitive');
    if (psychologicalSignals.is_bridge_round) detectedSignals.push('🌉 Bridge');
    if (psychologicalSignals.has_sector_pivot) detectedSignals.push('🔄 Sector Pivot');
    if (psychologicalSignals.has_social_proof_cascade) detectedSignals.push('🌊 Social Proof');
    if (psychologicalSignals.is_repeat_founder) detectedSignals.push('🔁 Repeat Founder');
    if (psychologicalSignals.has_cofounder_exit) detectedSignals.push('🚪 Cofounder Exit');
    
    if (detectedSignals.length > 0) {
      console.log(`   🧠 Signals: ${detectedSignals.join(', ')}`);
    }
    
    // Mark as imported
    await supabase
      .from('discovered_startups')
      .update({ 
        imported_to_startups: true, 
        imported_at: new Date().toISOString(),
        startup_id: inserted.id
      })
      .eq('id', startup.id);
    
    // Add to matching queue (ignore errors - duplicates are OK)
    try {
      const { error } = await supabase
        .from('matching_queue')
        .insert({
          startup_id: inserted.id,
          status: 'pending',
          attempts: 0,
          created_at: new Date().toISOString()
        });
      // Silently ignore errors (duplicates are fine)
    } catch (queueError) {
      // Ignore duplicate queue entries
    }
    
    imported.push(inserted);
  }
  
  console.log(`   ✅ Imported ${imported.length} startups`);
  return imported;
}

async function generateMatchesForStartups(startups) {
  if (!startups || startups.length === 0) return 0;
  
  console.log(`\n🎯 Generating matches for ${startups.length} startups...`);
  
  // Get random investors for matching
  const { data: investors } = await supabase
    .from('investors')
    .select('id, sectors')
    .limit(100);
  
  if (!investors || investors.length === 0) {
    console.log('   No investors found');
    return 0;
  }
  
  let matchCount = 0;
  
  for (const startup of startups) {
    // Select 20 random investors for each startup
    const shuffled = investors.sort(() => Math.random() - 0.5).slice(0, 20);
    
    const matches = shuffled.map(investor => ({
      startup_id: startup.id,
      investor_id: investor.id,
      match_score: Math.max(40, Math.min(85, 
        Math.floor(startup.total_god_score * 0.6 + Math.random() * 15 + 
          (investor.sectors?.includes('Technology') ? 10 : 0))
      ))
    }));
    
    const { error } = await supabase
      .from('startup_investor_matches')
      .upsert(matches, { onConflict: 'startup_id,investor_id' });
    
    if (!error) {
      matchCount += matches.length;
    }
  }
  
  console.log(`   ✅ Generated ${matchCount} matches`);
  return matchCount;
}

async function logToDatabase(status, message, details = {}) {
  await supabase.from('ai_logs').insert({
    type: 'auto_import',
    action: 'pipeline_run',
    status,
    output: { message, ...details }
  });
}

async function runPipeline() {
  console.log('\n════════════════════════════════════════════');
  console.log('🚀 AUTO-IMPORT PIPELINE');
  console.log('════════════════════════════════════════════');
  console.log(`⏰ ${new Date().toISOString()}`);
  
  try {
    // Step 1: Import quality startups
    const imported = await importDiscoveredStartups(30);
    
    // Step 2: Generate matches for new imports
    const matchCount = await generateMatchesForStartups(imported);
    
    // Log results
    const summary = {
      startups_imported: imported.length,
      matches_generated: matchCount,
      timestamp: new Date().toISOString()
    };
    
    console.log('\n════════════════════════════════════════════');
    console.log('✨ PIPELINE COMPLETE');
    console.log(`   Startups imported: ${imported.length}`);
    console.log(`   Matches generated: ${matchCount}`);
    console.log('════════════════════════════════════════════\n');
    
    await logToDatabase('success', 'Pipeline completed', summary);
    
  } catch (error) {
    console.error('Pipeline error:', error);
    await logToDatabase('error', error.message);
  }
}

// Run immediately
runPipeline();
