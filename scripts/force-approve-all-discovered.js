#!/usr/bin/env node
/**
 * Force Approve ALL Discovered Startups (Even if Already Imported)
 * Use this to process ALL 832 discovered startups, not just unimported ones
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isValidStartupName } = require('../lib/startupNameValidator');
const { insertStartupUpload, setSupabase } = require('../lib/startupInsertGate');

// Map text stage (from RSS) to startup_uploads.stage integer (1-5)
function stageTextToInt(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  if (/pre-?seed|preseed/.test(lower)) return 1;
  if (/^seed\b/.test(lower)) return 2;
  if (/series\s*a|seriesa/.test(lower)) return 3;
  if (/series\s*b|seriesb/.test(lower)) return 4;
  if (/series\s*c|seriesc|series\s*d|growth|late/.test(lower)) return 5;
  return null; // Unknown, Pre-seed, etc.
}

// Normalize stage text for stage_estimate (lowercase hyphenated)
function stageToEstimate(text) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase().trim();
  if (/pre-?seed|preseed/.test(lower)) return 'pre-seed';
  if (/^seed\b/.test(lower)) return 'seed';
  if (/series\s*a|seriesa/.test(lower)) return 'series-a';
  if (/series\s*b|seriesb/.test(lower)) return 'series-b';
  if (/series\s*c|seriesc/.test(lower)) return 'series-c';
  if (/growth|late/.test(lower)) return 'growth';
  return null;
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function forceApproveAll() {
  console.log('🚀 Force approving ALL discovered startups (including already imported)...\n');

  try {
    // Fetch ALL discovered startups (ignore import status)
    console.log('📊 Fetching ALL discovered startups...');
    const { data: discovered, error: fetchError } = await supabase
      .from('discovered_startups')
      .select('*')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching discovered startups:', fetchError);
      return;
    }

    if (!discovered || discovered.length === 0) {
      console.log('✅ No discovered startups found!');
      return;
    }

    console.log(`✅ Found ${discovered.length} total discovered startups\n`);

    // Filter out ones that already exist in startup_uploads by name/website
    // Paginate to fetch ALL (Supabase defaults to 1000 per request)
    console.log('🔍 Checking for duplicates in startup_uploads...');
    let existingStartups = [];
    const PAGE_SIZE = 1000;
    let page = 0;
    while (true) {
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('name, website')
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) {
        console.error('❌ Error fetching existing startups:', error);
        return;
      }
      existingStartups = existingStartups.concat(data || []);
      if (!data || data.length < PAGE_SIZE) break;
      page++;
    }
    console.log(`   Loaded ${existingStartups.length} existing startups for duplicate check`);

    const existingNames = new Set(
      existingStartups.map(s => s.name?.toLowerCase().trim()).filter(Boolean)
    );
    const existingWebsites = new Set(
      existingStartups.map(s => s.website?.toLowerCase().trim()).filter(Boolean)
    );

    let skippedBadName = 0;
    const toProcess = discovered.filter(ds => {
      const name = ds.name?.toLowerCase().trim();
      const website = ds.website?.toLowerCase().trim();

      // Skip bad names (headline fragments, law firm phrases, article titles)
      const nameCheck = isValidStartupName(ds.name);
      if (!nameCheck.isValid) {
        skippedBadName++;
        return false;
      }
      
      // Skip if already exists by name or website
      if (name && existingNames.has(name)) {
        return false;
      }
      if (website && existingWebsites.has(website)) {
        return false;
      }
      return true;
    });

    if (skippedBadName > 0) {
      console.log(`   ⏭️  Skipped ${skippedBadName} with invalid names (headline fragments, law firm phrases, etc.)`);
    }
    console.log(`✅ After duplicate check: ${toProcess.length} startups to process\n`);

    if (toProcess.length === 0) {
      console.log('ℹ️  All discovered startups already exist in startup_uploads\n');
      return;
    }

    // Transform to startup_uploads format (dedupe by name+website within toProcess)
    console.log('🔄 Transforming data format...');
    const seen = new Set();
    const rawStage = (ds) => ds.stage || ds.funding_stage;
    const filteredToProcess = toProcess.filter(ds => {
      const key = `${(ds.name || '').toLowerCase()}|${(ds.website || '').toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const startupUploads = filteredToProcess.map(ds => ({
      name: ds.name || 'Unnamed Startup',
      description: ds.description || null,
      tagline: ds.description?.substring(0, 200) || null,
      website: ds.website || null,
      linkedin: null,
      sectors: ds.sectors || ds.industries || [],
      stage: stageTextToInt(rawStage(ds)),
      stage_estimate: stageToEstimate(rawStage(ds)),
      raise_amount: ds.funding_amount || ds.raise_amount || null,
      raise_type: rawStage(ds) || null,
      location: ds.location || null,
      source_type: 'url',
      source_url: ds.website || ds.article_url || null,
      extracted_data: {
        name: ds.name,
        description: ds.description,
        website: ds.website,
        sectors: ds.sectors || ds.industries,
        stage: ds.stage || ds.funding_stage,
        location: ds.location,
        funding_amount: ds.funding_amount,
        funding_stage: ds.funding_stage,
        investors_mentioned: ds.investors_mentioned,
        article_url: ds.article_url,
        article_title: ds.article_title,
        rss_source: ds.rss_source,
        original_source: 'discovered_startups',
        original_id: ds.id
      },
      status: 'approved',
      created_at: ds.created_at || ds.discovered_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    console.log(`✅ Prepared ${startupUploads.length} startups for insertion\n`);

    // Insert via gate (one-by-one; validates each, marks imported on success)
    setSupabase(supabase);
    let totalInserted = 0;
    let totalSkipped = 0;
    const BATCH_LOG = 50;

    for (let j = 0; j < startupUploads.length; j++) {
      const record = startupUploads[j];
      const ds = filteredToProcess[j];
      if (j > 0 && j % BATCH_LOG === 0) {
        console.log(`📦 Progress: ${j}/${startupUploads.length} (${totalInserted} inserted, ${totalSkipped} skipped)`);
      }

      const r = await insertStartupUpload(record, { skipDuplicateCheck: true });

      if (r.ok && r.id) {
        totalInserted++;
        await supabase
          .from('discovered_startups')
          .update({ imported_to_startups: true, imported_at: new Date().toISOString() })
          .eq('id', ds.id);
      } else {
        totalSkipped++;
      }
    }

    console.log(`\n📦 Processed ${startupUploads.length} startups`);

    console.log('\n📊 Summary:');
    console.log(`  ✅ Successfully inserted: ${totalInserted} startups`);
    console.log(`  ⏭️  Skipped (duplicates): ${totalSkipped} startups`);
    console.log(`  📝 Total processed: ${startupUploads.length} startups\n`);

    // Verify results
    const { count: approvedCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');

    console.log(`✅ Total approved startups in database: ${approvedCount || 0}\n`);

    if (totalInserted > 0) {
      console.log('🎉 Force approval completed successfully!');
      console.log('🚀 Next step: Run queue processor to generate matches for new startups\n');
    } else {
      console.log('ℹ️  No new startups were inserted (all were duplicates)\n');
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

forceApproveAll();
