#!/usr/bin/env node
/**
 * GOD score audit — component vs total divergence, junk names, optional fixes.
 *
 * Usage:
 *   node scripts/god-score-audit.js
 *   node scripts/god-score-audit.js --flag-junk --apply
 *   node scripts/god-score-audit.js --sample=5000
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { paginateStartupUploads } = require('../server/lib/supabaseClient');
const { isValidStartupName } = require('../lib/startupNameValidator');

const APPLY = process.argv.includes('--apply');
const FLAG_JUNK = process.argv.includes('--flag-junk');
const sampleArg = process.argv.find((a) => a.startsWith('--sample='));
const SAMPLE = sampleArg ? parseInt(sampleArg.split('=')[1], 10) : 3000;

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function componentSum(r) {
  const parts = [r.team_score, r.traction_score, r.market_score, r.product_score, r.vision_score]
    .filter((n) => typeof n === 'number');
  return parts.length ? parts.reduce((a, b) => a + b, 0) : null;
}

async function main() {
  console.log(`\n🔬 GOD score audit ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const rows = await paginateStartupUploads(
    sb,
    'id, name, status, total_god_score, team_score, traction_score, market_score, product_score, vision_score, entity_gate, admin_notes',
    (q) => q.eq('status', 'approved'),
  );

  const sample = rows.slice(0, SAMPLE);
  let divergent = 0;
  let junkApproved = 0;
  const junkExamples = [];
  const divergenceExamples = [];

  for (const r of sample) {
    const comp = componentSum(r);
    const total = r.total_god_score;
    if (comp != null && total != null) {
      const gap = total - comp;
      if (Math.abs(gap) > 30) {
        divergent++;
        if (divergenceExamples.length < 8) {
          divergenceExamples.push({ name: r.name, total, comp: Math.round(comp), gap: Math.round(gap) });
        }
      }
    }

    const v = isValidStartupName(r.name);
    if (!v.isValid) {
      junkApproved++;
      if (junkExamples.length < 12) junkExamples.push({ name: r.name, reason: v.reason });
      if (FLAG_JUNK && APPLY) {
        await sb.from('startup_uploads').update({
          entity_gate: 'junk',
          admin_notes: `[god-audit] invalid name: ${v.reason}${r.admin_notes ? ' | ' + r.admin_notes : ''}`.slice(0, 500),
        }).eq('id', r.id);
      }
    }
  }

  const gods = rows.map((r) => r.total_god_score).filter((n) => typeof n === 'number');
  const mean = gods.length ? gods.reduce((a, b) => a + b, 0) / gods.length : 0;
  const at40 = gods.filter((s) => s === 40).length;

  console.log('Approved startups:', rows.length);
  console.log('GOD mean:', Math.round(mean * 10) / 10, '· at floor 40:', at40);
  console.log(`Component divergence >30pts (sample ${sample.length}):`, divergent);
  if (divergenceExamples.length) {
    console.log('  examples:', divergenceExamples);
  }
  console.log(`Invalid names in approved (sample):`, junkApproved);
  if (junkExamples.length) {
    console.log('  junk examples:');
    junkExamples.forEach((j) => console.log(`    · ${j.name} (${j.reason})`));
  }

  console.log('\nRecommendations:');
  console.log('  · Total GOD includes bonus layers (signals, momentum, AP) — divergence from raw components is expected.');
  console.log('  · Flag junk at ingest via isValidStartupName before status=approved.');
  console.log('  · Re-run recalculate-scores after enrichment to sync components.');
  if (FLAG_JUNK && !APPLY) console.log('\n(dry-run — re-run with --flag-junk --apply to mark entity_gate=junk)');
  console.log('');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
