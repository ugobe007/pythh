require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSignalData() {
  console.log('\n🔬 SIGNAL DATA CAPTURE STATUS\n');
  
  // Check momentum scores
  const { data: momentumData, error: momentumError } = await supabase
    .from('startup_uploads')
    .select('id, name, total_god_score, momentum_score, psychological_bonus, enhanced_god_score')
    .eq('status', 'approved')
    .not('momentum_score', 'is', null)
    .limit(10);
    
  if (momentumError) {
    console.error('Error fetching momentum data:', momentumError);
  } else if (momentumData && momentumData.length > 0) {
    console.log('✅ Momentum scores captured:', momentumData.length, 'samples found');
    console.log('\n📊 Sample startups with momentum scores:');
    momentumData.slice(0, 5).forEach((s, i) => {
      console.log(`\n${i+1}. ${s.name}`);
      console.log(`   Base GOD Score: ${s.total_god_score}`);
      console.log(`   Momentum Score: ${s.momentum_score || 'N/A'}`);
      console.log(`   Psychological Bonus: ${s.psychological_bonus || 'N/A'}`);
      console.log(`   Enhanced GOD Score: ${s.enhanced_god_score || 'N/A'}`);
    });
  } else {
    console.log('⚠️  No momentum scores found in database');
  }
  
  // Check market signals
  const { data: marketData, error: marketError } = await supabase
    .from('startup_uploads')
    .select('id, name, market_signals')
    .eq('status', 'approved')
    .not('market_signals', 'is', null)
    .limit(5);
    
  if (marketError) {
    console.error('\nError fetching market signals:', marketError);
  } else if (marketData && marketData.length > 0) {
    console.log('\n\n✅ Market signals captured:', marketData.length, 'samples found');
    console.log('\n📈 Sample market signals:');
    marketData.forEach((s, i) => {
      console.log(`\n${i+1}. ${s.name}`);
      console.log('   Market Signals:', JSON.stringify(s.market_signals, null, 2).substring(0, 200) + '...');
    });
  } else {
    console.log('\n\n⚠️  No market signals found in database');
  }
  
  // Check table existence using a direct query
  const { data: tables } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .eq('table_name', 'psychological_signals');
    
  console.log('\n\n📋 Psychological Signals Table:', tables && tables.length > 0 ? '✅ Exists' : '⚠️  Not found');
  
  // Summary
  console.log('\n\n📝 SUMMARY\n');
  console.log('Momentum Scores:', momentumData && momentumData.length > 0 ? '✅ Active' : '⚠️  Not captured');
  console.log('Market Signals:', marketData && marketData.length > 0 ? '✅ Active' : '⚠️  Not captured');
  console.log('Psychological Signals:', tables && tables.length > 0 ? '✅ Table exists' : '⚠️  Table not found');
  
  // Check scoring service configuration
  console.log('\n\n⚙️  GOD SCORE CONFIGURATION\n');
  console.log('Scoring Service: server/services/startupScoringService.ts');
  console.log('Signal Layers:');
  console.log('  - Momentum Scoring (T2): server/services/momentumScoringService.js');
  console.log('  - AP/Promising Bonus (T4): server/services/apScoringService.ts');
  console.log('  - Elite Boost (T5): server/services/eliteScoringService.ts');
  console.log('  - Spiky/Hot Recognition (T6): server/services/spikyBachelorService.ts');
  console.log('  - Psychological Signals (Phase 1+2): Behavioral intelligence layer');
}

checkSignalData().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
