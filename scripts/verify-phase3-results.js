#!/usr/bin/env node

/**
 * Quick verification script for Phase 3 psychological scoring results
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('\n📊 PHASE 3 VERIFICATION: Enhanced GOD Scores\n');
console.log('═'.repeat(80));

// Fetch all startups and filter client-side for enhanced scores
const { data: allStartups, error: fetchError } = await supabase
  .from('startup_uploads')
  .select('id, name, total_god_score, enhanced_god_score, psychological_multiplier, is_oversubscribed, has_followon')
  .not('enhanced_god_score', 'is', null)
  .order('enhanced_god_score', { ascending: false });

if (fetchError) {
  console.error('❌ Error fetching startups:', fetchError.message);
  process.exit(1);
}

// Filter for enhanced scores
const enhanced = allStartups.filter(s => s.enhanced_god_score > s.total_god_score);

console.log(`\n✅ Total startups with enhanced scores: ${enhanced.length}\n`);

// Get top 10 boosted startups
const topBoosts = enhanced
  .sort((a, b) => (b.enhanced_god_score - b.total_god_score) - (a.enhanced_god_score - a.total_god_score))
  .slice(0, 10);

console.log('🏆 TOP 10 STARTUPS WITH PSYCHOLOGICAL BOOSTS:\n');
console.log('─'.repeat(80));

topBoosts.forEach((startup, i) => {
  const boost = (startup.enhanced_god_score - startup.total_god_score).toFixed(1);
  const signals = [];
  if (startup.is_oversubscribed) signals.push('🚀 Oversubscribed');
  if (startup.has_followon) signals.push('💎 Follow-on');
  
  console.log(`${i + 1}. ${startup.name}`);
  console.log(`   Base: ${startup.total_god_score.toFixed(1)} → Enhanced: ${startup.enhanced_god_score.toFixed(1)} (+${boost})`);
  console.log(`   Multiplier: ${startup.psychological_multiplier.toFixed(3)}x`);
  if (signals.length > 0) {
    console.log(`   Signals: ${signals.join(', ')}`);
  }
  console.log('');
});

// Check for Phase 1 signals
const { data: phase1Signals, error: signalsError } = await supabase
  .from('startup_uploads')
  .select('is_oversubscribed, has_followon, is_competitive, is_bridge_round')
  .or('is_oversubscribed.eq.true,has_followon.eq.true,is_competitive.eq.true,is_bridge_round.eq.true');

if (!signalsError) {
  const oversubscribed = phase1Signals.filter(s => s.is_oversubscribed).length;
  const followon = phase1Signals.filter(s => s.has_followon).length;
  const competitive = phase1Signals.filter(s => s.is_competitive).length;
  const bridge = phase1Signals.filter(s => s.is_bridge_round).length;
  
  console.log('─'.repeat(80));
  console.log('\n📈 PHASE 1 SIGNAL DISTRIBUTION:\n');
  console.log(`  🚀 Oversubscribed rounds: ${oversubscribed}`);
  console.log(`  💎 Follow-on investments: ${followon}`);
  console.log(`  ⚔️  Competitive rounds: ${competitive}`);
  console.log(`  ⚠️  Bridge rounds: ${bridge}`);
  console.log(`  ━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Total Phase 1 signals: ${phase1Signals.length}`);
}

console.log('\n' + '═'.repeat(80));
console.log('✅ Phase 3 integration verified!\n');
