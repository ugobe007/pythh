#!/usr/bin/env node
/**
 * Measure how many recent startup_events would pass lib/source-quality-filter.js.
 * Use for before/after tuning (e.g. after changing NOISY_PUBLISHERS).
 *
 * Usage:
 *   node scripts/measure-source-quality-impact.js
 *   node scripts/measure-source-quality-impact.js --days=30 --limit=8000
 *
 * Env: SKIP_SOURCE_QUALITY_FILTER=1 makes "kept" = all (sanity check).
 */

'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { shouldProcessEvent, isSourceQualityFilterDisabled } = require('../lib/source-quality-filter');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

function argNum(flag, def) {
  const a = process.argv.find((x) => x.startsWith(flag + '='));
  if (!a) return def;
  const v = parseInt(a.split('=')[1], 10);
  return Number.isFinite(v) ? v : def;
}

async function main() {
  const days = argNum('--days', 14);
  const limit = argNum('--limit', 5000);
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from('startup_events')
    .select('id, source_title, source_publisher, occurred_at')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const rows = data || [];
  const byReason = {};
  let kept = 0;
  let dropped = 0;

  for (const row of rows) {
    const r = shouldProcessEvent(row.source_title, row.source_publisher);
    if (r.keep) {
      kept++;
    } else {
      dropped++;
      byReason[r.reason] = (byReason[r.reason] || 0) + 1;
    }
  }

  const n = rows.length || 1;
  const out = {
    script: 'measure-source-quality-impact',
    days,
    limit_requested: limit,
    sample_size: rows.length,
    filter_disabled: isSourceQualityFilterDisabled(),
    kept,
    dropped,
    kept_rate: Math.round((kept / n) * 1000) / 1000,
    drop_rate: Math.round((dropped / n) * 1000) / 1000,
    dropped_by_reason: byReason,
    hint: 'Compare drop_rate after RSS pipeline changes; use SSOT scraper metrics.source_quality for live rejects.',
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
