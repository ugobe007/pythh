#!/usr/bin/env node
/**
 * Backfill social_score for approved startups that currently have score = 0.
 *
 * Usage:
 *   node scripts/backfill-social-scores.js [--limit 500] [--delay 50]
 *
 * Safe to run multiple times (idempotent — skips startups with social_score > 0).
 */

require('dotenv').config();
const { batchEnrichSocialScores } = require('../server/services/newsSignalService');

const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '500');
const delay = parseInt(args.find(a => a.startsWith('--delay='))?.split('=')[1] || '50');

(async () => {
  console.log(`[backfill-social-scores] Starting — limit=${limit}, delayMs=${delay}`);
  const result = await batchEnrichSocialScores({ limit, delayMs: delay });
  console.log(`[backfill-social-scores] Done:`, result);
})().catch(err => {
  console.error('[backfill-social-scores] Fatal:', err.message);
  process.exit(1);
});
