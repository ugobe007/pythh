#!/usr/bin/env node
require('dotenv').config();
const sb = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Get ALL sectors across ALL startups to see exact values
  let all = [];
  let page = 0;
  while (true) {
    const { data } = await sb.from('startup_uploads')
      .select('sectors')
      .eq('status', 'approved')
      .range(page * 1000, (page + 1) * 1000 - 1);
    all = all.concat(data || []);
    if (!data || data.length < 1000) break;
    page++;
  }

  const sectorCounts = {};
  all.forEach(s => {
    (s.sectors || []).forEach(sec => {
      sectorCounts[sec] = (sectorCounts[sec] || 0) + 1;
    });
  });

  // Find gaming-related sectors
  const gamingRelated = Object.entries(sectorCounts)
    .filter(([k]) => k.toLowerCase().includes('gam'))
    .sort((a, b) => b[1] - a[1]);
  
  console.log('Gaming-related sector values:');
  gamingRelated.forEach(([k, v]) => console.log('  "' + k + '": ' + v));

  // Also show all unique sector values
  console.log('\nAll sectors (by count):');
  Object.entries(sectorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .forEach(([k, v]) => console.log('  "' + k + '": ' + v));

  // Test contains query with exact value
  if (gamingRelated.length > 0) {
    const exactVal = gamingRelated[0][0];
    console.log('\nTrying contains with exact value: "' + exactVal + '"');
    const { data: test, count } = await sb.from('startup_uploads')
      .select('id', { count: 'exact' })
      .eq('status', 'approved')
      .contains('sectors', [exactVal])
      .limit(3);
    console.log('Result count: ' + (count || (test ? test.length : 0)));
  }
}
main().catch(console.error);
