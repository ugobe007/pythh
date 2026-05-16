#!/usr/bin/env node
/**
 * Targeted GOD score recalculation for approved startups stuck at the floor (score = 40).
 * 
 * - Skips the embedding column (avoids Supabase JSON size limits)
 * - Uses the same hotGodFromStartupRow scoring as instantSubmit
 * - Applies the scoring guard floor (40 minimum) after recalculation
 * - Logs distribution before and after
 *
 * Usage:
 *   node scripts/rescore-floor-pinned.js [--limit=500] [--dry-run]
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { calculateGodScoreColumnsFromStartup } = require('../server/scoring/hotGodFromStartupRow');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const FLOOR = 40;
const COLUMNS = [
  'id', 'name', 'website', 'tagline', 'description', 'pitch',
  'sectors', 'stage', 'team_size', 'has_technical_cofounder',
  'mrr', 'revenue_annual', 'revenue_usd', 'arr_usd',
  'growth_rate_monthly', 'is_launched', 'has_demo',
  'traction_confidence', 'funding_confidence',
  'last_round_amount_usd', 'total_funding_usd',
  'burn_monthly_usd', 'runway_months', 'parsed_customers', 'parsed_users',
  'extracted_data', 'data_completeness', 'total_god_score',
].join(', ');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');
const PAGE_SIZE = 200;

(async () => {
  console.log(`\n🔧 Rescore floor-pinned startups (GOD = ${FLOOR})`);
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} · limit=${LIMIT} · pageSize=${PAGE_SIZE}\n`);

  let allStartups = [];
  let page = 0;

  while (allStartups.length < LIMIT) {
    const remaining = LIMIT - allStartups.length;
    const take = Math.min(PAGE_SIZE, remaining);
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(COLUMNS)
      .eq('status', 'approved')
      .eq('total_god_score', FLOOR)
      .range(page * PAGE_SIZE, page * PAGE_SIZE + take - 1);

    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allStartups.push(...data);
    console.log(`  Loaded page ${page}: ${data.length} rows (total: ${allStartups.length})`);
    if (data.length < take) break;
    page++;
  }

  if (allStartups.length === 0) {
    console.log('No floor-pinned startups found.');
    return;
  }

  console.log(`\n📊 Processing ${allStartups.length} startups...\n`);

  const stats = { updated: 0, unchanged: 0, errors: 0 };
  const newScores = [];

  for (let i = 0; i < allStartups.length; i++) {
    const s = allStartups[i];
    try {
      const cols = calculateGodScoreColumnsFromStartup(s);
      const newTotal = Math.max(FLOOR, cols.total_god_score);
      newScores.push(newTotal);

      if (newTotal === FLOOR) {
        stats.unchanged++;
        continue; // No change, skip DB write
      }

      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('startup_uploads')
          .update({
            total_god_score: newTotal,
            team_score: cols.team_score,
            traction_score: cols.traction_score,
            market_score: cols.market_score,
            product_score: cols.product_score,
            vision_score: cols.vision_score,
            updated_at: new Date().toISOString(),
          })
          .eq('id', s.id);
        if (upErr) { stats.errors++; continue; }
      }
      stats.updated++;
      if ((i + 1) % 50 === 0 || i === allStartups.length - 1) {
        process.stdout.write(`  [${i + 1}/${allStartups.length}] updated=${stats.updated} unchanged=${stats.unchanged}\r`);
      }
    } catch (e) {
      stats.errors++;
    }
  }

  console.log(`\n\n✅ DONE`);
  console.log(`   Updated:   ${stats.updated}`);
  console.log(`   Unchanged: ${stats.unchanged} (still at floor — too sparse to rescore)`);
  console.log(`   Errors:    ${stats.errors}`);

  if (newScores.length > 0) {
    const lifted = newScores.filter(s => s > FLOOR);
    const avg = lifted.length ? Math.round(lifted.reduce((a, b) => a + b, 0) / lifted.length) : 0;
    console.log(`\n   Of ${allStartups.length} processed: ${lifted.length} lifted above floor`);
    if (lifted.length > 0) console.log(`   Avg new score (lifted): ${avg}`);
  }
})().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
