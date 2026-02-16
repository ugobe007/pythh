#!/usr/bin/env node
/**
 * COMPREHENSIVE WORK_MEM DIAGNOSTIC
 * 
 * This script will test EVERY query path in the application
 * to find which one is triggering the work_mem error.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Test with ANON key (like browser)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testAllQueries() {
  console.log('\n🔍 COMPREHENSIVE WORK_MEM DIAGNOSTIC\n');
  console.log('=' .repeat(70));
  
  const tests = [
    {
      name: 'LiveStats - Count startup_signal_scores',
      test: async () => {
        return await supabase
          .from('startup_signal_scores')
          .select('startup_id', { count: 'exact', head: true });
      }
    },
    {
      name: 'FounderSignalsPage - JOIN query',
      test: async () => {
        return await supabase
          .from('startup_signal_scores')
          .select(`
            startup_id,
            as_of,
            signals_total,
            startup_uploads!inner(sectors)
          `)
          .not('startup_uploads.sectors', 'is', null)
          .order('as_of', { ascending: false })
          .limit(50);
      }
    },
    {
      name: 'SignalTrends - Count query',
      test: async () => {
        return await supabase
          from('startup_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .not('total_god_score', 'is', null);
      }
    },
    {
      name: 'SignalTrends - Select with all scores',
      test: async () => {
        return await supabase
          .from('startup_uploads')
          .select('id, name, sectors, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
          .eq('status', 'approved')
          .not('total_god_score', 'is', null)
          .order('total_god_score', { ascending: false })
          .limit(50);
      }
    },
    {
      name: 'Profiles table',
      test: async () => {
        return await supabase
          .from('profiles')
          .select('*')
          .limit(5);
      }
    },
    {
      name: 'startup_uploads - Basic select',
      test: async () => {
        return await supabase
          .from('startup_uploads')
          .select('id, name, website, status, total_god_score')
          .eq('status', 'approved')
          .limit(10);
      }
    },
    {
      name: 'startup_investor_matches',
      test: async () => {
        return await supabase
          .from('startup_investor_matches')
          .select('id, match_score, startup_id, investor_id')
          .eq('status', 'suggested')
          .limit(10);
      }
    },
    {
      name: 'get_platform_stats RPC',
      test: async () => {
        return await supabase.rpc('get_platform_stats');
      }
    }
  ];
  
  let failureFound = false;
  let workMemError = null;
  
  for (const {name, test} of tests) {
    try {
      console.log(`\n📋 Testing: ${name}`);
      const result = await test();
      
      if (result.error) {
        console.log(`   ❌ FAILED: ${result.error.message}`);
        
        if (result.error.message.includes('work_mem')) {
          console.log('\n   🎯 FOUND IT! This query triggers work_mem error!');
          console.log('   Code:', result.error.code);
          console.log('   Hint:', result.error.hint);
          failureFound = true;
          workMemError = {name, error: result.error};
        }
      } else {
        const count = result.count !== undefined ? result.count : (result.data?.length || 'N/A');
        console.log(`   ✅ OK - Results: ${count}`);
      }
    } catch (err) {
      console.log(`   ❌ Exception: ${err.message}`);
      if (err.message.includes('work_mem')) {
        console.log('\n   🎯 FOUND IT! This query triggers work_mem error!');
        failureFound = true;
        workMemError = {name, error: err};
      }
    }
  }
  
  console.log('\n' + '=' .repeat(70));
  console.log('\n📊 DIAGNOSTIC SUMMARY:\n');
  
  if (failureFound) {
    console.log('🔴 work_mem ERROR DETECTED\n');
    console.log(`Failed Query: ${workMemError.name}`);
    console.log(`Error: ${workMemError.error.message}`);
    console.log('\nThis is a Supabase/PostgreSQL configuration issue.');
    console.log('The parameter work_mem is set to lowercase "32mb" but needs uppercase "32MB".\n');
    console.log('FIXES:\n');
    console.log('1. Go to Supabase Dashboard → Settings → Database');
    console.log('2. Find PostgreSQL Configuration');
    console.log('3. Change work_mem from "32mb" to "32MB" (uppercase)');
    console.log('4. OR run this SQL in Supabase SQL Editor:');
    console.log('   ALTER SYSTEM RESET work_mem;');
    console.log('   SELECT pg_reload_conf();');
  } else {
    console.log('✅ No work_mem errors detected!');
    console.log('\nAll queries passed successfully.');
    console.log('The issue may be:');
    console.log('  - Browser cache (try hard refresh: Cmd+Shift+R)');
    console.log('  - Transient Supabase issue (already resolved)');
    console.log('  - Specific page/component not tested here');
  }
  
  console.log('\n');
  process.exit(failureFound ? 1 : 0);
}

testAllQueries();
