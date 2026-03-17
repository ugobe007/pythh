#!/usr/bin/env node
/**
 * LIST ALL STARTUPS WITH TIER 1 VC MENTION
 * =========================================
 * Scans approved startups for any mention of a Tier 1 VC (YC, Sequoia, a16z, etc.)
 * and prints a review table. Use to audit who has T1 backing in the DB.
 *
 * Run: node scripts/list-t1vc-startups.js [--csv] [--status=approved] [--plausible]
 *   --plausible  only list names that pass headline/junk filter (fewer, higher-confidence)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const CSV = process.argv.includes('--csv');
const PLAUSIBLE_ONLY = process.argv.includes('--plausible');
const statusArg = process.argv.find(a => a.startsWith('--status='));
const STATUS = statusArg ? statusArg.split('=')[1] : 'approved';

// Same headline/junk gate as pedigree + enrich-t1vc-sparse (skip article titles, VC names as "startup", etc.)
const HEADLINE_PATTERNS = [
  /\b(inc said|is said|via its| as part of|taps |backed .* is said)\b/i,
  /\b(india arm|sequoia india|index ventures['’]|sequoia capital india arm)\b/i,
  /\b(ex-top|billion-dollar|principal scientist |shaun maguire after|phonepe via its)\b/i,
  /^(wall street|justice dept|pentagon|ferrari sets|firefox \d+|using sec edgar|sec edgar)\b/i,
  /\b(sec edgar|edgar data|moroccan founder)\b/i,
  /(million fund iii|valuation after|months after|kids holdings|connected infra group)\b/i,
  /(disco ediscovery|website security|emergent triples|eighthclouds|blue jay|check:)\b/i,
  /^[\w\s]+(ventures['’]|capital india arm|venture\s*:)\s*$/i,
  /^(yc-backed|y combinator-backed|startup\s+\w+)\b/i,
  /\b(billion valuation|develop world model|ai sensor platform)\b/i,
  /^(moneycontrol\.com|electrive\.com|times\s+\w+)\b/i,
  /^(disrupt|ex-a16z partner|softbank-backed .* is said)\b/i,
  /^(and crypto|most active .* venture)\b/i,
  /^has ai$/i,
  /^(tiger global|general atlantic|lightspeed venture|khosla|pioneer|sequoia|founders fund|index ventures['’])\s*$/i,
];
function isPlausibleStartupName(name) {
  const n = (name || '').trim();
  if (n.length < 2 || n.length > 100) return false;
  if (HEADLINE_PATTERNS.some((p) => p.test(n))) return false;
  return true;
}

const TIER_1_PHRASES = [
  ['y combinator', 'Y Combinator'], ['yc', 'Y Combinator'],
  ['sequoia capital', 'Sequoia'], ['sequoia', 'Sequoia'],
  ['andreessen horowitz', 'Andreessen Horowitz'], ['a16z', 'a16z'],
  ['founders fund', 'Founders Fund'], ['benchmark capital', 'Benchmark'], ['benchmark', 'Benchmark'],
  ['tiger global', 'Tiger Global'], ['tiger', 'Tiger Global'],
  ['coatue', 'Coatue'], ['softbank vision fund', 'SoftBank'], ['softbank', 'SoftBank'],
  ['khosla ventures', 'Khosla'], ['khosla', 'Khosla'],
  ['greylock partners', 'Greylock'], ['greylock', 'Greylock'],
  ['index ventures', 'Index Ventures'], ['general atlantic', 'General Atlantic'],
  ['lightspeed venture', 'Lightspeed'], ['lightspeed', 'Lightspeed'],
  ['insight partners', 'Insight Partners'], ['insight venture', 'Insight Partners'],
  ['dragoneer', 'Dragoneer'], ['greenoaks', 'Greenoaks'],
  ['pioneer', 'Pioneer'], ['neo', 'Neo'], ['soma capital', 'Soma Capital'],
];

function extractAllT1(startup) {
  const ex = startup.extracted_data || {};
  const text = [
    startup.pitch || '',
    startup.description || '',
    ex.description || '',
    ex.pitch || '',
    Array.isArray(ex.investors) ? ex.investors.join(' ') : '',
    Array.isArray(ex.backed_by) ? ex.backed_by.join(' ') : (typeof ex.backed_by === 'string' ? ex.backed_by : ''),
  ].join(' ').toLowerCase();

  const found = new Set();
  for (const [phrase, label] of TIER_1_PHRASES) {
    if (text.includes(phrase)) found.add(label);
  }
  return [...found];
}

async function main() {
  console.log('\n=== STARTUPS WITH TIER 1 VC MENTION ===\n');
  console.log(`Status: ${STATUS}\n`);

  const cols = 'id, name, website, company_website, pitch, description, extracted_data, total_god_score';
  const PAGE_SIZE = 1000; // Supabase default max per request
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(cols)
      .eq('status', STATUS)
      .range(from, from + PAGE_SIZE - 1);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  let withT1 = all
    .map(s => ({ ...s, t1Vcs: extractAllT1(s) }))
    .filter(s => s.t1Vcs.length > 0)
    .sort((a, b) => (b.total_god_score || 0) - (a.total_god_score || 0));

  const totalWithT1 = withT1.length;
  if (PLAUSIBLE_ONLY) {
    withT1 = withT1.filter(s => isPlausibleStartupName(s.name));
  }

  console.log(`Total ${STATUS}: ${all.length}`);
  console.log(`With T1 VC mention: ${totalWithT1}`);
  if (PLAUSIBLE_ONLY) console.log(`Plausible names only: ${withT1.length}`);
  console.log('');

  if (withT1.length === 0) {
    console.log('None found.');
    return;
  }

  if (CSV) {
    console.log('name,id,total_god_score,has_website,t1_vcs');
    withT1.forEach(s => {
      const hasWebsite = !!(s.website || s.company_website) ? 'Y' : 'N';
      console.log(`"${(s.name || '').replace(/"/g, '""')}",${s.id},${s.total_god_score ?? ''},${hasWebsite},"${s.t1Vcs.join('; ')}"`);
    });
    return;
  }

  const maxName = Math.min(42, Math.max(20, ...withT1.map(s => (s.name || '').length)));
  console.log(`${'Name'.padEnd(maxName)}  Score  Website  T1 VC(s)`);
  console.log('-'.repeat(maxName + 40));
  withT1.forEach(s => {
    const name = (s.name || '').slice(0, maxName).padEnd(maxName);
    const score = (s.total_god_score != null ? String(s.total_god_score) : '-').padStart(5);
    const website = (s.website || s.company_website) ? '   Y   ' : '   N   ';
    const vcs = s.t1Vcs.join(', ');
    console.log(`${name}  ${score}  ${website}  ${vcs}`);
  });
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
