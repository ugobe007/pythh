#!/usr/bin/env node
/** Full distribution check with pagination */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  // Paginate to get ALL approved
  let all = [];
  let page = 0;
  while (true) {
    const { data, error } = await sb.from('startup_uploads')
      .select('total_god_score, enhanced_god_score, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, risk_signal_strength, name')
      .eq('status', 'approved')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error) { console.error(error.message); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const scores = all.map(s => s.total_god_score || 0);
  const below40 = scores.filter(s => s < 40).length;
  const at40 = scores.filter(s => s === 40).length;
  const f41_44 = scores.filter(s => s >= 41 && s <= 44).length;
  const f45_59 = scores.filter(s => s >= 45 && s <= 59).length;
  const f60_79 = scores.filter(s => s >= 60 && s <= 79).length;
  const f80 = scores.filter(s => s >= 80).length;
  const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);

  console.log('\n  FULL RECALC VERIFICATION (ALL APPROVED STARTUPS)');
  console.log('  ══════════════════════════════════════════════════');
  console.log(`  Total: ${all.length}`);
  console.log(`  Below 40: ${below40} ${below40 > 0 ? '⚠️' : '✅'}`);
  console.log(`  At 40: ${at40} (${((at40 / all.length) * 100).toFixed(1)}%)`);
  console.log(`  41-44 (Freshman above floor): ${f41_44} (${((f41_44 / all.length) * 100).toFixed(1)}%)`);
  console.log(`  45-59 (Bachelor): ${f45_59} (${((f45_59 / all.length) * 100).toFixed(1)}%)`);
  console.log(`  60-79 (Master): ${f60_79} (${((f60_79 / all.length) * 100).toFixed(1)}%)`);
  console.log(`  80+   (PhD): ${f80} (${((f80 / all.length) * 100).toFixed(1)}%)`);
  console.log(`  Min: ${Math.min(...scores)} | Max: ${Math.max(...scores)} | Avg: ${avg}`);

  console.log('\n  DEGREE SUMMARY:');
  const freshman = at40 + f41_44;
  console.log(`  Freshman (40-44): ${freshman} (${((freshman / all.length) * 100).toFixed(1)}%)`);
  console.log(`  Bachelor (45-59): ${f45_59} (${((f45_59 / all.length) * 100).toFixed(1)}%)`);
  console.log(`  Master  (60-79):  ${f60_79} (${((f60_79 / all.length) * 100).toFixed(1)}%)`);
  console.log(`  PhD     (80+):    ${f80} (${((f80 / all.length) * 100).toFixed(1)}%)`);

  // Psych signals
  const psych = all.filter(s =>
    (s.fomo_signal_strength || 0) > 0 ||
    (s.conviction_signal_strength || 0) > 0 ||
    (s.urgency_signal_strength || 0) > 0 ||
    (s.risk_signal_strength || 0) > 0
  );
  console.log(`\n  PSYCH SIGNAL STARTUPS: ${psych.length}`);
  for (const s of psych) {
    const signals = [];
    if (s.fomo_signal_strength > 0) signals.push(`F:${s.fomo_signal_strength}`);
    if (s.conviction_signal_strength > 0) signals.push(`C:${s.conviction_signal_strength}`);
    if (s.urgency_signal_strength > 0) signals.push(`U:${s.urgency_signal_strength}`);
    if (s.risk_signal_strength > 0) signals.push(`R:${s.risk_signal_strength}`);
    console.log(`    ${(s.name || '?').substring(0, 30).padEnd(30)} | GOD: ${s.total_god_score} | Enh: ${s.enhanced_god_score} | ${signals.join(' ')}`);
  }
  console.log('');
})();
