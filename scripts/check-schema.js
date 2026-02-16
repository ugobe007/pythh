// Check what functions and columns actually exist
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function checkSchema() {
  console.log('📋 SCHEMA CHECK\n');
  
  // Check if calculate_psychological_bonus exists
  console.log('1️⃣  Testing calculate_psychological_bonus():');
  const { data: bonus, error: bonusError } = await supabase.rpc('calculate_psychological_bonus', { startup_uuid: '00000000-0000-0000-0000-000000000000' });
  console.log(bonusError ? `   ❌ ${bonusError.message}` : `   ✅ Function exists, returned: ${bonus}`);
  
  // Check if calculate_psychological_multiplier exists
  console.log('\n2️⃣  Testing calculate_psychological_multiplier():');
  const { data: multiplier, error: multError } = await supabase.rpc('calculate_psychological_multiplier', { startup_uuid: '00000000-0000-0000-0000-000000000000' });
  console.log(multError ? `   ❌ ${multError.message}` : `   ✅ Function exists, returned: ${multiplier}`);
  
  // Check column names
  console.log('\n3️⃣  Checking startup_uploads columns:');
  const { data: sample } = await supabase
    .from('startup_uploads')
    .select('psychological_bonus, psychological_multiplier')
    .limit(1)
    .single();
  
  console.log(`   psychological_bonus: ${sample?.psychological_bonus !== undefined ? '✅ exists' : '❌ missing'}`);
  console.log(`   psychological_multiplier: ${sample?.psychological_multiplier !== undefined ? '✅ exists' : '❌ missing'}`);
}

checkSchema().catch(console.error);
