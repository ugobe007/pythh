// Visualize how psychological signals are currently being applied
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function explainArchitecture() {
  console.log('🧠 CURRENT PSYCHOLOGICAL SIGNAL ARCHITECTURE\n');
  console.log('='.repeat(70));
  
  // Get a startup with signals
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select(`
      id, name, 
      team_score, traction_score, market_score, product_score, vision_score,
      total_god_score, psychological_multiplier, enhanced_god_score
    `)
    .eq('name', 'Helia Care')
    .single();

  if (!startup) {
    console.log('No startup found');
    return;
  }

  // Get its signals
  const { data: signals } = await supabase
    .from('psychological_signals')
    .select('signal_type, signal_strength, detected_at, source')
    .eq('startup_id', startup.id);

  console.log('\n📊 EXAMPLE STARTUP: ' + startup.name);
  console.log('='.repeat(70));
  
  console.log('\n1️⃣  ONTOLOGICAL SIGNALS (Base GOD Score Components):');
  console.log(`   Team Score:      ${startup.team_score}`);
  console.log(`   Traction Score:  ${startup.traction_score}`);
  console.log(`   Market Score:    ${startup.market_score}`);
  console.log(`   Product Score:   ${startup.product_score}`);
  console.log(`   Vision Score:    ${startup.vision_score}`);
  console.log(`   ────────────────────────────────`);
  console.log(`   Total GOD Score: ${startup.total_god_score}`);

  console.log('\n2️⃣  PSYCHOLOGICAL SIGNALS (Behavioral/Sentiment):');
  if (signals && signals.length > 0) {
    signals.forEach(s => {
      const age = Math.floor((new Date() - new Date(s.detected_at)) / (1000 * 60 * 60 * 24));
      console.log(`   ${s.signal_type}: ${s.signal_strength.toFixed(2)} (${age} days old)`);
      console.log(`      Source: ${s.source.substring(0, 60)}...`);
    });
  } else {
    console.log('   No signals detected');
  }

  console.log('\n3️⃣  CURRENT CALCULATION METHOD:');
  console.log(`   Formula: enhanced_score = base_god_score + (psychological_bonus × 10)`);
  console.log(`   `);
  console.log(`   Base GOD Score:        ${startup.total_god_score}`);
  console.log(`   Psychological Bonus:   ${startup.psychological_multiplier} (×10 = ${(startup.psychological_multiplier * 10).toFixed(1)} points)`);
  console.log(`   ────────────────────────────────`);
  console.log(`   Enhanced GOD Score:    ${startup.enhanced_god_score}`);

  console.log('\n' + '='.repeat(70));
  console.log('🤔 PROBLEM: Psychological signals are added as flat bonus');
  console.log('   NOT mapped to specific ontological components\n');

  console.log('='.repeat(70));
  console.log('💡 POTENTIAL ARCHITECTURE OPTIONS:\n');
  
  console.log('OPTION A: Semantic Matching (Component-Level Weighting)');
  console.log('─'.repeat(70));
  console.log('Map psychological signals to specific GOD score components:');
  console.log('  • FOMO (oversubscription) → Amplifies TRACTION score');
  console.log('  • Conviction (follow-on) → Amplifies TEAM + VISION scores');
  console.log('  • Urgency (competitive) → Amplifies MARKET score');
  console.log('  • Risk (bridge) → Dampens PRODUCT + TRACTION scores');
  console.log('');
  console.log('Example calculation:');
  console.log('  enhanced_traction = traction × (1 + (FOMO_signal × weight))');
  console.log('  enhanced_team = team × (1 + (Conviction_signal × weight))');
  console.log('  enhanced_god = sum(all_enhanced_components)');
  console.log('');

  console.log('OPTION B: Psychology-as-Multiplier (Global)');
  console.log('─'.repeat(70));
  console.log('Use psychological signals as a multiplier on the entire GOD score:');
  console.log('  enhanced_god = base_god × (1 + psychological_factor)');
  console.log('  where psychological_factor = net_signal_strength (e.g., 0.05-0.15)');
  console.log('');

  console.log('OPTION C: Additive Layer (Current Implementation)');
  console.log('─'.repeat(70));
  console.log('Add psychological bonus as independent layer:');
  console.log('  enhanced_god = base_god + psychological_points');
  console.log('  Currently implemented but NOT semantically mapped\n');

  console.log('='.repeat(70));
  console.log('❓ QUESTION: Which architecture matches your vision?');
  console.log('='.repeat(70));
  console.log('');
  console.log('Please clarify:');
  console.log('1. Should psychological signals amplify SPECIFIC components (Option A)?');
  console.log('2. What semantic mapping between signals and components?');
  console.log('   Example: "FOMO should boost traction by X%"');
  console.log('3. Should the effect be multiplicative or additive?');
  console.log('');
}

explainArchitecture().catch(console.error);
