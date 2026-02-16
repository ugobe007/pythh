/**
 * T2 VERIFICATION: Post-momentum distribution check
 * Run: npx tsx scripts/diagnostics/verify-t2-recalc.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function verify() {
  // Fetch all approved startups with pagination
  let all: any[] = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, enhanced_god_score, psychological_multiplier')
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`\n📊 T2 POST-MOMENTUM VERIFICATION (${all.length} approved startups)`);
  console.log('═'.repeat(60));

  // Floor violations
  const belowFloor = all.filter(s => s.total_god_score < 40);
  console.log(`\n🛡️  Floor violations (< 40): ${belowFloor.length}`);
  if (belowFloor.length > 0) {
    belowFloor.slice(0, 5).forEach(s => console.log(`  ❌ ${s.name}: ${s.total_god_score}`));
  }

  // Distribution
  const scores = all.map(s => s.total_god_score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const min = Math.min(...scores);
  const max = Math.max(...scores);

  console.log(`\n📈 Distribution:`);
  console.log(`  Min: ${min} | Max: ${max} | Avg: ${avg.toFixed(1)}`);

  // Degree classification
  const phd = all.filter(s => s.total_god_score >= 80);
  const masters = all.filter(s => s.total_god_score >= 60 && s.total_god_score < 80);
  const bachelors = all.filter(s => s.total_god_score >= 45 && s.total_god_score < 60);
  const freshman = all.filter(s => s.total_god_score >= 40 && s.total_god_score < 45);

  console.log(`\n🎓 Degree Classification:`);
  console.log(`  PhD (80+):       ${phd.length} (${(phd.length / all.length * 100).toFixed(1)}%)`);
  console.log(`  Masters (60-79): ${masters.length} (${(masters.length / all.length * 100).toFixed(1)}%)`);
  console.log(`  Bachelors (45-59): ${bachelors.length} (${(bachelors.length / all.length * 100).toFixed(1)}%)`);
  console.log(`  Freshman (40-44): ${freshman.length} (${(freshman.length / all.length * 100).toFixed(1)}%)`);

  // Histogram (5-point buckets)
  console.log(`\n📊 Histogram (5-point buckets):`);
  const buckets: { [key: string]: number } = {};
  for (let i = 40; i <= 95; i += 5) {
    const key = `${i}-${i + 4}`;
    buckets[key] = all.filter(s => s.total_god_score >= i && s.total_god_score < i + 5).length;
  }
  buckets['100'] = all.filter(s => s.total_god_score === 100).length;

  for (const [range, count] of Object.entries(buckets)) {
    if (count > 0) {
      const bar = '█'.repeat(Math.ceil(count / 50));
      console.log(`  ${range.padEnd(7)} ${String(count).padStart(5)} ${bar}`);
    }
  }

  // Top 20
  console.log(`\n🏆 Top 20:`);
  all.slice(0, 20).forEach((s, i) => {
    const psych = s.psychological_multiplier ? ` (psych: ${s.psychological_multiplier.toFixed(2)})` : '';
    console.log(`  ${String(i + 1).padStart(2)}. ${s.name?.substring(0, 40).padEnd(40)} ${s.total_god_score}${psych}`);
  });

  // Compare with pre-T2 (Freshman was 87.1%)
  console.log(`\n📊 Pre-T2 vs Post-T2 Comparison:`);
  console.log(`  Pre-T2 Freshman: 87.1% → Post-T2: ${(freshman.length / all.length * 100).toFixed(1)}%`);
  console.log(`  Pre-T2 Bachelor:  11.8% → Post-T2: ${(bachelors.length / all.length * 100).toFixed(1)}%`);
  console.log(`  Pre-T2 Masters:    1.1% → Post-T2: ${(masters.length / all.length * 100).toFixed(1)}%`);
  console.log(`  Pre-T2 PhD:        0.0% → Post-T2: ${(phd.length / all.length * 100).toFixed(1)}%`);
}

verify().catch(console.error);
