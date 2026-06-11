#!/usr/bin/env node
/**
 * BUILD CO-INVESTMENT GRAPH  (warm-path layer)
 * ============================================
 * Populates the (currently empty) investor_connections table with edges derived
 * from shared portfolio companies: two investors who both list the same company
 * in notable_investments are "co-investors". This is a real, data-derived proxy
 * for warm-path reachability — an investor's connectedness (degree centrality)
 * approximates how easily a founder can reach them through mutual connections.
 *
 *   node scripts/build-coinvestment-graph.js              # DRY RUN — stats only
 *   node scripts/build-coinvestment-graph.js --apply      # populate edges
 *   node scripts/build-coinvestment-graph.js --rollback --apply   # clear co_investment edges
 *
 * Flags: --max-share N (skip companies held by > N investors; default 50)
 *        --min-strength N (only keep edges with >= N shared companies; default 1)
 */
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APPLY = has('--apply');
const ROLLBACK = has('--rollback');
const MAX_SHARE = parseInt(val('--max-share', '50'), 10);   // drop "everyone backed Stripe" noise
const MIN_STRENGTH = parseInt(val('--min-strength', '1'), 10);
const CONN_TYPE = 'co_investment';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const normCo = (s) => String(s || '').toLowerCase().replace(/[.,]/g, '').replace(/\b(inc|llc|ltd|corp|co)\b/g, '').replace(/\s+/g, ' ').trim();

async function page(table, cols, filt) {
  let o = 0; const P = 1000; const out = [];
  while (true) {
    let q = supabase.from(table).select(cols).range(o, o + P - 1);
    if (filt) q = filt(q);
    const { data, error } = await q;
    if (error) { console.error(`${table} fetch:`, error.message); process.exit(1); }
    if (!data || !data.length) break;
    out.push(...data);
    if (data.length < P) break; o += P;
  }
  return out;
}

(async () => {
  console.log('═'.repeat(70));
  console.log(`  CO-INVESTMENT GRAPH   ${ROLLBACK ? 'ROLLBACK' : (APPLY ? 'APPLY' : 'DRY-RUN')}`);
  console.log('═'.repeat(70));

  if (ROLLBACK) {
    const before = (await supabase.from('investor_connections').select('*', { count: 'exact', head: true }).eq('connection_type', CONN_TYPE)).count;
    console.log(`  co_investment edges present: ${before}`);
    if (!APPLY) { console.log('  DRY RUN — re-run with --rollback --apply to delete.\n'); return; }
    const { error } = await supabase.from('investor_connections').delete().eq('connection_type', CONN_TYPE);
    if (error) { console.error('  delete error:', error.message); process.exit(1); }
    console.log(`  ✅ removed ${before} co_investment edges.\n`); return;
  }

  const investors = await page('investors', 'id, name, notable_investments', (q) => q.not('notable_investments', 'is', null));
  console.log(`  investors with notable_investments: ${investors.length}`);

  // company -> Set(investorId)
  const byCompany = new Map();
  for (const inv of investors) {
    const list = Array.isArray(inv.notable_investments) ? inv.notable_investments : [];
    for (const raw of list) {
      const c = normCo(raw);
      if (!c || c.length < 2) continue;
      if (!byCompany.has(c)) byCompany.set(c, new Set());
      byCompany.get(c).add(inv.id);
    }
  }

  // accumulate undirected pair strengths from shared companies
  const pair = new Map(); // "a|b" (a<b) -> shared count
  let usableCompanies = 0;
  for (const [, set] of byCompany) {
    const ids = [...set];
    if (ids.length < 2 || ids.length > MAX_SHARE) continue; // skip solo + too-generic
    usableCompanies++;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i] < ids[j] ? ids[i] : ids[j];
        const b = ids[i] < ids[j] ? ids[j] : ids[i];
        const k = `${a}|${b}`;
        pair.set(k, (pair.get(k) || 0) + 1);
      }
    }
  }

  const edges = [...pair.entries()].filter(([, n]) => n >= MIN_STRENGTH);
  // degree per investor (undirected)
  const degree = new Map();
  for (const [k] of edges) { const [a, b] = k.split('|'); degree.set(a, (degree.get(a) || 0) + 1); degree.set(b, (degree.get(b) || 0) + 1); }

  console.log(`  companies usable (2..${MAX_SHARE} holders): ${usableCompanies}`);
  console.log(`  unique co-investment pairs: ${pair.size}  |  edges kept (>=${MIN_STRENGTH}): ${edges.length}`);
  console.log(`  investors in graph: ${degree.size}`);
  const nameById = new Map(investors.map((i) => [i.id, i.name]));
  const topDeg = [...degree.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('  most-connected (degree):');
  topDeg.forEach(([id, d]) => console.log(`    ${String(d).padStart(4)}  ${nameById.get(id) || id}`));

  if (!APPLY) { console.log('\n  DRY RUN — no writes. Re-run with --apply.\n'); return; }
  if (!edges.length) { console.log('\n  No edges to write.\n'); return; }

  // Insert BOTH directions so degree = rows where investor_id = X.
  const rows = [];
  for (const [k, n] of edges) {
    const [a, b] = k.split('|');
    rows.push({ investor_id: a, connected_investor_id: b, connection_type: CONN_TYPE, connection_strength: n, co_investments_count: n });
    rows.push({ investor_id: b, connected_investor_id: a, connection_type: CONN_TYPE, connection_strength: n, co_investments_count: n });
  }
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const { data, error } = await supabase.from('investor_connections').insert(rows.slice(i, i + 500)).select('id');
    if (error) { console.error(`  insert error (batch ${i}):`, error.message); break; }
    inserted += data.length;
  }
  console.log(`\n  ✅ inserted ${inserted} directed edges (${edges.length} undirected pairs).`);
  console.log(`  Rollback:  node scripts/build-coinvestment-graph.js --rollback --apply\n`);
})();
