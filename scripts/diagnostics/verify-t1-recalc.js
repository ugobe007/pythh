#!/usr/bin/env node
/** Verify T1 recalc results — post-v2+#3 distribution check */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  const { data, error } = await sb.from('startup_uploads')
    .select('name, total_god_score, enhanced_god_score, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, risk_signal_strength')
    .eq('status', 'approved');

  if (error) { console.error('DB Error:', error.message); return; }

  const scores = data.map(s => s.total_god_score || 0);
  const below40 = scores.filter(s => s < 40).length;
  const at40 = scores.filter(s => s === 40).length;
  const f41_59 = scores.filter(s => s > 40 && s < 60).length;
  const f60plus = scores.filter(s => s >= 60).length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);

  console.log('\n  POST-T1 RECALC DISTRIBUTION');
  console.log('  ═══════════════════════════════');
  console.log('  Total approved:', scores.length);
  console.log('  Below 40:', below40, below40 > 0 ? '⚠️  FLOOR VIOLATIONS' : '✅ Floor holds');
  console.log('  At 40:', at40, `(${((at40 / scores.length) * 100).toFixed(1)}%)`);
  console.log('  41-59:', f41_59, `(${((f41_59 / scores.length) * 100).toFixed(1)}%)`);
  console.log('  60+:', f60plus, `(${((f60plus / scores.length) * 100).toFixed(1)}%)`);
  console.log('  Min:', min, '| Max:', max, '| Avg:', avg);

  // Degree classification
  const freshman = scores.filter(s => s >= 40 && s <= 44).length;
  const bachelor = scores.filter(s => s >= 45 && s <= 59).length;
  const master = scores.filter(s => s >= 60 && s <= 79).length;
  const phd = scores.filter(s => s >= 80).length;

  console.log('\n  DEGREE CLASSIFICATION:');
  console.log(`  Freshman (40-44): ${freshman} (${((freshman / scores.length) * 100).toFixed(1)}%)`);
  console.log(`  Bachelor (45-59): ${bachelor} (${((bachelor / scores.length) * 100).toFixed(1)}%)`);
  console.log(`  Master  (60-79):  ${master} (${((master / scores.length) * 100).toFixed(1)}%)`);
  console.log(`  PhD     (80+):    ${phd} (${((phd / scores.length) * 100).toFixed(1)}%)`);

  // Psych signal startups
  const psych = data.filter(s => 
    (s.fomo_signal_strength || 0) > 0 || 
    (s.conviction_signal_strength || 0) > 0 ||
    (s.urgency_signal_strength || 0) > 0 ||
    (s.risk_signal_strength || 0) > 0
  );

  console.log('\n  PSYCH SIGNAL STARTUPS (' + psych.length + '):');
  for (const s of psych) {
    console.log(`    ${(s.name || 'Unknown').substring(0, 30).padEnd(30)} | GOD: ${s.total_god_score} | Enhanced: ${s.enhanced_god_score} | F:${s.fomo_signal_strength || 0} C:${s.conviction_signal_strength || 0} U:${s.urgency_signal_strength || 0} R:${s.risk_signal_strength || 0}`);
  }
  console.log('');
})();
