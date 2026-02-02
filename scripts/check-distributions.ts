import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

async function checkDistributions() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    GOD SCORE VARIABLES (23 Algorithms)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  console.log('GOD_SCORE_CONFIG:');
  console.log('  normalizationDivisor: 19.5 (Admin calibrated Jan 30)');
  console.log('  baseBoostMinimum: 4.2');
  console.log('  vibeBonusCap: 1.0');
  console.log('');
  
  console.log('COMPONENT WEIGHTS (Max Points):');
  console.log('┌────────────────────────────────┬───────────┐');
  console.log('│ Component                      │ Max Points│');
  console.log('├────────────────────────────────┼───────────┤');
  console.log('│ Team Execution                 │    3.0    │');
  console.log('│ Product Vision                 │    2.0    │');
  console.log('│ Founder Courage                │    1.5    │');
  console.log('│ Market Insight                 │    1.5    │');
  console.log('│ Team Age/Adaptability          │    1.0    │');
  console.log('│ Traction                       │    3.0    │');
  console.log('│ Market                         │    2.0    │');
  console.log('│ Product                        │    2.0    │');
  console.log('│ Base Boost (vibe + content)    │   ~4.5    │');
  console.log('│ Red Flags (penalty)            │   -1.5    │');
  console.log('├────────────────────────────────┼───────────┤');
  console.log('│ MAX RAW TOTAL                  │  ~17.5    │');
  console.log('└────────────────────────────────┴───────────┘');
  console.log('');
  console.log('Formula: total = (rawTotal / 19.5) * 10 → then * 10 = 0-100 scale');
  console.log('');
  
  // Get current GOD score distribution
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    GOD SCORE DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const { data: godScores } = await supabase
    .from('startup_uploads')
    .select('total_god_score')
    .eq('status', 'approved')
    .not('total_god_score', 'is', null)
    .limit(1000);
  
  if (godScores && godScores.length > 0) {
    const scores = godScores.map(d => d.total_god_score);
    const avg = scores.reduce((a,b) => a+b, 0) / scores.length;
    
    console.log(`Count: ${scores.length}`);
    console.log(`Average: ${avg.toFixed(1)}`);
    console.log(`Min: ${Math.min(...scores)}`);
    console.log(`Max: ${Math.max(...scores)}`);
    console.log('');
    
    const elite = scores.filter(s => s >= 85).length;
    const strong = scores.filter(s => s >= 70 && s < 85).length;
    const good = scores.filter(s => s >= 55 && s < 70).length;
    const emerging = scores.filter(s => s >= 45 && s < 55).length;
    const early = scores.filter(s => s < 45).length;
    
    console.log('Tier Distribution:');
    console.log(`  Elite (85+):     ${elite} (${(elite/scores.length*100).toFixed(1)}%)`);
    console.log(`  Strong (70-84):  ${strong} (${(strong/scores.length*100).toFixed(1)}%)`);
    console.log(`  Good (55-69):    ${good} (${(good/scores.length*100).toFixed(1)}%)`);
    console.log(`  Emerging (45-54):${emerging} (${(emerging/scores.length*100).toFixed(1)}%)`);
    console.log(`  Early (<45):     ${early} (${(early/scores.length*100).toFixed(1)}%)`);
  }
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    SIGNAL VARIABLES (5 Dimensions)');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  console.log('SIGNAL DIMENSIONS (Max Points = 10 total):');
  console.log('┌────────────────────────────────┬───────────┐');
  console.log('│ Dimension                      │ Max Points│');
  console.log('├────────────────────────────────┼───────────┤');
  console.log('│ Product Velocity               │    2.0    │');
  console.log('│ Funding Acceleration           │    2.5    │');
  console.log('│ Customer Adoption              │    2.0    │');
  console.log('│ Market Momentum                │    1.5    │');
  console.log('│ Competitive Dynamics           │    2.0    │');
  console.log('├────────────────────────────────┼───────────┤');
  console.log('│ TOTAL SIGNAL MAX               │   10.0    │');
  console.log('└────────────────────────────────┴───────────┘');
  console.log('');
  console.log('Stability Rule: 50% change threshold (signals only update on significant changes)');
  console.log('Expected boost: 1-3 points typical, 7+ rare, 10 max');
  console.log('');
  
  // Check if signal columns exist
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    SIGNAL SCORE DISTRIBUTION');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  
  const { data: signalData, error } = await supabase
    .from('startup_uploads')
    .select('signals_bonus, product_velocity_signal, funding_acceleration_signal, customer_adoption_signal, market_momentum_signal, competitive_dynamics_signal')
    .eq('status', 'approved')
    .limit(1000);
  
  if (error) {
    console.log('Signal columns may not exist yet or error:', error.message);
    console.log('');
    console.log('Signals are layered ON TOP of GOD scores when computed.');
    console.log('To apply signals, run: npx tsx scripts/apply-signals.ts');
  } else if (signalData && signalData.length > 0) {
    // Check if any have signals_bonus
    const withSignals = signalData.filter(d => d.signals_bonus !== null && d.signals_bonus !== undefined);
    
    if (withSignals.length === 0) {
      console.log('No startups have signals_bonus populated yet.');
      console.log('Signals are computed separately and layered on GOD scores.');
    } else {
      const bonuses = withSignals.map(d => d.signals_bonus);
      const avgBonus = bonuses.reduce((a,b) => a+b, 0) / bonuses.length;
      
      console.log(`Startups with signals: ${withSignals.length}`);
      console.log(`Average signals_bonus: ${avgBonus.toFixed(2)}`);
      console.log(`Min bonus: ${Math.min(...bonuses).toFixed(2)}`);
      console.log(`Max bonus: ${Math.max(...bonuses).toFixed(2)}`);
      console.log('');
      
      // Distribution
      const b0to1 = bonuses.filter(b => b < 1).length;
      const b1to3 = bonuses.filter(b => b >= 1 && b < 3).length;
      const b3to5 = bonuses.filter(b => b >= 3 && b < 5).length;
      const b5to7 = bonuses.filter(b => b >= 5 && b < 7).length;
      const b7plus = bonuses.filter(b => b >= 7).length;
      
      console.log('Signal Bonus Distribution:');
      console.log(`  0-1 (minimal):  ${b0to1} (${(b0to1/bonuses.length*100).toFixed(1)}%)`);
      console.log(`  1-3 (typical):  ${b1to3} (${(b1to3/bonuses.length*100).toFixed(1)}%)`);
      console.log(`  3-5 (strong):   ${b3to5} (${(b3to5/bonuses.length*100).toFixed(1)}%)`);
      console.log(`  5-7 (hot):      ${b5to7} (${(b5to7/bonuses.length*100).toFixed(1)}%)`);
      console.log(`  7+ (rare):      ${b7plus} (${(b7plus/bonuses.length*100).toFixed(1)}%)`);
      
      // Individual dimensions
      const dims = ['product_velocity_signal', 'funding_acceleration_signal', 'customer_adoption_signal', 'market_momentum_signal', 'competitive_dynamics_signal'];
      console.log('\nDimension Averages:');
      for (const dim of dims) {
        const vals = withSignals.map(d => (d as any)[dim]).filter(v => v !== null && v !== undefined);
        if (vals.length > 0) {
          const avg = vals.reduce((a,b) => a+b, 0) / vals.length;
          console.log(`  ${dim}: ${avg.toFixed(3)} (n=${vals.length})`);
        }
      }
    }
  }
  
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('                    FINAL SCORE FORMULA');
  console.log('═══════════════════════════════════════════════════════════════════\n');
  console.log('FINAL SCORE = GOD Score (0-100) + Signals Bonus (0-10)');
  console.log('');
  console.log('Example:');
  console.log('  GOD Score: 65');
  console.log('  Signals Bonus: 3.5');
  console.log('  Final Score: 68.5');
  console.log('');
}

checkDistributions();
