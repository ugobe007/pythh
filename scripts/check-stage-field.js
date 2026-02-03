#!/usr/bin/env node
/**
 * Check stage field in startup_uploads
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkStages() {
  // Check stage field types
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('id, name, stage')
    .eq('status', 'approved')
    .limit(20);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 Stage field samples:');
  data.forEach(s => {
    console.log(`   ${s.name}: ${JSON.stringify(s.stage)} (type: ${typeof s.stage})`);
  });

  // Count by stage
  const { data: all, error: err2 } = await supabase
    .from('startup_uploads')
    .select('stage')
    .eq('status', 'approved');

  if (!err2) {
    const counts = {};
    all.forEach(s => {
      const key = JSON.stringify(s.stage);
      counts[key] = (counts[key] || 0) + 1;
    });
    console.log('\n📈 Stage distribution:');
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([stage, count]) => {
        console.log(`   ${stage}: ${count}`);
      });
  }

  // Check investor stages
  const { data: investors } = await supabase
    .from('investors')
    .select('name, stage')
    .limit(10);

  console.log('\n💼 Investor stage samples:');
  investors.forEach(inv => {
    console.log(`   ${inv.name}: ${JSON.stringify(inv.stage)} (type: ${typeof inv.stage})`);
  });
}

checkStages().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
