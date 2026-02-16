#!/usr/bin/env node
/**
 * TEST DATABASE SCHEMA FIX
 * Quick validation that discovered_startups saves work correctly
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testSave() {
  console.log('🧪 Testing discovered_startups schema fix...\n');

  const timestamp = Date.now();
  const testStartup = {
    name: `Test Startup ${timestamp}`,
    description: 'Test description for schema validation',
    website: `https://test-${timestamp}.com`,  // Unique URL
    article_url: `https://test-${timestamp}.com/source`,
    rss_source: 'test',
    discovered_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  console.log('Attempting to save:', testStartup.name);
  
  const { data, error } = await supabase
    .from('discovered_startups')
    .insert(testStartup)
    .select();

  if (error) {
    console.error('❌ FAILED:', error.message);
    console.error('Error details:', error);
    process.exit(1);
  }

  console.log('✅ SUCCESS! Saved with ID:', data[0]?.id);
  console.log('\n📊 Saved data:', data[0]);
  
  // Cleanup: delete test record
  await supabase
    .from('discovered_startups')
    .delete()
    .eq('id', data[0].id);
  
  console.log('\n🧹 Cleaned up test record');
  console.log('\n✅✅✅ Schema fix verified! Scraper should now work correctly.');
}

testSave()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
