#!/usr/bin/env node
/**
 * TEST ALL DATABASE CONNECTION METHODS
 * =====================================
 * Tests Supabase REST API vs Direct Postgres connection
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Client, Pool } = require('pg');

async function testConnections() {
  console.log('\n🔍 DATABASE CONNECTION TEST');
  console.log('═'.repeat(60));
  
  const results = {
    supabase_anon: { status: '❓', time: null, error: null },
    supabase_service: { status: '❓', time: null, error: null },
    postgres_direct: { status: '❓', time: null, error: null },
    postgres_pooler: { status: '❓', time: null, error: null },
  };
  
  // Test 1: Supabase REST API with anon key (frontend)
  console.log('\n1️⃣ Testing Supabase REST API (anon key)...');
  try {
    const start = Date.now();
    const supabaseAnon = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabaseAnon
      .from('startup_uploads')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    results.supabase_anon.status = '✅';
    results.supabase_anon.time = Date.now() - start;
    console.log(`   ✅ Connected in ${results.supabase_anon.time}ms`);
  } catch (err) {
    results.supabase_anon.status = '❌';
    results.supabase_anon.error = err.message;
    console.log(`   ❌ Failed: ${err.message}`);
  }
  
  // Test 2: Supabase REST API with service key (backend)
  console.log('\n2️⃣ Testing Supabase REST API (service key)...');
  try {
    const start = Date.now();
    const supabaseService = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    
    const { data, error } = await supabaseService
      .from('startup_uploads')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    
    results.supabase_service.status = '✅';
    results.supabase_service.time = Date.now() - start;
    console.log(`   ✅ Connected in ${results.supabase_service.time}ms`);
  } catch (err) {
    results.supabase_service.status = '❌';
    results.supabase_service.error = err.message;
    console.log(`   ❌ Failed: ${err.message}`);
  }
  
  // Test 3: Direct Postgres connection (Transaction mode)
  console.log('\n3️⃣ Testing Direct Postgres Connection...');
  if (process.env.DATABASE_URL) {
    try {
      const start = Date.now();
      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      });
      
      await client.connect();
      const res = await client.query('SELECT id FROM startup_uploads LIMIT 1');
      await client.end();
      
      results.postgres_direct.status = '✅';
      results.postgres_direct.time = Date.now() - start;
      console.log(`   ✅ Connected in ${results.postgres_direct.time}ms`);
    } catch (err) {
      results.postgres_direct.status = '❌';
      results.postgres_direct.error = err.message;
      console.log(`   ❌ Failed: ${err.message}`);
    }
  } else {
    results.postgres_direct.status = '⚠️';
    results.postgres_direct.error = 'DATABASE_URL not set';
    console.log(`   ⚠️ DATABASE_URL not configured`);
  }
  
  // Test 4: Postgres Connection Pooler (Session mode)
  console.log('\n4️⃣ Testing Postgres Connection Pooler...');
  if (process.env.SUPABASE_POOLER_URL) {
    try {
      const start = Date.now();
      const pool = new Pool({
        connectionString: process.env.SUPABASE_POOLER_URL,
        ssl: { rejectUnauthorized: false },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
      
      const res = await pool.query('SELECT id FROM startup_uploads LIMIT 1');
      await pool.end();
      
      results.postgres_pooler.status = '✅';
      results.postgres_pooler.time = Date.now() - start;
      console.log(`   ✅ Connected in ${results.postgres_pooler.time}ms`);
    } catch (err) {
      results.postgres_pooler.status = '❌';
      results.postgres_pooler.error = err.message;
      console.log(`   ❌ Failed: ${err.message}`);
    }
  } else {
    results.postgres_pooler.status = '⚠️';
    results.postgres_pooler.error = 'SUPABASE_POOLER_URL not set';
    console.log(`   ⚠️ SUPABASE_POOLER_URL not configured`);
  }
  
  // Summary
  console.log('\n\n📊 CONNECTION SUMMARY');
  console.log('═'.repeat(60));
  console.log('\n┌─────────────────────────┬────────┬──────────┬─────────────┐');
  console.log('│ Method                  │ Status │ Time (ms)│ Notes       │');
  console.log('├─────────────────────────┼────────┼──────────┼─────────────┤');
  
  const printRow = (name, result, use) => {
    const status = result.status.padEnd(6);
    const time = result.time ? `${result.time}ms`.padEnd(8) : 'N/A'.padEnd(8);
    const notes = result.error ? result.error.substring(0, 25) : use;
    console.log(`│ ${name.padEnd(23)} │ ${status} │ ${time} │ ${notes.padEnd(11)} │`);
  };
  
  printRow('Supabase REST (anon)', results.supabase_anon, 'Frontend');
  printRow('Supabase REST (service)', results.supabase_service, 'Backend');
  printRow('Postgres Direct', results.postgres_direct, 'Heavy queries');
  printRow('Postgres Pooler', results.postgres_pooler, 'Serverless');
  
  console.log('└─────────────────────────┴────────┴──────────┴─────────────┘');
  
  // Recommendations
  console.log('\n\n💡 RECOMMENDATIONS');
  console.log('═'.repeat(60));
  
  const working = Object.values(results).filter(r => r.status === '✅').length;
  const total = Object.keys(results).length;
  
  if (working === total) {
    console.log('✅ ALL CONNECTION METHODS WORKING!');
    console.log('\nBest practices:');
    console.log('  • Frontend: Use Supabase REST (anon key)');
    console.log('  • Backend scripts: Use Supabase REST (service key)');
    console.log('  • Heavy queries: Use Postgres Direct');
    console.log('  • Serverless: Use Postgres Pooler');
  } else if (results.supabase_service.status === '✅') {
    console.log('✅ Supabase REST API working (recommended)');
    console.log('\nCurrent setup is fine. Issues were ENV VAR problems, not Supabase.');
    console.log('No need to switch databases!');
    
    if (results.postgres_direct.status === '⚠️') {
      console.log('\n⚠️  Optional: Add DATABASE_URL for direct Postgres access');
      console.log('   (For heavy analytics queries, not required)');
    }
  } else {
    console.log('❌ CONNECTION ISSUES DETECTED');
    console.log('\nLikely causes:');
    console.log('  1. Missing or incorrect environment variables');
    console.log('  2. Network/firewall blocking Supabase');
    console.log('  3. Invalid API keys');
    
    console.log('\nCheck your .env file:');
    console.log('  VITE_SUPABASE_URL=https://your-project.supabase.co');
    console.log('  VITE_SUPABASE_ANON_KEY=eyJ... (from Supabase dashboard)');
    console.log('  SUPABASE_SERVICE_KEY=eyJ... (from Supabase dashboard)');
  }
  
  console.log('\n');
}

testConnections().catch(console.error);
