#!/usr/bin/env node
/**
 * Oracle Signal Backfill
 * ============================================================================
 * 
 * Populates `signals[]` and `focus_areas` for all investors in the DB.
 * These fields power the Oracle's "where are they investing now/next" prediction.
 * 
 * What it does per investor:
 *  1. Fetch Google News RSS for "[Name] [Firm] investment"
 *  2. Run extractInvestorDataFromArticles() → fill sectors/stage/portfolio gaps
 *  3. Run buildOracleSignals() → typed signals[] + focus_areas JSONB
 *  4. Write results to Supabase
 * 
 * Usage:
 *   node scripts/oracle-signal-backfill.js              # all investors
 *   node scripts/oracle-signal-backfill.js --limit=100  # cap at 100
 *   node scripts/oracle-signal-backfill.js --dry-run    # no DB writes
 *   node scripts/oracle-signal-backfill.js --force      # re-process already done
 * 
 * ============================================================================
 */

'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const {
  fetchInvestorUniverse,
  parseLimitArg,
  parseOffsetArg,
  parseCohortArg,
} = require('../lib/investorUniverse.mjs');
const { searchInvestorNews, extractInvestorDataFromArticles, buildOracleSignals } = require('../server/services/investorInferenceService');

// ── Config ──────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const LIMIT = parseLimitArg(args, { defaultZero: true });
const OFFSET = parseOffsetArg(args);
const COHORT = parseCohortArg(args);
const DRY_RUN = args.includes('--dry-run');
const FORCE = args.includes('--force');  // Re-process investors that already have signals

// Delay between investors to avoid hammering Google News RSS
const DELAY_MS = 1500;

// ── Helpers ──────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function logProgress(done, total, name, firm, signalCount, status) {
  const pct = total ? Math.round((done / total) * 100) : '?';
  const tag = DRY_RUN ? '[DRY-RUN] ' : '';
  console.log(`${tag}[${done}/${total} ${pct}%] ${name} @ ${firm || 'unknown'} → ${signalCount} signals (${status})`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('='.repeat(60));
  console.log('Oracle Signal Backfill');
  if (DRY_RUN) console.log('DRY RUN MODE — no DB writes');
  if (LIMIT > 0) console.log(`Limit: ${LIMIT} investors`);
  else console.log('Limit: ALL venture + angel investors');
  if (OFFSET) console.log(`Offset: ${OFFSET}`);
  console.log(`Cohort: ${COHORT}`);
  if (FORCE)   console.log('FORCE mode — re-processing investors with existing signals');
  console.log('='.repeat(60));

  // ── Load venture + angel universe ───────────────────────────────────────────
  let pool = await fetchInvestorUniverse(supabase, {
    limit: LIMIT,
    offset: OFFSET,
    cohort: COHORT,
    needsSignals: !FORCE,
  });

  if (FORCE) {
    // Re-fetch without signals filter when forcing
    pool = await fetchInvestorUniverse(supabase, {
      limit: LIMIT,
      offset: OFFSET,
      cohort: COHORT,
      needsSignals: false,
    });
  }

  if (!pool.length) {
    console.log('No investors to process. All done!');
    return;
  }

  console.log(`Processing ${pool.length} investors…\n`);

  // ── Counters ────────────────────────────────────────────────────────────────
  let processed = 0;
  let enriched = 0;
  let skipped = 0;
  let dbErrors = 0;
  let totalSignals = 0;

  // ── Process each investor ───────────────────────────────────────────────────
  for (let i = 0; i < pool.length; i++) {
    const investor = pool[i];
    const name = investor.name || 'Unknown';
    const firm = investor.firm || '';

    try {
      // 1. Fetch news articles
      const articles = await searchInvestorNews(name, firm);

      if (articles.length === 0) {
        logProgress(i + 1, pool.length, name, firm, 0, 'no news');
        skipped++;
        await sleep(DELAY_MS);
        continue;
      }

      // 2. Extract enrichment data (fill sectors/stage/portfolio gaps)
      const { enrichedData } = extractInvestorDataFromArticles(articles, investor);

      // Merge enriched data into investor object for buildOracleSignals
      const mergedInvestor = { ...investor, ...enrichedData };

      // 3. Build Oracle signals
      const { signals, focus_areas, last_investment_date } = buildOracleSignals(mergedInvestor, articles);

      totalSignals += signals.length;
      logProgress(i + 1, pool.length, name, firm, signals.length, `${articles.length} articles`);

      // 4. Write to DB
      if (!DRY_RUN && signals.length > 0) {
        const updatePayload = {
          signals,
          focus_areas,
          last_enrichment_date: new Date().toISOString(),
        };

        // Only set last_investment_date if we found one
        if (last_investment_date) {
          updatePayload.last_investment_date = last_investment_date;
        }

        // Also write back enriched sectors/stage/portfolio if they were empty
        if (enrichedData.sectors) updatePayload.sectors = enrichedData.sectors;
        if (enrichedData.stage) updatePayload.stage = enrichedData.stage;
        if (enrichedData.portfolio_companies) updatePayload.portfolio_companies = enrichedData.portfolio_companies;
        if (enrichedData.check_size_min) updatePayload.check_size_min = enrichedData.check_size_min;
        if (enrichedData.check_size_max) updatePayload.check_size_max = enrichedData.check_size_max;
        if (enrichedData.inferred_bio && !investor.bio) updatePayload.bio = enrichedData.inferred_bio;
        if (enrichedData.geography_focus) updatePayload.geography_focus = enrichedData.geography_focus;

        const { error: updateError } = await supabase
          .from('investors')
          .update(updatePayload)
          .eq('id', investor.id);

        if (updateError) {
          console.error(`  DB error for ${name}:`, updateError.message);
          dbErrors++;
        } else {
          enriched++;
        }
      } else if (!DRY_RUN && signals.length === 0) {
        skipped++;
      } else {
        // Dry run — count as enriched for reporting
        enriched++;
      }

    } catch (err) {
      console.error(`  Error processing ${name}:`, err.message);
      skipped++;
    }

    // Rate limiting — be kind to Google News RSS
    await sleep(DELAY_MS);
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('Oracle Signal Backfill Complete');
  console.log(`  Processed : ${processed + enriched + skipped}`);
  console.log(`  Enriched  : ${enriched}`);
  console.log(`  Skipped   : ${skipped} (no articles/signals found)`);
  console.log(`  DB errors : ${dbErrors}`);
  console.log(`  Avg sigs  : ${enriched ? (totalSignals / enriched).toFixed(1) : 0} per investor`);
  if (DRY_RUN) console.log('\n  ** DRY RUN — no changes written to DB **');
  console.log('='.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
