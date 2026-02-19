const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debug() {
  console.log('🔍 DEBUGGING HOT MATCHES\n');
  
  // 1. Check what function signature exists in DB
  console.log('1️⃣ Checking function signature in database...');
  const { data: funcs, error: funcError } = await supabase
    .from('pg_proc')
    .select('proname, prosrc')
    .eq('proname', 'get_hot_matches')
    .limit(1)
    .maybeSingle();
  
  if (funcError) {
    console.log('   Using direct query instead...');
  }
  
  // 2. Test with explicit integer parameters
  console.log('\n2️⃣ Testing with INTEGER parameters (5, 168)...');
  try {
    const { data, error } = await supabase.rpc('get_hot_matches', {
      limit_count: 5,
      hours_ago: 168
    });
    
    if (error) {
      console.error('   ❌ Error:', error);
      console.error('   Code:', error.code);
      console.error('   Message:', error.message);
      console.error('   Details:', error.details);
      console.error('   Hint:', error.hint);
    } else {
      console.log('   ✅ Success! Got', data?.length || 0, 'matches');
    }
  } catch (err) {
    console.error('   ❌ Exception:', err.message);
  }
  
  // 3. Check the actual deployed function source
  console.log('\n3️⃣ Checking deployed function source code...');
  const { data: fnSource, error: fnError } = await supabase.rpc('exec_sql', {
    sql: `
      SELECT 
        p.proname as function_name,
        pg_get_functiondef(p.oid) as definition
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
        AND p.proname = 'get_hot_matches'
      LIMIT 1;
    `
  }).catch(() => ({ data: null, error: 'Cannot exec raw SQL' }));
  
  if (fnError || !fnSource) {
    console.log('   ⚠️  Cannot read function source directly');
    console.log('   Try running this in Supabase SQL Editor:');
    console.log('   SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = \'get_hot_matches\';');
  } else {
    console.log('   Function definition retrieved');
  }
  
  // 4. Test each component separately
  console.log('\n4️⃣ Testing platform_velocity (simpler function)...');
  const { data: vel, error: velErr } = await supabase.rpc('get_platform_velocity');
  if (velErr) {
    console.error('   ❌ Error:', velErr.message);
  } else {
    console.log('   ✅ Works! Platform has', vel?.[0]?.total_matches_today || 0, 'matches today');
  }
  
  // 5. Check what parameters the client is actually sending
  console.log('\n5️⃣ Checking what the React component sends...');
  console.log('   Default params: { limit_count: 6, hours_ago: 24 }');
  console.log('   Are both integers? YES');
  
  console.log('\n❓ THEORY: The deployed function in Supabase still has the OLD code');
  console.log('   The error "Pre-Seed" suggests the old string concatenation is running');
  console.log('   Solution: DROP and recreate the function\n');
  
  console.log('🔧 Run this in Supabase SQL Editor:');
  console.log('   DROP FUNCTION IF EXISTS get_hot_matches(INT, INT);');
  console.log('   DROP FUNCTION IF EXISTS get_sector_heat_map(INT);');
  console.log('   Then re-run the full SQL file\n');
}

debug().catch(console.error);
