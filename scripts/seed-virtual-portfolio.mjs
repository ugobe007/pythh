#!/usr/bin/env node
/**
 * Seed Virtual Portfolio
 * Auto-populates virtual_portfolio with all approved startups GOD ≥ 70.
 *
 * Usage:
 *   node scripts/seed-virtual-portfolio.mjs
 *   node scripts/seed-virtual-portfolio.mjs --threshold=80
 *   node scripts/seed-virtual-portfolio.mjs --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Load .env manually (no dotenv dependency needed)
try {
  const env = readFileSync(join(__dir, '../.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* .env not present — rely on existing env */ }

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌  Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------------------------------------------------------------
// Stage → estimated valuation
// ---------------------------------------------------------------------------
// 2025 market benchmarks (YC standard: pre-seed ~$20M post, seed ~$30-50M, etc.)
function estimateValuation(stage, godScore) {
  const bases = {
    'Stage 1': 15_000_000, '1': 15_000_000, 'Pre-Seed': 15_000_000, 'pre-seed': 15_000_000,
    'Stage 2': 35_000_000, '2': 35_000_000, 'Seed': 35_000_000, 'seed': 35_000_000,
    'Stage 3': 80_000_000, '3': 80_000_000, 'Series A': 80_000_000,
    'Stage 4': 250_000_000, '4': 250_000_000, 'Series B': 250_000_000, 'Series B+': 250_000_000,
  };
  const base = bases[String(stage || '').trim()] ?? 15_000_000; // null stage → $15M pre-seed floor
  const premium = Math.max(0.8, (godScore || 70) / 70);
  return Math.round(base * premium);
}

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

const GOD_THRESHOLD = parseInt(args.threshold ?? '70', 10);
const DRY_RUN = args['dry-run'] === true || args['dry-run'] === 'true';

console.log(`\n🌱  Virtual Portfolio Seeder`);
console.log(`   GOD threshold : ≥${GOD_THRESHOLD}`);
console.log(`   Dry run       : ${DRY_RUN}`);
console.log('');

// ---------------------------------------------------------------------------
// Fetch eligible startups
// ---------------------------------------------------------------------------
const { data: startups, error: startupErr } = await supabase
  .from('startup_uploads')
  .select('id, name, stage, total_god_score, valuation_usd, created_at')
  .eq('status', 'approved')
  .gte('total_god_score', GOD_THRESHOLD)
  .order('total_god_score', { ascending: false });

if (startupErr) {
  console.error('❌  Failed to fetch startups:', startupErr.message);
  process.exit(1);
}

console.log(`✅  Found ${startups.length} eligible startups (GOD ≥ ${GOD_THRESHOLD})`);

// ---------------------------------------------------------------------------
// Get existing portfolio entries to skip
// ---------------------------------------------------------------------------
const { data: existing } = await supabase
  .from('virtual_portfolio')
  .select('startup_id')
  .eq('status', 'active');

const existingIds = new Set((existing ?? []).map((e) => e.startup_id));
console.log(`   Already in portfolio: ${existingIds.size}`);

// ---------------------------------------------------------------------------
// Batch upsert
// ---------------------------------------------------------------------------
const toInsert = startups.filter((s) => !existingIds.has(s.id));
console.log(`   To add: ${toInsert.length}\n`);

if (DRY_RUN) {
  for (const su of toInsert) {
    const val = estimateValuation(su.stage, su.total_god_score);
    console.log(`  [DRY] ${su.name.padEnd(45)} GOD=${su.total_god_score}  val=$${(val / 1_000_000).toFixed(1)}M`);
  }
  console.log('\n🔍  Dry run complete — no changes made.\n');
  process.exit(0);
}

let added = 0;
let failed = 0;

for (const su of toInsert) {
  const godScore = su.total_god_score ?? GOD_THRESHOLD;
  const entryValuation = su.valuation_usd || estimateValuation(su.stage, godScore);

  const { error } = await supabase.from('virtual_portfolio').insert({
    startup_id: su.id,
    entry_date: su.created_at ?? new Date().toISOString(),
    entry_stage: su.stage ?? null,
    entry_god_score: godScore,
    entry_valuation_usd: entryValuation,
    entry_rationale: `Auto-seeded: GOD score ${godScore} ≥ ${GOD_THRESHOLD} threshold`,
    virtual_check_usd: 100_000,
    current_valuation_usd: entryValuation,
    moic: 1.0,
    added_by: 'auto-seed',
  });

  if (error) {
    // Likely a unique constraint violation (already exists)
    if (error.code === '23505') {
      console.log(`  ⏭  ${su.name} — already exists (skipped)`);
    } else {
      console.warn(`  ⚠  ${su.name}: ${error.message}`);
      failed++;
    }
  } else {
    console.log(`  ✅  ${su.name.padEnd(45)} GOD=${godScore}  val=$${(entryValuation / 1_000_000).toFixed(1)}M`);
    added++;
  }
}

console.log(`\n🎉  Done — added ${added}, failed ${failed}\n`);
