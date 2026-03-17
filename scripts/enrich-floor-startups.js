#!/usr/bin/env node
/**
 * FLOOR STARTUP ENRICHER
 * ======================
 * Targets approved startups at the GOD score floor (= 40) that have descriptions
 * but no parsed metric columns set (funding_confidence IS NULL).
 *
 * These are primarily RSS-scraped news articles with text like:
 *   "Gopersonal closed a US$300,000 seed financing round led by 500 Global"
 *
 * The startup-metric-parser.js (run via backfill-startup-metrics.js) uses a
 * confidence-gated system. This script writes directly to extracted_data JSONB,
 * which is read as a fallback in toScoringProfile() WITHOUT confidence gating:
 *   extracted_data.funding_amount -> funding_amount
 *   extracted_data.has_revenue    -> has_revenue
 *   extracted_data.backed_by      -> backed_by
 *   extracted_data.is_launched    -> launched
 *   extracted_data.execution_signals -> execution_signals
 *
 * After running this, re-run: npx tsx scripts/recalculate-scores.ts
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

const BATCH_SIZE = 50;
const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');
const ALL_FLOOR = process.argv.includes('--all-floor'); // re-process confidence=0 ones too
const BELOW_40 = process.argv.includes('--below-40');   // target total_god_score < 40 (for enrich-purge-recalc pipeline)
const limitArg = process.argv.find(a => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1]) : null;

// ---------------------------------------------------------------------------
// KNOWN TIER-1 INVESTORS (for backed_by signal)
// ---------------------------------------------------------------------------
const TIER1_INVESTORS = [
  'sequoia', 'andreessen', 'a16z', 'y combinator', 'ycombinator', 'accel',
  'benchmark', 'founders fund', 'kleiner', 'general catalyst', 'greylock',
  'lightspeed', 'softbank', 'tiger global', 'coatue', 'bessemer', 'battery',
  'index ventures', 'spark capital', '500 global', '500 startups', 'techstars',
  'first round', 'felicis', 'flatiron', 'meritech', 'norwest', 'nea',
  'insight partners', 'vista equity', 'thrive capital', 'lux capital',
  'moonfire', 'openai', 'google ventures', 'gv', 'intel capital',
  'microsoft ventures', 'm12', 'salesforce ventures', 'qualcomm ventures',
];

const ACCELERATORS = [
  'y combinator', 'yc', 'techstars', '500 global', '500 startups',
  'plug and play', 'antler', 'founder institute', 'startupbootcamp',
  'masschallenge', 'dreamit', 'alchemist',
];

// ---------------------------------------------------------------------------
// FUNDING AMOUNT PARSER
// Catches formats: $300,000 | US$1.5M | €200M | £1.3B | raised 10 million
// ---------------------------------------------------------------------------
function parseFundingFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase();

  // Pattern: currency + number + optional suffix (K/M/B or word)
  const patterns = [
    // $1.5M, $300K, $2B — dollar with suffix
    /(?:us\$|usd\s*|\$)\s*([\d,]+(?:\.\d+)?)\s*([kmb])\b/gi,
    // $300,000 — dollar with commas, no suffix
    /(?:us\$|usd\s*|\$)\s*([\d]{1,3}(?:,\d{3})+)/gi,
    // €200 million, £1.3 billion
    /(?:€|£|eur\s*|gbp\s*)([\d,]+(?:\.\d+)?)\s*(million|billion|m\b|b\b)/gi,
    // "raised X million/billion" without currency symbol
    /raised\s+([\d,]+(?:\.\d+)?)\s*(million|billion|m\b|b\b)/gi,
    // "X million in" funding context
    /\b([\d,]+(?:\.\d+)?)\s*(million|billion)\s+in\s+(?:funding|investment|round|seed|series)/gi,
    // "closed a $Xm round" style
    /closed\s+(?:a\s+)?(?:us\$|usd\s*|\$)\s*([\d,]+(?:\.\d+)?)\s*([kmb])\b/gi,
  ];

  const amounts = [];

  for (const pat of patterns) {
    let m;
    const fresh = new RegExp(pat.source, pat.flags);
    while ((m = fresh.exec(t)) !== null) {
      const numStr = m[1].replace(/,/g, '');
      const num = parseFloat(numStr);
      const suffix = (m[2] || '').toLowerCase().replace(/[^kmb]/g, '');
      let amount = num;
      if (suffix === 'k') amount = num * 1000;
      else if (suffix === 'm' || suffix === 'million') amount = num * 1_000_000;
      else if (suffix === 'b' || suffix === 'billion') amount = num * 1_000_000_000;

      // Plausibility guard: 10K to 15B (filter out TAM / market size)
      if (amount >= 10_000 && amount <= 15_000_000_000) {
        // Extra guard: skip if preceded by "market" or "tam" or "valuation"
        const ctx = t.slice(Math.max(0, m.index - 40), m.index);
        if (/\b(market|tam|sam|som|opportunity|valuation|worth|size)\b/.test(ctx)) continue;
        amounts.push(amount);
      }
    }
  }

  // Return the best (largest plausible) amount found
  // News articles report the round size, which is usually the most prominent number
  if (amounts.length === 0) return null;
  return Math.max(...amounts);
}

// ---------------------------------------------------------------------------
// INVESTOR EXTRACTOR
// ---------------------------------------------------------------------------
function extractInvestors(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const found = [];

  for (const inv of TIER1_INVESTORS) {
    if (t.includes(inv)) {
      // Capitalize properly
      found.push(inv.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '));
    }
  }

  // Also catch "led by [Name]" or "backed by [Name]" patterns
  const ledByPattern = /(?:led by|backed by|with participation from|co-led by)\s+([A-Z][a-zA-Z\s&]+?)(?:\s*[,.\n]|$)/g;
  let m;
  while ((m = ledByPattern.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length > 2 && name.length < 60 && !found.includes(name)) {
      found.push(name);
    }
  }

  // De-dupe
  return [...new Set(found)].slice(0, 10);
}

// ---------------------------------------------------------------------------
// USER / CUSTOMER COUNT PARSER
// ---------------------------------------------------------------------------
function parseUserCount(text) {
  if (!text) return null;
  const patterns = [
    /\b([\d,]+(?:\.\d+)?[KMkm]?)\s*(?:daily\s+)?(?:active\s+)?(?:users|customers|clients|subscribers|downloads)\b/gi,
    /\b(\d+[KMkm])\s*(?:dau|mau|wau)\b/gi,
    /\bdau\s+(?:of\s+)?(\d+[KMkm]?\d*)\b/gi,
  ];

  for (const pat of patterns) {
    const m = pat.exec(text);
    if (m) {
      const numStr = m[1].replace(/,/g, '').toLowerCase();
      let num = parseFloat(numStr);
      if (numStr.endsWith('k')) num *= 1000;
      else if (numStr.endsWith('m')) num *= 1_000_000;
      if (num >= 10 && num <= 5_000_000_000) return Math.round(num);
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// REVENUE / LAUNCH SIGNALS
// ---------------------------------------------------------------------------
function detectSignals(text) {
  if (!text) return { hasRevenue: false, isLaunched: false, inAccelerator: false };
  const t = text.toLowerCase();

  const hasRevenue = /\b(revenue|arr|mrr|gmv|profitable|paying customers?|subscription|recurring|first \$|generating \$)\b/.test(t);

  const isLaunched = /\b(launched|live|shipped|deployed|in production|now available|released|went live|public beta|generally available)\b/.test(t);

  const inAccelerator = ACCELERATORS.some(acc => t.includes(acc));

  return { hasRevenue, isLaunched, inAccelerator };
}

// ---------------------------------------------------------------------------
// INDUSTRY / SECTOR EXTRACTOR
// Maps description keywords → standard sector labels the scorer uses
// ---------------------------------------------------------------------------
const SECTOR_KEYWORDS = {
  'AI / Machine Learning': ['artificial intelligence', ' ai ', 'machine learning', 'deep learning', 'llm', 'large language model', 'neural network', 'generative ai', 'ai-powered', 'ai-driven'],
  'Cybersecurity': ['cybersecurity', 'data protection', 'security startup', 'infosec', 'threat detection', 'zero trust', 'siem', 'endpoint security', 'identity security', 'data privacy'],
  'Fintech': ['fintech', 'financial technology', 'payments', 'neobank', 'banking', 'lending', 'insurtech', 'wealthtech', 'financial services', 'remittance', 'crypto', 'defi', 'blockchain'],
  'Healthcare': ['healthtech', 'health tech', 'medtech', 'medical', 'healthcare', 'clinical', 'patient', 'hospital', 'pharma', 'biotech', 'drug discovery', 'diagnostics', 'digital health', 'mental health'],
  'SaaS': ['saas', 'software as a service', 'b2b software', 'enterprise software', 'subscription software', 'cloud software', 'platform for'],
  'Developer Tools': ['developer', 'devops', 'api', 'sdk', 'open source', 'infrastructure', 'deployment', 'ci/cd', 'monitoring', 'observability', 'cloud-native'],
  'E-commerce': ['e-commerce', 'ecommerce', 'marketplace', 'online store', 'retail tech', 'd2c', 'direct-to-consumer', 'supply chain'],
  'Climate Tech': ['climate', 'cleantech', 'clean tech', 'renewable', 'sustainability', 'carbon', 'net zero', 'electric vehicle', 'solar', 'green energy', 'energy storage'],
  'Logistics': ['logistics', 'supply chain', 'shipping', 'fulfillment', 'last-mile', 'freight', 'warehouse', 'delivery'],
  'EdTech': ['edtech', 'education technology', 'e-learning', 'online learning', 'tutoring', 'upskilling', 'skill development', 'training platform'],
  'Real Estate': ['proptech', 'real estate', 'property tech', 'construction tech', 'contech', 'renting', 'mortgage'],
  'Space': ['space tech', 'satellite', 'aerospace', 'launch vehicle', 'orbital', 'spacetech'],
  'Robotics': ['robotics', 'robot', 'automation hardware', 'industrial automation', 'autonomous systems', 'drones', 'drone'],
  'Biotech': ['biotech', 'biotechnology', 'genomics', 'gene therapy', 'crispr', 'cell therapy', 'protein', 'synthetic biology'],
  'AgriTech': ['agritech', 'agtech', 'agriculture', 'farming', 'crop', 'food tech', 'food technology'],
  'HR Tech': ['hr tech', 'hrtech', 'workforce', 'talent management', 'recruiting', 'hiring platform', 'payroll', 'employee'],
  'Legal Tech': ['legaltech', 'legal tech', 'law tech', 'compliance', 'contract management', 'legal ai'],
  'Gaming': ['gaming', 'game studio', 'esports', 'game engine', 'metaverse', 'web3 game'],
};

function extractIndustries(text) {
  if (!text) return [];
  const t = text.toLowerCase();
  const found = new Set();
  for (const [sector, keywords] of Object.entries(SECTOR_KEYWORDS)) {
    if (keywords.some(kw => t.includes(kw))) {
      found.add(sector);
    }
  }
  return [...found].slice(0, 3);
}

// ---------------------------------------------------------------------------
// VALUE PROPOSITION EXTRACTOR
// Extracts what the startup does from patterns like:
//   "X startup NAME raises $Y" → "X" is the vp
//   "NAME, a X platform, raises..." → "X platform" is the vp
// ---------------------------------------------------------------------------
function extractValueProp(text, startupName) {
  if (!text) return null;

  // Pattern: "a/an [descriptor] [startup/platform/company]"
  const vpPatterns = [
    /\ba(?:n)?\s+(.{5,60}?)\s+(?:startup|company|firm|platform|provider|solution|tool|app)\b/i,
    /\b(?:develop|build|create|offer|provide)s?\s+(.{5,80}?)\s+(?:platform|tool|solution|software|app|service)\b/i,
  ];

  for (const pat of vpPatterns) {
    const m = pat.exec(text);
    if (m) {
      const vp = m[1].trim();
      // Must be reasonable length, not just "AI" or "the"
      if (vp.length > 8 && vp.length < 80 && !/^\b(an?|the)\b$/i.test(vp)) {
        return vp.charAt(0).toUpperCase() + vp.slice(1);
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// STAGE INFERENCE
// ---------------------------------------------------------------------------
function inferStage(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/\bseries [de]\b/.test(t)) return 'Series D+';
  if (/\bseries c\b/.test(t)) return 'Series C';
  if (/\bseries b\b/.test(t)) return 'Series B';
  if (/\bseries a\b/.test(t)) return 'Series A';
  if (/\bpre[-\s]seed\b/.test(t)) return 'Pre-Seed';
  if (/\bseed\b/.test(t)) return 'Seed';
  return null;
}

// ---------------------------------------------------------------------------
// MAIN ENRICHMENT LOGIC: build extracted_data patch for one startup
// ---------------------------------------------------------------------------
function enrichStartup(startup) {
  const fullText = [
    startup.name || '',
    startup.tagline || '',
    startup.description || '',
    startup.pitch || '',
    (startup.extracted_data && startup.extracted_data.description) || '',
    (startup.extracted_data && startup.extracted_data.solution) || '',
  ].join(' ');

  const fundingAmount = parseFundingFromText(fullText);
  const investors = extractInvestors(fullText);
  const userCount = parseUserCount(fullText);
  const { hasRevenue, isLaunched, inAccelerator } = detectSignals(fullText);
  const stage = inferStage(fullText);
  const industries = extractIndustries(fullText);
  const valueProp = extractValueProp(fullText, startup.name);

  // Build execution_signals array
  const execSignals = [];
  if (isLaunched) execSignals.push('Product Launched');
  if (hasRevenue) execSignals.push('Has Revenue');
  if (userCount && userCount >= 100) execSignals.push('Has Users');
  if (investors.length > 0) execSignals.push('Investor Backed');
  if (inAccelerator) execSignals.push('Accelerator Alumni');

  // Only return a patch if we found SOMETHING useful
  const hasSomething = fundingAmount || investors.length > 0 || userCount || hasRevenue || isLaunched || inAccelerator || stage || industries.length > 0 || valueProp;
  if (!hasSomething) return null;

  // Merge into existing extracted_data
  const existing = startup.extracted_data || {};
  const patch = {
    ...existing,
    // Only set if we found a value and it wasn't already set
    ...(fundingAmount && !existing.funding_amount ? { funding_amount: fundingAmount } : {}),
    ...(investors.length > 0 && !existing.backed_by ? { backed_by: investors } : {}),
    ...(investors.length > 0 && !existing.investors ? { investors } : {}),
    ...(userCount && !existing.active_users ? { active_users: userCount } : {}),
    ...(hasRevenue && !existing.has_revenue ? { has_revenue: true } : {}),
    ...(isLaunched && !existing.is_launched ? { is_launched: true } : {}),
    ...(stage && !existing.funding_stage ? { funding_stage: stage } : {}),
    // Industries/value prop: feed market + vision scorers
    ...(industries.length > 0 && !existing.industries ? { industries, sectors: industries } : {}),
    ...(valueProp && !existing.value_proposition ? { value_proposition: valueProp } : {}),
    execution_signals: [...new Set([...(existing.execution_signals || []), ...execSignals])],
    enriched_at: new Date().toISOString(),
    enrichment_source: 'enrich-floor-startups',
  };

  return {
    id: startup.id,
    patch,
    signals: {
      fundingAmount,
      investors,
      userCount,
      hasRevenue,
      isLaunched,
      inAccelerator,
      stage,
      industries,
      valueProp,
    },
  };
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  FLOOR STARTUP ENRICHER                                  ║');
  console.log('║  Parses descriptions → populates extracted_data signals  ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Dry run: ${DRY_RUN}`);
  console.log(`  All floor: ${ALL_FLOOR} (includes confidence=0 re-runs)`);
  console.log(`  Below 40: ${BELOW_40} (score < 40)`);
  if (LIMIT) console.log(`  Limit: ${LIMIT}`);
  console.log('');

  // Fetch target startups
  let query = supabase
    .from('startup_uploads')
    .select('id, name, tagline, description, pitch, extracted_data, total_god_score, funding_confidence')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (BELOW_40) {
    query = query.lt('total_god_score', 40).not('total_god_score', 'is', null);
  } else {
    query = query.eq('total_god_score', 40);
    if (!ALL_FLOOR) {
      query = query.is('funding_confidence', null);
    }
  }

  const PAGE_SIZE = 1000;
  let allStartups = [];
  let pageOffset = 0;

  while (true) {
    const { data: page, error } = await query.range(pageOffset, pageOffset + PAGE_SIZE - 1);
    if (error) { console.error('Fetch error:', error.message); process.exit(1); }
    if (!page || page.length === 0) break;
    allStartups = allStartups.concat(page);
    if (page.length < PAGE_SIZE) break;
    pageOffset += PAGE_SIZE;
    if (LIMIT && allStartups.length >= LIMIT) { allStartups = allStartups.slice(0, LIMIT); break; }
  }

  console.log(`  Found ${allStartups.length} target startups\n`);

  if (allStartups.length === 0) {
    console.log('  Nothing to enrich.' + (BELOW_40 ? ' No approved startups with score < 40.' : ' All floor startups already processed.'));
    return;
  }

  // Enrich all
  const enriched = [];
  let skipped = 0;

  for (const startup of allStartups) {
    const result = enrichStartup(startup);
    if (result) {
      enriched.push(result);
      if (VERBOSE) {
        const s = result.signals;
        console.log(`  + ${startup.name.slice(0, 40).padEnd(40)} | fund:${s.fundingAmount ? '$' + (s.fundingAmount/1e6).toFixed(1) + 'M' : '-'} | inv:${s.investors.length} | users:${s.userCount || '-'} | rev:${s.hasRevenue ? 'Y' : '-'} | launched:${s.isLaunched ? 'Y' : '-'}`);
      }
    } else {
      skipped++;
    }
  }

  // Stats
  const stats = {
    withFunding: enriched.filter(e => e.signals.fundingAmount).length,
    withInvestors: enriched.filter(e => e.signals.investors.length > 0).length,
    withUsers: enriched.filter(e => e.signals.userCount).length,
    withRevenue: enriched.filter(e => e.signals.hasRevenue).length,
    withLaunch: enriched.filter(e => e.signals.isLaunched).length,
    withIndustries: enriched.filter(e => e.signals.industries && e.signals.industries.length > 0).length,
    withValueProp: enriched.filter(e => e.signals.valueProp).length,
  };

  console.log(`\n  📊 Enrichment results:`);
  console.log(`     Enrichable:    ${enriched.length} / ${allStartups.length}`);
  console.log(`     Skipped:       ${skipped} (no usable signals)`);
  console.log(`     Funding amt:   ${stats.withFunding}`);
  console.log(`     Investors:     ${stats.withInvestors}`);
  console.log(`     User count:    ${stats.withUsers}`);
  console.log(`     Revenue flag:  ${stats.withRevenue}`);
  console.log(`     Launched flag: ${stats.withLaunch}`);
  console.log(`     Industries:    ${stats.withIndustries}`);
  console.log(`     Value prop:    ${stats.withValueProp}`);

  if (DRY_RUN) {
    console.log('\n  [DRY RUN] — not writing to database');
    return;
  }

  console.log(`\n  📝 Writing ${enriched.length} enriched records in batches of ${BATCH_SIZE}...`);

  let written = 0;
  let errors = 0;

  for (let i = 0; i < enriched.length; i += BATCH_SIZE) {
    const batch = enriched.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(enriched.length / BATCH_SIZE);

    // Use individual upserts (no exec_ddl needed — we're updating a JSONB field)
    const updates = await Promise.allSettled(
      batch.map(({ id, patch }) =>
        supabase
          .from('startup_uploads')
          .update({ extracted_data: patch })
          .eq('id', id)
      )
    );

    const batchErrors = updates.filter(r => r.status === 'rejected' || r.value?.error).length;
    written += batch.length - batchErrors;
    errors += batchErrors;

    process.stdout.write(`\r  Batch ${batchNum}/${totalBatches} — ${written} written, ${errors} errors`);
  }

  console.log('\n');
  console.log(`  ✅ Done — ${written} startups enriched`);
  if (errors > 0) console.log(`  ⚠️  ${errors} errors encountered`);
  console.log('');
  console.log('  Next step: npx tsx scripts/recalculate-scores.ts');
  console.log('');
}

main().catch(err => { console.error(err); process.exit(1); });
