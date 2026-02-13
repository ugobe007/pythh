// Test the calculate_psychological_multiplier function directly
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function testPsychFunction() {
  console.log('🧪 Testing calculate_psychological_multiplier function...\n');

  // Get a startup that has signals
  const { data: signalSample, error: signalError } = await supabase
    .from('psychological_signals')
    .select('startup_id')
    .limit(1)
    .single();

  if (signalError || !signalSample) {
    console.error('❌ No signals found');
    return;
  }

  const startupId = signalSample.startup_id;
  console.log(`Testing with startup ID: ${startupId}\n`);

  // Get signals for this startup
  const { data: signals } = await supabase
    .from('psychological_signals')
    .select('signal_type, signal_strength, detected_at')
    .eq('startup_id', startupId);

  console.log('Signals for this startup:');
  signals.forEach(s => {
    console.log(`  ${s.signal_type}: ${s.signal_strength} (detected: ${s.detected_at})`);
  });

  // Call the function directly
  const { data: result, error } = await supabase
    .rpc('calculate_psychological_multiplier', { startup_uuid: startupId });

  if (error) {
    console.error('\n❌ Function error:', error);
    return;
  }

  console.log(`\n✅ Function returned: ${result}`);
  console.log(`   As points (×10): ${result * 10}`);

  // Check what's in the startup_uploads table
  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('name, psychological_multiplier, total_god_score, enhanced_god_score')
    .eq('id', startupId)
    .single();

  console.log('\n📊 Startup record:');
  console.log(`   Name: ${startup.name}`);
  console.log(`   psychological_multiplier: ${startup.psychological_multiplier}`);
  console.log(`   total_god_score: ${startup.total_god_score}`);
  console.log(`   enhanced_god_score: ${startup.enhanced_god_score}`);
  console.log(`   Expected enhanced: ${startup.total_god_score + (result * 10)}`);

  if (startup.psychological_multiplier === 0 && result > 0) {
    console.log('\n⚠️  MISMATCH: Function calculates non-zero, but column is zero!');
    console.log('💡 Trigger may not be firing. Try manually updating the startup:');
    console.log(`   UPDATE startup_uploads SET total_god_score = total_god_score WHERE id = '${startupId}';`);
  }
}

testPsychFunction().catch(console.error);
