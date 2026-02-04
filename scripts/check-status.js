#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkStatus() {
  const { count: discCount } = await supabase.from('discovered_startups').select('*', { count: 'exact', head: true });
  const { count: upCount } = await supabase.from('startup_uploads').select('*', { count: 'exact', head: true });
  const { count: invCount } = await supabase.from('investors').select('*', { count: 'exact', head: true });
  const { count: matchCount } = await supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  
  console.log('\n📊 DATABASE STATUS:');
  console.log('  discovered_startups:', discCount);
  console.log('  startup_uploads:', upCount);
  console.log('  investors:', invCount);
  console.log('  matches:', matchCount);
  
  // Get latest discoveries
  console.log('\n📰 RECENT DISCOVERIES:');
  const { data: recent } = await supabase
    .from('discovered_startups')
    .select('name, source, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  for (const d of recent || []) {
    const date = new Date(d.created_at).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' });
    console.log(`  ${d.name.padEnd(40).slice(0, 40)} ${date}`);
  }
}

checkStatus().catch(console.error);
