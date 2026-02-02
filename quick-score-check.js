#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function check() {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score')
    .eq('status', 'approved')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 Last 20 updated startups:');
  data.forEach(s => {
    console.log(`  ${s.name}: ${s.total_god_score}`);
  });

  const scores = data.map(s => s.total_god_score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log(`\n📊 Average of last 20: ${avg.toFixed(2)}`);
}

check();
