#!/usr/bin/env node
/**
 * TARGETED STARTUP ENRICHMENT - Full Inference Pipeline
 *
 * Uses the SAME two-step inference engine as the URL submission bar:
 *   Step 1: Re-scrape website HTML → extractInferenceData (fast, local)
 *   Step 2: If still sparse → quickEnrich (Google News RSS fallback queries)
 *
 * Process:
 * 1. Identify Phase 2-4 startups (scores < 70, missing key data)
 * 2. For each: fetch website HTML → extractInferenceData
 * 3. If still sparse after HTML: quickEnrich via news (3-query cascade)
 * 4. Merge enriched data + promote to top-level columns
 * 5. Mark for GOD score recalculation
 *
 * Run: node scripts/enrich-sparse-startups.js [--limit=50] [--dry-run]
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// Shared inference engine — same functions used by instantSubmit.js
const { extractInferenceData } = require('../lib/inference-extractor');
const { quickEnrich, isDataSparse } = require('../server/services/inferenceService');

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

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
// FETCH WEBSITE HTML (Step 1 of pipeline)
// ============================================================================
async function fetchWebsiteHtml(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    return response.data?.toString() || null;
  } catch (e) {
    return null;
  }
}

// ============================================================================
// ENRICH ONE STARTUP — Same two-step pipeline as instantSubmit.js
//   Step 1: Re-scrape website HTML → extractInferenceData
//   Step 2: If still sparse → quickEnrich via news (3-query cascade)
// ============================================================================
async function enrichOneStartup(startup, dryRun = false) {
  const currentExtracted = startup.extracted_data || {};
  let inferenceData = { ...currentExtracted };
  const stepLog = [];
  let htmlEnriched = false;

  // ── Step 1: Re-scrape website HTML + extractInferenceData ──
  if (startup.website) {
    const html = await fetchWebsiteHtml(startup.website);
    if (html && html.length >= 50) {
      const htmlData = extractInferenceData(html, startup.website);
      if (htmlData) {
        for (const [key, val] of Object.entries(htmlData)) {
          if (val !== null && val !== undefined && val !== '' &&
              !(Array.isArray(val) && val.length === 0)) {
            if (!inferenceData[key]) {
              inferenceData[key] = val;
              htmlEnriched = true;
            }
          }
        }
        stepLog.push(`HTML: Tier ${htmlData.confidence?.tier || '?'}${htmlEnriched ? ' (new data)' : ' (no new fields)'}`);
      }
    } else {
      stepLog.push('HTML: failed/empty');
    }
  }

  // ── Step 2: News enrichment if still sparse ──
  const stillSparse = isDataSparse({ extracted_data: inferenceData });
  if (stillSparse) {
    const newsResult = await quickEnrich(startup.name, inferenceData, startup.website || null, 5000);
    if (newsResult.enrichmentCount > 0) {
      inferenceData = { ...inferenceData, ...newsResult.enrichedData };
      stepLog.push(`News: +${newsResult.enrichmentCount} fields (${newsResult.fieldsEnriched.join(', ')}) from ${newsResult.articlesFound} articles`);
    } else {
      stepLog.push(`News: 0 fields (${newsResult.articlesFound} articles)`);
    }
  } else {
    stepLog.push('News: skipped (sufficient data after HTML)');
  }

  // Count net-new fields
  const newFieldCount = Object.keys(inferenceData).filter(k =>
    !currentExtracted[k] && inferenceData[k] !== null && inferenceData[k] !== undefined
  ).length;

  if (newFieldCount === 0 && !htmlEnriched) {
    return { enriched: false, stepLog, newFieldCount: 0 };
  }

  if (dryRun) {
    return { enriched: true, stepLog, newFieldCount, dryRun: true };
  }

  // ── Build DB update payload ──
  const updatePayload = {
    extracted_data: inferenceData,
    updated_at: new Date().toISOString()
  };

  // Promote critical fields to top-level columns
  if (inferenceData.raise_amount && !startup.raise_amount)
    updatePayload.raise_amount = inferenceData.raise_amount;
  if (inferenceData.raise_type && !startup.raise_type)
    updatePayload.raise_type = inferenceData.raise_type;
  if (inferenceData.sectors?.length && (!startup.sectors || startup.sectors.length === 0))
    updatePayload.sectors = inferenceData.sectors;
  if (inferenceData.customer_count && !startup.customer_count)
    updatePayload.customer_count = inferenceData.customer_count;
  if (inferenceData.arr && !startup.arr)
    updatePayload.arr = inferenceData.arr;
  if (inferenceData.mrr && !startup.mrr)
    updatePayload.mrr = inferenceData.mrr;
  if (inferenceData.description && !startup.pitch)
    updatePayload.pitch = inferenceData.description;

  const { error: updateError } = await supabase
    .from('startup_uploads')
    .update(updatePayload)
    .eq('id', startup.id);

  if (updateError) throw new Error(updateError.message);

  return { enriched: true, stepLog, newFieldCount };
}

// ============================================================================
// MAIN ENRICHMENT PROCESS
// ============================================================================
async function enrichSparseStartups() {
  console.log('=== STARTUP ENRICHMENT — Full Inference Pipeline ===\n');
  console.log('Pipeline: URL scrape (extractInferenceData) → news fallback (quickEnrich)\n');

  // Parse command line args
  const args = process.argv.slice(2);
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 50;
  const dryRun = args.includes('--dry-run');

  if (dryRun) console.log('🧪 DRY RUN — no database writes\n');
  console.log(`Processing up to ${limit} startups\n`);

  // ── Load sparse startups ──
  console.log('Loading data-sparse startups...');
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website, pitch, sectors, stage, raise_amount, raise_type, customer_count, mrr, arr, team_size, location, total_god_score, extracted_data')
    .eq('status', 'approved')
    .order('updated_at', { ascending: true })
    .limit(limit * 3);

  if (error) {
    console.error('Error loading startups:', error);
    return;
  }

  const sparseStartups = startups.filter(s => {
    const { phase } = classifyDataRichness(s);
    return phase >= 2 && s.total_god_score < 70;
  }).slice(0, limit);

  console.log(`Found ${sparseStartups.length} Phase 2-4 startups (scores < 70)\n`);

  if (sparseStartups.length === 0) {
    console.log('No sparse startups found.');
    return;
  }

  // ── Process each ──
  let enriched = 0;
  let noData = 0;
  let errors = 0;

  for (let i = 0; i < sparseStartups.length; i++) {
    const startup = sparseStartups[i];
    console.log(`\n[${i + 1}/${sparseStartups.length}] ${startup.name} (score: ${startup.total_god_score})`);
    if (startup.website) console.log(`  URL: ${startup.website}`);

    try {
      const result = await enrichOneStartup(startup, dryRun);
      for (const step of result.stepLog) console.log(`  ${step}`);

      if (result.enriched) {
        console.log(`  ✅ ${result.dryRun ? '[DRY RUN] Would add' : 'Added'} ${result.newFieldCount} new fields`);
        enriched++;
      } else {
        console.log('  ⚠️  No new data found');
        noData++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      errors++;
    }

    // Gentle rate limit for news API
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // ── Summary ──
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('STARTUP ENRICHMENT SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`  Processed: ${sparseStartups.length}`);
  console.log(`  Enriched:  ${enriched} (${((enriched / sparseStartups.length) * 100).toFixed(1)}%)`);
  console.log(`  No Data:   ${noData}`);
  console.log(`  Errors:    ${errors}`);
  if (!dryRun && enriched > 0) {
    console.log('\n  Next: npx tsx scripts/recalculate-scores.ts');
  }
  console.log('═══════════════════════════════════════════════════════════════\n');
}

enrichSparseStartups().catch(console.error);
