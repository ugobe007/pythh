const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Test with ANON key (what frontend uses)
const anonClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Test with SERVICE key (backend)
const serviceClient = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function diagnoseMatchingEngine() {
  console.log('🔍 MATCHING ENGINE DIAGNOSTIC');
  console.log('=' .repeat(70));
  
  const issues = [];
  
  // TEST 1: Check anon key exists
  console.log('\n📌 1. ENVIRONMENT CHECK');
  console.log('   VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('   VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  console.log('   SUPABASE_SERVICE_KEY:', process.env.SUPABASE_SERVICE_KEY ? '✅ Set' : '❌ Missing');
  
  if (!process.env.VITE_SUPABASE_ANON_KEY) {
    issues.push('VITE_SUPABASE_ANON_KEY is missing from .env');
  }
  
  // TEST 2: Anon key permissions on startup_uploads
  console.log('\n📊 2. STARTUP_UPLOADS (ANON KEY)');
  try {
    const { data, error } = await anonClient
      .from('startup_uploads')
      .select('id, name, total_god_score')
      .eq('status', 'approved')
      .limit(1)
      .single();
    
    if (error) {
      console.log('   ❌ Error:', error.message, error.code);
      issues.push(`startup_uploads anon read: ${error.message}`);
    } else {
      console.log('   ✅ Anon can read startup_uploads');
      console.log('   Sample:', data.name);
    }
  } catch (err) {
    console.log('   ❌ Exception:', err.message);
    issues.push('startup_uploads anon read exception');
  }
  
  // TEST 3: Anon key permissions on investors
  console.log('\n💼 3. INVESTORS TABLE (ANON KEY)');
  try {
    const { data, error } = await anonClient
      .from('investors')
      .select('id, name, firm')
      .limit(1)
      .single();
    
    if (error) {
      console.log('   ❌ Error:', error.message, error.code);
      issues.push(`investors anon read: ${error.message}`);
    } else {
      console.log('   ✅ Anon can read investors');
      console.log('   Sample:', data.name);
    }
  } catch (err) {
    console.log('   ❌ Exception:', err.message);
    issues.push('investors anon read exception');
  }
  
  // TEST 4: Anon key permissions on startup_investor_matches
  console.log('\n🎯 4. STARTUP_INVESTOR_MATCHES (ANON KEY)');
  try {
    const { data, error, count } = await anonClient
      .from('startup_investor_matches')
      .select('match_score, startup_id, investor_id', { count: 'exact' })
      .gte('match_score', 50)
      .limit(5);
    
    if (error) {
      console.log('   ❌ Error:', error.message, error.code);
      issues.push(`startup_investor_matches anon read: ${error.message} (CODE: ${error.code})`);
    } else {
      console.log('   ✅ Anon can read startup_investor_matches');
      console.log('   Total accessible matches:', count);
      console.log('   Sample scores:', data?.map(m => m.match_score).join(', '));
    }
  } catch (err) {
    console.log('   ❌ Exception:', err.message);
    issues.push('startup_investor_matches anon read exception');
  }
  
  // TEST 5: Full pipeline test with anon key
  console.log('\n🧪 5. FULL PIPELINE TEST (ANON KEY - WHAT FRONTEND DOES)');
  try {
    // Get a startup
    const { data: startup } = await anonClient
      .from('startup_uploads')
      .select('id, name')
      .eq('status', 'approved')
      .limit(1)
      .single();
    
    if (!startup) {
      console.log('   ❌ No startup found');
      issues.push('No approved startups accessible to anon');
    } else {
      console.log('   Step 1: Got startup:', startup.name);
      
      // Get matches for this startup
      const { data: matches, error: matchError } = await anonClient
        .from('startup_investor_matches')
        .select('match_score, investor_id')
        .eq('startup_id', startup.id)
        .gte('match_score', 50)
        .limit(5);
      
      if (matchError) {
        console.log('   ❌ Step 2 FAILED:', matchError.message, matchError.code);
        issues.push(`Match query failed: ${matchError.message}`);
      } else {
        console.log('   Step 2: Got', matches?.length || 0, 'matches');
        
        if (matches && matches.length > 0) {
          // Get investors
          const investorIds = matches.map(m => m.investor_id);
          const { data: investors, error: invError } = await anonClient
            .from('investors')
            .select('id, name, firm')
            .in('id', investorIds);
          
          if (invError) {
            console.log('   ❌ Step 3 FAILED:', invError.message, invError.code);
            issues.push(`Investor query failed: ${invError.message}`);
          } else {
            console.log('   Step 3: Got', investors?.length || 0, 'investors');
            if (investors && investors.length > 0) {
              console.log('   ✅ FULL PIPELINE WORKS!');
              console.log('   Sample match:', investors[0].name, '- Score:', matches[0].match_score);
            } else {
              console.log('   ❌ No investors returned');
              issues.push('Investors query returned empty');
            }
          }
        } else {
          console.log('   ⚠️  No matches returned for this startup');
        }
      }
    }
  } catch (err) {
    console.log('   ❌ Pipeline exception:', err.message);
    issues.push('Full pipeline exception');
  }
  
  // TEST 6: Compare with service key
  console.log('\n🔐 6. SERVICE KEY COMPARISON');
  try {
    const { count: anonCount } = await anonClient
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    const { count: serviceCount } = await serviceClient
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    
    console.log('   Anon can see:', anonCount, 'matches');
    console.log('   Service can see:', serviceCount, 'matches');
    
    if (anonCount === 0 && serviceCount > 0) {
      issues.push('RLS is blocking ALL anon access to matches');
    }
  } catch (err) {
    console.log('   Error comparing:', err.message);
  }
  
  // SUMMARY
  console.log('\n' + '='.repeat(70));
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(70));
  
  if (issues.length === 0) {
    console.log('✅ All tests passed - matching engine is healthy');
  } else {
    console.log(`❌ Found ${issues.length} issue(s):\n`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    
    console.log('\n💡 MOST LIKELY CAUSE:');
    if (issues.some(i => i.includes('anon read'))) {
      console.log('   → RLS policies are blocking anonymous access');
      console.log('   → Run: cat fix-all-rls-policies.sql');
      console.log('   → Then paste into Supabase SQL Editor');
    }
  }
  
  console.log('\n');
}

diagnoseMatchingEngine().catch(err => {
  console.error('Diagnostic failed:', err);
  process.exit(1);
});
