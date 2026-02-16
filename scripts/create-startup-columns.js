#!/usr/bin/env node
/**
 * Create new columns for startup domain normalization and metric parsing.
 * Uses exec_ddl RPC (DDL-safe, not exec_sql which silently fails on ALTER TABLE).
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const COLUMNS = [
  // Domain normalization
  { name: 'company_domain',            type: 'TEXT',    desc: 'Canonical company domain (e.g., stripe.com)' },
  { name: 'company_domain_confidence', type: 'REAL',    desc: 'Confidence in domain extraction 0-1' },
  { name: 'domain_source',             type: 'TEXT',    desc: 'Which field/method yielded the domain' },

  // Startup metrics (denormalized for fast querying)
  { name: 'startup_metrics',           type: 'JSONB',   desc: 'Full metric extraction results (raw_mentions, evidence, etc.)' },
  { name: 'last_round_amount_usd',     type: 'BIGINT',  desc: 'Last funding round amount in USD' },
  { name: 'last_round_type',           type: 'TEXT',    desc: 'Last round type (seed, series_a, etc.)' },
  { name: 'total_funding_usd',         type: 'BIGINT',  desc: 'Total funding raised in USD' },
  { name: 'arr_usd',                   type: 'BIGINT',  desc: 'Annual recurring revenue in USD' },
  { name: 'revenue_usd',              type: 'BIGINT',  desc: 'Annual revenue in USD (non-SaaS)' },
  { name: 'valuation_usd',            type: 'BIGINT',  desc: 'Last known valuation in USD' },
  { name: 'burn_monthly_usd',         type: 'BIGINT',  desc: 'Monthly burn rate in USD' },
  { name: 'runway_months',            type: 'REAL',    desc: 'Estimated runway in months' },
  { name: 'parsed_headcount',         type: 'INTEGER', desc: 'Parsed team/headcount (avoids collision with team_size)' },
  { name: 'parsed_customers',         type: 'INTEGER', desc: 'Parsed customer count' },
  { name: 'parsed_users',             type: 'INTEGER', desc: 'Parsed user count (DAU/MAU)' },
  { name: 'funding_confidence',       type: 'REAL',    desc: 'Confidence in funding metrics 0-1' },
  { name: 'traction_confidence',      type: 'REAL',    desc: 'Confidence in traction metrics 0-1' },
  { name: 'metrics_version',          type: 'TEXT',    desc: 'Version of the metric parser that generated these' },
  { name: 'metrics_parsed_at',        type: 'TIMESTAMPTZ', desc: 'When metrics were last parsed' },
];

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  CREATE COLUMNS: Startup Domain + Metrics                 ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  let success = 0;
  let skipped = 0;
  let errors = 0;

  for (const col of COLUMNS) {
    const sql = `ALTER TABLE startup_uploads ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`;
    const { data, error } = await supabase.rpc('exec_ddl', { sql_text: sql });

    if (error) {
      console.log(`  ❌ ${col.name} (${col.type}): ${error.message}`);
      errors++;
    } else if (data === 'OK') {
      console.log(`  ✅ ${col.name} (${col.type}) — ${col.desc}`);
      success++;
    } else {
      console.log(`  ⚠️  ${col.name}: ${data}`);
      skipped++;
    }
  }

  console.log(`\n  Summary: ${success} created, ${skipped} skipped, ${errors} errors`);

  // Verify columns exist
  console.log('\n  Verifying columns...');
  const { data: verifyData } = await supabase.rpc('exec_sql', {
    sql_text: `SELECT json_agg(column_name) FROM information_schema.columns WHERE table_name = 'startup_uploads' AND column_name IN (${COLUMNS.map(c => `'${c.name}'`).join(',')})`
  });
  console.log('  Found:', verifyData);
}

main().catch(console.error);
