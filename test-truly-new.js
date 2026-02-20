#!/usr/bin/env node
/**
 * Test with UNKNOWN/OBSCURE startup guaranteed not to be in DB
 */

const http = require('http');

// Use a small/obscure startup that can't possibly be in DB yet
const testUrl = 'vercel-competitor-newname123.com'; // This will 404 but that's fine - we want to see the enrichment logic trigger

console.log('🧪 Testing News Enrichment - FAKE URL (watch enrichment path)\n');
console.log(`📍 Testing: ${testUrl}`);
console.log('⏳ Should attempt enrichment even if it fails...\n');

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
      console.log('Result:', JSON.stringify(result, null, 2).substring(0, 500));
    } catch (e) {
      console.error('Error parsing response:', e.message);
      console.log('Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

req.write(postData);
req.end();

// Also watch logs
setTimeout(() => {
  const { exec } = require('child_process');
  exec('tail -50 /tmp/server.log | grep -i "enrichment\\|sparse\\|tier"', (err, stdout) => {
    if (stdout) {
      console.log('\n📝 SERVER LOGS (enrichment-related):');
      console.log(stdout);
    }
  });
}, 5000);
