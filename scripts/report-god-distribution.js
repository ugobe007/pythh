#!/usr/bin/env node
/**
 * GOD score distribution for startup_uploads (read-only).
 *
 *   node scripts/report-god-distribution.js
 *   npm run report:god-distribution
 *
 * Env: VITE_SUPABASE_URL, SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAGE = 1000;

/** Buckets: floor-based bands aligned with RSS floor (40) and common cutoffs. */
const BUCKET_LABELS = [
  'null',
  '0–39',
  '40–49',
  '50–59',
  '60–69',
  '70–79',
  '80–89',
  '90–100',
];

function bucketFor(g) {
  if (g == null || !Number.isFinite(Number(g))) return 0;
  const x = Number(g);
  if (x < 40) return 1;
  if (x < 50) return 2;
  if (x < 60) return 3;
  if (x < 70) return 4;
  if (x < 80) return 5;
  if (x < 90) return 6;
  return 7;
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

function emptyHist() {
  return Array(8).fill(0);
}

async function main() {
  const overall = emptyHist();
  const byStatus = {};
  let n = 0;
  let sum = 0;
  let sumSq = 0;
  let finite = 0;
  let from = 0;

  for (;;) {
    const { data, error } = await sb
      .from('startup_uploads')
      .select('total_god_score, status')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;

    for (const row of data) {
      n += 1;
      const g = row.total_god_score;
      const b = bucketFor(g);
      overall[b] += 1;
      if (!byStatus[row.status]) byStatus[row.status] = emptyHist();
      byStatus[row.status][b] += 1;
      if (g != null && Number.isFinite(Number(g))) {
        const x = Number(g);
        sum += x;
        sumSq += x * x;
        finite += 1;
      }
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }

  const mean = finite ? sum / finite : null;
  const variance = finite > 1 ? sumSq / finite - mean * mean : 0;
  const stdev = finite > 1 ? Math.sqrt(Math.max(0, variance)) : null;

  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  GOD SCORE DISTRIBUTION — startup_uploads.total_god_score');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  rows: ${n}  |  finite scores: ${finite}  |  null/non-finite: ${n - finite}`);
  if (mean != null) {
    console.log(`  mean: ${mean.toFixed(2)}  |  stdev: ${stdev != null ? stdev.toFixed(2) : 'n/a'}`);
  }

  console.log('\n── Overall (count per bucket) ──');
  for (let i = 0; i < 8; i++) {
    const pct = n ? ((100 * overall[i]) / n).toFixed(1) : '0.0';
    console.log(`  ${BUCKET_LABELS[i].padEnd(8)} ${String(overall[i]).padStart(6)}  (${pct}%)`);
  }

  const statusOrder = ['approved', 'rejected', 'pending', 'reviewing', 'holding', 'pending_enrichment', 'archived'];
  console.log('\n── By status (same buckets) ──');
  for (const st of statusOrder) {
    const h = byStatus[st];
    if (!h || !h.some((x) => x > 0)) continue;
    const tot = h.reduce((a, b) => a + b, 0);
    console.log(`\n  ${st} (n=${tot})`);
    for (let i = 0; i < 8; i++) {
      if (!h[i]) continue;
      const pct = ((100 * h[i]) / tot).toFixed(1);
      console.log(`    ${BUCKET_LABELS[i].padEnd(8)} ${String(h[i]).padStart(6)}  (${pct}%)`);
    }
  }

  const out = {
    generated_at: new Date().toISOString(),
    row_count: n,
    finite_scores: finite,
    mean: mean != null ? Number(mean.toFixed(4)) : null,
    stdev: stdev != null ? Number(stdev.toFixed(4)) : null,
    buckets: BUCKET_LABELS.map((label, i) => ({ label, count: overall[i] })),
    by_status: Object.fromEntries(
      Object.entries(byStatus).map(([st, h]) => [
        st,
        { total: h.reduce((a, b) => a + b, 0), buckets: BUCKET_LABELS.map((label, i) => ({ label, count: h[i] })) },
      ])
    ),
  };

  const dir = path.join(process.cwd(), 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, `god-distribution-${Date.now()}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n── Wrote JSON ──\n  ${jsonPath}`);
  console.log('\n══════════════════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
