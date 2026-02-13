const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  // Query startups with signals
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('name, total_god_score, enhanced_god_score, psychological_multiplier, is_oversubscribed, has_followon, fomo_signal_strength, conviction_signal_strength')
    .or('is_oversubscribed.eq.true,has_followon.eq.true')
    .order('enhanced_god_score', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('\n📊 Top 10 Startups with Psychological Signals:\n');
  data.forEach(s => {
    console.log(`${s.name}:`);
    console.log(`  Base GOD: ${s.total_god_score}`);
    console.log(`  Enhanced: ${s.enhanced_god_score}`);
    console.log(`  Multiplier/Bonus: ${s.psychological_multiplier}`);
    if (s.is_oversubscribed) console.log(`  🚀 Oversubscribed (${s.fomo_signal_strength})`);
    if (s.has_followon) console.log(`  💎 Follow-on (${s.conviction_signal_strength})`);
    console.log('');
  });
})();
