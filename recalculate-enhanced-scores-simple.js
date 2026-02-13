const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function recalculateEnhancedScores() {
  console.log('🔧 Recalculating enhanced GOD scores (ADDITIVE formula)...\n');

  try {
    // Get startups with signals
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, is_oversubscribed, has_followon, is_competitive, is_bridge_round, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, risk_signal_strength')
      .or('is_oversubscribed.eq.true,has_followon.eq.true,is_competitive.eq.true,is_bridge_round.eq.true')
      .not('total_god_score', 'is', null);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`Found ${startups.length} startups\n`);

    let updated = 0;
    let withSignals = 0;

    for (const startup of startups) {
      // Calculate additive bonus (same logic as startupScoringService.ts)
      let bonus = 0;

      // FOMO (0-5 points)
      if (startup.is_oversubscribed && startup.fomo_signal_strength) {
        bonus += startup.fomo_signal_strength * 0.5;
      }

      // Conviction (0-5 points)
      if (startup.has_followon && startup.conviction_signal_strength) {
        bonus += startup.conviction_signal_strength * 0.5;
      }

      // Urgency (0-3 points)
      if (startup.is_competitive && startup.urgency_signal_strength) {
        bonus += startup.urgency_signal_strength * 0.3;
      }

      // Risk penalty (0-3 points)
      if (startup.is_bridge_round && startup.risk_signal_strength) {
        bonus -= startup.risk_signal_strength * 0.3;
      }

      // Cap bonus
      bonus = Math.max(-0.3, Math.min(1.0, bonus));

      // Calculate enhanced score (ADDITIVE)
      const enhancedScore = Math.min(
        Math.round(startup.total_god_score + (bonus * 10)),
        100
      );

      const hasSignals = startup.is_oversubscribed || startup.has_followon || 
                        startup.is_competitive || startup.is_bridge_round;

      if (hasSignals) {
        withSignals++;
        
        // Update enhanced_god_score only (don't try to update psychological_multiplier)
        const { error: updateError } = await supabase
          .from('startup_uploads')
          .update({
            enhanced_god_score: enhancedScore
          })
          .eq('id', startup.id);

        if (updateError) {
          console.error(`❌ ${startup.name}:`, updateError.message);
        } else {
          const bonusPoints = Math.round(bonus * 10);
          const sign = bonusPoints >= 0 ? '+' : '';
          console.log(`✅ ${startup.name}: ${startup.total_god_score} ${sign}${bonusPoints}pts = ${enhancedScore}`);
          updated++;
        }
      }
    }

    console.log(`\n✅ Updated ${updated}/${withSignals} startups with signals`);
    console.log(`📊 ${startups.length - withSignals} startups had no signals (score unchanged)`);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

recalculateEnhancedScores();
