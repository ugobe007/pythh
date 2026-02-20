#!/usr/bin/env node
/**
 * Test inference enrichment with a NEW startup
 */

const http = require('http');

// Pick a real startup that's likely not in the database yet
const testUrl = 'ramp.com'; // Ramp - corporate cards startup

console.log('🧪 Testing News-Based Enrichment\n');
console.log(`📍 Submitting NEW startup: ${testUrl}`);
console.log('⏳ This will trigger full enrichment pipeline...\n');
console.log('Expected flow:');
console.log('  1. Scrape website');
console.log('  2. Pattern matching');
console.log('  3. 🆕 NEWS SEARCH (Google News RSS)');
console.log('  4. Extract funding/sectors/traction');
console.log('  5. Calculate GOD score');
console.log('  6. Generate matches\n');

const postData = JSON.stringify({ url: testUrl });

const options = {
  hostname: 'localhost',
  port: 3002,
  path: '/api/instant/submit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const startTime = Date.now();

const req = http.request(options, (res) => {
  console.log(`\n✅ Response status: ${res.statusCode}`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Total time: ${elapsed}ms\n`);
    
    try {
      const result = JSON.parse(data);
      
      if (result.startup) {
        console.log('✅ STARTUP ENRICHED:');
        console.log(`   Name: ${result.startup.name}`);
        console.log(`   Sectors: ${(result.startup.sectors || []).join(', ')}`);
        console.log(`   GOD Score: ${result.startup.total_god_score}`);
        console.log(`   Stage: ${result.startup.stage}`);
        
        if (result.matches && result.matches.length > 0) {
          console.log(`\n🤝 Generated ${result.matches.length} matches`);
          console.log(`   Top match: ${result.matches[0].investors.name} (${result.matches[0].match_score})`);
        }
        
        console.log('\n📝 Check server logs for "News enrichment" messages!');
      } else {
        console.log('Response:', JSON.stringify(result, null, 2));
      }
    } catch (e) {
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(postData);
req.end();
