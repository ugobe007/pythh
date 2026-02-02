#!/usr/bin/env node

/**
 * Test URL Resolution Flow
 * 
 * This script simulates what happens when a user submits a URL
 */

console.log('🔍 Testing URL Resolution Flow\n');

// Test 1: Check environment variables
console.log('1️⃣ Environment Check:');
console.log('   VITE_BACKEND_URL:', process.env.VITE_BACKEND_URL || 'NOT SET');
console.log('   Expected for dev: http://localhost:3002\n');

// Test 2: Check AI enrichment endpoint
console.log('2️⃣ Testing AI Enrichment Endpoint:');
const testUrl = 'https://spatial-ai.com';

fetch('http://localhost:3002/api/startup/enrich-url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: testUrl })
})
  .then(res => {
    console.log('   Status:', res.status, res.statusText);
    if (res.ok) {
      return res.json();
    } else {
      return res.text().then(text => {
        console.log('   Error:', text);
        throw new Error(`API returned ${res.status}`);
      });
    }
  })
  .then(data => {
    console.log('   ✅ GOD Score:', data.godScore);
    console.log('   Tier:', data.tier);
    console.log('   Sectors:', data.inference?.sectors?.join(', ') || 'None');
    console.log('\n✅ AI Enrichment is working!\n');
  })
  .catch(err => {
    console.log('   ❌ AI Enrichment failed:', err.message);
    console.log('\n🔧 Fix: Make sure API server is running (pm2 status)\n');
  });

// Test 3: Check instant matching endpoint
setTimeout(() => {
  console.log('3️⃣ Testing Instant Match Endpoint:');
  fetch('http://localhost:3002/api/matches/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      startupId: '697d7775-8c3c-43a9-9b3b-927cf99d88cb',
      priority: 'test' 
    })
  })
    .then(res => res.json())
    .then(data => {
      console.log('   ✅ Match Count:', data.matchCount);
      console.log('\n✅ Instant Matching is working!\n');
    })
    .catch(err => {
      console.log('   ❌ Instant Matching failed:', err.message);
    });
}, 2000);
