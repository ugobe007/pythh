#!/usr/bin/env node

/**
 * Helper script to pick real startups from the database
 * to use in the GOD golden set.
 *
 * Run locally:
 *   node scripts/choose-golden-startups.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

async function main() {
  console.log('🔍 Selecting candidate startups for GOD golden set...');

  // 1. Elite: high score, approved, recent
  const { data: elite, error: eliteError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(5);

  if (eliteError) {
    console.error('Error fetching elite candidates:', eliteError.message || eliteError);
    process.exit(1);
  }

  // 2. Mid-band: around 70
  const { data: mid, error: midError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .gte('total_god_score', 65)
    .lte('total_god_score', 75)
    .order('total_god_score', { ascending: false })
    .limit(5);

  if (midError) {
    console.error('Error fetching mid-band candidates:', midError.message || midError);
    process.exit(1);
  }

  // 3. Low quality: around 45–50 but still approved
  const { data: low, error: lowError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .gte('total_god_score', 40)
    .lte('total_god_score', 50)
    .order('total_god_score', { ascending: true })
    .limit(5);

  if (lowError) {
    console.error('Error fetching low-band candidates:', lowError.message || lowError);
    process.exit(1);
  }

  console.log('\n=== Elite candidates (target 85–95) ===');
  (elite || []).forEach((s) => {
    console.log(`id=${s.id}  score=${s.total_god_score}  name=${s.name}`);
  });

  console.log('\n=== Mid-band candidates (target 65–75) ===');
  (mid || []).forEach((s) => {
    console.log(`id=${s.id}  score=${s.total_god_score}  name=${s.name}`);
  });

  console.log('\n=== Low-band candidates (target 40–50) ===');
  (low || []).forEach((s) => {
    console.log(`id=${s.id}  score=${s.total_god_score}  name=${s.name}`);
  });

  console.log('\n👉 Pick one from each list and update golden/god_golden_set.json with:');
  console.log('   - startup_id: chosen id');
  console.log('   - name: chosen name');
  console.log('   - min_total / max_total: a small band around the current score');
}

main().catch((err) => {
  console.error('Unexpected error:', err?.message || err);
  process.exit(1);
});
