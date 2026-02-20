#!/usr/bin/env node
/**
 * Test with a BRAND NEW startup to trigger enrichment
 */

const http = require('http');

// Use a less common startup that's unlikely to be in DB
const testUrl = 'attio.com'; // Attio - CRM startup

console.log('🧪 Testing News Enrichment - NEW STARTUP\n');
console.log(`📍 Testing: ${testUrl}`);
console.log('⏳ Should trigger news search...\n');

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
        console.log('✅ STARTUP CREATED:');
        console.log(`   Name: ${result.startup.name}`);
        console.log(`   Sectors: ${(result.startup.sectors || []).join(', ')}`);
        console.log(`   GOD Score: ${result.startup.total_god_score}`);
        
        console.log('\n📝 Check server logs at /tmp/server.log for enrichment details!');
      }
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', data.substring(0, 300));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(postData);
req.end();
