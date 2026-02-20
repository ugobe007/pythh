#!/usr/bin/env node
/**
 * Test enrichment with a REAL startup that has recent news
 */

const http = require('http');
const { createClient } = require('@supabase/supabase-js');

(async () => {
  // Use retool.com - recently raised funding, should have lots of news
  const testUrl = 'retool.com';
  
  console.log(`\n🧪 Testing enrichment with REAL startup: ${testUrl}`);
  console.log('This startup has real news coverage, so enrichment SHOULD work\n');
  
  // 1. Check if it already exists
  require('dotenv').config();
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
  
  const { data: existing } = await supabase
    .from('startup_uploads')
    .select('id, name, website')
    .ilike('website', `%${testUrl}%`)
    .limit(1);
  
  if (existing && existing.length > 0) {
    console.log(`⚠️  ${testUrl} already exists in database`);
    console.log(`   Deleting it to test fresh enrichment...\n`);
    
    // Delete old matches first
    await supabase.from('startup_investor_matches').delete().eq('startup_id', existing[0].id);
    // Delete startup
    await supabase.from('startup_uploads').delete().eq('id', existing[0].id);
  }
  
  // 2. Submit
  console.log(`📤 Submitting ${testUrl} with force_generate=true...`);
  
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
  
  if (!result.startup_id) {
    console.log('❌ No startup_id in response');
    process.exit(1);
  }
  
  console.log(`✅ Submitted: ${result.startup_id}\n`);
  
  // 3. Wait for enrichment
  console.log('⏳ Waiting 20 seconds for enrichment pipeline...\n');
  await new Promise(r => setTimeout(r, 20000));
  
  // 4. Check results
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('*')
    .eq('id', result.startup_id)
    .single();
  
  if (!startup) {
    console.log('❌ Startup not found!');
    process.exit(1);
  }
  
  console.log('📊 ENRICHMENT RESULTS:');
  console.log(`   Name: ${startup.name}`);
  console.log(`   Sectors: ${JSON.stringify(startup.sectors || [])}`);
  console.log(`   GOD Score: ${startup.total_god_score || 'N/A'}`);
  console.log(`   Description: ${startup.description ? startup.description.substring(0, 100) + '...' : 'NONE'}`);
  
  if (startup.extracted_data) {
    console.log(`\n📦 extracted_data (${Object.keys(startup.extracted_data).length} fields):`);
    const keys = Object.keys(startup.extracted_data);
    keys.forEach(k => {
      const val = startup.extracted_data[k];
      const display = typeof val === 'string' ? val.substring(0, 60) : JSON.stringify(val);
      console.log(`     - ${k}: ${display}`);
    });
  }
  
  // Assessment
  const hasMultipleSectors = startup.sectors && startup.sectors.length > 1;
  const hasRichData = startup.extracted_data && Object.keys(startup.extracted_data).length > 8;
  const hasDescription = startup.description && startup.description.length > 100;
  
  console.log('\n✨ ENRICHMENT QUALITY:');
  console.log(`   Multiple sectors: ${hasMultipleSectors ? '✅' : '❌'} (${startup.sectors?.length || 0})`);
  console.log(`   Rich data: ${hasRichData ? '✅' : '❌'} (${startup.extracted_data ? Object.keys(startup.extracted_data).length : 0} fields)`);
  console.log(`   Has description: ${hasDescription ? '✅' : '❌'} (${startup.description?.length || 0} chars)`);
  
  // Check matches
  const { count } = await supabase
    .from('startup_investor_matches')
    .select('*', { count: 'exact', head: true })
    .eq('startup_id', result.startup_id);
  
  console.log(`\n📈 Matches: ${count || 0}`);
  
  if (hasMultipleSectors || hasRichData || hasDescription) {
    console.log('\n🎉 SUCCESS: News enrichment IS working!');
  } else {
    console.log('\n⚠️  News enrichment did NOT add significant data');
    console.log('   Sectors still default "Technology"');
    console.log('   → Enrichment phase may have a bug or timeout');
  }
  
  process.exit(0);
})().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
