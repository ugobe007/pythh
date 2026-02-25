#!/usr/bin/env node
/**
 * ENRICHMENT HEALTH CHECK
 *
 * Monitors the quality of the enrichment pipeline and GOD score data.
 * Run daily via PM2 cron or manually to detect regressions.
 *
 * Checks:
 *   1. Enrichment status breakdown (% enriched vs waiting vs holding)
 *   2. Traction field coverage (% with funding/ARR/customers)
 *   3. Average fields per enriched startup
 *   4. GOD score distribution (avg, % below 50 = floor padding)
 *   5. Data freshness (enrichments in last 24h / 7d)
 *   6. Junk URL contamination (article URLs in website field)
 *
 * Thresholds:
 *   PASS  = healthy
 *   WARN  = degraded but not broken
 *   FAIL  = pipeline needs attention
 *
 * Usage:
 *   node scripts/enrich-health-check.js
 *   node scripts/enrich-health-check.js --json     # machine-readable output
 *   node scripts/enrich-health-check.js --no-log   # skip ai_logs write
 *
 * Exit code: 0 = all PASS/WARN, 1 = any FAIL
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isJunkUrl } = require('../lib/junk-url-config');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');
const skipLog = args.includes('--no-log');

// ============================================================================
// Thresholds
// Adjust these as baseline expectations improve over time.
// ============================================================================
const THRESHOLDS = {
  enrichedPct:     { pass: 60, warn: 35 },  // % of approved startups with status='enriched'
  tractionPct:     { pass: 30, warn: 15 },  // % with funding OR ARR OR customers in extracted_data
  avgFields:       { pass: 10, warn: 5  },  // avg fields per enriched startup's extracted_data
  godScoreAvg:     { pass: 52, warn: 46 },  // avg total_god_score (floor is 40)
  godScoreHighPct: { pass: 20, warn: 8  },  // % with score >= 65 (genuinely good scores)
  freshness24h:    { pass: 20, warn: 5  },  // enrichments in last 24h
  junkUrlPct:      { pass: 2,  warn: 5  },  // % of approved startups with junk website URLs (lower = better, so inverted)
};

// ============================================================================
// Helpers
// ============================================================================
function grade(value, threshold, invertedIsGood = false) {
  if (invertedIsGood) {
    if (value <= threshold.pass) return 'PASS';
    if (value <= threshold.warn) return 'WARN';
    return 'FAIL';
  }
  if (value >= threshold.pass) return 'PASS';
  if (value >= threshold.warn) return 'WARN';
  return 'FAIL';
}

function pct(num, denom) {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

const symbols = { PASS: '✅', WARN: '⚠️ ', FAIL: '❌' };

function row(label, value, g, detail = '') {
  if (!jsonMode) {
    console.log(`  ${symbols[g]} ${label.padEnd(32)} ${String(value).padStart(6)}${detail ? '  — ' + detail : ''}`);
  }
}

// ============================================================================
// Main
// ============================================================================
async function runHealthCheck() {
  if (!jsonMode) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ENRICHMENT PIPELINE HEALTH CHECK');
    console.log('  ' + new Date().toISOString());
    console.log('═══════════════════════════════════════════════════════════════\n');
  }

  const results = {};
  let anyFail = false;

  // ── 1. Enrichment status breakdown ────────────────────────────────────────
  const { data: allApproved } = await supabase
    .from('startup_uploads')
    .select('id, enrichment_status, total_god_score, website, extracted_data, last_enrichment_attempt')
    .eq('status', 'approved');

  const total = allApproved?.length || 0;
  if (total === 0) {
    console.error('No approved startups found — is the DB connection working?');
    process.exit(1);
  }

  const statusCounts = { enriched: 0, waiting: 0, holding: 0, null: 0 };
  for (const s of allApproved) {
    const st = s.enrichment_status || 'null';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  }

  const enrichedPct = pct(statusCounts.enriched, total);
  const waitingCount = statusCounts.waiting + statusCounts.null;
  const holdingCount = statusCounts.holding || 0;

  const g1 = grade(enrichedPct, THRESHOLDS.enrichedPct);
  if (g1 === 'FAIL') anyFail = true;
  results.enrichedPct = { value: enrichedPct, grade: g1 };

  if (!jsonMode) console.log('▶ Enrichment Status');
  row('Enriched', `${enrichedPct}%`, g1, `${statusCounts.enriched}/${total} approved`);
  row('Waiting/null', `${pct(waitingCount, total)}%`, waitingCount > total * 0.5 ? 'WARN' : 'PASS', `${waitingCount} startups need enrichment`);
  row('Holding', `${pct(holdingCount, total)}%`, holdingCount > total * 0.3 ? 'WARN' : 'PASS', `${holdingCount} startups gave up after 3 attempts`);

  // ── 2. Traction field coverage ─────────────────────────────────────────────
  let withTraction = 0;
  let withFunding = 0;
  let withCustomers = 0;
  let withRevenue = 0;
  let totalFields = 0;
  let enrichedCount = 0;

  for (const s of allApproved) {
    const ex = s.extracted_data || {};
    const hasFunding = !!(ex.raise_amount || ex.funding_amount);
    const hasCustomers = !!(ex.customer_count || ex.customers);
    const hasRevenue = !!(ex.arr || ex.mrr || ex.revenue);

    if (hasFunding || hasCustomers || hasRevenue) withTraction++;
    if (hasFunding) withFunding++;
    if (hasCustomers) withCustomers++;
    if (hasRevenue) withRevenue++;

    if (s.enrichment_status === 'enriched' && ex && typeof ex === 'object') {
      const fieldCount = Object.keys(ex).filter(k => {
        const v = ex[k];
        return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
      }).length;
      totalFields += fieldCount;
      enrichedCount++;
    }
  }

  const tractionPct = pct(withTraction, total);
  const avgFields = enrichedCount > 0 ? Math.round(totalFields / enrichedCount) : 0;

  const g2 = grade(tractionPct, THRESHOLDS.tractionPct);
  const g3 = grade(avgFields, THRESHOLDS.avgFields);
  if (g2 === 'FAIL' || g3 === 'FAIL') anyFail = true;
  results.tractionPct = { value: tractionPct, grade: g2 };
  results.avgFields = { value: avgFields, grade: g3 };

  if (!jsonMode) console.log('\n▶ Data Quality');
  row('Traction coverage', `${tractionPct}%`, g2, `${withTraction}/${total} have funding/ARR/customers`);
  row('  → With funding',  `${pct(withFunding, total)}%`,   withFunding < total * 0.1 ? 'WARN' : 'PASS', `raise_amount or funding_amount`);
  row('  → With customers',`${pct(withCustomers, total)}%`, withCustomers < total * 0.05 ? 'WARN' : 'PASS', `customer_count or customers`);
  row('  → With revenue',  `${pct(withRevenue, total)}%`,   withRevenue < total * 0.05 ? 'WARN' : 'PASS', `arr / mrr / revenue`);
  row('Avg fields/startup', `${avgFields}`,   g3, `across ${enrichedCount} enriched startups`);

  // ── 3. GOD Score distribution ─────────────────────────────────────────────
  const scores = allApproved.map(s => s.total_god_score || 0).filter(s => s > 0);
  const scoreAvg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const atFloor = scores.filter(s => s >= 40 && s <= 45).length;
  const highScore = scores.filter(s => s >= 65).length;

  const g4 = grade(scoreAvg, THRESHOLDS.godScoreAvg);
  const g5 = grade(pct(highScore, scores.length), THRESHOLDS.godScoreHighPct);
  if (g4 === 'FAIL') anyFail = true;
  results.godScoreAvg = { value: scoreAvg, grade: g4 };

  if (!jsonMode) console.log('\n▶ GOD Score Distribution');
  row('Average GOD score',  scoreAvg, g4, `(floor=40, target avg≥52)`);
  row('At floor (40-45)',   `${pct(atFloor, scores.length)}%`, atFloor > scores.length * 0.5 ? 'WARN' : 'PASS', `${atFloor} startups barely above minimum`);
  row('High scores (≥65)',  `${pct(highScore, scores.length)}%`, g5, `${highScore} genuinely strong profiles`);

  // ── 4. Data freshness ─────────────────────────────────────────────────────
  const now = Date.now();
  const last24h = allApproved.filter(s =>
    s.last_enrichment_attempt &&
    (now - new Date(s.last_enrichment_attempt).getTime()) < 24 * 60 * 60 * 1000
  ).length;
  const last7d = allApproved.filter(s =>
    s.last_enrichment_attempt &&
    (now - new Date(s.last_enrichment_attempt).getTime()) < 7 * 24 * 60 * 60 * 1000
  ).length;

  const g6 = grade(last24h, THRESHOLDS.freshness24h);
  if (g6 === 'FAIL') anyFail = true;
  results.freshness24h = { value: last24h, grade: g6 };

  if (!jsonMode) console.log('\n▶ Data Freshness');
  row('Enriched (last 24h)', last24h, g6, `target ≥${THRESHOLDS.freshness24h.pass}/day`);
  row('Enriched (last 7d)',  last7d, last7d < 50 ? 'WARN' : 'PASS');

  // ── 5. Junk URL contamination ─────────────────────────────────────────────
  const withWebsite = allApproved.filter(s => s.website);
  const junkUrls = withWebsite.filter(s => isJunkUrl(s.website));
  const junkPct = pct(junkUrls.length, withWebsite.length);

  const g7 = grade(junkPct, THRESHOLDS.junkUrlPct, true /* inverted: lower is better */);
  if (g7 === 'FAIL') anyFail = true;
  results.junkUrlPct = { value: junkPct, grade: g7 };

  if (!jsonMode) console.log('\n▶ Data Integrity');
  row('Junk URLs in website field', `${junkPct}%`, g7, `${junkUrls.length}/${withWebsite.length} are article/social URLs`);
  if (junkUrls.length > 0 && !jsonMode && junkPct > 2) {
    const examples = junkUrls.slice(0, 3).map(s => `"${s.name}" → ${(s.website || '').substring(0, 60)}`);
    examples.forEach(e => console.log(`         ${e}`));
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const grades = Object.values(results).map(r => r.grade);
  const failCount = grades.filter(g => g === 'FAIL').length;
  const warnCount = grades.filter(g => g === 'WARN').length;

  if (!jsonMode) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    const overallGrade = failCount > 0 ? 'FAIL' : warnCount > 0 ? 'WARN' : 'PASS';
    console.log(`  OVERALL: ${symbols[overallGrade]} ${overallGrade}  (${failCount} fail, ${warnCount} warn)`);
    if (failCount > 0 || warnCount > 0) {
      console.log('\n  REMEDIATION HINTS:');
      if (results.enrichedPct?.grade !== 'PASS') console.log('    → Run: pm2 start "node scripts/enrich-sparse-startups.js --limit=800" --name enrichment-backfill');
      if (results.tractionPct?.grade !== 'PASS') console.log('    → Low traction coverage — news enrichment may be broken; check inferenceService.js');
      if (results.godScoreAvg?.grade !== 'PASS') console.log('    → Low GOD scores — run: npx tsx scripts/recalculate-scores.ts');
      if (results.junkUrlPct?.grade !== 'PASS')  console.log('    → Junk URLs in DB — scraper may be writing article links as website field; check ssot-rss-scraper.js');
      if (results.freshness24h?.grade !== 'PASS') console.log('    → Enrichment stale — check PM2: pm2 show startup-enrichment-worker');
    }
    console.log('═══════════════════════════════════════════════════════════════\n');
  }

  if (jsonMode) {
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), results, anyFail }, null, 2));
  }

  // ── Log to ai_logs ────────────────────────────────────────────────────────
  if (!skipLog) {
    try {
      await supabase.from('ai_logs').insert({
        type: 'enrich_health_check',
        message: `Enrichment health: enriched=${enrichedPct}% traction=${tractionPct}% godAvg=${scoreAvg} fresh24h=${last24h}`,
        metadata: { results, total, scoreAvg, enrichedPct, tractionPct, avgFields, junkPct, last24h },
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      // Non-fatal — health check still ran
    }
  }

  process.exit(anyFail ? 1 : 0);
}

runHealthCheck().catch(err => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});
