#!/usr/bin/env node
/**
 * HOLDING REVIEW WORKER
 *
 * Scheduled daily job that handles the "holding" lifecycle:
 *
 * 1. Retry enrichment for startups in 'holding' status
 *    - If new data found → promote to 'enriched', trigger score recalc
 *    - If still no data AND holding_since > 30 days → DELETE (flush)
 *    - If still no data AND < 30 days → increment attempts, stay 'holding'
 *
 * 2. Startups in 'waiting' status with enrichment_attempts >= 3 but no
 *    holding_since set → promote to 'holding' (cleanup for legacy records)
 *
 * Schedule: daily at 3am via PM2 cron
 * Run manually: node scripts/holding-review-worker.js [--dry-run] [--limit=200]
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { extractInferenceData } = require('../lib/inference-extractor');
const { quickEnrich, isDataSparse } = require('../server/services/inferenceService');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const HOLDING_DELETE_DAYS = 30;
const HOLDING_RETRY_THRESHOLD = 3; // attempts before moving to holding

// ─── Fetch website HTML ───────────────────────────────────────────────────
async function fetchWebsiteHtml(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const response = await axios.get(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      timeout: 10000,
      maxRedirects: 5,
    });
    return response.data?.toString() || null;
  } catch {
    return null;
  }
}

// ─── Attempt enrichment for one holding startup ───────────────────────────
async function retryEnrichment(startup) {
  const currentExtracted = startup.extracted_data || {};
  let inferenceData = { ...currentExtracted };
  let foundNewData = false;

  if (startup.website) {
    const html = await fetchWebsiteHtml(startup.website);
    if (html && html.length >= 50) {
      const htmlData = extractInferenceData(html, startup.website);
      if (htmlData) {
        for (const [key, val] of Object.entries(htmlData)) {
          if (val !== null && val !== undefined && val !== '' &&
              !(Array.isArray(val) && val.length === 0) && !inferenceData[key]) {
            inferenceData[key] = val;
            foundNewData = true;
          }
        }
      }
    }
  }

  // News fallback if HTML was empty
  if (!foundNewData && isDataSparse({ extracted_data: inferenceData })) {
    const newsResult = await quickEnrich(startup.name, inferenceData, startup.website || null, 5000);
    if (newsResult.enrichmentCount > 0) {
      inferenceData = { ...inferenceData, ...newsResult.enrichedData };
      foundNewData = true;
    }
  }

  return { foundNewData, inferenceData };
}

// ─── Promote rescued startup to enriched ─────────────────────────────────
async function promoteToEnriched(startup, inferenceData, dryRun) {
  if (dryRun) return;

  const updatePayload = {
    extracted_data: inferenceData,
    updated_at: new Date().toISOString(),
    last_enrichment_attempt: new Date().toISOString(),
    enrichment_status: 'enriched',
    holding_since: null,
  };

  // Promote to top-level columns if missing
  if (inferenceData.raise_amount && !startup.raise_amount)
    updatePayload.raise_amount = inferenceData.raise_amount;
  if (inferenceData.sectors?.length && (!startup.sectors || startup.sectors.length === 0))
    updatePayload.sectors = inferenceData.sectors;
  if (inferenceData.customer_count && !startup.customer_count)
    updatePayload.customer_count = inferenceData.customer_count;
  if (inferenceData.arr && !startup.arr)
    updatePayload.arr = inferenceData.arr;
  if (inferenceData.mrr && !startup.mrr)
    updatePayload.mrr = inferenceData.mrr;

  await supabase.from('startup_uploads').update(updatePayload).eq('id', startup.id);
}

// ─── Check if startup has exceeded holding window ────────────────────────
function isExpired(startup) {
  if (!startup.holding_since) return false;
  const holdingMs = Date.now() - new Date(startup.holding_since).getTime();
  const holdingDays = holdingMs / (1000 * 60 * 60 * 24);
  return holdingDays >= HOLDING_DELETE_DAYS;
}

// ─── Log result to ai_logs ────────────────────────────────────────────────
async function logToAiLogs(summary) {
  try {
    await supabase.from('ai_logs').insert({
      log_type: 'holding_review_worker',
      log_level: 'info',
      message: `Holding review complete: rescued=${summary.rescued}, held=${summary.held}, deleted=${summary.deleted}, promoted_to_holding=${summary.promotedToHolding}`,
      metadata: summary,
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal
  }
}

// ─── Fix legacy records: waiting >= 3 attempts but no holding_since ───────
async function fixLegacyHoldingRecords(dryRun) {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('id')
    .eq('status', 'approved')
    .eq('enrichment_status', 'waiting')
    .gte('enrichment_attempts', HOLDING_RETRY_THRESHOLD)
    .is('holding_since', null);

  if (error || !data?.length) return 0;

  if (!dryRun) {
    await supabase
      .from('startup_uploads')
      .update({
        enrichment_status: 'holding',
        holding_since: new Date().toISOString(),
      })
      .eq('status', 'approved')
      .eq('enrichment_status', 'waiting')
      .gte('enrichment_attempts', HOLDING_RETRY_THRESHOLD)
      .is('holding_since', null);
  }

  return data.length;
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
async function runHoldingReviewWorker() {
  console.log('=== HOLDING REVIEW WORKER ===\n');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 200;

  if (dryRun) console.log('[DRY RUN] No database writes will be made.\n');
  console.log(`Limit: ${limit} startups per run\n`);

  const summary = {
    processed: 0,
    rescued: 0,
    held: 0,
    deleted: 0,
    promotedToHolding: 0,
    errors: 0,
  };

  // Step 1: Fix legacy waiting records that should be in holding
  const promoted = await fixLegacyHoldingRecords(dryRun);
  if (promoted > 0) {
    summary.promotedToHolding = promoted;
    console.log(`Promoted ${promoted} legacy 'waiting' (>=3 attempts) → 'holding'\n`);
  }

  // Step 2: Load holding startups
  const { data: holdings, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website, pitch, sectors, stage, raise_amount, customer_count, arr, mrr, extracted_data, holding_since, enrichment_attempts')
    .eq('status', 'approved')
    .eq('enrichment_status', 'holding')
    .order('holding_since', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error loading holding startups:', error.message);
    return;
  }

  if (!holdings?.length) {
    console.log('No startups in holding status. Nothing to do.\n');
    await logToAiLogs(summary);
    return;
  }

  console.log(`Found ${holdings.length} startups in holding status\n`);
  const now = new Date().toISOString();

  for (let i = 0; i < holdings.length; i++) {
    const startup = holdings[i];
    summary.processed++;

    const expired = isExpired(startup);
    const daysHeld = startup.holding_since
      ? ((Date.now() - new Date(startup.holding_since).getTime()) / (1000 * 60 * 60 * 24)).toFixed(1)
      : 'unknown';

    console.log(`[${i + 1}/${holdings.length}] ${startup.name} | held ${daysHeld}d | attempts: ${startup.enrichment_attempts}`);

    try {
      const { foundNewData, inferenceData } = await retryEnrichment(startup);

      if (foundNewData) {
        console.log(`  ✅ New data found — promoting to 'enriched'`);
        await promoteToEnriched(startup, inferenceData, dryRun);
        summary.rescued++;
      } else if (expired) {
        console.log(`  🗑️  No data after ${HOLDING_DELETE_DAYS}d — DELETING`);
        if (!dryRun) {
          await supabase.from('startup_uploads').delete().eq('id', startup.id);
        }
        summary.deleted++;
      } else {
        console.log(`  ⏳ Still no data (${daysHeld}/${HOLDING_DELETE_DAYS}d) — staying in holding`);
        if (!dryRun) {
          await supabase
            .from('startup_uploads')
            .update({
              last_enrichment_attempt: now,
              enrichment_attempts: (startup.enrichment_attempts || 0) + 1,
            })
            .eq('id', startup.id);
        }
        summary.held++;
      }
    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`);
      summary.errors++;
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 1500));
  }

  // Summary
  console.log('\n════════════════════════════════════════════════════════');
  console.log('HOLDING REVIEW SUMMARY');
  console.log('════════════════════════════════════════════════════════');
  console.log(`  Processed:           ${summary.processed}`);
  console.log(`  Rescued (enriched):  ${summary.rescued}`);
  console.log(`  Held (< 30 days):    ${summary.held}`);
  console.log(`  Deleted (>= 30 days): ${summary.deleted}`);
  console.log(`  Promoted to holding: ${summary.promotedToHolding}`);
  console.log(`  Errors:              ${summary.errors}`);
  if (!dryRun && summary.rescued > 0) {
    console.log('\n  Rescued startups need score recalculation:');
    console.log('  npx tsx scripts/recalculate-scores.ts');
  }
  console.log('════════════════════════════════════════════════════════\n');

  await logToAiLogs(summary);
}

runHoldingReviewWorker().catch(console.error);
