#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debug() {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
    .eq('status', 'approved')
    .eq('total_god_score', 100)
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n🔍 Startups with GOD score = 100:\n');
  data.forEach(s => {
    console.log(`${s.name}:`);
    console.log(`  Total: ${s.total_god_score}`);
    console.log(`  Team: ${s.team_score} | Traction: ${s.traction_score} | Market: ${s.market_score} | Product: ${s.product_score} | Vision: ${s.vision_score}`);
    console.log('');
  });

  console.log(`\nTotal startups with 100 score: ${data.length}`);
}

debug();
