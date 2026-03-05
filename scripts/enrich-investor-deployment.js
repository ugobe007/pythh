#!/usr/bin/env node
/**
 * enrich-investor-deployment.js
 *
 * Computes and writes two market intelligence fields on the investors table:
 *  - dry_powder_estimate      (USD) — estimated remaining capital to deploy
 *  - deployment_velocity_index (0-100) — how actively the investor is deploying right now
 *
 * Methodology:
 *  velocity:
 *    - Primary: recency of last_investment_date (days since last deal)
 *    - Boosters: capital_power_score, stage focus (early ↑), investor_score
 *    - Fallback: normalize investor_score × 15 as baseline
 *  dry_powder:
 *    - If fund_size_estimate_usd: fund × 0.5 (midpoint deployment lifestyle)
 *    - If only check_size_max: check_size_max × 15 deals × 0.5
 *    - If neither: skip (don't fabricate)
 *
 * Usage:
 *   node scripts/enrich-investor-deployment.js [--dry-run] [--limit=N]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const NOW = new Date();

// ─── Velocity computation ────────────────────────────────────────────────────
function computeVelocity(investor) {
  let score = 0;

  if (investor.last_investment_date) {
    const daysSince = Math.floor(
      (NOW - new Date(investor.last_investment_date)) / (1000 * 60 * 60 * 24)
    );
    if (daysSince <= 30)       score = 92;
    else if (daysSince <= 90)  score = 80;
    else if (daysSince <= 180) score = 67;
    else if (daysSince <= 365) score = 52;
    else if (daysSince <= 730) score = 32;
    else                       score = 12;
  } else if (investor.capital_power_score) {
    // Map capital_power_score (roughly 0-5) to a 30-70 baseline
    score = Math.round(Math.min(70, Math.max(30, investor.capital_power_score * 14)));
  } else if (investor.investor_score) {
    // investor_score is 1-5 scale; map to 20-65 baseline
    score = Math.round(Math.min(65, Math.max(20, (investor.investor_score - 1) * 11 + 20)));
  } else {
    // No signals at all — unknown, assign a neutral 35
    score = 35;
  }

  // Boost: capital power indicates a well-resourced, active fund
  if (investor.capital_power_score && investor.capital_power_score >= 3.5) score += 6;
  else if (investor.capital_power_score && investor.capital_power_score >= 2.5) score += 3;

  // Boost: early-stage focus means more deal velocity (more smaller checks)
  const stages = investor.stage || [];
  const earlyStages = ['Seed', 'Pre-seed', 'seed', 'pre_seed', 'pre-seed', 'Angel', 'angel'];
  if (stages.some(s => earlyStages.includes(s))) score += 5;

  // Boost: high investor quality rating
  if (investor.investor_score && investor.investor_score >= 4.7) score += 4;

  // Damp: Growth-only investors do fewer, slower deals
  const onlyGrowth = stages.length > 0 && stages.every(s =>
    ['Growth', 'growth', 'Late-stage', 'late_stage', 'PE'].includes(s)
  );
  if (onlyGrowth) score -= 8;

  return Math.min(100, Math.max(5, Math.round(score)));
}

// ─── Dry powder computation ──────────────────────────────────────────────────
function computeDryPowder(investor) {
  // Prefer reported fund size over check-based estimate
  if (investor.fund_size_estimate_usd) {
    // Assume mid-lifecycle → ~50% deployed
    return Math.round(investor.fund_size_estimate_usd * 0.5);
  }

  if (investor.check_size_max) {
    // Typical VC fund = ~15 deals. At midpoint, half of capital is available.
    const avgCheck = investor.check_size_min
      ? (investor.check_size_min + investor.check_size_max) / 2
      : investor.check_size_max;
    return Math.round(avgCheck * 15 * 0.5);
  }

  return null; // Can't estimate without any sizing data
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n=== Investor Deployment Enrichment${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`);

  // Fetch all investors — we need to compute for everyone
  let query = sb.from('investors').select(
    'id, name, last_investment_date, fund_size_estimate_usd, check_size_min, check_size_max, ' +
    'capital_power_score, investor_score, stage, dry_powder_estimate, deployment_velocity_index'
  );

  if (LIMIT) query = query.limit(LIMIT);
  else query = query.limit(10000); // fetch all

  const { data: investors, error } = await query;
  if (error) { console.error('Fetch error:', error.message); process.exit(1); }

  console.log(`Fetched ${investors.length} investors`);

  let updates = 0;
  let skipped = 0;
  let unchanged = 0;
  const batch = [];

  for (const inv of investors) {
    const velocity = computeVelocity(inv);
    const dryPowder = computeDryPowder(inv);

    const velocityChanged = inv.deployment_velocity_index !== velocity;
    const powderChanged = inv.dry_powder_estimate !== dryPowder;

    if (!velocityChanged && !powderChanged) {
      unchanged++;
      continue;
    }

    const update = { id: inv.id };
    if (velocityChanged) update.deployment_velocity_index = velocity;
    if (dryPowder !== null && powderChanged) update.dry_powder_estimate = dryPowder;

    if (DRY_RUN) {
      console.log(
        `  ${inv.name} → velocity: ${inv.deployment_velocity_index ?? 'null'} → ${velocity}` +
        (dryPowder ? ` | dry_powder: $${(dryPowder / 1e6).toFixed(1)}M` : '')
      );
    }

    batch.push(update);
    updates++;
  }

  console.log(`\nPlanned: ${updates} updates, ${unchanged} unchanged, ${skipped} skipped`);

  if (DRY_RUN || batch.length === 0) {
    console.log(DRY_RUN ? '\n[Dry run — no writes]' : '\nNothing to update.');
    return;
  }

  // Write with concurrent updates (Supabase doesn't support batch update with different values)
  const CONCURRENCY = 25;
  let written = 0;
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    const chunk = batch.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(({ id, ...fields }) =>
        sb.from('investors').update(fields).eq('id', id)
      )
    );
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      console.error(`  ${errors.length} errors in chunk ${i}: ${errors[0].error.message}`);
    }
    written += chunk.length - errors.length;
    process.stdout.write(`\r  Written ${written}/${batch.length}...`);
  }

  console.log(`\n\n✓ Done. Updated ${written} investors.`);

  // Post-run summary
  const { data: summary } = await sb.from('investors').select(
    'deployment_velocity_index, dry_powder_estimate'
  ).limit(5000);

  if (summary) {
    const withVelocity = summary.filter(r => r.deployment_velocity_index !== null).length;
    const withPowder = summary.filter(r => r.dry_powder_estimate !== null).length;
    const avgVelocity = summary
      .filter(r => r.deployment_velocity_index !== null)
      .reduce((sum, r) => sum + r.deployment_velocity_index, 0) / (withVelocity || 1);

    const totalPowder = summary
      .filter(r => r.dry_powder_estimate !== null)
      .reduce((sum, r) => sum + r.dry_powder_estimate, 0);

    console.log(`\n=== Post-run Summary ===`);
    console.log(`deployment_velocity_index: ${withVelocity} investors (avg: ${avgVelocity.toFixed(1)})`);
    console.log(`dry_powder_estimate:       ${withPowder} investors (total pool: $${(totalPowder / 1e9).toFixed(1)}B)`);

    // Velocity tier breakdown
    const hot    = summary.filter(r => (r.deployment_velocity_index || 0) >= 75).length;
    const active = summary.filter(r => (r.deployment_velocity_index || 0) >= 50 && (r.deployment_velocity_index || 0) < 75).length;
    const slow   = summary.filter(r => (r.deployment_velocity_index || 0) < 50 && r.deployment_velocity_index !== null).length;
    console.log(`\nVelocity tiers:`);
    console.log(`  Hot  (75-100): ${hot}`);
    console.log(`  Active (50-74): ${active}`);
    console.log(`  Slow  (<50):   ${slow}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
