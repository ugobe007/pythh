#!/usr/bin/env node
/**
 * Report corrupted GOD scores on active portfolio holdings (exit 1 if any found).
 *
 *   node scripts/validate-portfolio-scores.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { detectScoreCorruption } = require('../lib/portfolioScoreGuardrails.js');

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: picks } = await sb.from('virtual_portfolio').select('startup_id, entry_god_score').eq('status', 'active');
const corrupt = [];

for (const pick of picks || []) {
  const { data: su } = await sb.from('startup_uploads').select('name, total_god_score, enhanced_god_score, status').eq('id', pick.startup_id).maybeSingle();
  if (!su) continue;
  const issues = detectScoreCorruption(su, { entry_god_score: pick.entry_god_score });
  if (issues.length) corrupt.push({ name: su.name, total: su.total_god_score, enhanced: su.enhanced_god_score, issues });
}

if (!corrupt.length) {
  console.log(`✅ All ${picks?.length || 0} portfolio holdings have sane GOD scores.`);
  process.exit(0);
}

console.log(`❌ ${corrupt.length} corrupted portfolio holding(s):\n`);
for (const row of corrupt) {
  console.log(`  ${row.name}: total=${row.total} enhanced=${row.enhanced} — ${row.issues.map((i) => i.code).join(', ')}`);
}
console.log('\nRun: node scripts/rescore-portfolio-holdings.mjs\n');
process.exit(1);
