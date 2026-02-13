#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

  const { data: discoveries, error } = await supabase
    .from('discovered_startups')
    .select('id, name, source, created_at')
    .gte('created_at', todayStart)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('📊 Startups discovered today (Feb 12, 2026):');
  console.log('Total:', discoveries.length);
  console.log('');
  
  if (discoveries.length > 0) {
    console.log('Recent discoveries:');
    discoveries.slice(0, 10).forEach((s, i) => {
      const time = new Date(s.created_at).toLocaleTimeString();
      console.log(`${i+1}. ${s.name} - ${s.source} (${time})`);
    });
    if (discoveries.length > 10) {
      console.log(`... and ${discoveries.length - 10} more`);
    }
  } else {
    console.log('No new startups discovered today yet.');
  }
})();
