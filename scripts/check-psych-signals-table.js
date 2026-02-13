// Check what's actually in the psychological_signals table
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSignalsTable() {
  console.log('🔍 Checking psychological_signals table...\n');

  // Count total signals
  const { count: totalCount, error: countError } = await supabase
    .from('psychological_signals')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Error counting signals:', countError);
    return;
  }

  console.log(`📊 Total signals in table: ${totalCount}\n`);

  if (totalCount === 0) {
    console.log('⚠️  No signals found in psychological_signals table!');
    console.log('💡 Run: node scripts/backfill-psychological-signals.js\n');
    return;
  }

  // Get sample signals
  const { data: signals, error } = await supabase
    .from('psychological_signals')
    .select('startup_id, signal_type, signal_strength, detected_at, source')
    .order('detected_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  console.log('🔝 Most recent 10 signals:');
  for (const signal of signals) {
    const age = Math.floor((new Date() - new Date(signal.detected_at)) / (1000 * 60 * 60 * 24));
    console.log(`   ${signal.signal_type}: ${signal.signal_strength.toFixed(2)} (${age} days old)`);
  }

  // Get signal type distribution
  const { data: distribution, error: distError } = await supabase
    .from('psychological_signals')
    .select('signal_type');

  if (!distError) {
    const typeCounts = distribution.reduce((acc, s) => {
      acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
      return acc;
    }, {});

    console.log('\n📈 Signal type distribution:');
    Object.entries(typeCounts).forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });
  }

  // Check if startups have the column populated
  console.log('\n🔍 Checking startup_uploads.psychological_multiplier...');
  const { data: startupsWithSignals, error: startupError } = await supabase
    .from('startup_uploads')
    .select('id, name, psychological_multiplier')
    .neq('psychological_multiplier', 0)
    .limit(10);

  if (startupError) {
    console.error('❌ Error:', startupError);
    return;
  }

  console.log(`\n✅ Startups with non-zero psychological_multiplier: ${startupsWithSignals.length}`);
  if (startupsWithSignals.length === 0) {
    console.log('⚠️  All startups have psychological_multiplier = 0');
    console.log('💡 This means either:');
    console.log('   1. Signals haven\'t been processed yet (run backfill)');
    console.log('   2. Trigger isn\'t firing (check database function)');
    console.log('   3. All signals have decayed to zero (check ages)');
  } else {
    console.log('\n📊 Sample startups with signals:');
    startupsWithSignals.forEach(s => {
      console.log(`   ${s.name}: ${s.psychological_multiplier.toFixed(3)}`);
    });
  }
}

checkSignalsTable().catch(console.error);
