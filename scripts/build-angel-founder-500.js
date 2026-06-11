#!/usr/bin/env node
/**
 * BUILD ANGEL FOUNDER 500
 * =======================
 * Assembles a "Founder Angels" index of up to 500 operator-turned-angel investors,
 * sourced per cohort (the data does NOT already contain these people — see below).
 *
 * Why generated, not queried:
 *   The PYTHH dataset's individuals are VC fund partners; its founders[] are
 *   early-stage operators with no exits. There is ZERO overlap, so founder-angels
 *   (Mercury alumni, YC founders with exits, acquired-SaaS founders who now invest)
 *   must be enumerated per cohort, verified, deduped, and stored.
 *
 * How it works:
 *   1. For each cohort, ask gpt-4o-mini to list REAL, publicly-documented founders
 *      who had an exit/scale AND now actively angel-invest (no invented people).
 *   2. Validate names, dedup within-run AND against all existing investors.
 *   3. Map to the investors record shape; stamp provenance "[AF500]" for rollback.
 *   4. Dry-run by default; --apply inserts; --rollback removes all [AF500] rows.
 *
 *   node scripts/build-angel-founder-500.js                 # DRY RUN
 *   node scripts/build-angel-founder-500.js --target 500    # DRY RUN to 500
 *   node scripts/build-angel-founder-500.js --apply         # insert
 *   node scripts/build-angel-founder-500.js --rollback --apply
 *
 * Flags: --target N (default 500) · --per N (per request, default 40)
 *        --rounds N (max rounds per cohort, default 4) · --min-conf 0.7
 */
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const OpenAI = require('openai');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const val = (f, d) => { const i = argv.indexOf(f); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const APPLY = has('--apply');
const ROLLBACK = has('--rollback');
const TARGET = parseInt(val('--target', '500'), 10);
const PER = parseInt(val('--per', '40'), 10);
const ROUNDS = parseInt(val('--rounds', '4'), 10);
const MIN_CONF = parseFloat(val('--min-conf', '0.7'));
const MODEL = val('--model', 'gpt-4o-mini');
const PROVENANCE = '[AF500]';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase credentials'); process.exit(1); }
if (!OPENAI_KEY && !ROLLBACK) { console.error('❌ Missing OPENAI_API_KEY'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = OPENAI_KEY ? new OpenAI({ apiKey: OPENAI_KEY, timeout: 60000, maxRetries: 2 }) : null;
const fs = require('fs');
const CHECKPOINT = '/tmp/af500-checkpoint.json';
const JSONL = '/tmp/af500-rows.jsonl';

// ── cohorts (match the requested sourcing buckets) ───────────────────────────
const COHORTS = [
  // ── the 6 requested core cohorts ───────────────────────────────────────────
  { key: 'mercury', label: 'Mercury founders/operators',
    desc: 'founders, early employees, or operators connected to Mercury (the fintech bank) — or fintech founders in that orbit — who now actively angel-invest' },
  { key: 'yc_exits', label: 'YC alumni with exits',
    desc: 'Y Combinator alumni founders who had a meaningful exit (acquisition or IPO) and now actively angel-invest' },
  { key: 'saas_exits', label: 'Acquired SaaS founders',
    desc: 'founders of SaaS/B2B companies that were acquired, who now actively angel-invest' },
  { key: 'robotics_exits', label: 'Robotics founders with exits',
    desc: 'robotics, hardware, or physical-AI founders who had an exit and now actively angel-invest' },
  { key: 'ai_infra_exits', label: 'AI infrastructure founders with exits',
    desc: 'AI/ML infrastructure or developer-tools founders who had an exit and now actively angel-invest' },
  { key: 'marketplace_exits', label: 'Marketplace founders with exits',
    desc: 'marketplace or consumer-platform founders who had an exit and now actively angel-invest' },
  // ── breadth: more sectors (real founder-angels exist in each) ───────────────
  { key: 'fintech_exits', label: 'Fintech founders with exits',
    desc: 'fintech, payments, or insurtech founders who had an exit and now actively angel-invest' },
  { key: 'crypto_exits', label: 'Crypto/web3 founders with exits',
    desc: 'crypto, web3, or blockchain founders who had an exit or major liquidity and now actively angel-invest' },
  { key: 'devtools_exits', label: 'Developer-tools founders with exits',
    desc: 'developer-tools, infrastructure, or open-source company founders who had an exit and now actively angel-invest' },
  { key: 'security_exits', label: 'Cybersecurity founders with exits',
    desc: 'cybersecurity or security-software founders who had an exit and now actively angel-invest' },
  { key: 'data_exits', label: 'Data/analytics founders with exits',
    desc: 'data infrastructure, analytics, or database company founders who had an exit and now actively angel-invest' },
  { key: 'health_exits', label: 'Healthcare/bio founders with exits',
    desc: 'digital-health, healthtech, or biotech founders who had an exit and now actively angel-invest' },
  { key: 'ecommerce_exits', label: 'E-commerce/DTC founders with exits',
    desc: 'e-commerce, DTC, or retail-tech founders who had an exit and now actively angel-invest' },
  { key: 'gaming_media_exits', label: 'Gaming/media founders with exits',
    desc: 'gaming, media, or creator-economy founders who had an exit and now actively angel-invest' },
  { key: 'climate_exits', label: 'Climate/energy founders with exits',
    desc: 'climate-tech, energy, or sustainability founders who had an exit and now actively angel-invest' },
  // ── breadth: geographies (very active founder-angel scenes) ─────────────────
  { key: 'india_exits', label: 'India founders with exits',
    desc: 'India-based startup founders who had an exit and now actively angel-invest' },
  { key: 'europe_exits', label: 'Europe/UK founders with exits',
    desc: 'European or UK startup founders who had an exit and now actively angel-invest' },
  { key: 'latam_sea_exits', label: 'LatAm/SEA founders with exits',
    desc: 'Latin America or Southeast Asia startup founders who had an exit and now actively angel-invest' },
  { key: 'female_exits', label: 'Female founders with exits',
    desc: 'female startup founders who had an exit and now actively angel-invest' },
  // ── breadth wave 2: more verticals ──────────────────────────────────────────
  { key: 'enterprise_exits', label: 'Enterprise software founders with exits',
    desc: 'enterprise software or vertical-SaaS founders who had an exit and now actively angel-invest' },
  { key: 'proptech_exits', label: 'Proptech/real-estate founders with exits',
    desc: 'proptech or real-estate-tech founders who had an exit and now actively angel-invest' },
  { key: 'edtech_exits', label: 'Edtech founders with exits',
    desc: 'education-technology founders who had an exit and now actively angel-invest' },
  { key: 'mobility_exits', label: 'Mobility/logistics founders with exits',
    desc: 'mobility, transportation, or logistics founders who had an exit and now actively angel-invest' },
  { key: 'foodtech_exits', label: 'Food/agtech founders with exits',
    desc: 'food-tech, restaurant-tech, or agtech founders who had an exit and now actively angel-invest' },
  { key: 'adtech_exits', label: 'Adtech/martech founders with exits',
    desc: 'advertising-tech or marketing-tech founders who had an exit and now actively angel-invest' },
  { key: 'hrtech_exits', label: 'HR/future-of-work founders with exits',
    desc: 'HR-tech, recruiting, or future-of-work founders who had an exit and now actively angel-invest' },
  { key: 'social_exits', label: 'Social/consumer-app founders with exits',
    desc: 'social network or consumer mobile-app founders who had an exit and now actively angel-invest' },
  { key: 'unicorn_exits', label: 'Unicorn founders now investing',
    desc: 'founders of billion-dollar (unicorn) companies who now actively angel-invest' },
  { key: 'ipo_exits', label: 'IPO founders now investing',
    desc: 'founders who took a company public (IPO) and now actively angel-invest' },
  // ── breadth wave 2: more geographies ────────────────────────────────────────
  { key: 'israel_exits', label: 'Israel founders with exits',
    desc: 'Israeli startup founders who had an exit and now actively angel-invest' },
  { key: 'canada_exits', label: 'Canada founders with exits',
    desc: 'Canadian startup founders who had an exit and now actively angel-invest' },
  { key: 'africa_exits', label: 'Africa/MENA founders with exits',
    desc: 'African or MENA startup founders who had an exit and now actively angel-invest' },
  { key: 'apac_exits', label: 'APAC founders with exits',
    desc: 'Asia-Pacific (Australia, Japan, Korea, Singapore) startup founders who had an exit and now actively angel-invest' },
];

const norm = (s) => String(s || '').trim().toLowerCase();
const STOPWORDS = new Set(['for', 'the', 'we', 'help', 'ago', 'inc', 'llc', 'ltd', 'capital', 'ventures', 'partners', 'fund', 'angel']);
function isLikelyPerson(name) {
  const base = String(name || '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!base || /\d/.test(base)) return false;
  const t = base.split(/\s+/);
  if (t.length < 2 || t.length > 4) return false;
  if (!/^[A-Z]/.test(t[0])) return false;
  if (t.every((w) => STOPWORDS.has(w.toLowerCase()))) return false;
  return true;
}

async function enumerateCohort(cohort, excludeNames) {
  const sys = 'You are a venture-capital research analyst with deep, accurate knowledge of startup founders ' +
    'who became angel investors. List ONLY real, publicly-documented individuals whose founder background ' +
    'AND active angel/seed investing are widely verifiable. NEVER invent people or guess. If you are not ' +
    'confident a person is real and currently angel-investing, omit them. Prefer breadth across well-known names.';
  const exclude = excludeNames.length ? `\nDo NOT repeat any of these already-collected names:\n${excludeNames.slice(0, 400).join(', ')}` : '';
  const user = `List up to ${PER} ${cohort.desc}.${exclude}\n\n` +
    'Return strict JSON: {"founders":[{"name","founded_company","exit","current_firm","title",' +
    '"sectors":["..."],"notable_investments":["..."],"est_total_investments":<int>,"confidence":<0..1>}]}. ' +
    'confidence reflects how certain you are the person is real and actively angel-investing.';
  const resp = await openai.chat.completions.create({
    model: MODEL, temperature: 0.4, response_format: { type: 'json_object' },
    messages: [{ role: 'system', content: sys }, { role: 'user', content: user }],
  });
  let parsed = {};
  try { parsed = JSON.parse(resp.choices[0].message.content || '{}'); } catch { parsed = {}; }
  return Array.isArray(parsed.founders) ? parsed.founders : [];
}

function toInvestorRow(f, cohort) {
  const sectors = Array.isArray(f.sectors) && f.sectors.length ? f.sectors : ['AI/ML'];
  const notable = Array.isArray(f.notable_investments) ? f.notable_investments.filter(Boolean).slice(0, 12) : [];
  const total = Math.max(0, parseInt(f.est_total_investments, 10) || notable.length);
  const bioBits = [
    f.founded_company ? `Founder of ${f.founded_company}` : null,
    f.exit ? `(${f.exit})` : null,
    f.current_firm ? `· now ${f.current_firm}` : null,
  ].filter(Boolean).join(' ');
  return {
    name: f.name, firm: f.current_firm || 'Angel', title: f.title || 'Founder & angel investor',
    type: 'Angel', investor_type: 'Super Angel', is_individual: true,
    tier: '1', status: 'active', is_verified: false, public_profile: true,
    stage: ['Seed'], geography_focus: ['US', 'Global'], sectors,
    notable_investments: notable, total_investments: total,
    bio: `${PROVENANCE} ${bioBits || 'Founder-angel'} · cohort:${cohort.key}`.trim(),
    investment_thesis: `Founder-angel sourced via ${cohort.label}.`,
    check_size_min: 25000, check_size_max: 500000,
  };
}

async function loadExistingNames() {
  const set = new Set(); let off = 0; const P = 1000;
  while (true) {
    const { data, error } = await supabase.from('investors').select('name').range(off, off + P - 1);
    if (error) { console.error('fetch error:', error.message); process.exit(1); }
    if (!data || !data.length) break;
    data.forEach((r) => set.add(norm(r.name)));
    if (data.length < P) break; off += P;
  }
  return set;
}

(async () => {
  console.log('═'.repeat(72));
  console.log(`  BUILD ANGEL FOUNDER 500   ${ROLLBACK ? 'ROLLBACK' : (APPLY ? 'APPLY' : 'DRY-RUN')}   target=${TARGET}`);
  console.log('═'.repeat(72));

  if (ROLLBACK) {
    const { data: rows, error } = await supabase.from('investors').select('id, name').ilike('bio', `%${PROVENANCE}%`);
    if (error) { console.error('rollback fetch error:', error.message); process.exit(1); }
    console.log(`  [AF500] rows found: ${rows.length}`);
    if (!APPLY) { console.log('  DRY RUN — re-run with --rollback --apply to delete.\n'); return; }
    if (rows.length) {
      const { error: delErr } = await supabase.from('investors').delete().ilike('bio', `%${PROVENANCE}%`);
      if (delErr) { console.error('  delete error:', delErr.message); process.exit(1); }
    }
    console.log(`  ✅ removed ${rows.length} [AF500] rows.\n`); return;
  }

  // ── insert-from-JSONL: dedup the collected rows file and insert (resilient) ──
  if (has('--from-jsonl')) {
    const existing = await loadExistingNames();
    let lines = [];
    try { lines = fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean); } catch { console.error('  no JSONL at ' + JSONL); process.exit(1); }
    const uniq = new Map();
    for (const ln of lines) {
      let v; try { v = JSON.parse(ln); } catch { continue; }
      const key = norm(v.row && v.row.name);
      if (!key || existing.has(key) || uniq.has(key)) continue;
      if (!isLikelyPerson(v.row.name)) continue;
      uniq.set(key, v);
    }
    const rows = [...uniq.values()];
    const byC = {}; rows.forEach((r) => { byC[r.cohort] = (byC[r.cohort] || 0) + 1; });
    console.log(`  unique founder-angels in JSONL: ${rows.length}`);
    console.log('  by cohort: ' + JSON.stringify(byC));
    if (!APPLY) { console.log('\n  DRY RUN — re-run with --from-jsonl --apply to insert.\n'); return; }
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const batch = rows.slice(i, i + 200).map((r) => r.row);
      const { data, error } = await supabase.from('investors').insert(batch).select('id');
      if (error) { console.error(`  insert error (batch ${i}):`, error.message); break; }
      inserted += data.length;
    }
    console.log(`\n  ✅ inserted ${inserted} founder-angels (provenance ${PROVENANCE}).`);
    console.log(`  Rollback:  node scripts/build-angel-founder-500.js --rollback --apply\n`);
    return;
  }

  const existing = await loadExistingNames();
  console.log(`  existing investors: ${existing.size}`);
  const PER_COHORT = Math.ceil((TARGET / COHORTS.length) * 1.4); // collect a bit extra per cohort
  console.log(`  running ${COHORTS.length} cohorts in parallel · target/cohort ≈ ${PER_COHORT}\n`);

  // Each cohort collects its own rows (deduped vs DB + within cohort). Runs rounds
  // sequentially within the cohort, but all cohorts run concurrently.
  async function runCohort(cohort) {
    const local = new Map(); const seen = [];
    for (let round = 0; round < ROUNDS && local.size < PER_COHORT; round++) {
      let founders = [];
      try { founders = await enumerateCohort(cohort, seen); }
      catch (e) { console.log(`  ! ${cohort.key} round ${round + 1}: ${e.message}`); break; }
      let roundNew = 0;
      for (const f of founders) {
        const key = norm(f.name);
        if (!f.name || !isLikelyPerson(f.name)) continue;
        if ((Number(f.confidence) || 0) < MIN_CONF) continue;
        if (existing.has(key) || local.has(key)) continue;
        local.set(key, { row: toInvestorRow(f, cohort), cohort: cohort.key, confidence: Number(f.confidence) || 0 });
        seen.push(f.name); roundNew++;
        if (local.size >= PER_COHORT) break;
      }
      if (roundNew === 0) break;
    }
    console.log(`  ${cohort.label.padEnd(38)} → ${String(local.size).padStart(3)}`);
    // Append as we go so partial progress survives even if the run is interrupted.
    try { for (const v of local.values()) fs.appendFileSync(JSONL, JSON.stringify(v) + '\n'); } catch {}
    return [...local.values()];
  }

  // Bounded concurrency so 19 cohorts don't all hammer the API at once.
  const CONCURRENCY = parseInt(val('--concurrency', '6'), 10);
  const perCohortResults = [];
  for (let i = 0; i < COHORTS.length; i += CONCURRENCY) {
    const slice = COHORTS.slice(i, i + CONCURRENCY);
    const res = await Promise.all(slice.map(runCohort));
    perCohortResults.push(...res);
  }

  // Merge with global dedup (first cohort wins on cross-cohort duplicates).
  const collected = new Map();
  for (const list of perCohortResults) {
    for (const item of list) {
      const key = norm(item.row.name);
      if (collected.has(key)) continue;
      collected.set(key, item);
      if (collected.size >= TARGET) break;
    }
    if (collected.size >= TARGET) break;
  }
  try { fs.writeFileSync(CHECKPOINT, JSON.stringify([...collected.values()], null, 0)); } catch {}

  const rows = [...collected.values()];
  console.log(`\n  collected unique founder-angels: ${rows.length} / target ${TARGET}`);
  const byCohort = {};
  rows.forEach((r) => { byCohort[r.cohort] = (byCohort[r.cohort] || 0) + 1; });
  console.log('  by cohort: ' + JSON.stringify(byCohort));
  console.log('\n  sample:');
  rows.slice(0, 12).forEach((r) => console.log(`   · ${r.row.name.padEnd(26)} ${String(r.confidence).padEnd(4)} ${r.row.firm}`));

  if (!APPLY) { console.log('\n  DRY RUN — no writes. Re-run with --apply to insert.\n'); return; }
  if (!rows.length) { console.log('\n  Nothing to insert.\n'); return; }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200).map((r) => r.row);
    const { data, error } = await supabase.from('investors').insert(batch).select('id');
    if (error) { console.error(`  insert error (batch ${i}):`, error.message); break; }
    inserted += data.length;
  }
  console.log(`\n  ✅ inserted ${inserted} founder-angels (provenance ${PROVENANCE}).`);
  console.log(`  Rollback any time:  node scripts/build-angel-founder-500.js --rollback --apply\n`);
})();
