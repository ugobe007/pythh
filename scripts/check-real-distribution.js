#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkRealDistribution() {
  console.log('\n🔍 CHECKING REAL GOD SCORE DISTRIBUTION...\n');
  
  // Fetch ALL approved startups with pagination
  let allStartups = [];
  let page = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('total_god_score, team_score, traction_score, market_score, product_score, vision_score')
      .eq('status', 'approved')
      .range(page * pageSize, ((page + 1) * pageSize) - 1);
    
    if (error) {
      console.error('Error:', error);
      break;
    }
    
    if (!data || data.length === 0) break;
    
    allStartups = allStartups.concat(data);
    console.log(`  Fetched page ${page + 1}: ${data.length} startups (total: ${allStartups.length})`);
    
    if (data.length < pageSize) break;
    page++;
  }
  
  console.log(`\n📊 COMPLETE DISTRIBUTION (${allStartups.length} total startups):\n`);
  
  // Calculate distribution
  const dist = {};
  for (const st of allStartups) {
    const bucket = Math.floor(st.total_god_score / 10) * 10;
    dist[bucket] = (dist[bucket] || 0) + 1;
  }
  
  // Show distribution
  const buckets = Object.keys(dist).map(k => parseInt(k)).sort((a, b) => b - a);
  for (const bucket of buckets) {
    const count = dist[bucket];
    const pct = ((count / allStartups.length) * 100).toFixed(1);
    console.log(`  ${bucket}-${bucket + 9}: ${count} (${pct}%)`);
  }
  
  // Calculate stats
  const avg = allStartups.reduce((sum, st) => sum + st.total_god_score, 0) / allStartups.length;
  const scores = allStartups.map(st => st.total_god_score).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)];
  const min = scores[0];
  const max = scores[scores.length - 1];
  
  console.log('\n📈 STATISTICS:');
  console.log(`  Average: ${avg.toFixed(1)}`);
  console.log(`  Median: ${median}`);
  console.log(`  Min: ${min}`);
  console.log(`  Max: ${max}`);
  console.log(`  Range: ${max - min}`);
  
  // Check component scores
  const avgTeam = allStartups.reduce((sum, st) => sum + (st.team_score || 0), 0) / allStartups.length;
  const avgTraction = allStartups.reduce((sum, st) => sum + (st.traction_score || 0), 0) / allStartups.length;
  const avgMarket = allStartups.reduce((sum, st) => sum + (st.market_score || 0), 0) / allStartups.length;
  const avgProduct = allStartups.reduce((sum, st) => sum + (st.product_score || 0), 0) / allStartups.length;
  const avgVision = allStartups.reduce((sum, st) => sum + (st.vision_score || 0), 0) / allStartups.length;
  
  console.log('\n📊 COMPONENT SCORE AVERAGES:');
  console.log(`  Team: ${avgTeam.toFixed(1)} / 20`);
  console.log(`  Traction: ${avgTraction.toFixed(1)} / 20`);
  console.log(`  Market: ${avgMarket.toFixed(1)} / 20`);
  console.log(`  Product: ${avgProduct.toFixed(1)} / 20`);
  console.log(`  Vision: ${avgVision.toFixed(1)} / 20`);
  console.log(`  Total: ${(avgTeam + avgTraction + avgMarket + avgProduct + avgVision).toFixed(1)} / 100`);
  
  console.log('\n');
}

checkRealDistribution().catch(console.error);
