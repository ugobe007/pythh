#!/usr/bin/env node
/**
 * PSYCHOLOGICAL BONUS MATH AUDIT
 * ================================
 * READ-ONLY — does NOT modify any scores.
 *
 * Deep audit of the calculatePsychologicalBonus() formula:
 *   bonus = (FOMO × 0.5) + (Conviction × 0.5) + (Urgency × 0.3) - (Risk × 0.3)
 *   capped: [-0.3, +1.0]
 *
 * This script answers:
 *   1. What are the THEORETICAL min/max/ranges?
 *   2. What is the ACTUAL data distribution in the DB?
 *   3. Is the formula balanced? Do the weights make mathematical sense?
 *   4. What's the sensitivity? How much does each signal move the needle?
 *   5. How does psych bonus convert to GOD score points?
 *   6. Where are the formula's blind spots / asymmetries?
 *   7. Interaction analysis: how do signals combine?
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// ═══════════════════════════════════════════════════════════════════════════
// REPLICATE THE FORMULA EXACTLY (from startupScoringService.ts line 672)
// ═══════════════════════════════════════════════════════════════════════════

function calculatePsychologicalBonus(fomo, conviction, urgency, risk, oversubscribed, followon, competitive, bridge) {
  let bonus = 0;

  // FOMO Bonus (Oversubscription)
  if (oversubscribed && fomo) {
    bonus += fomo * 0.5;
  }

  // Conviction Bonus (Follow-On)
  if (followon && conviction) {
    bonus += conviction * 0.5;
  }

  // Urgency Bonus (Competitive)
  if (competitive && urgency) {
    bonus += urgency * 0.3;
  }

  // Risk Penalty (Bridge)
  if (bridge && risk) {
    bonus -= risk * 0.3;
  }

  // Cap
  return Math.max(-0.3, Math.min(1.0, bonus));
}

// ═══════════════════════════════════════════════════════════════════════════
// THEORETICAL ANALYSIS 
// ═══════════════════════════════════════════════════════════════════════════

function theoreticalAnalysis() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  1. THEORETICAL RANGE ANALYSIS');
  console.log('═══════════════════════════════════════════════════════════════');

  const formula = `  bonus = (FOMO × 0.5) + (Conviction × 0.5) + (Urgency × 0.3) - (Risk × 0.3)`;
  console.log(`\n  FORMULA: ${formula}`);
  console.log(`  INPUTS:  FOMO, Conviction, Urgency, Risk ∈ [0, 1.0]`);
  console.log(`  CAP:     bonus ∈ [-0.3, +1.0]   (on 0-10 scale)\n`);

  // Theoretical max/min (before cap)
  const rawMax = 1.0 * 0.5 + 1.0 * 0.5 + 1.0 * 0.3 - 0 * 0.3; // 1.3
  const rawMin = 0 + 0 + 0 - 1.0 * 0.3; // -0.3
  console.log(`  Raw max (before cap): ${rawMax.toFixed(1)} (FOMO=1, Conv=1, Urg=1, Risk=0)`);
  console.log(`  Raw min (before cap): ${rawMin.toFixed(1)} (FOMO=0, Conv=0, Urg=0, Risk=1)`);
  console.log(`  After cap:            [-0.3, +1.0]`);
  console.log(`  Effective range:       1.3 points on 0-10 scale`);
  console.log(`  → Converts to:        13 points on 0-100 GOD scale (×10)`);
  console.log();

  // But wait — recalculate-scores.ts uses (psychBonus × 10)
  console.log(`  ⚠️  CONVERSION CHAIN:`);
  console.log(`     calculatePsychologicalBonus() returns 0-10 scale value`);
  console.log(`     → stored in DB as "psychological_multiplier" column`);
  console.log(`     → recalculate-scores.ts: enhancedScore = final + (psychBonus × 10)`);
  console.log(`     → So +0.5 on 0-10 scale → +5 on 0-100 scale`);
  console.log(`     → And +1.0 (max) → +10 on 0-100 scale`);
  console.log();

  // Weight analysis
  console.log('  WEIGHT ANALYSIS:');
  console.log('  ┌──────────────┬────────┬──────────┬───────────┬───────────────────┐');
  console.log('  │ Signal       │ Weight │ Max Raw  │ Max /100  │ % of total range  │');
  console.log('  ├──────────────┼────────┼──────────┼───────────┼───────────────────┤');
  const components = [
    { name: 'FOMO', weight: 0.5, max: 0.5, sign: '+' },
    { name: 'Conviction', weight: 0.5, max: 0.5, sign: '+' },
    { name: 'Urgency', weight: 0.3, max: 0.3, sign: '+' },
    { name: 'Risk', weight: 0.3, max: 0.3, sign: '-' },
  ];
  const totalPositive = 0.5 + 0.5 + 0.3; // 1.3
  for (const c of components) {
    const maxGOD = c.max * 10;
    const pctOfRange = ((c.max / 1.3) * 100).toFixed(1);
    console.log(`  │ ${(c.sign + ' ' + c.name).padEnd(12)} │  ×${c.weight.toFixed(1)}  │   ${c.sign}${c.max.toFixed(1)}   │    ${c.sign}${maxGOD.toFixed(0).padStart(2)}    │      ${pctOfRange.padStart(5)}%       │`);
  }
  console.log('  └──────────────┴────────┴──────────┴───────────┴───────────────────┘');
  console.log();

  // PROBLEM: The cap clips the formula
  console.log('  ⚠️  CAP ASYMMETRY:');
  console.log(`     Positive cap: +1.0  (clips 0.3 from raw max of 1.3)`);
  console.log(`     Negative cap: -0.3  (matches raw min exactly)`);
  console.log(`     → When all 3 positive signals fire at max, you lose 0.3 pts (3 GOD pts)`);
  console.log(`     → Risk never clips — full range always applies`);
  console.log();

  // Sensitivity analysis
  console.log('  SENSITIVITY: How much does each signal move the needle?');
  console.log('  (Signal goes from 0 → 1.0, all others = 0, boolean gating assumed true)');
  const scenarios = [
    { label: 'FOMO only', f:1, c:0, u:0, r:0, ob:true, fo:false, co:false, br:false },
    { label: 'Conviction only', f:0, c:1, u:0, r:0, ob:false, fo:true, co:false, br:false },
    { label: 'Urgency only', f:0, c:0, u:1, r:0, ob:false, fo:false, co:true, br:false },
    { label: 'Risk only', f:0, c:0, u:0, r:1, ob:false, fo:false, co:false, br:true },
    { label: 'FOMO + Conv', f:1, c:1, u:0, r:0, ob:true, fo:true, co:false, br:false },
    { label: 'All positive', f:1, c:1, u:1, r:0, ob:true, fo:true, co:true, br:false },
    { label: 'All max', f:1, c:1, u:1, r:1, ob:true, fo:true, co:true, br:true },
    { label: 'FOMO+Risk', f:1, c:0, u:0, r:1, ob:true, fo:false, co:false, br:true },
    { label: 'Conv+Risk', f:0, c:1, u:0, r:1, ob:false, fo:true, co:false, br:true },
    { label: 'Moderate all', f:0.5, c:0.5, u:0.5, r:0.5, ob:true, fo:true, co:true, br:true },
  ];
  console.log('  ┌──────────────────┬───────────┬─────────────┬─────────────────────────┐');
  console.log('  │ Scenario         │ Raw bonus │ GOD impact  │ Notes                   │');
  console.log('  ├──────────────────┼───────────┼─────────────┼─────────────────────────┤');
  for (const s of scenarios) {
    const raw = calculatePsychologicalBonus(s.f, s.c, s.u, s.r, s.ob, s.fo, s.co, s.br);
    const god = (raw * 10).toFixed(0);
    const clipped = (s.label === 'All positive' || s.label === 'All max');
    const note = clipped ? 'CAP ACTIVE (raw would be higher)' : '';
    console.log(`  │ ${s.label.padEnd(16)} │   ${raw >= 0 ? '+' : ''}${raw.toFixed(2)}   │    ${god >= 0 ? '+' : ''}${god.padStart(3)}     │ ${note.padEnd(23)} │`);
  }
  console.log('  └──────────────────┴───────────┴─────────────┴─────────────────────────┘');
  console.log();

  // Mathematical issues
  console.log('  🔬 MATHEMATICAL ISSUES IDENTIFIED:\n');

  console.log('  ISSUE 1: BOOLEAN GATING BREAKS THE FORMULA');
  console.log('  ─────────────────────────────────────────────');
  console.log('  The formula requires BOTH a boolean flag AND a signal strength:');
  console.log('    if (startup.is_oversubscribed && startup.fomo_signal_strength) { ... }');
  console.log('  If fomo_signal_strength=0.8 but is_oversubscribed=false → bonus=0');
  console.log('  This means the boolean is a hard gate, not a smooth function.');
  console.log('  → Mathematically, this creates a discontinuity (step function, not curve).\n');

  console.log('  ISSUE 2: FOMO AND CONVICTION ARE EQUAL BUT SHOULDN\'T BE');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  Both use ×0.5 weight. But conviction (follow-on) is THE strongest');
  console.log('  trust signal in investing — existing investors with inside info doubling down.');
  console.log('  FOMO (oversubscription) can be manufactured ("we\'re 3x oversubscribed").');
  console.log('  → Conviction should weight higher than FOMO (e.g., ×0.7 vs ×0.4).\n');

  console.log('  ISSUE 3: CAP WASTES SIGNAL COMBINATION VALUE');
  console.log('  ──────────────────────────────────────────────');
  console.log('  Raw max (1.3) exceeds cap (1.0) by 0.3.');
  console.log('  A startup with ALL positive signals maxed gets the same score as one');
  console.log('  with FOMO=1.0 + Conviction=1.0 (already at 1.0 cap).');
  console.log('  Urgency is worthless at that point — its contribution is clipped away.\n');

  console.log('  ISSUE 4: SCALE MISMATCH IN THE PIPELINE');
  console.log('  ──────────────────────────────────────────');
  console.log('  calculatePsychologicalBonus() returns [-0.3, +1.0] (0-10 scale)');
  console.log('  Comments say "max +10 points" but actual max is +1.0 (which ×10 = +10 pts)');
  console.log('  Same function is used in calculateHotScore() as "enhancedTotal = total + bonus"');
  console.log('  BUT in recalculate-scores.ts it\'s "enhancedScore = final + (psychBonus × 10)"');
  console.log('  → psychBonus is on 0-10 scale when returned, then ×10 again = 0-100 scale conversion.');
  console.log('  → This is correct but confusing — the 0-10 scale comment is about the scoring context,');
  console.log('     not the return value range.\n');

  console.log('  ISSUE 5: RISK WEIGHT IS TOO LOW');
  console.log('  ──────────────────────────────────');
  console.log('  Risk (bridge round) max penalty = -0.3 = -3 GOD points.');
  console.log('  But a bridge round is a STRONG negative signal in investing.');
  console.log('  It means the startup missed milestones, couldn\'t raise a real round.');
  console.log('  -3 GOD points barely moves you within the Freshman tier (40-44).');
  console.log('  → Should be at least ×0.5 (= -5 GOD pts) to have meaningful impact.\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTUAL DATA ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════

async function actualDataAnalysis() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  2. ACTUAL DATA IN DATABASE');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Fetch all relevant signal columns
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, enhanced_god_score, psychological_multiplier, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, risk_signal_strength, is_oversubscribed, has_followon, is_competitive, is_bridge_round')
    .eq('status', 'approved');

  if (error) { console.error('DB error:', error.message); return; }

  const total = startups.length;
  console.log(`  Total approved startups: ${total}\n`);

  // Signal presence
  const hasFomo = startups.filter(s => s.fomo_signal_strength && s.fomo_signal_strength > 0);
  const hasConviction = startups.filter(s => s.conviction_signal_strength && s.conviction_signal_strength > 0);
  const hasUrgency = startups.filter(s => s.urgency_signal_strength && s.urgency_signal_strength > 0);
  const hasRisk = startups.filter(s => s.risk_signal_strength && s.risk_signal_strength > 0);
  const hasOversubscribed = startups.filter(s => s.is_oversubscribed === true);
  const hasFollowon = startups.filter(s => s.has_followon === true);
  const hasCompetitive = startups.filter(s => s.is_competitive === true);
  const hasBridge = startups.filter(s => s.is_bridge_round === true);
  const hasPsychMultiplier = startups.filter(s => s.psychological_multiplier && s.psychological_multiplier !== 0);
  const hasEnhanced = startups.filter(s => s.enhanced_god_score && s.enhanced_god_score !== s.total_god_score);

  console.log('  SIGNAL PRESENCE:');
  console.log('  ┌─────────────────────────┬────────┬─────────┐');
  console.log('  │ Signal                  │ Count  │    %    │');
  console.log('  ├─────────────────────────┼────────┼─────────┤');
  const signals = [
    { name: 'fomo_signal_strength > 0', items: hasFomo },
    { name: 'is_oversubscribed = true', items: hasOversubscribed },
    { name: 'conviction_signal > 0', items: hasConviction },
    { name: 'has_followon = true', items: hasFollowon },
    { name: 'urgency_signal > 0', items: hasUrgency },
    { name: 'is_competitive = true', items: hasCompetitive },
    { name: 'risk_signal > 0', items: hasRisk },
    { name: 'is_bridge_round = true', items: hasBridge },
    { name: 'psychological_multiplier ≠ 0', items: hasPsychMultiplier },
    { name: 'enhanced ≠ total_god', items: hasEnhanced },
  ];
  for (const s of signals) {
    console.log(`  │ ${s.name.padEnd(23)} │ ${String(s.items.length).padStart(6)} │ ${(s.items.length / total * 100).toFixed(2).padStart(6)}% │`);
  }
  console.log('  └─────────────────────────┴────────┴─────────┘');
  console.log();

  // For the ones that have signals, what are the values?
  if (hasFomo.length > 0) {
    const vals = hasFomo.map(s => s.fomo_signal_strength).sort((a, b) => a - b);
    console.log(`  FOMO signal values (${vals.length}): min=${vals[0]}, max=${vals[vals.length-1]}, avg=${(vals.reduce((s,v) => s+v, 0)/vals.length).toFixed(3)}`);
  }
  if (hasConviction.length > 0) {
    const vals = hasConviction.map(s => s.conviction_signal_strength).sort((a, b) => a - b);
    console.log(`  Conviction signal values (${vals.length}): min=${vals[0]}, max=${vals[vals.length-1]}, avg=${(vals.reduce((s,v) => s+v, 0)/vals.length).toFixed(3)}`);
  }
  if (hasUrgency.length > 0) {
    const vals = hasUrgency.map(s => s.urgency_signal_strength).sort((a, b) => a - b);
    console.log(`  Urgency signal values (${vals.length}): min=${vals[0]}, max=${vals[vals.length-1]}, avg=${(vals.reduce((s,v) => s+v, 0)/vals.length).toFixed(3)}`);
  }
  if (hasRisk.length > 0) {
    const vals = hasRisk.map(s => s.risk_signal_strength).sort((a, b) => a - b);
    console.log(`  Risk signal values (${vals.length}): min=${vals[0]}, max=${vals[vals.length-1]}, avg=${(vals.reduce((s,v) => s+v, 0)/vals.length).toFixed(3)}`);
  }
  if (hasPsychMultiplier.length > 0) {
    const vals = hasPsychMultiplier.map(s => s.psychological_multiplier).sort((a, b) => a - b);
    console.log(`  Psych multiplier values (${vals.length}): min=${vals[0]}, max=${vals[vals.length-1]}, avg=${(vals.reduce((s,v) => s+v, 0)/vals.length).toFixed(3)}`);
  }
  console.log();

  // Boolean gate vs strength mismatch
  const fomoStrengthNoGate = startups.filter(s => s.fomo_signal_strength > 0 && !s.is_oversubscribed);
  const convStrengthNoGate = startups.filter(s => s.conviction_signal_strength > 0 && !s.has_followon);
  const urgStrengthNoGate = startups.filter(s => s.urgency_signal_strength > 0 && !s.is_competitive);
  const riskStrengthNoGate = startups.filter(s => s.risk_signal_strength > 0 && !s.is_bridge_round);

  console.log('  BOOLEAN GATE MISMATCHES (signal strength > 0 but boolean = false):');
  console.log(`     FOMO:       ${fomoStrengthNoGate.length} (${(fomoStrengthNoGate.length / total * 100).toFixed(2)}%)`);
  console.log(`     Conviction: ${convStrengthNoGate.length} (${(convStrengthNoGate.length / total * 100).toFixed(2)}%)`);
  console.log(`     Urgency:    ${urgStrengthNoGate.length} (${(urgStrengthNoGate.length / total * 100).toFixed(2)}%)`);
  console.log(`     Risk:       ${riskStrengthNoGate.length} (${(riskStrengthNoGate.length / total * 100).toFixed(2)}%)`);
  console.log(`  → These startups have signal data that the formula IGNORES due to boolean gating.\n`);

  // Show the 17 startups with signals
  const withAnySignal = startups.filter(s =>
    s.fomo_signal_strength > 0 || s.conviction_signal_strength > 0 ||
    s.urgency_signal_strength > 0 || s.risk_signal_strength > 0
  );
  if (withAnySignal.length > 0 && withAnySignal.length <= 30) {
    console.log(`  ALL ${withAnySignal.length} STARTUPS WITH BEHAVIORAL SIGNALS:`);
    console.log('  ┌────────────────────────────┬─────┬──────┬──────┬──────┬──────┬───────┬──────┬──────┬──────┬──────┐');
    console.log('  │ Name                       │ GOD │ Enh  │ FOMO │ Conv │ Urg  │ Risk  │ OS?  │ FO?  │ CP?  │ BR?  │');
    console.log('  ├────────────────────────────┼─────┼──────┼──────┼──────┼──────┼───────┼──────┼──────┼──────┼──────┤');
    for (const s of withAnySignal.sort((a, b) => (b.total_god_score || 0) - (a.total_god_score || 0))) {
      const name = (s.name || '').substring(0, 26).padEnd(26);
      const god = String(s.total_god_score || 0).padStart(3);
      const enh = String(s.enhanced_god_score || s.total_god_score || 0).padStart(4);
      const fomo = (s.fomo_signal_strength || 0).toFixed(2).padStart(4);
      const conv = (s.conviction_signal_strength || 0).toFixed(2).padStart(4);
      const urg = (s.urgency_signal_strength || 0).toFixed(2).padStart(4);
      const risk = (s.risk_signal_strength || 0).toFixed(2).padStart(5);
      const os = s.is_oversubscribed ? '  ✅ ' : '  ❌ ';
      const fo = s.has_followon ? '  ✅ ' : '  ❌ ';
      const cp = s.is_competitive ? '  ✅ ' : '  ❌ ';
      const br = s.is_bridge_round ? '  ✅ ' : '  ❌ ';
      console.log(`  │ ${name} │ ${god} │ ${enh} │ ${fomo} │ ${conv} │ ${urg} │ ${risk} │${os}│${fo}│${cp}│${br}│`);
    }
    console.log('  └────────────────────────────┴─────┴──────┴──────┴──────┴──────┴───────┴──────┴──────┴──────┴──────┘');
  }
  console.log();
}

// ═══════════════════════════════════════════════════════════════════════════
// PROPOSED FORMULA IMPROVEMENTS
// ═══════════════════════════════════════════════════════════════════════════

function proposedImprovements() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  3. PROPOSED FORMULA IMPROVEMENTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log('  CURRENT FORMULA:');
  console.log('    bonus = (FOMO × 0.5) + (Conv × 0.5) + (Urg × 0.3) - (Risk × 0.3)');
  console.log('    cap: [-0.3, +1.0]\n');

  console.log('  PROPOSED FORMULA (v2):');
  console.log('    bonus = (FOMO × 0.4) + (Conv × 0.6) + (Urg × 0.3) - (Risk × 0.5)');
  console.log('    cap: [-0.5, +1.0]\n');

  console.log('  CHANGES:');
  console.log('    1. Conviction weight: 0.5 → 0.6 (follow-on is the strongest signal)');
  console.log('    2. FOMO weight:       0.5 → 0.4 (oversubscription can be gamed)');
  console.log('    3. Risk weight:       0.3 → 0.5 (bridge rounds are serious negatives)');
  console.log('    4. Risk cap:         -0.3 → -0.5 (allow more downside for bad signals)');
  console.log('    5. Remove boolean gating (use strength directly, 0=no signal)\n');

  console.log('  v2 RANGE ANALYSIS:');
  const v2RawMax = 1.0 * 0.4 + 1.0 * 0.6 + 1.0 * 0.3; // 1.3 (same)
  const v2RawMin = -1.0 * 0.5; // -0.5
  console.log(`    Raw max: +${v2RawMax.toFixed(1)} (still clips to +1.0)`);
  console.log(`    Raw min: ${v2RawMin.toFixed(1)} (now uses full cap)`);
  console.log(`    Effective range: 1.5 points (vs 1.3 currently)`);
  console.log(`    GOD range: -5 to +10 (vs -3 to +10 currently)\n`);

  // Compare scenarios
  console.log('  SCENARIO COMPARISON (v1 vs v2):');
  console.log('  ┌──────────────────┬────────┬────────┬──────────┐');
  console.log('  │ Scenario         │  v1    │  v2    │  Δ GOD   │');
  console.log('  ├──────────────────┼────────┼────────┼──────────┤');
  const v2Scenarios = [
    { label: 'FOMO only (1.0)', fomo: 0.4, conv: 0, urg: 0, risk: 0, v1: 0.5 },
    { label: 'Conv only (1.0)', fomo: 0, conv: 0.6, urg: 0, risk: 0, v1: 0.5 },
    { label: 'Urg only (1.0)', fomo: 0, conv: 0, urg: 0.3, risk: 0, v1: 0.3 },
    { label: 'Risk only (1.0)', fomo: 0, conv: 0, urg: 0, risk: -0.5, v1: -0.3 },
    { label: 'FOMO+Conv (1.0)', fomo: 0.4, conv: 0.6, urg: 0, risk: 0, v1: 1.0 },
    { label: 'All positive', fomo: 0.4, conv: 0.6, urg: 0.3, risk: 0, v1: 1.0 },
    { label: 'All max+Risk', fomo: 0.4, conv: 0.6, urg: 0.3, risk: -0.5, v1: 0.7 },
    { label: 'Conv+Bridge', fomo: 0, conv: 0.6, urg: 0, risk: -0.5, v1: 0.2 },
  ];
  for (const s of v2Scenarios) {
    const v2Raw = Math.max(-0.5, Math.min(1.0, s.fomo + s.conv + s.urg + s.risk));
    const v1Val = Math.max(-0.3, Math.min(1.0, s.v1));
    const delta = (v2Raw - v1Val) * 10;
    console.log(`  │ ${s.label.padEnd(16)} │ ${v1Val >= 0 ? '+' : ''}${v1Val.toFixed(2)}  │ ${v2Raw >= 0 ? '+' : ''}${v2Raw.toFixed(2)}  │  ${delta >= 0 ? '+' : ''}${delta.toFixed(0).padStart(3)}     │`);
  }
  console.log('  └──────────────────┴────────┴────────┴──────────┘');
  console.log();

  console.log('  KEY TAKEAWAY:');
  console.log('  v2 rewards conviction more (+1 GOD), punishes bridge more (-2 GOD),');
  console.log('  and slightly reduces FOMO gaming risk (-1 GOD for FOMO-only plays).');
  console.log('  Total positive range unchanged (cap still +10 GOD / +1.0 on scale).');
  console.log('  Negative range: -3 → -5 GOD points for pure bridge rounds.');
}

// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  PSYCHOLOGICAL BONUS MATH AUDIT (READ-ONLY)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  theoreticalAnalysis();
  await actualDataAnalysis();
  proposedImprovements();

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  AUDIT COMPLETE — No scores modified.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
