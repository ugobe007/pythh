#!/usr/bin/env node
/**
 * Quick script to add a startup by URL
 * Usage: node quick-add-startup.js https://asidehq.com
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.argv[2];
if (!url) {
  console.error('Usage: node quick-add-startup.js <url>');
  process.exit(1);
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function addStartup(inputUrl) {
  // Normalize URL
  let normalized = inputUrl.trim();
  if (!normalized.startsWith('http')) {
    normalized = `https://${normalized}`;
  }
  
  const domain = new URL(normalized).hostname.replace(/^www\./, '');
  const name = domain.split('.')[0];
  
  console.log(`Adding startup: ${name} (${domain})`);
  
  // Insert into startup_uploads
  const { data, error } = await supabase
    .from('startup_uploads')
    .insert({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      website: normalized,
      status: 'approved',
      source_type: 'manual',
      sectors: ['Technology'], // Default sector
      total_god_score: 50, // Neutral score until AI scores it
      team_score: 50,
      traction_score: 50,
      market_score: 50,
      product_score: 50,
      vision_score: 50
    })
    .select()
    .single();
  
  if (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
  
  console.log('✅ Added startup:', data.id);
  console.log('   Name:', data.name);
  console.log('   Website:', data.website);
  console.log('   GOD Score:', data.total_god_score);
  
  // Check if it was auto-queued
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const { data: queue } = await supabase
    .from('match_generation_queue')
    .select('status, priority')
    .eq('startup_id', data.id)
    .single();
  
  if (queue) {
    console.log('✅ Auto-queued for matching');
    console.log('   Status:', queue.status);
    console.log('   Priority:', queue.priority);
  } else {
    console.log('⚠️  Not queued - manually queue it:');
    console.log(`   SELECT manually_queue_startup('${data.id}', 300);`);
  }
  
  return data;
}

addStartup(url)
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
