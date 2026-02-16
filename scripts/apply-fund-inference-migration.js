#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const statements = [
  "ALTER TABLE investors ADD COLUMN IF NOT EXISTS capital_type text",
  "ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_size_estimate_usd bigint",
  "ALTER TABLE investors ADD COLUMN IF NOT EXISTS fund_size_confidence real",
  "ALTER TABLE investors ADD COLUMN IF NOT EXISTS estimation_method text",
  "ALTER TABLE investors ADD COLUMN IF NOT EXISTS capital_power_score real",
  "CREATE INDEX IF NOT EXISTS idx_investors_capital_power ON investors (capital_power_score DESC NULLS LAST)",
  "CREATE INDEX IF NOT EXISTS idx_investors_capital_type ON investors (capital_type)",
];

(async () => {
  for (const stmt of statements) {
    console.log('Running:', stmt.substring(0, 80));
    const { error } = await sb.rpc('exec_sql', { sql_query: stmt });
    if (error) console.log('  Error:', error.message);
    else console.log('  OK');
  }
  console.log('\nDone.');
})();
