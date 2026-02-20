#!/usr/bin/env node
/**
 * Force news enrichment by using a startup with MINIMAL website
 * but known news coverage
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

(async () => {
  // Anthropic.com - AI company with known news but potentially sparse website
  const testUrl = 'anthropic.com';
  
  console.log(`\n🧪 Testing NEWS enrichment with: ${testUrl}`);
  console.log('Goal: Force Tier C to trigger news search\n');
  
  require('dotenv').config();
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  // Clean existing
  const { data: existing } = await supabase
    .from('startup_uploads')
    .select('id')
    .ilike('website', `%${testUrl}%`)
    .limit(1);
  
  if (existing && existing.length > 0) {
    await supabase.from('startup_investor_matches').delete().eq('startup_id', existing[0].id);
    await supabase.from('startup_uploads').delete().eq('id', existing[0].id);
  }
  
  // Submit
  const postData = JSON.stringify({ url: testUrl, force_generate: true });
  
  const result = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 3002,
      path: '/api/instant/submit',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  
  console.log(`✅ Submitted: ${result.startup_id}\n`);
  console.log('⏳ Waiting 25 seconds for full enrichment pipeline...\n');
  await new Promise(r => setTimeout(r, 25000));
  
  // Check results
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', result.startup_id)
    .single();
  
  console.log('📊 RESULTS:');
  console.log(`   Name: ${startup.name}`);
  console.log(`   Sectors: ${JSON.stringify(startup.sectors || [])}`);
  console.log(`   GOD Score: ${startup.total_god_score}`);
  console.log(`   Data Tier: ${startup.extracted_data?.data_tier || 'unknown'}`);
  console.log(`   Enrichment Method: ${startup.extracted_data?.enrichment_method || 'unknown'}`);
  
  console.log(`\n📦 extracted_data: ${startup.extracted_data ? Object.keys(startup.extracted_data).length : 0} fields`);
  
  // Check if news enrichment artifacts are present
  const hasNewsIndicators = startup.extracted_data && (
    startup.extracted_data.news_enrichment ||
    startup.extracted_data.enrichment_method?.includes('news') ||
    startup.extracted_data.funding_amount > 0 ||
    (startup.sectors && startup.sectors.length > 2)
  );
  
  console.log(`\n🔍 NEWS ENRICHMENT CHECK:`);
  console.log(`   Data tier: ${startup.extracted_data?.data_tier}${startup.extracted_data?.data_tier === 'C' ? ' ← Would trigger news!' : ''}`);
  console.log(`   Enrichment method: ${startup.extracted_data?.enrichment_method}`);
  console.log(`   Funding found: ${startup.extracted_data?.funding_amount ? '$' + (startup.extracted_data.funding_amount / 1000000) + 'M' : 'No'}`);
  console.log(`   Sectors count: ${startup.sectors?.length || 0}`);
  
  if (startup.sectors && startup.sectors.length > 1 && startup.sectors[0] !== 'Technology') {
    console.log('\n✅ SUCCESS: Multiple specific sectors found - enrichment worked!');
  } else if (startup.extracted_data?.data_tier === 'B' || startup.extracted_data?.data_tier === 'A') {
    console.log('\n✅ Website had rich data (Tier A/B) - news enrichment correctly skipped');
  } else {
    console.log('\n⚠️  Still investigating why news enrichment may not have triggered');
  }
  
  process.exit(0);
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
