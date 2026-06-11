#!/usr/bin/env node
/**
 * FOUNDER ANGELS INDEX  (v1, read-only)
 * =====================================
 * Ranks individual angel investors in the PYTHH dataset into a "Founder Angels"
 * leaderboard, using the dimensions we have data for today. Two of the requested
 * dimensions have NO underlying data yet and are shown as "—" (future work):
 *
 *   ✓ track_record    notable_investments (winner/exit proxy)        weight 0.40
 *   ✓ check_volume    total_investments                              weight 0.30
 *   ✓ sector_overlap  investor.sectors ∩ target sectors (Jaccard)    weight 0.30
 *   — response_likelihood   no data (avg_response_time_days empty)
 *   — warm_path_distance    no data (no connection/graph tables)
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
const W = { track_record: 0.40, check_volume: 0.30, sector_overlap: 0.30 };
const CAP_NOTABLE = 8;   // notable_investments length cap
const CAP_TOTAL = 50;    // total_investments cap

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
      .select('id, name, firm, title, tier, investor_type, sectors, total_investments, successful_exits, notable_investments')
      .eq('is_individual', true)
      .order('id', { ascending: true }).range(off, off + P - 1);
    if (error) { console.error('fetch error:', error.message); process.exit(1); }
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < P) break;
    off += P;
  }

  const cleanRows = rows.filter((r) => isLikelyPerson(r.name));
  const dropped = rows.length - cleanRows.length;

  const scored = cleanRows.map((r) => {
    const notableLen = Array.isArray(r.notable_investments) ? r.notable_investments.length : 0;
    const totalInv = Number(r.total_investments) || 0;
    const track_record = clamp01((notableLen + (Number(r.successful_exits) || 0)) / CAP_NOTABLE);
    const check_volume = clamp01(totalInv / CAP_TOTAL);
    const sector_overlap = clamp01(sectorOverlap(r.sectors));
    const composite = Math.round(
      (W.track_record * track_record + W.check_volume * check_volume + W.sector_overlap * sector_overlap) * 100
    );
    return { ...r, notableLen, totalInv, track_record, check_volume, sector_overlap, composite, founder: isFounderAngel(r) };
  });

  let ranked = scored;
  if (FOUNDERS_ONLY) ranked = ranked.filter((s) => s.founder);
  ranked.sort((a, b) => b.composite - a.composite);

  const founderCount = scored.filter((s) => s.founder).length;
  console.log(`\n  raw individuals: ${rows.length}  |  junk names dropped: ${dropped}  |  clean: ${cleanRows.length}`);
  console.log(`  detected founder-angels (title/type): ${founderCount}` + (FOUNDERS_ONLY ? '   [--founders-only active]' : ''));
  console.log('\n  #   SCORE  trk  chk  sec  FA   NAME / FIRM');
  console.log('  ' + '─'.repeat(74));
  ranked.slice(0, TOP).forEach((s, i) => {
    const b = (x) => String(Math.round(x * 100)).padStart(3);
    console.log(
      `  ${String(i + 1).padStart(2)}  ${String(s.composite).padStart(4)}   ${b(s.track_record)} ${b(s.check_volume)} ${b(s.sector_overlap)}  ${s.founder ? '★ ' : '  '}  ` +
      `${s.name}${s.firm ? '  ·  ' + s.firm : ''}`
    );
  });

  console.log('\n  ' + '─'.repeat(74));
  console.log('  weights: track_record 0.40 · check_volume 0.30 · sector_overlap 0.30');
  console.log('  not yet scored (no data): response_likelihood, warm_path_distance');
  console.log('  trk=track record  chk=check volume  sec=sector overlap  (0-100 each)  ★=founder-angel');
  console.log('  flags: --founders-only (★ only)  --top N  --sectors "a,b,c"\n');
})();
