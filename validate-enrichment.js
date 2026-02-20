#!/usr/bin/env node
/**
 * Direct test - submit URL, wait, check database for enrichment results
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

// SIMPLEST POSSIBLE APPROACH: Just check the database after submission
(async () => {
  console.log('\n���� ENRICHMENT VALIDATION TEST');
  console.log('='.repeat(50));
  
  // 1. Submit a truly unique URL
  const testUrl = `enrichment-validation-${Date.now()}.com`;
  console.log(`\n1. Submitting: ${testUrl}`);
  
  const postData = JSON.stringify({ url: testUrl, force_generate: true });
  
  const startupId = await new Promise((resolve, reject) => {
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
          const result = JSON.parse(data);
          if (result.startup_id) {
            console.log(`✅ Startup created: ${result.startup_id}`);
            resolve(result.startup_id);
          } else {
            reject(new Error('No startup_id in response'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
  
  // 2. Wait for enrichment pipeline (should run in ~10s)
  console.log('\n2. Waiting 15 seconds for enrichment pipeline...');
  await new Promise(r => setTimeout(r, 15000));
  
  // 3. Query database for enriched data
  console.log('\n3. Checking database for enrichment...');
  
  require('dotenv').config();
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', startupId)
    .single();
  
  if (!startup) {
    console.log('❌ Startup not found in database!');
    process.exit(1);
  }
  
  console.log('\n📊 ENRICHMENT RESULTS:');
  console.log(`   Name: ${startup.name}`);
  console.log(`   Sectors: ${JSON.stringify(startup.sectors || [])}`);
  console.log(`   GOD Score: ${startup.total_god_score || 'N/A'}`);
  console.log(`   Description: ${startup.description ? startup.description.substring(0, 80) + '...' : 'NONE'}`);
  console.log(`   extracted_data: ${startup.extracted_data ? Object.keys(startup.extracted_data).length + ' fields' : 'NONE'}`);
  
  // Check if enrichment actually happened
  const hasRichData = startup.extracted_data && Object.keys(startup.extracted_data).length > 5;
  const hasDescription = startup.description && startup.description.length > 50;
  const hasMultipleSectors = startup.sectors && startup.sectors.length > 1;
  
  console.log('\n✨ ENRICHMENT ASSESSMENT:');
  console.log(`   Rich extracted_data: ${hasRichData ? '✅' : '❌'} (${startup.extracted_data ? Object.keys(startup.extracted_data).length : 0} fields)`);
  console.log(`   Has description: ${hasDescription ? '✅' : '❌'} (${startup.description ? startup.description.length : 0} chars)`);
  console.log(`   Multiple sectors: ${hasMultipleSectors ? '✅' : '❌'} (${startup.sectors ? startup.sectors.length : 0} sectors)`);
  
  if (hasRichData || hasDescription || hasMultipleSectors) {
    console.log('\n🎉 SUCCESS: Enrichment pipeline DID run and added data!');
  } else {
    console.log('\n⚠️  WARNING: Startup has minimal data - enrichment may not have run');
    console.log('   (Or the test domain had no news coverage)');
  }
  
  // 4. Check match generation
  const { data: matches, count } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', startupId);
  
  console.log(`\n📈 MATCHES: ${count || 0} generated`);
  
  if ((count || 0) > 0) {
    console.log('✅ Matching pipeline completed');
  } else {
    console.log('❌ No matches generated - pipeline may have failed');
  }
  
  console.log('\n' + '='.repeat(50));
  process.exit(0);
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
