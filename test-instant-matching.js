#!/usr/bin/env node

/**
 * TEST INSTANT MATCHING
 * 
 * This script tests the complete instant matching flow:
 * 1. Create a test startup
 * 2. Trigger instant match generation
 * 3. Verify matches were created
 * 4. Check timing
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function testInstantMatching() {
  console.log('🧪 Testing Instant Match Generation\n');
  
  const testStartupName = `Test Startup ${Date.now()}`;
  const testStartupId = crypto.randomUUID();
  
  try {
    // 1. Create test startup
    console.log('1️⃣ Creating test startup...');
    const startTime = Date.now();
    
    const { data: startup, error: createError } = await supabase
      .from('startup_uploads')
      .insert({
        id: testStartupId,
        name: testStartupName,
        website: `https://test-${Date.now()}.com`,
        tagline: 'Testing instant matching',
        sectors: ['Technology', 'SaaS'],
        stage: 1, // 1 = seed stage (integer not string)
        total_god_score: 75,
        status: 'approved',
        source_type: 'url', // Valid source_type from check constraint
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      throw new Error(`Failed to create startup: ${createError.message}`);
    }
    
    console.log(`   ✅ Created: ${startup.name} (GOD: ${startup.total_god_score})`);
    const createTime = Date.now() - startTime;
    console.log(`   ⏱️  Time: ${createTime}ms\n`);
    
    // 2. Trigger instant matching
    console.log('2️⃣ Triggering instant match generation...');
    const matchStartTime = Date.now();
    
    const response = await fetch('http://localhost:3002/api/matches/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        startupId: testStartupId, 
        priority: 'immediate' 
      })
    });
    
    const result = await response.json();
    const matchTime = Date.now() - matchStartTime;
    
    if (!result.success) {
      throw new Error(`Match generation failed: ${result.error}`);
    }
    
    console.log(`   ✅ Generated ${result.matchCount} matches`);
    console.log(`   ⏱️  Time: ${matchTime}ms\n`);
    
    // 3. Verify matches in database
    console.log('3️⃣ Verifying matches in database...');
    const { data: matches, error: matchError } = await supabase
      .from('startup_investor_matches')
      .select('id, investor_id, match_score')
      .eq('startup_id', testStartupId)
      .order('match_score', { ascending: false })
      .limit(5);
    
    if (matchError) {
      throw new Error(`Failed to fetch matches: ${matchError.message}`);
    }
    
    console.log(`   ✅ Found ${matches.length} matches in database`);
    console.log(`   📊 Top match score: ${matches[0]?.match_score || 'N/A'}`);
    console.log(`   📊 Avg match score: ${Math.round(matches.reduce((sum, m) => sum + m.match_score, 0) / matches.length)}\n`);
    
    // 4. Check ai_logs
    console.log('4️⃣ Checking ai_logs...');
    const { data: logs, error: logError } = await supabase
      .from('ai_logs')
      .select('*')
      .eq('log_type', 'instant_match')
      .contains('input_data', { startupId: testStartupId })
      .limit(1);
    
    if (logError) {
      console.log(`   ⚠️  Log check failed: ${logError.message}`);
    } else if (logs && logs.length > 0) {
      console.log(`   ✅ Logged to ai_logs`);
      console.log(`   📝 Match count: ${logs[0].output_data?.matchCount || 'N/A'}\n`);
    }
    
    // 5. Summary
    const totalTime = Date.now() - startTime;
    console.log('📊 SUMMARY');
    console.log('─────────────────────────────────────');
    console.log(`Startup Creation:     ${createTime}ms`);
    console.log(`Match Generation:     ${matchTime}ms`);
    console.log(`Total Time:           ${totalTime}ms`);
    console.log(`Matches Created:      ${result.matchCount}`);
    console.log(`Target Time:          < 3000ms`);
    console.log(`Status:               ${totalTime < 3000 ? '✅ PASS' : '⚠️ SLOW'}`);
    console.log('─────────────────────────────────────\n');
    
    // 6. Cleanup
    console.log('🧹 Cleanup...');
    await supabase.from('startup_investor_matches').delete().eq('startup_id', testStartupId);
    await supabase.from('startup_uploads').delete().eq('id', testStartupId);
    console.log('   ✅ Test data cleaned up\n');
    
    console.log('✅ TEST PASSED - Instant matching works!\n');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nError details:', error);
    
    // Cleanup on error
    try {
      await supabase.from('startup_investor_matches').delete().eq('startup_id', testStartupId);
      await supabase.from('startup_uploads').delete().eq('id', testStartupId);
    } catch (cleanupError) {
      console.error('Cleanup failed:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

// Run test
testInstantMatching();
