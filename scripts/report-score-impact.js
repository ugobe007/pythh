#!/usr/bin/env node
/**
 * REPORT: GOD + Signal score impact of the Event Resolver enrichment.
 * Read-only. Uses count(exact, head) queries so it never pulls the full corpus.
 *
 *   node scripts/report-score-impact.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const GOD_BUCKETS = [[null, 1], [1, 41], [41, 61], [61, 76], [76, 1000]];
// signals_total is a 0-10 scale.
const SIG_BUCKETS = [[null, 0.0001], [0.0001, 2], [2, 4], [4, 6], [6, 1000]];

async function count(table, build) {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (build) q = build(q);
  const { count: c, error } = await q;
  if (error) { console.error(`  count error (${table}): ${error.message}`); return 0; }
  return c || 0;
}

// Average over a (filtered) cohort by paging only the score column.
async function avg(table, col, build, orderCol = 'id') {
  let sum = 0, n = 0, offset = 0;
  const PAGE = 1000;
  while (true) {
    let q = supabase.from(table).select(col).not(col, 'is', null).order(orderCol, { ascending: true }).range(offset, offset + PAGE - 1);
    if (build) q = build(q);
    const { data, error } = await q;
    if (error) { console.error(`  avg error (${table}.${col}): ${error.message}`); break; }
    if (!data || data.length === 0) break;
    for (const r of data) { const v = Number(r[col]); if (Number.isFinite(v)) { sum += v; n += 1; } }
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return { avg: n ? sum / n : null, n };
}

async function bucketRow(label, table, col, buckets, build) {
  const cells = [];
  for (const [lo, hi] of buckets) {
    const c = await count(table, (q) => {
      let qq = build ? build(q) : q;
      if (lo === null) return qq.is(col, null);
      qq = qq.gte(col, lo);
      if (hi < 1000) qq = qq.lt(col, hi);
      return qq;
    });
    cells.push(c);
  }
  return { label, cells };
}

function pct(n, total) { return total ? ((n / total) * 100).toFixed(1).padStart(5) + '%' : '   - '; }

(async () => {
  console.log('═'.repeat(78));
  console.log('  SCORE IMPACT REPORT — Event Resolver enrichment');
  console.log('═'.repeat(78));

  // ── corpus coverage ──────────────────────────────────────────────────────
  const total = await count('startup_uploads');
  const withWebsite = await count('startup_uploads', (q) => q.not('website', 'is', null));
  const resolverTouched = await count('startup_uploads', (q) => q.not('extracted_data->url_enriched_at', 'is', null));
  const withInvestors = await count('startup_uploads', (q) => q.not('extracted_data->investors', 'is', null));
  const scored = await count('startup_uploads', (q) => q.not('total_god_score', 'is', null));

  console.log('\n  CORPUS COVERAGE (startup_uploads)');
  console.log('  ' + '─'.repeat(60));
  console.log(`  total rows:                      ${total}`);
  console.log(`  has website:                     ${withWebsite}  (${pct(withWebsite, total).trim()})`);
  console.log(`  resolver-enriched (url stamp):   ${resolverTouched}  (${pct(resolverTouched, total).trim()})`);
  console.log(`  scorer-readable investors:       ${withInvestors}`);
  console.log(`  has GOD score:                   ${scored}  (${pct(scored, total).trim()})`);

  // ── GOD distribution: whole corpus vs resolver-enriched cohort ────────────
  console.log('\n  GOD SCORE DISTRIBUTION                 none    1-40   41-60   61-75    76+');
  console.log('  ' + '─'.repeat(74));
  const rowsGod = [
    await bucketRow('all rows           ', 'startup_uploads', 'total_god_score', GOD_BUCKETS),
    await bucketRow('resolver-enriched  ', 'startup_uploads', 'total_god_score', GOD_BUCKETS, (q) => q.not('extracted_data->url_enriched_at', 'is', null)),
    await bucketRow('has website        ', 'startup_uploads', 'total_god_score', GOD_BUCKETS, (q) => q.not('website', 'is', null)),
    await bucketRow('has investors      ', 'startup_uploads', 'total_god_score', GOD_BUCKETS, (q) => q.not('extracted_data->investors', 'is', null)),
  ];
  for (const r of rowsGod) {
    console.log(`  ${r.label}  ` + r.cells.map((c) => String(c).padStart(6)).join('  '));
  }

  // ── GOD averages per cohort ───────────────────────────────────────────────
  console.log('\n  GOD SCORE AVERAGES (scored rows only)');
  console.log('  ' + '─'.repeat(60));
  const aAll = await avg('startup_uploads', 'total_god_score');
  const aEnr = await avg('startup_uploads', 'total_god_score', (q) => q.not('extracted_data->url_enriched_at', 'is', null));
  const aInv = await avg('startup_uploads', 'total_god_score', (q) => q.not('extracted_data->investors', 'is', null));
  const f = (a) => (a.avg === null ? '   -' : a.avg.toFixed(1));
  console.log(`  all scored rows:        avg ${f(aAll)}   (n=${aAll.n})`);
  console.log(`  resolver-enriched:      avg ${f(aEnr)}   (n=${aEnr.n})`);
  console.log(`  has investors:          avg ${f(aInv)}   (n=${aInv.n})`);

  // ── Signal scores ─────────────────────────────────────────────────────────
  console.log('\n  SIGNAL SCORES (startup_signal_scores)');
  console.log('  ' + '─'.repeat(60));
  const sigTotal = await count('startup_signal_scores');
  const aSig = await avg('startup_signal_scores', 'signals_total', null, 'startup_id');
  console.log(`  rows with signal score:  ${sigTotal}  (of ${total} uploads = ${pct(sigTotal, total).trim()})`);
  console.log(`  avg signals_total /10:   ${aSig.avg === null ? '-' : aSig.avg.toFixed(2)}  (n=${aSig.n})`);

  console.log('\n  sub-signal averages (0-1 each):');
  for (const sub of ['founder_language_shift', 'investor_receptivity', 'news_momentum', 'capital_convergence', 'execution_velocity']) {
    const a = await avg('startup_signal_scores', sub, null, 'startup_id');
    console.log(`    ${sub.padEnd(24)} ${a.avg === null ? '-' : a.avg.toFixed(3)}`);
  }

  const sigRow = await bucketRow('signals_total /10  ', 'startup_signal_scores', 'signals_total', SIG_BUCKETS);
  console.log('\n  SIGNAL DISTRIBUTION                    0      0-2     2-4     4-6     6+');
  console.log('  ' + '─'.repeat(74));
  console.log(`  ${sigRow.label}  ` + sigRow.cells.map((c) => String(c).padStart(6)).join('  '));

  console.log('\n' + '═'.repeat(78));
})();
