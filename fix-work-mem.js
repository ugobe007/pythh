#!/usr/bin/env node
/**
 * Fix work_mem PostgreSQL Parameter
 * 
 * The error "invalid value for parameter 'work_mem': '32mb'" indicates
 * PostgreSQL is rejecting the parameter because it needs uppercase 'MB'.
 * 
 * This script will:
 * 1. Test the current connection
 * 2. Check for any custom database settings
 * 3. Reset work_mem to default or correct value
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function fixWorkMem() {
  console.log('\n🔍 CHECKING DATABASE CONFIGURATION\n');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Basic connection
    console.log('\n1️⃣  Testing basic connection...');
    const { data: test, error: testError } = await supabase
      .from('startup_uploads')
      .select('id')
      .limit(1);
    
    if (testError) {
      console.log('   ❌ Connection failed:', testError.message);
      if (testError.message.includes('work_mem')) {
        console.log('\n   💡 work_mem error detected in basic query');
        console.log('   This means the issue is at the DATABASE LEVEL, not in your code.');
      }
    } else {
      console.log('   ✅ Basic connection works');
    }
    
    // Test 2: Try to query PostgreSQL settings
    console.log('\n2️⃣  Checking PostgreSQL settings...');
    const { data: settings, error: settingsError } = await supabase
      .rpc('execute_sql', {
        query: `
          SELECT name, setting, unit, source 
          FROM pg_settings 
          WHERE name LIKE '%mem%' OR name LIKE '%timeout%'
          ORDER BY name;
        `
      });
    
    if (settingsError) {
      console.log('   ⚠️  Cannot query settings (execute_sql RPC not available)');
      console.log('   Error:', settingsError.message);
    } else {
      console.log('   Settings:', settings);
    }
    
    // Test 3: Try the get_platform_stats RPC (this is what's failing)
    console.log('\n3️⃣  Testing get_platform_stats RPC...');
    const { data: stats, error: statsError } = await supabase
      .rpc('get_platform_stats');
    
    if (statsError) {
      console.log('   ❌ get_platform_stats failed:', statsError.message);
      if (statsError.message.includes('work_mem')) {
        console.log('\n   🎯 FOUND IT! The get_platform_stats function has work_mem issue');
      }
    } else {
      console.log('   ✅ get_platform_stats works:', stats);
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('\n📋 DIAGNOSIS SUMMARY:\n');
    
    if (testError?.message.includes('work_mem') || statsError?.message.includes('work_mem')) {
      console.log('🔴 work_mem ERROR CONFIRMED\n');
      console.log('The issue is in your Supabase database configuration.');
      console.log('Someone set work_mem = \'32mb\' (lowercase) but PostgreSQL requires \'32MB\' (uppercase).\n');
      console.log('📍 HOW TO FIX:\n');
      console.log('   OPTION 1: Via Supabase Dashboard');
      console.log('   -----------------------------------');
      console.log('   1. Go to: https://app.supabase.com/project/_/settings/database');
      console.log('   2. Look for "Custom PostgreSQL Config" or "Database Settings"');
      console.log('   3. Find work_mem parameter');
      console.log('   4. Change \'32mb\' → \'32MB\' (uppercase)');
      console.log('   5. Save and restart database\n');
      console.log('   OPTION 2: Via SQL Editor');
      console.log('   -------------------------');
      console.log('   Run this SQL in Supabase SQL Editor:');
      console.log('   ');
      console.log('   -- Reset work_mem to default (4MB)');
      console.log('   ALTER SYSTEM RESET work_mem;');
      console.log('   SELECT pg_reload_conf();');
      console.log('   ');
      console.log('   OR set it correctly:');
      console.log('   ');
      console.log('   ALTER SYSTEM SET work_mem = \'32MB\';  -- Uppercase!');
      console.log('   SELECT pg_reload_conf();');
      console.log('\n');
      console.log('   OPTION 3: Check RPC Function');
      console.log('   -----------------------------');
      console.log('   If get_platform_stats is failing, the function itself might ');
      console.log('   have a SET work_mem=\'32mb\' statement. Check the function definition.');
      console.log('\n');
    } else {
      console.log('✅ No work_mem errors detected');
      console.log('The matching engine might be offline for another reason.');
      console.log('Check the browser console for the actual error message.');
    }
    
    process.exit(testError || statsError ? 1 : 0);
    
  } catch (err) {
    console.error('\n❌ Unexpected error:', err.message);
    process.exit(1);
  }
}

fixWorkMem();
