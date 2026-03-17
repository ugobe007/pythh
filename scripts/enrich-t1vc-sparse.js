#!/usr/bin/env node
/**
 * ENRICH SPARSE STARTUPS WITH TIER 1 VC BACKING
 * ==============================================
 * Finds approved data-sparse startups that mention a Tier 1 VC (YC, Sequoia, a16z, etc.)
 * and enriches them using the VC name as the search signal: "StartupName VCName funding".
 * Writes merged data to extracted_data and top-level columns.
 *
 * Run: node scripts/enrich-t1vc-sparse.js [--dry-run] [--limit=50]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { quickEnrichWithVC, isDataSparse } = require('../server/services/inferenceService');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const DRY_RUN = process.argv.includes('--dry-run');
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : 50;

// Tier 1 investor phrases (lowercase) -> search label for news query (use as-is in "StartupName LABEL funding")
const TIER_1_PHRASES = [
  'y combinator', 'yc', 'sequoia', 'sequoia capital', 'andreessen horowitz', 'a16z',
  'founders fund', 'benchmark', 'benchmark capital', 'tiger global', 'tiger',
  'coatue', 'softbank', 'softbank vision fund', 'khosla ventures', 'khosla',
  'greylock', 'greylock partners', 'index ventures', 'general atlantic',
  'lightspeed', 'lightspeed venture', 'insight partners', 'dragoneer', 'greenoaks',
  'pioneer', 'neo', 'soma capital',
];

// Skip headline/junk names — don't waste enrichment on "India Arm", "Moroccan founder", "YC-backed", etc.
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
];

function isPlausibleStartupName(name) {
  const n = (name || '').trim();
  if (n.length < 2 || n.length > 100) return false;
  if (HEADLINE_PATTERNS.some((p) => p.test(n))) return false;
  return true;
}

// Higher-confidence: skip ambiguous single words and generic category-like phrases (fewer, better targets).
const AMBIGUOUS_SINGLE_WORDS = new Set([
  'yahoo', 'diligent', 'volz', 'axiom', 'trust', 'partners', 'company', 'labs', 'ai', 'vc',
]);
const GENERIC_PHRASE_PATTERNS = [
  /^look beyond\b/i,
  /^advanced .* intelligence$/i,
  /^.* machine intelligence$/i,
];

function isHighConfidenceName(name) {
  const n = (name || '').trim();
  if (!isPlausibleStartupName(n)) return false;
  const words = n.split(/\s+/).filter(Boolean);
  if (words.length === 1 && AMBIGUOUS_SINGLE_WORDS.has(words[0].toLowerCase())) return false;
  if (GENERIC_PHRASE_PATTERNS.some((p) => p.test(n))) return false;
  return true;
}

// Map matched phrase to a short search-friendly label (for Google News)
function toSearchLabel(phrase) {
  const m = {
    'yc': 'Y Combinator', 'y combinator': 'Y Combinator',
    'sequoia': 'Sequoia', 'sequoia capital': 'Sequoia',
    'andreessen horowitz': 'Andreessen Horowitz', 'a16z': 'a16z',
    'founders fund': 'Founders Fund', 'benchmark': 'Benchmark', 'benchmark capital': 'Benchmark',
    'tiger global': 'Tiger Global', 'tiger': 'Tiger Global',
    'coatue': 'Coatue', 'softbank': 'SoftBank', 'softbank vision fund': 'SoftBank',
    'khosla': 'Khosla', 'khosla ventures': 'Khosla',
    'greylock': 'Greylock', 'greylock partners': 'Greylock',
    'index ventures': 'Index Ventures', 'general atlantic': 'General Atlantic',
    'lightspeed': 'Lightspeed', 'lightspeed venture': 'Lightspeed',
    'insight partners': 'Insight Partners', 'dragoneer': 'Dragoneer', 'greenoaks': 'Greenoaks',
    'pioneer': 'Pioneer', 'neo': 'Neo', 'soma capital': 'Soma Capital',
  };
  return m[phrase.toLowerCase()] || phrase.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function extractT1FromStartup(startup) {
  const ex = startup.extracted_data || {};
  const text = [
    startup.pitch || '',
    startup.description || '',
    ex.description || '',
    ex.pitch || '',
    Array.isArray(ex.investors) ? ex.investors.join(' ') : '',
    Array.isArray(ex.backed_by) ? ex.backed_by.join(' ') : (typeof ex.backed_by === 'string' ? ex.backed_by : ''),
  ].join(' ').toLowerCase();

  for (const phrase of TIER_1_PHRASES) {
    if (text.includes(phrase)) return toSearchLabel(phrase);
  }
  return null;
}

function scoreDataRichness(s) {
  let signals = 0;
  const ed = s.extracted_data || {};
  if (s.website || s.company_website) signals += 2;
  if ((s.pitch || s.description || '').length > 30) signals++;
  if (s.sectors?.length > 0) signals++;
  if (s.stage) signals++;
  if (s.raise_amount || s.last_round_amount_usd || s.total_funding_usd) signals++;
  if (s.customer_count || s.parsed_customers) signals++;
  if (s.mrr || s.arr || s.arr_usd || s.revenue_usd) signals++;
  if (s.team_size || s.team_size_estimate || s.parsed_headcount) signals++;
  if (s.location) signals++;
  if ((s.tagline || '').length > 10) signals++;
  if (ed.team || ed.founders || ed.revenue || ed.funding || ed.backed_by || (ed.value_proposition && ed.value_proposition.length > 10)) signals++;
  return signals;
}

async function main() {
  console.log('\n=== ENRICH SPARSE STARTUPS WITH T1 VC BACKING ===\n');
  if (DRY_RUN) console.log('[DRY RUN] No writes.\n');
  console.log(`Limit: ${LIMIT}\n`);

  const cols = 'id, name, website, company_website, pitch, description, extracted_data, sectors, stage, raise_amount, customer_count, mrr, arr';
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select(cols)
      .eq('status', 'approved')
      .range(from, from + 1999);
    if (error) { console.error(error.message); process.exit(1); }
    if (!data?.length) break;
    all = all.concat(data);
    if (data.length < 2000) break;
    from += 2000;
  }

  const sparse = all.filter(s => {
    if (s.website || s.company_website) return false;
    return scoreDataRichness(s) <= 2 || isDataSparse({ extracted_data: s.extracted_data });
  });
  const withT1 = sparse.filter(s => extractT1FromStartup(s));
  const plausible = withT1.filter(s => isPlausibleStartupName(s.name));
  const highConfidence = plausible.filter(s => isHighConfidenceName(s.name));
  const toProcess = highConfidence.slice(0, LIMIT);

  console.log(`  Approved (no website): ${all.filter(s => !s.website && !s.company_website).length}`);
  console.log(`  Sparse (richness ≤2 or isDataSparse): ${sparse.length}`);
  console.log(`  Sparse + T1 VC mentioned: ${withT1.length}`);
  console.log(`  Plausible names (skip headline/junk): ${plausible.length}`);
  console.log(`  High-confidence only (skip ambiguous/generic): ${highConfidence.length}`);
  console.log(`  Processing (limit ${LIMIT}): ${toProcess.length}\n`);

  if (toProcess.length === 0) {
    console.log('Nothing to do.');
    return;
  }

  let enriched = 0;
  for (let i = 0; i < toProcess.length; i++) {
    const s = toProcess[i];
    const vcLabel = extractT1FromStartup(s);
    if (!vcLabel) continue;
    console.log(`[${i + 1}/${toProcess.length}] ${s.name} (VC: ${vcLabel})`);
    const currentData = s.extracted_data || {};
    const result = await quickEnrichWithVC(s.name, vcLabel, currentData, s.website || s.company_website || null, 8000);
    if (result.enrichmentCount === 0 && !result.enrichedData) {
      console.log('  — no new data');
      continue;
    }
    const merged = { ...currentData, ...result.enrichedData };
    if (result.enrichmentCount > 0 && !DRY_RUN) {
      const updatePayload = {
        extracted_data: merged,
        last_enrichment_attempt: new Date().toISOString(),
        enrichment_status: 'enriched',
      };
      if (merged.raise_amount && !s.raise_amount) updatePayload.raise_amount = merged.raise_amount;
      if (merged.sectors?.length && (!s.sectors || !s.sectors.length)) updatePayload.sectors = merged.sectors;
      if (merged.customer_count && !s.customer_count) updatePayload.customer_count = merged.customer_count;
      if (merged.arr && !s.arr) updatePayload.arr = merged.arr;
      if (merged.mrr && !s.mrr) updatePayload.mrr = merged.mrr;
      const { error } = await supabase.from('startup_uploads').update(updatePayload).eq('id', s.id);
      if (error) console.log('  ⚠️ Update error:', error.message);
      else { enriched++; console.log(`  ✅ +${result.enrichmentCount} fields`); }
    } else if (result.enrichmentCount > 0) {
      console.log(`  [dry-run] would write +${result.enrichmentCount} fields`);
      enriched++;
    }
    await new Promise(r => setTimeout(r, 800));
  }

  console.log(`\nEnriched: ${enriched}/${toProcess.length}`);
  if (!DRY_RUN && enriched > 0) console.log('Next: npm run recalc');
}

main().catch(err => { console.error(err); process.exit(1); });
