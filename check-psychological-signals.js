const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSignals() {
  console.log('🔍 Checking startups with psychological signals...\n');

  // Check startups with signal flags set
  const { data: withFlags, error: flagError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, enhanced_god_score, psychological_multiplier, is_oversubscribed, has_followon, is_competitive, is_bridge_round, fomo_signal_strength, conviction_signal_strength')
    .or('is_oversubscribed.eq.true,has_followon.eq.true,is_competitive.eq.true,is_bridge_round.eq.true')
    .order('total_god_score', { ascending: false });

  if (flagError) {
    console.error('Error:', flagError.message);
    process.exit(1);
  }

  console.log(`Found ${withFlags.length} startups with signal flags:\n`);
  
  for (const startup of withFlags.slice(0, 20)) {
    const signals = [];
    if (startup.is_oversubscribed) signals.push(`🚀 FOMO (${startup.fomo_signal_strength || 0})`);
    if (startup.has_followon) signals.push(`💎 Conviction (${startup.conviction_signal_strength || 0})`);
    if (startup.is_competitive) signals.push(`⚡ Urgency`);
    if (startup.is_bridge_round) signals.push(`🌉 Risk`);

    console.log(`${startup.name}`);
    console.log(`  GOD: ${startup.total_god_score || 0} → Enhanced: ${startup.enhanced_god_score || 0}`);
    console.log(`  Multiplier: ${startup.psychological_multiplier || 1.0}`);
    console.log(`  Signals: ${signals.join(', ')}`);
    console.log('');
  }
}

checkSignals().then(() => process.exit(0)).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
