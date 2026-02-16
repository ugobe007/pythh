// Debug why startups with signal flags don't have psychological bonus
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function debugSignals() {
  console.log('🔍 PSYCHOLOGICAL SIGNALS DEBUG\n');
  
  // Get startups with signal flags set
  const { data: flagged, error } = await supabase
    .from('startup_uploads')
    .select('id, name, is_oversubscribed, has_followon, is_competitive, is_bridge_round, psychological_multiplier, enhanced_god_score, total_god_score')
    .eq('status', 'approved')
    .or('is_oversubscribed.eq.true,has_followon.eq.true,is_competitive.eq.true,is_bridge_round.eq.true')
    .limit(10);
  
  if (error) {
    console.error('Error fetching flagged startups:', error);
    return;
  }
  
  console.log(`Startups with flags: ${flagged.length}\n`);
  
  for (const s of flagged) {
    console.log(`${s.name}:`);
    console.log(`  Flags: oversubscribed=${s.is_oversubscribed} followon=${s.has_followon} competitive=${s.is_competitive} bridge=${s.is_bridge_round}`);
    console.log(`  Psych multiplier: ${s.psychological_multiplier}`);
    console.log(`  GOD: ${s.total_god_score} → Enhanced: ${s.enhanced_god_score}`);
    
    // Check if they have psychological_signals records
    const { data: signals } = await supabase
      .from('psychological_signals')
      .select('signal_type, signal_strength, detected_at')
      .eq('startup_id', s.id);
    
    console.log(`  Signals in DB: ${signals?.length || 0}`);
    if (signals && signals.length > 0) {
      signals.forEach(sig => {
        const age = Math.floor((Date.now() - new Date(sig.detected_at).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`    - ${sig.signal_type}: ${sig.signal_strength} (detected ${age} days ago)`);
      });
    }
    console.log('');
  }
  
  // Test the function directly on one startup
  if (flagged.length > 0) {
    console.log('\n📊 Testing calculate_psychological_multiplier() function:\n');
    const testStartup = flagged[0];
    
    const { data: result, error: fnError } = await supabase.rpc(
      'calculate_psychological_multiplier',
      { startup_uuid: testStartup.id }
    );
    
    if (fnError) {
      console.error(`❌ Function error: ${fnError.message}`);
    } else {
      console.log(`✅ Function returned: ${result} for ${testStartup.name}`);
      console.log(`   Current DB value: ${testStartup.psychological_multiplier}`);
      console.log(`   Match: ${result === testStartup.psychological_multiplier ? '✅' : '❌'}`);
    }
  }
}

debugSignals().catch(console.error);
