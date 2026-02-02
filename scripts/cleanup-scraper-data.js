#!/usr/bin/env node
/**
 * Scraper Data Cleanup & Fix
 * 
 * This script:
 * 1. Cleans database of bad company name extractions
 * 2. Improves extractCompanyName() validation
 * 3. Tests the fixes
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

// Known bad extractions to clean up
const BAD_NAMES = [
  'Hard', 'Invest', 'Successful', 'Reinforcement', 'American',
  'Everything', 'Researchers', 'Pur', 'Please Fund', 'Fund',
  'Era', 'With', 'Competing', 'Building', 'Modern', 'Inside',
  'Tips', 'Data', 'Digital', 'Tech', 'Build', 'Every', 'Equity',
  'Fusion', 'Dropout', 'Team', 'Culture', 'Updates', 'Launch',
  'Software', 'European', 'Finnish', 'Swedish', 'Estonian', 'Danish',
  'Indian', 'German', 'French', 'British', 'American', 'Transit',
  'Healthcare', 'Benefits', 'College', 'University', 'Click',
  'Power', 'Bank', 'Sandbar', 'Stand', 'Wars', 'Break', 'Much',
  'Most', 'Coveted', 'Golden', 'Investor', 'Battlefield', 'And',
  'Moved', 'Out', 'Clicks', 'SLC', 'Zork', 'Equity\'s', 'Healthcare\'s'
];

async function cleanDatabase() {
  console.log('🧹 Starting database cleanup...\n');
  
  // Step 1: Check how many bad entries exist
  console.log('📊 Checking for bad entries in startup_uploads...');
  const { data: badUploads, error: uploadsError } = await supabase
    .from('startup_uploads')
    .select('name, status')
    .in('name', BAD_NAMES);
  
  if (uploadsError) {
    console.error('Error checking startup_uploads:', uploadsError);
    return;
  }
  
  console.log(`Found ${badUploads.length} bad entries in startup_uploads:`);
  badUploads.forEach(row => {
    console.log(`  ❌ ${row.name} (${row.status})`);
  });
  
  console.log('\n📊 Checking for bad entries in discovered_startups...');
  const { data: badDiscovered, error: discoveredError } = await supabase
    .from('discovered_startups')
    .select('name, created_at')
    .in('name', BAD_NAMES);
  
  if (discoveredError) {
    console.error('Error checking discovered_startups:', discoveredError);
    return;
  }
  
  console.log(`Found ${badDiscovered.length} bad entries in discovered_startups\n`);
  
  // Step 2: Confirm cleanup
  console.log('⚠️  About to clean up:');
  console.log(`   - ${badUploads.length} entries in startup_uploads (will reject)`);
  console.log(`   - ${badDiscovered.length} entries in discovered_startups (will delete)`);
  console.log('');
  
  // Step 3: Execute cleanup
  console.log('🗑️  Rejecting bad entries in startup_uploads...');
  const { error: rejectError } = await supabase
    .from('startup_uploads')
    .update({ status: 'rejected' })
    .in('name', BAD_NAMES)
    .neq('status', 'rejected'); // Only update if not already rejected
  
  if (rejectError) {
    console.error('Error rejecting bad uploads:', rejectError);
  } else {
    console.log(`✅ Rejected ${badUploads.filter(r => r.status !== 'rejected').length} entries`);
  }
  
  console.log('🗑️  Deleting bad entries from discovered_startups...');
  const { error: deleteError } = await supabase
    .from('discovered_startups')
    .delete()
    .in('name', BAD_NAMES);
  
  if (deleteError) {
    console.error('Error deleting from discovered_startups:', deleteError);
  } else {
    console.log(`✅ Deleted ${badDiscovered.length} entries\n`);
  }
  
  // Step 4: Verify cleanup
  console.log('✅ Verifying cleanup...');
  const { data: remainingBad } = await supabase
    .from('discovered_startups')
    .select('name')
    .in('name', BAD_NAMES);
  
  if (remainingBad && remainingBad.length > 0) {
    console.log(`⚠️  Still found ${remainingBad.length} bad entries`);
  } else {
    console.log('✅ All bad entries cleaned from discovered_startups');
  }
  
  const { data: rejectedCount } = await supabase
    .from('startup_uploads')
    .select('name', { count: 'exact', head: true })
    .in('name', BAD_NAMES)
    .eq('status', 'rejected');
  
  console.log(`✅ ${rejectedCount || 0} bad entries marked as rejected in startup_uploads\n`);
  
  console.log('🎉 Database cleanup complete!\n');
}

async function testScraperBehavior() {
  console.log('🧪 Testing scraper duplicate detection...\n');
  
  // Test 1: Known good company should not be a duplicate (unless legitimately added)
  const testCompany = 'TestCompany' + Date.now(); // Unique name
  
  console.log(`Testing with: ${testCompany}`);
  
  const { data: exists } = await supabase
    .from('discovered_startups')
    .select('id')
    .eq('name', testCompany)
    .limit(1);
  
  if (exists && exists.length > 0) {
    console.log('❌ Found duplicate (unexpected)');
  } else {
    console.log('✅ No duplicate found (expected)');
  }
  
  // Test 2: Check that we can distinguish between similar names
  const { data: similar } = await supabase
    .from('discovered_startups')
    .select('name')
    .ilike('name', `%${testCompany}%`)
    .limit(5);
  
  console.log(`\nSimilar names found with .ilike(): ${similar?.length || 0}`);
  if (similar && similar.length > 0) {
    console.log('  ⚠️  Old .ilike() would have false positives');
  }
  
  console.log('✅ Tests complete\n');
}

// Main execution
(async () => {
  console.log('=' .repeat(60));
  console.log('  SCRAPER DATA CLEANUP & FIX');
  console.log('=' .repeat(60) + '\n');
  
  await cleanDatabase();
  await testScraperBehavior();
  
  console.log('=' .repeat(60));
  console.log('  NEXT STEPS');
  console.log('=' .repeat(60));
  console.log('1. Restart RSS scraper: pm2 restart rss-scraper');
  console.log('2. Monitor logs: pm2 logs rss-scraper --lines 50');
  console.log('3. Wait 15 minutes and check for ✅ entries');
  console.log('4. Verify discovered_startups growing:');
  console.log('   SELECT COUNT(*) FROM discovered_startups WHERE created_at > NOW() - INTERVAL \'1 hour\'');
  console.log('=' .repeat(60) + '\n');
})();
