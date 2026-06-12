#!/usr/bin/env node
/**
 * SNAPSHOT SIGNAL SCORES (daily)
 * ==============================
 * startup_signal_scores holds only the current row per startup (upserted in place), so signal
 * SCORE velocity (slope of signals_total over time) is not computable from it. This cron copies
 * the current scores into startup_signal_score_history once per day (idempotent via a unique
 * (startup_id, captured_on) index). After a few weeks of snapshots, signalVelocity can swap its
 * "signal level" term for a true score-slope velocity.
 *
 * Usage:
 *   node scripts/cron/snapshot-signal-scores.mjs            # dry-run (counts only)
 *   node scripts/cron/snapshot-signal-scores.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();
const APPLY = process.argv.includes('--apply');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n📸 Snapshotting signal scores for ${today} ${APPLY ? '(APPLY)' : '(dry-run)'}\n`);

  const { data: scores, error } = await supabase
    .from('startup_signal_scores')
    .select('startup_id, signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity');
  if (error) { console.error('Read error:', error.message); process.exit(1); }

  const rows = (scores || [])
    .filter((r) => r.startup_id)
    .map((r) => ({
      startup_id: r.startup_id,
      signals_total: r.signals_total,
      founder_language_shift: r.founder_language_shift,
      investor_receptivity: r.investor_receptivity,
      news_momentum: r.news_momentum,
      capital_convergence: r.capital_convergence,
      execution_velocity: r.execution_velocity,
      captured_on: today,
    }));

  console.log(`${rows.length} signal-score rows to snapshot.`);

  if (!APPLY) {
    console.log('\n(dry-run — re-run with --apply to persist.)');
    return;
  }

  // Idempotent: onConflict on (startup_id, captured_on) updates the day's snapshot in place.
  let written = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const { error: upErr } = await supabase
      .from('startup_signal_score_history')
      .upsert(batch, { onConflict: 'startup_id,captured_on' });
    if (upErr) { console.error('Upsert error:', upErr.message); process.exit(1); }
    written += batch.length;
  }
  console.log(`✅ Snapshotted ${written} signal scores for ${today}.`);

  const { count } = await supabase
    .from('startup_signal_score_history')
    .select('*', { count: 'exact', head: true });
  console.log(`📈 History table now holds ${count} total snapshots.`);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
