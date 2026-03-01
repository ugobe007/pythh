#!/usr/bin/env node
/**
 * DEADWOOD PURGE
 * ==============
 * 1. Deletes stale 'waiting' startups (30+ days) with junk names
 * 2. Marks remaining stale 'waiting' startups as 'enriched' 
 *    (accepts their current score, stops enrichment retries)
 *
 * Run: node scripts/deadwood-purge.js [--dry-run]
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const DRY_RUN = process.argv.includes('--dry-run');
if (DRY_RUN) console.log('🧪 DRY RUN — no writes\n');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Conservative junk filters ─────────────────────────────────────────────
const JUNK_PATTERNS = [
  /^(raises?|sources?|launches?|announces?|unveils?|acquires?|introduces?|deploys?|strengthens?|surpasses?|quadrupling|reimagining|rebranding|restructuring|moves?|cuts?|lays?\s+off|closed)\s/i,
  /\$\s*\d+\s*(m|b|million|billion)/i,
  /^(sequoia( capital)?|softbank|andreessen horowitz|a16z|lightspeed( ventures)?|tiger global|index ventures|general atlantic|accel( partners)?|khosla ventures?|greylock( partners)?|benchmark( capital)?|founders fund|bessemer|insight partners|battery ventures|bain capital|kkr|blackstone|apollo global|pear vc|y combinator|yc|techstars|500 startups)\b/i,
  /^(north america|south america|latin america|rural america|southeast asia|sub-?saharan africa|the middle east|western europe|east asia)$/i,
  /^(gavin newsom|elon musk|jeff bezos|mark zuckerberg|sam altman|sundar pichai|tim cook|satya nadella|andy jassy|jensen huang)$/i,
  /^(stat\+?\s+limit|exclusive:|breaking:|report:|update:|alert:|sponsored:)/i,
  /^(strengthening|expanding into|transforming the|building a new|creating a|enabling the|powering the|revolutionizing|disrupting the)\s/i,
];

function isJunk(name) {
  if (!name || name.trim().length < 2) return true;
  const t = name.trim();
  if (t.split(/\s+/).length >= 8) return true;
  if (t.length > 80) return true;
  for (const p of JUNK_PATTERNS) if (p.test(t)) return true;
  return false;
}

// ── Load all stale waiting startups ──────────────────────────────────────
let all = [];
let page = 0;
while (true) {
  const { data, error } = await supabase
    .from('startup_uploads')
    .select('id, name, created_at, total_god_score, enrichment_attempts, website')
    .eq('status', 'approved')
    .eq('enrichment_status', 'waiting')
    .range(page * 1000, (page + 1) * 1000 - 1);
  if (error) { console.error(error.message); process.exit(1); }
  all = all.concat(data);
  if (data.length < 1000) break;
  page++;
}

const stale = all.filter(r => {
  const ageDays = (Date.now() - new Date(r.created_at).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays >= 30;
});

const toDelete = stale.filter(r => isJunk(r.name));
const toAccept = stale.filter(r => !isJunk(r.name));

console.log(`Loaded ${all.length} waiting startups`);
console.log(`Stale (>=30d): ${stale.length}`);
console.log(`  → DELETE (junk names): ${toDelete.length}`);
console.log(`  → ACCEPT (mark enriched): ${toAccept.length}`);
console.log(`  Fresh (<30d, untouched): ${all.length - stale.length}\n`);

// ── Phase 1: Delete junk ──────────────────────────────────────────────────
console.log('Phase 1: Deleting junk...');
let deleted = 0;
const BATCH = 50;
for (let i = 0; i < toDelete.length; i += BATCH) {
  const batch = toDelete.slice(i, i + BATCH);
  const ids = batch.map(r => r.id);
  if (!DRY_RUN) {
    const { error } = await supabase.from('startup_uploads').delete().in('id', ids);
    if (error) { console.error('Delete error:', error.message); continue; }
  }
  deleted += batch.length;
  process.stdout.write(`\r  Deleted: ${deleted}/${toDelete.length}`);
}
console.log(`\n  ✅ Deleted ${deleted} junk startup${deleted !== 1 ? 's' : ''}`);

// ── Phase 2: Mark survivors as 'enriched' ────────────────────────────────
console.log('\nPhase 2: Accepting survivors (marking enriched)...');
let accepted = 0;
for (let i = 0; i < toAccept.length; i += BATCH) {
  const batch = toAccept.slice(i, i + BATCH);
  const ids = batch.map(r => r.id);
  if (!DRY_RUN) {
    const { error } = await supabase
      .from('startup_uploads')
      .update({
        enrichment_status: 'enriched',
        last_enrichment_attempt: new Date().toISOString(),
      })
      .in('id', ids);
    if (error) { console.error('Update error:', error.message); continue; }
  }
  accepted += batch.length;
  process.stdout.write(`\r  Accepted: ${accepted}/${toAccept.length}`);
}
console.log(`\n  ✅ Marked ${accepted} startup${accepted !== 1 ? 's' : ''} as enriched`);

console.log(`\n════════════════════════════════════════`);
console.log('DEADWOOD PURGE COMPLETE');
console.log(`════════════════════════════════════════`);
console.log(`  Deleted (junk):   ${deleted}`);
console.log(`  Accepted:         ${accepted}`);
console.log(`  Untouched (fresh): ${all.length - stale.length}`);
if (!DRY_RUN) {
  console.log(`\nNext: npx tsx scripts/recalculate-scores.ts`);
  console.log(`  (removes deleted startups from score pool)`);
}
