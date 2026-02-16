/**
 * PhD CEILING DIAGNOSTIC
 * Why can't any startup break 80? What's the math ceiling?
 * Run: npx tsx scripts/diagnostics/phd-ceiling-analysis.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore } from '../../server/services/startupScoringService';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function analyze() {
  // Fetch top 50 startups
  let all: any[] = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('*')
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  console.log(`\n🔬 PhD CEILING DIAGNOSTIC (${all.length} approved startups)`);
  console.log('═'.repeat(70));

  // 1. Current ceiling
  const scores = all.map(s => s.total_god_score);
  const top20 = all.slice(0, 20);
  
  console.log(`\n📈 Current Ceiling:`);
  console.log(`  Max: ${Math.max(...scores)} | Top 5 avg: ${(scores.slice(0, 5).reduce((a,b) => a+b, 0) / 5).toFixed(1)}`);
  console.log(`  Startups at 70+: ${scores.filter(s => s >= 70).length}`);
  console.log(`  Startups at 65+: ${scores.filter(s => s >= 65).length}`);
  console.log(`  Startups at 60+: ${scores.filter(s => s >= 60).length}`);

  // 2. Decompose top 20 scores — what's the raw GOD score vs additive layers?
  console.log(`\n📊 TOP 20 SCORE DECOMPOSITION:`);
  console.log(`${'Name'.padEnd(35)} GOD  Sig  Mom  Boot  Psych  Final`);
  console.log(`${'─'.repeat(35)} ${'───'.padEnd(5)} ${'───'.padEnd(5)} ${'───'.padEnd(5)} ${'────'.padEnd(6)} ${'─────'.padEnd(7)} ${'─────'}`);

  for (const s of top20) {
    const ext = s.extracted_data || {};
    const profile = {
      ...s, ...ext,
      mrr: s.mrr || ext.mrr,
      arr: s.arr || ext.arr,
      revenue: ext.revenue,
      customer_count: s.customer_count || ext.customer_count || ext.customers,
      growth_rate_monthly: s.growth_rate_monthly || ext.growth_rate,
      team_size: s.team_size || ext.team_size || ext.founders_count,
      has_technical_cofounder: s.has_technical_cofounder || ext.has_technical_cofounder,
      founder_avg_age: s.founder_avg_age,
      is_launched: s.is_launched || ext.is_launched || ext.launched,
      has_demo: s.has_demo || ext.has_demo || ext.demo_available,
      founded_date: s.founded_date || s.created_at || ext.founded_date,
      value_proposition: s.value_proposition || s.tagline || ext.value_proposition,
    };

    const result = calculateHotScore(profile);
    const rawGOD = Math.round(result.total * 10);
    const signalsBonus = Math.min(s.signals_bonus || 0, 10);
    const psychBonus = (result.psychological_multiplier || 0);
    
    // Momentum — estimate from current score minus raw components
    const estimatedMomentum = s.total_god_score - rawGOD - signalsBonus;
    
    console.log(
      `${(s.name || '').substring(0, 34).padEnd(35)} ` +
      `${String(rawGOD).padStart(3)}  ` +
      `${signalsBonus.toFixed(1).padStart(4)}  ` +
      `${estimatedMomentum > 0 ? '+' + estimatedMomentum.toFixed(0) : '  0'}   ` +
      `${(s.bootstrap_score || 0).toFixed(0).padStart(4)}  ` +
      `${psychBonus.toFixed(2).padStart(6)}  ` +
      `${String(s.total_god_score).padStart(5)}`
    );
  }

  // 3. RAW GOD score math ceiling analysis
  console.log(`\n\n🧮 RAW GOD SCORE MATH (from startupScoringService.ts):`);
  console.log(`  Formula: rawTotal / 25.0 × 10 (capped at 10) → × 10 for 0-100`);
  console.log(`  Divisor: 25.0`);
  console.log(`  Max rawTotal possible: ~21.0 (see layer budget below)`);
  console.log(`  Theoretical max raw GOD: (21.0 / 25.0) × 100 = 84`);
  console.log(`  With additive layers: 84 + 8 (momentum) + 10 (signals) + 13 (psych) = 100+`);
  console.log(`  But PRACTICAL max depends on DATA AVAILABILITY`);

  // 4. What raw GOD scores do the top startups actually achieve?
  console.log(`\n📊 RAW GOD SCORE DISTRIBUTION (before additive layers):`);
  const rawScores: number[] = [];
  for (const s of all) {
    const ext = s.extracted_data || {};
    const profile = { ...s, ...ext };
    const result = calculateHotScore(profile);
    rawScores.push(Math.round(result.total * 10));
  }
  rawScores.sort((a, b) => b - a);
  
  console.log(`  Max raw GOD: ${rawScores[0]}`);
  console.log(`  Top 10 raw: ${rawScores.slice(0, 10).join(', ')}`);
  console.log(`  Top 50 raw: avg ${(rawScores.slice(0, 50).reduce((a,b) => a+b, 0) / 50).toFixed(1)}`);
  console.log(`  Raw 60+: ${rawScores.filter(s => s >= 60).length}`);
  console.log(`  Raw 50+: ${rawScores.filter(s => s >= 50).length}`);
  console.log(`  Raw 40+: ${rawScores.filter(s => s >= 40).length}`);

  // 5. Layer budget analysis
  console.log(`\n📐 LAYER BUDGET (max raw points per dimension):`);
  console.log(`  baseBoost:       4.2  (minimum guaranteed)`);
  console.log(`  team_execution:  3.0`);
  console.log(`  product_vision:  2.0`);
  console.log(`  founder_courage: 1.5`);
  console.log(`  market_insight:  1.5`);
  console.log(`  team_age:        1.0`);
  console.log(`  traction:        3.0`);
  console.log(`  market:          2.0`);
  console.log(`  product:         2.0`);
  console.log(`  redFlags:       -2.0 (subtractive)`);
  console.log(`  ─────────────────────`);
  console.log(`  Max theoretical: 20.2 (with base) or ~21.0 (with vibe bonus)`);
  console.log(`  Divisor:         25.0`);
  console.log(`  Gap:             25.0 - 21.0 = 4.0 pts UNREACHABLE by design`);
  console.log(`  ═══════════════════════════════════════`);
  console.log(`  This means raw GOD caps at ~84/100 even with PERFECT data`);
  console.log(`  Need additive layers (momentum/signals/psych) to reach 84+`);

  // 6. What would it take to reach PhD?
  console.log(`\n\n🎓 WHAT WOULD IT TAKE TO REACH PhD (80+)?`);
  console.log(`  Current max final score: ${Math.max(...scores)}`);
  console.log(`  Gap to PhD: ${80 - Math.max(...scores)} points`);
  console.log(`  `);
  console.log(`  Path 1: Higher raw GOD → needs divisor < 25.0`);
  console.log(`    If divisor = 22.0 → max raw GOD = (21.0/22.0)×100 = 95`);
  console.log(`    If divisor = 20.0 → max raw GOD = (21.0/20.0)×100 = 100 (capped)`);
  console.log(`  `);
  console.log(`  Path 2: More additive layers → already have momentum + signals + psych`);
  console.log(`    72 (current max) + 8 (max momentum) = 80 ✅ (but needs perfect momentum)`);
  console.log(`  `);
  console.log(`  Path 3: Lower PhD threshold → e.g., 75+ instead of 80+`);
  console.log(`    Would give ${scores.filter(s => s >= 75).length} PhDs (at 75+)`);
  console.log(`    Would give ${scores.filter(s => s >= 70).length} PhDs (at 70+)`);

  // 7. Signals bonus analysis for top startups
  console.log(`\n📊 SIGNALS BONUS for Top 30:`);
  for (const s of top20) {
    const sig = s.signals_bonus || 0;
    console.log(`  ${(s.name || '').substring(0, 30).padEnd(30)} signals: ${sig.toFixed(1)} | GOD: ${s.total_god_score}`);
  }
}

analyze().catch(console.error);
