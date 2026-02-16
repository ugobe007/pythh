#!/usr/bin/env node
/**
 * Backfill all investors with fund size inference data using batched raw SQL
 * v3: Writes 12 columns including reported_usd, reported_status, reported_date,
 *     raw_mentions (JSONB), evidence_text
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { runInferencePipeline, formatAmount } = require('./fund-size-inference');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const BATCH_SIZE = 50;

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  BACKFILL: Fund Size Inference v3 (Batched)  ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // Fetch all investors (exclude embedding to avoid huge payload)
  const { data: investors, error } = await supabase
    .from('investors')
    .select('id, name, firm, type, active_fund_size, total_investments, successful_exits, check_size_min, check_size_max, stage, geography_focus, investment_thesis, investor_score, investor_tier, leads_rounds, follows_rounds, bio, linkedin_url, twitter_url, is_verified, sectors, notable_investments, portfolio_performance')
    .order('investor_score', { ascending: true });

  if (error) { console.error('DB Error:', error.message); return; }
  console.log(`📦 Processing ${investors.length} investors in batches of ${BATCH_SIZE}\n`);

  let applied = 0;
  let errors = 0;
  const typeCount = {};
  const methodCount = {};
  const powerBuckets = { '0': 0, '0-1': 0, '1-2': 0, '2-3': 0, '3-4': 0, '4-5': 0 };
  const effectivePowerBuckets = { '0': 0, '0-1': 0, '1-2': 0, '2-3': 0, '3-4': 0, '4-5': 0 };
  const velocityBuckets = { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const confBuckets = { '0-0.3': 0, '0.3-0.5': 0, '0.5-0.7': 0, '0.7-0.9': 0, '0.9-1.0': 0 };

  // Build all inference results first
  const results = investors.map(inv => ({
    inv,
    result: runInferencePipeline(inv),
  }));

  // Track stats
  for (const { result } of results) {
    typeCount[result.capital_type] = (typeCount[result.capital_type] || 0) + 1;
    methodCount[result.estimation_method] = (methodCount[result.estimation_method] || 0) + 1;
    
    const p = result.capital_power_score;
    if (p === 0) powerBuckets['0']++;
    else if (p < 1) powerBuckets['0-1']++;
    else if (p < 2) powerBuckets['1-2']++;
    else if (p < 3) powerBuckets['2-3']++;
    else if (p < 4) powerBuckets['3-4']++;
    else powerBuckets['4-5']++;

    const ep = result.effective_capital_power || 0;
    if (ep === 0) effectivePowerBuckets['0']++;
    else if (ep < 1) effectivePowerBuckets['0-1']++;
    else if (ep < 2) effectivePowerBuckets['1-2']++;
    else if (ep < 3) effectivePowerBuckets['2-3']++;
    else if (ep < 4) effectivePowerBuckets['3-4']++;
    else effectivePowerBuckets['4-5']++;

    const v = result.deployment_velocity_index || 0;
    if (v === 0) velocityBuckets['0']++;
    else if (v < 2) velocityBuckets['1']++;
    else if (v < 3) velocityBuckets['2']++;
    else if (v < 4) velocityBuckets['3']++;
    else if (v < 5) velocityBuckets['4']++;
    else velocityBuckets['5']++;

    const c = result.fund_size_confidence || 0;
    if (c < 0.3) confBuckets['0-0.3']++;
    else if (c < 0.5) confBuckets['0.3-0.5']++;
    else if (c < 0.7) confBuckets['0.5-0.7']++;
    else if (c < 0.9) confBuckets['0.7-0.9']++;
    else confBuckets['0.9-1.0']++;
  }

  // Batch update via SQL
  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(results.length / BATCH_SIZE);
    
    // Build one big SQL statement with CASE expressions
    const ids = batch.map(b => `'${b.inv.id}'`).join(',');
    
    // Build individual UPDATE statements separated by semicolons
    const stmts = batch.map(({ inv, result }) => {
      const esc = (s) => (s || '').replace(/'/g, "''");
      const fundSizeVal = result.fund_size_estimate_usd ? result.fund_size_estimate_usd : 'NULL';
      const effectivePwr = result.effective_capital_power != null ? result.effective_capital_power : 'NULL';
      const velocity = result.deployment_velocity_index != null ? result.deployment_velocity_index : 'NULL';
      const reportedUsd = result.fund_size_reported_usd != null ? result.fund_size_reported_usd : 'NULL';
      const reportedStatus = result.fund_size_reported_status ? `'${esc(result.fund_size_reported_status)}'` : 'NULL';
      const reportedDate = result.fund_size_reported_date ? `'${esc(result.fund_size_reported_date)}'` : 'NULL';
      const rawMentions = result.fund_size_raw_mentions && result.fund_size_raw_mentions.length > 0
        ? `'${esc(JSON.stringify(result.fund_size_raw_mentions))}'::jsonb`
        : 'NULL';
      const evidenceText = result.fund_size_evidence_text ? `'${esc(result.fund_size_evidence_text)}'` : 'NULL';
      return `UPDATE investors SET 
        capital_type = '${esc(result.capital_type)}',
        fund_size_estimate_usd = ${fundSizeVal},
        fund_size_confidence = ${result.fund_size_confidence || 0},
        estimation_method = '${esc(result.estimation_method)}',
        capital_power_score = ${result.capital_power_score},
        effective_capital_power = ${effectivePwr},
        deployment_velocity_index = ${velocity},
        fund_size_reported_usd = ${reportedUsd},
        fund_size_reported_status = ${reportedStatus},
        fund_size_reported_date = ${reportedDate},
        fund_size_raw_mentions = ${rawMentions},
        fund_size_evidence_text = ${evidenceText}
      WHERE id = '${inv.id}'`;
    }).join(';\n');

    const { data: batchResult, error: batchError } = await supabase.rpc('exec_ddl', { sql_text: stmts });
    if (batchError) {
      console.log(`   ❌ Batch ${batchNum}/${totalBatches}: ${batchError.message}`);
      errors += batch.length;
    } else if (batchResult && batchResult !== 'OK') {
      console.log(`   ⚠️  Batch ${batchNum}/${totalBatches}: ${batchResult}`);
      errors += batch.length;
    } else {
      applied += batch.length;
      process.stdout.write(`   ✅ Batch ${batchNum}/${totalBatches}: ${batch.length} investors updated\n`);
    }
  }

  // Summary
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  BACKFILL v3 COMPLETE                        ║');
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

  console.log('\n  Estimation Method Distribution:');
  for (const [method, count] of Object.entries(methodCount).sort((a, b) => b[1] - a[1])) {
    const pct = (count / investors.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${method.padEnd(20)} ${count.toString().padStart(4)} (${pct}%) ${bar}`);
  }

  console.log('\n  Confidence Distribution (v2 Data Density Multiplier):');
  const confLabels = { '0-0.3': 'Low (<0.3)', '0.3-0.5': 'Medium (0.3-0.5)', '0.5-0.7': 'Good (0.5-0.7)', '0.7-0.9': 'High (0.7-0.9)', '0.9-1.0': 'Very High (0.9+)' };
  for (const [bucket, count] of Object.entries(confBuckets)) {
    const pct = (count / investors.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${(confLabels[bucket] || bucket).padEnd(20)} ${count.toString().padStart(4)} (${pct}%) ${bar}`);
  }

  console.log('\n  Capital Power Score Distribution:');
  const labels = { '0': '0 (unknown)', '0-1': '<$20M', '1-2': '$20-75M', '2-3': '$75-250M', '3-4': '$250M-1B', '4-5': '$1B+' };
  for (const [bucket, count] of Object.entries(powerBuckets)) {
    const pct = (count / investors.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${(labels[bucket] || bucket).padEnd(14)} ${count.toString().padStart(4)} (${pct}%) ${bar}`);
  }

  console.log('\n  Effective Capital Power Distribution (power × confidence):');
  for (const [bucket, count] of Object.entries(effectivePowerBuckets)) {
    const pct = (count / investors.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${(labels[bucket] || bucket).padEnd(14)} ${count.toString().padStart(4)} (${pct}%) ${bar}`);
  }

  console.log('\n  Deployment Velocity Distribution:');
  const velLabels = { '0': 'Unknown', '1': 'Conservative (<3/yr)', '2': 'Moderate (3-8/yr)', '3': 'Active (8-15/yr)', '4': 'Hyper-Active (15-30/yr)', '5': 'Sprayer (30+/yr)' };
  for (const [bucket, count] of Object.entries(velocityBuckets)) {
    const pct = (count / investors.length * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / investors.length * 40));
    console.log(`    ${(velLabels[bucket] || bucket).padEnd(26)} ${count.toString().padStart(4)} (${pct}%) ${bar}`);
  }

  // Top 15 by effective capital power (v2 metric)
  const sorted = results.filter(r => r.result.effective_capital_power > 0).sort((a, b) => b.result.effective_capital_power - a.result.effective_capital_power);
  if (sorted.length > 0) {
    console.log('\n  Top 15 by Effective Capital Power (power × confidence):');
    for (let i = 0; i < Math.min(15, sorted.length); i++) {
      const { inv, result } = sorted[i];
      const fundStr = formatAmount(result.fund_size_estimate_usd);
      const vel = result.deployment_velocity_index > 0 ? ` vel=${result.deployment_velocity_index}` : '';
      console.log(`    ${(i + 1).toString().padStart(2)}. ${(inv.name || '').padEnd(30)} ${fundStr.padEnd(10)} pwr=${result.capital_power_score.toFixed(2)} eff=${result.effective_capital_power.toFixed(2)} conf=${result.fund_size_confidence}${vel} [${result.estimation_method}]`);
    }
  }

  console.log('');
}

main().catch(console.error);
