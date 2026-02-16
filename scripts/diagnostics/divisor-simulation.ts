/**
 * DIVISOR SIMULATION: Compare A (21.0), B (PhD→70+), C (22.0) against current (25.0)
 * Run: npx tsx scripts/diagnostics/divisor-simulation.ts
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { calculateHotScore } from '../../server/services/startupScoringService';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

const { calculateMomentumScore } = require('../../server/services/momentumScoringService');

function simulate(rawGOD10: number, signalsBonus: number, momentumBonus: number, psychBonus: number, divisor: number): number {
  // rawGOD10 is on 0-10 scale from calculateHotScore
  // Re-normalize with different divisor: the raw total (before division) = rawGOD10 * (25.0 / 10)
  // Then re-divide by new divisor
  const rawTotal = rawGOD10 * 25.0 / 10; // recover original raw total
  const newGOD = Math.min(rawTotal / divisor, 1.0) * 100; // re-normalize
  const rawFinal = Math.round(newGOD + signalsBonus + momentumBonus);
  const finalScore = Math.min(Math.max(rawFinal, 40), 100);
  const enhanced = Math.max(Math.min(Math.round(finalScore + (psychBonus * 10)), 100), 40);
  return finalScore; // Use finalScore (not enhanced) to match current behavior
}

function classify(score: number, phdThreshold = 80) {
  if (score >= phdThreshold) return 'PhD';
  if (score >= 60) return 'Masters';
  if (score >= 45) return 'Bachelors';
  return 'Freshman';
}

async function run() {
  // Fetch all approved startups
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

  console.log(`\n🔬 DIVISOR SIMULATION — ${all.length} approved startups`);
  console.log('═'.repeat(80));

  // For each startup, compute raw GOD (on 0-10 scale), signals, momentum, psych
  const results: any[] = [];
  for (const s of all) {
    const ext = s.extracted_data || {};
    const profile = { ...s, ...ext };
    const hotResult = calculateHotScore(profile);
    const rawGOD10 = hotResult.total; // 0-10 scale
    const signalsBonus = Math.min(s.signals_bonus || 0, 10);
    const psychBonus = hotResult.psychological_multiplier || 0;

    // Momentum
    let momentumBonus = 0;
    try {
      const momResult = calculateMomentumScore(s, { scoreHistory: [] });
      if (momResult.applied) momentumBonus = momResult.total;
    } catch {}

    // Current (divisor 25)
    const current = simulate(rawGOD10, signalsBonus, momentumBonus, psychBonus, 25.0);
    // Option A (divisor 21)
    const optA = simulate(rawGOD10, signalsBonus, momentumBonus, psychBonus, 21.0);
    // Option C (divisor 22)
    const optC = simulate(rawGOD10, signalsBonus, momentumBonus, psychBonus, 22.0);

    results.push({
      name: s.name,
      rawGOD10,
      signalsBonus,
      momentumBonus,
      current,
      optA,    // divisor 21
      optC,    // divisor 22
      optB70: current, // same scores, just reclassified at 70+
    });
  }

  // Sort by Option A descending
  results.sort((a, b) => b.optA - a.optA);

  // ── Distribution comparison ──
  const scenarios = [
    { label: 'CURRENT (div=25, PhD=80+)', scores: results.map(r => r.current), phdThreshold: 80 },
    { label: 'OPTION A (div=21, PhD=80+)', scores: results.map(r => r.optA), phdThreshold: 80 },
    { label: 'OPTION B (div=25, PhD=70+)', scores: results.map(r => r.current), phdThreshold: 70 },
    { label: 'OPTION C (div=22, PhD=80+)', scores: results.map(r => r.optC), phdThreshold: 80 },
  ];

  console.log(`\n📊 DEGREE CLASSIFICATION COMPARISON:`);
  console.log(`${'Scenario'.padEnd(32)} PhD      Masters   Bachelor  Freshman  Avg    Max`);
  console.log('─'.repeat(95));

  for (const sc of scenarios) {
    const phd = sc.scores.filter(s => s >= sc.phdThreshold).length;
    const masters = sc.scores.filter(s => s >= 60 && s < sc.phdThreshold).length;
    const bach = sc.scores.filter(s => s >= 45 && s < 60).length;
    const fresh = sc.scores.filter(s => s >= 40 && s < 45).length;
    const avg = sc.scores.reduce((a, b) => a + b, 0) / sc.scores.length;
    const max = Math.max(...sc.scores);

    console.log(
      `${sc.label.padEnd(32)} ` +
      `${String(phd).padStart(4)} (${(phd/all.length*100).toFixed(1)}%)  ` +
      `${String(masters).padStart(4)} (${(masters/all.length*100).toFixed(1)}%)  ` +
      `${String(bach).padStart(4)} (${(bach/all.length*100).toFixed(1)}%)  ` +
      `${String(fresh).padStart(4)} (${(fresh/all.length*100).toFixed(1)}%)  ` +
      `${avg.toFixed(1)}  ${max}`
    );
  }

  // ── Histogram for each option ──
  for (const sc of scenarios) {
    console.log(`\n📊 ${sc.label} — Histogram:`);
    for (let i = 40; i <= 95; i += 5) {
      const count = sc.scores.filter(s => s >= i && s < i + 5).length;
      if (count > 0) {
        const bar = '█'.repeat(Math.ceil(count / 50));
        console.log(`  ${i}-${i + 4}  ${String(count).padStart(5)} ${bar}`);
      }
    }
    const at100 = sc.scores.filter(s => s === 100).length;
    if (at100 > 0) console.log(`  100    ${String(at100).padStart(5)} ${'█'.repeat(Math.ceil(at100 / 50))}`);
  }

  // ── Top 20 for Option A ──
  console.log(`\n🏆 OPTION A (div=21) — Top 20:`);
  console.log(`${'#'.padStart(3)} ${'Name'.padEnd(35)} Raw→   Cur→  OptA  Δ    Sig   Mom`);
  console.log('─'.repeat(80));
  for (let i = 0; i < 20; i++) {
    const r = results[i];
    const delta = r.optA - r.current;
    console.log(
      `${String(i + 1).padStart(3)} ${(r.name || '').substring(0, 34).padEnd(35)} ` +
      `${(r.rawGOD10 * 10).toFixed(0).padStart(3)}    ` +
      `${String(r.current).padStart(3)}   ` +
      `${String(r.optA).padStart(3)}  ` +
      `${(delta >= 0 ? '+' : '') + delta}`.padStart(4) + `   ` +
      `${r.signalsBonus.toFixed(1).padStart(4)}  ` +
      `${r.momentumBonus.toFixed(1).padStart(4)}`
    );
  }

  // ── Movement analysis ──
  console.log(`\n📊 OPTION A — Score Movement:`);
  const deltas = results.map(r => r.optA - r.current);
  const noChange = deltas.filter(d => d === 0).length;
  const up1_3 = deltas.filter(d => d >= 1 && d <= 3).length;
  const up4_7 = deltas.filter(d => d >= 4 && d <= 7).length;
  const up8_15 = deltas.filter(d => d >= 8 && d <= 15).length;
  const up16 = deltas.filter(d => d >= 16).length;
  console.log(`  No change (floor-bound): ${noChange} (${(noChange/all.length*100).toFixed(1)}%)`);
  console.log(`  +1 to +3:               ${up1_3} (${(up1_3/all.length*100).toFixed(1)}%)`);
  console.log(`  +4 to +7:               ${up4_7} (${(up4_7/all.length*100).toFixed(1)}%)`);
  console.log(`  +8 to +15:              ${up8_15} (${(up8_15/all.length*100).toFixed(1)}%)`);
  console.log(`  +16 or more:            ${up16} (${(up16/all.length*100).toFixed(1)}%)`);

  // ── Tier jumps ──
  console.log(`\n📊 OPTION A — Tier Promotions:`);
  let freshToBach = 0, bachToMasters = 0, mastersToPhd = 0;
  for (const r of results) {
    const curTier = classify(r.current, 80);
    const newTier = classify(r.optA, 80);
    if (curTier === 'Freshman' && newTier === 'Bachelors') freshToBach++;
    if (curTier === 'Freshman' && (newTier === 'Masters' || newTier === 'PhD')) freshToBach++;
    if (curTier === 'Bachelors' && newTier === 'Masters') bachToMasters++;
    if (curTier === 'Bachelors' && newTier === 'PhD') { bachToMasters++; mastersToPhd++; }
    if (curTier === 'Masters' && newTier === 'PhD') mastersToPhd++;
  }
  console.log(`  Freshman → Bachelor:  ${freshToBach}`);
  console.log(`  Bachelor → Masters:   ${bachToMasters}`);
  console.log(`  Masters → PhD:        ${mastersToPhd}`);
}

run().catch(console.error);
