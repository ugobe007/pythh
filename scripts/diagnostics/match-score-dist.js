#!/usr/bin/env node
/**
 * Match score distribution analysis - check if match_score=100 is universal
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Get distribution of match scores
  const { data: sample } = await sb.from('startup_investor_matches')
    .select('match_score')
    .order('created_at', { ascending: false })
    .limit(5000);
  
  if (!sample) return console.log('No data');
  
  const scores = sample.map(m => m.match_score).filter(s => s != null);
  const dist = {};
  for (const s of scores) {
    const bucket = Math.floor(s / 10) * 10;
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  
  console.log('Match score distribution (recent 5000):');
  for (let b = 0; b <= 100; b += 10) {
    const count = dist[b] || 0;
    const pct = (count / scores.length * 100).toFixed(1);
    const bar = '#'.repeat(Math.round(count / scores.length * 50));
    console.log(`  ${b.toString().padStart(3)}-${(b+9).toString().padStart(3)}  ${count.toString().padStart(5)} (${pct}%) ${bar}`);
  }
  
  // Count exact 100s
  const exact100 = scores.filter(s => s === 100).length;
  console.log(`\nExact 100: ${exact100} / ${scores.length} (${(exact100 / scores.length * 100).toFixed(1)}%)`);
  
  // Check a few non-100 scores
  const non100 = scores.filter(s => s < 100);
  if (non100.length > 0) {
    non100.sort((a, b) => a - b);
    console.log(`Non-100 scores: min=${non100[0]}, median=${non100[Math.floor(non100.length / 2)]}, max=${non100[non100.length - 1]}`);
  }
  
  // Look at full distribution
  const { count: total100 } = await sb.from('startup_investor_matches')
    .select('id', { count: 'exact', head: true })
    .eq('match_score', 100);
  const { count: totalAll } = await sb.from('startup_investor_matches')
    .select('id', { count: 'exact', head: true });
  console.log(`\nAll matches: ${totalAll}`);
  console.log(`Matches = 100: ${total100} (${(total100/totalAll*100).toFixed(1)}%)`);
  
  const { count: below50 } = await sb.from('startup_investor_matches')
    .select('id', { count: 'exact', head: true })
    .lt('match_score', 50);
  console.log(`Matches < 50: ${below50}`);
}

main().catch(console.error);
