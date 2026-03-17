#!/usr/bin/env node
/**
 * BELOW-40 ENRICH → PURGE → RECALC PIPELINE
 * ==========================================
 * [1] Run enrichment on approved startups with total_god_score < 40
 * [2] Reject (delete from approved) any that cannot be enriched (no website + no meaningful data)
 * [3] Recalculate GOD scores
 *
 * Usage:
 *   node scripts/below-40-enrich-purge-recalc.js           # run all steps
 *   node scripts/below-40-enrich-purge-recalc.js --dry-run  # preview purge only; enrichment still runs
 *   node scripts/below-40-enrich-purge-recalc.js --skip-enrich   # skip step 1 (e.g. already ran)
 *   node scripts/below-40-enrich-purge-recalc.js --skip-recalc   # skip step 3
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const SKIP_ENRICH = process.argv.includes('--skip-enrich');
const SKIP_RECALC = process.argv.includes('--skip-recalc');

// Same logic as remove-empty-startups.js for data richness
function scoreDataRichness(s) {
  let signals = 0;
  const ed = s.extracted_data || {};

  if (s.website || s.company_website) signals += 2;
  if ((s.pitch || s.description || '').length > 30) signals++;
  if (s.sectors?.length > 0) signals++;
  if (s.stage) signals++;
  if (s.raise_amount || s.last_round_amount_usd || s.total_funding_usd) signals++;
  if (s.customer_count || s.parsed_customers) signals++;
  if (s.mrr || s.arr || s.arr_usd || s.revenue_usd) signals++;
  if (s.team_size || s.team_size_estimate || s.parsed_headcount) signals++;
  if (s.location) signals++;
  if ((s.tagline || '').length > 10) signals++;
  if (s.has_revenue) signals++;
  if (s.has_customers) signals++;
  if (s.founders) signals++;
  if ((s.growth_rate || s.arr_growth_rate) > 0) signals++;

  if (ed.team || ed.founders || ed.team_background) signals++;
  if (ed.revenue || ed.mrr || ed.arr || ed.traction || ed.customers) signals++;
  if (ed.funding || ed.raised || ed.backed_by || ed.investors) signals++;
  if (ed.market_size || ed.tam || ed.market || ed.target_market) signals++;
  if (ed.description || ed.summary) signals++;
  if ((ed.value_proposition || '').length > 10) signals++;
  if ((ed.problem || '').length > 10) signals++;
  if ((ed.solution || '').length > 10) signals++;

  return signals;
}

function run(cmd, args, label) {
  return new Promise((resolve, reject) => {
    const cwd = path.resolve(__dirname, '..');
    // Use shell so 'node' and 'npx' resolve correctly on all platforms
    const child = spawn(cmd, args, { stdio: 'inherit', cwd, shell: process.platform === 'win32' });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${label} exited with ${code}`))));
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║  BELOW-40: ENRICH → PURGE UNENRICHABLE → RECALC              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  // ─── Step 1: Enrich below-40 ─────────────────────────────────────────────
  if (!SKIP_ENRICH) {
    console.log('Step 1: Running enrichment on approved startups with score < 40...\n');
    await run('node', ['scripts/enrich-floor-startups.js', '--below-40'], 'enrich-floor-startups');
    console.log('\nStep 1 done.\n');
  } else {
    console.log('Step 1: Skipped (--skip-enrich).\n');
  }

  // ─── Step 2: Purge unenrichable (no website + still no meaningful data) ───
  console.log('Step 2: Finding below-40 startups that cannot be enriched...\n');

  const selectCols = 'id, name, website, company_website, pitch, description, sectors, stage, raise_amount, last_round_amount_usd, total_funding_usd, customer_count, parsed_customers, mrr, arr, arr_usd, revenue_usd, team_size, team_size_estimate, parsed_headcount, location, tagline, has_revenue, has_customers, founders, growth_rate, arr_growth_rate, total_god_score, extracted_data';

  let allBelow = [];
  let from = 0;
  const PAGE = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(selectCols)
      .eq('status', 'approved')
      .lt('total_god_score', 40)
      .not('total_god_score', 'is', null)
      .range(from, from + PAGE - 1);

    if (error) {
      console.error('Fetch error:', error.message);
      process.exit(1);
    }
    if (!data?.length) break;
    allBelow = allBelow.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }

  // "Cannot be enriched" = no website AND data richness still ≤ 2 after enrichment
  const RICHNESS_FLOOR = 2;
  const toReject = allBelow.filter((s) => {
    const hasUrl = !!(s.website || s.company_website);
    if (hasUrl) return false;
    const richness = scoreDataRichness(s);
    return richness <= RICHNESS_FLOOR;
  });

  console.log(`  Below-40 approved: ${allBelow.length}`);
  console.log(`  Cannot be enriched (no website + richness ≤ ${RICHNESS_FLOOR}): ${toReject.length}\n`);

  if (toReject.length > 0) {
    if (DRY_RUN) {
      console.log('  [DRY RUN] Would reject:');
      toReject.slice(0, 10).forEach((s) => console.log(`    [${s.total_god_score}] ${(s.name || '').slice(0, 50)} (richness=${scoreDataRichness(s)})`));
      if (toReject.length > 10) console.log(`    ... and ${toReject.length - 10} more`);
      console.log('\n  Run without --dry-run to apply rejections.\n');
    } else {
      const BATCH = 200;
      let done = 0;
      for (let i = 0; i < toReject.length; i += BATCH) {
        const batch = toReject.slice(i, i + BATCH).map((s) => s.id);
        const { error: updateError } = await supabase
          .from('startup_uploads')
          .update({ status: 'rejected', admin_notes: 'below-40-enrich-purge-recalc: cannot be enriched (no website + no meaningful data)' })
          .in('id', batch);
        if (updateError) console.error('  Batch error:', updateError.message);
        else done += batch.length;
      }
      console.log(`  Rejected ${done} startups.\n`);
    }
  }

  // ─── Step 3: Recalculate scores ──────────────────────────────────────────
  if (!SKIP_RECALC) {
    console.log('Step 3: Recalculating GOD scores...\n');
    await run('npx', ['tsx', 'scripts/recalculate-scores.ts'], 'recalculate-scores');
    console.log('\nStep 3 done.\n');
  } else {
    console.log('Step 3: Skipped (--skip-recalc).\n');
  }

  console.log('Pipeline complete.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
