// Apply 85 cap enforcement migration and fix all startups over the cap
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function enforce85Cap() {
  console.log('🚨 ENFORCING 85 CAP ON ENHANCED SCORES\n');
  
  // Step 1: Apply migration
  console.log('1️⃣  Applying migration...\n');
  const sql = fs.readFileSync('supabase/migrations/20260213_enforce_85_cap.sql', 'utf8');
  
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('DO $$'));
  
  for (const stmt of statements) {
    const { error } = await supabase.rpc('exec_sql', { sql_query: stmt + ';' });
    if (error && !error.message.includes('does not exist')) {
      console.error(`   ❌ Error: ${error.message}`);
    }
  }
  
  console.log('   ✅ Migration applied\n');
  
  // Step 2: Find startups exceeding 85
  console.log('2️⃣  Finding startups with enhanced > 85...\n');
  const { data: overCap, error } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, signals_bonus, psychological_multiplier, enhanced_god_score')
    .eq('status', 'approved')
    .gt('enhanced_god_score', 85);
  
  if (error) {
    console.error('Error fetching startups:', error);
    return;
  }
  
  console.log(`   Found ${overCap.length} startups exceeding 85 cap\n`);
  
  if (overCap.length === 0) {
    console.log('✅ No startups exceed cap!\n');
    return;
  }
  
  // Show them
  overCap.forEach(s => {
    const signals = s.signals_bonus || 0;
    const psych = (s.psychological_multiplier || 0) * 10;
    console.log(`   ${s.name}: Enhanced ${s.enhanced_god_score}`);
    console.log(`      Base: ${s.total_god_score} + Signals: ${signals.toFixed(1)} + Psych: ${psych.toFixed(1)} = ${s.total_god_score + signals + psych}`);
  });
  
  // Step 3: Trigger updates to apply cap
  console.log(`\n3️⃣  Triggering updates to enforce cap...\n`);
  
  let fixed = 0;
  for (const startup of overCap) {
    const { error: updateError } = await supabase
      .from('startup_uploads')
      .update({ total_god_score: startup.total_god_score })
      .eq('id', startup.id);
    
    if (updateError) {
      console.error(`   ❌ ${startup.name}: ${updateError.message}`);
    } else {
      fixed++;
    }
  }
  
  console.log(`   ✅ Triggered updates on ${fixed} startups\n`);
  
  // Step 4: Verify
  console.log('4️⃣  Verifying results...\n');
  
  const { count: stillOverCap } = await supabase
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'approved')
    .gt('enhanced_god_score', 85);
  
  console.log(`   Startups still over 85: ${stillOverCap}`);
  console.log(`   ${stillOverCap === 0 ? '✅ All startups now capped at 85!' : '⚠️  Some startups still exceed cap'}\n`);
  
  // Show final distribution
  const { data: top10 } = await supabase
    .from('startup_uploads')
    .select('name, enhanced_god_score')
    .eq('status', 'approved')
    .order('enhanced_god_score', { ascending: false })
    .limit(10);
  
  console.log('📊 Top 10 startups by enhanced score:\n');
  top10.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name}: ${s.enhanced_god_score}`);
  });
}

enforce85Cap().catch(console.error);
