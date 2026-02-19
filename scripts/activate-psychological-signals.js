require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkAndCreateSchema() {
  console.log('\n🔍 Checking Psychological Signals Schema...\n');
  
  // 1. Check if psychological_signals table exists (try to query it)
  const { error: psyError } = await supabase
    .from('psychological_signals')
    .select('id')
    .limit(1);
    
  const hasPsyTable = !psyError || (psyError && !psyError.message.includes('does not exist'));
  console.log('✓ psychological_signals table:', hasPsyTable ? '✅ EXISTS' : '⚠️  MISSING');
  
  // 2. Check if market_signals column exists
  const { error: marketError } = await supabase
    .from('startup_uploads')
    .select('id, market_signals')
    .limit(1);
    
  const hasMarketSignals = !marketError || (marketError && !marketError.message.includes('does not exist'));
  console.log('✓ market_signals column:', hasMarketSignals ? '✅ EXISTS' : '⚠️  MISSING');
  
  // 3. Check psychological_bonus field (should exist but be NULL)
  const { data: sampleStartup } = await supabase
    .from('startup_uploads')
    .select('id, psychological_bonus, enhanced_god_score')
    .not('enhanced_god_score', 'is', null)
    .limit(1)
    .single();
    
  const hasPsyBonus = sampleStartup && 'psychological_bonus' in sampleStartup;
  const psyBonusPopulated = sampleStartup?.psychological_bonus !== null;
  console.log('✓ psychological_bonus field:', hasPsyBonus ? '✅ EXISTS' : '⚠️  MISSING');
  console.log('✓ psychological_bonus populated:', psyBonusPopulated ? '✅ YES' : '⚠️  NO (all NULL)');
  
  console.log('\n📊 Summary:\n');
  
  const needsWork = [];
  if (!hasPsyTable) needsWork.push('Create psychological_signals table');
  if (!hasMarketSignals) needsWork.push('Add market_signals column');
  if (!psyBonusPopulated) needsWork.push('Populate psychological_bonus values');
  
  if (needsWork.length === 0) {
    console.log('✅ All schema components are ready!\n');
    return true;
  } else {
    console.log('⚠️  Action Items:');
    needsWork.forEach((item, i) => console.log(`   ${i+1}. ${item}`));
    console.log('');
    return false;
  }
}

async function applyMigrations() {
  console.log('\n🚀 Creating Missing Schema Components...\n');
  
  // Create simple SQL migration script that can be copy/pasted
  const sqlStatements = [];
  
  // 1. Add market_signals column
  console.log('1️⃣  market_signals column SQL:');
  const marketSQL = `
-- Add market_signals column to startup_uploads
ALTER TABLE startup_uploads 
ADD COLUMN IF NOT EXISTS market_signals JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_startup_uploads_market_signals 
  ON startup_uploads USING GIN(market_signals);

COMMENT ON COLUMN startup_uploads.market_signals IS 
  'Market intelligence: funding velocity, sector momentum, investor behavior';
`;
  console.log(marketSQL);
  sqlStatements.push(marketSQL);
  
  // 2. Create psychological_signals table
  console.log('\n2️⃣  psychological_signals table SQL:');
  console.log('\nTo apply these migrations:');
  console.log('1. Open Supabase Dashboard → SQL Editor');
  console.log('2. Copy/paste the above SQL statements');
  console.log('3. OR run the full migration file:');
  console.log('   supabase/migrations/20260212_psychological_signals.sql');
  console.log('');
  
  // Write combined SQL file for easy execution
  const fs = require('fs');
  const path = require('path');
  
  const combinedSQL = `${marketSQL}\n\n-- See supabase/migrations/20260212_psychological_signals.sql for full psychological signals schema`;
  
  fs.writeFileSync(
    path.join(__dirname, '..', 'activate-psychological-signals.sql'),
    combinedSQL
  );
  
  console.log('✅ SQL written to: activate-psychological-signals.sql');
  console.log('\nRun this in Supabase SQL Editor, then re-run this script to verify.\n');
}

checkAndCreateSchema().then(isReady => {
  if (!isReady) {
    return applyMigrations();
  }
}).catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
