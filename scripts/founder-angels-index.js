#!/usr/bin/env node
/**
 * FOUNDER ANGELS INDEX  (v2, read-only)
 * =====================================
 * Ranks individual angel investors in the PYTHH dataset into a "Founder Angels"
 * leaderboard across all five requested dimensions:
 *
 *   ✓ track_record    notable_investments (winner/exit proxy)        weight 0.30
 *   ✓ check_volume    total_investments                              weight 0.20
 *   ✓ sector_overlap  investor.sectors ∩ target sectors (Jaccard)    weight 0.20
 *   ✓ warm_path       co-investment graph degree centrality          weight 0.20  (modeled)
 *   ✓ response_likelihood   activity/contactability heuristic        weight 0.10  (modeled)
 *
 * warm_path is derived from the investor_connections graph (see
 * build-coinvestment-graph.js). response_likelihood is a heuristic proxy until
 * real investor_outreach reply data accrues. Both are MODELED, not measured.
 *
 * Read-only: prints the ranking. Nothing is written.
 *
 *   node scripts/founder-angels-index.js
 *   node scripts/founder-angels-index.js --top 50
 *   node scripts/founder-angels-index.js --sectors "AI/ML,Robotics,SaaS,Marketplaces,Fintech"
 */
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const argv = process.argv.slice(2);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const TOP = parseInt(val('--top', '30'), 10);
const TARGET_SECTORS = val('--sectors', 'AI/ML,SaaS,Robotics,Marketplaces,Fintech,Consumer,Infrastructure')
  .split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

const FOUNDERS_ONLY = argv.includes('--founders-only');
const W = { track_record: 0.30, check_volume: 0.20, sector_overlap: 0.20, warm_path: 0.20, response: 0.10 };
const CAP_NOTABLE = 8;   // notable_investments length cap
const CAP_TOTAL = 50;    // total_investments cap
const CAP_DEGREE = 40;   // co-investment graph degree cap (warm-path)

// Modeled response-likelihood proxy from activity + contactability (0..1).
function responseLikelihood(r) {
  let s = 0.30;
  if (r.is_individual) s += 0.25;                 // angels reply more than institutions
  if (r.investor_type === 'Super Angel' || r.investor_type === 'Angel') s += 0.15;
  s += Math.min(0.20, (Number(r.total_investments) || 0) / 100 * 0.20); // active = responsive
  if (r.linkedin_url) s += 0.10;                  // reachable
  return Math.max(0, Math.min(1, s));
}

// Reject scraper-artifact "investor" names (headline fragments with a (Firm) suffix).
const STOPWORDS = new Set(['for', 'the', 'we', 'help', 'ago', 'hours', 'minutes', 'playbook',
  'operations', 'lessons', 'average', 'atlas', 'unlimited', 'how', 'why', 'what', 'guide',
  'startup', 'investing', 'network', 'invested', 'diverse', 'early', 'stage', 'teamview', 'ai']);
function isLikelyPerson(name) {
  if (!name) return false;
  const base = String(name).replace(/\s*\([^)]*\)\s*$/, '').trim(); // strip trailing (Firm)
  if (!base || /\d/.test(base)) return false;
  const tokens = base.split(/\s+/);
  if (tokens.length < 2 || tokens.length > 4) return false;          // person = 2-4 words
  if (!/^[A-Z]/.test(tokens[0])) return false;                        // must start capitalized
  if (tokens.some((t) => STOPWORDS.has(t.toLowerCase()))) return false;
  return true;
}
// Founder/operator-angel signal (vs pure VC partner).
function isFounderAngel(r) {
  const hay = `${r.title || ''} ${r.firm || ''}`.toLowerCase();
  return /founder|co-?found|^ceo|\bceo\b|built|operator|ex-|exited/.test(hay) || r.investor_type === 'Super Angel';
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const clamp01 = (x) => Math.max(0, Math.min(1, x));

function sectorOverlap(sectors) {
  if (!Array.isArray(sectors) || !sectors.length) return 0;
  const inv = sectors.map((x) => String(x).toLowerCase());
  const hits = inv.filter((x) => TARGET_SECTORS.some((t) => x.includes(t) || t.includes(x)));
  const union = new Set([...inv, ...TARGET_SECTORS]).size;
  return union ? hits.length / union : 0; // Jaccard-ish
}

(async () => {
  console.log('═'.repeat(78));
  console.log('  FOUNDER ANGELS INDEX  (v1, read-only)');
  console.log('  target sectors: ' + TARGET_SECTORS.join(', '));
  console.log('═'.repeat(78));

  // Pull individual investors with the fields we score on.
  const rows = [];
  let off = 0; const P = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('investors')
      .select('id, name, firm, title, tier, investor_type, is_individual, linkedin_url, sectors, total_investments, successful_exits, notable_investments')
      .eq('is_individual', true)
      .order('id', { ascending: true }).range(off, off + P - 1);
    if (error) { console.error('fetch error:', error.message); process.exit(1); }
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < P) break;
    off += P;
  }

  // Warm-path: degree centrality from the co-investment graph (investor_connections).
  const degree = new Map();
  let coff = 0;
  while (true) {
    const { data, error } = await supabase
      .from('investor_connections')
      .select('investor_id')
      .eq('connection_type', 'co_investment')
      .range(coff, coff + 1000 - 1);
    if (error) { console.error('connections fetch error:', error.message); break; }
    if (!data || !data.length) break;
    data.forEach((c) => degree.set(c.investor_id, (degree.get(c.investor_id) || 0) + 1));
    if (data.length < 1000) break;
    coff += 1000;
  }
  const graphEdges = [...degree.values()].reduce((a, b) => a + b, 0);

  const cleanRows = rows.filter((r) => isLikelyPerson(r.name));
  const dropped = rows.length - cleanRows.length;

  const scored = cleanRows.map((r) => {
    const notableLen = Array.isArray(r.notable_investments) ? r.notable_investments.length : 0;
    const totalInv = Number(r.total_investments) || 0;
    const track_record = clamp01((notableLen + (Number(r.successful_exits) || 0)) / CAP_NOTABLE);
    const check_volume = clamp01(totalInv / CAP_TOTAL);
    const sector_overlap = clamp01(sectorOverlap(r.sectors));
    const warm_path = clamp01((degree.get(r.id) || 0) / CAP_DEGREE);
    const response = responseLikelihood(r);
    const composite = Math.round(
      (W.track_record * track_record + W.check_volume * check_volume + W.sector_overlap * sector_overlap +
       W.warm_path * warm_path + W.response * response) * 100
    );
    return { ...r, notableLen, totalInv, track_record, check_volume, sector_overlap, warm_path, response, composite, founder: isFounderAngel(r) };
  });

  let ranked = scored;
  if (FOUNDERS_ONLY) ranked = ranked.filter((s) => s.founder);
  ranked.sort((a, b) => b.composite - a.composite);

  const founderCount = scored.filter((s) => s.founder).length;
  console.log(`\n  raw individuals: ${rows.length}  |  junk names dropped: ${dropped}  |  clean: ${cleanRows.length}`);
  console.log(`  co-investment graph: ${degree.size} investors, ${graphEdges} directed edges`);
  console.log(`  detected founder-angels (title/type): ${founderCount}` + (FOUNDERS_ONLY ? '   [--founders-only active]' : ''));
  console.log('\n  #   SCORE  trk  chk  sec  wrm  rsp  FA   NAME / FIRM');
  console.log('  ' + '─'.repeat(80));
  ranked.slice(0, TOP).forEach((s, i) => {
    const b = (x) => String(Math.round(x * 100)).padStart(3);
    console.log(
      `  ${String(i + 1).padStart(2)}  ${String(s.composite).padStart(4)}   ${b(s.track_record)} ${b(s.check_volume)} ${b(s.sector_overlap)} ${b(s.warm_path)} ${b(s.response)}  ${s.founder ? '★ ' : '  '}  ` +
      `${s.name}${s.firm ? '  ·  ' + s.firm : ''}`
    );
  });

  console.log('\n  ' + '─'.repeat(80));
  console.log('  weights: track 0.30 · check 0.20 · sector 0.20 · warm 0.20 · resp 0.10');
  console.log('  warm_path & response are MODELED (co-investment graph + activity heuristic)');
  console.log('  trk=track  chk=check  sec=sector  wrm=warm-path  rsp=response  (0-100 each)  ★=founder-angel');
  console.log('  flags: --founders-only (★ only)  --top N  --sectors "a,b,c"\n');
})();
