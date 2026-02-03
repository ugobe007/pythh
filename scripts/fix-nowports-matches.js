#!/usr/bin/env node
/**
 * Generate matches specifically for Nowports
 * Quick fix for single startup
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function generateMatches() {
  console.log('🎯 Generating matches for Nowports...\n');
  
  // Get Nowports ID
  const { data: nowports } = await supabase
    .from('startup_uploads')
    .select('id, name, sectors')
    .ilike('name', '%nowport%')
    .single();
  
  if (!nowports) {
    console.error('❌ Nowports not found');
    return;
  }
  
  console.log(`✅ Found: ${nowports.name} (${nowports.id})`);
  console.log(`   Sectors: ${nowports.sectors}`);
  
  // Get relevant investors
  console.log('\n📊 Finding matching investors...');
  const { data: investors } = await supabase
    .from('investors')
    .select('id, name, sectors, stage')
    .or('status.is.null,status.eq.active')
    .limit(100);
  
  if (!investors || investors.length === 0) {
    console.error('❌ No investors found');
    return;
  }
  
  console.log(`✅ Found ${investors.length} active investors`);
  
  // Simple matching logic: sector overlap
  const matches = [];
  const nowportsSectors = nowports.sectors || [];
  
  for (const inv of investors) {
    const invSectors = inv.sectors || [];
    const overlap = nowportsSectors.filter(s => 
      invSectors.some(is => is.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(is.toLowerCase()))
    );
    
    if (overlap.length > 0) {
      // Base score: 50 + (10 * overlap count)
      const matchScore = Math.min(95, 50 + (overlap.length * 10));
      matches.push({
        startup_id: nowports.id,
        investor_id: inv.id,
        match_score: matchScore,
        reasoning: `${overlap.join(', ')} alignment. ${inv.stage || 'Multi-stage'} investor.`,
        created_at: new Date().toISOString()
      });
    }
  }
  
  console.log(`\n🎯 Generated ${matches.length} matches`);
  
  if (matches.length === 0) {
    console.log('   ⚠️  No sector overlaps found - using fallback matches');
    // Add top 10 investors as fallback
    matches.push(...investors.slice(0, 10).map((inv, i) => ({
      startup_id: nowports.id,
      investor_id: inv.id,
      match_score: 60 - i,  // Descending from 60
      reasoning: `Potential fit. ${inv.name} invests in similar-stage startups.`,
      created_at: new Date().toISOString()
    })));
  }
  
  // Delete existing matches
  console.log('\n🗑️  Removing old matches...');
  await supabase
    .from('startup_investor_matches')
    .delete()
    .eq('startup_id', nowports.id);
  
  // Insert new matches in batches
  console.log('💾 Inserting new matches...');
  const batchSize = 50;
  for (let i = 0; i < matches.length; i += batchSize) {
    const batch = matches.slice(i, i + batchSize);
    const { error } = await supabase
      .from('startup_investor_matches')
      .insert(batch);
    
    if (error) {
      console.error(`   ❌ Batch ${i / batchSize + 1} failed:`, error);
    } else {
      console.log(`   ✅ Inserted batch ${i / batchSize + 1} (${batch.length} matches)`);
    }
  }
  
  // Verify
  console.log('\n✅ Verification:');
  const { data: verifyMatches, count } = await supabase
    .from('startup_investor_matches')
    .select('match_score', { count: 'exact' })
    .eq('startup_id', nowports.id)
    .gte('match_score', 50);
  
  console.log(`   Total matches: ${count}`);
  console.log(`   Matches >= 50: ${verifyMatches?.length || 0}`);
  
  // Test RPC
  console.log('\n🧪 Testing RPC...');
  const { data: rpcData } = await supabase.rpc('get_live_match_table', {
    p_startup_id: nowports.id,
    p_limit_unlocked: 5,
    p_limit_locked: 50
  });
  
  console.log(`   RPC returned: ${rpcData?.length || 0} rows`);
  
  if (rpcData && rpcData.length > 0) {
    console.log('\n✅ SUCCESS! Nowports now has matches.');
    console.log('   Top 3:');
    rpcData.slice(0, 3).forEach((r, i) => {
      console.log(`      ${i + 1}. ${r.investor_name || 'Locked'} - Score: ${r.signal_score}`);
    });
  } else {
    console.log('\n⚠️  RPC still returning 0 rows - check threshold or data');
  }
}

generateMatches().catch(err => {
  console.error('💥 Error:', err);
  process.exit(1);
});
