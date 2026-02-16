/**
 * T2: Run full recalc with momentum, with trigger safety
 * Disables startup_forecast_trigger → runs recalc → re-enables trigger
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY!
);

async function disableTrigger() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE startup_uploads DISABLE TRIGGER startup_forecast_trigger;'
  });
  if (error) {
    console.warn('⚠️  Could not disable trigger via RPC (may not exist or no permission)');
    console.warn('   If you see RLS errors, run this in Supabase SQL editor:');
    console.warn('   ALTER TABLE startup_uploads DISABLE TRIGGER startup_forecast_trigger;');
  } else {
    console.log('✅ startup_forecast_trigger disabled');
  }
}

async function enableTrigger() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: 'ALTER TABLE startup_uploads ENABLE TRIGGER startup_forecast_trigger;'
  });
  if (error) {
    console.warn('⚠️  Could not re-enable trigger via RPC');
  } else {
    console.log('✅ startup_forecast_trigger re-enabled');
  }
}

// Export for use in recalc
export { disableTrigger, enableTrigger };
