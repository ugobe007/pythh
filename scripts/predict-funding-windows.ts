/**
 * FUNDING WINDOW PREDICTION RUNNER
 * ==================================
 * Runs nightly via PM2 cron (or manually: npx tsx scripts/predict-funding-windows.ts)
 *
 * 1. Fetches all approved startups with total_god_score >= 70
 * 2. Runs predictFundingWindow() for each
 * 3. Upserts into funding_predictions (one active prediction per startup)
 * 4. Expires old predictions past their window_end
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { predictFundingWindow } from '../server/services/fundingPredictionService';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const GOD_SCORE_THRESHOLD = 70;
const BATCH_SIZE = 100;

async function expireOldPredictions(): Promise<number> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('funding_predictions')
    .update({ status: 'expired', resolved_at: now, updated_at: now })
    .eq('status', 'active')
    .lt('window_end', now)
    .select('id');

  if (error) {
    console.warn('⚠️  Could not expire old predictions:', error.message);
    return 0;
  }
  return data?.length || 0;
}

async function runPredictions(): Promise<void> {
  console.log('🔮 Funding Window Prediction Runner');
  console.log(`   GOD score threshold: ${GOD_SCORE_THRESHOLD}+`);
  console.log(`   Started: ${new Date().toISOString()}\n`);

  // Step 1: Expire past-window predictions
  const expired = await expireOldPredictions();
  if (expired > 0) console.log(`⏰ Expired ${expired} old predictions\n`);

  // Step 2: Fetch all qualifying startups
  console.log('📥 Fetching qualifying startups...');
  const allStartups: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(`
        id, name, total_god_score, signals_bonus, momentum_score,
        lead_investor, followon_investors, advisors,
        description, pitch, tagline, extracted_data
      `)
      .eq('status', 'approved')
      .gte('total_god_score', GOD_SCORE_THRESHOLD)
      .range(from, from + BATCH_SIZE - 1)
      .order('total_god_score', { ascending: false });

    if (error) { console.error('❌ Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    allStartups.push(...data);
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  console.log(`   Found ${allStartups.length} startups with GOD ≥ ${GOD_SCORE_THRESHOLD}\n`);

  // Step 3: Generate predictions
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const nowIso = new Date().toISOString();

  for (const startup of allStartups) {
    const prediction = predictFundingWindow(startup);
    if (!prediction) { skipped++; continue; }

    const row = {
      startup_id: prediction.startup_id,
      god_score: prediction.god_score,
      signals_score: prediction.signals_score,
      confidence: prediction.confidence,
      confidence_label: prediction.confidence_label,
      window_start: prediction.window_start.toISOString(),
      window_end: prediction.window_end.toISOString(),
      window_days: prediction.window_days,
      signals_snapshot: prediction.signals_snapshot,
      status: 'active',
      updated_at: nowIso,
    };

    // Check if an active prediction already exists
    const { data: existing } = await supabase
      .from('funding_predictions')
      .select('id, confidence_label, window_days')
      .eq('startup_id', startup.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      // Update only if confidence label or window changed meaningfully
      const changed =
        existing.confidence_label !== prediction.confidence_label ||
        Math.abs(existing.window_days - prediction.window_days) > 7;

      if (!changed) { skipped++; continue; }

      await supabase
        .from('funding_predictions')
        .update(row)
        .eq('id', existing.id);
      updated++;
    } else {
      await supabase
        .from('funding_predictions')
        .insert({ ...row, created_at: nowIso });
      created++;
    }

    if (prediction.confidence_label === 'Imminent') {
      console.log(
        `  🔴 IMMINENT  ${startup.name.padEnd(35)} GOD ${startup.total_god_score}` +
        `  window: ${prediction.window_days}d  conf: ${(prediction.confidence * 100).toFixed(0)}%`
      );
    } else if (prediction.confidence_label === 'Strong Signal') {
      console.log(
        `  🟡 STRONG    ${startup.name.padEnd(35)} GOD ${startup.total_god_score}` +
        `  window: ${prediction.window_days}d  conf: ${(prediction.confidence * 100).toFixed(0)}%`
      );
    }
  }

  console.log(`\n📊 SUMMARY`);
  console.log(`   Created: ${created}`);
  console.log(`   Updated: ${updated}`);
  console.log(`   Skipped (unchanged): ${skipped}`);
  console.log(`   Expired: ${expired}`);
  console.log(`   Total processed: ${allStartups.length}`);
  console.log('✅ Prediction run complete');
}

runPredictions().catch(console.error);
