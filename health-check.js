#!/usr/bin/env node
/**
 * PYTHH PLATFORM HEALTH CHECK
 * Comprehensive diagnostic of all critical systems
 */

const { createClient } = require('@supabase/supabase-js');
const { fetchAllPages } = require('./scripts/lib/supabasePaginate');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function healthCheck() {
  console.log('\n🏥 PYTHH PLATFORM HEALTH CHECK\n');
  console.log('=' .repeat(70));
  
  const results = {
    passed: 0,
    failed: 0,
    warnings: 0
  };
  
  // ========================================
  // 1. DATABASE CONNECTION
  // ========================================
  console.log('\n📊 DATABASE CONNECTIVITY\n');
  
  try {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Database connection: OK');
    results.passed++;
  } catch (err) {
    console.log('❌ Database connection: FAILED -', err.message);
    results.failed++;
  }
  
  // ========================================
  // 2. CORE DATA INTEGRITY
  // ========================================
  console.log('\n📋 CORE DATA INTEGRITY\n');
  
  // Approved startups
  try {
    const { count } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    
    console.log(`✅ Approved startups: ${count?.toLocaleString()}`);
    results.passed++;
    
    if (count < 1000) {
      console.log('   ⚠️  Warning: Low startup count');
      results.warnings++;
    }
  } catch (err) {
    console.log('❌ Startup count check failed:', err.message);
    results.failed++;
  }
  
  // GOD scores (paginate — avoid averaging only the first ~1000 rows)
  try {
    const rows = await fetchAllPages((from, to) =>
      supabase
        .from('startup_uploads')
        .select('total_god_score')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null)
        .range(from, to)
    );

    if (rows.length > 0) {
      const nums = rows.map((d) => Number(d.total_god_score)).filter((n) => !Number.isNaN(n));
      const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
      const min = Math.min(...nums);
      const max = Math.max(...nums);

      console.log(`✅ GOD scores: avg ${avg.toFixed(1)}, range ${min}-${max} (n=${nums.length})`);
      results.passed++;

      if (avg < 50 || avg > 70) {
        console.log(`   ⚠️  Warning: Average GOD score ${avg.toFixed(1)} outside target 60-65`);
        results.warnings++;
      }
    } else {
      console.log('   ⚠️  Warning: No approved startups with total_god_score set');
      results.warnings++;
    }
  } catch (err) {
    console.log('❌ GOD score check failed:', err.message);
    results.failed++;
  }
  
  // Investors
  try {
    const { count } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Investors: ${count?.toLocaleString()}`);
    results.passed++;
  } catch (err) {
    console.log('❌ Investor count check failed:', err.message);
    results.failed++;
  }
  
  // ========================================
  // 3. MATCHING ENGINE
  // ========================================
  console.log('\n🔥 MATCHING ENGINE\n');
  
  try {
    const { count } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Total matches: ${count?.toLocaleString()}`);
    results.passed++;
    
    if (count < 100000) {
      console.log('   ⚠️  Warning: Low match count');
      results.warnings++;
    }
  } catch (err) {
    console.log('❌ Match count check failed:', err.message);
    results.failed++;
  }
  
  // High-quality matches
  try {
    const { count } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true })
      .gte('match_score', 70);
    
    console.log(`✅ High-quality matches (≥70): ${count?.toLocaleString()}`);
    results.passed++;
  } catch (err) {
    console.log('❌ High-quality match check failed:', err.message);
    results.failed++;
  }
  
  // ========================================
  // 4. SIGNAL SYSTEM
  // ========================================
  console.log('\n📡 SIGNAL SYSTEM\n');
  
  try {
    const { count } = await supabase
      .from('startup_signal_scores')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ Signal scores: ${count?.toLocaleString()}`);
    results.passed++;
  } catch (err) {
    console.log('❌ Signal scores check failed:', err.message);
    results.failed++;
  }
  
  // Recent signals
  try {
    const { data } = await supabase
      .from('startup_signal_scores')
      .select('as_of')
      .order('as_of', { ascending: false })
      .limit(1);
    
    if (data && data[0]) {
      const lastUpdate = new Date(data[0].as_of);
      const hoursAgo = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60));
      
      console.log(`✅ Last signal update: ${hoursAgo}h ago`);
      results.passed++;
      
      if (hoursAgo > 48) {
        console.log('   ⚠️  Warning: Signals not updated in 48+ hours');
        results.warnings++;
      }
    }
  } catch (err) {
    console.log('❌ Signal freshness check failed:', err.message);
    results.failed++;
  }
  
  // ========================================
  // 5. PLATFORM STATS RPC
  // ========================================
  console.log('\n⚡ PLATFORM STATS\n');
  
  try {
    const { data, error } = await supabase.rpc('get_platform_stats');
    
    if (error) throw error;
    
    console.log(`✅ Platform stats RPC: OK`);
    console.log(`   Startups: ${data.startups?.toLocaleString()}`);
    console.log(`   Investors: ${data.investors?.toLocaleString()}`);
    console.log(`   Matches: ${data.matches?.toLocaleString()}`);
    results.passed++;
  } catch (err) {
    console.log('❌ Platform stats RPC failed:', err.message);
    results.failed++;
  }
  
  // ========================================
  // 6. USER SYSTEM
  // ========================================
  console.log('\n👥 USER SYSTEM\n');
  
  try {
    const { count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    console.log(`✅ User profiles: ${count?.toLocaleString()}`);
    results.passed++;
  } catch (err) {
    console.log('❌ User profiles check failed:', err.message);
    results.failed++;
  }
  
  // ========================================
  // 7. DISCOVERED STARTUPS PIPELINE
  // ========================================
  console.log('\n🔍 DISCOVERY PIPELINE\n');
  
  try {
    const { count: total } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true });
    
    const { count: unimported } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true })
      .eq('imported_to_startups', false);
    
    console.log(`✅ Discovered startups: ${total?.toLocaleString()} (${unimported?.toLocaleString()} pending)`);
    results.passed++;
  } catch (err) {
    console.log('❌ Discovery pipeline check failed:', err.message);
    results.failed++;
  }
  
  // ========================================
  // 8. RSS SOURCES
  // ========================================
  console.log('\n📰 RSS SOURCES\n');
  
  try {
    const { count } = await supabase
      .from('rss_sources')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);
    
    console.log(`✅ Active RSS sources: ${count?.toLocaleString()}`);
    results.passed++;
  } catch (err) {
    console.log('❌ RSS sources check failed:', err.message);
    results.failed++;
  }
  
  // ========================================
  // SUMMARY
  // ========================================
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 HEALTH CHECK SUMMARY\n');
  
  const total = results.passed + results.failed;
  const healthScore = Math.round((results.passed / total) * 100);
  
  console.log(`Tests passed: ${results.passed}/${total}`);
  console.log(`Tests failed: ${results.failed}`);
  console.log(`Warnings: ${results.warnings}`);
  console.log(`\nHealth score: ${healthScore}%`);
  
  if (healthScore === 100) {
    console.log('\n✅✅✅ SYSTEM HEALTHY ✅✅✅\n');
  } else if (healthScore >= 80) {
    console.log('\n✅ SYSTEM OPERATIONAL (with minor issues)\n');
  } else if (healthScore >= 60) {
    console.log('\n⚠️  SYSTEM DEGRADED (needs attention)\n');
  } else {
    console.log('\n❌ SYSTEM CRITICAL (immediate action required)\n');
  }
  
  process.exit(results.failed > 0 ? 1 : 0);
}

healthCheck();
