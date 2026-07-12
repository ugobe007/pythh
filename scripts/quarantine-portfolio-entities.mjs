#!/usr/bin/env node
/**
 * Apply entity quarantine + entered-late flags on virtual_portfolio.
 *
 *   node scripts/quarantine-portfolio-entities.mjs --dry-run
 *   node scripts/quarantine-portfolio-entities.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { ENTITY_QUARANTINE_BY_NAME, MATURE_ENTRY_USD } from '../lib/portfolioOutreachGate.mjs';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function ensureColumns() {
  const { error } = await sb.rpc('exec_sql', {
    query: `
      ALTER TABLE virtual_portfolio
        ADD COLUMN IF NOT EXISTS entity_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS entity_quarantine_reason TEXT,
        ADD COLUMN IF NOT EXISTS entered_late BOOLEAN NOT NULL DEFAULT FALSE;
    `,
  });
  if (error && !/exec_sql|does not exist/i.test(error.message)) {
    console.warn('   (columns may already exist — continuing)', error.message?.slice(0, 80));
  }
}

async function main() {
  console.log(`\n🛡️  Portfolio quarantine + entered-late · ${APPLY ? 'APPLY' : 'dry-run'}\n`);

  const { data: rows, error } = await sb
    .from('virtual_portfolio')
    .select('id, startup_id, entry_valuation_usd, entity_quarantined, entered_late, status, moic, startup_uploads(name)');

  if (error) {
    if (/entity_quarantined/i.test(error.message)) {
      console.error('❌ Run migration 20260710000000_portfolio_quarantine_and_health.sql first');
      console.error('   Or apply columns in Supabase SQL editor, then re-run with --apply');
      process.exit(1);
    }
    throw error;
  }

  let quarantineCount = 0;
  let enteredLateCount = 0;

  for (const row of rows || []) {
    const su = Array.isArray(row.startup_uploads) ? row.startup_uploads[0] : row.startup_uploads;
    const name = su?.name || '';
    const reason = ENTITY_QUARANTINE_BY_NAME[name];
    const entryVal = Number(row.entry_valuation_usd) || 0;
    const shouldEnterLate = entryVal >= MATURE_ENTRY_USD;
    const patch = {};

    if (reason && !row.entity_quarantined) {
      patch.entity_quarantined = true;
      patch.entity_quarantine_reason = reason;
      quarantineCount++;
      console.log(`  quarantine: ${name} — ${reason}`);
    }

    if (shouldEnterLate && !row.entered_late) {
      patch.entered_late = true;
      enteredLateCount++;
      console.log(`  entered-late: ${name} — entry $${(entryVal / 1e6).toFixed(0)}M`);
    }

    if (Object.keys(patch).length && APPLY) {
      const { error: upErr } = await sb.from('virtual_portfolio').update(patch).eq('id', row.id);
      if (upErr) console.warn(`   ⚠ ${name}: ${upErr.message}`);
    }
  }

  console.log(`\n✅ ${APPLY ? 'Applied' : 'Would apply'} — quarantine ${quarantineCount} · entered-late ${enteredLateCount}\n`);
  if (!APPLY) console.log('   Pass --apply to write\n');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
