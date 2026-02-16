#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  // Sample gaming-tagged startups across score ranges
  const { data: low } = await sb.from('startup_uploads')
    .select('name, sectors, total_god_score, description')
    .eq('status', 'approved')
    .contains('sectors', ['Gaming'])
    .lte('total_god_score', 42)
    .order('total_god_score', { ascending: true })
    .limit(20);

  const { data: mid } = await sb.from('startup_uploads')
    .select('name, sectors, total_god_score, description')
    .eq('status', 'approved')
    .contains('sectors', ['Gaming'])
    .gte('total_god_score', 45)
    .lte('total_god_score', 55)
    .order('total_god_score', { ascending: false })
    .limit(10);

  console.log('GAMING-TAGGED SAMPLES (low scores):');
  (low || []).forEach(s => {
    console.log('  GOD ' + s.total_god_score + ' | ' + s.name);
    console.log('    sectors: ' + JSON.stringify(s.sectors));
    console.log('    desc: ' + (s.description || '').substring(0, 120));
    console.log();
  });

  console.log('\nGAMING-TAGGED SAMPLES (mid scores):');
  (mid || []).forEach(s => {
    console.log('  GOD ' + s.total_god_score + ' | ' + s.name);
    console.log('    sectors: ' + JSON.stringify(s.sectors));
    console.log('    desc: ' + (s.description || '').substring(0, 120));
    console.log();
  });

  // Check if 'Gaming' is in sectors or some other field
  const { data: onlyGaming } = await sb.from('startup_uploads')
    .select('name, sectors, industries, total_god_score')
    .eq('status', 'approved')
    .contains('sectors', ['Gaming'])
    .limit(5);
  
  console.log('\nSECTOR vs INDUSTRIES fields:');
  (onlyGaming || []).forEach(s => {
    console.log('  ' + s.name + ' | sectors: ' + JSON.stringify(s.sectors) + ' | industries: ' + JSON.stringify(s.industries));
  });
}
main().catch(console.error);
