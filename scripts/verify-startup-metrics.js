#!/usr/bin/env node
/**
 * VERIFY STARTUP METRICS v1
 * ═══════════════════════════════════════════════════════════════════════════════
 * Post-backfill verification script.
 *
 * USAGE:
 *   node scripts/verify-startup-metrics.js
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function q(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
  if (error) { console.error('SQL Error:', error.message); return null; }
  return data;
}

const KNOWN_PUBLISHERS = [
  'techcrunch.com', 'bloomberg.com', 'reuters.com', 'cnbc.com',
  'forbes.com', 'venturebeat.com', 'sifted.eu', 'eu-startups.com',
  'pulse2.com', 'news.google.com', 'stratechery.com', 'saastr.com',
  'pehub.com', 'pitchbook.com', 'crunchbase.com', 'yahoo.com',
  'medium.com', 'substack.com', 'theverge.com', 'wired.com',
  'businessinsider.com', 'ft.com', 'wsj.com', 'nytimes.com',
  'bbc.com', 'bbc.co.uk', 'theguardian.com', 'cnn.com',
  'medcitynews.com', 'vccafe.com', 'technode.com', 'arctic15.com',
];

function fmt(n) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  VERIFY: Startup Metrics v1                              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // ─── 1. Column Population ──────────────────────────────────────────
  console.log('═══ 1. COLUMN POPULATION ═══\n');
  
  const pop = await q(`SELECT json_build_object(
    'total', COUNT(*),
    'with_domain', COUNT(*) FILTER (WHERE company_domain IS NOT NULL AND company_domain != ''),
    'with_mv', COUNT(*) FILTER (WHERE metrics_version IS NOT NULL),
    'with_lr', COUNT(*) FILTER (WHERE last_round_amount_usd IS NOT NULL AND last_round_amount_usd > 0),
    'with_tf', COUNT(*) FILTER (WHERE total_funding_usd IS NOT NULL AND total_funding_usd > 0),
    'with_val', COUNT(*) FILTER (WHERE valuation_usd IS NOT NULL AND valuation_usd > 0),
    'with_arr', COUNT(*) FILTER (WHERE arr_usd IS NOT NULL AND arr_usd > 0),
    'with_rev', COUNT(*) FILTER (WHERE revenue_usd IS NOT NULL AND revenue_usd > 0),
    'with_hc', COUNT(*) FILTER (WHERE parsed_headcount IS NOT NULL AND parsed_headcount > 0),
    'with_cust', COUNT(*) FILTER (WHERE parsed_customers IS NOT NULL AND parsed_customers > 0),
    'with_users', COUNT(*) FILTER (WHERE parsed_users IS NOT NULL AND parsed_users > 0),
    'with_burn', COUNT(*) FILTER (WHERE burn_monthly_usd IS NOT NULL AND burn_monthly_usd > 0),
    'with_runway', COUNT(*) FILTER (WHERE runway_months IS NOT NULL AND runway_months > 0),
    'with_fconf', COUNT(*) FILTER (WHERE funding_confidence IS NOT NULL AND funding_confidence > 0),
    'with_tconf', COUNT(*) FILTER (WHERE traction_confidence IS NOT NULL AND traction_confidence > 0),
    'with_sm', COUNT(*) FILTER (WHERE startup_metrics IS NOT NULL)
  ) AS result FROM startup_uploads WHERE status = 'approved'`);

  if (!pop) { console.error('Failed to query'); return; }
  const total = pop.total;
  console.log(`  Total approved: ${total}\n`);
  
  const flds = [
    ['company_domain', pop.with_domain], ['metrics_version', pop.with_mv],
    ['last_round_amount_usd', pop.with_lr], ['total_funding_usd', pop.with_tf],
    ['valuation_usd', pop.with_val], ['arr_usd', pop.with_arr],
    ['revenue_usd', pop.with_rev], ['parsed_headcount', pop.with_hc],
    ['parsed_customers', pop.with_cust], ['parsed_users', pop.with_users],
    ['burn_monthly_usd', pop.with_burn], ['runway_months', pop.with_runway],
    ['funding_confidence', pop.with_fconf], ['traction_confidence', pop.with_tconf],
    ['startup_metrics', pop.with_sm],
  ];
  for (const [name, count] of flds) {
    const pct = ((count / total) * 100).toFixed(1);
    const bar = '█'.repeat(Math.round(count / total * 30));
    console.log(`  ${name.padEnd(28)} ${String(count).padStart(6)} (${pct.padStart(5)}%) ${bar}`);
  }

  // ─── 2. Plausibility ──────────────────────────────────────────────
  console.log('\n═══ 2. PLAUSIBILITY CHECKS ═══\n');

  const bf = await q(`SELECT json_agg(r) FROM (
    SELECT name, last_round_amount_usd as lr, total_funding_usd as tf,
           valuation_usd as val, funding_confidence as conf, company_domain as dom
    FROM startup_uploads WHERE status='approved'
      AND (last_round_amount_usd > 10000000000 OR total_funding_usd > 10000000000)
    ORDER BY COALESCE(last_round_amount_usd,0) DESC LIMIT 20
  ) r`);

  console.log('  Funding > $10B (potential false positives):');
  if (!bf || bf.length === 0) {
    console.log('    None — all plausible ✅');
  } else {
    for (const s of bf) {
      const lr = s.lr ? `$${fmt(s.lr)}` : '-';
      const tf = s.tf ? `$${fmt(s.tf)}` : '-';
      const v = s.val ? `$${fmt(s.val)}` : '-';
      console.log(`    ⚠️  ${s.name.padEnd(40).slice(0,40)} Rnd:${lr.padStart(8)} Tot:${tf.padStart(8)} Val:${v.padStart(8)} conf=${s.conf} (${s.dom||'?'})`);
    }
  }

  const bh = await q(`SELECT json_agg(r) FROM (
    SELECT name, parsed_headcount as hc, company_domain as dom
    FROM startup_uploads WHERE status='approved' AND parsed_headcount > 10000
    ORDER BY parsed_headcount DESC LIMIT 10
  ) r`);

  console.log('\n  Headcount > 10,000:');
  if (!bh || bh.length === 0) console.log('    None ✅');
  else for (const s of bh) console.log(`    ⚠️  ${s.name.padEnd(40).slice(0,40)} ${String(s.hc).padStart(8)} (${s.dom||'?'})`);

  // ─── 3. Distributions ─────────────────────────────────────────────
  console.log('\n═══ 3. DISTRIBUTIONS ═══\n');

  const fd = await q(`SELECT json_build_object(
    'z', COUNT(*) FILTER (WHERE COALESCE(last_round_amount_usd,0)=0),
    's1m', COUNT(*) FILTER (WHERE last_round_amount_usd > 0 AND last_round_amount_usd < 1000000),
    'm1_10', COUNT(*) FILTER (WHERE last_round_amount_usd >= 1000000 AND last_round_amount_usd < 10000000),
    'm10_50', COUNT(*) FILTER (WHERE last_round_amount_usd >= 10000000 AND last_round_amount_usd < 50000000),
    'm50_200', COUNT(*) FILTER (WHERE last_round_amount_usd >= 50000000 AND last_round_amount_usd < 200000000),
    'm200_1b', COUNT(*) FILTER (WHERE last_round_amount_usd >= 200000000 AND last_round_amount_usd < 1000000000),
    'b1_10', COUNT(*) FILTER (WHERE last_round_amount_usd >= 1000000000 AND last_round_amount_usd < 10000000000),
    'b10p', COUNT(*) FILTER (WHERE last_round_amount_usd >= 10000000000),
    'avg', AVG(last_round_amount_usd) FILTER (WHERE last_round_amount_usd > 0),
    'med', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY last_round_amount_usd) FILTER (WHERE last_round_amount_usd > 0),
    'p90', PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY last_round_amount_usd) FILTER (WHERE last_round_amount_usd > 0)
  ) AS result FROM startup_uploads WHERE status='approved'`);

  console.log('  Last Round Amount:');
  if (fd) {
    for (const [label, count] of [['No funding',fd.z],['<$1M',fd.s1m],['$1-10M',fd.m1_10],['$10-50M',fd.m10_50],['$50-200M',fd.m50_200],['$200M-1B',fd.m200_1b],['$1-10B',fd.b1_10],['$10B+',fd.b10p]]) {
      const pct = ((count/total)*100).toFixed(1);
      const bar = '█'.repeat(Math.round(count/total*40));
      console.log(`    ${label.padEnd(14)} ${String(count).padStart(6)} (${pct.padStart(5)}%) ${bar}`);
    }
    if (fd.avg) {
      console.log(`    Avg:    $${fmt(fd.avg)}`);
      console.log(`    Median: $${fmt(fd.med)}`);
      console.log(`    P90:    $${fmt(fd.p90)}`);
    }
  }

  const rd = await q(`SELECT json_agg(r) FROM (
    SELECT last_round_type as t, COUNT(*) as c
    FROM startup_uploads WHERE status='approved' AND last_round_type IS NOT NULL
    GROUP BY last_round_type ORDER BY c DESC LIMIT 15
  ) r`);
  console.log('\n  Round Types:');
  if (rd) for (const r of rd) console.log(`    ${(r.t||'null').padEnd(20)} ${String(r.c).padStart(6)}`);

  const hd = await q(`SELECT json_build_object(
    'z', COUNT(*) FILTER (WHERE COALESCE(parsed_headcount,0) = 0),
    'h1_10', COUNT(*) FILTER (WHERE parsed_headcount >= 1 AND parsed_headcount <= 10),
    'h11_50', COUNT(*) FILTER (WHERE parsed_headcount > 10 AND parsed_headcount <= 50),
    'h51_200', COUNT(*) FILTER (WHERE parsed_headcount > 50 AND parsed_headcount <= 200),
    'h201_1k', COUNT(*) FILTER (WHERE parsed_headcount > 200 AND parsed_headcount <= 1000),
    'h1kp', COUNT(*) FILTER (WHERE parsed_headcount > 1000),
    'avg', AVG(parsed_headcount) FILTER (WHERE parsed_headcount > 0),
    'med', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY parsed_headcount) FILTER (WHERE parsed_headcount > 0)
  ) AS result FROM startup_uploads WHERE status='approved'`);
  console.log('\n  Headcount:');
  if (hd) {
    for (const [label, count] of [['No data',hd.z],['1-10',hd.h1_10],['11-50',hd.h11_50],['51-200',hd.h51_200],['201-1000',hd.h201_1k],['1000+',hd.h1kp]]) {
      const pct = ((count/total)*100).toFixed(1);
      const bar = '█'.repeat(Math.round(count/total*40));
      console.log(`    ${label.padEnd(14)} ${String(count).padStart(6)} (${pct.padStart(5)}%) ${bar}`);
    }
    if (hd.avg) console.log(`    Avg: ${Math.round(hd.avg)}  Median: ${Math.round(hd.med)}`);
  }

  // ─── 4. Domain Quality ────────────────────────────────────────────
  console.log('\n═══ 4. DOMAIN QUALITY ═══\n');

  const dd = await q(`SELECT json_agg(r) FROM (
    SELECT company_domain as d, COUNT(*) as c
    FROM startup_uploads WHERE status='approved' AND company_domain IS NOT NULL
    GROUP BY company_domain HAVING COUNT(*) > 3
    ORDER BY c DESC LIMIT 30
  ) r`);
  console.log('  Domains with >3 occurrences (publisher leakage check):');
  if (dd) for (const d of dd) {
    const flag = KNOWN_PUBLISHERS.includes(d.d) ? ' ⚠️ PUBLISHER' : '';
    console.log(`    ${d.d.padEnd(40)} × ${d.c}${flag}`);
  }

  const ds = await q(`SELECT json_agg(r) FROM (
    SELECT domain_source as s, COUNT(*) as c FROM startup_uploads
    WHERE status='approved' GROUP BY domain_source ORDER BY c DESC
  ) r`);
  console.log('\n  Domain source:');
  if (ds) for (const d of ds) console.log(`    ${(d.s||'null').padEnd(30)} ${String(d.c).padStart(6)}`);

  // ─── 5. Confidence ────────────────────────────────────────────────
  console.log('\n═══ 5. CONFIDENCE ═══\n');

  const cf = await q(`SELECT json_build_object(
    'fa', AVG(funding_confidence) FILTER (WHERE funding_confidence > 0),
    'fp25', PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY funding_confidence) FILTER (WHERE funding_confidence > 0),
    'fp50', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY funding_confidence) FILTER (WHERE funding_confidence > 0),
    'fp75', PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY funding_confidence) FILTER (WHERE funding_confidence > 0),
    'ta', AVG(traction_confidence) FILTER (WHERE traction_confidence > 0),
    'tp25', PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY traction_confidence) FILTER (WHERE traction_confidence > 0),
    'tp50', PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY traction_confidence) FILTER (WHERE traction_confidence > 0),
    'tp75', PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY traction_confidence) FILTER (WHERE traction_confidence > 0)
  ) AS result FROM startup_uploads WHERE status='approved'`);
  if (cf) {
    console.log('  Funding Confidence (where > 0):');
    if (cf.fa) console.log(`    Avg: ${cf.fa.toFixed(3)}  P25: ${cf.fp25.toFixed(3)}  P50: ${cf.fp50.toFixed(3)}  P75: ${cf.fp75.toFixed(3)}`);
    console.log('  Traction Confidence (where > 0):');
    if (cf.ta) console.log(`    Avg: ${cf.ta.toFixed(3)}  P25: ${cf.tp25.toFixed(3)}  P50: ${cf.tp50.toFixed(3)}  P75: ${cf.tp75.toFixed(3)}`);
  }

  // ─── 6. Top by GOD Score ──────────────────────────────────────────
  console.log('\n═══ 6. TOP 20 BY GOD SCORE ═══\n');

  const tg = await q(`SELECT json_agg(r) FROM (
    SELECT name, total_god_score as god, company_domain as dom,
           last_round_amount_usd as lr, last_round_type as rt,
           arr_usd as arr, parsed_headcount as hc,
           funding_confidence as fc, traction_confidence as tc
    FROM startup_uploads WHERE status='approved' AND total_god_score IS NOT NULL
    ORDER BY total_god_score DESC LIMIT 20
  ) r`);
  if (tg) for (const s of tg) {
    const lr = s.lr ? `$${fmt(s.lr)}` : '-';
    const arr = s.arr ? `$${fmt(s.arr)}` : '-';
    console.log(`  GOD=${String(s.god).padStart(3)} ${s.name.padEnd(32).slice(0,32)} D:${(s.dom||'?').padEnd(20).slice(0,20)} Rnd:${lr.padStart(8)} ARR:${arr.padStart(8)} HC:${String(s.hc||'-').padStart(5)} F:${(s.fc||0).toFixed(2)} T:${(s.tc||0).toFixed(2)}`);
  }

  // ─── 7. Top by Round ──────────────────────────────────────────────
  console.log('\n═══ 7. TOP 20 BY LAST ROUND ═══\n');

  const tr = await q(`SELECT json_agg(r) FROM (
    SELECT name, last_round_amount_usd as lr, last_round_type as rt,
           funding_confidence as conf, company_domain as dom, total_god_score as god
    FROM startup_uploads WHERE status='approved' AND last_round_amount_usd > 0
    ORDER BY last_round_amount_usd DESC LIMIT 20
  ) r`);
  if (tr) for (let i = 0; i < tr.length; i++) {
    const s = tr[i];
    console.log(`  ${String(i+1).padStart(3)}. ${s.name.padEnd(40).slice(0,40)} $${fmt(s.lr).padStart(8)} ${(s.rt||'?').padEnd(12)} conf=${(s.conf||0).toFixed(2)} GOD=${s.god||'-'} (${s.dom||'?'})`);
  }

  // ─── 8. High-Conf Sweet Spot ──────────────────────────────────────
  console.log('\n═══ 8. HIGH-CONFIDENCE FUNDING (conf≥0.8, $1M-$1B) ═══\n');

  const hc = await q(`SELECT json_agg(r) FROM (
    SELECT name, last_round_amount_usd as lr, last_round_type as rt,
           funding_confidence as conf, company_domain as dom
    FROM startup_uploads WHERE status='approved'
      AND last_round_amount_usd >= 1000000 AND last_round_amount_usd <= 1000000000
      AND funding_confidence >= 0.8
    ORDER BY last_round_amount_usd DESC LIMIT 25
  ) r`);
  if (hc) for (let i = 0; i < hc.length; i++) {
    const s = hc[i];
    console.log(`  ${String(i+1).padStart(3)}. ${s.name.padEnd(40).slice(0,40)} $${fmt(s.lr).padStart(8)} ${(s.rt||'?').padEnd(12)} conf=${s.conf.toFixed(2)} (${s.dom||'?'})`);
  }

  console.log('\n✅ Verification complete.\n');
}

main().catch(console.error);
