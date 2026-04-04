#!/usr/bin/env node
/**
 * Print enrichment queue stats (same rules as GET /api/admin/score-health → enrichment).
 *
 * Usage:
 *   node scripts/print-enrichment-stats.js
 *
 * Requires .env with Supabase URL + service role key (same as server).
 * This is NOT run as: node enrichment.needs_enrichment  ← that key is JSON, not a file.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getSupabaseClient, paginateStartupUploads } = require('../server/lib/supabaseClient');

function startupRowNeedsEnrichment(r) {
  if (!r || !r.extracted_data) return true;
  const tier = r.extracted_data?.data_tier;
  if (tier === 'C') return true;
  if (tier !== 'A' && tier !== 'B') return true;
  if (typeof r.data_completeness === 'number' && r.data_completeness < 35) return true;
  return false;
}

async function main() {
  const supabase = getSupabaseClient();
  const rows = await paginateStartupUploads(
    supabase,
    'extracted_data, data_completeness, status',
    (q) => q,
  );

  const byTier = { A: 0, B: 0, C: 0, unknown: 0 };
  const byStatus = {};
  let needs = 0;
  for (const r of rows) {
    const st = r.status || 'unknown';
    byStatus[st] = (byStatus[st] || 0) + 1;
    const tier = r.extracted_data?.data_tier;
    if (tier === 'A') byTier.A += 1;
    else if (tier === 'B') byTier.B += 1;
    else if (tier === 'C') byTier.C += 1;
    else byTier.unknown += 1;
    if (startupRowNeedsEnrichment(r)) needs += 1;
  }

  console.log(JSON.stringify(
    {
      source: 'startup_uploads (paginated)',
      total: rows.length,
      needs_enrichment: needs,
      by_tier: byTier,
      by_startup_status: byStatus,
      criteria:
        'needs_enrichment = missing extracted_data, tier C, unknown tier, or data_completeness < 35',
      hint: 'Or curl: curl -s http://localhost:3002/api/admin/score-health | jq .enrichment',
    },
    null,
    2,
  ));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
