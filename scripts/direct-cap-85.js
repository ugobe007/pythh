// Directly cap the 4 startups that exceed 85 limit
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function directCap() {
  console.log('🔧 DIRECTLY CAPPING STARTUPS AT 85\n');
  
  // Get startups over 85
  const { data: overCap } = await supabase
    .from('startup_uploads')
    .select('id, name, enhanced_god_score')
    .eq('status', 'approved')
    .gt('enhanced_god_score', 85);
  
  console.log(`Found ${overCap.length} startups to cap:\n`);
  overCap.forEach(s => console.log(`   ${s.name}: ${s.enhanced_god_score} → 85`));
  
  console.log('\nApplying cap...\n');
  
  // Update enhanced_god_score to 85 for all
  const { error } = await supabase
    .from('startup_uploads')
    .update({ enhanced_god_score: 85 })
    .gt('enhanced_god_score', 85);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('✅ Capped all startups at 85\n');
  
  // Verify
  const { count: stillOver } = await supabase
    .from('startup_uploads')
    .select('id', { count: 'exact', head: true })
    .gt('enhanced_god_score', 85);
  
  console.log(`Startups still over 85: ${stillOver}`);
  console.log(`${stillOver === 0 ? '✅ SUCCESS - All startups now ≤ 85' : '❌ FAILED'}\n`);
  
  // Show new top 10
  const { data: top10 } = await supabase
    .from('startup_uploads')
    .select('name, enhanced_god_score')
    .eq('status', 'approved')
    .order('enhanced_god_score', { ascending: false })
    .limit(10);
  
  console.log('📊 New top 10:\n');
  top10.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name.substring(0, 30).padEnd(30)} ${s.enhanced_god_score}`);
  });
}

directCap().catch(console.error);
