#!/usr/bin/env node
/**
 * Prune startup_investor_matches to top-50 per startup.
 * Uses the server-side prune_one_startup() SQL function for speed.
 * Calls supabase.rpc() per startup — each call takes <1s.
 */
require('dotenv').config();
const { supabase } = require('../server/lib/supabaseClient');

const TOP_N = 50;
const CONCURRENCY = 8; // parallel RPC calls (reduced from 15 to avoid rate limits)
const MAX_RETRIES = 3;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function pruneWithRetry(sid) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { data, error } = await supabase.rpc('prune_one_startup', {
      p_startup_id: sid,
      p_top_n: TOP_N
    });
    if (!error) return { sid, deleted: data || 0 };
    if (attempt < MAX_RETRIES) await sleep(500 * attempt); // backoff
  }
  return { sid, error: 'max retries', deleted: 0 };
}

async function pruneMatches() {
  console.log(`\n🔪 PRUNING matches to top-${TOP_N} per startup (concurrency=${CONCURRENCY}, retries=${MAX_RETRIES})\n`);
  
  // Get all startup IDs
  let startupIds = [];
  let offset = 0;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id')
      .order('id')
      .range(offset, offset + 999);
    
    if (error || !data || data.length === 0) break;
    startupIds = startupIds.concat(data.map(d => d.id));
    if (data.length < 1000) break;
    offset += 1000;
  }
  
  console.log(`   Found ${startupIds.length} startup IDs to check\n`);
  
  // Step 2: Call prune_one_startup for each startup  
  let processed = 0;
  let pruned = 0;
  let skipped = 0;
  let errors = 0;
  const startTime = Date.now();
  
  // Process in parallel batches for speed
  for (let i = 0; i < startupIds.length; i += CONCURRENCY) {
    const batch = startupIds.slice(i, i + CONCURRENCY);
    
    const results = await Promise.allSettled(
      batch.map(sid => pruneWithRetry(sid))
    );
    
    for (const r of results) {
      processed++;
      if (r.status === 'fulfilled') {
        if (r.value.error) {
          errors++;
        } else if (r.value.deleted > 0) {
          pruned++;
        } else {
          skipped++;
        }
      } else {
        errors++;
      }
    }
    
    if (processed % 200 === 0 || processed === startupIds.length) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rate = (processed / (parseFloat(elapsed) || 1)).toFixed(1);
      const eta = ((startupIds.length - processed) / (parseFloat(rate) || 1)).toFixed(0);
      console.log(`   ${processed}/${startupIds.length} | Pruned: ${pruned} | Skipped: ${skipped} | Errors: ${errors} | ${rate}/s | ETA: ${eta}s`);
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  
  // Step 3: Verify
  const { data: countData } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true });
  
  console.log('\n' + '═'.repeat(50));
  console.log('✅ PRUNE COMPLETE');
  console.log('═'.repeat(50));
  console.log(`   Startups checked: ${processed}`);
  console.log(`   Startups pruned: ${pruned}`);
  console.log(`   Already ≤${TOP_N}: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Time: ${elapsed}s`);
  console.log('═'.repeat(50));
  console.log('\n💡 Now run in Supabase SQL Editor:');
  console.log('   VACUUM FULL startup_investor_matches;');
  console.log('   (This reclaims disk space from deleted rows)\n');
}

pruneMatches().then(() => process.exit(0)).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
