#!/usr/bin/env node
/**
 * Backfill all investors with fund size inference data using raw SQL
 * (bypasses PostGREST schema cache issue with new columns)
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { runInferencePipeline, formatAmount } = require('./fund-size-inference');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  BACKFILL: Fund Size Inference Engine        ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Fetch all investors
  const { data: investors, error } = await supabase
    .from('investors')
    .select('*')
    .order('investor_score', { ascending: true });

  if (error) { console.error('DB Error:', error.message); return; }
  console.log(`📦 Processing ${investors.length} investors\n`);

  let applied = 0;
  let skipped = 0;
  let errors = 0;
  const typeCount = {};
  const powerBuckets = { '0': 0, '0-1': 0, '1-2': 0, '2-3': 0, '3-4': 0, '4-5': 0 };

  for (const inv of investors) {
    const result = runInferencePipeline(inv);

    // Track stats
    typeCount[result.capital_type] = (typeCount[result.capital_type] || 0) + 1;
    const p = result.capital_power_score;
    if (p === 0) powerBuckets['0']++;
    else if (p < 1) powerBuckets['0-1']++;
    else if (p < 2) powerBuckets['1-2']++;
    else if (p < 3) powerBuckets['2-3']++;
    else if (p < 4) powerBuckets['3-4']++;
    else powerBuckets['4-5']++;

    // Use raw SQL to update (bypasses PostGREST cache)
    const fundSizeVal = result.fund_size_estimate_usd ? result.fund_size_estimate_usd : 'NULL';
    const confVal = result.fund_size_confidence || 0;
    const sql = `UPDATE investors SET 
      capital_type = '${result.capital_type}',
      fund_size_estimate_usd = ${fundSizeVal},
      fund_size_confidence = ${confVal},
      estimation_method = '${result.estimation_method}',
      capital_power_score = ${result.capital_power_score}
    WHERE id = '${inv.id}'`;

    const { error: updateError } = await supabase.rpc('exec_sql', { sql_query: sql });
    if (updateError) {
      if (errors < 3) console.log(`   ❌ ${inv.name}: ${updateError.message}`);
      errors++;
    } else {
      applied++;
    }
  }

  // Summary
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  BACKFILL COMPLETE                           ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Total:   ${investors.length}`);
  console.log(`  Applied: ${applied}`);
  console.log(`  Errors:  ${errors}`);

  console.log('\n  Capital Type Distribution:');
  for (const [type, count] of Object.entries(typeCount).sort((a, b) => b[1] - a[1])) {
    const pct = (count / investors.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${type.padEnd(20)} ${count.toString().padStart(4)} (${pct}%) ${bar}`);
  }

  console.log('\n  Capital Power Score Distribution:');
  const labels = { '0': '0 (unknown)', '0-1': '<$20M', '1-2': '$20-75M', '2-3': '$75-250M', '3-4': '$250M-1B', '4-5': '$1B+' };
  for (const [bucket, count] of Object.entries(powerBuckets)) {
    const pct = (count / investors.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${(labels[bucket] || bucket).padEnd(14)} ${count.toString().padStart(4)} (${pct}%) ${bar}`);
  }

  console.log('');
}

main().catch(console.error);
