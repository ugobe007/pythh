#!/usr/bin/env node
/**
 * Test the inference engine integration
 * Submit a URL and watch for news enrichment
 */

const http = require('http');

const testUrl = 'plaid.com';

console.log('🧪 Testing Inference Engine Integration\n');
console.log(`📍 Submitting URL: ${testUrl}`);
console.log('⏳ Watch for "News enrichment" in logs...\n');

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
  console.log(`✅ Response status: ${res.statusCode}\n`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    const elapsed = Date.now() - startTime;
    console.log(`⏱️  Total time: ${elapsed}ms\n`);
    
    try {
      const result = JSON.parse(data);
      console.log('📊 Result:');
      console.log(JSON.stringify(result, null, 2));
      
      // Check for enrichment indicators
      if (result.startup_id) {
        console.log(`\n✅ Startup created: ${result.startup_id}`);
        if (result.god_score) {
          console.log(`🎯 GOD Score: ${result.god_score}`);
        }
        if (result.matches_generated) {
          console.log(`🤝 Matches generated: ${result.matches_generated}`);
        }
      }
    } catch (e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(postData);
req.end();
